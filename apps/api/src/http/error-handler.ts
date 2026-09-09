import {
  ApiErrorCode,
  isValidationError,
  toValidationIssues,
  type ApiError,
} from '@calc/contracts';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isCodedError, statusForCode } from './errors';

/**
 * Registers the single error hook every failed request funnels through.
 *
 * Two rules hold here:
 *  - every error response uses the shared envelope, so clients have one shape
 *    to parse;
 *  - nothing unexpected reaches the client. Unrecognised errors are logged in
 *    full and answered with a generic 500 carrying only the request id.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  // Fastify types the handler's error as `unknown` by default; it always hands
  // over a FastifyError, so pin the generic rather than casting inside.
  app.setErrorHandler<FastifyError>((error, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.id;

    if (isValidationError(error)) {
      return reply.status(400).send(
        envelope(ApiErrorCode.VALIDATION_FAILED, 'Request failed validation', requestId, {
          issues: toValidationIssues(error),
        }),
      );
    }

    if (isCodedError(error)) {
      const status = statusForCode(error.code);

      // Client errors are expected traffic; log them at debug to keep the
      // signal-to-noise ratio of the error log usable. Anything mapping to 5xx
      // is a genuine fault and is logged as one.
      const log = status >= 500 ? request.log.error : request.log.debug;
      log.call(request.log, { err: error, code: error.code }, 'Request rejected');

      return reply
        .status(status)
        .send(envelope(error.code, error.message, requestId, error.details));
    }

    if (error.statusCode === 429) {
      return reply
        .status(429)
        .send(envelope(ApiErrorCode.RATE_LIMITED, 'Too many requests', requestId));
    }

    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      return reply
        .status(error.statusCode)
        .send(envelope(ApiErrorCode.VALIDATION_FAILED, error.message, requestId));
    }

    request.log.error({ err: error }, 'Unhandled error while serving request');

    return reply
      .status(500)
      .send(envelope(ApiErrorCode.INTERNAL_ERROR, 'An unexpected error occurred', requestId));
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) =>
    reply
      .status(404)
      .send(
        envelope(
          ApiErrorCode.NOT_FOUND,
          `Route ${request.method} ${request.url} not found`,
          request.id,
        ),
      ),
  );
}

function envelope(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  details?: unknown,
): ApiError {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details === undefined ? {} : { details }),
    },
  };
}
