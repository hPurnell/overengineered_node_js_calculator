import { EXPRESSION_MAX_LENGTH } from '@calc/contracts';

import { ExpressionTooComplexError, InvalidExpressionError } from './errors';

export const TokenType = {
  Number: 'Number',
  Plus: 'Plus',
  Minus: 'Minus',
  Star: 'Star',
  Slash: 'Slash',
  Percent: 'Percent',
  LeftParen: 'LeftParen',
  RightParen: 'RightParen',
  EndOfInput: 'EndOfInput',
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export interface Token {
  readonly type: TokenType;
  /** Raw source text, useful for error messages and number parsing. */
  readonly lexeme: string;
  /** Zero-based offset of the token's first character. */
  readonly position: number;
}

const SINGLE_CHARACTER_TOKENS: ReadonlyMap<string, TokenType> = new Map([
  ['+', TokenType.Plus],
  ['-', TokenType.Minus],
  ['*', TokenType.Star],
  ['/', TokenType.Slash],
  ['%', TokenType.Percent],
  ['(', TokenType.LeftParen],
  [')', TokenType.RightParen],
]);

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

function isWhitespace(character: string): boolean {
  return character === ' ' || character === '\t' || character === '\n' || character === '\r';
}

/**
 * Converts a canonical ASCII expression into a flat token stream.
 *
 * The tokenizer is deliberately strict: anything outside the documented
 * alphabet is rejected here rather than being silently ignored downstream.
 */
export function tokenize(source: string): Token[] {
  if (source.length > EXPRESSION_MAX_LENGTH) {
    throw new ExpressionTooComplexError(
      `Expression exceeds the maximum length of ${EXPRESSION_MAX_LENGTH} characters`,
    );
  }

  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index] as string;

    if (isWhitespace(character)) {
      index += 1;
      continue;
    }

    const singleCharacterType = SINGLE_CHARACTER_TOKENS.get(character);
    if (singleCharacterType !== undefined) {
      tokens.push({ type: singleCharacterType, lexeme: character, position: index });
      index += 1;
      continue;
    }

    if (isDigit(character) || character === '.') {
      const start = index;
      index = scanNumber(source, index);
      const lexeme = source.slice(start, index);
      tokens.push({ type: TokenType.Number, lexeme, position: start });
      continue;
    }

    throw new InvalidExpressionError(`Unexpected character ${JSON.stringify(character)}`, index);
  }

  tokens.push({ type: TokenType.EndOfInput, lexeme: '', position: source.length });
  return tokens;
}

/**
 * Scans a numeric literal starting at `start` and returns the index just past
 * it. Accepts `123`, `1.5`, `.5`, `2.`, `1e9`, `1.2E-3`.
 */
function scanNumber(source: string, start: number): number {
  let index = start;
  let digitsSeen = false;
  let separatorSeen = false;

  while (index < source.length) {
    const character = source[index] as string;
    if (isDigit(character)) {
      digitsSeen = true;
      index += 1;
      continue;
    }
    if (character === '.') {
      if (separatorSeen) {
        throw new InvalidExpressionError('Number contains more than one decimal separator', index);
      }
      separatorSeen = true;
      index += 1;
      continue;
    }
    break;
  }

  if (!digitsSeen) {
    throw new InvalidExpressionError('Decimal separator must be followed by a digit', start);
  }

  index = scanExponent(source, index);
  return index;
}

/** Scans an optional `e`/`E` exponent suffix, returning the index just past it. */
function scanExponent(source: string, start: number): number {
  const marker = source[start];
  if (marker !== 'e' && marker !== 'E') {
    return start;
  }

  let index = start + 1;
  const sign = source[index];
  if (sign === '+' || sign === '-') {
    index += 1;
  }

  let exponentDigitsSeen = false;
  while (index < source.length && isDigit(source[index] as string)) {
    exponentDigitsSeen = true;
    index += 1;
  }

  if (!exponentDigitsSeen) {
    throw new InvalidExpressionError('Exponent must be followed by at least one digit', start);
  }

  return index;
}
