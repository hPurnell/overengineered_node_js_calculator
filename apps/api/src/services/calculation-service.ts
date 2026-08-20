import { compute, isCalculationError } from '../engine';
import type {
  Calculation,
  EvaluateCalculationRequest,
  ListCalculationsQuery,
  ListCalculationsResponse,
} from '@calc/contracts';
import { InvalidCursorError, type HistoryStore } from '../persistence';
import { ApiErrorCode } from '@calc/contracts';

import { HttpError } from '../domain/errors';

export interface CalculationServiceDependencies {
  readonly historyStore: HistoryStore;
}

/**
 * The computation service.
 *
 * Owns the use cases the API exposes: evaluate an expression (and record it),
 * and read back or prune the history. It depends on the {@link HistoryStore}
 * port, so it has no idea where history is kept.
 *
 * Engine failures are translated into {@link HttpError} here rather than in the
 * route handlers, keeping HTTP concerns in one layer and leaving handlers as
 * thin adapters.
 */
export class CalculationService {
  private readonly historyStore: HistoryStore;

  constructor(dependencies: CalculationServiceDependencies) {
    this.historyStore = dependencies.historyStore;
  }

  /**
   * Evaluates an expression and appends it to history.
   *
   * The calculation is persisted only after it evaluates successfully: a
   * division by zero is a user error, not something worth keeping.
   */
  async evaluate(request: EvaluateCalculationRequest): Promise<Calculation> {
    const { expression } = request;
    const displayExpression = request.displayExpression?.trim() || expression;

    let computation: ReturnType<typeof compute>;
    try {
      computation = compute(expression);
    } catch (error) {
      throw this.toHttpError(error, expression);
    }

    const record = await this.historyStore.append({
      expression,
      displayExpression,
      result: computation.result,
      displayResult: computation.displayResult,
    });

    return record.toDto();
  }

  /** Returns a page of history, newest first. */
  async listHistory(query: ListCalculationsQuery): Promise<ListCalculationsResponse> {
    try {
      const page = await this.historyStore.list({ limit: query.limit, cursor: query.cursor });

      return {
        items: page.items.map((record) => record.toDto()),
        nextCursor: page.nextCursor,
      };
    } catch (error) {
      if (error instanceof InvalidCursorError) {
        throw HttpError.badRequest(ApiErrorCode.VALIDATION_FAILED, error.message);
      }
      throw error;
    }
  }

  /** Deletes the entire history and returns how many entries were removed. */
  async clearHistory(): Promise<number> {
    return this.historyStore.clear();
  }

  /** Deletes one history entry. */
  async deleteHistoryEntry(id: string): Promise<void> {
    const deleted = await this.historyStore.deleteById(id);
    if (!deleted) {
      throw HttpError.notFound(`No calculation with id ${id}`);
    }
  }

  /** Liveness of the service's dependencies, for the health endpoint. */
  async checkHistoryStore(): Promise<boolean> {
    return this.historyStore.ping();
  }

  /**
   * Maps an engine failure onto the right HTTP status.
   *
   * A malformed expression is a 400 (the client sent something it should have
   * caught); a valid expression that cannot be evaluated is a 422.
   */
  private toHttpError(error: unknown, expression: string): HttpError {
    if (!isCalculationError(error)) {
      return new HttpError(500, ApiErrorCode.INTERNAL_ERROR, 'Failed to evaluate expression', {
        cause: error,
      });
    }

    const details = {
      expression,
      ...(error.position === undefined ? {} : { position: error.position }),
    };

    switch (error.code) {
      case ApiErrorCode.DIVISION_BY_ZERO:
      case ApiErrorCode.UNDEFINED_RESULT:
        return HttpError.unprocessable(error.code, error.message, details);
      default:
        return HttpError.badRequest(error.code, error.message, details);
    }
  }
}
