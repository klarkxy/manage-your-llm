import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { generateId, ValidationError } from '@modelharbor/shared';
import type { Db } from '../db/index.js';
import {
  MODEL_REFERENCE_REGIONS,
  MODEL_REFERENCE_SOURCES,
  type ModelReferenceRegion,
  type ModelReferenceSource,
  type ModelReferenceEntryInsert,
  type ModelReferenceEntryRow,
  modelReferenceEntries,
  modelReferenceSyncStatus,
  modelGroupMembers,
  publicModelCandidates,
  publicModels,
} from '../db/schema.js';

export const DEFAULT_REFERENCE_TTL_MS = 24 * 60 * 60 * 1000;
export const AUTO_GROUP_PRESETS = ['balanced', 'chat', 'code', 'plan', 'cheap'] as const;
export type AutoGroupPreset = (typeof AUTO_GROUP_PRESETS)[number];

export interface AutoGroupWeights {
  intelligence?: number;
  coding?: number;
  agentic?: number;
  reasoning?: number;
  math?: number;
  creative?: number;
  instruction?: number;
  price?: number;
  context?: number;
}

export interface AutoGroupRecommendation {
  publicModelId: string;
  publicModelName: string;
  displayName: string | null;
  score: number;
  reference: {
    source: ModelReferenceSource;
    displayName: string;
    provider: string | null;
    scores: Record<string, number>;
    price: Record<string, unknown>;
    contextWindow: number | null;
    outputSpeed: number | null;
    latencyMs: number | null;
    sourceUrl: string;
    fetchedAt: Date;
  };
}

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

const DOMESTIC_OPENROUTER_PROVIDERS = [
  'deepseek',
  'qwen',
  'alibaba',
  'moonshot',
  'kimi',
  'z-ai',
  'zhipu',
  'glm',
  'minimax',
  'baichuan',
  'yi',
] as const;

const PRESET_WEIGHTS: Record<AutoGroupPreset, Required<AutoGroupWeights>> = {
  balanced: {
    intelligence: 0.28,
    reasoning: 0.16,
    coding: 0.18,
    agentic: 0.14,
    math: 0.06,
    creative: 0.04,
    instruction: 0.04,
    price: 0.08,
    context: 0.02,
  },
  chat: {
    intelligence: 0.36,
    reasoning: 0.12,
    coding: 0.04,
    agentic: 0.12,
    math: 0.04,
    creative: 0.12,
    instruction: 0.12,
    price: 0.06,
    context: 0.02,
  },
  code: {
    intelligence: 0.12,
    reasoning: 0.14,
    coding: 0.52,
    agentic: 0.12,
    math: 0.04,
    creative: 0,
    instruction: 0.02,
    price: 0.03,
    context: 0.01,
  },
  plan: {
    intelligence: 0.18,
    reasoning: 0.28,
    coding: 0.08,
    agentic: 0.3,
    math: 0.04,
    creative: 0.04,
    instruction: 0.04,
    price: 0.02,
    context: 0.02,
  },
  cheap: {
    intelligence: 0.12,
    reasoning: 0.06,
    coding: 0.06,
    agentic: 0.04,
    math: 0.02,
    creative: 0,
    instruction: 0.02,
    price: 0.66,
    context: 0.02,
  },
};

export const AUTO_GROUP_WEIGHT_KEYS = Object.keys(PRESET_WEIGHTS.balanced) as Array<
  keyof Required<AutoGroupWeights>
>;

export function isReferenceRegion(value: unknown): value is ModelReferenceRegion {
  return typeof value === 'string' && (MODEL_REFERENCE_REGIONS as readonly string[]).includes(value);
}

export function isReferenceSource(value: unknown): value is ModelReferenceSource {
  return typeof value === 'string' && (MODEL_REFERENCE_SOURCES as readonly string[]).includes(value);
}

export function isAutoGroupPreset(value: unknown): value is AutoGroupPreset {
  return typeof value === 'string' && (AUTO_GROUP_PRESETS as readonly string[]).includes(value);
}

