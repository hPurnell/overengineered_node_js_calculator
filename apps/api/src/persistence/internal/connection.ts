import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

import BetterSqlite3, { type Database as SqliteDatabase } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { HistoryStoreUnavailableError } from '../errors';
import * as schema from './schema';

export type HistoryDatabase = BetterSQLite3Database<typeof schema>;

export interface Connection {
  readonly db: HistoryDatabase;
  readonly sqlite: SqliteDatabase;
  readonly location: string;
}

const IN_MEMORY_LOCATION = ':memory:';

/**
 * Resolves a store URL to a concrete SQLite location.
 *
 * Accepts `file:./path/to.db`, a bare filesystem path, or `:memory:`. The
 * `file:` scheme is the documented form so that configuration reads as a
 * datasource URL rather than a path, keeping the door open for other drivers.
 */
export function resolveLocation(url: string, baseDirectory: string): string {
  if (url === IN_MEMORY_LOCATION || url === 'file::memory:') {
    return IN_MEMORY_LOCATION;
  }

  const path = url.startsWith('file:') ? url.slice('file:'.length) : url;

  if (path.length === 0) {
    throw new HistoryStoreUnavailableError(`Store URL ${JSON.stringify(url)} has no path`);
  }

  return isAbsolute(path) ? path : resolve(baseDirectory, path);
}

/** Opens the database, creating the parent directory and file if needed. */
export function openConnection(url: string, baseDirectory: string): Connection {
  const location = resolveLocation(url, baseDirectory);

  try {
    if (location !== IN_MEMORY_LOCATION) {
      mkdirSync(dirname(location), { recursive: true });
    }

    const sqlite = new BetterSqlite3(location);
    applyPragmas(sqlite, location);

    return { db: drizzle(sqlite, { schema }), sqlite, location };
  } catch (cause) {
    throw new HistoryStoreUnavailableError(
      `Unable to open the history store at ${location}`,
      { cause },
    );
  }
}

/**
 * Applies the pragmas this workload wants.
 *
 * WAL lets the API keep serving reads while a write commits, and is skipped
 * for in-memory databases where it has no meaning.
 */
function applyPragmas(sqlite: SqliteDatabase, location: string): void {
  if (location !== IN_MEMORY_LOCATION) {
    sqlite.pragma('journal_mode = WAL');
  }
  sqlite.pragma('foreign_keys = ON');
  // Durable enough for history, and markedly faster than FULL under WAL.
  sqlite.pragma('synchronous = NORMAL');
  // Fail fast rather than hanging a request behind a writer.
  sqlite.pragma('busy_timeout = 5000');
}
