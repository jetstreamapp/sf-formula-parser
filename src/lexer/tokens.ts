export enum TokenType {
  // Literals
  NumberLiteral = 'NumberLiteral',
  StringLiteral = 'StringLiteral',
  BooleanLiteral = 'BooleanLiteral',
  NullLiteral = 'NullLiteral',
  Identifier = 'Identifier',

  // Operators
  Plus = 'Plus', // +
  Minus = 'Minus', // -
  Star = 'Star', // *
  Div = 'Div', // /
  Exponent = 'Exponent', // ^
  Concat = 'Concat', // & (single)
  Equal = 'Equal', // =
  Equal2 = 'Equal2', // ==
  NotEqual = 'NotEqual', // <>
  NotEqual2 = 'NotEqual2', // !=
  Lt = 'Lt', // <
  Gt = 'Gt', // >
  Le = 'Le', // <=
  Ge = 'Ge', // >=
  InfixAnd = 'InfixAnd', // &&
  InfixOr = 'InfixOr', // ||
  Bang = 'Bang', // !
  Not = 'Not', // NOT keyword

  // Delimiters
  LeftParen = 'LeftParen', // (
  RightParen = 'RightParen', // )
  Comma = 'Comma', // ,

  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}
