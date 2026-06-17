import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { createDb, initSchema, type Db } from "../src/modules/db/index.js";
import { bootstrapAdmin } from "../src/modules/auth/index.js";

interface TestRig {
  app: FastifyInstance;
  db: Db;
  dbUrl: string;
  close: () => Promise<void>;
}

async function makeTestRig(): Promise<TestRig> {
  const dbUrl = ":memory:";
  const { db, client } = createDb({ url: dbUrl });
  await initSchema(db);
  await bootstrapAdmin(db, { username: "admin", password: "secret123", displayName: "Test Admin" });
  const app = await buildServer({ db, logger: false, isProduction: false, disableBackgroundJobs: true });
  await app.ready();
  return {
    app,
    db,
    dbUrl,
    close: async () => {
      await app.close();
      client.close();
    },
  };
}

describe("admin auth", () => {
  let rig: TestRig;
  beforeEach(async () => {
    rig = await makeTestRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it("rejects login with missing fields", async () => {
    const res = await rig.app.inject({ method: "POST", url: "/api/admin/auth/login", payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("rejects login with wrong password", async () => {
    const res = await rig.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { username: "admin", password: "wrong" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects login with unknown user", async () => {
    const res = await rig.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { username: "nobody", password: "x" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts valid credentials and returns admin info", async () => {
    const res = await rig.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { username: "admin", password: "secret123" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { admin: { username: string; displayName: string } };
    expect(body.admin.username).toBe("admin");
    expect(body.admin.displayName).toBe("Test Admin");
  });
});
