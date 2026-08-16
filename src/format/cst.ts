/**
 * A comment attached to a format node.
 * `newlineBefore` / `newlineAfter` record whether the source had a line break on
 * either side, so own-line comments stay on their own line and inline comments stay inline.
 */
export interface FmtComment {
  text: string;
  newlineBefore: boolean;
  newlineAfter: boolean;
}

interface FmtNodeBase {
  leading: FmtComment[];
  trailing: FmtComment[];
}

/** A number, string, boolean or null literal — `text` is printed verbatim. */
export interface FmtLiteral extends FmtNodeBase {
  kind: 'literal';
  text: string;
}

/** A field reference such as `Account.Name` or `$User.Id` — `text` is printed verbatim. */
export interface FmtField extends FmtNodeBase {
  kind: 'field';
  text: string;
}

export interface FmtCall extends FmtNodeBase {
  kind: 'call';
  /** Already upper-cased. */
  name: string;
  args: FmtNode[];
  /** Comments inside a call with no arguments, e.g. a comment between the parentheses of `TODAY()`. */
  dangling: FmtComment[];
}

export interface FmtUnary extends FmtNodeBase {
  kind: 'unary';
  /** `-`, `+`, `!` or `NOT`. */
  operator: string;
  operand: FmtNode;
}

export interface FmtBinary extends FmtNodeBase {
  kind: 'binary';
  /** Operator text as written (`==` and `!=` are not normalized). */
  operator: string;
  /** Precedence level shared by all operators of the same binding power. */
  precedence: number;
  left: FmtNode;
  right: FmtNode;
}

/** An explicitly parenthesized expression — parentheses are always preserved. */
export interface FmtParen extends FmtNodeBase {
  kind: 'paren';
  inner: FmtNode;
}

/**
 * Concrete-syntax tree used by the formatter. Unlike `ASTNode`, it keeps
 * everything the AST intentionally drops: comments, parentheses, raw literal
 * text and the exact operator spelling.
 *
 * Two front-ends build it: `parse.ts` from formula source, `from-ast.ts` from an `ASTNode`.
 */
export type FmtNode = FmtLiteral | FmtField | FmtCall | FmtUnary | FmtBinary | FmtParen;

/**
 * Any `FmtNode` shape minus its comment fields. The conditional makes the `Omit` distribute
 * over the union — a plain `Omit<FmtNode, …>` collapses to the members' common keys (`kind`)
 * and would validate nothing.
 */
type FmtNodeInit<T = FmtNode> = T extends FmtNode ? Omit<T, 'leading' | 'trailing'> : never;

export function withComments<T extends FmtNodeInit>(node: T): T & FmtNodeBase {
  return { ...node, leading: [], trailing: [] };
}
