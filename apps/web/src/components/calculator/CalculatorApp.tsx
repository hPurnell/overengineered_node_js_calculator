'use client';

import type { Calculation } from '@calc/contracts';
import { useCallback, useMemo, useState } from 'react';

import { HistoryPanel } from '@/components/history/HistoryPanel';
import { useCalculator } from '@/hooks/useCalculator';
import { useHistory } from '@/hooks/useHistory';
import { useKeyboardInput } from '@/hooks/useKeyboardInput';

import styles from './CalculatorApp.module.css';
import { CalculatorWindow } from './CalculatorWindow';
import { Display } from './Display';
import { Keypad } from './Keypad';

/**
 * Composition root for the UI.
 *
 * Owns the two pieces of cross-cutting state — whether history is open, and
 * the calculator itself — and wires the keypad, the physical keyboard and the
 * history panel to them.
 */
export function CalculatorApp() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const history = useHistory({ enabled: isHistoryOpen });

  // Show the new entry in the panel, but only while it is visible: a closed
  // panel reloads from scratch when it opens.
  const onCalculationRecorded = useCallback(
    (calculation: Calculation) => {
      if (isHistoryOpen) {
        history.prepend(calculation);
      }
    },
    [isHistoryOpen, history],
  );

  const calculator = useCalculator({ onCalculationRecorded });

  const keyboardHandlers = useMemo(
    () => ({
      onDigit: calculator.pressDigit,
      onDecimal: calculator.pressDecimal,
      onOperator: calculator.pressOperator,
      onEquals: calculator.pressEquals,
      onClear: calculator.pressClear,
      onBackspace: calculator.pressBackspace,
      onPercent: calculator.pressPercent,
      onToggleSign: calculator.pressToggleSign,
    }),
    [calculator],
  );

  useKeyboardInput(keyboardHandlers, !calculator.isBusy);

  const { state } = calculator;

  return (
    <CalculatorWindow
      isHistoryOpen={isHistoryOpen}
      onToggleHistory={() => setIsHistoryOpen((open) => !open)}
      aside={
        isHistoryOpen ? (
          <HistoryPanel history={history} onRecall={calculator.recall} />
        ) : undefined
      }
      footer={
        calculator.connectionError !== null ? (
          <p className={styles.banner} role="status">
            {calculator.connectionError}
          </p>
        ) : undefined
      }
    >
      <Display
        value={state.display}
        expression={state.expressionPreview}
        isComputing={calculator.isBusy}
        hasError={state.status === 'error'}
      />

      <Keypad
        onDigit={calculator.pressDigit}
        onDecimal={calculator.pressDecimal}
        onOperator={calculator.pressOperator}
        onEquals={calculator.pressEquals}
        onClear={calculator.pressClear}
        onToggleSign={calculator.pressToggleSign}
        onPercent={calculator.pressPercent}
        clearLabel={state.clearMode === 'entry' ? 'C' : 'AC'}
        pendingOperator={state.pendingOperator}
        isBusy={calculator.isBusy}
      />
    </CalculatorWindow>
  );
}
