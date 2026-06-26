import type {
  ChatRequestIR,
  NormalizedChatResponse,
  SourceProtocol,
} from '@manageyourllm/shared';
import type { NormalizedError } from '@manageyourllm/shared';
import type { UpstreamKeyRow } from '../../infrastructure/db/schema.js';

export interface BuildRequestContext {
  upstreamKey: UpstreamKeyRow;
  realModelName: string;
  ir: ChatRequestIR;
  authHeaders: Record<string, string>;
}

export interface NormalizeResponseContext {
  upstreamKey: UpstreamKeyRow;
  realModelName: string;
  sourceProtocol: SourceProtocol;
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface NormalizeErrorContext {
  upstreamKey: UpstreamKeyRow;
  realModelName: string;
  status: number;
  body: unknown;
}

export interface ProviderHttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface ProviderAdapter {
  buildRequest(ctx: BuildRequestContext): ProviderHttpRequest;
  normalizeResponse(ctx: NormalizeResponseContext): NormalizedChatResponse;
  normalizeError(ctx: NormalizeErrorContext): NormalizedError;
  supportsStreaming(sourceProtocol: SourceProtocol): boolean;
}
