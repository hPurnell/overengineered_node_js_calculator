import { ApiErrorCode, ApiRoutes } from '@calc/contracts';
import { createHistoryStore, type HistoryStore } from '../src/persistence';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app';
import { loadConfig, type AppConfig } from '../src/config/environment';

/**
 * Integration tests exercise the fully wired app through `inject()`: real
 * routing, real validation, real service, real (in-memory) store. Only the
 * network is stubbed out.
 */
let app: FastifyInstance;
let historyStore: HistoryStore;

const config: AppConfig = loadConfig({
  NODE_ENV: 'test',
  HISTORY_STORE_URL: ':memory:',
  CORS_ORIGINS: 'http://localhost:3000',
});

// The return type is annotated deliberately. `inject` is overloaded, and an
// argument TypeScript cannot match — an `unknown` payload, here — makes it fall
// back to an intersection that includes `void`, so `await` stops unwrapping and
// every `response.statusCode` downstream fails to resolve.
const evaluate = (body: unknown): Promise<LightMyRequestResponse> =>
  app.inject({
    method: 'POST',
    url: ApiRoutes.calculations,
    payload: body as InjectOptions['payload'],
  });

beforeEach(async () => {
  historyStore = createHistoryStore({ url: ':memory:' });
  app = await buildApp({ config, historyStore });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  await historyStore.close();
});

describe('POST /api/v1/calculations', () => {
  it('evaluates an expression and returns the persisted calculation', async () => {
    const response = await evaluate({ expression: '2+3*4', displayExpression: '2 + 3 × 4' });

    expect(response.statusCode).toBe(201);
    expect(response.json().calculation).toMatchObject({
      expression: '2+3*4',
      displayExpression: '2 + 3 × 4',
      result: '14',
      displayResult: '14',
    });
    expect(response.json().calculation.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('falls back to the canonical expression when no display form is sent', async () => {
    const response = await evaluate({ expression: '7*6' });

    expect(response.json().calculation.displayExpression).toBe('7*6');
  });

  it('formats the result for the display', async () => {
    const response = await evaluate({ expression: '1000000*1000' });

    expect(response.json().calculation).toMatchObject({
      result: '1000000000',
      displayResult: '1,000,000,000',
    });
  });

  it('returns 400 for a malformed expression', async () => {
    const response = await evaluate({ expression: '2++' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe(ApiErrorCode.INVALID_EXPRESSION);
    expect(response.json().error.requestId).toBeTruthy();
  });

  it('returns 422 for division by zero', async () => {
    const response = await evaluate({ expression: '1/0' });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe(ApiErrorCode.DIVISION_BY_ZERO);
  });

  it('returns 400 when the body fails schema validation', async () => {
    const missing = await evaluate({});
    const empty = await evaluate({ expression: '   ' });
    const wrongType = await evaluate({ expression: 42 });

    for (const response of [missing, empty, wrongType]) {
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
    }
  });

  it('does not record calculations that failed to evaluate', async () => {
    await evaluate({ expression: '1/0' });
    await evaluate({ expression: 'nonsense' });

    const history = await app.inject({ method: 'GET', url: ApiRoutes.calculations });
    expect(history.json().items).toHaveLength(0);
  });
});

describe('GET /api/v1/calculations', () => {
  it('returns history newest first', async () => {
    await evaluate({ expression: '1+1' });
    await evaluate({ expression: '2+2' });
    await evaluate({ expression: '3+3' });

    const response = await app.inject({ method: 'GET', url: ApiRoutes.calculations });

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((item: { expression: string }) => item.expression)).toEqual([
      '3+3',
      '2+2',
      '1+1',
    ]);
    expect(response.json().nextCursor).toBeNull();
  });

  it('pages with an opaque cursor', async () => {
    for (let index = 0; index < 5; index += 1) {
      await evaluate({ expression: `${index}+0` });
    }

    const first = await app.inject({ method: 'GET', url: `${ApiRoutes.calculations}?limit=2` });
    expect(first.json().items).toHaveLength(2);
    expect(first.json().nextCursor).toBeTypeOf('string');

    const second = await app.inject({
      method: 'GET',
      url: `${ApiRoutes.calculations}?limit=2&cursor=${encodeURIComponent(first.json().nextCursor)}`,
    });

    const firstIds = first.json().items.map((item: { id: string }) => item.id);
    const secondIds = second.json().items.map((item: { id: string }) => item.id);
    expect(secondIds).toHaveLength(2);
    expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false);
  });

  it('rejects a limit above the configured maximum', async () => {
    const response = await app.inject({ method: 'GET', url: `${ApiRoutes.calculations}?limit=5000` });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe(ApiErrorCode.VALIDATION_FAILED);
  });

  it('rejects a malformed cursor', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${ApiRoutes.calculations}?cursor=%21%21%21not-a-cursor`,
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('DELETE /api/v1/calculations', () => {
  it('clears the history and reports the count', async () => {
    await evaluate({ expression: '1+1' });
    await evaluate({ expression: '2+2' });

    const response = await app.inject({ method: 'DELETE', url: ApiRoutes.calculations });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted: 2 });

    const history = await app.inject({ method: 'GET', url: ApiRoutes.calculations });
    expect(history.json().items).toHaveLength(0);
  });

  it('deletes a single entry', async () => {
    const created = await evaluate({ expression: '9+9' });
    const { id } = created.json().calculation;

    const response = await app.inject({ method: 'DELETE', url: ApiRoutes.calculationById(id) });
    expect(response.statusCode).toBe(204);

    const repeat = await app.inject({ method: 'DELETE', url: ApiRoutes.calculationById(id) });
    expect(repeat.statusCode).toBe(404);
    expect(repeat.json().error.code).toBe(ApiErrorCode.NOT_FOUND);
  });

  it('rejects a non-UUID id', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `${ApiRoutes.calculations}/not-a-uuid`,
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('cross-cutting concerns', () => {
  it('serves health with dependency status', async () => {
    const response = await app.inject({ method: 'GET', url: ApiRoutes.health });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      dependencies: { historyStore: 'ok' },
    });
  });

  it('reports degraded health when the store is unreachable', async () => {
    await historyStore.close();

    const response = await app.inject({ method: 'GET', url: ApiRoutes.health });

    expect(response.statusCode).toBe(503);
    expect(response.json().status).toBe('degraded');
  });

  it('answers unknown routes with the shared error envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe(ApiErrorCode.NOT_FOUND);
  });

  it('allows the configured origin and omits the header for others', async () => {
    const allowed = await app.inject({
      method: 'GET',
      url: ApiRoutes.calculations,
      headers: { origin: 'http://localhost:3000' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    const denied = await app.inject({
      method: 'GET',
      url: ApiRoutes.calculations,
      headers: { origin: 'http://evil.example' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sets security headers', async () => {
    const response = await app.inject({ method: 'GET', url: ApiRoutes.health });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
