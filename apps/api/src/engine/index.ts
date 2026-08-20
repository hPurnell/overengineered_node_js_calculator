import type { Decimal } from './decimal';
import { evaluateExpression } from './internal/evaluate';
import { formatForDisplay, toCanonicalString } from './format';

export * from './errors';
export { Decimal } from './decimal';
export {
  type FormatOptions,
  formatForDisplay,
  fromCanonicalString,
  toCanonicalString,
} from './format';

export interface ComputationResult {
  /** Exact result, serialised losslessly for storage and transport. */
  readonly result: string;
  /** The same value rendered for the calculator display. */
  readonly displayResult: string;
  /** The underlying value, for callers that want to keep computing. */
  readonly value: Decimal;
}

/**
 * Parses and evaluates a canonical ASCII expression.
 *
 * The single entry point the computation service depends on. Parsing and
 * evaluation are delegated to a mathjs instance restricted to arithmetic; this
 * package owns the grammar allowlist, the error taxonomy, and the display
 * formatting, none of which mathjs provides.
 *
 * @throws {CalculationError} for any malformed or unevaluable expression.
 */
export function compute(expression: string): ComputationResult {
  const value = evaluateExpression(expression);

  return {
    result: toCanonicalString(value),
    displayResult: formatForDisplay(value),
    value,
  };
}
