export type ASTNode =
  | NumberLiteralNode
  | StringLiteralNode
  | BooleanLiteralNode
  | NullLiteralNode
  | FieldReferenceNode
  | FunctionCallNode
  | UnaryExpressionNode
  | BinaryExpressionNode;

export interface NumberLiteralNode {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteralNode {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteralNode {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface NullLiteralNode {
  type: 'NullLiteral';
}

export interface FieldReferenceNode {
  type: 'FieldReference';
  parts: string[];
}

export interface FunctionCallNode {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

export interface UnaryExpressionNode {
  type: 'UnaryExpression';
  operator: string;
  operand: ASTNode;
}

export interface BinaryExpressionNode {
  type: 'BinaryExpression';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}
