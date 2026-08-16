import { Token, TokenType } from '../lexer/tokens.js';
import { ParseError } from '../evaluator/errors.js';
import { getBindingPower, UNARY_BP } from './precedence.js';

/**
 * The formula grammar, written once as a Pratt (top-down operator precedence) parser.
 *
 * Subclasses supply only the node constructors, so every tree the package builds is parsed
 * by the same code: `Parser` builds the evaluator's `ASTNode`, and the formatter's
 * `FormatParser` builds the comment-carrying `FmtNode`. Add a new operator or prefix form
 * here and both trees pick it up.
 */
export abstract class PrattParser<TNode> {
  protected pos = 0;

  constructor(protected readonly tokens: Token[]) {}

  /** Parse a complete formula, requiring the whole token stream to be consumed. */
  parse(): TNode {
    const root = this.parseExpression(0);
    this.expect(TokenType.EOF, root);
    return root;
  }

  parseExpression(minBp: number): TNode {
    let left = this.parsePrefix();

    while (true) {
      const token = this.current();
      const bp = getBindingPower(token.type);
      if (!bp) break;
      const [leftBp, rightBp] = bp;
      if (leftBp < minBp) break;

      this.advance(left);
      const right = this.parseExpression(rightBp);
      left = this.binary(token, leftBp, left, right);
    }

    return left;
  }

  protected parsePrefix(): TNode {
    const token = this.current();
    let node: TNode;

    switch (token.type) {
      case TokenType.NumberLiteral:
        this.advance();
        node = this.numberLiteral(token);
        break;

      case TokenType.StringLiteral:
        this.advance();
        node = this.stringLiteral(token);
        break;

      case TokenType.BooleanLiteral:
        this.advance();
        node = this.booleanLiteral(token);
        break;

      case TokenType.NullLiteral:
        this.advance();
        node = this.nullLiteral(token);
        break;

      case TokenType.Identifier:
        this.advance();
        node = this.current().type === TokenType.LeftParen ? this.parseFunctionCall(token.value) : this.field(token);
        break;

      case TokenType.Not:
        // NOT can be a function call NOT(...) or a unary prefix operator
        this.advance();
        node =
          this.current().type === TokenType.LeftParen ? this.parseFunctionCall('NOT') : this.unary('NOT', this.parseExpression(UNARY_BP));
        break;

      case TokenType.Bang:
      case TokenType.Minus:
      case TokenType.Plus:
        this.advance();
        node = this.unary(token.value, this.parseExpression(UNARY_BP));
        break;

      case TokenType.LeftParen: {
        this.advance();
        const inner = this.parseExpression(0);
        this.expect(TokenType.RightParen, inner);
        node = this.paren(inner);
        break;
      }

      default:
        throw new ParseError(`Unexpected token '${token.value}' (${token.type})`, token.line, token.column);
    }

    return node;
  }

  protected parseFunctionCall(name: string): TNode {
    this.expect(TokenType.LeftParen);
    const args: TNode[] = [];

    // With arguments, the closing paren hands anything buffered before it to the last argument.
    // An empty call has no argument to hang them on, so they are left for `call()` to deal with.
    if (this.current().type !== TokenType.RightParen) {
      args.push(this.parseExpression(0));
      while (this.current().type === TokenType.Comma) {
        this.advance(args[args.length - 1]);
        args.push(this.parseExpression(0));
      }
      this.expect(TokenType.RightParen, args[args.length - 1]);
    } else {
      this.expect(TokenType.RightParen);
    }
    return this.call(name, args);
  }

  protected current(): Token {
    return this.tokens[this.pos]!;
  }

  /**
   * Consume the current token. `precedingNode` is the node any comments buffered before this
   * token belong to — trees that keep comments attach them there, the others ignore it.
   */
  protected advance(_precedingNode?: TNode): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  protected expect(type: TokenType, precedingNode?: TNode): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParseError(`Expected ${type} but got '${token.value}' (${token.type})`, token.line, token.column);
    }
    return this.advance(precedingNode);
  }

  protected abstract numberLiteral(token: Token): TNode;
  protected abstract stringLiteral(token: Token): TNode;
  protected abstract booleanLiteral(token: Token): TNode;
  protected abstract nullLiteral(token: Token): TNode;
  protected abstract field(token: Token): TNode;
  protected abstract call(name: string, args: TNode[]): TNode;
  protected abstract unary(operator: string, operand: TNode): TNode;
  /** `leftBp` is the operator's left binding power — its precedence level. */
  protected abstract binary(token: Token, leftBp: number, left: TNode, right: TNode): TNode;
  /** Trees that record explicit parentheses wrap `inner`; the AST returns it unchanged. */
  protected abstract paren(inner: TNode): TNode;
}
