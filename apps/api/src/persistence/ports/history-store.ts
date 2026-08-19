import type { CalculationRecord, NewCalculationRecord } from '../models/calculation-record';

/** Keyset-pagination query for the history listing. */
export interface HistoryQuery {
  /** Maximum number of records to return. */
  readonly limit: number;
  /**
   * Opaque cursor from a previous {@link HistoryPage}. Omit for the first page.
   *
   * Callers must treat this as a black box: its encoding is owned by the
   * adapter and may change without notice.
   */
  readonly cursor?: string | undefined;
}

/** One page of history, newest record first. */
export interface HistoryPage {
  readonly items: readonly CalculationRecord[];
  /** Cursor for the following page, or `null` at the end of the history. */
  readonly nextCursor: string | null;
}

/**
 * The persistence port for calculation history.
 *
 * Everything above this interface — services, HTTP handlers, the web client —
 * is written against it and knows nothing about the storage engine. The only
 * module aware that history lives in SQLite (via Drizzle) is the adapter
 * returned by `createHistoryStore`.
 *
 * Every method is asynchronous even though the current adapter is synchronous.
 * That is deliberate: it is the seam that lets the store be swapped for a
 * networked database later without a single caller changing.
 */
export interface HistoryStore {
  /** Persists a calculation and returns the stored record. */
  append(input: NewCalculationRecord): Promise<CalculationRecord>;

  /** Returns a page of history, newest first. */
  list(query: HistoryQuery): Promise<HistoryPage>;

  /** Returns the record with this id, or `null` if there is none. */
  findById(id: string): Promise<CalculationRecord | null>;

  /** Deletes one record. Resolves `true` if a row was removed. */
  deleteById(id: string): Promise<boolean>;

  /** Deletes every record and resolves the number removed. */
  clear(): Promise<number>;

  /** Cheap liveness probe for health checks. */
  ping(): Promise<boolean>;

  /** Releases underlying resources. Safe to call more than once. */
  close(): Promise<void>;
}
