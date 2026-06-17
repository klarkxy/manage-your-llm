import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer, getBackgroundJobsHandle } from "../src/server.js";
import { createDb, initSchema, type Db } from "../src/modules/db/index.js";
import { bootstrapAdmin } from "../src/modules/auth/index.js";

describe("health + server wiring", () => {
  describe("without a database", () => {
    let app: FastifyInstance;
    afterEach(async () => {
      await app.close();
    });

    beforeEach(async () => {
      app = await buildServer({ logger: false, disableBackgroundJobs: true });
      await app.ready();
    });

    it("GET /healthz returns 200 with status ok", async () => {
      const res = await app.inject({ method: "GET", url: "/healthz" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok" });
    });

    it("GET /readyz returns 200 with status ok", async () => {
      const res = await app.inject({ method: "GET", url: "/readyz" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok" });
    });

    it("does not expose a background jobs handle", () => {
      expect(getBackgroundJobsHandle(app)).toBeNull();
    });
  });

  describe("with a database", () => {
    let app: FastifyInstance;
    let dbClient: { close: () => void };

    afterEach(async () => {
      await app.close();
      dbClient.close();
    });

    beforeEach(async () => {
      const c = createDb({ url: ":memory:" });
      const db: Db = c.db;
      dbClient = c.client;
      await initSchema(db);
      await bootstrapAdmin(db, { username: "admin", password: "secret123", displayName: "Admin" });
      app = await buildServer({ db, logger: false, isProduction: false, disableBackgroundJobs: false });
      await app.ready();
    });

    it("GET /readyz returns 200 ok when the database is reachable", async () => {
      const res = await app.inject({ method: "GET", url: "/readyz" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: "ok" });
    });

    it("GET /readyz returns 503 degraded when the database is closed", async () => {
      dbClient.close();
      const res = await app.inject({ method: "GET", url: "/readyz" });
      expect(res.statusCode).toBe(503);
      const body = res.json() as { status: string; error?: string };
      expect(body.status).toBe("degraded");
      expect(typeof body.error).toBe("string");
    });

    it("exposes a background jobs handle so main.ts can stop it on shutdown", () => {
      expect(getBackgroundJobsHandle(app)).not.toBeNull();
    });
  });
});
