import { LexerError } from '../evaluator/errors.js';
import { Token, TokenType } from './tokens.js';

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
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
        this.skipBlockComment();
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
          this.pushToken(TokenType.Plus, '+', startLine, startCol);
          this.advance();
          break;
        case '-':
          this.pushToken(TokenType.Minus, '-', startLine, startCol);
          this.advance();
          break;
        case '*':
          this.pushToken(TokenType.Star, '*', startLine, startCol);
          this.advance();
          break;
        case '/':
          this.pushToken(TokenType.Div, '/', startLine, startCol);
          this.advance();
          break;
        case '^':
          this.pushToken(TokenType.Exponent, '^', startLine, startCol);
          this.advance();
          break;
        case '&':
          if (this.peek(1) === '&') {
            this.pushToken(TokenType.InfixAnd, '&&', startLine, startCol);
            this.advance();
            this.advance();
          } else {
            this.pushToken(TokenType.Concat, '&', startLine, startCol);
            this.advance();
          }
          break;
        case '|':
          if (this.peek(1) === '|') {
            this.pushToken(TokenType.InfixOr, '||', startLine, startCol);
            this.advance();
            this.advance();
          } else {
            throw new LexerError(`Unexpected character '|'`, startLine, startCol);
          }
          break;
        case '=':
          if (this.peek(1) === '=') {
            this.pushToken(TokenType.Equal2, '==', startLine, startCol);
            this.advance();
            this.advance();
          } else {
            this.pushToken(TokenType.Equal, '=', startLine, startCol);
            this.advance();
          }
          break;
        case '!':
          if (this.peek(1) === '=') {
            this.pushToken(TokenType.NotEqual2, '!=', startLine, startCol);
            this.advance();
            this.advance();
          } else {
            this.pushToken(TokenType.Bang, '!', startLine, startCol);
            this.advance();
          }
          break;
        case '<':
          if (this.peek(1) === '>') {
            this.pushToken(TokenType.NotEqual, '<>', startLine, startCol);
            this.advance();
            this.advance();
          } else if (this.peek(1) === '=') {
            this.pushToken(TokenType.Le, '<=', startLine, startCol);
            this.advance();
            this.advance();
          } else {
            this.pushToken(TokenType.Lt, '<', startLine, startCol);
            this.advance();
          }
          break;
        case '>':
          if (this.peek(1) === '=') {
            this.pushToken(TokenType.Ge, '>=', startLine, startCol);
            this.advance();
            this.advance();
          } else {
            this.pushToken(TokenType.Gt, '>', startLine, startCol);
            this.advance();
          }
          break;
        case '(':
          this.pushToken(TokenType.LeftParen, '(', startLine, startCol);
          this.advance();
          break;
        case ')':
          this.pushToken(TokenType.RightParen, ')', startLine, startCol);
          this.advance();
          break;
        case ',':
          this.pushToken(TokenType.Comma, ',', startLine, startCol);
          this.advance();
          break;
        default:
          throw new LexerError(`Unexpected character '${ch}'`, startLine, startCol);
      }
    }

    this.pushToken(TokenType.EOF, '', this.line, this.column);
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

  private pushToken(type: TokenType, value: string, line: number, column: number): void {
    this.tokens.push({ type, value, line, column });
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

  private skipBlockComment(): void {
    const startLine = this.line;
    const startCol = this.column;
    // Skip '/*'
    this.advance();
    this.advance();

    while (this.pos < this.source.length) {
      if (this.source[this.pos] === '*' && this.peek(1) === '/') {
        this.advance();
        this.advance();
        return;
      }
      this.advance();
    }

    throw new LexerError('Unterminated block comment', startLine, startCol);
  }

  private readNumber(): void {
    const startLine = this.line;
    const startCol = this.column;
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

    this.pushToken(TokenType.NumberLiteral, value, startLine, startCol);
  }

  private readString(quote: string): void {
    const startLine = this.line;
    const startCol = this.column;
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
        this.pushToken(TokenType.StringLiteral, value, startLine, startCol);
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
    let value = '';

    while (this.pos < this.source.length && this.isIdentPart(this.source[this.pos]!)) {
      value += this.source[this.pos]!;
      this.advance();
    }

    const lower = value.toLowerCase();

    if (lower === 'true' || lower === 'false') {
      this.pushToken(TokenType.BooleanLiteral, value, startLine, startCol);
    } else if (lower === 'null') {
      this.pushToken(TokenType.NullLiteral, value, startLine, startCol);
    } else if (lower === 'not') {
      this.pushToken(TokenType.Not, value, startLine, startCol);
    } else {
      this.pushToken(TokenType.Identifier, value, startLine, startCol);
    }
  }
}
