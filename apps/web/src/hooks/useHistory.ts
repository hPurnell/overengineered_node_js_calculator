'use client';

import type { Calculation } from '@calc/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { clearHistory, deleteCalculation, fetchHistory } from '@/lib/api/client';
import { ApiClientError } from '@/lib/api/errors';

const PAGE_SIZE = 25;

export interface HistoryController {
  readonly items: readonly Calculation[];
  readonly isLoading: boolean;
  readonly isLoadingMore: boolean;
  readonly error: string | null;
  readonly hasMore: boolean;
  readonly refresh: () => void;
  readonly loadMore: () => void;
  readonly clear: () => void;
  readonly remove: (id: string) => void;
}

export interface UseHistoryOptions {
  /** History is only fetched while the panel is open. */
  readonly enabled: boolean;
}

/**
 * Loads and mutates the persisted calculation history.
 *
 * Fetching is deferred until the panel is opened so the calculator does no
 * network work on first paint, and paging uses the API's opaque cursor so the
 * list stays correct as new calculations land at the top.
 */
export function useHistory({ enabled }: UseHistoryOptions): HistoryController {
  const [items, setItems] = useState<readonly Calculation[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Abandons a stale request when a newer one supersedes it. */
  const inFlightRef = useRef<AbortController | null>(null);
  /** Guards state updates after unmount. */
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      inFlightRef.current?.abort();
    };
  }, []);

  const describe = (cause: unknown): string =>
    cause instanceof ApiClientError && cause.isNetworkFailure
      ? 'History is unavailable'
      : 'Could not load history';

  const refresh = useCallback(async () => {
    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const page = await fetchHistory({ limit: PAGE_SIZE }, { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch (cause) {
      if (controller.signal.aborted || !mountedRef.current) {
        return;
      }
      setError(describe(cause));
    } finally {
      if (mountedRef.current && inFlightRef.current === controller) {
        setIsLoading(false);
        inFlightRef.current = null;
      }
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (cursor === null) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const page = await fetchHistory({ limit: PAGE_SIZE, cursor });
      if (!mountedRef.current) {
        return;
      }
      // Append rather than replace: earlier pages stay as the user saw them.
      setItems((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch (cause) {
      if (mountedRef.current) {
        setError(describe(cause));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [cursor]);

  const clear = useCallback(async () => {
    // Optimistic: clearing is unambiguous, and a failure re-syncs from the server.
    const previous = items;
    setItems([]);
    setCursor(null);

    try {
      await clearHistory();
    } catch {
      if (mountedRef.current) {
        setItems(previous);
        setError('Could not clear history');
      }
    }
  }, [items]);

  const remove = useCallback(
    async (id: string) => {
      const previous = items;
      setItems((current) => current.filter((item) => item.id !== id));

      try {
        await deleteCalculation(id);
      } catch {
        if (mountedRef.current) {
          setItems(previous);
          setError('Could not delete that entry');
        }
      }
    },
    [items],
  );

  // Load on open, and drop the list on close so a reopen always shows fresh data.
  useEffect(() => {
    if (enabled) {
      void refresh();
    } else {
      setItems([]);
      setCursor(null);
      setError(null);
    }
  }, [enabled, refresh]);

  return {
    items,
    isLoading,
    isLoadingMore,
    error,
    hasMore: cursor !== null,
    refresh: useCallback(() => {
      void refresh();
    }, [refresh]),
    loadMore: useCallback(() => {
      void loadMore();
    }, [loadMore]),
    clear: useCallback(() => {
      void clear();
    }, [clear]),
    remove: useCallback(
      (id: string) => {
        void remove(id);
      },
      [remove],
    ),
  };
}
