import { ApiErrorCode } from '@calc/contracts';

/**
 * Human-facing copy for each API error code.
 *
 * The client prefers these over the server-supplied `message` so the readout
 * stays in the calculator's voice ("Not a number") rather than the engine's
 * ("division by zero at offset 4").
 *
 * This is presentation, so it lives in the web app rather than in
 * `@calc/contracts`: the codes are the contract, the wording is not. A copy
 * change here is not an API change, and a second consumer of the API is free
 * to phrase these differently — or translate them.
 */
export const API_ERROR_DISPLAY_TEXT: Readonly<Record<ApiErrorCode, string>> = {
  [ApiErrorCode.VALIDATION_FAILED]: 'Error',
  [ApiErrorCode.INVALID_EXPRESSION]: 'Error',
  [ApiErrorCode.DIVISION_BY_ZERO]: 'Not a number',
  [ApiErrorCode.UNDEFINED_RESULT]: 'Not a number',
  [ApiErrorCode.EXPRESSION_TOO_COMPLEX]: 'Error',
  [ApiErrorCode.NOT_FOUND]: 'Error',
  [ApiErrorCode.RATE_LIMITED]: 'Error',
  [ApiErrorCode.INTERNAL_ERROR]: 'Error',
};

/** The copy to put on the readout for an error code. */
export function displayTextForCode(code: ApiErrorCode): string {
  return API_ERROR_DISPLAY_TEXT[code];
}
