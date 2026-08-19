import { isOperatorToken, toDisplayExpression } from './format';
import type { CalculatorState } from './types';

export interface CalculationSubmission {
  /** Canonical ASCII expression for the engine. */
  readonly expression: string;
  /** The same expression in Apple glyphs, for history and the preview line. */
  readonly displayExpression: string;
}

/**
 * Freezes the current input into something the API can evaluate.
 *
 * Returns `null` when there is nothing to compute, which is what stops `=` on
 * an untouched calculator from making a pointless round trip.
 */
export function buildSubmission(state: CalculatorState): CalculationSubmission | null {
  const tokens = [...state.tokens];

  if (state.entry !== null) {
    tokens.push(state.entry);
  } else if (tokens.length === 0 && state.lastResult !== null) {
    // `=` pressed twice: re-evaluating the standing result is a no-op, so
    // there is nothing worth sending.
    return null;
  }

  // `5 +` then `=` evaluates as plain `5`; the dangling operator is dropped
  // rather than sent as a syntax error.
  while (isOperatorToken(tokens.at(-1))) {
    tokens.pop();
  }

  if (tokens.length === 0) {
    return null;
  }

  return {
    expression: tokens.join(''),
    displayExpression: toDisplayExpression(tokens, null),
  };
}
