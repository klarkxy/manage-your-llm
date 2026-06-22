// Playwright E2E config.
//
// Boots the api and web dev servers in parallel, each pointed at a
// per-run temp sqlite database so reruns don't see each other's state
// (admin bootstrapping, sticky bindings, usage rows). The temp file path
// is generated in `e2e/global-setup.ts` and passed to the api via
// `MODELHARBOR_DATABASE_URL`; the api's schema bootstrap re-runs on every
// cold start, so the fresh DB is fully populated before any test runs.
//
// `pnpm e2e` is the entrypoint.
//
// Browser: we reuse the system Microsoft Edge instead of downloading
// Playwright's own chromium. Set MODELHARBOR_E2E_EDGE to override; pass
// `MODELHARBOR_E2E_CHROMIUM=1` to fall back to Playwright's bundled
// chromium (requires `pnpm e2e:install`).

import { defineConfig } from '@playwright/test';

const API_PORT = Number(process.env['MODELHARBOR_E2E_PORT'] ?? 3001);
const WEB_PORT = Number(process.env['MODELHARBOR_E2E_WEB_PORT'] ?? 5180);
const EDGE_PATH =
  process.env['MODELHARBOR_E2E_EDGE'] ??
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// globalSetup writes the temp DB path to this env var; webServer reads it.
const E2E_DB_URL_ENV = 'MODELHARBOR_E2E_DB_URL';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    headless: true,
    launchOptions: process.env['MODELHARBOR_E2E_CHROMIUM'] ? {} : { executablePath: EDGE_PATH },
  },
  webServer: [
    {
      command: `pnpm --filter @modelharbor/api dev`,
      port: API_PORT,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
      env: {
        MODELHARBOR_PORT: String(API_PORT),
        MODELHARBOR_DATABASE_URL: process.env[E2E_DB_URL_ENV] ?? 'file:./data/e2e-modelharbor.sqlite',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Invoke vite directly so the port flag isn't swallowed by
      // `pnpm run dev` (which inserts a `--` separator and ignores
      // everything after it). Rebuild the shared package first so the
      // web app can resolve `@modelharbor/shared` from source. We also
      // pin --host to 127.0.0.1 so playwright's IPv4 reachability probe
      // matches what vite binds to (vite's default `localhost` resolves
      // to ::1 on Windows, which the probe ignores).
      command: `pnpm --filter @modelharbor/shared build && pnpm --filter @modelharbor/web exec vite --port ${WEB_PORT} --host 127.0.0.1 --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
      env: {
        MODELHARBOR_API_PORT: String(API_PORT),
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
