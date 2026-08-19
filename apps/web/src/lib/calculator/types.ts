import type { Calculation } from '@calc/contracts';

/** Canonical ASCII operators, matching the grammar the engine parses. */
export type OperatorSymbol = '+' | '-' | '*' | '/';

export type CalculatorStatus = 'idle' | 'computing' | 'error';

/**
 * Which reset the clear key performs.
 *
 * Apple's key is labelled `AC` on a clean display and `C` once something has
 * been typed; `C` clears only the current entry, `AC` clears everything.
 */
export type ClearMode = 'all' | 'entry';

export interface CalculatorState {
  /**
   * Committed expression tokens in canonical ASCII form, e.g. `['200', '+']`.
   *
   * The in-progress `entry` is deliberately kept out of this array so that
   * editing it (backspace, sign toggle, decimal point) never has to rewrite
   * committed history.
   */
  readonly tokens: readonly string[];

  /** The number currently being typed, or `null` when not mid-entry. */
  readonly entry: string | null;

  /** The large primary readout. */
  readonly display: string;

  /** The small secondary line showing the expression so far, in Apple glyphs. */
  readonly expressionPreview: string;

  readonly status: CalculatorStatus;

  /** True immediately after a successful evaluation, until the next input. */
  readonly showingResult: boolean;

  /** Canonical full-precision result of the last evaluation, for chaining. */
  readonly lastResult: string | null;

  /** Operator awaiting its right operand; drives the lit key. */
  readonly pendingOperator: OperatorSymbol | null;

  readonly clearMode: ClearMode;

  /** User-facing error text, shown in place of the readout. */
  readonly error: string | null;
}

export type CalculatorAction =
  | { readonly type: 'digit'; readonly digit: string }
  | { readonly type: 'decimal' }
  | { readonly type: 'operator'; readonly operator: OperatorSymbol }
  | { readonly type: 'percent' }
  | { readonly type: 'toggleSign' }
  | { readonly type: 'backspace' }
  | { readonly type: 'clear' }
  | { readonly type: 'evaluateStarted' }
  | { readonly type: 'evaluateSucceeded'; readonly calculation: Calculation }
  | { readonly type: 'evaluateFailed'; readonly message: string }
  | { readonly type: 'recall'; readonly calculation: Calculation };
