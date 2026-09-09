/**
 * Stable, machine-readable error codes returned by the computation API.
 *
 * These are part of the public contract: clients switch on them to render
 * the correct message, so values must never be renamed without a version bump.
 */
export const ApiErrorCode = {
  /** The request body failed schema validation. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** The expression could not be tokenized or parsed. */
  INVALID_EXPRESSION: 'INVALID_EXPRESSION',
  /** The expression parsed, but evaluating it divided by zero. */
  DIVISION_BY_ZERO: 'DIVISION_BY_ZERO',
  /** The expression parsed, but the result is not a finite number. */
  UNDEFINED_RESULT: 'UNDEFINED_RESULT',
  /** The expression exceeded a configured safety limit (length, depth, ...). */
  EXPRESSION_TOO_COMPLEX: 'EXPRESSION_TOO_COMPLEX',
  /** The requested resource does not exist. */
  NOT_FOUND: 'NOT_FOUND',
  /** Too many requests from this client. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Anything unexpected. Never leaks internal detail to the client. */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];
