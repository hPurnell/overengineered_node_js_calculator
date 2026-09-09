import { ApiErrorCode } from '@calc/contracts';

/**
 * How each error code is reported over HTTP.
 *
 * This table is the transport layer's business and lives here alone. Lower
 * layers raise an {@link ApiErrorCode} saying what went wrong; only this map
 * decides the status that carries it.
 *
 * The 400/422 split is the interesting one: a malformed expression is a 400
 * (the client sent something it should have caught), whereas a well-formed
 * expression that cannot be evaluated — dividing by zero — is a 422.
 */
export const STATUS_BY_ERROR_CODE: Readonly<Record<ApiErrorCode, number>> = {
  [ApiErrorCode.VALIDATION_FAILED]: 400,
  [ApiErrorCode.INVALID_EXPRESSION]: 400,
  [ApiErrorCode.EXPRESSION_TOO_COMPLEX]: 400,
  [ApiErrorCode.DIVISION_BY_ZERO]: 422,
  [ApiErrorCode.UNDEFINED_RESULT]: 422,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.RATE_LIMITED]: 429,
  [ApiErrorCode.INTERNAL_ERROR]: 500,
};

/** An error from any layer that already says which API error code it is. */
export interface CodedError {
  readonly code: ApiErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * Recognises an error that carries an API error code.
 *
 * Matched structurally rather than by class so this module needs no import
 * from `engine/`, `persistence/` or `services/`: the HTTP layer stays a leaf
 * that everything reports *into*, rather than one that reaches back out.
 */
export function isCodedError(error: unknown): error is CodedError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && Object.hasOwn(STATUS_BY_ERROR_CODE, code);
}

/** The status to report an error code with. */
export function statusForCode(code: ApiErrorCode): number {
  return STATUS_BY_ERROR_CODE[code];
}
