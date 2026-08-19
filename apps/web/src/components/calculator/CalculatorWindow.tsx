'use client';

import type { ReactNode } from 'react';

import styles from './CalculatorWindow.module.css';

export interface CalculatorWindowProps {
  readonly children: ReactNode;
  /** Rendered to the right of the keypad when history is open. */
  readonly aside?: ReactNode;
  /**
   * Rendered below the body, spanning the full window width.
   *
   * The body is a fixed height, so anything that appears conditionally has to
   * live outside it or it would be clipped.
   */
  readonly footer?: ReactNode;
  readonly isHistoryOpen: boolean;
  readonly onToggleHistory: () => void;
}

/**
 * The macOS window chrome: titlebar, traffic lights, and the history toggle.
 *
 * Chrome is kept separate from the calculator itself so the keypad has no
 * opinion about the frame it sits in.
 */
export function CalculatorWindow({
  children,
  aside,
  footer,
  isHistoryOpen,
  onToggleHistory,
}: CalculatorWindowProps) {
  return (
    <section className={styles.window} aria-label="Calculator">
      <header className={styles.titlebar}>
        <div className={styles.trafficLights} aria-hidden="true">
          <span className={`${styles.light} ${styles.close}`} />
          <span className={`${styles.light} ${styles.minimise}`} />
          <span className={`${styles.light} ${styles.zoom}`} />
        </div>

        <h1 className={styles.title}>Calculator</h1>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.historyToggle}
            onClick={onToggleHistory}
            aria-pressed={isHistoryOpen}
            aria-label={isHistoryOpen ? 'Hide history' : 'Show history'}
            title="History"
          >
            <ClockIcon />
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <div className={styles.calculator}>{children}</div>
        {aside}
      </div>

      {footer === undefined ? null : <div className={styles.footer}>{footer}</div>}
    </section>
  );
}

function ClockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.5V8l2.4 1.6" />
    </svg>
  );
}
