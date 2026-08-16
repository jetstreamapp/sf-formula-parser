import type { ASTNode } from '../parser/ast.js';
import { FormulaError } from '../evaluator/errors.js';
import { getBindingPowerForOperator } from '../parser/precedence.js';
import { FmtNode, withComments } from './cst.js';

/**
 * The operator's precedence level (higher binds tighter), used to decide where an AST needs
 * parentheses to print back to an equivalent formula. Unknown operators (only possible in
 * hand-built ASTs) bind loosest so they are always parenthesized when nested.
 */
function precedenceOf(operator: string): number {
  return getBindingPowerForOperator(operator)?.[0] ?? 0;
}

/**
 * Convert an AST into the formatter's tree, inserting exactly the parentheses required
 * by operator precedence and serializing literals so the output lexes back to the same values.
 */
export function fromAST(node: ASTNode): FmtNode {
  switch (node.type) {
    case 'NumberLiteral':
      return withComments({ kind: 'literal', text: numberToText(node.value) });
    case 'StringLiteral':
      return withComments({ kind: 'literal', text: quoteString(node.value) });
    case 'BooleanLiteral':
      return withComments({ kind: 'literal', text: node.value ? 'TRUE' : 'FALSE' });
    case 'NullLiteral':
      return withComments({ kind: 'literal', text: 'NULL' });
    case 'FieldReference':
      return withComments({ kind: 'field', text: node.parts.join('.') });
    case 'FunctionCall':
      return withComments({ kind: 'call', name: node.name.toUpperCase(), args: node.args.map(fromAST), dangling: [] });
    case 'UnaryExpression': {
      // Any binary operand binds looser than a unary operator and so needs parentheses: -(a + b).
      // `NOT` is the exception: `NOT` followed by `(` always lexes as a function call, so the only
      // spelling of a parenthesized NOT is the call form — which means exactly the same thing.
      const operand = fromAST(node.operand);
      if (node.operand.type !== 'BinaryExpression') {
        return withComments({ kind: 'unary', operator: node.operator, operand });
      }
      if (node.operator === 'NOT') {
        return withComments({ kind: 'call', name: 'NOT', args: [operand], dangling: [] });
      }
      return withComments({ kind: 'unary', operator: node.operator, operand: parenthesize(operand) });
    }
    case 'BinaryExpression': {
      const precedence = precedenceOf(node.operator);
      let left = fromAST(node.left);
      let right = fromAST(node.right);
      // Left-associative: a looser left child needs parens, a looser-or-equal right child needs parens
      if (node.left.type === 'BinaryExpression' && precedenceOf(node.left.operator) < precedence) {
        left = parenthesize(left);
      }
      if (node.right.type === 'BinaryExpression' && precedenceOf(node.right.operator) <= precedence) {
        right = parenthesize(right);
      }
      return withComments({ kind: 'binary', operator: node.operator, precedence, left, right });
    }
  }
}

function parenthesize(inner: FmtNode): FmtNode {
  return withComments({ kind: 'paren', inner });
}

/** Print a number so it lexes back to the same value — the lexer has no exponent syntax, so `1e21` / `1e-7` are expanded. */
function numberToText(value: number): string {
  if (!Number.isFinite(value)) {
    throw new FormulaError(`Cannot format non-finite number literal: ${value}`);
  }
  const text = String(value);
  const exponentIndex = text.indexOf('e');
  if (exponentIndex === -1) return text;

  // Shift the decimal point of the shortest round-trip mantissa by the exponent
  const mantissa = text.slice(0, exponentIndex);
  const exponent = Number(text.slice(exponentIndex + 1));
  const sign = mantissa.startsWith('-') ? '-' : '';
  const [integerPart = '', fractionPart = ''] = mantissa.replace('-', '').split('.');
  const digits = integerPart + fractionPart;
  const pointIndex = integerPart.length + exponent;

  if (pointIndex <= 0) return `${sign}0.${'0'.repeat(-pointIndex)}${digits}`;
  if (pointIndex >= digits.length) return `${sign}${digits}${'0'.repeat(pointIndex - digits.length)}`;
  return `${sign}${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`;
}

/**
 * Quote a string value using the lexer's escape rules. Prefers double quotes; falls back to
 * single quotes when the value contains a double quote but no single quote.
 */
function quoteString(value: string): string {
  const quote = value.includes('"') && !value.includes("'") ? "'" : '"';
  let escaped = '';
  for (const ch of value) {
    switch (ch) {
      case '\\':
        escaped += '\\\\';
        break;
      case '\n':
        escaped += '\\n';
        break;
      case '\r':
        escaped += '\\r';
        break;
      case '\t':
        escaped += '\\t';
        break;
      case quote:
        escaped += '\\' + quote;
        break;
      default:
        escaped += ch;
    }
  }
  return quote + escaped + quote;
}
