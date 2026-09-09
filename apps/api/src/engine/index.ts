import { evaluateExpression } from './internal/evaluate';
import { formatForDisplay, toCanonicalString } from './format';

export * from './errors';

export interface ComputationResult {
  /** Exact result, serialised losslessly for storage and transport. */
  readonly result: string;
  /** The same value rendered for the calculator display. */
  readonly displayResult: string;
}

/**
 * Parses and evaluates a canonical ASCII expression.
 *
 * The single entry point the computation service depends on. Parsing and
 * evaluation are delegated to a mathjs instance restricted to arithmetic; this
 * package owns the grammar allowlist, the error taxonomy, and the display
 * formatting, none of which mathjs provides.
 *
 * Results cross this boundary as strings. Handing back the underlying decimal
 * would re-export a type owned by `decimal.js`, letting callers reach the whole
 * arithmetic API through a layer whose entire purpose is to constrain it.
 *
 * @throws {CalculationError} for any malformed or unevaluable expression.
 */
export function compute(expression: string): ComputationResult {
  const value = evaluateExpression(expression);

  return {
    result: toCanonicalString(value),
    displayResult: formatForDisplay(value),
  };
}
