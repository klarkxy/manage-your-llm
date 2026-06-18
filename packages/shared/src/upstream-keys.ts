export const UPSTREAM_KEY_PLAN_TYPES = ['coding-plan', 'token-plan'] as const;
export type UpstreamKeyPlanType = (typeof UPSTREAM_KEY_PLAN_TYPES)[number];
