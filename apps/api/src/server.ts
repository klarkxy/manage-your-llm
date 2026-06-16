import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { createEnv } from "./config/env.js";
import { healthRoutes } from "./plugins/health.js";
import { registerErrorHandler } from "./errors.js";

export interface BuildServerOptions {
  logger?: boolean | FastifyServerOptions["logger"];
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const env = createEnv();
  const logger =
    options.logger !== undefined
      ? options.logger
      : env.NODE_ENV === "development"
        ? { level: env.LOG_LEVEL }
        : { level: env.LOG_LEVEL };

  const app = Fastify({ logger });
  registerErrorHandler(app);
  await app.register(healthRoutes);
  return app;
}