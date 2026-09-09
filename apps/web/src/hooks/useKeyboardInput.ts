'use client';

import { useEffect, useRef } from 'react';

import type { OperatorSymbol } from '@/lib/calculator/types';

export interface KeyboardHandlers {
  readonly onDigit: (digit: string) => void;
  readonly onDecimal: () => void;
  readonly onOperator: (operator: OperatorSymbol) => void;
  readonly onEquals: () => void;
  readonly onClear: () => void;
  readonly onBackspace: () => void;
  readonly onPercent: () => void;
  readonly onToggleSign: () => void;
}

const OPERATOR_KEYS: Readonly<Record<string, OperatorSymbol>> = {
  '+': '+',
  '-': '-',
  '*': '*',
  x: '*',
  X: '*',
  '/': '/',
};

/**
 * Binds the physical keyboard to the keypad, matching the macOS Calculator's
 * shortcuts.
 *
 * Listening on `window` rather than a focused element means the calculator
 * responds immediately without the user having to click into it first.
 */
export function useKeyboardInput(handlers: KeyboardHandlers, enabled = true): void {
  /**
   * The listener reads its handlers through a ref rather than closing over
   * them. Callers rebuild the handler object on most renders, and depending on
   * it directly would detach and re-attach a window listener on every
   * keystroke — so the subscription is kept independent of caller discipline.
   */
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      // Leave browser and OS shortcuts alone.
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      // Do not hijack typing in a field, or activating a focused control.
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
          return;
        }
      }

      const { key } = event;
      const handle = handlersRef.current;

      if (key >= '0' && key <= '9') {
        event.preventDefault();
        handle.onDigit(key);
        return;
      }

      const operator = OPERATOR_KEYS[key];
      if (operator !== undefined) {
        event.preventDefault();
        handle.onOperator(operator);
        return;
      }

      switch (key) {
        case '.':
        case ',':
          event.preventDefault();
          handle.onDecimal();
          break;

        case 'Enter':
        case '=':
          event.preventDefault();
          handle.onEquals();
          break;

        case 'Backspace':
        case 'Delete':
          event.preventDefault();
          handle.onBackspace();
          break;

        case 'Escape':
        case 'c':
        case 'C':
          event.preventDefault();
          handle.onClear();
          break;

        case '%':
          event.preventDefault();
          handle.onPercent();
          break;

        case 'n':
        case 'N':
          event.preventDefault();
          handle.onToggleSign();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}
