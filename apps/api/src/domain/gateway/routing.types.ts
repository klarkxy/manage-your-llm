import type { ChatRequestIR } from '@manageyourllm/shared';
import type { UpstreamKeyRow } from '../../infrastructure/db/schema.js';

export interface RoutingCandidate {
  upstreamKey: UpstreamKeyRow;
  realModelName: string;
  endpointUrl: string;
  priority: number;
  weight: number;
  providerType: UpstreamKeyRow['providerType'];
  publicModelCandidateId?: string;
  modelGroupMemberId?: string;
}

export interface TraceEvent {
  step: string;
  status: 'ok' | 'drop' | 'fail' | 'info';
  details?: Record<string, unknown>;
}

export interface RoutingDecision {
  requestedModel: string;
  resolvedTargetType: 'public_model' | 'model_group';
  resolvedTargetId: string;
  resolvedTargetName: string;
  candidates: RoutingCandidate[];
  stickyHit: boolean;
  sessionStickyHit: boolean;
  conversationFingerprint: string;
  traceEvents: TraceEvent[];
}

export interface RoutingDecisionInput {
  ir: ChatRequestIR;
  resolvedTarget: import('./target-resolution.service.js').ResolvedTarget;
  consumerKeyId: string;
  appId: string;
  settings: import('../../infrastructure/db/schema.js').AdminSettingsRow;
  now: Date;
}
