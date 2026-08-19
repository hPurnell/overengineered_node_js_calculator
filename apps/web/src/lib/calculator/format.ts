import type { OperatorSymbol } from './types';

/**
 * Apple's display glyphs.
 *
 * The UI shows these; the wire always carries the ASCII form. Keeping the two
 * separate means the parser never has to know about typography.
 */
export const OPERATOR_GLYPHS: Readonly<Record<OperatorSymbol, string>> = {
  '+': '+',
  '-': '−', // MINUS SIGN, not HYPHEN-MINUS
  '*': '×', // MULTIPLICATION SIGN
  '/': '÷', // DIVISION SIGN
};

/** Maximum digits the readout accepts, matching the engine's display budget. */
export const MAX_ENTRY_DIGITS = 15;

/**
 * Formats an in-progress entry for the readout.
 *
 * Unlike a finished result, an entry must survive states that are not yet valid
 * numbers — a lone `-`, a trailing `.`, or trailing zeros the user is still
 * typing — so this groups the integer part and otherwise leaves the text alone.
 */
export function formatEntry(entry: string): string {
  const isNegative = entry.startsWith('-');
  const unsigned = isNegative ? entry.slice(1) : entry;

  const separatorIndex = unsigned.indexOf('.');
  const integerPart = separatorIndex === -1 ? unsigned : unsigned.slice(0, separatorIndex);
  const fractionPart = separatorIndex === -1 ? '' : unsigned.slice(separatorIndex);

  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${isNegative ? '−' : ''}${grouped || '0'}${fractionPart}`;
}

/** Counts significant digit characters, ignoring sign and decimal separator. */
export function countDigits(entry: string): number {
  let digits = 0;
  for (const character of entry) {
    if (character >= '0' && character <= '9') {
      digits += 1;
    }
  }
  return digits;
}

/**
 * Renders committed tokens plus the in-progress entry as the secondary line.
 *
 * Mirrors the expression strip in recent macOS Calculator builds, which matters
 * more here than it does on a Mac: because evaluation is deferred to the
 * server until `=`, this line is the only feedback that a `%` or a queued
 * operator was registered.
 */
export function toDisplayExpression(tokens: readonly string[], entry: string | null): string {
  const parts = entry === null ? [...tokens] : [...tokens, entry];

  return parts
    .reduce<string>((accumulator, token) => {
      if (token === '%') {
        return `${accumulator}%`;
      }

      const glyph = OPERATOR_GLYPHS[token as OperatorSymbol];
      if (glyph !== undefined) {
        return accumulator.length === 0 ? glyph : `${accumulator} ${glyph} `;
      }

      return `${accumulator}${formatEntry(token)}`;
    }, '')
    .trim();
}

/** True when the token is one of the four binary operators. */
export function isOperatorToken(token: string | undefined): token is OperatorSymbol {
  return token === '+' || token === '-' || token === '*' || token === '/';
}
