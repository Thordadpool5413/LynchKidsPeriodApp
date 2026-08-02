import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { app } from './app';
import { config } from './config';
import { checkDatabase, db } from './db/client';

/** Walk the full error chain checking for "already exists" / duplicate PostgreSQL errors. */
function isAlreadyExistsError(err: unknown): boolean {
  let current: unknown = err;
  while (current instanceof Error) {
    const pg = current as Error & { code?: string };
    // PostgreSQL error codes: 42P07 duplicate_table, 42701 duplicate_column, 42710 duplicate_object
    if (pg.code && /^42(P07|701|710)$/.test(pg.code)) return true;
    if (/already exists|duplicate/i.test(pg.message)) return true;
    current = pg.cause;
  }
  return false;
}

/**
 * Reconcile migration hashes: if a migration's DDL was applied to the database
 * by a previous deployment that crashed before committing the tracking row, the
 * next deploy will try to re-run it and fail. We detect each unrecorded
 * migration by probing its first SQL statement inside an intentionally-rolled-
 * back transaction. If that statement throws "already exists" / "duplicate" we
 * know the DDL is already in place; we then record the hash so migrate() skips
 * it. If the probe succeeds we roll back and leave it for migrate() to apply
 * properly.
 */
async function reconcileMigrationHashes(): Promise<void> {
  if (!db) return;
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  const applied = await db.execute(sql`SELECT hash FROM drizzle.__drizzle_migrations`);
  const appliedHashes = new Set((applied.rows as { hash: string }[]).map((r) => r.hash));

  const migrations = readMigrationFiles({ migrationsFolder: './server/db/migrations' });
  for (const migration of migrations) {
    if (appliedHashes.has(migration.hash)) continue;
    const firstStmt = migration.sql[0]?.trim();
    if (!firstStmt) continue;

    let alreadyApplied = false;
    try {
      // Run the first statement inside a transaction we always roll back.
      // This tells us whether the object already exists without leaving state.
      await db.transaction(async (tx) => {
        await tx.execute(sql.raw(firstStmt));
        // Succeeded — roll back so migrate() can apply the full migration.
        throw new Error('__reconcile_rollback__');
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === '__reconcile_rollback__') {
        // Probe succeeded; migrate() will apply this migration normally.
      } else if (isAlreadyExistsError(err)) {
        alreadyApplied = true;
      } else {
        throw err;
      }
    }

    if (alreadyApplied) {
      console.log(`[glitter-api] Reconciling already-applied migration ${migration.hash.slice(0, 8)}…`);
      await db.execute(sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${migration.hash}, ${migration.folderMillis})
      `);
      appliedHashes.add(migration.hash);
    }
  }
}

async function startProduction(): Promise<void> {
  if (!db) throw new Error('DATABASE_URL is required');

  await reconcileMigrationHashes();
  await migrate(db, { migrationsFolder: './server/db/migrations' });
  if (!await checkDatabase()) throw new Error('Database health check failed after migrations');

  const server = app.listen(config.PORT, '0.0.0.0', async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${config.PORT}/healthz`);
      if (!response.ok) throw new Error(`/healthz returned ${response.status}`);
      console.log(`Glitter production server ready on port ${config.PORT}`);
    } catch (error) {
      console.error('Production startup verification failed', error);
      server.close(() => process.exit(1));
    }
  });
}

startProduction().catch((error) => {
  console.error('Glitter production startup failed', error);
  process.exit(1);
});
