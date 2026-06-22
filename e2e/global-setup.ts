// Per-run E2E setup.
//
// Allocates a unique temp sqlite file under the OS temp directory and
// passes its `file:` URL to the api dev server via MODELHARBOR_E2E_DB_URL.
// This makes each `pnpm e2e` run hermetic — admin bootstrapping, sticky
// bindings, and usage rows start from a fresh schema on every invocation.
//
// The file is unlinked in a best-effort cleanup hook so temp directories
// don't accumulate. The api's `initSchema` recreates all tables on cold
// start, so we don't need to pre-create the file.

import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const E2E_DB_URL_ENV = 'MODELHARBOR_E2E_DB_URL';

export default async function globalSetup(): Promise<void> {
  const dir = join(tmpdir(), 'modelharbor-e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `e2e-${process.pid}-${randomBytes(6).toString('hex')}.sqlite`);
  process.env[E2E_DB_URL_ENV] = `file:${file}`;
  // Best-effort cleanup once Playwright exits. Registered here so we don't
  // need a separate teardown file; if the process is killed we leave the
  // file behind, which is harmless under the OS temp dir.
  const cleanup = (): void => {
    try {
      rmSync(file, { force: true });
    } catch {
      /* ignore */
    }
  };
  process.once('exit', cleanup);
  process.once('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
}
