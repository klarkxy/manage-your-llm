import {
  isNormalizedError,
  NoRouteAvailableError,
  PermissionError,
  ProviderError,
  ProviderQuotaError,
  ProviderRateLimitError,
  ProviderStreamError,
  ProviderTimeoutError,
  type ChatRequestIR,
  type NormalizedChatResponse,
  type NormalizedError,
} from '@manageyourllm/shared';
import { PublicModelRepository } from '../infrastructure/db/repositories/public-model.repository.js';
import { ModelGroupRepository } from '../infrastructure/db/repositories/model-group.repository.js';
import { ConsumerKeyRepository } from '../infrastructure/db/repositories/consumer-key.repository.js';
import { UpstreamKeyRepository } from '../infrastructure/db/repositories/upstream-key.repository.js';
import { RoutingStateRepository } from '../infrastructure/db/repositories/routing-state.repository.js';
import type { Db } from '../infrastructure/db/client.js';
import type { ConsumerKeyRow, AppRow } from '../infrastructure/db/schema.js';
import { TargetResolutionService } from '../domain/gateway/target-resolution.service.js';
import { AccessPolicyService } from '../domain/identity-access/access-policy.service.js';
import { RoutingDecisionService } from '../domain/gateway/routing-decision.service.js';
import { SettingsService } from '../domain/settings/settings.service.js';
import { UpstreamAuthResolver } from '../gateway/upstream-auth-resolver.js';
import { UpstreamSender } from '../gateway/upstream-sender.js';
import { getProviderAdapter } from '../gateway/providers/registry.js';
import { mapResponseToSourceProtocol } from '../gateway/response-mappers.js';
import {
  GatewaySideEffectsService,
  type ExecutionBaseInfo,
} from './gateway-side-effects.service.js';
import type { RoutingCandidate, RoutingDecision } from '../domain/gateway/routing.types.js';

export interface GatewayExecutionContext {
  db: Db;
  consumerKey: ConsumerKeyRow;
  app: AppRow;
  requestTraceId: string;
}

export interface GatewayExecutionDeps {
  db: Db;
  secretKey: string;
  sender?: UpstreamSender;
  authResolver?: UpstreamAuthResolver;
  routingDecisionService?: RoutingDecisionService;
  sideEffectsService?: GatewaySideEffectsService;
}

export interface ModelListItem {
  id: string;
  object: 'model';
  created?: number;
  owned_by?: string;
}

function toNormalizedError(err: unknown): NormalizedError {
  if (isNormalizedError(err)) return err;
  if (err instanceof Error) return new ProviderError(err.message);
  return new ProviderError(String(err));
}

function isRetriable(err: NormalizedError): boolean {
  if (
    err instanceof ProviderRateLimitError ||
    err instanceof ProviderQuotaError ||
    err instanceof ProviderTimeoutError
  ) {
    return true;
  }
  if (err instanceof ProviderError) {
    const status = err.details && typeof err.details === 'object' ? (err.details as Record<string, unknown>).status : undefined;
    if (typeof status === 'number' && status >= 500) return true;
  }
  return false;
}

export class GatewayExecutionService {
  private readonly db: Db;
  private readonly secretKey: string;
  private readonly sender: UpstreamSender;
  private readonly authResolver: UpstreamAuthResolver;
  private readonly deps: GatewayExecutionDeps;

  constructor(deps: GatewayExecutionDeps) {
    this.db = deps.db;
    this.secretKey = deps.secretKey;
    this.sender = deps.sender ?? new UpstreamSender();
    this.authResolver = deps.authResolver ?? new UpstreamAuthResolver({ secretKey: deps.secretKey });
    this.deps = deps;
  }

