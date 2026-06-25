import { describe, it, expect } from 'vitest';
import { RoutingDecisionService } from '../../src/domain/gateway/routing-decision.service.js';
import type { RoutingDecisionInput } from '../../src/domain/gateway/routing.types.js';
import type { PublicModelRepository } from '../../src/infrastructure/db/repositories/public-model.repository.js';
import type { ModelGroupRepository } from '../../src/infrastructure/db/repositories/model-group.repository.js';
import type { UpstreamKeyRepository } from '../../src/infrastructure/db/repositories/upstream-key.repository.js';
import type { RoutingStateRepository } from '../../src/infrastructure/db/repositories/routing-state.repository.js';
import type {
  UpstreamKeyRow,
  PublicModelCandidateRow,
  ModelGroupMemberRow,
  AdminSettingsRow,
} from '../../src/infrastructure/db/schema.js';

const defaultSettings: AdminSettingsRow = {
  id: 'settings',
  circuitBreakerEnabled: true,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerBaseCooldownMs: 60000,
  circuitBreakerMaxCooldownMs: 600000,
  circuitBreakerHalfOpenSuccessCount: 2,
  endpointHealthProbeEnabled: true,
  endpointHealthProbeIntervalMs: 3600000,
  endpointHealthProbeTimeoutMs: 10000,
  endpointHealthProbeDegradedLatencyMs: 5000,
  firstTokenTimeoutMs: 15000,
  contentLogEnabled: false,
  contentLogRetentionDays: 7,
  contentLogMaxPayloadBytes: 100000,
  publicEndpointsBasePath: '/v1',
  publicBaseUrl: 'http://localhost',
  gatewayBasePath: '/v1',
  defaultRequestTimeoutMs: 30000,
  defaultRetries: 0,
  enableStickySession: true,
  enableCircuitBreaker: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeUpstreamKey(id: string, overrides: Partial<UpstreamKeyRow> = {}): UpstreamKeyRow {
  const now = new Date();
  return {
    id,
    name: id,
    providerPresetId: null,
    providerType: 'openai_compatible',
    baseUrl: 'https://example.com',
    authType: 'pat',
    apiKeyCiphertext: 'cipher',
    apiKeyPrefix: 'sk',
    authConfigCiphertext: null,
    defaultHeadersJson: null,
    extraHeadersJson: null,
    extraParamsJson: null,
    supportedModelsJson: [],
    endpointsJson: null,
    displayOrder: 1000,
    enabled: true,
    frozen: false,
    frozenReason: null,
    cooldownUntil: null,
    lastHealthStatus: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastUsedAt: null,
    stickySessionTtlMs: 300000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCandidate(overrides: Partial<PublicModelCandidateRow> = {}): PublicModelCandidateRow {
  const now = new Date();
  return {
    id: 'pmc',
    publicModelId: 'pm',
    upstreamKeyId: 'uk1',
    realModelName: 'real-model',
    enabled: true,
    priority: 100,
    weight: 1,
    pingLatencyMs: null,
    pingStatus: null,
    endpointUrl: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeInput(partial: Partial<RoutingDecisionInput> = {}): RoutingDecisionInput {
  return {
    ir: {
      sourceProtocol: 'openai',
      requestedModel: 'gpt-4o',
      system: null,
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: null,
      temperature: null,
      topP: null,
      stream: false,
      metadata: {},
      rawRequest: { model: 'gpt-4o', messages: [{ role: 'user', content: 'Hello' }] },
    },
    resolvedTarget: { type: 'public_model', id: 'pm', name: 'gpt-4o', entity: undefined as never },
    consumerKeyId: 'ck',
    appId: 'app',
    settings: defaultSettings,
    now: new Date(),
    ...partial,
  };
}

function createService(mocks: {
  candidates?: PublicModelCandidateRow[];
  upstreamKeys?: UpstreamKeyRow[];
  members?: ModelGroupMemberRow[];
  group?: { id: string; routingPolicy: string };
  quotas?: Record<string, { requestLimit: number | null; requestCount: number }>;
  breakers?: Record<
    string,
    { state: 'closed' | 'open' | 'half_open'; cooldownUntil: Date | null; realModelName?: string }
  >;
  stickyBinding?: { upstreamKeyId: string; realModelName: string } | null;
  stickySession?: { upstreamKeyId: string; realModelName: string } | null;
}) {
  const upstreamMap = new Map(mocks.upstreamKeys?.map((u) => [u.id, u]) ?? []);

  const publicModelRepo = {
    listCandidates: async (publicModelId: string) =>
      mocks.candidates?.filter((c) => c.publicModelId === publicModelId) ?? [],
    findById: async () =>
      ({
        id: 'pm',
        name: 'gpt-4o',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as ReturnType<PublicModelRepository['findById']>,
  } as unknown as PublicModelRepository;

  const modelGroupRepo = {
    listMembers: async () => mocks.members ?? [],
    findById: async () =>
      mocks.group
        ? ({ id: mocks.group.id, routingPolicy: mocks.group.routingPolicy } as ReturnType<
            ModelGroupRepository['findById']
          >)
        : undefined,
  } as unknown as ModelGroupRepository;

  const upstreamKeyRepo = {
    findById: async (id: string) => upstreamMap.get(id),
    findQuotaByUpstreamKey: async (upstreamKeyId: string) => {
      const q = mocks.quotas?.[upstreamKeyId];
      return q
        ? ({ requestLimit: q.requestLimit, enabled: true } as ReturnType<
            UpstreamKeyRepository['findQuotaByUpstreamKey']
          >)
        : undefined;
    },
    findCounter: async (upstreamKeyId: string, period: string, periodStartedAt: Date) => {
      const q = mocks.quotas?.[upstreamKeyId];
      if (!q || q.requestLimit == null) return undefined;
      return {
        requestCount: q.requestCount,
        periodEndsAt: new Date(periodStartedAt.getTime() + 60 * 60 * 1000),
      } as ReturnType<UpstreamKeyRepository['findCounter']>;
    },
  } as unknown as UpstreamKeyRepository;

  const routingStateRepo = {
    findBreaker: async (upstreamKeyId: string, realModelName: string) => {
      const b = mocks.breakers?.[upstreamKeyId];
      if (!b) return undefined;
      if (b.realModelName && b.realModelName !== realModelName) return undefined;
      return { state: b.state, cooldownUntil: b.cooldownUntil } as ReturnType<
        RoutingStateRepository['findBreaker']
      >;
    },
    findStickyBinding: async () =>
      mocks.stickyBinding
        ? ({ ...mocks.stickyBinding } as ReturnType<RoutingStateRepository['findStickyBinding']>)
        : undefined,
    findStickySession: async () =>
      mocks.stickySession
        ? ({ ...mocks.stickySession } as ReturnType<RoutingStateRepository['findStickySession']>)
        : undefined,
    listEndpointHealthByUpstream: async () => [],
  } as unknown as RoutingStateRepository;

  return new RoutingDecisionService(
    publicModelRepo,
    modelGroupRepo,
    upstreamKeyRepo,
    routingStateRepo,
  );
}

describe('RoutingDecisionService', () => {
  it('expands public model candidates and sorts by priority', async () => {
    const service = createService({
      upstreamKeys: [makeUpstreamKey('uk1'), makeUpstreamKey('uk2')],
      candidates: [
        makeCandidate({ id: 'c2', upstreamKeyId: 'uk2', priority: 200 }),
        makeCandidate({ id: 'c1', upstreamKeyId: 'uk1', priority: 50 }),
      ],
    });

    const decision = await service.decide(makeInput());
    expect(decision.candidates.map((c) => c.upstreamKey.id)).toEqual(['uk1', 'uk2']);
  });

  it('drops disabled upstream keys', async () => {
    const service = createService({
      upstreamKeys: [makeUpstreamKey('uk1', { enabled: false }), makeUpstreamKey('uk2')],
      candidates: [
        makeCandidate({ upstreamKeyId: 'uk1' }),
        makeCandidate({ upstreamKeyId: 'uk2' }),
      ],
    });

    const decision = await service.decide(makeInput());
    expect(decision.candidates.map((c) => c.upstreamKey.id)).toEqual(['uk2']);
    expect(decision.traceEvents.some((e) => e.step === 'filter_disabled')).toBe(true);
  });

  it('drops frozen upstream keys', async () => {
    const service = createService({
      upstreamKeys: [makeUpstreamKey('uk1', { frozen: true }), makeUpstreamKey('uk2')],
      candidates: [
        makeCandidate({ upstreamKeyId: 'uk1' }),
        makeCandidate({ upstreamKeyId: 'uk2' }),
      ],
    });

    const decision = await service.decide(makeInput());
    expect(decision.candidates.map((c) => c.upstreamKey.id)).toEqual(['uk2']);
  });

  it('drops upstream keys in cooldown', async () => {
    const service = createService({
      upstreamKeys: [
        makeUpstreamKey('uk1', { cooldownUntil: new Date(Date.now() + 60000) }),
        makeUpstreamKey('uk2'),
      ],
      candidates: [
        makeCandidate({ upstreamKeyId: 'uk1' }),
        makeCandidate({ upstreamKeyId: 'uk2' }),
      ],
    });

    const decision = await service.decide(makeInput());
    expect(decision.candidates.map((c) => c.upstreamKey.id)).toEqual(['uk2']);
  });

  it('drops open circuit breakers still in cooldown', async () => {
    const service = createService({
      upstreamKeys: [makeUpstreamKey('uk1'), makeUpstreamKey('uk2')],
      candidates: [
        makeCandidate({ upstreamKeyId: 'uk1' }),
        makeCandidate({ upstreamKeyId: 'uk2' }),
      ],
      breakers: { uk1: { state: 'open', cooldownUntil: new Date(Date.now() + 60000) } },
    });

    const decision = await service.decide(makeInput());
    expect(decision.candidates.map((c) => c.upstreamKey.id)).toEqual(['uk2']);
  });

  it('allows open circuit breakers whose cooldown has passed', async () => {
    const service = createService({
      upstreamKeys: [makeUpstreamKey('uk1')],
      candidates: [makeCandidate({ upstreamKeyId: 'uk1' })],
      breakers: { uk1: { state: 'open', cooldownUntil: new Date(Date.now() - 1000) } },
    });

    const decision = await service.decide(makeInput());
    expect(decision.candidates).toHaveLength(1);
    expect(decision.traceEvents.some((e) => e.step === 'filter_breaker_half_open')).toBe(true);
  });

  it('drops candidates that do not support the requested protocol', async () => {
    const service = createService({
      upstreamKeys: [
        makeUpstreamKey('uk1', { providerType: 'anthropic_compatible' }),
        makeUpstreamKey('uk2'),
      ],
      candidates: [
        makeCandidate({ upstreamKeyId: 'uk1' }),
        makeCandidate({ upstreamKeyId: 'uk2' }),
      ],
    });

    const decision = await service.decide(makeInput());
    expect(decision.candidates.map((c) => c.upstreamKey.id)).toEqual(['uk2']);
  });

  it('drops candidates that lack required capabilities', async () => {
    const service = createService({
      upstreamKeys: [makeUpstreamKey('uk1', { providerType: 'deepseek' }), makeUpstreamKey('uk2')],
      candidates: [
        makeCandidate({ upstreamKeyId: 'uk1' }),
        makeCandidate({ upstreamKeyId: 'uk2' }),
      ],
    });

    const input = makeInput({
      ir: {
        sourceProtocol: 'openai',
        requestedModel: 'gpt-4o',
        system: null,
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: null,
        temperature: null,
        topP: null,
        stream: false,
        metadata: {},
        rawRequest: {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'x' } }] }],
        },
      },
    });

    const decision = await service.decide(input);
    expect(decision.candidates.map((c) => c.upstreamKey.id)).toEqual(['uk2']);
  });

  it('drops candidates whose quota is exhausted', async () => {
    const service = createService({
      upstreamKeys: [makeUpstreamKey('uk1'), makeUpstreamKey('uk2')],
      candidates: [
        makeCandidate({ upstreamKeyId: 'uk1' }),
        makeCandidate({ upstreamKeyId: 'uk2' }),
      ],
      quotas: { uk1: { requestLimit: 10, requestCount: 10 } },
    });

    const decision = await service.decide(makeInput());
    expect(decision.candidates.map((c) => c.upstreamKey.id)).toEqual(['uk2']);
  });

  it('moves sticky binding candidate to front', async () => {
    const service = createService({
      upstreamKeys: [makeUpstreamKey('uk1'), makeUpstreamKey('uk2')],
      candidates: [
        makeCandidate({ upstreamKeyId: 'uk1', realModelName: 'a' }),
        makeCandidate({ upstreamKeyId: 'uk2', realModelName: 'b' }),
      ],
      stickyBinding: { upstreamKeyId: 'uk2', realModelName: 'b' },
    });

    const decision = await service.decide(makeInput());
    expect(decision.candidates[0]?.upstreamKey.id).toBe('uk2');
    expect(decision.stickyHit).toBe(true);
  });

  it('expands model group members by priority', async () => {
    const service = createService({
      upstreamKeys: [makeUpstreamKey('uk1'), makeUpstreamKey('uk2')],
      members: [
        {
          id: 'm2',
          modelGroupId: 'mg',
          publicModelId: 'pm2',
          enabled: true,
          priority: 200,
          weight: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as ModelGroupMemberRow,
        {
          id: 'm1',
          modelGroupId: 'mg',
          publicModelId: 'pm1',
          enabled: true,
          priority: 50,
          weight: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as ModelGroupMemberRow,
      ],
      group: { id: 'mg', routingPolicy: 'priority' },
      candidates: [
        makeCandidate({
          id: 'c2',
          upstreamKeyId: 'uk2',
          publicModelId: 'pm2',
          realModelName: 'real-2',
        }),
        makeCandidate({
          id: 'c1',
          upstreamKeyId: 'uk1',
          publicModelId: 'pm1',
          realModelName: 'real-1',
        }),
      ],
    });

    const input = makeInput({
      resolvedTarget: { type: 'model_group', id: 'mg', name: 'fast', entity: undefined as never },
    });

    const decision = await service.decide(input);
    expect(decision.resolvedTargetType).toBe('model_group');
    expect(decision.candidates.map((c) => c.realModelName)).toEqual(['real-1', 'real-2']);
  });
});
