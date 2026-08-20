import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { InvalidCursorError, createHistoryStore } from '../src/persistence';
import type { HistoryStore, NewCalculationRecord } from '../src/persistence';

/**
 * Every test runs against a fresh in-memory database that has been migrated
 * from scratch, which exercises the real migration files rather than a
 * hand-built schema.
 */
let store: HistoryStore;

const sample = (overrides: Partial<NewCalculationRecord> = {}): NewCalculationRecord => ({
  expression: '2+2',
  displayExpression: '2 + 2',
  result: '4',
  displayResult: '4',
  ...overrides,
});

beforeEach(() => {
  store = createHistoryStore({ url: ':memory:' });
});

afterEach(async () => {
  await store.close();
});

describe('append', () => {
  it('assigns an id and timestamp when the caller supplies none', async () => {
    const record = await store.append(sample());

    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(record.createdAt).toBeInstanceOf(Date);
    expect(record.expression).toBe('2+2');
  });

  it('preserves a caller-supplied id and timestamp', async () => {
    const createdAt = new Date('2024-03-01T12:00:00.000Z');
    const record = await store.append(
      sample({ id: '11111111-1111-4111-8111-111111111111', createdAt }),
    );

    expect(record.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(record.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it('stores results as text so decimal precision survives a round trip', async () => {
    // A REAL column would round this to a double and lose the tail.
    const precise = '0.1000000000000000000000000000000001';
    const record = await store.append(sample({ result: precise }));

    const reloaded = await store.findById(record.id);
    expect(reloaded?.result).toBe(precise);
  });
});

describe('list', () => {
  const seed = async (count: number): Promise<void> => {
    for (let index = 0; index < count; index += 1) {
      await store.append(
        sample({
          expression: `${index}+0`,
          result: String(index),
          // Distinct, increasing timestamps make ordering assertions exact.
          createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0, index)),
        }),
      );
    }
  };

  it('returns the newest record first', async () => {
    await seed(3);

    const page = await store.list({ limit: 10 });

    expect(page.items.map((item) => item.result)).toEqual(['2', '1', '0']);
    expect(page.nextCursor).toBeNull();
  });

  it('pages forward without repeating or skipping records', async () => {
    await seed(10);

    const collected: string[] = [];
    let cursor: string | undefined;

    do {
      const page = await store.list({ limit: 3, cursor });
      collected.push(...page.items.map((item) => item.result));
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);

    expect(collected).toEqual(['9', '8', '7', '6', '5', '4', '3', '2', '1', '0']);
  });

  it('breaks timestamp ties deterministically by id', async () => {
    const createdAt = new Date('2024-06-01T00:00:00.000Z');
    const ids = [
      'aaaaaaaa-1111-4111-8111-111111111111',
      'bbbbbbbb-1111-4111-8111-111111111111',
      'cccccccc-1111-4111-8111-111111111111',
    ];
    for (const id of ids) {
      await store.append(sample({ id, createdAt }));
    }

    const first = await store.list({ limit: 2 });
    const second = await store.list({ limit: 2, cursor: first.nextCursor ?? undefined });

    expect([...first.items, ...second.items].map((item) => item.id)).toEqual([...ids].reverse());
  });

  it('rejects a malformed cursor', async () => {
    await expect(store.list({ limit: 5, cursor: 'not-a-cursor' })).rejects.toThrow(
      InvalidCursorError,
    );
  });
});

describe('findById, deleteById and clear', () => {
  it('resolves null for an unknown id', async () => {
    await expect(store.findById('00000000-0000-4000-8000-000000000000')).resolves.toBeNull();
  });

  it('reports whether a delete removed anything', async () => {
    const record = await store.append(sample());

    await expect(store.deleteById(record.id)).resolves.toBe(true);
    await expect(store.deleteById(record.id)).resolves.toBe(false);
  });

  it('returns the number of rows removed by clear', async () => {
    await store.append(sample());
    await store.append(sample());

    await expect(store.clear()).resolves.toBe(2);
    await expect(store.list({ limit: 10 })).resolves.toMatchObject({ items: [] });
  });
});

describe('lifecycle', () => {
  it('reports liveness while open and not once closed', async () => {
    await expect(store.ping()).resolves.toBe(true);

    await store.close();
    await expect(store.ping()).resolves.toBe(false);
  });

  it('tolerates being closed twice', async () => {
    await store.close();
    await expect(store.close()).resolves.toBeUndefined();
  });

  it('refuses writes after close', async () => {
    await store.close();
    await expect(store.append(sample())).rejects.toThrow(/closed/i);
  });
});

describe('domain model', () => {
  it('projects onto the wire contract with an ISO timestamp', async () => {
    const record = await store.append(
      sample({ createdAt: new Date('2024-03-01T12:00:00.000Z') }),
    );

    expect(record.toDto()).toEqual({
      id: record.id,
      expression: '2+2',
      displayExpression: '2 + 2',
      result: '4',
      displayResult: '4',
      createdAt: '2024-03-01T12:00:00.000Z',
    });
  });
});
