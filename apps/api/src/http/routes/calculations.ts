import {
  ApiRoutes,
  evaluateCalculationRequestSchema,
  listCalculationsQuerySchema,
  type ClearCalculationsResponse,
  type EvaluateCalculationResponse,
  type ListCalculationsResponse,
} from '@calc/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AppConfig } from '../../config/environment';
import type { CalculationService } from '../../services/calculation-service';

const calculationIdParamsSchema = z.object({
  id: z.string().uuid('Calculation id must be a UUID'),
});

export interface CalculationRoutesOptions {
  readonly service: CalculationService;
  readonly config: AppConfig;
}

/**
 * Calculation and history routes.
 *
 * Handlers stay thin on purpose: parse with the shared contract schema, call
 * the service, send the result. Validation failures throw `ZodError`, which the
 * error hook renders; no handler builds an error response itself.
 */
export async function registerCalculationRoutes(
  app: FastifyInstance,
  options: CalculationRoutesOptions,
): Promise<void> {
  const { service, config } = options;

  /** Evaluate an expression and record it in history. */
  app.post(ApiRoutes.calculations, async (request, reply) => {
    const body = evaluateCalculationRequestSchema.parse(request.body);
    const calculation = await service.evaluate(body);

    const response: EvaluateCalculationResponse = { calculation };
    return reply.status(201).send(response);
  });

  /** Read a page of history, newest first. */
  app.get(ApiRoutes.calculations, async (request, reply) => {
    const query = listCalculationsQuerySchema
      // The deployment may cap pages below the contract's ceiling.
      .refine((value) => value.limit <= config.historyPageMaxSize, {
        message: `limit must not exceed ${config.historyPageMaxSize}`,
        path: ['limit'],
      })
      .parse(request.query);

    const response: ListCalculationsResponse = await service.listHistory(query);
    return reply.status(200).send(response);
  });

  /** Delete the entire history. */
  app.delete(ApiRoutes.calculations, async (_request, reply) => {
    const deleted = await service.clearHistory();

    const response: ClearCalculationsResponse = { deleted };
    return reply.status(200).send(response);
  });

  /** Delete a single history entry. */
  app.delete(`${ApiRoutes.calculations}/:id`, async (request, reply) => {
    const { id } = calculationIdParamsSchema.parse(request.params);
    await service.deleteHistoryEntry(id);

    return reply.status(204).send();
  });
}
