import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Table definition for calculation history.
 *
 * This is the single source of truth for the schema: `drizzle-kit generate`
 * diffs it against the applied migrations to emit the next migration file.
 * Nothing outside this package may import it — callers work with
 * {@link CalculationRecord} through the {@link HistoryStore} port instead.
 */
export const calculations = sqliteTable(
  'calculations',
  {
    /** UUID v4 assigned by the application so ids are stable before insert. */
    id: text('id').primaryKey(),

    /** Canonical ASCII expression, e.g. `200+10%`. */
    expression: text('expression').notNull(),

    /** Presentation form using Apple's glyphs, e.g. `200 + 10%`. */
    displayExpression: text('display_expression').notNull(),

    /**
     * Lossless decimal result.
     *
     * Stored as TEXT rather than REAL on purpose: SQLite's REAL is a double,
     * which would silently destroy the precision the engine works hard to keep.
     */
    result: text('result').notNull(),

    /** The result as rendered on the calculator display. */
    displayResult: text('display_result').notNull(),

    /** Epoch milliseconds, UTC. Drizzle maps this to a JS `Date`. */
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    /**
     * Covers the history listing's `ORDER BY created_at DESC, id DESC` and the
     * keyset predicate that pages through it.
     */
    index('calculations_created_at_id_idx').on(table.createdAt, table.id),
  ],
);

/** Row shape produced by a select. Internal to the adapter. */
export type CalculationRow = typeof calculations.$inferSelect;

/** Row shape accepted by an insert. Internal to the adapter. */
export type NewCalculationRow = typeof calculations.$inferInsert;
