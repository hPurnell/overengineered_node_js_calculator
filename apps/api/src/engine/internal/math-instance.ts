import { all, create, type FactoryFunctionMap } from 'mathjs';

import { COMPUTATION_PRECISION } from '@calc/contracts';

/**
 * A private mathjs instance configured for exact decimal arithmetic.
 *
 * Created with `create()` rather than using the default export so our number
 * type and precision cannot be changed by, or leak into, any other consumer of
 * mathjs in the same process.
 *
 * `number: 'BigNumber'` is what makes `0.1 + 0.2` exactly `0.3`: every literal
 * becomes an arbitrary-precision decimal instead of an IEEE-754 double.
 */
// mathjs declares `all` as possibly undefined for bundlers that tree-shake it
// away; in a normal import it is always populated.
export const math = create(all as FactoryFunctionMap, {
  number: 'BigNumber',
  precision: COMPUTATION_PRECISION,
});

/** The node shape we care about; mathjs's own types are deliberately loose. */
export interface ParsedNode {
  readonly type: string;
  /** Present on OperatorNode: the function the operator compiles to. */
  readonly fn?: string;
  readonly args?: readonly ParsedNode[];
  readonly content?: ParsedNode;
  /** Present on ConstantNode: the literal's value. */
  readonly value?: unknown;
  evaluate(): unknown;
}

/**
 * mathjs exposes children differently per node type (`args` on operators,
 * `content` on parentheses); normalise that into one accessor.
 */
export function childrenOf(node: ParsedNode): readonly ParsedNode[] {
  if (node.args !== undefined) {
    return node.args;
  }
  return node.content === undefined ? [] : [node.content];
}
