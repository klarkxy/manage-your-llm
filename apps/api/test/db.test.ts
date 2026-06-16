import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, initSchema, adminUsers, type Db } from "../src/modules/db/index.js";

interface TestRig {
  db: Db;
  close: () => void;
}

async function makeTestRig(): Promise<TestRig> {
  const dbUrl = ":memory:";
  const { db, client } = createDb({ url: dbUrl });
  await initSchema(db);
  return { db, close: () => client.close() };
}

describe("db schema", () => {
  let rig: TestRig;
  beforeEach(async () => {
    rig = await makeTestRig();
  });
  afterEach(() => {
    rig.close();
  });

  it("creates admin_users table", async () => {
    const result = await rig.db.select().from(adminUsers).all();
    expect(result).toEqual([]);
  });

  it("enforces unique username", async () => {
    const now = new Date();
    await rig.db.insert(adminUsers).values({
      id: "adm_1",
      username: "alice",
      passwordHash: "h",
      displayName: null,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
    await expect(
      rig.db.insert(adminUsers).values({
        id: "adm_2",
        username: "alice",
        passwordHash: "h2",
        displayName: null,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      }),
    ).rejects.toThrow();
  });

  it("is idempotent (init can be called multiple times)", async () => {
    await initSchema(rig.db);
    await initSchema(rig.db);
    const result = await rig.db.select().from(adminUsers).all();
    expect(result).toEqual([]);
  });

  it("supports round-trip on admin_users", async () => {
    const now = new Date();
    await rig.db.insert(adminUsers).values({
      id: "adm_x",
      username: "bob",
      passwordHash: "h",
      displayName: "Bob",
      enabled: false,
      createdAt: now,
      updatedAt: now,
    });
    const got = await rig.db.select().from(adminUsers).where(eq(adminUsers.username, "bob")).get();
    expect(got).toBeTruthy();
    expect(got?.displayName).toBe("Bob");
    expect(got?.enabled).toBe(false);
  });
});