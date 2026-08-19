import {
  ApiErrorCode,
  ApiRoutes,
  apiErrorSchema,
  clearCalculationsResponseSchema,
  evaluateCalculationResponseSchema,
  listCalculationsResponseSchema,
  type Calculation,
  type EvaluateCalculationRequest,
  type ListCalculationsResponse,
} from '@calc/contracts';
import { z } from 'zod';

import { ApiClientError } from './errors';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Base URL of the computation API.
 *
 * Read from the environment at build time. The web app never falls back to a
 * same-origin route: computation lives in a separate service by design, and a
 * silent fallback would hide a misconfigured deployment.
 */
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  '',
);

export interface RequestOptions {
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number | undefined;
}

/** Evaluates an expression and records it in history. */
export async function evaluateExpression(
  request: EvaluateCalculationRequest,
  options: RequestOptions = {},
): Promise<Calculation> {
  const response = await send(
    ApiRoutes.calculations,
    { method: 'POST', body: JSON.stringify(request) },
    options,
  );

  return parse(evaluateCalculationResponseSchema, await readJson(response)).calculation;
}

/** Reads a page of history, newest first. */
export async function fetchHistory(
  params: { limit?: number; cursor?: string | undefined } = {},
  options: RequestOptions = {},
): Promise<ListCalculationsResponse> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) {
    query.set('limit', String(params.limit));
  }
  if (params.cursor !== undefined) {
    query.set('cursor', params.cursor);
  }

  const queryString = query.toString();
  const suffix = queryString.length > 0 ? `?${queryString}` : '';
  const response = await send(`${ApiRoutes.calculations}${suffix}`, { method: 'GET' }, options);

  return parse(listCalculationsResponseSchema, await readJson(response));
}

/** Deletes the whole history and returns how many entries were removed. */
export async function clearHistory(options: RequestOptions = {}): Promise<number> {
  const response = await send(ApiRoutes.calculations, { method: 'DELETE' }, options);

  return parse(clearCalculationsResponseSchema, await readJson(response)).deleted;
}

/** Deletes a single history entry. */
export async function deleteCalculation(
  id: string,
  options: RequestOptions = {},
): Promise<void> {
  await send(ApiRoutes.calculationById(id), { method: 'DELETE' }, options);
}

/**
 * Performs the request and converts every failure mode into an
 * {@link ApiClientError}.
 *
 * A caller-supplied abort signal is combined with a timeout so a hung service
 * cannot leave the calculator stuck on "computing" forever.
 */
async function send(
  path: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (options.signal !== undefined) {
    signals.push(options.signal);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...init.headers,
      },
      signal: AbortSignal.any(signals),
    });
  } catch (cause) {
    // An abort the caller requested is control flow, not an error to report.
    if (options.signal?.aborted === true) {
      throw cause;
    }
    throw ApiClientError.network(cause);
  }

  if (!response.ok) {
    throw await toApiClientError(response);
  }

  return response;
}

/** Rebuilds the server's error envelope, degrading gracefully if it is absent. */
async function toApiClientError(response: Response): Promise<ApiClientError> {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = apiErrorSchema.safeParse(body);

  if (parsed.success) {
    return new ApiClientError({
      code: parsed.data.error.code,
      message: parsed.data.error.message,
      status: response.status,
      requestId: parsed.data.error.requestId,
    });
  }

  return new ApiClientError({
    code: response.status === 429 ? ApiErrorCode.RATE_LIMITED : ApiErrorCode.INTERNAL_ERROR,
    message: `Request failed with status ${response.status}`,
    status: response.status,
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch (cause) {
    throw new ApiClientError({
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'The computation service returned a malformed response',
      status: response.status,
      cause,
    });
  }
}

/**
 * Validates a response against its contract schema.
 *
 * The server is trusted but not assumed correct: validating here turns a
 * contract drift into one clear error instead of a scattering of `undefined`s
 * deep in the component tree.
 */
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiClientError({
      code: ApiErrorCode.INTERNAL_ERROR,
      message: `Response did not match the expected contract: ${result.error.message}`,
      status: 200,
    });
  }

  return result.data;
}
