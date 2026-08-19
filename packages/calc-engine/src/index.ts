import type { Decimal } from './decimal';
import { evaluate } from './evaluator';
import { formatForDisplay, toCanonicalString } from './format';
import { parse } from './parser';

export * from './ast';
export * from './errors';
export { Decimal } from './decimal';
export { evaluate } from './evaluator';
export {
  type FormatOptions,
  formatForDisplay,
  fromCanonicalString,
  toCanonicalString,
} from './format';
export { parse } from './parser';
export { type Token, TokenType, tokenize } from './tokenizer';

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
 * This is the single entry point the computation service depends on; the
 * tokenizer, parser and evaluator are exported only for testing and tooling.
 *
 * @throws {CalculationError} for any malformed or unevaluable expression.
 */
export function compute(expression: string): ComputationResult {
  const value = evaluate(parse(expression));

  return {
    result: toCanonicalString(value),
    displayResult: formatForDisplay(value),
    value,
  };
}
