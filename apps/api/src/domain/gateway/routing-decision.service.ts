import {
  requiredCapabilities,
  type RequiredCapabilities,
  type SourceProtocol,
} from '@manageyourllm/shared';
import { PROTOCOL_BY_PROVIDER } from '@manageyourllm/shared';
import { PublicModelRepository } from '../../infrastructure/db/repositories/public-model.repository.js';
import { ModelGroupRepository } from '../../infrastructure/db/repositories/model-group.repository.js';
import { UpstreamKeyRepository } from '../../infrastructure/db/repositories/upstream-key.repository.js';
import { RoutingStateRepository } from '../../infrastructure/db/repositories/routing-state.repository.js';
import { computeConversationFingerprint } from './conversation-fingerprint.js';
import type {
  RoutingDecision,
  RoutingDecisionInput,
  RoutingCandidate,
  TraceEvent,
} from './routing.types.js';
import type {
  UpstreamKeyRow,
  PublicModelCandidateRow,
  ModelGroupMemberRow,
  AdminSettingsRow,
  QuotaPeriod,
} from '../../infrastructure/db/schema.js';

function periodBounds(
  period: Exclude<QuotaPeriod, 'total'>,
  now: Date,
): { startedAt: Date; endsAt: Date } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  const hours = now.getUTCHours();

  switch (period) {
    case 'hour': {
      const startedAt = new Date(Date.UTC(year, month, date, hours, 0, 0, 0));
      return { startedAt, endsAt: new Date(startedAt.getTime() + 60 * 60 * 1000) };
    }
    case 'day': {
      const startedAt = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
      return { startedAt, endsAt: new Date(startedAt.getTime() + 24 * 60 * 60 * 1000) };
    }
    case 'week': {
      const day = now.getUTCDay();
      const diff = day === 0 ? 6 : day - 1; // 周一为周起点
      const startedAt = new Date(Date.UTC(year, month, date - diff, 0, 0, 0, 0));
      return { startedAt, endsAt: new Date(startedAt.getTime() + 7 * 24 * 60 * 60 * 1000) };
    }
    case 'month': {
      const startedAt = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      return { startedAt, endsAt: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)) };
    }
  }
}

function providerSupportsCapability(
  providerType: UpstreamKeyRow['providerType'],
  capability: keyof RequiredCapabilities,
): boolean {
  const openaiFamily = new Set<UpstreamKeyRow['providerType']>([
    'openai_compatible',
    'coze',
    'codex',
    'openrouter',
    'groq',
    'fireworks',
    'together',
  ]);
  const anthropicFamily = new Set<UpstreamKeyRow['providerType']>([
    'anthropic_compatible',
    'deepseek',
    'moonshot',
    'minimax',
  ]);

  switch (capability) {
    case 'streaming':
      return true;
    case 'tools':
    case 'toolChoice':
    case 'jsonMode':
      return openaiFamily.has(providerType) || anthropicFamily.has(providerType);
    case 'vision':
      return openaiFamily.has(providerType) || providerType === 'anthropic_compatible';
    case 'thinking':
      return providerType === 'anthropic_compatible' || providerType === 'codex';
    default:
      return false;
  }
}

function providerSupportsProtocol(
  providerType: UpstreamKeyRow['providerType'],
  sourceProtocol: SourceProtocol,
): boolean {
  return PROTOCOL_BY_PROVIDER[providerType] === sourceProtocol;
}

export class RoutingDecisionService {
  constructor(
    private readonly publicModelRepo: PublicModelRepository,
    private readonly modelGroupRepo: ModelGroupRepository,
    private readonly upstreamKeyRepo: UpstreamKeyRepository,
    private readonly routingStateRepo: RoutingStateRepository,
  ) {}

