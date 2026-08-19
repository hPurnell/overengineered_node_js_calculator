import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import type { HistoryStore } from './persistence';

import type { AppConfig } from './config/environment';
import { registerErrorHandler } from './http/error-handler';
import { registerCalculationRoutes } from './http/routes/calculations';
import { registerHealthRoute } from './http/routes/health';
import { CalculationService } from './services/calculation-service';

const PACKAGE_VERSION = '1.0.0';

export interface BuildAppOptions {
  readonly config: AppConfig;
  /**
   * The history store the API should use.
   *
   * Injected rather than constructed here so tests can hand in an in-memory
   * store, and so the composition root owns the store's lifecycle.
   */
  readonly historyStore: HistoryStore;
}

/**
 * Builds a fully wired Fastify instance without listening on a port.
 *
 * Separating construction from binding is what makes the API testable with
 * `app.inject()` — no sockets, no port conflicts, no teardown races.
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, historyStore } = options;

  const app = Fastify({
    logger: buildLoggerOptions(config),
    // Trust the reverse proxy in production so rate limiting and logs see the
    // real client address rather than the proxy's.
    trustProxy: config.isProduction,
    bodyLimit: 64 * 1024,
  });

  await app.register(helmet, {
    // The API serves JSON only; CSP is the web app's concern.
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? [...config.corsOrigins] : false,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: false,
    maxAge: 86_400,
  });

  await app.register(rateLimit, {
    max: config.rateLimitPerMinute,
    timeWindow: '1 minute',
  });

  registerErrorHandler(app);

  const service = new CalculationService({ historyStore });

  await registerHealthRoute(app, { service, version: PACKAGE_VERSION });
  await registerCalculationRoutes(app, { service, config });

  return app;
}

function buildLoggerOptions(config: AppConfig) {
  if (config.nodeEnv === 'test') {
    return false;
  }

  return {
    level: config.logLevel,
    // Structured JSON in production; human-readable while developing.
    ...(config.isProduction
      ? {}
      : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie'],
      remove: true,
    },
  };
}
