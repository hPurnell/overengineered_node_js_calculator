import { ExpressionTooComplexError, InvalidExpressionError } from '../errors';
import { EXPRESSION_MAX_DEPTH } from '../limits';
import { childrenOf, math, type ParsedNode } from './math-instance';

/**
 * Node types the calculator accepts.
 *
 * This allowlist is the security boundary, and it is not optional. mathjs is a
 * full computer-algebra system: left unrestricted, `evaluate` accepts function
 * definitions, variable assignment and builtin calls, and an expression as
 * short as `zeros(20000,20000)` will exhaust the heap and take the API process
 * down with it. Rejecting unknown node types at parse time — before a single
 * operation runs — is what keeps an untrusted request body harmless.
 */
const ALLOWED_NODE_TYPES: ReadonlySet<string> = new Set([
  'OperatorNode',
  'ConstantNode',
  'ParenthesisNode',
]);

/**
 * Operators the grammar exposes.
 *
 * mathjs would happily evaluate `^`, `mod`, comparisons and bitwise operators;
 * a four-function calculator must not. Percent needs no entry here because
 * mathjs resolves it during parsing into these operators.
 */
const ALLOWED_OPERATORS: ReadonlySet<string> = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'unaryMinus',
  'unaryPlus',
]);

function isNumericLiteral(value: unknown): boolean {
  return math.isBigNumber(value) || typeof value === 'number';
}

/** Node types that count towards the nesting budget. */
function increasesDepth(node: ParsedNode): boolean {
  if (node.type === 'ParenthesisNode') {
    return true;
  }
  // Unary operators nest; chained binary operators do not, so a long flat
  // expression like `1+1+1+…` never approaches the limit.
  return (
    node.type === 'OperatorNode' &&
    (node.fn === 'unaryMinus' || node.fn === 'unaryPlus')
  );
}

/**
 * Rejects anything outside the calculator's grammar.
 *
 * @throws {InvalidExpressionError} for a node type or operator we do not expose.
 * @throws {ExpressionTooComplexError} when nesting exceeds the configured budget.
 */
export function assertEvaluable(root: ParsedNode): void {
  walk(root, 0);
}

function walk(node: ParsedNode, depth: number): void {
  if (!ALLOWED_NODE_TYPES.has(node.type)) {
    throw new InvalidExpressionError(
      `Expression contains an unsupported construct (${node.type})`,
    );
  }

  if (node.type === 'OperatorNode' && !ALLOWED_OPERATORS.has(node.fn ?? '')) {
    throw new InvalidExpressionError(
      `Operator ${JSON.stringify(node.fn ?? '?')} is not supported`,
    );
  }

  // A ConstantNode is not necessarily a number: mathjs parses `"ab"`, `true`
  // and `null` into one too. Without this check a string literal would pass the
  // allowlist and only fail later, reported as an unevaluable result (422)
  // rather than what it is — a malformed expression (400).
  if (node.type === 'ConstantNode' && !isNumericLiteral(node.value)) {
    throw new InvalidExpressionError('Expression contains a non-numeric literal');
  }

  const nextDepth = increasesDepth(node) ? depth + 1 : depth;
  if (nextDepth > EXPRESSION_MAX_DEPTH) {
    throw new ExpressionTooComplexError(
      `Expression nests deeper than the maximum of ${EXPRESSION_MAX_DEPTH}`,
    );
  }

  for (const child of childrenOf(node)) {
    walk(child, nextDepth);
  }
}
