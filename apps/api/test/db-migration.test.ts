import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, initSchema, type Db } from '../src/modules/db/index.js';

interface TestRig {
  db: Db;
  // Underlying @libsql/client Client. createDb returns it as `client`.
  client: LibsqlClient;
  close: () => void;
}

interface LibsqlClient {
  execute: (q: { sql: string; args?: unknown[] }) => Promise<{ rows: Array<Record<string, unknown>> }>;
  close: () => void;
}

// Minimal pre-migration `usage_records` shape: every column the current
// schema declares, except `session_sticky_hit`. Used to simulate a database
// that was created before M7.3 added the session-stickiness flag, so we can
// verify the ALTER TABLE migration brings it up to date without losing
// existing rows.
const PRE_MIGRATION_USAGE_RECORDS_COLUMNS = [
  'id TEXT PRIMARY KEY',
  'app_id TEXT NOT NULL',
  'consumer_key_id TEXT NOT NULL',
  'requested_target_name TEXT NOT NULL',
  'resolved_target_type TEXT NOT NULL',
  'resolved_target_id TEXT NOT NULL',
  'upstream_key_id TEXT NOT NULL',
  'real_model_name TEXT NOT NULL',
  'source_protocol TEXT NOT NULL',
  'provider_type TEXT NOT NULL',
  'stream INTEGER NOT NULL DEFAULT 0',
  'sticky_hit INTEGER NOT NULL DEFAULT 0',
  'input_tokens INTEGER',
  'output_tokens INTEGER',
  'total_tokens INTEGER',
  'status TEXT NOT NULL',
  'error_code TEXT',
  'latency_ms INTEGER NOT NULL',
  'created_at INTEGER NOT NULL',
];

async function makePreMigrationRig(): Promise<TestRig> {
  const dbUrl = ':memory:';
  const { db, client } = createDb({ url: dbUrl });
  // Use the underlying client.execute so we can run arbitrary raw SQL
  // (Drizzle's `db.run` takes a SQL builder, not a string).
  const libsql = client as unknown as LibsqlClient;
  await libsql.execute({
    sql: `CREATE TABLE usage_records (${PRE_MIGRATION_USAGE_RECORDS_COLUMNS.join(', ')})`,
  });
  return { db, client: libsql, close: () => client.close() };
}

async function pragmaUsageColumns(
  rig: TestRig,
): Promise<Array<{ name: string; dflt_value: string | null }>> {
  const r = await rig.client.execute({ sql: 'PRAGMA table_info(usage_records)' });
  return r.rows.map((row) => ({
    name: String(row.name),
    dflt_value: row.dflt_value === null ? null : String(row.dflt_value),
  }));
}

describe('usage_records session_sticky_hit migration', () => {
  let rig: TestRig;
  beforeEach(async () => {
    rig = await makePreMigrationRig();
  });
  afterEach(() => {
    rig.close();
  });

  it('column is missing before migration', async () => {
    const cols = await pragmaUsageColumns(rig);
    expect(cols.map((c) => c.name)).not.toContain('session_sticky_hit');
  });

  it('initSchema adds session_sticky_hit with default 0', async () => {
    await initSchema(rig.db);
    const cols = await pragmaUsageColumns(rig);
    const col = cols.find((c) => c.name === 'session_sticky_hit');
    expect(col).toBeDefined();
    expect(col?.dflt_value).toBe('0');
  });

  it('migration is idempotent — running again does not throw', async () => {
    await initSchema(rig.db);
    await expect(initSchema(rig.db)).resolves.toBeUndefined();
  });

  it('existing rows get session_sticky_hit = 0 after migration', async () => {
    // Insert a pre-migration row that does not mention session_sticky_hit.
    await rig.client.execute({
      sql:
        "INSERT INTO usage_records (id, app_id, consumer_key_id, requested_target_name, " +
        "resolved_target_type, resolved_target_id, upstream_key_id, real_model_name, " +
        "source_protocol, provider_type, stream, sticky_hit, status, latency_ms, created_at) " +
        "VALUES ('existing-1', 'a', 'c', 'm', 'public', 'pm', 'uk', 'real', " +
        "'openai', 'openai', 0, 0, 'success', 10, 1)",
    });

    await initSchema(rig.db);

    const result = await rig.client.execute({
      sql: 'SELECT id, session_sticky_hit FROM usage_records WHERE id = ?',
      args: ['existing-1'],
    });
    const rows = result.rows as Array<{ id: string; session_sticky_hit: number | null }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.session_sticky_hit).toBe(0);
  });
});
