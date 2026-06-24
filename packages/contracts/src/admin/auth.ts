import { z } from 'zod';
import { successEnvelope, errorEnvelope } from '../envelope.js';

export const loginRequestSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

export const adminSummarySchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
});

export const loginResponseSchema = successEnvelope(
  z.object({
    admin: adminSummarySchema,
  }),
);

export const meResponseSchema = successEnvelope(
  z.object({
    admin: adminSummarySchema,
  }),
);

export const logoutResponseSchema = successEnvelope(z.object({ ok: z.boolean() }));

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

export { errorEnvelope };
