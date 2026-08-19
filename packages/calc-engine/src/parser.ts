import { EXPRESSION_MAX_DEPTH } from '@calc/contracts';

import {
  BinaryOperator,
  type ExpressionNode,
  UnaryOperator,
} from './ast';
import { ExpressionTooComplexError, InvalidExpressionError } from './errors';
import { type Token, TokenType, tokenize } from './tokenizer';

const ADDITIVE_OPERATORS: ReadonlyMap<TokenType, BinaryOperator> = new Map([
  [TokenType.Plus, BinaryOperator.Add],
  [TokenType.Minus, BinaryOperator.Subtract],
]);

const MULTIPLICATIVE_OPERATORS: ReadonlyMap<TokenType, BinaryOperator> = new Map([
  [TokenType.Star, BinaryOperator.Multiply],
  [TokenType.Slash, BinaryOperator.Divide],
]);

/**
 * Recursive-descent parser for the calculator grammar:
 *
 * ```
 * expression  := term (('+' | '-') term)*
 * term        := unary (('*' | '/') unary)*
 * unary       := ('-' | '+') unary | postfix
 * postfix     := primary '%'*
 * primary     := NUMBER | '(' expression ')'
 * ```
 *
 * Left-associative binaries are built iteratively so that a long flat chain
 * such as `1+1+1+...` costs no recursion depth; only parentheses and prefix
 * operators nest, and those are bounded by {@link EXPRESSION_MAX_DEPTH}.
 */
class Parser {
  private readonly tokens: readonly Token[];
  private cursor = 0;
  private depth = 0;

  constructor(tokens: readonly Token[]) {
    this.tokens = tokens;
  }

  parse(): ExpressionNode {
    const expression = this.parseExpression();
    const token = this.peek();
    if (token.type !== TokenType.EndOfInput) {
      throw new InvalidExpressionError(
        `Unexpected token ${JSON.stringify(token.lexeme)} after a complete expression`,
        token.position,
      );
    }
    return expression;
  }

  private parseExpression(): ExpressionNode {
    let left = this.parseTerm();

    for (;;) {
      const operator = ADDITIVE_OPERATORS.get(this.peek().type);
      if (operator === undefined) {
        return left;
      }
      const token = this.advance();
      const right = this.parseTerm();
      left = { kind: 'Binary', operator, left, right, position: token.position };
    }
  }

  private parseTerm(): ExpressionNode {
    let left = this.parseUnary();

    for (;;) {
      const operator = MULTIPLICATIVE_OPERATORS.get(this.peek().type);
      if (operator === undefined) {
        return left;
      }
      const token = this.advance();
      const right = this.parseUnary();
      left = { kind: 'Binary', operator, left, right, position: token.position };
    }
  }

  private parseUnary(): ExpressionNode {
    const token = this.peek();

    if (token.type === TokenType.Minus || token.type === TokenType.Plus) {
      this.advance();
      return this.nested(token, () => ({
        kind: 'Unary',
        operator: token.type === TokenType.Minus ? UnaryOperator.Negate : UnaryOperator.Identity,
        operand: this.parseUnary(),
        position: token.position,
      }));
    }

    return this.parsePostfix();
  }

  private parsePostfix(): ExpressionNode {
    let node = this.parsePrimary();

    while (this.peek().type === TokenType.Percent) {
      const token = this.advance();
      node = { kind: 'Percent', operand: node, position: token.position };
    }

    return node;
  }

  private parsePrimary(): ExpressionNode {
    const token = this.peek();

    if (token.type === TokenType.Number) {
      this.advance();
      return { kind: 'NumberLiteral', lexeme: token.lexeme, position: token.position };
    }

    if (token.type === TokenType.LeftParen) {
      this.advance();
      const expression = this.nested(token, () => this.parseExpression());
      const closing = this.peek();
      if (closing.type !== TokenType.RightParen) {
        throw new InvalidExpressionError('Missing closing parenthesis', closing.position);
      }
      this.advance();
      return expression;
    }

    if (token.type === TokenType.EndOfInput) {
      throw new InvalidExpressionError('Expression ended unexpectedly', token.position);
    }

    throw new InvalidExpressionError(
      `Expected a number or "(" but found ${JSON.stringify(token.lexeme)}`,
      token.position,
    );
  }

  /** Runs `build` one level deeper, enforcing the nesting budget. */
  private nested<T>(token: Token, build: () => T): T {
    this.depth += 1;
    if (this.depth > EXPRESSION_MAX_DEPTH) {
      throw new ExpressionTooComplexError(
        `Expression nests deeper than the maximum of ${EXPRESSION_MAX_DEPTH}`,
        token.position,
      );
    }
    try {
      return build();
    } finally {
      this.depth -= 1;
    }
  }

  private peek(): Token {
    // The tokenizer always appends EndOfInput, so this index is never out of range.
    return this.tokens[this.cursor] as Token;
  }

  private advance(): Token {
    const token = this.peek();
    if (token.type !== TokenType.EndOfInput) {
      this.cursor += 1;
    }
    return token;
  }
}

/** Parses a canonical ASCII expression into an abstract syntax tree. */
export function parse(source: string): ExpressionNode {
  return new Parser(tokenize(source)).parse();
}
