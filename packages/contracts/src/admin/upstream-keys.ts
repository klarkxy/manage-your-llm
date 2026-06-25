import { z } from 'zod';
import { successEnvelope, listEnvelope } from '../envelope.js';

export const upstreamKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  providerPresetId: z.string().nullable(),
  providerType: z.string(),
  baseUrl: z.string(),
  authType: z.string(),
  apiKeyPrefix: z.string(),
  authConfigCiphertext: z.string().nullable().optional(),
  defaultHeadersJson: z.record(z.string()).nullable().optional(),
  extraHeadersJson: z.record(z.string()).nullable().optional(),
  extraParamsJson: z.record(z.unknown()).nullable().optional(),
  supportedModelsJson: z.array(z.string()),
  endpointsJson: z.unknown().nullable().optional(),
  displayOrder: z.number(),
  enabled: z.boolean(),
  frozen: z.boolean(),
  frozenReason: z.string().nullable().optional(),
  cooldownUntil: z.string().datetime().nullable().optional(),
  stickySessionTtlMs: z.number(),
  lastUsedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const upstreamKeyQuotaSchema = z.object({
  id: z.string(),
  upstreamKeyId: z.string(),
  period: z.enum(['hour', 'day', 'week', 'month', 'total']),
  requestLimit: z.number().nullable().optional(),
  inputTokenLimit: z.number().nullable().optional(),
  outputTokenLimit: z.number().nullable().optional(),
  totalTokenLimit: z.number().nullable().optional(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const upstreamKeyWithQuotaSchema = upstreamKeySchema.extend({
  quota: upstreamKeyQuotaSchema.nullable().optional(),
});

export const createUpstreamKeyRequestSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  providerPresetId: z.string().optional(),
  providerType: z.string().min(1),
  baseUrl: z.string().url('必须是有效 URL'),
  apiKey: z.string().min(1, 'API Key 不能为空'),
  authConfigJson: z.string().optional(),
  defaultHeaders: z.record(z.string()).optional(),
  extraHeaders: z.record(z.string()).optional(),
  extraParams: z.record(z.unknown()).optional(),
  supportedModels: z.array(z.string()).optional(),
  endpoints: z.array(z.unknown()).optional(),
  displayOrder: z.number().optional(),
  enabled: z.boolean().optional(),
  stickySessionTtlMs: z.number().optional(),
  quota: z
    .object({
      period: z.enum(['hour', 'day', 'week', 'month', 'total']),
      requestLimit: z.number().nullable().optional(),
      inputTokenLimit: z.number().nullable().optional(),
      outputTokenLimit: z.number().nullable().optional(),
      totalTokenLimit: z.number().nullable().optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
});

export const updateUpstreamKeyRequestSchema = createUpstreamKeyRequestSchema
  .partial()
  .omit({ apiKey: true });

export const rotateApiKeyRequestSchema = z.object({
  apiKey: z.string().min(1, 'API Key 不能为空'),
});

export const reorderUpstreamKeysRequestSchema = z
  .array(
    z.object({
      id: z.string(),
      displayOrder: z.number().int(),
    }),
  )
  .min(1, '至少提供一个 upstream key 排序项');

export const freezeUpstreamKeyRequestSchema = z.object({
  frozen: z.boolean().optional().default(true),
  reason: z.string().optional(),
});

export const pingUpstreamRequestSchema = z.object({
  model: z.string().optional(),
});

export const discoveredModelSchema = z.object({
  id: z.string(),
  object: z.string(),
  ownedBy: z.string().optional(),
});

export const discoverModelsResponseSchema = successEnvelope(z.array(discoveredModelSchema));
export const pingUpstreamResponseSchema = successEnvelope(
  z.object({ ok: z.boolean(), latencyMs: z.number(), error: z.string().nullable().optional() }),
);
export const rotateApiKeyResponseSchema = successEnvelope(upstreamKeySchema);
export const listUpstreamKeysResponseSchema = listEnvelope(upstreamKeyWithQuotaSchema);
export const upstreamKeyResponseSchema = successEnvelope(upstreamKeyWithQuotaSchema);

export type UpstreamKeyContract = z.infer<typeof upstreamKeySchema>;
export type UpstreamKeyQuotaContract = z.infer<typeof upstreamKeyQuotaSchema>;
export type CreateUpstreamKeyRequest = z.infer<typeof createUpstreamKeyRequestSchema>;
export type UpdateUpstreamKeyRequest = z.infer<typeof updateUpstreamKeyRequestSchema>;
export type ReorderUpstreamKeysRequest = z.infer<typeof reorderUpstreamKeysRequestSchema>;
export type FreezeUpstreamKeyRequest = z.infer<typeof freezeUpstreamKeyRequestSchema>;
export type PingUpstreamRequest = z.infer<typeof pingUpstreamRequestSchema>;
export type DiscoveredModel = z.infer<typeof discoveredModelSchema>;
