import { z } from 'zod';
import { successEnvelope, listEnvelope } from '../envelope.js';

export const consumerKeyAccessSchema = z.object({
  id: z.string(),
  consumerKeyId: z.string(),
  targetType: z.enum(['public_model', 'model_group']),
  targetId: z.string(),
  createdAt: z.string().datetime(),
});

export const consumerKeySchema = z.object({
  id: z.string(),
  appId: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  keySuffix: z.string(),
  accessMode: z.enum(['all', 'restricted']),
  enabled: z.boolean(),
  revokedAt: z.string().datetime().nullable().optional(),
  lastUsedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const consumerKeyWithAccessSchema = consumerKeySchema.extend({
  access: z.array(consumerKeyAccessSchema),
});

export const createConsumerKeyRequestSchema = z.object({
  appId: z.string(),
  name: z.string().min(1, '名称不能为空'),
  accessMode: z.enum(['all', 'restricted']).optional(),
  accessTargets: z
    .array(
      z.object({
        targetType: z.enum(['public_model', 'model_group']),
        targetId: z.string(),
      }),
    )
    .optional(),
  enabled: z.boolean().optional(),
});

export const updateConsumerKeyRequestSchema = z.object({
  name: z.string().min(1).optional(),
  accessMode: z.enum(['all', 'restricted']).optional(),
  accessTargets: z
    .array(
      z.object({
        targetType: z.enum(['public_model', 'model_group']),
        targetId: z.string(),
      }),
    )
    .optional(),
  enabled: z.boolean().optional(),
});

export const rotateConsumerKeyResponseSchema = successEnvelope(
  z.object({ consumerKey: consumerKeySchema, rawKey: z.string() }),
);

export const createConsumerKeyResponseSchema = successEnvelope(
  z.object({ consumerKey: consumerKeyWithAccessSchema, rawKey: z.string() }),
);

export const revokeConsumerKeyResponseSchema = successEnvelope(
  z.object({ consumerKey: consumerKeyWithAccessSchema }),
);

export const listConsumerKeysResponseSchema = listEnvelope(consumerKeySchema);
export const consumerKeyResponseSchema = successEnvelope(consumerKeyWithAccessSchema);

export type ConsumerKeyContract = z.infer<typeof consumerKeySchema>;
export type ConsumerKeyAccessContract = z.infer<typeof consumerKeyAccessSchema>;
export type CreateConsumerKeyRequest = z.infer<typeof createConsumerKeyRequestSchema>;
export type UpdateConsumerKeyRequest = z.infer<typeof updateConsumerKeyRequestSchema>;
export type CreateConsumerKeyResponse = z.infer<typeof createConsumerKeyResponseSchema>;
export type RevokeConsumerKeyResponse = z.infer<typeof revokeConsumerKeyResponseSchema>;
