import { randomUUID } from 'node:crypto';

import { and, count, desc, eq, lt, or } from 'drizzle-orm';

import { HistoryStoreError } from '../errors';
import type { CalculationRecord, NewCalculationRecord } from '../models/calculation-record';
import type { HistoryPage, HistoryQuery, HistoryStore } from '../ports/history-store';
import type { Connection } from './connection';
import { decodeCursor, encodeCursor } from './cursor';
import { toRecord, toRow } from './mappers';
import { calculations } from './schema';

/**
 * SQLite + Drizzle adapter for the {@link HistoryStore} port.
 *
 * Deliberately not exported from the package root: callers resolve it through
 * `createHistoryStore`, which hands back the interface. Keeping the class
 * private is what makes the storage engine genuinely swappable rather than
 * merely wrapped.
 *
 * better-sqlite3 is synchronous, so the async signatures here resolve
 * immediately. The port is async anyway so that a future networked adapter is
 * a drop-in replacement.
 */
export class SqliteHistoryStore implements HistoryStore {
  private readonly connection: Connection;
  private closed = false;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  async append(input: NewCalculationRecord): Promise<CalculationRecord> {
    this.assertOpen();

    const row = toRow(input, { id: randomUUID(), createdAt: new Date() });
    const [inserted] = this.connection.db.insert(calculations).values(row).returning().all();

    if (inserted === undefined) {
      throw new HistoryStoreError('Insert returned no row');
    }

    return toRecord(inserted);
  }

  async list(query: HistoryQuery): Promise<HistoryPage> {
    this.assertOpen();

    const limit = Math.max(1, Math.trunc(query.limit));

    // Fetch one extra row: its presence is what tells us another page exists,
    // without a second COUNT query.
    const rows = this.connection.db
      .select()
      .from(calculations)
      .where(this.buildKeysetPredicate(query.cursor))
      .orderBy(desc(calculations.createdAt), desc(calculations.id))
      .limit(limit + 1)
      .all();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      items: page.map(toRecord),
      nextCursor:
        hasMore && last !== undefined
          ? encodeCursor({ createdAtMs: last.createdAt.getTime(), id: last.id })
          : null,
    };
  }

  async findById(id: string): Promise<CalculationRecord | null> {
    this.assertOpen();

    const [row] = this.connection.db
      .select()
      .from(calculations)
      .where(eq(calculations.id, id))
      .limit(1)
      .all();

    return row === undefined ? null : toRecord(row);
  }

  async deleteById(id: string): Promise<boolean> {
    this.assertOpen();

    const result = this.connection.db.delete(calculations).where(eq(calculations.id, id)).run();
    return result.changes > 0;
  }

  async clear(): Promise<number> {
    this.assertOpen();

    const result = this.connection.db.delete(calculations).run();
    return result.changes;
  }

  async ping(): Promise<boolean> {
    if (this.closed) {
      return false;
    }

    try {
      this.connection.db.select({ value: count() }).from(calculations).all();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.connection.sqlite.close();
  }

  /**
   * Builds the keyset predicate for `ORDER BY created_at DESC, id DESC`.
   *
   * Keyset rather than OFFSET so that paging cost stays flat as history grows,
   * and so a row inserted mid-page cannot shift entries onto a page the client
   * has already seen.
   */
  private buildKeysetPredicate(cursor: string | undefined) {
    if (cursor === undefined) {
      return undefined;
    }

    const position = decodeCursor(cursor);
    const createdAt = new Date(position.createdAtMs);

    return or(
      lt(calculations.createdAt, createdAt),
      and(eq(calculations.createdAt, createdAt), lt(calculations.id, position.id)),
    );
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new HistoryStoreError('The history store has been closed');
    }
  }
}
