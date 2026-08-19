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

/**
 * Human-facing fallback copy for each error code.
 *
 * The web client prefers these over the server-supplied `message` so the UI
 * stays in the calculator's voice ("Not a number") rather than the engine's
 * voice ("division by zero at offset 4").
 */
export const API_ERROR_DISPLAY_TEXT: Record<ApiErrorCode, string> = {
  [ApiErrorCode.VALIDATION_FAILED]: 'Error',
  [ApiErrorCode.INVALID_EXPRESSION]: 'Error',
  [ApiErrorCode.DIVISION_BY_ZERO]: 'Not a number',
  [ApiErrorCode.UNDEFINED_RESULT]: 'Not a number',
  [ApiErrorCode.EXPRESSION_TOO_COMPLEX]: 'Error',
  [ApiErrorCode.NOT_FOUND]: 'Error',
  [ApiErrorCode.RATE_LIMITED]: 'Error',
  [ApiErrorCode.INTERNAL_ERROR]: 'Error',
};
