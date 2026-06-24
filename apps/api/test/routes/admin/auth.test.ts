import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../../src/server/build-server.js';
import { createTestDb } from '../../../src/infrastructure/db/test-helper.js';

describe('admin auth routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const testDb = await createTestDb();
    app = await buildServer({
      disableBackgroundJobs: true,
      logger: false,
      databaseUrl: `file:${testDb.filePath}`,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with default bootstrap credentials and sets session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'change-me-on-first-run' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.admin.username).toBe('admin');
    const cookie = res.cookies.find((c) => c.name === 'session');
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
  });

  it('rejects invalid password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.error.type).toBe('AuthenticationError');
  });

  it('returns current admin from /me when authenticated', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'change-me-on-first-run' },
    });
    const cookie = login.cookies.find((c) => c.name === 'session')!;

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/me',
      cookies: { session: cookie.value },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.admin.username).toBe('admin');
  });

  it('returns 401 for protected route without session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });

  it('logs out and invalidates session', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'change-me-on-first-run' },
    });
    const cookie = login.cookies.find((c) => c.name === 'session')!;

    const logout = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/logout',
      cookies: { session: cookie.value },
    });
    expect(logout.statusCode).toBe(200);

    const me = await app.inject({
      method: 'GET',
      url: '/api/admin/auth/me',
      cookies: { session: cookie.value },
    });
    expect(me.statusCode).toBe(401);
  });

  it('changes password and requires new password for login', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'change-me-on-first-run' },
    });
    const cookie = login.cookies.find((c) => c.name === 'session')!;

    const change = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/change-password',
      cookies: { session: cookie.value },
      payload: { currentPassword: 'change-me-on-first-run', newPassword: 'new-password-123' },
    });
    expect(change.statusCode).toBe(200);

    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'change-me-on-first-run' },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { username: 'admin', password: 'new-password-123' },
    });
    expect(newLogin.statusCode).toBe(200);
  });
});
