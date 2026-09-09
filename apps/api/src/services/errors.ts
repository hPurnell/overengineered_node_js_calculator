import { ApiErrorCode } from '@calc/contracts';

/**
 * A failure raised by the service layer.
 *
 * Carries an {@link ApiErrorCode} describing *what went wrong*, and
 * deliberately not an HTTP status describing *how to report it*. Choosing a
 * status is the transport's decision, and keeping it out of here is what lets
 * the service layer stay free of any dependency on `http/`.
 */
export class ServiceError extends Error {
  readonly code: ApiErrorCode;
  /** Optional structured context surfaced to the client. */
  readonly details: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    options?: { details?: unknown; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.details = options?.details;
    Error.captureStackTrace?.(this, new.target);
  }

  static notFound(message: string): ServiceError {
    return new ServiceError(ApiErrorCode.NOT_FOUND, message);
  }

  static invalidRequest(message: string, details?: unknown): ServiceError {
    return new ServiceError(ApiErrorCode.VALIDATION_FAILED, message, { details });
  }
}

export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError;
}
