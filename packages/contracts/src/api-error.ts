import { z } from 'zod';

import { ApiErrorCode } from './errors';

/**
 * The single error envelope every non-2xx API response uses.
 *
 * Keeping one shape means the client has exactly one branch to handle, and
 * `details` is the only place free-form data may appear.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.nativeEnum(ApiErrorCode),
    /** Developer-facing summary. Not intended for end users. */
    message: z.string(),
    /** Optional structured context, e.g. per-field validation issues. */
    details: z.unknown().optional(),
    /** Correlates the response with a server log line. */
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
