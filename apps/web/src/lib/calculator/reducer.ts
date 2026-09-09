import type { Calculation } from '@calc/contracts';

import {
  MAX_ENTRY_DIGITS,
  countDigits,
  formatEntry,
  isOperatorToken,
  toDisplayExpression,
} from './format';
import type { CalculatorAction, CalculatorState } from './types';

export const INITIAL_STATE: CalculatorState = {
  tokens: [],
  entry: null,
  display: '0',
  expressionPreview: '',
  status: 'idle',
  showingResult: false,
  lastResult: null,
  pendingOperator: null,
  clearMode: 'all',
};

/**
 * The calculator's entire input model.
 *
 * Kept as a pure reducer with no I/O so that Apple's fiddly key semantics —
 * `AC` versus `C`, operator replacement, chaining off a result — can be tested
 * exhaustively without React or a server. The reducer never computes an
 * arithmetic result; that is the API's job, and it arrives via
 * `evaluateSucceeded`.
 */
export function calculatorReducer(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  switch (action.type) {
    case 'digit':
      return appendDigit(state, action.digit);

    case 'decimal':
      return appendDecimal(state);

    case 'operator':
      return applyOperator(state, action.operator);

    case 'percent':
      return applyPercent(state);

    case 'toggleSign':
      return toggleSign(state);

    case 'backspace':
      return backspace(state);

    case 'clear':
      return clear(state);

    case 'evaluateStarted':
      return { ...state, status: 'computing' };

    // A finished calculation lands on the readout the same way whether it was
    // just computed or recalled from history.
    case 'evaluateSucceeded':
    case 'recall':
      return showCalculation(action.calculation);

    case 'evaluateFailed':
      return { ...INITIAL_STATE, display: action.message, status: 'error' };
  }
}

/** Puts a completed calculation on the readout, ready to be chained from. */
function showCalculation(calculation: Calculation): CalculatorState {
  return {
    ...INITIAL_STATE,
    display: calculation.displayResult,
    expressionPreview: `${calculation.displayExpression} =`,
    lastResult: calculation.result,
    showingResult: true,
  };
}

/** Any input after an error starts from a clean slate, as on a Mac. */
function resetIfErrored(state: CalculatorState): CalculatorState {
  return state.status === 'error' ? INITIAL_STATE : state;
}

function appendDigit(current: CalculatorState, digit: string): CalculatorState {
  const state = resetIfErrored(current);

  // A digit after `=` begins a brand-new calculation rather than extending
  // the result that is on screen.
  const base = state.showingResult ? INITIAL_STATE : state;

  const entry = nextEntry(base.entry, digit);
  if (entry === null) {
    return base;
  }

  return withEntry(base, entry);
}

/** Returns the entry after typing `digit`, or `null` if the key is a no-op. */
function nextEntry(entry: string | null, digit: string): string | null {
  if (entry === null) {
    return digit;
  }

  // Leading zeros are not accumulated: `0` then `5` is `5`, not `05`.
  if (entry === '0') {
    return digit;
  }
  if (entry === '-0') {
    return `-${digit}`;
  }

  // The readout is finite; further digits are ignored rather than silently
  // producing a number the display cannot represent.
  if (countDigits(entry) >= MAX_ENTRY_DIGITS) {
    return null;
  }

  return `${entry}${digit}`;
}

function appendDecimal(current: CalculatorState): CalculatorState {
  const state = resetIfErrored(current);
  const base = state.showingResult ? INITIAL_STATE : state;

  if (base.entry === null) {
    return withEntry(base, '0.');
  }
  if (base.entry.includes('.')) {
    return base;
  }

  return withEntry(base, `${base.entry}.`);
}

function applyOperator(
  current: CalculatorState,
  operator: CalculatorState['pendingOperator'],
): CalculatorState {
  if (operator === null) {
    return current;
  }

  const state = resetIfErrored(current);
  const tokens = [...state.tokens];

  if (state.entry !== null) {
    tokens.push(state.entry);
  } else if (tokens.length === 0 && state.lastResult !== null) {
    // Chain off the previous answer: `=` then `+` continues from the result.
    tokens.push(state.lastResult);
  }

  const lastToken = tokens.at(-1);

  if (isOperatorToken(lastToken)) {
    // Pressing a second operator corrects the first rather than stacking.
    tokens[tokens.length - 1] = operator;
  } else if (tokens.length === 0) {
    if (operator !== '-') {
      // Nothing to operate on, and only `-` is meaningful as a prefix.
      return state;
    }
    tokens.push(operator);
  } else {
    tokens.push(operator);
  }

  return {
    ...state,
    tokens,
    entry: null,
    showingResult: false,
    pendingOperator: operator,
    expressionPreview: toDisplayExpression(tokens, null),
    clearMode: 'all',
    status: 'idle',
  };
}

function applyPercent(current: CalculatorState): CalculatorState {
  const state = resetIfErrored(current);
  const tokens = [...state.tokens];

  if (state.entry !== null) {
    tokens.push(state.entry);
  } else if (tokens.length === 0 && state.lastResult !== null) {
    tokens.push(state.lastResult);
  } else if (isOperatorToken(tokens.at(-1)) || tokens.length === 0) {
    // `%` needs a value to qualify.
    return state;
  }

  tokens.push('%');

  return {
    ...state,
    tokens,
    entry: null,
    showingResult: false,
    pendingOperator: null,
    expressionPreview: toDisplayExpression(tokens, null),
    status: 'idle',
  };
}

function toggleSign(current: CalculatorState): CalculatorState {
  const state = resetIfErrored(current);

  // Negating a result starts a new entry seeded with that result.
  if (state.showingResult && state.lastResult !== null) {
    return withEntry(INITIAL_STATE, negate(state.lastResult));
  }

  if (state.entry === null) {
    return withEntry(state, '-0');
  }

  return withEntry(state, negate(state.entry));
}

function negate(value: string): string {
  return value.startsWith('-') ? value.slice(1) : `-${value}`;
}

function backspace(current: CalculatorState): CalculatorState {
  const state = resetIfErrored(current);

  if (state.entry === null) {
    return state;
  }

  const truncated = state.entry.slice(0, -1);

  if (truncated === '' || truncated === '-') {
    return {
      ...state,
      entry: null,
      display: '0',
      expressionPreview: toDisplayExpression(state.tokens, null),
      clearMode: 'all',
    };
  }

  return withEntry(state, truncated);
}

function clear(state: CalculatorState): CalculatorState {
  // `C` drops only the current entry; a second press (now `AC`) drops the
  // whole expression.
  if (state.clearMode === 'entry') {
    return {
      ...state,
      entry: null,
      display: '0',
      expressionPreview: toDisplayExpression(state.tokens, null),
      clearMode: 'all',
      status: 'idle',
    };
  }

  return INITIAL_STATE;
}

/** Commits an entry and recomputes every derived display field from it. */
function withEntry(state: CalculatorState, entry: string): CalculatorState {
  return {
    ...state,
    entry,
    display: formatEntry(entry),
    expressionPreview: toDisplayExpression(state.tokens, entry),
    showingResult: false,
    pendingOperator: null,
    clearMode: 'entry',
    status: 'idle',
  };
}
