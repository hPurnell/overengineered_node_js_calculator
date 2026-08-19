/**
 * Shared safety limits.
 *
 * Declared in the contract package so the client can fail fast with the same
 * rules the server enforces, without the two drifting apart.
 */
export const EXPRESSION_MAX_LENGTH = 512;

/** Maximum nesting depth of parentheses / unary operators the parser accepts. */
export const EXPRESSION_MAX_DEPTH = 32;

/** Significant digits retained by the computation engine. */
export const COMPUTATION_PRECISION = 34;

/** Digits the calculator display can show before switching to scientific notation. */
export const DISPLAY_MAX_SIGNIFICANT_DIGITS = 15;

/** Default and maximum page sizes for history listings. */
export const HISTORY_PAGE_DEFAULT_SIZE = 50;
export const HISTORY_PAGE_MAX_SIZE = 100;
