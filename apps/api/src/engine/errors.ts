import { ApiErrorCode } from '@calc/contracts';

/**
 * Base class for every failure the engine raises deliberately.
 *
 * Each subclass carries the {@link ApiErrorCode} the transport layer should
 * surface, so the HTTP layer never has to pattern-match on messages.
 */
export abstract class CalculationError extends Error {
  abstract readonly code: ApiErrorCode;

  /** Zero-based offset into the source expression, when known. */
  readonly position: number | undefined;

  protected constructor(message: string, position?: number) {
    super(message);
    this.name = new.target.name;
    this.position = position;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** The expression contains a character or token sequence the grammar rejects. */
export class InvalidExpressionError extends CalculationError {
  readonly code = ApiErrorCode.INVALID_EXPRESSION;

  constructor(message: string, position?: number) {
    super(message, position);
  }
}

/** The expression is well-formed but breaches a configured safety limit. */
export class ExpressionTooComplexError extends CalculationError {
  readonly code = ApiErrorCode.EXPRESSION_TOO_COMPLEX;

  constructor(message: string, position?: number) {
    super(message, position);
  }
}

/** Evaluation attempted to divide by zero. */
export class DivisionByZeroError extends CalculationError {
  readonly code = ApiErrorCode.DIVISION_BY_ZERO;

  constructor(message = 'Division by zero', position?: number) {
    super(message, position);
  }
}

/** Evaluation produced a non-finite value (overflow, 0/0, ...). */
export class UndefinedResultError extends CalculationError {
  readonly code = ApiErrorCode.UNDEFINED_RESULT;

  constructor(message = 'Result is not a finite number', position?: number) {
    super(message, position);
  }
}

export function isCalculationError(error: unknown): error is CalculationError {
  return error instanceof CalculationError;
}
