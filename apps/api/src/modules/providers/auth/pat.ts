import { ValidationError } from '@modelharbor/shared';
import { decryptUpstreamApiKey } from '../../admin/helpers.js';
import type { UpstreamAuthStrategy, AuthHeaderResult, UpstreamAuthContext } from './index.js';

export const patAuthStrategy: UpstreamAuthStrategy = {
  type: 'pat',

  validateConfig(_config: unknown): Record<string, unknown> {
    return {};
  },

  async getHeader(ctx: UpstreamAuthContext): Promise<AuthHeaderResult> {
    const apiKey = decryptUpstreamApiKey(ctx.row.apiKeyCiphertext, ctx.secretKey);
    if (!apiKey) {
      throw new ValidationError('apiKey is required for PAT authentication');
    }
    return { header: `Bearer ${apiKey}` };
  },
};
