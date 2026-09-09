import { compute, isCalculationError } from '../engine';
import type {
  Calculation,
  EvaluateCalculationRequest,
  ListCalculationsQuery,
  ListCalculationsResponse,
} from '@calc/contracts';
import { InvalidCursorError, type HistoryStore } from '../persistence';
import { ApiErrorCode } from '@calc/contracts';

import { ServiceError } from './errors';

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
 * Engine and store failures are translated into {@link ServiceError} here, so
 * every caller sees one error vocabulary. The errors say what went wrong; the
 * HTTP layer alone decides what status reports them.
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
      throw this.toServiceError(error, expression);
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
        throw ServiceError.invalidRequest(error.message);
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
      throw ServiceError.notFound(`No calculation with id ${id}`);
    }
  }

  /** Liveness of the service's dependencies, for the health endpoint. */
  async checkHistoryStore(): Promise<boolean> {
    return this.historyStore.ping();
  }

  /**
   * Restates an engine failure in the service's own error vocabulary.
   *
   * The engine's error already carries the right {@link ApiErrorCode}; this
   * adds the offending expression as context and drops the engine type, so
   * callers depend on one error shape rather than on the engine's.
   */
  private toServiceError(error: unknown, expression: string): ServiceError {
    if (!isCalculationError(error)) {
      return new ServiceError(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to evaluate expression',
        { cause: error },
      );
    }

    return new ServiceError(error.code, error.message, {
      details: {
        expression,
        ...(error.position === undefined ? {} : { position: error.position }),
      },
    });
  }
}
