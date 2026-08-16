import { LexerError } from '../evaluator/errors.js';
import { Token, TokenType } from './tokens.js';

export interface LexerOptions {
  /**
   * Emit `Comment` tokens instead of silently skipping block comments.
   * Used by the formatter to preserve comments; the parser does not accept comment tokens.
   */
  preserveComments?: boolean;
}

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  private preserveComments: boolean;

  constructor(source: string, options: LexerOptions = {}) {
    this.source = source;
    this.preserveComments = options.preserveComments ?? false;
  }

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos]!;

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
        continue;
      }

      // Block comment
      if (ch === '/' && this.peek(1) === '*') {
        this.readBlockComment();
        continue;
      }

      // Number literal
      if (ch >= '0' && ch <= '9') {
        this.readNumber();
        continue;
      }

      // String literal
      if (ch === '"' || ch === "'") {
        this.readString(ch);
        continue;
      }

      // Identifier / keyword
      if (this.isIdentStart(ch)) {
        this.readIdentifier();
        continue;
      }

      // Operators and delimiters
      const startLine = this.line;
      const startCol = this.column;

      switch (ch) {
        case '+':
          this.pushOperator(TokenType.Plus, '+', startLine, startCol);
          break;
        case '-':
          this.pushOperator(TokenType.Minus, '-', startLine, startCol);
          break;
        case '*':
          this.pushOperator(TokenType.Star, '*', startLine, startCol);
          break;
        case '/':
          this.pushOperator(TokenType.Div, '/', startLine, startCol);
          break;
        case '^':
          this.pushOperator(TokenType.Exponent, '^', startLine, startCol);
          break;
        case '&':
          if (this.peek(1) === '&') {
            this.pushOperator(TokenType.InfixAnd, '&&', startLine, startCol);
          } else {
            this.pushOperator(TokenType.Concat, '&', startLine, startCol);
          }
          break;
        case '|':
          if (this.peek(1) === '|') {
            this.pushOperator(TokenType.InfixOr, '||', startLine, startCol);
          } else {
            throw new LexerError(`Unexpected character '|'`, startLine, startCol);
          }
          break;
        case '=':
          if (this.peek(1) === '=') {
            this.pushOperator(TokenType.Equal2, '==', startLine, startCol);
          } else {
            this.pushOperator(TokenType.Equal, '=', startLine, startCol);
          }
          break;
        case '!':
          if (this.peek(1) === '=') {
            this.pushOperator(TokenType.NotEqual2, '!=', startLine, startCol);
          } else {
            this.pushOperator(TokenType.Bang, '!', startLine, startCol);
          }
          break;
        case '<':
          if (this.peek(1) === '>') {
            this.pushOperator(TokenType.NotEqual, '<>', startLine, startCol);
          } else if (this.peek(1) === '=') {
            this.pushOperator(TokenType.Le, '<=', startLine, startCol);
          } else {
            this.pushOperator(TokenType.Lt, '<', startLine, startCol);
          }
          break;
        case '>':
          if (this.peek(1) === '=') {
            this.pushOperator(TokenType.Ge, '>=', startLine, startCol);
          } else {
            this.pushOperator(TokenType.Gt, '>', startLine, startCol);
          }
          break;
        case '(':
          this.pushOperator(TokenType.LeftParen, '(', startLine, startCol);
          break;
        case ')':
          this.pushOperator(TokenType.RightParen, ')', startLine, startCol);
          break;
        case ',':
          this.pushOperator(TokenType.Comma, ',', startLine, startCol);
          break;
        default:
          throw new LexerError(`Unexpected character '${ch}'`, startLine, startCol);
      }
    }

    this.pushToken(TokenType.EOF, '', this.line, this.column, this.pos);
    return this.tokens;
  }

  private advance(): void {
    if (this.pos < this.source.length) {
      if (this.source[this.pos] === '\n') {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.pos++;
    }
  }

  private peek(offset: number): string | undefined {
    return this.source[this.pos + offset];
  }

  /** Push a token that ends at the current position (call after consuming the token's characters). */
  private pushToken(type: TokenType, value: string, line: number, column: number, start: number): void {
    this.tokens.push({ type, value, line, column, start, end: this.pos });
  }

  /** Consume `value.length` characters starting at the current position and push the resulting token. */
  private pushOperator(type: TokenType, value: string, line: number, column: number): void {
    const start = this.pos;
    for (let i = 0; i < value.length; i++) {
      this.advance();
    }
    this.pushToken(type, value, line, column, start);
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '$';
  }

  private isIdentPart(ch: string): boolean {
    return (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '_' ||
      ch === '$' ||
      ch === '.' ||
      ch === ':' ||
      ch === '#'
    );
  }

  private readBlockComment(): void {
    const startLine = this.line;
    const startCol = this.column;
    const start = this.pos;
    // Skip '/*'
    this.advance();
    this.advance();

    while (this.pos < this.source.length) {
      if (this.source[this.pos] === '*' && this.peek(1) === '/') {
        this.advance();
        this.advance();
        if (this.preserveComments) {
          this.pushToken(TokenType.Comment, this.source.slice(start, this.pos), startLine, startCol, start);
        }
        return;
      }
      this.advance();
    }

    throw new LexerError('Unterminated block comment', startLine, startCol);
  }

  private readNumber(): void {
    const startLine = this.line;
    const startCol = this.column;
    const start = this.pos;
    let value = '';

    while (this.pos < this.source.length && this.source[this.pos]! >= '0' && this.source[this.pos]! <= '9') {
      value += this.source[this.pos]!;
      this.advance();
    }

    if (
      this.pos < this.source.length &&
      this.source[this.pos] === '.' &&
      this.peek(1) !== undefined &&
      this.peek(1)! >= '0' &&
      this.peek(1)! <= '9'
    ) {
      value += '.';
      this.advance();
      while (this.pos < this.source.length && this.source[this.pos]! >= '0' && this.source[this.pos]! <= '9') {
        value += this.source[this.pos]!;
        this.advance();
      }
    }

    this.pushToken(TokenType.NumberLiteral, value, startLine, startCol, start);
  }

  private readString(quote: string): void {
    const startLine = this.line;
    const startCol = this.column;
    const start = this.pos;
    this.advance(); // skip opening quote
    let value = '';

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos]!;

      if (ch === '\\') {
        this.advance();
        if (this.pos >= this.source.length) {
          throw new LexerError('Unterminated string literal', startLine, startCol);
        }
        const escaped = this.source[this.pos]!;
        switch (escaped) {
          case 'n':
          case 'N':
            value += '\n';
            break;
          case 'r':
          case 'R':
            value += '\r';
            break;
          case 't':
          case 'T':
            value += '\t';
            break;
          case '"':
            value += '"';
            break;
          case "'":
            value += "'";
            break;
          case '\\':
            value += '\\';
            break;
          default:
            value += '\\' + escaped;
            break;
        }
        this.advance();
        continue;
      }

      if (ch === quote) {
        this.advance(); // skip closing quote
        this.pushToken(TokenType.StringLiteral, value, startLine, startCol, start);
        return;
      }

      value += ch;
      this.advance();
    }

    throw new LexerError('Unterminated string literal', startLine, startCol);
  }

  private readIdentifier(): void {
    const startLine = this.line;
    const startCol = this.column;
    const start = this.pos;
    let value = '';

    while (this.pos < this.source.length && this.isIdentPart(this.source[this.pos]!)) {
      value += this.source[this.pos]!;
      this.advance();
    }

    const lower = value.toLowerCase();

    if (lower === 'true' || lower === 'false') {
      this.pushToken(TokenType.BooleanLiteral, value, startLine, startCol, start);
    } else if (lower === 'null') {
      this.pushToken(TokenType.NullLiteral, value, startLine, startCol, start);
    } else if (lower === 'not') {
      this.pushToken(TokenType.Not, value, startLine, startCol, start);
    } else {
      this.pushToken(TokenType.Identifier, value, startLine, startCol, start);
    }
  }
}
