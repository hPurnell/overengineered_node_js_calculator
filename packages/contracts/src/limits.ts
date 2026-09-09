/**
 * Shared limits that are part of the wire contract.
 *
 * Declared here so the client can fail fast under the same rules the server
 * enforces, without the two drifting apart. Only limits both sides genuinely
 * need belong in this file: engine tuning that happens to be a number — the
 * arithmetic precision, the parser's nesting budget — lives in
 * `apps/api/src/engine/limits.ts`, where changing it is not a contract change.
 */
export const EXPRESSION_MAX_LENGTH = 512;

/**
 * Digits the calculator display can show before switching to scientific
 * notation. Shared because the client caps typed entry at the same budget.
 */
export const DISPLAY_MAX_SIGNIFICANT_DIGITS = 15;

/** Default and maximum page sizes for history listings. */
export const HISTORY_PAGE_DEFAULT_SIZE = 50;
export const HISTORY_PAGE_MAX_SIZE = 100;
