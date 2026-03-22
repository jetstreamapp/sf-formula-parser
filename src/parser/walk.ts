import type { ASTNode } from './ast.js';

/**
 * Walk an AST tree, calling the visitor function on each node (pre-order).
 */
export function walkAST(node: ASTNode, visitor: (node: ASTNode) => void): void {
  visitor(node);

  switch (node.type) {
    case 'FunctionCall':
      for (const arg of node.args) {
        walkAST(arg, visitor);
      }
      break;
    case 'UnaryExpression':
      walkAST(node.operand, visitor);
      break;
    case 'BinaryExpression':
      walkAST(node.left, visitor);
      walkAST(node.right, visitor);
      break;
    // Leaf nodes: NumberLiteral, StringLiteral, BooleanLiteral, NullLiteral, FieldReference
    default:
      break;
  }
}
