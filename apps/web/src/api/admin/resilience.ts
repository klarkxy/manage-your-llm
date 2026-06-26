import { api } from '../client.js';
import type {
  CircuitBreakerContract,
  StickyBindingContract,
  StickySessionContract,
} from '@manageyourllm/contracts';

export async function listBreakers(): Promise<CircuitBreakerContract[]> {
  const res = await api.get<{ data: CircuitBreakerContract[] }>('/api/admin/resilience/breakers');
  return res.data;
}

export async function resetBreaker(
  upstreamKeyId: string,
  realModelName: string,
): Promise<CircuitBreakerContract> {
  const encoded = encodeURIComponent(realModelName);
  const res = await api.post<{ data: CircuitBreakerContract }>(
    `/api/admin/resilience/breakers/${upstreamKeyId}/${encoded}/reset`,
    {},
  );
  return res.data;
}

export interface StickyOverview {
  bindings: StickyBindingContract[];
  sessions: StickySessionContract[];
}

export async function getStickyOverview(query?: {
  consumerKeyId?: string;
  requestedTargetName?: string;
}): Promise<StickyOverview> {
  const params = new URLSearchParams();
  if (query?.consumerKeyId) params.set('consumerKeyId', query.consumerKeyId);
  if (query?.requestedTargetName) params.set('requestedTargetName', query.requestedTargetName);
  const qs = params.toString();
  const res = await api.get<{ data: StickyOverview }>(`/api/admin/resilience/sticky${qs ? `?${qs}` : ''}`);
  return res.data;
}
