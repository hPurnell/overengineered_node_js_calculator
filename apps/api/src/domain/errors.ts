import { ApiErrorCode } from '@calc/contracts';

/**
 * An error that carries the HTTP status and API error code it should surface as.
 *
 * Handlers throw these; a single error hook translates them into the shared
 * error envelope. Nothing in the routing layer builds error responses by hand.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    options?: { details?: unknown; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
    Error.captureStackTrace?.(this, new.target);
  }

  static badRequest(code: ApiErrorCode, message: string, details?: unknown): HttpError {
    return new HttpError(400, code, message, { details });
  }

  /**
   * 422: the request was well-formed and understood, but could not be
   * processed — a syntactically valid expression that divides by zero, say.
   */
  static unprocessable(code: ApiErrorCode, message: string, details?: unknown): HttpError {
    return new HttpError(422, code, message, { details });
  }

  static notFound(message: string): HttpError {
    return new HttpError(404, ApiErrorCode.NOT_FOUND, message);
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
