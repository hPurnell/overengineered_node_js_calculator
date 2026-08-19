import { CalculationRecord, type NewCalculationRecord } from '../models/calculation-record';
import type { CalculationRow, NewCalculationRow } from './schema';

/** Converts a driver row into the domain model callers receive. */
export function toRecord(row: CalculationRow): CalculationRecord {
  return new CalculationRecord({
    id: row.id,
    expression: row.expression,
    displayExpression: row.displayExpression,
    result: row.result,
    displayResult: row.displayResult,
    createdAt: row.createdAt,
  });
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
