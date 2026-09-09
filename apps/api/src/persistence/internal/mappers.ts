import { CalculationRecord, type NewCalculationRecord } from '../models/calculation-record';
import type { CalculationRow, NewCalculationRow } from './schema';

/**
 * Converts a driver row into the domain model callers receive.
 *
 * The row and the model share a field-for-field shape, so this is a direct
 * construction; restating each field only created a second place to edit when
 * a column is added, and the compiler already checks the shape.
 */
export function toRecord(row: CalculationRow): CalculationRecord {
  return new CalculationRecord(row);
}

/** Converts caller input into an insertable row, filling in store-owned fields. */
export function toRow(
  input: NewCalculationRecord,
  defaults: { id: string; createdAt: Date },
): NewCalculationRow {
  return {
    id: input.id ?? defaults.id,
    expression: input.expression,
    displayExpression: input.displayExpression,
    result: input.result,
    displayResult: input.displayResult,
    createdAt: input.createdAt ?? defaults.createdAt,
  };
}
