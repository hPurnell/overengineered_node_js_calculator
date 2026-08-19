import type { Calculation } from '@calc/contracts';
import { describe, expect, it } from 'vitest';

import { buildSubmission } from './expression';
import { INITIAL_STATE, calculatorReducer } from './reducer';
import type { CalculatorAction, CalculatorState } from './types';

/** Applies a key sequence, mirroring how a user drives the keypad. */
function press(...actions: readonly CalculatorAction[]): CalculatorState {
  return actions.reduce(calculatorReducer, INITIAL_STATE);
}

const digits = (text: string): CalculatorAction[] =>
  [...text].map((character) =>
    character === '.'
      ? ({ type: 'decimal' } as const)
      : ({ type: 'digit', digit: character } as const),
  );

const calculation = (overrides: Partial<Calculation> = {}): Calculation => ({
  id: '11111111-1111-4111-8111-111111111111',
  expression: '2+2',
  displayExpression: '2 + 2',
  result: '4',
  displayResult: '4',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('entering numbers', () => {
  it('starts at zero', () => {
    expect(INITIAL_STATE.display).toBe('0');
  });

  it('accumulates digits', () => {
    expect(press(...digits('123')).display).toBe('123');
  });

  it('does not accumulate leading zeros', () => {
    expect(press(...digits('007')).display).toBe('7');
  });

  it('groups thousands as they are typed', () => {
    expect(press(...digits('1234567')).display).toBe('1,234,567');
  });

  it('accepts a single decimal separator', () => {
    expect(press(...digits('1.5')).display).toBe('1.5');
    expect(press(...digits('1.5'), { type: 'decimal' }).display).toBe('1.5');
  });

  it('prefixes a bare decimal point with zero', () => {
    expect(press({ type: 'decimal' }, { type: 'digit', digit: '5' }).display).toBe('0.5');
  });

  it('stops accepting digits past the display budget', () => {
    const state = press(...digits('1234567890123456789'));
    expect(state.entry).toBe('123456789012345');
  });

  it('deletes the last digit on backspace', () => {
    expect(press(...digits('123'), { type: 'backspace' }).display).toBe('12');
  });

  it('returns to zero when the last digit is deleted', () => {
    expect(press(...digits('7'), { type: 'backspace' }).display).toBe('0');
  });
});

describe('sign toggle', () => {
  it('negates and restores the current entry', () => {
    const negated = press(...digits('42'), { type: 'toggleSign' });
    expect(negated.display).toBe('−42');
    expect(calculatorReducer(negated, { type: 'toggleSign' }).display).toBe('42');
  });

  it('seeds a new entry when negating a result', () => {
    const state = press(
      { type: 'evaluateSucceeded', calculation: calculation({ result: '4', displayResult: '4' }) },
      { type: 'toggleSign' },
    );

    expect(state.display).toBe('−4');
    expect(buildSubmission(state)?.expression).toBe('-4');
  });
});

describe('operators', () => {
  it('commits the entry and shows the expression', () => {
    const state = press(...digits('12'), { type: 'operator', operator: '+' });

    expect(state.tokens).toEqual(['12', '+']);
    expect(state.expressionPreview).toBe('12 +');
    expect(state.pendingOperator).toBe('+');
    // The readout holds the committed operand until the next digit.
    expect(state.display).toBe('12');
  });

  it('replaces a mistyped operator rather than stacking', () => {
    const state = press(
      ...digits('9'),
      { type: 'operator', operator: '+' },
      { type: 'operator', operator: '*' },
    );

    expect(state.tokens).toEqual(['9', '*']);
    expect(state.pendingOperator).toBe('*');
  });

  it('clears the pending highlight once a digit is typed', () => {
    const state = press(
      ...digits('9'),
      { type: 'operator', operator: '+' },
      { type: 'digit', digit: '1' },
    );

    expect(state.pendingOperator).toBeNull();
  });

  it('ignores a leading operator except unary minus', () => {
    expect(press({ type: 'operator', operator: '*' }).tokens).toEqual([]);
    expect(press({ type: 'operator', operator: '-' }).tokens).toEqual(['-']);
  });

  it('chains from the previous answer', () => {
    const state = press(
      { type: 'evaluateSucceeded', calculation: calculation({ result: '4' }) },
      { type: 'operator', operator: '*' },
      ...digits('3'),
    );

    expect(buildSubmission(state)?.expression).toBe('4*3');
  });
});

describe('percent', () => {
  it('appends to the current entry', () => {
    const state = press(
      ...digits('200'),
      { type: 'operator', operator: '+' },
      ...digits('10'),
      { type: 'percent' },
    );

    expect(state.tokens).toEqual(['200', '+', '10', '%']);
    expect(state.expressionPreview).toBe('200 + 10%');
    expect(buildSubmission(state)?.expression).toBe('200+10%');
  });

  it('is ignored when there is no operand to qualify', () => {
    expect(press({ type: 'percent' }).tokens).toEqual([]);
    expect(press(...digits('5'), { type: 'operator', operator: '+' }, { type: 'percent' }).tokens)
      .toEqual(['5', '+']);
  });
});

describe('clear', () => {
  it('clears only the entry on the first press, then everything', () => {
    const typed = press(...digits('12'), { type: 'operator', operator: '+' }, ...digits('34'));
    expect(typed.clearMode).toBe('entry');

    const cleared = calculatorReducer(typed, { type: 'clear' });
    expect(cleared.display).toBe('0');
    expect(cleared.tokens).toEqual(['12', '+']);
    expect(cleared.clearMode).toBe('all');

    expect(calculatorReducer(cleared, { type: 'clear' })).toEqual(INITIAL_STATE);
  });
});

describe('evaluation lifecycle', () => {
  it('marks the calculator busy while computing', () => {
    const state = press(...digits('1'), { type: 'evaluateStarted' });
    expect(state.status).toBe('computing');
  });

  it('shows the result and the completed expression', () => {
    const state = press({
      type: 'evaluateSucceeded',
      calculation: calculation({ displayExpression: '2 + 2', displayResult: '4', result: '4' }),
    });

    expect(state.display).toBe('4');
    expect(state.expressionPreview).toBe('2 + 2 =');
    expect(state.showingResult).toBe(true);
    expect(state.lastResult).toBe('4');
  });

  it('starts a fresh calculation when a digit follows a result', () => {
    const state = press(
      { type: 'evaluateSucceeded', calculation: calculation({ result: '4' }) },
      { type: 'digit', digit: '9' },
    );

    expect(state.display).toBe('9');
    expect(state.tokens).toEqual([]);
    expect(buildSubmission(state)?.expression).toBe('9');
  });

  it('shows the error text and recovers on the next key', () => {
    const errored = press(...digits('5'), { type: 'evaluateFailed', message: 'Not a number' });
    expect(errored.display).toBe('Not a number');
    expect(errored.status).toBe('error');

    const recovered = calculatorReducer(errored, { type: 'digit', digit: '7' });
    expect(recovered.display).toBe('7');
    expect(recovered.status).toBe('idle');
  });

  it('restores a recalled history entry', () => {
    const state = press({
      type: 'recall',
      calculation: calculation({ displayExpression: '6 × 7', displayResult: '42', result: '42' }),
    });

    expect(state.display).toBe('42');
    expect(state.expressionPreview).toBe('6 × 7 =');
  });
});

describe('buildSubmission', () => {
  it('returns null when there is nothing to compute', () => {
    expect(buildSubmission(INITIAL_STATE)).toBeNull();
  });

  it('returns null when a result is already standing', () => {
    const state = press({ type: 'evaluateSucceeded', calculation: calculation() });
    expect(buildSubmission(state)).toBeNull();
  });

  it('drops a dangling operator', () => {
    const state = press(...digits('5'), { type: 'operator', operator: '+' });
    expect(buildSubmission(state)).toEqual({ expression: '5', displayExpression: '5' });
  });

  it('emits ASCII for the wire and Apple glyphs for the display', () => {
    const state = press(
      ...digits('12'),
      { type: 'operator', operator: '*' },
      ...digits('3'),
      { type: 'operator', operator: '-' },
      ...digits('4'),
      { type: 'operator', operator: '/' },
      ...digits('2'),
    );

    expect(buildSubmission(state)).toEqual({
      expression: '12*3-4/2',
      displayExpression: '12 × 3 − 4 ÷ 2',
    });
  });

  it('carries a negative entry through as unary minus', () => {
    const state = press(
      ...digits('8'),
      { type: 'operator', operator: '+' },
      ...digits('3'),
      { type: 'toggleSign' },
    );

    expect(buildSubmission(state)?.expression).toBe('8+-3');
  });
});
