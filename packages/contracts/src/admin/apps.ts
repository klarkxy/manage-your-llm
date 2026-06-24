import { z } from 'zod';
import { successEnvelope, listEnvelope } from '../envelope.js';

export const appSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createAppRequestSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const updateAppRequestSchema = createAppRequestSchema.partial();

export const listAppsResponseSchema = listEnvelope(appSchema);
export const appResponseSchema = successEnvelope(appSchema);

export type AppContract = z.infer<typeof appSchema>;
export type CreateAppRequest = z.infer<typeof createAppRequestSchema>;
export type UpdateAppRequest = z.infer<typeof updateAppRequestSchema>;
