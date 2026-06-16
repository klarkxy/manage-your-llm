import type { Db } from "./client.js";

const STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS admin_users (
     id TEXT PRIMARY KEY,
     username TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     display_name TEXT,
     enabled INTEGER NOT NULL DEFAULT 1,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     last_login_at INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
     id TEXT PRIMARY KEY,
     admin_user_id TEXT NOT NULL,
     session_hash TEXT NOT NULL UNIQUE,
     expires_at INTEGER NOT NULL,
     created_at INTEGER NOT NULL,
     last_seen_at INTEGER NOT NULL,
     FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON admin_sessions(admin_user_id)`,
  `CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions(expires_at)`,
];

export async function initSchema(db: Db): Promise<void> {
  for (const sql of STATEMENTS) {
    await db.run(sql);
  }
}