  async decide(input: RoutingDecisionInput): Promise<RoutingDecision> {
    const { ir, resolvedTarget, consumerKeyId, appId, settings, now } = input;
    const fingerprint = computeConversationFingerprint(ir);
    const events: TraceEvent[] = [];

    events.push({
      step: 'candidates_expand',
      status: 'info',
      details: { targetType: resolvedTarget.type, targetName: resolvedTarget.name },
    });

    let candidates: RoutingCandidate[] = [];
    if (resolvedTarget.type === 'public_model') {
      candidates = await this.expandPublicModel(resolvedTarget.id, events);
    } else {
      candidates = await this.expandModelGroup(resolvedTarget.id, events);
    }

    events.push({
      step: 'candidates_filter',
      status: 'info',
      details: { before: candidates.length },
    });
    const filtered = await this.filterCandidates(candidates, ir, settings, now, events);
    const sorted = await this.sortCandidates(filtered, events);

    const finalCandidates = sorted;
    let stickyHit = false;
    let sessionStickyHit = false;

    if (settings.enableStickySession) {
      const binding = await this.routingStateRepo.findStickyBinding(
        appId,
        consumerKeyId,
        ir.requestedModel,
        fingerprint,
        now,
      );
      if (binding) {
        const matchIndex = finalCandidates.findIndex(
          (c) =>
            c.upstreamKey.id === binding.upstreamKeyId && c.realModelName === binding.realModelName,
        );
        if (matchIndex > 0) {
          const match = finalCandidates.splice(matchIndex, 1)[0];
          if (match) {
            finalCandidates.unshift(match);
            stickyHit = true;
            events.push({
              step: 'sticky_binding_hit',
              status: 'ok',
              details: { upstreamKeyId: binding.upstreamKeyId },
            });
          }
        } else if (matchIndex === 0) {
          stickyHit = true;
        }
      }

      if (!stickyHit) {
        const session = await this.routingStateRepo.findStickySession(
          consumerKeyId,
          ir.requestedModel,
          now,
        );
        if (session) {
          const matchIndex = finalCandidates.findIndex(
            (c) =>
              c.upstreamKey.id === session.upstreamKeyId &&
              c.realModelName === session.realModelName,
          );
          if (matchIndex > 0) {
            const match = finalCandidates.splice(matchIndex, 1)[0];
            if (match) {
              finalCandidates.unshift(match);
              sessionStickyHit = true;
              events.push({
                step: 'sticky_session_hit',
                status: 'ok',
                details: { upstreamKeyId: session.upstreamKeyId },
              });
            }
          } else if (matchIndex === 0) {
            sessionStickyHit = true;
          }
        }
      }
    }

    events.push({
      step: 'routing_decision',
      status: 'ok',
      details: { after: finalCandidates.length },
    });

    return {
      requestedModel: ir.requestedModel,
      resolvedTargetType: resolvedTarget.type,
      resolvedTargetId: resolvedTarget.id,
      resolvedTargetName: resolvedTarget.name,
      candidates: finalCandidates,
      stickyHit,
      sessionStickyHit,
      conversationFingerprint: fingerprint,
      traceEvents: events,
    };
  }

  private async expandPublicModel(
    publicModelId: string,
    _events: TraceEvent[],
  ): Promise<RoutingCandidate[]> {
    const candidateRows = await this.publicModelRepo.listCandidates(publicModelId);
    const result: RoutingCandidate[] = [];
    for (const row of candidateRows) {
      const upstream = await this.upstreamKeyRepo.findById(row.upstreamKeyId);
      if (!upstream) continue;
      result.push(this.toCandidate(upstream, row));
    }
    return result;
  }