export function normalizeModelName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[:~]+/, '')
    .replace(/^(openai|anthropic|google|meta|deepseek|qwen|moonshotai|z-ai|minimax)\//, '')
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseJsonRecord(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function numericScores(row: ModelReferenceEntryRow): Record<string, number> {
  const raw = parseJsonRecord(row.scoresJson);
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function priceForScore(row: ModelReferenceEntryRow): number | null {
  const price = parseJsonRecord(row.priceJson);
  const blended = price.blendedUsdPerMTok ?? price.blendedCnyPerMTok;
  if (typeof blended === 'number' && Number.isFinite(blended) && blended >= 0) return blended;
  const input = price.inputUsdPerMTok ?? price.inputCnyPerMTok;
  const output = price.outputUsdPerMTok ?? price.outputCnyPerMTok;
  if (typeof input === 'number' && typeof output === 'number') return (input + output) / 2;
  if (typeof input === 'number') return input;
  if (typeof output === 'number') return output;
  return null;
}

function scoreMetric(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function normalizePositive(value: number | null, max: number): number {
  if (value === null || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function normalizePrice(value: number | null, max: number): number {
  if (value === null || max <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - value / max) * 100));
}

function coerceWeights(preset: AutoGroupPreset, weights: unknown): Required<AutoGroupWeights> {
  const base = PRESET_WEIGHTS[preset];
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) return base;
  const raw = weights as Record<string, unknown>;
  const hasExplicitWeight = AUTO_GROUP_WEIGHT_KEYS.some((key) => typeof raw[key] === 'number');
  const next = hasExplicitWeight
    ? {
        intelligence: 0,
        reasoning: 0,
        coding: 0,
        agentic: 0,
        math: 0,
        creative: 0,
        instruction: 0,
        price: 0,
        context: 0,
      }
    : { ...base };
  for (const key of AUTO_GROUP_WEIGHT_KEYS) {
    if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) {
      next[key] = Math.max(0, raw[key]);
    }
  }
  const total = Object.values(next).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return base;
  for (const key of AUTO_GROUP_WEIGHT_KEYS) {
    next[key] = next[key] / total;
  }
  return next;
}

export function normalizeAutoWeights(preset: AutoGroupPreset, weights: unknown): Required<AutoGroupWeights> {
  return coerceWeights(preset, weights);
}

function presentEntry(row: ModelReferenceEntryRow) {
  return {
    id: row.id,
    region: row.region,
    source: row.source,
    normalizedModelName: row.normalizedModelName,
    sourceModelId: row.sourceModelId,
    displayName: row.displayName,
    provider: row.provider,
    scores: parseJsonRecord(row.scoresJson),
    price: parseJsonRecord(row.priceJson),
    contextWindow: row.contextWindow,
    outputSpeed: row.outputSpeed,
    latencyMs: row.latencyMs,
    sourceUrl: row.sourceUrl,
    rawUnit: row.rawUnit,
    fetchedAt: row.fetchedAt,
    updatedAt: row.updatedAt,
  };
}

async function ensureSyncStatus(db: Db, region: ModelReferenceRegion, source: ModelReferenceSource) {
  const existing = await db
    .select()
    .from(modelReferenceSyncStatus)
    .where(and(eq(modelReferenceSyncStatus.region, region), eq(modelReferenceSyncStatus.source, source)))
    .get();
  if (existing) return existing;
  const now = new Date();
  const row = {
    id: generateId('modelReference'),
    region,
    source,
    status: 'idle' as const,
    lastRefreshAt: null,
    nextRefreshAfter: null,
    lastError: null,
    ttlMs: DEFAULT_REFERENCE_TTL_MS,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(modelReferenceSyncStatus).values(row).onConflictDoNothing({
    target: [modelReferenceSyncStatus.region, modelReferenceSyncStatus.source],
  });
  return (
    (await db
      .select()
      .from(modelReferenceSyncStatus)
      .where(and(eq(modelReferenceSyncStatus.region, region), eq(modelReferenceSyncStatus.source, source)))
      .get()) ?? row
  );
}

function sourceForRegion(_region: ModelReferenceRegion): ModelReferenceSource {
  return 'openrouter';
}

function normalizeScoreKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_(index|score|rank|percentile)$/g, '')
    .replace(/^_|_$/g, '');
}

function collectOpenRouterScores(artificial: Record<string, unknown>): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [key, value] of Object.entries(artificial)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const normalized = normalizeScoreKey(key);
    if (!normalized) continue;
    scores[normalized] = value;
  }
  const aliasPairs: Array<[string, string[]]> = [
    ['intelligence', ['intelligence', 'intelligence_index']],
    ['coding', ['coding', 'coding_index', 'code']],
    ['agentic', ['agentic', 'agentic_index', 'agent']],
    ['reasoning', ['reasoning', 'reasoning_index', 'analysis']],
    ['math', ['math', 'math_index', 'mathematics']],
    ['creative', ['creative', 'creativity', 'writing']],
    ['instruction', ['instruction', 'instruction_following', 'if']],
  ];
  for (const [target, candidates] of aliasPairs) {
    if (typeof scores[target] === 'number') continue;
    const found = candidates.map(normalizeScoreKey).find((candidate) => typeof scores[candidate] === 'number');
    if (found) scores[target] = scores[found]!;
  }
  if (typeof scores.reasoning !== 'number' && typeof scores.intelligence === 'number') {
    scores.reasoning = scores.intelligence;
  }
  return scores;
}

