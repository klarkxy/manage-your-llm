import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { createEnv } from "./config/env.js";
import { healthRoutes } from "./plugins/health.js";
import { registerErrorHandler } from "./errors.js";
import { type Db } from "./modules/db/index.js";
import { registerAdminAuthRoutes, requireAdmin } from "./modules/auth/index.js";
import { registerGatewayRoutes } from "./modules/gateway/index.js";
import {
  registerAppRoutes,
  registerConsumerKeyRoutes,
  registerModelGroupRoutes,
  registerPublicModelRoutes,
  registerUpstreamKeyRoutes,
} from "./modules/admin/index.js";

export interface BuildServerOptions {
  logger?: boolean | FastifyServerOptions["logger"];
  db?: Db;
  secretKey?: string;
  isProduction?: boolean;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const env = createEnv();
  const isProduction = options.isProduction ?? env.NODE_ENV === "production";
  const secretKey = options.secretKey ?? env.SECRET_KEY;
  const logger =
    options.logger !== undefined
      ? options.logger
      : isProduction
        ? { level: env.LOG_LEVEL }
        : { level: env.LOG_LEVEL };

  const app = Fastify({ logger });

  // Allow empty body when content-type is application/json (e.g. logout).
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      if (typeof body === "string" && body.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  registerErrorHandler(app);
  await app.register(fastifyCookie);
  await app.register(healthRoutes);

  if (options.db) {
    registerAdminAuthRoutes(app, { db: options.db, secretKey, isProduction });
    // Guard everything under /api/admin except /api/admin/auth/*
    const guard = requireAdmin(options.db, secretKey);
    app.addHook("preHandler", async (req, reply) => {
      const url = req.url;
      if (url.startsWith("/api/admin/") && !url.startsWith("/api/admin/auth/")) {
        await guard(req, reply);
      }
    });
    registerUpstreamKeyRoutes(app, { db: options.db, secretKey });
    registerPublicModelRoutes(app, { db: options.db });
    registerModelGroupRoutes(app, { db: options.db });
    registerAppRoutes(app, { db: options.db });
    registerConsumerKeyRoutes(app, { db: options.db });
    registerGatewayRoutes(app, { db: options.db, secretKey });
  }

  return app;
}