  async listModels(ctx: GatewayExecutionContext): Promise<{ object: 'list'; data: ModelListItem[] }> {
    const publicModelRepo = new PublicModelRepository(ctx.db);
    const modelGroupRepo = new ModelGroupRepository(ctx.db);

    const [publicModels, modelGroups] = await Promise.all([
      publicModelRepo.listPublicModels(),
      modelGroupRepo.listModelGroups(),
    ]);

    const enabledModels = publicModels.filter((m) => m.enabled);
    const enabledGroups = modelGroups.filter((g) => g.enabled);

    let allowedModels = enabledModels;
    let allowedGroups = enabledGroups;

    if (ctx.consumerKey.accessMode === 'restricted') {
      const accessList = await new ConsumerKeyRepository(ctx.db).listAccessByKey(ctx.consumerKey.id);
      const allowedModelIds = new Set(
        accessList.filter((a) => a.targetType === 'public_model').map((a) => a.targetId),
      );
      const allowedGroupIds = new Set(
        accessList.filter((a) => a.targetType === 'model_group').map((a) => a.targetId),
      );
      allowedModels = enabledModels.filter((m) => allowedModelIds.has(m.id));
      allowedGroups = enabledGroups.filter((g) => allowedGroupIds.has(g.id));
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const data: ModelListItem[] = [
      ...allowedModels.map((m) => ({
        id: m.name,
        object: 'model' as const,
        created: nowSeconds,
        owned_by: 'manageyourllm',
      })),
      ...allowedGroups.map((g) => ({
        id: g.name,
        object: 'model' as const,
        created: nowSeconds,
        owned_by: 'manageyourllm',
      })),
    ];

    return { object: 'list', data };
  }

  async executeChat(ctx: GatewayExecutionContext, ir: ChatRequestIR): Promise<{ status: number; body: unknown }> {
    if (ir.stream) {
      throw new ProviderStreamError('流式请求暂未实现');
    }

    const targetResolution = new TargetResolutionService(this.db);
    const accessPolicy = new AccessPolicyService(this.db);
    const settingsService = new SettingsService(this.db);

    const resolved = await targetResolution.resolve(ir.requestedModel);
    const access = await accessPolicy.checkAccess(ctx.consumerKey, ir.requestedModel);
    if (!access.allowed) {
      throw new PermissionError('无权访问该目标模型');
    }

    const settings = await settingsService.getSettings();
    const decision = await this.makeRoutingDecision(ctx, ir, resolved, settings);

    const base: ExecutionBaseInfo = {
      requestTraceId: ctx.requestTraceId,
      appId: ctx.app.id,
      consumerKeyId: ctx.consumerKey.id,
      requestedTargetName: ir.requestedModel,
      resolvedTargetType: resolved.type,
      resolvedTargetId: resolved.id,
    };

    const sideEffects = this.getSideEffectsService();
    await sideEffects.recordDecisionTraceEvents(base, decision.traceEvents);

    if (decision.candidates.length === 0) {
      throw new NoRouteAvailableError('当前没有可用的上游路由');
    }

    let lastError: NormalizedError | undefined;

    for (let index = 0; index < decision.candidates.length; index++) {
      const candidate = decision.candidates[index];
      if (!candidate) continue;

      const attemptResult = await this.attemptCandidate(ctx, ir, candidate, decision, settings, base, sideEffects, index);
      if (attemptResult.ok) {
        return {
          status: 200,
          body: mapResponseToSourceProtocol(ir.sourceProtocol, ir.requestedModel, attemptResult.normalized),
        };
      }

      lastError = attemptResult.error;
      if (!attemptResult.retriable) {
        throw attemptResult.error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new NoRouteAvailableError('所有上游路由均不可用');
  }

  private async makeRoutingDecision(
    ctx: GatewayExecutionContext,
    ir: ChatRequestIR,
    resolved: Awaited<ReturnType<TargetResolutionService['resolve']>>,
    settings: Awaited<ReturnType<SettingsService['getSettings']>>,
  ) {
    const decisionService =
      this.deps?.routingDecisionService ??
      new RoutingDecisionService(
        new PublicModelRepository(this.db),
        new ModelGroupRepository(this.db),
        new UpstreamKeyRepository(this.db),
        new RoutingStateRepository(this.db),
      );

    return decisionService.decide({
      ir,
      resolvedTarget: resolved,
      consumerKeyId: ctx.consumerKey.id,
      appId: ctx.app.id,
      settings,
      now: new Date(),
    });
  }

  private async attemptCandidate(
    ctx: GatewayExecutionContext,
    ir: ChatRequestIR,
    candidate: RoutingCandidate,
    decision: RoutingDecision,
    settings: Awaited<ReturnType<SettingsService['getSettings']>>,
    base: ExecutionBaseInfo,
    sideEffects: GatewaySideEffectsService,
    index: number,
  ): Promise<{ ok: true; normalized: NormalizedChatResponse } | { ok: false; error: NormalizedError; retriable: boolean }> {
    try {
      const adapter = getProviderAdapter(candidate.providerType);
      const authHeaders = await this.authResolver.resolveAuthHeaders(candidate.upstreamKey);
      const upstreamRequest = adapter.buildRequest({
        upstreamKey: candidate.upstreamKey,
        realModelName: candidate.realModelName,
        ir,
        authHeaders,
      });

      const upstreamResponse = await this.sender.send({
        ...upstreamRequest,
        timeoutMs: settings.defaultRequestTimeoutMs ?? 30_000,
      });

      if (upstreamResponse.status >= 200 && upstreamResponse.status < 300) {
        const normalized = adapter.normalizeResponse({
          upstreamKey: candidate.upstreamKey,
          realModelName: candidate.realModelName,
          sourceProtocol: ir.sourceProtocol,
          status: upstreamResponse.status,
          headers: upstreamResponse.headers,
          body: upstreamResponse.body,
        });

        await sideEffects.recordOutcome(base, candidate, {
          ...base,
          upstreamKeyId: candidate.upstreamKey.id,
          realModelName: candidate.realModelName,
          sourceProtocol: ir.sourceProtocol,
          providerType: candidate.providerType,
          stream: ir.stream,
          stickyHit: decision.stickyHit,
          sessionStickyHit: decision.sessionStickyHit,
          conversationFingerprint: decision.conversationFingerprint,
          latencyMs: upstreamResponse.latencyMs,
          success: true,
          usage: normalized.usage,
        }, settings);

        return { ok: true, normalized };
      }

      const error = adapter.normalizeError({
        upstreamKey: candidate.upstreamKey,
        realModelName: candidate.realModelName,
        status: upstreamResponse.status,
        body: upstreamResponse.body,
      });

      await sideEffects.recordTraceEvent(base, {
        step: 'upstream_attempt_failed',
        stepIndex: 1000 + index,
        upstreamKeyId: candidate.upstreamKey.id,
        realModelName: candidate.realModelName,
        status: 'fail',
        errorCode: error.code,
        errorMessage: error.message,
      });

      await sideEffects.recordOutcome(base, candidate, {
        ...base,
        upstreamKeyId: candidate.upstreamKey.id,
        realModelName: candidate.realModelName,
        sourceProtocol: ir.sourceProtocol,
        providerType: candidate.providerType,
        stream: ir.stream,
        stickyHit: decision.stickyHit,
        sessionStickyHit: decision.sessionStickyHit,
        conversationFingerprint: decision.conversationFingerprint,
        latencyMs: upstreamResponse.latencyMs,
        success: false,
        usage: null,
        error,
      }, settings);

      return { ok: false, error, retriable: isRetriable(error) };
    } catch (err) {
      const error = toNormalizedError(err);
      await sideEffects.recordTraceEvent(base, {
        step: 'upstream_attempt_failed',
        stepIndex: 1000 + index,
        upstreamKeyId: candidate.upstreamKey.id,
        realModelName: candidate.realModelName,
        status: 'fail',
        errorCode: error.code,
        errorMessage: error.message,
      });

      await sideEffects.recordOutcome(base, candidate, {
        ...base,
        upstreamKeyId: candidate.upstreamKey.id,
        realModelName: candidate.realModelName,
        sourceProtocol: ir.sourceProtocol,
        providerType: candidate.providerType,
        stream: ir.stream,
        stickyHit: decision.stickyHit,
        sessionStickyHit: decision.sessionStickyHit,
        conversationFingerprint: decision.conversationFingerprint,
        latencyMs: 0,
        success: false,
        usage: null,
        error,
      }, settings);

      return { ok: false, error, retriable: isRetriable(error) };
    }
  }

  private getSideEffectsService(): GatewaySideEffectsService {
    return this.deps?.sideEffectsService ?? new GatewaySideEffectsService(this.db);
  }
}