function isDomesticOpenRouterModel(id: string, name: string): boolean {
  const haystack = `${id} ${name}`.toLowerCase();
  return DOMESTIC_OPENROUTER_PROVIDERS.some((provider) => haystack.includes(provider));
}

function mapOpenRouterModel(
  raw: unknown,
  now: Date,
  region: ModelReferenceRegion,
): ModelReferenceEntryInsert | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id : null;
  const name = typeof item.name === 'string' ? item.name : id;
  if (!id || !name) return null;
  if (region === 'domestic' && !isDomesticOpenRouterModel(id, name)) return null;
  const normalized = normalizeModelName(id);
  if (!normalized) return null;
  const benchmarks =
    item.benchmarks && typeof item.benchmarks === 'object'
      ? (item.benchmarks as Record<string, unknown>)
      : {};
  const artificial =
    benchmarks.artificial_analysis && typeof benchmarks.artificial_analysis === 'object'
      ? (benchmarks.artificial_analysis as Record<string, unknown>)
      : {};
  const scores = collectOpenRouterScores(artificial);
  const pricing =
    item.pricing && typeof item.pricing === 'object' ? (item.pricing as Record<string, unknown>) : {};
  const prompt = Number(pricing.prompt);
  const completion = Number(pricing.completion);
  const price: Record<string, number | string | boolean> = {};
  if (Number.isFinite(prompt) && prompt >= 0) price.inputUsdPerMTok = prompt * 1_000_000;
  if (Number.isFinite(completion) && completion >= 0) price.outputUsdPerMTok = completion * 1_000_000;
  if (typeof price.inputUsdPerMTok === 'number' && typeof price.outputUsdPerMTok === 'number') {
    price.blendedUsdPerMTok = (price.inputUsdPerMTok + price.outputUsdPerMTok) / 2;
  }
  price.source = 'openrouter';
  const contextLength = typeof item.context_length === 'number' ? item.context_length : null;
  return {
    id: `mr_${generateId('modelReference').slice(-18)}`,
    region,
    source: 'openrouter',
    normalizedModelName: normalized,
    sourceModelId: id,
    displayName: name,
    provider: typeof name === 'string' && name.includes(':') ? name.split(':')[0]!.trim() : null,
    scoresJson: JSON.stringify(scores),
    priceJson: JSON.stringify(price),
    contextWindow: contextLength,
    outputSpeed: null,
    latencyMs: null,
    sourceUrl: `https://openrouter.ai/models/${id}`,
    rawUnit: 'USD per 1M tokens',
    rawPayloadJson: JSON.stringify(item).slice(0, 20000),
    fetchedAt: now,
    updatedAt: now,
  };
}

async function fetchOpenRouterEntries(
  now: Date,
  region: ModelReferenceRegion,
): Promise<ModelReferenceEntryInsert[]> {
  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: { accept: 'application/json', 'user-agent': 'ModelHarbor/0.1 model-reference-refresh' },
  });
  if (!res.ok) throw new Error(`OpenRouter refresh failed: HTTP ${res.status}`);
  const payload = (await res.json()) as unknown;
  const data =
    payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data)
      : [];
  return data
    .map((item) => mapOpenRouterModel(item, now, region))
    .filter((item): item is ModelReferenceEntryInsert => !!item);
}

async function replaceReferenceEntries(
  db: Db,
  region: ModelReferenceRegion,
  source: ModelReferenceSource,
  entries: ModelReferenceEntryInsert[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(modelReferenceEntries)
      .where(and(eq(modelReferenceEntries.region, region), eq(modelReferenceEntries.source, source)));
    if (entries.length > 0) {
      await tx.insert(modelReferenceEntries).values(entries);
    }
  });
}

