import { z } from 'zod';

import { HISTORY_PAGE_MAX_SIZE } from '@calc/contracts';

/**
 * Environment schema.
 *
 * Parsed once at boot and never read from `process.env` again, so a missing or
 * malformed variable fails the process immediately instead of surfacing as a
 * confusing runtime error under load.
 */
const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(0).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Comma-separated allow-list of browser origins. */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  HISTORY_STORE_URL: z.string().min(1).default('file:./data/calculator.db'),
  HISTORY_STORE_AUTO_MIGRATE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  HISTORY_PAGE_MAX_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(HISTORY_PAGE_MAX_SIZE)
    .default(HISTORY_PAGE_MAX_SIZE),

  /** Requests allowed per client per minute. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(600),
});

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly isProduction: boolean;
  readonly host: string;
  readonly port: number;
  readonly logLevel: string;
  readonly corsOrigins: readonly string[];
  readonly historyStore: {
    readonly url: string;
    readonly autoMigrate: boolean;
  };
  readonly historyPageMaxSize: number;
  readonly rateLimitPerMinute: number;
}

/**
 * Validates the environment and projects it onto the shape the app consumes.
 *
 * @throws {Error} with every failing variable listed, rather than only the first.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const environment = parsed.data;

  return {
    nodeEnv: environment.NODE_ENV,
    isProduction: environment.NODE_ENV === 'production',
    host: environment.API_HOST,
    port: environment.API_PORT,
    logLevel: environment.LOG_LEVEL,
    corsOrigins: environment.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    historyStore: {
      url: environment.HISTORY_STORE_URL,
      autoMigrate: environment.HISTORY_STORE_AUTO_MIGRATE,
    },
    historyPageMaxSize: environment.HISTORY_PAGE_MAX_SIZE,
    rateLimitPerMinute: environment.RATE_LIMIT_PER_MINUTE,
  };
}
