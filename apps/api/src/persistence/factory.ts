import { openConnection } from './internal/connection';
import { DEFAULT_MIGRATIONS_FOLDER, runMigrations } from './internal/migrator';
import { SqliteHistoryStore } from './internal/sqlite-history-store';
import type { HistoryStore } from './ports/history-store';

export interface HistoryStoreConfig {
  /**
   * Datasource URL for the history store.
   *
   * Supported forms today: `file:./relative/path.db`, an absolute path, or
   * `:memory:`. Callers should treat this as opaque configuration — the schemes
   * a given build understands are the adapter's business, not theirs.
   */
  readonly url: string;

  /**
   * Apply outstanding migrations while opening. Defaults to `true`.
   *
   * Turn this off in deployments where schema changes are gated behind a
   * separate release step, and run `npm run db:migrate` there instead.
   */
  readonly autoMigrate?: boolean;

  /** Base directory that relative URLs resolve against. Defaults to `process.cwd()`. */
  readonly baseDirectory?: string;

  /** Override the migrations directory. Intended for tests and tooling. */
  readonly migrationsFolder?: string;
}

/**
 * Opens the calculation-history store.
 *
 * This is the package's only constructor, and it returns the {@link HistoryStore}
 * interface rather than the concrete adapter. Everything about the storage
 * engine — that it is SQLite, that it is reached through Drizzle, how rows are
 * shaped, how cursors are encoded — stops here.
 */
export function createHistoryStore(config: HistoryStoreConfig): HistoryStore {
  const {
    url,
    autoMigrate = true,
    baseDirectory = process.cwd(),
    migrationsFolder = DEFAULT_MIGRATIONS_FOLDER,
  } = config;

  const connection = openConnection(url, baseDirectory);

  if (autoMigrate) {
    try {
      runMigrations(connection.db, migrationsFolder);
    } catch (error) {
      // Do not leak the handle if the schema could not be brought up to date.
      connection.sqlite.close();
      throw error;
    }
  }

  return new SqliteHistoryStore(connection);
}

export interface MigrateResult {
  /** Resolved location of the datastore that was migrated. */
  readonly location: string;
  /** Directory the migrations were read from. */
  readonly migrationsFolder: string;
}

/**
 * Applies outstanding migrations and closes again.
 *
 * The release-step counterpart to `autoMigrate`. It exists so the migration CLI
 * has a supported entry point: without it, tooling would have to reach into the
 * adapter's internals, which is exactly the coupling this layer prevents.
 */
export function migrateHistoryStore(
  config: Omit<HistoryStoreConfig, 'autoMigrate'>,
): MigrateResult {
  const {
    url,
    baseDirectory = process.cwd(),
    migrationsFolder = DEFAULT_MIGRATIONS_FOLDER,
  } = config;

  const connection = openConnection(url, baseDirectory);

  try {
    runMigrations(connection.db, migrationsFolder);
    return { location: connection.location, migrationsFolder };
  } finally {
    connection.sqlite.close();
  }
}
