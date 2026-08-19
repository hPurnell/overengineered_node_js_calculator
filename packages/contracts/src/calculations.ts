import { z } from 'zod';

import {
  EXPRESSION_MAX_LENGTH,
  HISTORY_PAGE_DEFAULT_SIZE,
  HISTORY_PAGE_MAX_SIZE,
} from './limits';

/**
 * A canonical, machine-oriented infix expression.
 *
 * The client renders Apple's glyphs (`×`, `÷`, `−`) but always transmits the
 * ASCII form so the grammar the server parses stays small and unambiguous.
 */
export const expressionSchema = z
  .string()
  .trim()
  .min(1, 'Expression must not be empty')
  .max(EXPRESSION_MAX_LENGTH, `Expression must be at most ${EXPRESSION_MAX_LENGTH} characters`);

/**
 * Request body for `POST /api/v1/calculations`.
 *
 * `displayExpression` is presentation-only: it is persisted verbatim so the
 * history panel can echo exactly what the user saw, but it is never parsed.
 */
export const evaluateCalculationRequestSchema = z.object({
  expression: expressionSchema,
  displayExpression: z.string().trim().max(EXPRESSION_MAX_LENGTH).optional(),
});

export type EvaluateCalculationRequest = z.infer<typeof evaluateCalculationRequestSchema>;

/** A single persisted calculation, as seen over the wire. */
export const calculationSchema = z.object({
  /** Server-assigned identifier (UUID v4). */
  id: z.string().uuid(),
  /** The canonical ASCII expression that was evaluated. */
  expression: z.string(),
  /** The expression as it appeared on screen, using Apple's operator glyphs. */
  displayExpression: z.string(),
  /** Full-precision decimal result, as a string to avoid IEEE-754 round-tripping. */
  result: z.string(),
  /** Result formatted for the calculator display (grouping, scientific notation). */
  displayResult: z.string(),
  /** ISO-8601 timestamp, always UTC. */
  createdAt: z.string().datetime(),
});

export type Calculation = z.infer<typeof calculationSchema>;

/** Response body for `POST /api/v1/calculations`. */
export const evaluateCalculationResponseSchema = z.object({
  calculation: calculationSchema,
});

export type EvaluateCalculationResponse = z.infer<typeof evaluateCalculationResponseSchema>;

/** Query parameters for `GET /api/v1/calculations`. */
export const listCalculationsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(HISTORY_PAGE_MAX_SIZE)
    .default(HISTORY_PAGE_DEFAULT_SIZE),
  /** Opaque forward-only cursor returned by a previous page. */
  cursor: z.string().min(1).optional(),
});

export type ListCalculationsQuery = z.infer<typeof listCalculationsQuerySchema>;

/** Response body for `GET /api/v1/calculations`. Newest entry first. */
export const listCalculationsResponseSchema = z.object({
  items: z.array(calculationSchema),
  /** Cursor for the next page, or `null` when the end has been reached. */
  nextCursor: z.string().nullable(),
});

export type ListCalculationsResponse = z.infer<typeof listCalculationsResponseSchema>;

/** Response body for `DELETE /api/v1/calculations`. */
export const clearCalculationsResponseSchema = z.object({
  deleted: z.number().int().nonnegative(),
});

export type ClearCalculationsResponse = z.infer<typeof clearCalculationsResponseSchema>;
