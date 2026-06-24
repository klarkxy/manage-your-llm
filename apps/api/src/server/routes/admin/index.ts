import type { FastifyInstance } from 'fastify';
import { adminAuthRoutes, type AdminAuthRouteDeps } from './auth.js';
import { setupRoutes, type SetupRouteDeps } from './setup.js';

export interface AdminRoutesDeps {
  auth: AdminAuthRouteDeps;
  setup: SetupRouteDeps;
}

export async function adminRoutes(app: FastifyInstance, deps: AdminRoutesDeps): Promise<void> {
  await app.register(
    async (authApp) => {
      await authApp.register(adminAuthRoutes, deps.auth);
    },
    { prefix: '/auth' },
  );

  await app.register(
    async (setupApp) => {
      await setupApp.register(setupRoutes, deps.setup);
    },
    { prefix: '/setup' },
  );
}