  private async expandModelGroup(
    groupId: string,
    events: TraceEvent[],
  ): Promise<RoutingCandidate[]> {
    const members = await this.modelGroupRepo.listMembers(groupId);
    const group = await this.modelGroupRepo.findById(groupId);
    const enabledMembers = members.filter((m) => m.enabled);
    if (enabledMembers.length === 0) return [];

    let selectedMembers: ModelGroupMemberRow[];
    const policy = group?.routingPolicy ?? 'priority';

    if (policy === 'weighted') {
      selectedMembers = [this.weightedPick(enabledMembers)];
      events.push({
        step: 'group_weighted_pick',
        status: 'ok',
        details: { selected: selectedMembers[0]?.publicModelId },
      });
    } else if (policy === 'round_robin') {
      // 决策阶段不写入计数器，使用当前 counter 取模；副作用阶段再递增。
      const index = (group?.roundRobinCounter ?? 0) % enabledMembers.length;
      selectedMembers = [enabledMembers[index]!];
      events.push({ step: 'group_round_robin_pick', status: 'ok', details: { index } });
    } else {
      selectedMembers = enabledMembers.slice().sort((a, b) => a.priority - b.priority);
    }

    const result: RoutingCandidate[] = [];
    for (const member of selectedMembers) {
      const model = await this.publicModelRepo.findById(member.publicModelId);
      if (!model || !model.enabled) continue;
      const candidates = await this.publicModelRepo.listCandidates(member.publicModelId);
      for (const row of candidates) {
        const upstream = await this.upstreamKeyRepo.findById(row.upstreamKeyId);
        if (!upstream) continue;
        result.push({ ...this.toCandidate(upstream, row), modelGroupMemberId: member.id });
      }
    }
    return result;
  }

  private weightedPick(members: ModelGroupMemberRow[]): ModelGroupMemberRow {
    const total = members.reduce((sum, m) => sum + Math.max(1, m.weight), 0);
    let r = Math.random() * total;
    for (const m of members) {
      r -= Math.max(1, m.weight);
      if (r <= 0) return m;
    }
    return members[members.length - 1]!;
  }

  private toCandidate(upstream: UpstreamKeyRow, row: PublicModelCandidateRow): RoutingCandidate {
    return {
      upstreamKey: upstream,
      realModelName: row.realModelName,
      endpointUrl: row.endpointUrl ?? upstream.baseUrl,
      priority: row.priority,
      weight: row.weight,
      providerType: upstream.providerType,
      publicModelCandidateId: row.id,
    };
  }

  private async filterCandidates(
    candidates: RoutingCandidate[],
    ir: RoutingDecisionInput['ir'],
    settings: AdminSettingsRow,
    now: Date,
    events: TraceEvent[],
  ): Promise<RoutingCandidate[]> {
    const required = requiredCapabilities(ir.rawRequest);
    const result: RoutingCandidate[] = [];

    for (const c of candidates) {
      const upstream = c.upstreamKey;
      if (!upstream.enabled) {
        events.push({
          step: 'filter_disabled',
          status: 'drop',
          details: { upstreamKeyId: upstream.id, reason: 'upstream disabled' },
        });
        continue;
      }
      if (upstream.frozen) {
        events.push({
          step: 'filter_frozen',
          status: 'drop',
          details: { upstreamKeyId: upstream.id },
        });
        continue;
      }
      if (upstream.cooldownUntil && upstream.cooldownUntil > now) {
        events.push({
          step: 'filter_cooldown',
          status: 'drop',
          details: { upstreamKeyId: upstream.id },
        });
        continue;
      }
      if (!providerSupportsProtocol(upstream.providerType, ir.sourceProtocol)) {
        events.push({
          step: 'filter_protocol',
          status: 'drop',
          details: { upstreamKeyId: upstream.id, providerType: upstream.providerType },
        });
        continue;
      }
      if (!this.matchesCapabilities(upstream.providerType, required)) {
        events.push({
          step: 'filter_capability',
          status: 'drop',
          details: { upstreamKeyId: upstream.id, required },
        });
        continue;
      }
      if (settings.enableCircuitBreaker) {
        const breaker = await this.routingStateRepo.findBreaker(upstream.id, c.realModelName);
        if (breaker) {
          if (breaker.state === 'open') {
            if (breaker.cooldownUntil && breaker.cooldownUntil > now) {
              events.push({
                step: 'filter_breaker_open',
                status: 'drop',
                details: { upstreamKeyId: upstream.id },
              });
              continue;
            }
            // cooldown 已过，允许作为 half-open 尝试，并持久化为 half_open 状态。
            events.push({
              step: 'filter_breaker_half_open',
              status: 'ok',
              details: { upstreamKeyId: upstream.id },
            });
            await this.routingStateRepo.updateBreakerState(
              upstream.id,
              c.realModelName,
              'half_open',
              { cooldownUntil: null },
            );
          }
        }
      }
      if (await this.quotaExhausted(upstream.id, now)) {
        events.push({
          step: 'filter_quota',
          status: 'drop',
          details: { upstreamKeyId: upstream.id },
        });
        continue;
      }
      result.push(c);
    }

    return result;
  }

