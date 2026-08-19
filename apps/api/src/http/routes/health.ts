import { ApiRoutes, type HealthResponse } from '@calc/contracts';
import type { FastifyInstance } from 'fastify';

import type { CalculationService } from '../../services/calculation-service';

export interface HealthRouteOptions {
  readonly service: CalculationService;
  readonly version: string;
}

/**
 * Health endpoint.
 *
 * Reports `degraded` rather than failing outright when the history store is
 * unreachable: expression evaluation is pure and still works, so the service is
 * partially useful and an orchestrator should not necessarily restart it.
 */
export async function registerHealthRoute(
  app: FastifyInstance,
  options: HealthRouteOptions,
): Promise<void> {
  const { service, version } = options;

  app.get(ApiRoutes.health, async (_request, reply) => {
    const historyStoreIsLive = await service.checkHistoryStore();

    const response: HealthResponse = {
      status: historyStoreIsLive ? 'ok' : 'degraded',
      version,
      uptimeSeconds: Math.round(process.uptime()),
      dependencies: {
        historyStore: historyStoreIsLive ? 'ok' : 'unavailable',
      },
    };

    return reply.status(historyStoreIsLive ? 200 : 503).send(response);
  });
}
