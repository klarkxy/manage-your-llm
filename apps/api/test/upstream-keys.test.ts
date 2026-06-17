import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { upstreamKeys } from "../src/modules/db/index.js";
import { decryptUpstreamApiKeyForTest } from "../src/modules/admin/index.js";
import { makeAdminRig, type AdminTestRig } from "./helper.js";

describe("upstream keys admin", () => {
  let rig: AdminTestRig;
  beforeEach(async () => {
    rig = await makeAdminRig();
  });
  afterEach(async () => {
    await rig.close();
  });

  it("creates an upstream key and never returns the raw apiKey in any subsequent response", async () => {
    const res = await rig.app.inject({
      method: "POST",
      url: "/api/admin/upstream-keys",
      headers: { cookie: rig.cookie },
      payload: {
        name: "deepseek-1",
        providerType: "anthropic_compatible",
        baseUrl: "https://api.deepseek.com",
        apiKey: "sk-supersecret-DO-NOT-LEAK",
        supportedModels: ["ds-v4-flash"],
        quota: {
          period: "month",
          requestLimit: 100000,
          inputTokenLimit: 10000000,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string; apiKeyPrefix: string; quota: { period: string } };
    expect(body.id).toBeTruthy();
    expect(body.apiKeyPrefix).toBe("sk-s");
    expect(body.quota?.period).toBe("month");
    // The raw secret must not appear anywhere in the create response.
    expect(JSON.stringify(body)).not.toContain("supersecret");

    // GET list
    const list = await rig.app.inject({
      method: "GET",
      url: "/api/admin/upstream-keys",
      headers: { cookie: rig.cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(JSON.stringify(list.json())).not.toContain("supersecret");

    // GET detail
    const detail = await rig.app.inject({
      method: "GET",
      url: `/api/admin/upstream-keys/${body.id}`,
      headers: { cookie: rig.cookie },
    });
    expect(JSON.stringify(detail.json())).not.toContain("supersecret");
  });

  it("encrypts the stored api key so the plaintext is not in the database", async () => {
    const res = await rig.app.inject({
      method: "POST",
      url: "/api/admin/upstream-keys",
      headers: { cookie: rig.cookie },
      payload: {
        name: "deepseek-2",
        providerType: "openai_compatible",
        baseUrl: "https://api.openai.com",
        apiKey: "sk-plaintextvalue-XYZ",
      },
    });
    const body = res.json() as { id: string };
    const row = await rig.db.select().from(upstreamKeys).where(eq(upstreamKeys.id, body.id)).get();
    expect(row).toBeTruthy();
    expect(row!.apiKeyCiphertext).not.toContain("plaintextvalue");
    // The encryption helper should round-trip
    expect(decryptUpstreamApiKeyForTest(row!.apiKeyCiphertext, rig.secretKey)).toBe("sk-plaintextvalue-XYZ");
  });

  it("rejects invalid providerType", async () => {
    const res = await rig.app.inject({
      method: "POST",
      url: "/api/admin/upstream-keys",
      headers: { cookie: rig.cookie },
      payload: {
        name: "bad",
        providerType: "weird",
        baseUrl: "https://x.com",
        apiKey: "k",
      },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("rejects duplicate name with 409", async () => {
    const payload = {
      name: "dup",
      providerType: "anthropic_compatible" as const,
      baseUrl: "https://x.com",
      apiKey: "k1",
    };
    const r1 = await rig.app.inject({ method: "POST", url: "/api/admin/upstream-keys", headers: { cookie: rig.cookie }, payload });
    expect(r1.statusCode).toBe(200);
    const r2 = await rig.app.inject({ method: "POST", url: "/api/admin/upstream-keys", headers: { cookie: rig.cookie }, payload: { ...payload, apiKey: "k2" } });
    expect(r2.statusCode).toBe(409);
  });

  it("freezes and unfreezes an upstream key", async () => {
    const c = await rig.app.inject({
      method: "POST",
      url: "/api/admin/upstream-keys",
      headers: { cookie: rig.cookie },
      payload: { name: "frz", providerType: "anthropic_compatible", baseUrl: "https://x.com", apiKey: "k" },
    });
    const id = (c.json() as { id: string }).id;
    const frz = await rig.app.inject({
      method: "POST",
      url: `/api/admin/upstream-keys/${id}/freeze`,
      headers: { cookie: rig.cookie },
      payload: { reason: "manual test" },
    });
    expect(frz.statusCode).toBe(200);
    expect((frz.json() as { frozen: boolean }).frozen).toBe(true);
    const unf = await rig.app.inject({
      method: "POST",
      url: `/api/admin/upstream-keys/${id}/unfreeze`,
      headers: { cookie: rig.cookie },
    });
    expect(unf.statusCode).toBe(200);
    expect((unf.json() as { frozen: boolean }).frozen).toBe(false);
  });

  it("rotates the secret and updates the prefix", async () => {
    const c = await rig.app.inject({
      method: "POST",
      url: "/api/admin/upstream-keys",
      headers: { cookie: rig.cookie },
      payload: { name: "rot", providerType: "anthropic_compatible", baseUrl: "https://x.com", apiKey: "old-key-1234" },
    });
    const id = (c.json() as { id: string }).id;
    const rot = await rig.app.inject({
      method: "POST",
      url: `/api/admin/upstream-keys/${id}/rotate-secret`,
      headers: { cookie: rig.cookie },
      payload: { apiKey: "new-key-5678" },
    });
    expect(rot.statusCode).toBe(200);
    expect((rot.json() as { apiKeyPrefix: string }).apiKeyPrefix).toBe("new-");
    const row = await rig.db.select().from(upstreamKeys).where(eq(upstreamKeys.id, id)).get();
    expect(row!.apiKeyPrefix).toBe("new-");
    expect(decryptUpstreamApiKeyForTest(row!.apiKeyCiphertext, rig.secretKey)).toBe("new-key-5678");
  });

  it("requires admin cookie for create", async () => {
    const res = await rig.app.inject({
      method: "POST",
      url: "/api/admin/upstream-keys",
      payload: { name: "no", providerType: "anthropic_compatible", baseUrl: "https://x.com", apiKey: "k" },
    });
    expect(res.statusCode).toBe(401);
  });
});