import { z } from 'zod';

/** Response body for `GET /health`. */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  /** Package version of the running API. */
  version: z.string(),
  /** Process uptime in seconds. */
  uptimeSeconds: z.number().nonnegative(),
  /** Liveness of each downstream dependency. */
  dependencies: z.record(z.enum(['ok', 'unavailable'])),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
