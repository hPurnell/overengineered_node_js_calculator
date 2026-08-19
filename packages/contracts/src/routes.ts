/**
 * Canonical API paths.
 *
 * The client builds every URL from these constants so a route rename is a
 * compile-time break rather than a runtime 404.
 */
export const API_VERSION = 'v1' as const;

export const ApiRoutes = {
  health: '/health',
  calculations: `/api/${API_VERSION}/calculations`,
  calculationById: (id: string) => `/api/${API_VERSION}/calculations/${encodeURIComponent(id)}`,
} as const;
