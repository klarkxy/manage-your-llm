import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { adminSessions, createDb, initSchema, type Db } from "../src/modules/db/index.js";
import { bootstrapAdmin, hashSessionId, SESSION_COOKIE } from "../src/modules/auth/index.js";

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
  const app = await buildServer({ db, logger: false, isProduction: false });
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

  it("succeeds login with correct credentials and sets a session cookie", async () => {
    const res = await rig.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { username: "admin", password: "secret123" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { admin: { username: string; displayName: string } };
    expect(body.admin.username).toBe("admin");
    expect(body.admin.displayName).toBe("Test Admin");
    const cookie = res.headers["set-cookie"];
    expect(cookie).toBeTruthy();
    const cookies = Array.isArray(cookie) ? cookie : [cookie as string];
    expect(cookies.some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(true);
  });

  it("me returns 401 without cookie", async () => {
    const res = await rig.app.inject({ method: "GET", url: "/api/admin/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("me returns admin info when authenticated", async () => {
    const loginRes = await rig.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { username: "admin", password: "secret123" },
    });
    const setCookie = loginRes.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie as string];
    const cookieHeader = cookies.join("; ");
    const meRes = await rig.app.inject({
      method: "GET",
      url: "/api/admin/auth/me",
      headers: { cookie: cookieHeader },
    });
    expect(meRes.statusCode).toBe(200);
    const me = meRes.json() as { admin: { username: string } };
    expect(me.admin.username).toBe("admin");
  });

  it("logout clears the session", async () => {
    const loginRes = await rig.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { username: "admin", password: "secret123" },
    });
    const setCookie = loginRes.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie as string];
    const cookieHeader = cookies.join("; ");
    const logoutRes = await rig.app.inject({
      method: "POST",
      url: "/api/admin/auth/logout",
      headers: { cookie: cookieHeader },
    });
    expect(logoutRes.statusCode).toBe(204);
    const meRes = await rig.app.inject({
      method: "GET",
      url: "/api/admin/auth/me",
      headers: { cookie: cookieHeader },
    });
    expect(meRes.statusCode).toBe(401);
  });
});

describe("admin session row shape", () => {
  let rig: TestRig;
  beforeEach(async () => {
    rig = await makeTestRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it("stores an independent row id (sess_*) and a sessionHash derived from the cookie sessionId", async () => {
    const login = await rig.app.inject({
      method: "POST",
      url: "/api/admin/auth/login",
      payload: { username: "admin", password: "secret123" },
    });
    expect(login.statusCode).toBe(200);
    const setCookie = login.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie as string];
    const cookie = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(cookie).toBeDefined();
    const token = cookie!.split(";")[0]!.split("=", 2)[1]!;
    // token format: <sessionId>.<signature>
    const sessionIdFromCookie = token.split(".")[0]!;

    const rows = await rig.db.select().from(adminSessions).all();
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    // Row id is independent of the raw sessionId.
    expect(row.id).not.toBe(sessionIdFromCookie);
    expect(row.id.startsWith("sess_")).toBe(true);
    // sessionHash is the SHA-256 of the sessionId, not the raw sessionId.
    expect(row.sessionHash).not.toBe(sessionIdFromCookie);
    expect(row.sessionHash).not.toContain(".");
    // Hashing the sessionId recovers the stored hash.
    expect(row.sessionHash).toBe(hashSessionId(sessionIdFromCookie));
  });
});