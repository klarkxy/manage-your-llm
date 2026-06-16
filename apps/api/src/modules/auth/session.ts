import { createHmac, createHash } from "node:crypto";

const SEP = ".";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueSessionToken(sessionId: string, secret: string): string {
  return `${sessionId}${SEP}${sign(sessionId, secret)}`;
}

export function verifySessionToken(token: string, secret: string): string | null {
  const idx = token.lastIndexOf(SEP);
  if (idx <= 0) return null;
  const sessionId = token.slice(0, idx);
  const provided = token.slice(idx + 1);
  if (!sessionId || !provided) return null;
  const expected = sign(sessionId, secret);
  if (expected.length !== provided.length) return null;
  // constant-time
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  if (diff !== 0) return null;
  return sessionId;
}

export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("base64url");
}