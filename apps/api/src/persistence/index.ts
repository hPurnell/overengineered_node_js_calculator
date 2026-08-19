/**
 * Calculation-history persistence.
 *
 * The public surface is intentionally narrow: a domain model, a port, the
 * factories, and the errors the port can raise. No Drizzle type, SQLite type,
 * or table definition escapes this directory, so replacing the adapter is a
 * change confined to `src/persistence`.
 *
 * `boundary.test.ts` enforces that claim: it fails the build if anything
 * outside this directory imports the storage engine or reaches past this index.
 */
export {
  createHistoryStore,
  migrateHistoryStore,
  type HistoryStoreConfig,
  type MigrateResult,
} from './factory';
export {
  CalculationRecord,
  type CalculationRecordProperties,
  type NewCalculationRecord,
} from './models/calculation-record';
export type { HistoryPage, HistoryQuery, HistoryStore } from './ports/history-store';
export {
  HistoryStoreError,
  HistoryStoreUnavailableError,
  InvalidCursorError,
  MigrationFailedError,
} from './errors';