export async function refreshModelReference(
  db: Db,
  input: { region: ModelReferenceRegion; force?: boolean },
) {
  const source = sourceForRegion(input.region);
  const current = await ensureSyncStatus(db, input.region, source);
  const now = new Date();
  if (!input.force && current.nextRefreshAfter && current.nextRefreshAfter > now) {
    const items = await listReferenceEntries(db, { region: input.region });
    return { refreshed: false, source, items };
  }
  await db
    .update(modelReferenceSyncStatus)
    .set({ status: 'refreshing', updatedAt: now, lastError: null })
    .where(and(eq(modelReferenceSyncStatus.region, input.region), eq(modelReferenceSyncStatus.source, source)));
  try {
    const entries = await fetchOpenRouterEntries(now, input.region);
    await replaceReferenceEntries(db, input.region, source, entries);
    await db
      .update(modelReferenceSyncStatus)
      .set({
        status: 'success',
        lastRefreshAt: now,
        nextRefreshAfter: new Date(now.getTime() + current.ttlMs),
        lastError: null,
        updatedAt: now,
      })
      .where(and(eq(modelReferenceSyncStatus.region, input.region), eq(modelReferenceSyncStatus.source, source)));
    const items = await listReferenceEntries(db, { region: input.region });
    return { refreshed: true, source, items };
  } catch (err) {
    await db
      .update(modelReferenceSyncStatus)
      .set({
        status: 'error',
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(and(eq(modelReferenceSyncStatus.region, input.region), eq(modelReferenceSyncStatus.source, source)));
    throw err;
  }
}

export async function listReferenceEntries(
  db: Db,
  input: { region: ModelReferenceRegion; source?: ModelReferenceSource },
) {
  const where = input.source
    ? and(eq(modelReferenceEntries.region, input.region), eq(modelReferenceEntries.source, input.source))
    : eq(modelReferenceEntries.region, input.region);
  const rows = await db.select().from(modelReferenceEntries).where(where).orderBy(desc(modelReferenceEntries.fetchedAt)).all();
  const statuses = await db
    .select()
    .from(modelReferenceSyncStatus)
    .where(eq(modelReferenceSyncStatus.region, input.region))
    .all();
  return {
    items: rows.map(presentEntry),
    sync: statuses.map((s) => ({
      region: s.region,
      source: s.source,
      status: s.status,
      lastRefreshAt: s.lastRefreshAt,
      nextRefreshAfter: s.nextRefreshAfter,
      lastError: s.lastError,
      ttlMs: s.ttlMs,
      updatedAt: s.updatedAt,
    })),
  };
}

async function publicModelMatchMap(db: Db) {
  const pms = await db.select().from(publicModels).where(eq(publicModels.enabled, true)).all();
  const candidates = await db.select().from(publicModelCandidates).all();
  const names = new Map<string, typeof pms[number]>();
  const candidateByPublic = new Map<string, string[]>();
  for (const c of candidates) {
    const list = candidateByPublic.get(c.publicModelId) ?? [];
    list.push(c.realModelName);
    candidateByPublic.set(c.publicModelId, list);
  }
  for (const pm of pms) {
    for (const name of [pm.name, pm.displayName ?? '', ...(candidateByPublic.get(pm.id) ?? [])]) {
      const normalized = normalizeModelName(name);
      if (normalized && !names.has(normalized)) names.set(normalized, pm);
    }
  }
  return names;
}

export async function previewAutoGroupMembers(
  db: Db,
  input: {
    region: ModelReferenceRegion;
    preset: AutoGroupPreset;
    weights?: unknown;
    topN?: number;
  },
): Promise<AutoGroupRecommendation[]> {
  const topN = Math.max(1, Math.min(20, Math.round(input.topN ?? 5)));
  const weights = coerceWeights(input.preset, input.weights);
  const refs = await db.select().from(modelReferenceEntries).where(eq(modelReferenceEntries.region, input.region)).all();
  const publicByName = await publicModelMatchMap(db);
  const priceMax = Math.max(...refs.map(priceForScore).filter((v): v is number => v !== null), 0);
  const contextMax = Math.max(...refs.map((r) => r.contextWindow ?? 0), 0);
  const bestByPublic = new Map<string, AutoGroupRecommendation>();

  for (const ref of refs) {
    const pm = publicByName.get(ref.normalizedModelName);
    if (!pm) continue;
    const scores = numericScores(ref);
    const priceScore = normalizePrice(priceForScore(ref), priceMax);
    const contextScore = normalizePositive(ref.contextWindow, contextMax);
    const score =
      scoreMetric(scores.intelligence) * weights.intelligence +
      scoreMetric(scores.reasoning) * weights.reasoning +
      scoreMetric(scores.coding) * weights.coding +
      scoreMetric(scores.agentic) * weights.agentic +
      scoreMetric(scores.math) * weights.math +
      scoreMetric(scores.creative) * weights.creative +
      scoreMetric(scores.instruction) * weights.instruction +
      priceScore * weights.price +
      contextScore * weights.context;
    const recommendation: AutoGroupRecommendation = {
      publicModelId: pm.id,
      publicModelName: pm.name,
      displayName: pm.displayName,
      score: Math.round(score * 100) / 100,
      reference: {
        source: ref.source,
        displayName: ref.displayName,
        provider: ref.provider,
        scores,
        price: parseJsonRecord(ref.priceJson),
        contextWindow: ref.contextWindow,
        outputSpeed: ref.outputSpeed,
        latencyMs: ref.latencyMs,
        sourceUrl: ref.sourceUrl,
        fetchedAt: ref.fetchedAt,
      },
    };
    const existing = bestByPublic.get(pm.id);
    if (!existing || recommendation.score > existing.score) {
      bestByPublic.set(pm.id, recommendation);
    }
  }
  return [...bestByPublic.values()]
    .sort((a, b) => b.score - a.score || a.publicModelName.localeCompare(b.publicModelName))
    .slice(0, topN);
}

export async function applyAutoGroupSnapshot(
  db: Db,
  input: {
    modelGroupId: string;
    region: ModelReferenceRegion;
    preset: AutoGroupPreset;
    weights?: unknown;
    topN?: number;
  },
) {
  const recommendations = await previewAutoGroupMembers(db, input);
  if (recommendations.length === 0) {
    throw new ValidationError('no matching public models for auto group');
  }
  const now = new Date();
  const members = recommendations.map((item, idx) => ({
    id: generateId('modelGroup') + '_m',
    modelGroupId: input.modelGroupId,
    publicModelId: item.publicModelId,
    enabled: true,
    priority: (idx + 1) * 10,
    weight: Math.max(1, Math.round(item.score)),
    createdAt: now,
    updatedAt: now,
  }));
  await db.transaction(async (tx) => {
    await tx.delete(modelGroupMembers).where(eq(modelGroupMembers.modelGroupId, input.modelGroupId));
    await tx.insert(modelGroupMembers).values(members);
  });
  return { recommendations, members };
}

export function parseAutoWeightsJson(value: string | null): Required<AutoGroupWeights> | null {
  if (!value) return null;
  const parsed = parseJsonRecord(value);
  const preset = isAutoGroupPreset(parsed.preset) ? parsed.preset : 'balanced';
  return coerceWeights(preset, parsed);
}

export function registerModelReferenceRoutes(app: FastifyInstance, deps: { db: Db }): void {
  const { db } = deps;

  app.get('/api/admin/model-reference', async (req) => {
    const q = (req.query ?? {}) as { region?: string; source?: string };
    const region = isReferenceRegion(q.region) ? q.region : 'international';
    const source = isReferenceSource(q.source) ? q.source : undefined;
    return await listReferenceEntries(db, { region, source });
  });

  app.post('/api/admin/model-reference/refresh', async (req) => {
    const body = (req.body ?? {}) as { region?: unknown; force?: unknown };
    const region = isReferenceRegion(body.region) ? body.region : 'international';
    const refreshed = await refreshModelReference(db, {
      region,
      force: body.force === true,
    });
    return refreshed;
  });

  app.post('/api/admin/model-groups/auto-preview', async (req) => {
    const body = (req.body ?? {}) as {
      region?: unknown;
      preset?: unknown;
      weights?: unknown;
      topN?: unknown;
    };
    const region = isReferenceRegion(body.region) ? body.region : 'international';
    const preset = isAutoGroupPreset(body.preset) ? body.preset : 'balanced';
    const topN = typeof body.topN === 'number' ? body.topN : 5;
    const recommendations = await previewAutoGroupMembers(db, {
      region,
      preset,
      weights: body.weights,
      topN,
    });
    const ids = recommendations.map((item) => item.publicModelId);
    const publicRows =
      ids.length > 0
        ? await db.select().from(publicModels).where(inArray(publicModels.id, ids)).all()
        : [];
    return { items: recommendations, publicModels: publicRows };
  });
}
