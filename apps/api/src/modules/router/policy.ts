import type { ResolvedCandidate } from "./candidates.js";

// M4 routing policy: priority-only. Candidates are sorted ascending by
// `priority`; ties are broken by upstreamKeyId then realModelName for a
// deterministic order across requests. Weight is recorded on the candidate for
// future use but is not consulted yet (M6+ will introduce weighted-random
// selection).
export function selectCandidateByPriority(
  candidates: ResolvedCandidate[],
): ResolvedCandidate {
  if (candidates.length === 0) {
    throw new Error("selectCandidateByPriority: empty candidate list");
  }
  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.upstreamKeyId !== b.upstreamKeyId) {
      return a.upstreamKeyId < b.upstreamKeyId ? -1 : 1;
    }
    if (a.realModelName !== b.realModelName) {
      return a.realModelName < b.realModelName ? -1 : 1;
    }
    return 0;
  });
  return sorted[0]!;
}
