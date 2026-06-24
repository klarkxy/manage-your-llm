import { z } from 'zod';
import { successEnvelope, listEnvelope } from '../envelope.js';

export const publicModelCandidateSchema = z.object({
  id: z.string(),
  publicModelId: z.string(),
  upstreamKeyId: z.string(),
  realModelName: z.string(),
  priority: z.number(),
  weight: z.number(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const publicModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const publicModelWithCandidatesSchema = publicModelSchema.extend({
  candidates: z.array(publicModelCandidateSchema),
});

export const createPublicModelRequestSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  displayName: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  candidates: z
    .array(
      z.object({
        upstreamKeyId: z.string(),
        realModelName: z.string().min(1),
        priority: z.number().int().min(0).default(100),
        weight: z.number().int().min(1).default(1),
        enabled: z.boolean().default(true),
      }),
    )
    .optional(),
});

export const updatePublicModelRequestSchema = createPublicModelRequestSchema.partial();

export const reorderCandidatesRequestSchema = z.array(
  z.object({
    candidateId: z.string(),
    priority: z.number().int().min(0),
  }),
).min(1, '至少提供一个 candidate 排序项');

export const listPublicModelsResponseSchema = listEnvelope(publicModelSchema);
export const publicModelResponseSchema = successEnvelope(publicModelWithCandidatesSchema);

export type PublicModelContract = z.infer<typeof publicModelSchema>;
export type PublicModelCandidateContract = z.infer<typeof publicModelCandidateSchema>;
export type CreatePublicModelRequest = z.infer<typeof createPublicModelRequestSchema>;
export type UpdatePublicModelRequest = z.infer<typeof updatePublicModelRequestSchema>;
