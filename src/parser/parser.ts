import { Token, TokenType } from '../lexer/tokens.js';
import { Lexer } from '../lexer/lexer.js';
import { ParseError } from '../evaluator/errors.js';
import { ASTNode } from './ast.js';
import { getBindingPower, UNARY_BP } from './precedence.js';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  static parse(source: string): ASTNode {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parseExpression(0);
    parser.expect(TokenType.EOF);
    return ast;
  }

  parseExpression(minBp: number): ASTNode {
    let left = this.parsePrefix();

    while (true) {
      const token = this.current();
      const bp = getBindingPower(token.type);
      if (!bp) break;
      const [leftBp, rightBp] = bp;
      if (leftBp < minBp) break;

      this.advance();
      const right = this.parseExpression(rightBp);

      // Normalize operator: == -> =, != -> <>
      let operator = token.value;
      if (token.type === TokenType.Equal2) operator = '=';
      if (token.type === TokenType.NotEqual2) operator = '<>';

      left = { type: 'BinaryExpression', operator, left, right };
    }

    return left;
  }

  private parsePrefix(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case TokenType.NumberLiteral:
        this.advance();
        return { type: 'NumberLiteral', value: parseFloat(token.value) };

      case TokenType.StringLiteral:
        this.advance();
        return { type: 'StringLiteral', value: token.value };

      case TokenType.BooleanLiteral:
        this.advance();
        return { type: 'BooleanLiteral', value: token.value.toLowerCase() === 'true' };

      case TokenType.NullLiteral:
        this.advance();
        return { type: 'NullLiteral' };

      case TokenType.Identifier: {
        const name = token.value;
        this.advance();
        if (this.current().type === TokenType.LeftParen) {
          return this.parseFunctionCall(name);
        }
        // Field reference — split on '.'
        const parts = name.split('.');
        return { type: 'FieldReference', parts };
      }

      case TokenType.Not: {
        // NOT can be a function call NOT(...) or a unary prefix operator
        this.advance();
        if (this.current().type === TokenType.LeftParen) {
          return this.parseFunctionCall('NOT');
        }
        // Unary prefix NOT
        const operand = this.parseExpression(UNARY_BP);
        return { type: 'UnaryExpression', operator: 'NOT', operand };
      }

      case TokenType.Bang: {
        this.advance();
        const operand = this.parseExpression(UNARY_BP);
        return { type: 'UnaryExpression', operator: '!', operand };
      }

      case TokenType.Minus: {
        this.advance();
        const operand = this.parseExpression(UNARY_BP);
        return { type: 'UnaryExpression', operator: '-', operand };
      }

      case TokenType.Plus: {
        this.advance();
        const operand = this.parseExpression(UNARY_BP);
        return { type: 'UnaryExpression', operator: '+', operand };
      }

      case TokenType.LeftParen: {
        this.advance();
        const expr = this.parseExpression(0);
        this.expect(TokenType.RightParen);
        return expr;
      }

      default:
        throw new ParseError(`Unexpected token '${token.value}' (${token.type})`, token.line, token.column);
    }
  }

  private parseFunctionCall(name: string): ASTNode {
    this.expect(TokenType.LeftParen);
    const args: ASTNode[] = [];

    if (this.current().type !== TokenType.RightParen) {
      args.push(this.parseExpression(0));
      while (this.current().type === TokenType.Comma) {
        this.advance();
        args.push(this.parseExpression(0));
      }
    }

    this.expect(TokenType.RightParen);
    return { type: 'FunctionCall', name: name.toUpperCase(), args };
  }

  private current(): Token {
    return this.tokens[this.pos]!;
  }

  private advance(): Token {
    const token = this.tokens[this.pos]!;
    this.pos++;
    return token;
  }

  private expect(type: TokenType): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParseError(`Expected ${type} but got '${token.value}' (${token.type})`, token.line, token.column);
    }
    this.advance();
    return token;
  }
}
