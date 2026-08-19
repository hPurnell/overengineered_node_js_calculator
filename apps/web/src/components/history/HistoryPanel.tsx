'use client';

import type { Calculation } from '@calc/contracts';

import type { HistoryController } from '@/hooks/useHistory';

import styles from './HistoryPanel.module.css';

export interface HistoryPanelProps {
  readonly history: HistoryController;
  readonly onRecall: (calculation: Calculation) => void;
}

/**
 * The history sidebar.
 *
 * Entries read bottom-up like a paper tape: the expression above, its result
 * below in the readout's type. Selecting one puts the result back on the
 * display so it can be used in the next calculation.
 */
export function HistoryPanel({ history, onRecall }: HistoryPanelProps) {
  const { items, isLoading, isLoadingMore, error, hasMore } = history;

  return (
    <aside className={styles.panel} aria-label="Calculation history">
      <div className={styles.header}>
        <h2 className={styles.heading}>History</h2>
        <button
          type="button"
          className={styles.clearButton}
          onClick={history.clear}
          disabled={items.length === 0}
        >
          Clear
        </button>
      </div>

      {renderBody()}
    </aside>
  );

  function renderBody() {
    if (error !== null) {
      return <p className={styles.message}>{error}</p>;
    }

    if (isLoading && items.length === 0) {
      return <p className={styles.message}>Loading…</p>;
    }

    if (items.length === 0) {
      return <p className={styles.message}>No History</p>;
    }

    return (
      <>
        <ul className={styles.list}>
          {items.map((calculation) => (
            <li key={calculation.id} className={styles.item}>
              <button
                type="button"
                className={styles.entry}
                onClick={() => onRecall(calculation)}
                title={`${calculation.displayExpression} = ${calculation.displayResult}`}
              >
                <span className={styles.entryExpression}>{calculation.displayExpression}</span>
                <span className={styles.entryResult}>{calculation.displayResult}</span>
              </button>

              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => history.remove(calculation.id)}
                aria-label={`Delete ${calculation.displayExpression}`}
              >
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>

        {hasMore ? (
          <button
            type="button"
            className={styles.loadMore}
            onClick={history.loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading…' : 'Show more'}
          </button>
        ) : null}
      </>
    );
  }
}

function CloseIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
    </svg>
  );
}
