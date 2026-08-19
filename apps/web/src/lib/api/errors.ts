import { API_ERROR_DISPLAY_TEXT, ApiErrorCode } from '@calc/contracts';

/**
 * A failed API call, normalised so the UI has one error type to handle whether
 * the failure came from the server, the network, or a malformed response.
 */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  /** HTTP status, or `0` when the request never reached the server. */
  readonly status: number;
  /** Copy to put on the calculator readout, in Apple's voice. */
  readonly displayText: string;
  readonly requestId: string | undefined;

  constructor(options: {
    code: ApiErrorCode;
    message: string;
    status: number;
    requestId?: string | undefined;
    cause?: unknown;
  }) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ApiClientError';
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.displayText = API_ERROR_DISPLAY_TEXT[options.code];
  }

  /** True when the request never completed, as opposed to being rejected. */
  get isNetworkFailure(): boolean {
    return this.status === 0;
  }

  static network(cause: unknown): ApiClientError {
    return new ApiClientError({
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'The computation service is unreachable',
      status: 0,
      cause,
    });
  }
}
