import { Token, TokenType } from '../lexer/tokens.js';
import { Lexer } from '../lexer/lexer.js';
import { ASTNode } from './ast.js';
import { PrattParser } from './pratt.js';

/**
 * Produces the evaluator's AST. The grammar lives in `PrattParser`; this class only says
 * what each construct becomes — dropping the things the evaluator does not need
 * (comments, parentheses, the exact spelling of `==` / `!=`).
 */
export class Parser extends PrattParser<ASTNode> {
  static parse(source: string): ASTNode {
    return new Parser(new Lexer(source).tokenize()).parse();
  }

  protected numberLiteral(token: Token): ASTNode {
    return { type: 'NumberLiteral', value: parseFloat(token.value) };
  }

  protected stringLiteral(token: Token): ASTNode {
    return { type: 'StringLiteral', value: token.value };
  }

  protected booleanLiteral(token: Token): ASTNode {
    return { type: 'BooleanLiteral', value: token.value.toLowerCase() === 'true' };
  }

  protected nullLiteral(): ASTNode {
    return { type: 'NullLiteral' };
  }

  protected field(token: Token): ASTNode {
    return { type: 'FieldReference', parts: token.value.split('.') };
  }

  protected call(name: string, args: ASTNode[]): ASTNode {
    return { type: 'FunctionCall', name: name.toUpperCase(), args };
  }

  protected unary(operator: string, operand: ASTNode): ASTNode {
    return { type: 'UnaryExpression', operator, operand };
  }

  protected binary(token: Token, _leftBp: number, left: ASTNode, right: ASTNode): ASTNode {
    // Normalize operator: == -> =, != -> <>
    let operator = token.value;
    if (token.type === TokenType.Equal2) operator = '=';
    if (token.type === TokenType.NotEqual2) operator = '<>';
    return { type: 'BinaryExpression', operator, left, right };
  }

  /** The AST does not record parentheses — precedence is already encoded in its shape. */
  protected paren(inner: ASTNode): ASTNode {
    return inner;
  }
}
