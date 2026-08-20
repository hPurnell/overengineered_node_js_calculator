import { EXPRESSION_MAX_LENGTH } from '@calc/contracts';

import { Decimal } from '../decimal';
import {
  DivisionByZeroError,
  ExpressionTooComplexError,
  InvalidExpressionError,
  UndefinedResultError,
  isCalculationError,
} from '../errors';
import { assertEvaluable } from './guard';
import { childrenOf, math, type ParsedNode } from './math-instance';

/**
 * Parses, validates and evaluates a canonical ASCII expression.
 *
 * The pipeline is deliberately ordered: length, then parse, then the grammar
 * allowlist, and only then evaluation. Nothing is computed until the expression
 * has been proven to be arithmetic and nothing else.
 *
 * @throws {CalculationError} for every anticipated failure.
 */
export function evaluateExpression(expression: string): Decimal {
  if (expression.length > EXPRESSION_MAX_LENGTH) {
    throw new ExpressionTooComplexError(
      `Expression exceeds the maximum length of ${EXPRESSION_MAX_LENGTH} characters`,
    );
  }

  if (expression.trim().length === 0) {
    throw new InvalidExpressionError('Expression is empty');
  }

  const root = parseExpression(expression);
  assertEvaluable(root);

  const value = toDecimal(evaluateNode(root));

  if (!value.isFinite()) {
    // The result tells us something went wrong but not what; look at the tree
    // to report the specific cause the client can act on.
    throw classifyNonFinite(root);
  }

  return value;
}

function parseExpression(expression: string): ParsedNode {
  try {
    return math.parse(expression) as unknown as ParsedNode;
  } catch (cause) {
    throw new InvalidExpressionError(
      cause instanceof Error ? cause.message : 'Expression could not be parsed',
    );
  }
}

function evaluateNode(root: ParsedNode): unknown {
  try {
    return root.evaluate();
  } catch (cause) {
    if (isCalculationError(cause)) {
      throw cause;
    }
    throw new InvalidExpressionError(
      cause instanceof Error ? cause.message : 'Expression could not be evaluated',
    );
  }
}

/**
 * Converts a mathjs result into the decimal type the formatter works with.
 *
 * The hop through `toString()` is lossless — BigNumber prints every significant
 * digit it holds — and keeps the display layer independent of mathjs.
 */
function toDecimal(value: unknown): Decimal {
  if (math.isBigNumber(value)) {
    return new Decimal(value.toString());
  }

  if (typeof value === 'number') {
    return new Decimal(value);
  }

  throw new UndefinedResultError('Expression did not evaluate to a number');
}

/**
 * Distinguishes a division by zero from any other non-finite result.
 *
 * mathjs yields `Infinity` or `NaN` rather than throwing, so the specific cause
 * has to be recovered from the tree. This runs only on the failure path, so the
 * extra evaluation costs nothing in normal use.
 */
function classifyNonFinite(root: ParsedNode): Error {
  return hasZeroDivisor(root)
    ? new DivisionByZeroError()
    : new UndefinedResultError();
}

function hasZeroDivisor(node: ParsedNode): boolean {
  if (node.type === 'OperatorNode' && node.fn === 'divide') {
    const divisor = node.args?.[1];
    if (divisor !== undefined && evaluatesToZero(divisor)) {
      return true;
    }
  }

  return childrenOf(node).some(hasZeroDivisor);
}

function evaluatesToZero(node: ParsedNode): boolean {
  try {
    const value = node.evaluate();
    return math.isBigNumber(value)
      ? value.isZero()
      : typeof value === 'number' && value === 0;
  } catch {
    // A divisor we cannot evaluate is not evidence of division by zero.
    return false;
  }
}
