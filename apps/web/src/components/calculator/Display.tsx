'use client';

import styles from './Display.module.css';

export interface DisplayProps {
  readonly value: string;
  readonly expression: string;
  readonly isComputing: boolean;
  readonly hasError: boolean;
}

/**
 * Font sizes for the readout, indexed by how many characters it must show.
 *
 * Apple shrinks the readout to fit rather than truncating or wrapping.
 * Measuring the rendered text would be more precise, but a character-count
 * ladder avoids a layout read on every keystroke and is exact enough for a
 * fixed-width window and tabular figures.
 */
const READOUT_SIZES_PX: readonly number[] = [54, 54, 54, 54, 54, 54, 54, 48, 43, 39, 35, 32, 29];
const MIN_READOUT_SIZE_PX = 26;

function readoutFontSize(value: string): number {
  return READOUT_SIZES_PX[value.length] ?? MIN_READOUT_SIZE_PX;
}

/**
 * The calculator readout: a muted expression strip above the primary value.
 *
 * The value is announced politely so a screen-reader user hears results as
 * they arrive without every intermediate keystroke interrupting them.
 */
export function Display({ value, expression, isComputing, hasError }: DisplayProps) {
  const className = [
    styles.readout,
    isComputing ? styles.computing : '',
    hasError ? styles.error : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.display}>
      <div className={styles.expression} aria-hidden="true">
        {expression}
      </div>

      <output
        className={className}
        style={{ fontSize: `${readoutFontSize(value)}px` }}
        aria-live="polite"
        aria-atomic="true"
      >
        {value}
      </output>
    </div>
  );
}
