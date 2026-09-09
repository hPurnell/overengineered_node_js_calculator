import { DISPLAY_MAX_SIGNIFICANT_DIGITS } from '@calc/contracts';

import { Decimal } from './decimal';

/**
 * Base-10 exponent at or above which the display switches to scientific
 * notation, because the integer part no longer fits in the digit budget.
 */
const SCIENTIFIC_UPPER_EXPONENT = DISPLAY_MAX_SIGNIFICANT_DIGITS;

/**
 * Base-10 exponent at or below which the display switches to scientific
 * notation, matching Apple's cut-off for very small magnitudes.
 */
const SCIENTIFIC_LOWER_EXPONENT = -7;

const GROUP_SEPARATOR = ',';
const DECIMAL_SEPARATOR = '.';

/**
 * MINUS SIGN (U+2212), not HYPHEN-MINUS.
 *
 * Apple's calculator renders negatives with the typographic minus, and so does
 * the client when it formats an in-progress entry. Emitting the ASCII hyphen
 * here would put two different glyphs on adjacent lines of the same history
 * row, so the display string owns the display glyph.
 */
const MINUS_SIGN = '\u2212';

/**
 * Renders a value the way the macOS Calculator display does.
 *
 * Values are first rounded to the display's significant-digit budget so that
 * an exact-but-unshowable result such as `1/3` reads as `0.333333333333333`
 * rather than being truncated mid-digit.
 */
export function formatForDisplay(value: Decimal): string {
  if (!value.isFinite()) {
    return 'Not a number';
  }

  if (value.isZero()) {
    // Decimal distinguishes -0 from 0; the display should not.
    return '0';
  }

  const rounded = value.toSignificantDigits(DISPLAY_MAX_SIGNIFICANT_DIGITS);
  const exponent = rounded.e;

  if (exponent >= SCIENTIFIC_UPPER_EXPONENT || exponent <= SCIENTIFIC_LOWER_EXPONENT) {
    return formatScientific(rounded);
  }

  const plain = rounded.toFixed();
  return withDisplayMinus(addGrouping(plain));
}

/**
 * Canonical, lossless serialisation of a result for storage and transport.
 *
 * Kept separate from {@link formatForDisplay}: the display is lossy by design,
 * whereas this string must round-trip back into a Decimal unchanged.
 */
export function toCanonicalString(value: Decimal): string {
  return value.toString();
}

function formatScientific(value: Decimal): string {
  // `toExponential()` without an argument keeps only the digits it needs, so
  // 1e+16 stays "1e+16" rather than "1.00000000000000e+16".
  // Only the mantissa's sign is converted; the exponent keeps the ASCII form
  // that scientific notation is conventionally written with.
  return withDisplayMinus(value.toExponential());
}

/** Swaps a leading ASCII hyphen for the typographic minus sign. */
function withDisplayMinus(formatted: string): string {
  return formatted.startsWith('-') ? `${MINUS_SIGN}${formatted.slice(1)}` : formatted;
}

const GROUPING_PATTERN = /\B(?=(\d{3})+(?!\d))/g;

function addGrouping(plain: string): string {
  const isNegative = plain.startsWith('-');
  const unsigned = isNegative ? plain.slice(1) : plain;

  const separatorIndex = unsigned.indexOf(DECIMAL_SEPARATOR);
  const integerPart = separatorIndex === -1 ? unsigned : unsigned.slice(0, separatorIndex);
  const fractionPart = separatorIndex === -1 ? '' : unsigned.slice(separatorIndex);

  const grouped = integerPart.replace(GROUPING_PATTERN, GROUP_SEPARATOR);

  return `${isNegative ? '-' : ''}${grouped}${fractionPart}`;
}
