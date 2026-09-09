/**
 * Tuning constants for the computation engine.
 *
 * These are implementation details of the evaluator, not part of any contract:
 * the precision the BigNumber arithmetic runs at and the nesting budget the
 * grammar guard enforces. Nothing outside `engine/` reads them, and no client
 * needs to — a request that breaches the depth budget comes back as an
 * `EXPRESSION_TOO_COMPLEX` error, which is the part of it that *is* public.
 *
 * They previously lived in `@calc/contracts`, where they were shipped to the
 * browser and implied a promise to the client that the engine never made.
 * Wire-level limits the client genuinely shares — `EXPRESSION_MAX_LENGTH`,
 * page sizes — stay in the contract package.
 */

/** Significant digits retained by the computation engine. */
export const COMPUTATION_PRECISION = 34;

/** Maximum nesting depth of parentheses / unary operators the parser accepts. */
export const EXPRESSION_MAX_DEPTH = 32;
