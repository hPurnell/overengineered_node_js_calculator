/** Binary arithmetic operators supported by the grammar. */
export const BinaryOperator = {
  Add: 'Add',
  Subtract: 'Subtract',
  Multiply: 'Multiply',
  Divide: 'Divide',
} as const;

export type BinaryOperator = (typeof BinaryOperator)[keyof typeof BinaryOperator];

/** Prefix operators supported by the grammar. */
export const UnaryOperator = {
  Negate: 'Negate',
  Identity: 'Identity',
} as const;

export type UnaryOperator = (typeof UnaryOperator)[keyof typeof UnaryOperator];

export interface NumberLiteralNode {
  readonly kind: 'NumberLiteral';
  /** Raw lexeme, converted to a Decimal at evaluation time. */
  readonly lexeme: string;
  readonly position: number;
}

export interface UnaryNode {
  readonly kind: 'Unary';
  readonly operator: UnaryOperator;
  readonly operand: ExpressionNode;
  readonly position: number;
}

export interface BinaryNode {
  readonly kind: 'Binary';
  readonly operator: BinaryOperator;
  readonly left: ExpressionNode;
  readonly right: ExpressionNode;
  readonly position: number;
}

/**
 * Postfix `%`.
 *
 * Modelled as its own node rather than folded into a division because Apple's
 * calculators give `%` a context-sensitive meaning: as the right operand of
 * `+`/`-` it means "percent *of the left operand*", everywhere else it simply
 * divides by 100. Only the evaluator, which can see the parent operator, has
 * enough information to resolve that.
 */
export interface PercentNode {
  readonly kind: 'Percent';
  readonly operand: ExpressionNode;
  readonly position: number;
}

export type ExpressionNode = NumberLiteralNode | UnaryNode | BinaryNode | PercentNode;
