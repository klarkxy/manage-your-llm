import { z } from 'zod';
import { successEnvelope, listEnvelope } from '../envelope.js';

export const providerPresetSchema = z.object({
  id: z.string(),
  source: z.enum(['builtin', 'local']),
  name: z.string(),
  providerType: z.string(),
  descriptorJson: z.record(z.unknown()),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const createLocalPresetRequestSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  providerType: z.string().min(1),
  descriptorJson: z.record(z.unknown()),
});

export const updateLocalPresetRequestSchema = z.object({
  name: z.string().min(1).optional(),
  providerType: z.string().min(1).optional(),
  descriptorJson: z.record(z.unknown()).optional(),
});

export const listPresetsResponseSchema = listEnvelope(providerPresetSchema);
export const presetResponseSchema = successEnvelope(providerPresetSchema);

export type ProviderPresetContract = z.infer<typeof providerPresetSchema>;
export type CreateLocalPresetRequest = z.infer<typeof createLocalPresetRequestSchema>;
export type UpdateLocalPresetRequest = z.infer<typeof updateLocalPresetRequestSchema>;
export type ListPresetsResponse = z.infer<typeof listPresetsResponseSchema>;
export type PresetResponse = z.infer<typeof presetResponseSchema>;
