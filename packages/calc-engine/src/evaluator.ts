import {
  BinaryOperator,
  type BinaryNode,
  type ExpressionNode,
  UnaryOperator,
} from './ast';
import { Decimal } from './decimal';
import { DivisionByZeroError, InvalidExpressionError, UndefinedResultError } from './errors';

const ONE_HUNDRED = new Decimal(100);

/**
 * Evaluates a parsed expression to an exact decimal value.
 *
 * Throws a {@link CalculationError} subclass for every anticipated failure; any
 * other throw is a bug in the engine.
 */
export function evaluate(node: ExpressionNode): Decimal {
  const value = evaluateNode(node);

  if (!value.isFinite()) {
    throw new UndefinedResultError('Result is not a finite number', node.position);
  }

  return value;
}

function evaluateNode(node: ExpressionNode): Decimal {
  switch (node.kind) {
    case 'NumberLiteral':
      return parseLiteral(node.lexeme, node.position);

    case 'Unary':
      return node.operator === UnaryOperator.Negate
        ? evaluateNode(node.operand).negated()
        : evaluateNode(node.operand);

    case 'Percent':
      // A percent that is *not* the right operand of `+`/`-` is a plain
      // division by 100; the additive case is handled in evaluateBinary.
      return evaluateNode(node.operand).dividedBy(ONE_HUNDRED);

    case 'Binary':
      return evaluateBinary(node);
  }
}

function evaluateBinary(node: BinaryNode): Decimal {
  const left = evaluateNode(node.left);
  const right = evaluateRightOperand(node, left);

  switch (node.operator) {
    case BinaryOperator.Add:
      return left.plus(right);

    case BinaryOperator.Subtract:
      return left.minus(right);

    case BinaryOperator.Multiply:
      return left.times(right);

    case BinaryOperator.Divide:
      if (right.isZero()) {
        throw new DivisionByZeroError('Division by zero', node.position);
      }
      return left.dividedBy(right);
  }
}

/**
 * Resolves the right-hand operand, applying Apple's context-sensitive reading
 * of `%`.
 *
 * `200 + 10%` is 220, not 200.1: as the right operand of an additive operator,
 * a percentage is taken *of the left operand*. Under `*` and `/`, and anywhere
 * else, `%` is simply "divide by 100" and needs no context.
 */
function evaluateRightOperand(node: BinaryNode, left: Decimal): Decimal {
  const isAdditive =
    node.operator === BinaryOperator.Add || node.operator === BinaryOperator.Subtract;

  if (isAdditive && node.right.kind === 'Percent') {
    const percentage = evaluateNode(node.right.operand);
    return left.times(percentage).dividedBy(ONE_HUNDRED);
  }

  return evaluateNode(node.right);
}

function parseLiteral(lexeme: string, position: number): Decimal {
  try {
    return new Decimal(lexeme);
  } catch {
    // Unreachable for tokenizer output, but keeps the engine total if the AST
    // is ever constructed by hand.
    throw new InvalidExpressionError(`Invalid numeric literal ${JSON.stringify(lexeme)}`, position);
  }
}