  private matchesCapabilities(
    providerType: UpstreamKeyRow['providerType'],
    required: RequiredCapabilities,
  ): boolean {
    for (const [key, value] of Object.entries(required)) {
      if (!value) continue;
      if (!providerSupportsCapability(providerType, key as keyof RequiredCapabilities)) {
        return false;
      }
    }
    return true;
  }

  private async quotaExhausted(upstreamKeyId: string, now: Date): Promise<boolean> {
    const quota = await this.upstreamKeyRepo.findQuotaByUpstreamKey(upstreamKeyId);
    if (!quota || !quota.enabled) return false;

    const periods: Exclude<QuotaPeriod, 'total'>[] = ['hour', 'day', 'week', 'month'];
    for (const period of periods) {
      const { startedAt, endsAt } = periodBounds(period, now);
      const counter = await this.upstreamKeyRepo.findCounter(upstreamKeyId, period, startedAt);
      if (counter && counter.periodEndsAt.getTime() === endsAt.getTime()) {
        if (quota.requestLimit != null && counter.requestCount >= quota.requestLimit) {
          return true;
        }
        if (quota.inputTokenLimit != null && counter.inputTokens >= quota.inputTokenLimit) {
          return true;
        }
        if (quota.outputTokenLimit != null && counter.outputTokens >= quota.outputTokenLimit) {
          return true;
        }
        if (quota.totalTokenLimit != null && counter.totalTokens >= quota.totalTokenLimit) {
          return true;
        }
      }
    }
    return false;
  }

  private async sortCandidates(
    candidates: RoutingCandidate[],
    events: TraceEvent[],
  ): Promise<RoutingCandidate[]> {
    const scored = await Promise.all(
      candidates.map(async (candidate) => {
        const health = await this.routingStateRepo.findEndpointHealth(
          candidate.upstreamKey.id,
          candidate.endpointUrl,
        );
        return { candidate, health };
      }),
    );

    const sorted = scored.slice().sort((a, b) => {
      // 1. 未降级优先于降级。
      const aDegraded = a.health?.degraded ?? false;
      const bDegraded = b.health?.degraded ?? false;
      if (aDegraded !== bDegraded) return Number(aDegraded) - Number(bDegraded);

      // 2. 有健康探测数据的优先于没有的，延迟越低越靠前。
      const aDelay = a.health?.delayMs ?? null;
      const bDelay = b.health?.delayMs ?? null;
      if (aDelay != null && bDelay != null) return aDelay - bDelay;
      if (aDelay != null && bDelay == null) return -1;
      if (aDelay == null && bDelay != null) return 1;

      // 3. priority 数值越小越靠前。
      if (a.candidate.priority !== b.candidate.priority) {
        return a.candidate.priority - b.candidate.priority;
      }
      return a.candidate.weight - b.candidate.weight;
    });

    events.push({
      step: 'candidates_sort',
      status: 'info',
      details: {
        order: sorted.map((s) => ({
          upstreamKeyId: s.candidate.upstreamKey.id,
          degraded: s.health?.degraded ?? false,
          delayMs: s.health?.delayMs ?? null,
        })),
      },
    });

    return sorted.map((s) => s.candidate);
  }
}
