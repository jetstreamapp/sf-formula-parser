import { Doc, group, indent, join, line, softline, hardline, literalline } from './doc.js';
import type { FmtBinary, FmtCall, FmtComment, FmtNode, FmtUnary } from './cst.js';

/**
 * Functions whose arguments come in (value, result) pairs. The number is the index of
 * the first pair: CASE(expr, v1, r1, ..., else) starts at 1, IFS(c1, r1, ..., else) at 0.
 * When such a call breaks across lines, each pair is kept together on one line.
 */
const PAIRED_ARG_FUNCTIONS: Record<string, number> = {
  CASE: 1,
  IFS: 0,
};

export function printNode(node: FmtNode): Doc {
  return wrapWithComments(node, printBare(node));
}

function printBare(node: FmtNode): Doc {
  switch (node.kind) {
    case 'literal':
    case 'field':
      return node.text;
    case 'call':
      return printCall(node);
    case 'unary':
      return printUnary(node);
    case 'binary':
      return printBinary(node);
    case 'paren':
      return group(['(', indent([softline, printNode(node.inner)]), softline, ')']);
  }
}

function printCall(node: FmtCall): Doc {
  if (node.args.length === 0) {
    const dangling = node.dangling.map(comment => printComment(comment));
    return [node.name, '(', join(' ', dangling), ')'];
  }

  const items = groupPairedArgs(node);
  return [node.name, '(', group([indent([softline, join([',', line], items)]), softline]), ')'];
}

/** Print call arguments, keeping CASE/IFS (value, result) pairs together as one item. */
function groupPairedArgs(node: FmtCall): Doc[] {
  const printed = node.args.map(arg => printNode(arg));
  const pairStart = PAIRED_ARG_FUNCTIONS[node.name];
  if (pairStart === undefined || printed.length < pairStart + 2) {
    return printed;
  }

  const items: Doc[] = printed.slice(0, pairStart);
  let i = pairStart;
  for (; i + 1 < printed.length; i += 2) {
    items.push(group([printed[i]!, ',', indent([line, printed[i + 1]!])]));
  }
  // Odd trailing argument (the "else" value)
  if (i < printed.length) {
    items.push(printed[i]!);
  }
  return items;
}

function printUnary(node: FmtUnary): Doc {
  const operand = printNode(node.operand);
  if (node.operator === 'NOT') {
    return ['NOT ', operand];
  }
  // Keep `- -x` / `+ +x` from collapsing into `--x` / `++x`, and separate the operator from a leading comment
  const needsSpace = node.operand.leading.length > 0 || (isSign(node.operator) && startsWithSign(node.operand));
  return [node.operator, needsSpace ? ' ' : '', operand];
}

/**
 * Whether the operand's first printed character is `-` or `+`. That is a nested sign operator, or
 * a literal that already carries one — a negative number, which only a hand-built AST can produce.
 */
function startsWithSign(operand: FmtNode): boolean {
  if (operand.kind === 'unary') return isSign(operand.operator);
  if (operand.kind === 'literal') return isSign(operand.text.charAt(0));
  return false;
}

function isSign(operator: string): boolean {
  return operator === '-' || operator === '+';
}

/**
 * Print a chain of same-precedence binary operators (`a & b & c`) as one group:
 * flat when it fits, otherwise broken after every operator with the continuation indented.
 */
function printBinary(node: FmtBinary): Doc {
  const operands: Doc[] = [];
  const operators: string[] = [];

  // Flatten the left-nested chain of operators with the same precedence. A left operand that is
  // parenthesized, higher precedence, or carries a trailing comment ends the chain and is printed as its own unit.
  let current: FmtBinary = node;
  while (true) {
    operands.unshift(printNode(current.right));
    operators.unshift(current.operator);
    const left = current.left;
    if (left.kind === 'binary' && left.precedence === node.precedence && left.trailing.length === 0) {
      current = left;
    } else {
      operands.unshift(printNode(left));
      break;
    }
  }

  const rest: Doc[] = [];
  operators.forEach((operator, index) => {
    rest.push(' ', operator, line, operands[index + 1]!);
  });
  return group([operands[0]!, indent(rest)]);
}

/** Wrap a printed node with its leading and trailing comments. */
function wrapWithComments(node: FmtNode, doc: Doc): Doc {
  if (node.leading.length === 0 && node.trailing.length === 0) return doc;

  const parts: Doc[] = [];
  for (const comment of node.leading) {
    parts.push(printComment(comment), comment.newlineAfter ? hardline : ' ');
  }
  parts.push(doc);
  for (const comment of node.trailing) {
    parts.push(comment.newlineBefore ? hardline : ' ', printComment(comment));
  }
  return parts;
}

/** Comment text is emitted verbatim; inner lines of a multi-line comment keep their original layout. */
function printComment(comment: FmtComment): Doc {
  const lines = comment.text.split(/\r?\n/);
  return lines.length === 1 ? comment.text : join(literalline, lines);
}
