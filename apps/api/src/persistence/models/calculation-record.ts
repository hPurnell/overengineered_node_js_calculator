import type { Calculation } from '@calc/contracts';

/**
 * Domain model for one row of the `calculations` table.
 *
 * This is the currency of the {@link HistoryStore} port: callers receive and
 * supply these, never driver rows. It is a class rather than a bare interface
 * so that row-to-domain conversion and DTO projection have an obvious home and
 * cannot be reimplemented inconsistently by each caller.
 */
export class CalculationRecord {
  /** Primary key. UUID v4, assigned by the application, not the database. */
  readonly id: string;

  /** Canonical ASCII expression that was evaluated. */
  readonly expression: string;

  /** The expression as the user saw it, using Apple's operator glyphs. */
  readonly displayExpression: string;

  /** Lossless decimal result, stored as text to preserve precision. */
  readonly result: string;

  /** The result rendered for the calculator display. */
  readonly displayResult: string;

  /** Creation instant. Always stored and compared in UTC. */
  readonly createdAt: Date;

  constructor(properties: CalculationRecordProperties) {
    this.id = properties.id;
    this.expression = properties.expression;
    this.displayExpression = properties.displayExpression;
    this.result = properties.result;
    this.displayResult = properties.displayResult;
    this.createdAt = properties.createdAt;
    Object.freeze(this);
  }

  /** Projects the record onto the public wire contract. */
  toDto(): Calculation {
    return {
      id: this.id,
      expression: this.expression,
      displayExpression: this.displayExpression,
      result: this.result,
      displayResult: this.displayResult,
      createdAt: this.createdAt.toISOString(),
    };
  }

  toJSON(): Calculation {
    return this.toDto();
  }
}

export interface CalculationRecordProperties {
  readonly id: string;
  readonly expression: string;
  readonly displayExpression: string;
  readonly result: string;
  readonly displayResult: string;
  readonly createdAt: Date;
}

/**
 * The fields a caller supplies when appending to history.
 *
 * `id` and `createdAt` are optional so that the store can own identity and
 * clock concerns by default, while tests can still pin both for determinism.
 */
export interface NewCalculationRecord {
  readonly expression: string;
  readonly displayExpression: string;
  readonly result: string;
  readonly displayResult: string;
  readonly id?: string;
  readonly createdAt?: Date;
}
