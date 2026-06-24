import { randomBytes } from 'node:crypto';

const PREFIXES = {
  admin: 'adm',
  app: 'app',
  consumerKey: 'ck',
  upstreamKey: 'uk',
  publicModel: 'pm',
  modelGroup: 'mg',
  stickyBinding: 'sb',
  stickySession: 'ss',
  session: 'sess',
  usageRecord: 'usr',
  auditEvent: 'ae',
  trace: 'tr',
  circuitBreaker: 'cb',
  contentLog: 'cl',
  modelReference: 'mr',
} as const;

export type IdKind = keyof typeof PREFIXES;

export function generateId(kind: IdKind, byteLength = 16): string {
  return `${PREFIXES[kind]}_${randomBytes(byteLength).toString('base64url')}`;
}
