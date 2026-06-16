import { describe, it, expect } from "vitest";
import { generateId, isNormalizedError, protocolFor, PROTOCOL_BY_PROVIDER } from "./index.js";

describe("shared package", () => {
  it("generates id with the right prefix", () => {
    const id = generateId("upstreamKey");
    expect(id.startsWith("uk_")).toBe(true);
  });

  it("maps provider type to source protocol", () => {
    expect(protocolFor("anthropic_compatible")).toBe("anthropic");
    expect(protocolFor("openai_compatible")).toBe("openai");
    expect(PROTOCOL_BY_PROVIDER["anthropic_compatible"]).toBe("anthropic");
  });

  it("recognizes normalized errors", () => {
    expect(isNormalizedError(new Error("plain"))).toBe(false);
    const e = new (class extends Error {
      readonly code = "x";
      readonly type = "y";
      toClientShape() {
        return { error: { code: this.code, type: this.type } };
      }
    })();
    // prototype check; not an instance of NormalizedError here
    expect(isNormalizedError(e)).toBe(false);
  });
});