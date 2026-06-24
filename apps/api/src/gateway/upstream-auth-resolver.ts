import { decryptSecret } from '../domain/upstream/secret-crypto.js';
import type { UpstreamKeyRow } from '../infrastructure/db/schema.js';

export interface UpstreamAuthResolverDeps {
  secretKey: string;
}

export class UpstreamAuthResolver {
  constructor(private readonly deps: UpstreamAuthResolverDeps) {}

  async resolveAuthHeaders(upstreamKey: UpstreamKeyRow): Promise<Record<string, string>> {
    if (upstreamKey.authType === 'oauth') {
      throw new Error('OAuth upstream auth is not implemented yet');
    }

    const apiKey = decryptSecret(upstreamKey.apiKeyCiphertext, this.deps.secretKey);
    return {
      Authorization: `Bearer ${apiKey}`,
    };
  }
}
