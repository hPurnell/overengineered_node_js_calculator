import { describe, expect, it } from 'vitest';

import {
  DivisionByZeroError,
  ExpressionTooComplexError,
  InvalidExpressionError,
  compute,
} from './index';

/** Convenience: assert on the canonical (lossless) result. */
const result = (expression: string): string => compute(expression).result;

/** Convenience: assert on the formatted display string. */
const display = (expression: string): string => compute(expression).displayResult;

describe('arithmetic', () => {
  it('evaluates the four basic operations', () => {
    expect(result('1+1')).toBe('2');
    expect(result('10-4')).toBe('6');
    expect(result('6*7')).toBe('42');
    expect(result('84/2')).toBe('42');
  });

  it('honours operator precedence', () => {
    expect(result('2+3*4')).toBe('14');
    expect(result('2*3+4')).toBe('10');
    expect(result('100-10/2')).toBe('95');
  });

  it('honours parentheses over precedence', () => {
    expect(result('(2+3)*4')).toBe('20');
    expect(result('2*(3+4)*(1+1)')).toBe('28');
  });

  it('is left-associative for equal precedence', () => {
    expect(result('100-50-25')).toBe('25');
    expect(result('100/5/2')).toBe('10');
  });

  it('applies unary operators', () => {
    expect(result('-5')).toBe('-5');
    expect(result('--5')).toBe('5');
    expect(result('3*-4')).toBe('-12');
    expect(result('-(2+3)')).toBe('-5');
  });

  it('parses every accepted numeric literal form', () => {
    expect(result('.5+.5')).toBe('1');
    expect(result('2.+1')).toBe('3');
    expect(result('1e3')).toBe('1000');
    expect(result('1.5E-2')).toBe('0.015');
  });
});

describe('decimal exactness', () => {
  it('avoids IEEE-754 drift that would show up in the display', () => {
    // The canonical bug: 0.1 + 0.2 === 0.30000000000000004 in binary floats.
    expect(result('0.1+0.2')).toBe('0.3');
    expect(result('1.1*3')).toBe('3.3');
    expect(result('0.3-0.1')).toBe('0.2');
  });

  it('keeps precision well beyond double range', () => {
    expect(result('0.1+0.7')).toBe('0.8');
    expect(result('12345678901234567890+1')).toBe('12345678901234567891');
  });
});

describe('percent', () => {
  it('divides by one hundred when standalone', () => {
    expect(result('50%')).toBe('0.5');
    expect(result('(20+30)%')).toBe('0.5');
  });

  it('reads as "percent of the left operand" under + and -', () => {
    // Matches Apple: 200 + 10% is 220, not 200.1.
    expect(result('200+10%')).toBe('220');
    expect(result('200-10%')).toBe('180');
  });

  it('reads as a plain fraction under * and /', () => {
    expect(result('200*10%')).toBe('20');
    expect(result('200/10%')).toBe('2000');
  });

  it('respects precedence when mixing percent with other terms', () => {
    // `2*5%` binds tighter than `+`, so the percent is not "of 100".
    expect(result('100+2*5%')).toBe('100.1');
  });
});

describe('errors', () => {
  it('rejects division by zero', () => {
    expect(() => compute('1/0')).toThrow(DivisionByZeroError);
    expect(() => compute('0/0')).toThrow(DivisionByZeroError);
    expect(() => compute('1/(5-5)')).toThrow(DivisionByZeroError);
  });

  it('rejects malformed expressions', () => {
    expect(() => compute('1+')).toThrow(InvalidExpressionError);
    expect(() => compute('*5')).toThrow(InvalidExpressionError);
    expect(() => compute('(1+2')).toThrow(InvalidExpressionError);
    expect(() => compute('1+2)')).toThrow(InvalidExpressionError);
    expect(() => compute('1..2')).toThrow(InvalidExpressionError);
    expect(() => compute('1 2')).toThrow(InvalidExpressionError);
  });

  it('rejects characters outside the grammar', () => {
    expect(() => compute('2^8')).toThrow(InvalidExpressionError);
    expect(() => compute('alert(1)')).toThrow(InvalidExpressionError);
    // Apple's display glyphs must be normalised by the client first.
    expect(() => compute('2×3')).toThrow(InvalidExpressionError);
  });

  it('rejects expressions that breach the safety limits', () => {
    expect(() => compute('1'.padStart(600, '1'))).toThrow(ExpressionTooComplexError);
    expect(() => compute(`${'('.repeat(40)}1${')'.repeat(40)}`)).toThrow(ExpressionTooComplexError);
  });

  it('does not recurse for long flat operator chains', () => {
    // 250 additions: left-associative parsing must stay iterative.
    const expression = Array.from({ length: 250 }, () => '1').join('+');
    expect(result(expression)).toBe('250');
  });
});

describe('display formatting', () => {
  it('groups thousands', () => {
    expect(display('1000*1000')).toBe('1,000,000');
    // U+2212 MINUS SIGN, matching the glyph the client uses for entries.
    expect(display('0-1234567')).toBe('\u22121,234,567');
    expect(display('1234.5678+0')).toBe('1,234.5678');
  });

  it('trims to the display digit budget', () => {
    expect(display('1/3')).toBe('0.333333333333333');
    expect(display('2/3')).toBe('0.666666666666667');
  });

  it('switches to scientific notation at the extremes', () => {
    expect(display('1e15+0')).toBe('1e+15');
    expect(display('1e-7+0')).toBe('1e-7');
    expect(display('123456789*1000000000')).toBe('1.23456789e+17');
  });

  it('stays in plain notation just inside the thresholds', () => {
    expect(display('999999999999999+0')).toBe('999,999,999,999,999');
    expect(display('0.000001+0')).toBe('0.000001');
  });

  it('normalises negative zero', () => {
    expect(display('0*-1')).toBe('0');
  });

  it('renders negatives with the typographic minus sign', () => {
    expect(display('0-5')).toBe('\u22125');
    expect(display('0-1e20')).toBe('\u22121e+20');
    // The exponent keeps the conventional ASCII hyphen.
    expect(display('0-1e-9')).toBe('\u22121e-9');
  });
});
