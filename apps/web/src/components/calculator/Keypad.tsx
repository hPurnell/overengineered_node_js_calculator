'use client';

import type { OperatorSymbol } from '@/lib/calculator/types';

import { CalculatorKey } from './CalculatorKey';
import styles from './Keypad.module.css';

export interface KeypadProps {
  readonly onDigit: (digit: string) => void;
  readonly onDecimal: () => void;
  readonly onOperator: (operator: OperatorSymbol) => void;
  readonly onEquals: () => void;
  readonly onClear: () => void;
  readonly onToggleSign: () => void;
  readonly onPercent: () => void;
  /** `AC` on a clean display, `C` once something has been entered. */
  readonly clearLabel: 'AC' | 'C';
  readonly pendingOperator: OperatorSymbol | null;
  readonly isBusy: boolean;
}

/** Row-major key layout, matching the macOS Calculator. */
export function Keypad({
  onDigit,
  onDecimal,
  onOperator,
  onEquals,
  onClear,
  onToggleSign,
  onPercent,
  clearLabel,
  pendingOperator,
  isBusy,
}: KeypadProps) {
  const digit = (value: string) => (
    <CalculatorKey
      key={value}
      label={value}
      variant="digit"
      onPress={() => onDigit(value)}
      disabled={isBusy}
    />
  );

  const operator = (symbol: OperatorSymbol, glyph: string, name: string) => (
    <CalculatorKey
      label={glyph}
      variant="operator"
      ariaLabel={name}
      onPress={() => onOperator(symbol)}
      isPending={pendingOperator === symbol}
      disabled={isBusy}
    />
  );

  return (
    <div className={styles.keypad} role="group" aria-label="Calculator keypad">
      <CalculatorKey
        label={clearLabel}
        variant="function"
        ariaLabel={clearLabel === 'AC' ? 'All clear' : 'Clear entry'}
        onPress={onClear}
        disabled={isBusy}
      />
      <CalculatorKey
        label="±"
        variant="function"
        ariaLabel="Toggle sign"
        onPress={onToggleSign}
        disabled={isBusy}
      />
      <CalculatorKey
        label="%"
        variant="function"
        ariaLabel="Percent"
        onPress={onPercent}
        disabled={isBusy}
      />
      {operator('/', '÷', 'Divide')}

      {digit('7')}
      {digit('8')}
      {digit('9')}
      {operator('*', '×', 'Multiply')}

      {digit('4')}
      {digit('5')}
      {digit('6')}
      {operator('-', '−', 'Subtract')}

      {digit('1')}
      {digit('2')}
      {digit('3')}
      {operator('+', '+', 'Add')}

      <CalculatorKey
        label="0"
        variant="digit"
        isWide
        onPress={() => onDigit('0')}
        disabled={isBusy}
      />
      <CalculatorKey
        label="."
        variant="digit"
        ariaLabel="Decimal point"
        onPress={onDecimal}
        disabled={isBusy}
      />
      <CalculatorKey
        label="="
        variant="operator"
        ariaLabel="Equals"
        onPress={onEquals}
        disabled={isBusy}
      />
    </div>
  );
}
