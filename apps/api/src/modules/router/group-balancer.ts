// M7.4: model group load balancing.
//
// When the requested target is a model group, the gateway calls this module
// after candidate filtering / health sorting and before sticky checks. The
// balancer reorders the still-usable candidates according to the group's
// routing policy. Sticky bindings still win: if a sticky hit moves a candidate
// to the front, that candidate is used regardless of the balancer's choice.

import { eq, sql } from 'drizzle-orm';
import { type Db, type TargetType, modelGroups } from '../db/index.js';
import type { ResolvedCandidate } from './candidates.js';

export interface GroupBalanceTarget {
  targetType: TargetType;
  targetId: string;
}

export interface GroupBalanceResult {
  candidates: ResolvedCandidate[];
  mode?: GroupBalanceMode;
}

export const GROUP_BALANCE_MODES = [
  'priority',
  'failover',
  'round_robin',
  'random',
  'weighted',
] as const;

export type GroupBalanceMode = (typeof GROUP_BALANCE_MODES)[number];

export function isGroupBalanceMode(value: unknown): value is GroupBalanceMode {
  return typeof value === 'string' && (GROUP_BALANCE_MODES as readonly string[]).includes(value);
}

export interface BalanceGroupInput {
  modelGroupId: string;
  mode: GroupBalanceMode;
  candidates: ResolvedCandidate[];
  now: Date;
}

// Map the legacy 'priority' name to the same behavior as 'failover' so old
// groups keep working while new groups can explicitly choose 'failover'.
const EFFECTIVE_MODE = {
  priority: 'failover',
  failover: 'failover',
  round_robin: 'round_robin',
  random: 'random',
  weighted: 'weighted',
} as const satisfies Record<GroupBalanceMode, GroupBalanceMode>;

export async function maybeBalanceGroupCandidates(
  db: Db,
  target: GroupBalanceTarget,
  candidates: ResolvedCandidate[],
  now: Date,
): Promise<GroupBalanceResult> {
  if (target.targetType !== 'model_group' || candidates.length === 0) {
    return { candidates };
  }
  const group = await db
    .select({ id: modelGroups.id, routingPolicy: modelGroups.routingPolicy })
    .from(modelGroups)
    .where(eq(modelGroups.id, target.targetId))
    .get();
  const mode = group && isGroupBalanceMode(group.routingPolicy) ? group.routingPolicy : 'priority';
  const balanced = await balanceGroupCandidates(db, {
    modelGroupId: target.targetId,
    mode,
    candidates,
    now,
  });
  return { candidates: balanced, mode };
}

export async function balanceGroupCandidates(
  db: Db,
  input: BalanceGroupInput,
): Promise<ResolvedCandidate[]> {
  if (input.candidates.length === 0) return [];
  const mode = EFFECTIVE_MODE[input.mode] ?? 'failover';

  switch (mode) {
    case 'failover':
      return orderByFailover(input.candidates);
    case 'round_robin':
      return await orderByRoundRobin(db, input.modelGroupId, input.candidates);
    case 'random':
      return shuffleRandom(input.candidates);
    case 'weighted':
      return orderByWeighted(input.candidates);
    default:
      return orderByFailover(input.candidates);
  }
}

function orderByFailover(candidates: ResolvedCandidate[]): ResolvedCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.upstreamKeyId !== b.upstreamKeyId) {
      return a.upstreamKeyId < b.upstreamKeyId ? -1 : 1;
    }
    if (a.realModelName !== b.realModelName) {
      return a.realModelName < b.realModelName ? -1 : 1;
    }
    return 0;
  });
}

async function orderByRoundRobin(
  db: Db,
  modelGroupId: string,
  candidates: ResolvedCandidate[],
): Promise<ResolvedCandidate[]> {
  // Atomically increment the group's round-robin counter and read the new
  // value. The start index is derived from the pre-increment value so the
  // very first call starts at index 0.
  const row = await db
    .update(modelGroups)
    .set({ roundRobinCounter: sql`${modelGroups.roundRobinCounter} + 1` })
    .where(eq(modelGroups.id, modelGroupId))
    .returning({ counter: modelGroups.roundRobinCounter })
    .get();
  const counter = row?.counter ?? 0;
  const start = candidates.length > 0 ? (counter - 1 + candidates.length) % candidates.length : 0;
  const rotated = [...candidates.slice(start), ...candidates.slice(0, start)];
  return rotated;
}

function shuffleRandom(candidates: ResolvedCandidate[]): ResolvedCandidate[] {
  const copy = [...candidates];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

function orderByWeighted(candidates: ResolvedCandidate[]): ResolvedCandidate[] {
  const weights = candidates.map((c) => Math.max(0, c.memberWeight ?? c.weight ?? 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return orderByFailover(candidates);
  }

  const rand = Math.random() * total;
  let cumulative = 0;
  let selectedIdx = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    cumulative += weights[i]!;
    if (cumulative >= rand) {
      selectedIdx = i;
      break;
    }
  }

  const selected = candidates[selectedIdx]!;
  const rest = candidates.filter((_, i) => i !== selectedIdx);
  // The remaining candidates are kept in failover order for quick fallback.
  return [selected, ...orderByFailover(rest)];
}
