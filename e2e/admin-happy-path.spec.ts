import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
} from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'change-me-on-first-run';

interface ApiEnvelope<T> {
  data: T;
}

function startMockUpstream(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        const upstreamBody = body ? (JSON.parse(body) as Record<string, unknown>) : {};
        const realModelName = (upstreamBody.model as string) ?? 'unknown';
        const response = {
          id: 'chatcmpl-happy',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: realModelName,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello from happy path' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 4, total_tokens: 9 },
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve({ server, port: address.port });
    });
  });
}

function stopMockUpstream(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function loginAdmin(ctx: APIRequestContext): Promise<void> {
  const res = await ctx.post('/api/admin/auth/login', {
    data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
  });
  expect(res.status()).toBe(200);
}

async function postJson<T>(ctx: APIRequestContext, path: string, body: unknown): Promise<T> {
  const res = await ctx.post(path, { data: body });
  expect(res.status()).toBe(200);
  return (await res.json()) as T;
}

async function setEnglishLocale(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('manageyourllm-locale', 'en');
  });
}

test.describe('admin happy path', () => {
  let mockServer: Server;
  let mockPort: number;
  let adminCtx: APIRequestContext;

  test.beforeAll(async () => {
    ({ server: mockServer, port: mockPort } = await startMockUpstream());

    const API_PORT = Number(
      process.env['MYLLM_E2E_API_PORT'] ?? process.env['MANAGE_YOUR_LLM_E2E_API_PORT'] ?? 3001,
    );

    adminCtx = await playwrightRequest.newContext({
      baseURL: `http://127.0.0.1:${API_PORT}`,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });

    await loginAdmin(adminCtx);

    const suffix = Date.now().toString(36);
    const app = await postJson<ApiEnvelope<{ id: string }>>(adminCtx, '/api/admin/apps', {
      name: `Happy Path App ${suffix}`,
    });

    const upstream = await postJson<ApiEnvelope<{ id: string }>>(
      adminCtx,
      '/api/admin/upstream-keys',
      {
        name: `happy-upstream-${suffix}`,
        providerType: 'openai_compatible',
        baseUrl: `http://127.0.0.1:${mockPort}`,
        apiKey: 'sk-happy',
      },
    );

    await postJson(adminCtx, '/api/admin/public-models', {
      name: `happy-model-${suffix}`,
      displayName: 'Happy Model',
      candidates: [{ upstreamKeyId: upstream.data.id, realModelName: 'happy-real' }],
    });

    await postJson<ApiEnvelope<{ consumerKey: { id: string }; rawKey: string }>>(
      adminCtx,
      '/api/admin/consumer-keys',
      {
        appId: app.data.id,
        name: 'default',
        accessMode: 'all',
      },
    );
  });

  test.afterAll(async () => {
    await adminCtx?.dispose();
    await stopMockUpstream(mockServer);
  });

  test('login, view setup wizard and create a backup', async ({ page }) => {
    await setEnglishLocale(page);
    const backupNote = `happy-backup-${Date.now().toString(36)}`;

    // Login
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.getByRole('textbox').nth(0).fill(ADMIN_USERNAME);
    await page.getByRole('textbox').nth(1).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Overview' }).first()).toBeVisible();

    // Setup wizard (already complete via API seeding)
    await page.goto('/setup', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Setup Wizard' }).first()).toBeVisible();
    await expect(page.getByText('Consumer Key').first()).toBeVisible();
    await page.getByRole('button', { name: 'Finish' }).click();
    await page.waitForURL('/', { timeout: 10_000 });

    // Backups
    await page.goto('/backups', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Backups' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Create Backup' }).click();
    await page.getByRole('textbox').fill(backupNote);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('cell', { name: backupNote })).toBeVisible();
  });
});
