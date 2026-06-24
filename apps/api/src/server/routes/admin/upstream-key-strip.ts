import type { UpstreamKeyRow } from '../../../infrastructure/db/schema.js';

export interface UpstreamKeyWithoutSecrets extends Omit<UpstreamKeyRow, 'apiKeyCiphertext' | 'authConfigCiphertext'> {
  authConfigPrefix?: string;
}

export function stripUpstreamKeySecrets<T extends UpstreamKeyRow>(row: T): Omit<T, 'apiKeyCiphertext' | 'authConfigCiphertext'> {
  const { apiKeyCiphertext: _apiKeyCiphertext, authConfigCiphertext: _authConfigCiphertext, ...rest } = row;
  return rest;
}
