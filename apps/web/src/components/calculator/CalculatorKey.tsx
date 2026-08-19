'use client';

import type { ReactNode } from 'react';

import styles from './CalculatorKey.module.css';

export type KeyVariant = 'digit' | 'function' | 'operator';

export interface CalculatorKeyProps {
  readonly label: ReactNode;
  readonly variant: KeyVariant;
  readonly onPress: () => void;
  /** Lights the key while its operation is awaiting an operand. */
  readonly isPending?: boolean;
  /** Makes the key span two grid columns, as the zero key does. */
  readonly isWide?: boolean;
  readonly disabled?: boolean;
  /** Overrides the accessible name when the visible label is a glyph. */
  readonly ariaLabel?: string;
}

export function CalculatorKey({
  label,
  variant,
  onPress,
  isPending = false,
  isWide = false,
  disabled = false,
  ariaLabel,
}: CalculatorKeyProps) {
  const className = [
    styles.key,
    styles[variant],
    isPending ? styles.pending : '',
    isWide ? styles.wide : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onPress}
      disabled={disabled}
      aria-label={ariaLabel}
      // Keyboard input is handled globally, so keys must not also fire on
      // Space or Enter while focused — that would double-apply a keystroke.
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
