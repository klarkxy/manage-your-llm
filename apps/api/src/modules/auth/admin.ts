import { eq, and, gt } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { generateId } from "@modelharbor/shared";
import {
  adminSessions,
  adminUsers,
  type AdminSessionInsert,
  type AdminSessionRow,
  type AdminUserInsert,
  type AdminUserRow,
  type Db,
} from "../db/index.js";
import { hashPassword, verifyPassword } from "./password.js";
import { hashSessionId, issueSessionToken, verifySessionToken } from "./session.js";

export const SESSION_COOKIE = "mh_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AdminBootstrapOptions {
  username: string;
  password: string;
  displayName?: string;
}

export async function bootstrapAdmin(db: Db, options: AdminBootstrapOptions): Promise<AdminUserRow> {
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.username, options.username)).get();
  if (existing) return existing;
  const now = new Date();
  const row: AdminUserInsert = {
    id: generateId("admin"),
    username: options.username,
    passwordHash: hashPassword(options.password),
    displayName: options.displayName ?? "Admin",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(adminUsers).values(row);
  const created = await db.select().from(adminUsers).where(eq(adminUsers.username, options.username)).get();
  if (!created) throw new Error("admin bootstrap failed");
  return created;
}

export interface CreateSessionInput {
  sessionId: string;
  adminUserId: string;
  ttlMs?: number;
}

export async function createSession(db: Db, input: CreateSessionInput): Promise<AdminSessionRow> {
  const now = new Date();
  const ttl = input.ttlMs ?? SESSION_TTL_MS;
  const expiresAt = new Date(now.getTime() + ttl);
  const row: AdminSessionInsert = {
    id: generateId("session"),
    adminUserId: input.adminUserId,
    sessionHash: hashSessionId(input.sessionId),
    expiresAt,
    createdAt: now,
    lastSeenAt: now,
  };
  await db.insert(adminSessions).values(row);
  return row;
}

export async function findSessionById(
  db: Db,
  sessionId: string,
): Promise<{ session: AdminSessionRow; user: AdminUserRow } | null> {
  const sessionHash = hashSessionId(sessionId);
  const row = await db
    .select({ session: adminSessions, user: adminUsers })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .where(and(eq(adminSessions.sessionHash, sessionHash), gt(adminSessions.expiresAt, new Date())))
    .get();
  if (!row) return null;
  if (!row.user.enabled) return null;
  return row;
}

export async function touchSession(db: Db, sessionId: string): Promise<void> {
  const sessionHash = hashSessionId(sessionId);
  const now = new Date();
  const newExpires = new Date(now.getTime() + SESSION_TTL_MS);
  await db
    .update(adminSessions)
    .set({ lastSeenAt: now, expiresAt: newExpires })
    .where(eq(adminSessions.sessionHash, sessionHash));
}

export async function deleteSession(db: Db, sessionId: string): Promise<void> {
  const sessionHash = hashSessionId(sessionId);
  await db.delete(adminSessions).where(eq(adminSessions.sessionHash, sessionHash));
}

export interface AuthenticatedRequest extends FastifyRequest {
  admin: AdminUserRow;
  sessionId: string;
}

export function requireAdmin(
  db: Db,
  secretKey: string,
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (req, reply) => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const raw = cookies?.[SESSION_COOKIE];
    if (!raw) {
      reply.code(401).send({
        error: { message: "Authentication required", type: "authentication_error", code: "authentication_error" },
      });
      return;
    }
    const sessionId = verifySessionToken(raw, secretKey);
    if (!sessionId) {
      reply.code(401).send({
        error: { message: "Invalid session", type: "authentication_error", code: "authentication_error" },
      });
      return;
    }
    const found = await findSessionById(db, sessionId);
    if (!found) {
      reply.code(401).send({
        error: { message: "Session expired", type: "authentication_error", code: "authentication_error" },
      });
      return;
    }
    (req as AuthenticatedRequest).admin = found.user;
    (req as AuthenticatedRequest).sessionId = sessionId;
    void touchSession(db, sessionId).catch(() => undefined);
  };
}

export interface AdminAuthDeps {
  db: Db;
  secretKey: string;
  isProduction: boolean;
}

export function registerAdminAuthRoutes(app: FastifyInstance, deps: AdminAuthDeps): void {
  const { db, secretKey, isProduction } = deps;

  app.post("/api/admin/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      reply.code(400).send({
        error: { message: "username and password required", type: "validation_error", code: "validation_error" },
      });
      return;
    }
    const user = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).get();
    if (!user || !user.enabled || !verifyPassword(password, user.passwordHash)) {
      reply.code(401).send({
        error: { message: "Invalid credentials", type: "authentication_error", code: "authentication_error" },
      });
      return;
    }
    const sessionId = `${generateId("admin")}_${Math.random().toString(36).slice(2, 10)}`;
    await createSession(db, { sessionId, adminUserId: user.id });
    await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id));
    const token = issueSessionToken(sessionId, secretKey);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
    reply.send({
      admin: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  });

  app.post("/api/admin/auth/logout", async (req, reply) => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const raw = cookies?.[SESSION_COOKIE];
    if (raw) {
      const sessionId = verifySessionToken(raw, secretKey);
      if (sessionId) await deleteSession(db, sessionId);
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    reply.code(204).send();
  });

  app.get("/api/admin/auth/me", { preHandler: requireAdmin(db, secretKey) }, async (req) => {
    const admin = (req as AuthenticatedRequest).admin;
    return {
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
      },
    };
  });
}