import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { MigrationFailedError } from '../errors';
import type { HistoryDatabase } from './connection';

/**
 * Location of the generated SQL migrations, relative to the compiled adapter.
 *
 * `migrations/` sits at the app root, beside `dist/`. The path is the same
 * whether this file runs from `src/` under tsx or from `dist/` under node,
 * because both are exactly three levels deep.
 */
export const DEFAULT_MIGRATIONS_FOLDER = resolve(__dirname, '..', '..', '..', 'migrations');

/**
 * Brings the database up to the latest schema version.
 *
 * Drizzle's migrator records applied migrations in `__drizzle_migrations` and
 * runs each file inside a transaction, so this is idempotent and safe to call
 * on every boot.
 */
export function runMigrations(db: HistoryDatabase, migrationsFolder: string): void {
  if (!existsSync(migrationsFolder)) {
    throw new MigrationFailedError(
      `Migrations folder not found at ${migrationsFolder}. Run "npm run db:generate" first.`,
    );
  }

  try {
    migrate(db, { migrationsFolder });
  } catch (cause) {
    throw new MigrationFailedError(`Failed to apply migrations from ${migrationsFolder}`, {
      cause,
    });
  }
}
