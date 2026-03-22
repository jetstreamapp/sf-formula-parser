import { describe, it, expect } from 'vitest';
import { Lexer, TokenType } from '../lexer/index.js';
import { LexerError } from '../evaluator/errors.js';

function tokenize(source: string) {
  return new Lexer(source).tokenize();
}

function types(source: string) {
  return tokenize(source).map(t => t.type);
}

function values(source: string) {
  return tokenize(source).map(t => t.value);
}

describe('Lexer', () => {
  describe('operators', () => {
    it.each([
      ['+', TokenType.Plus],
      ['-', TokenType.Minus],
      ['*', TokenType.Star],
      ['/', TokenType.Div],
      ['^', TokenType.Exponent],
      ['&', TokenType.Concat],
      ['=', TokenType.Equal],
      ['==', TokenType.Equal2],
      ['<>', TokenType.NotEqual],
      ['!=', TokenType.NotEqual2],
      ['<', TokenType.Lt],
      ['>', TokenType.Gt],
      ['<=', TokenType.Le],
      ['>=', TokenType.Ge],
      ['&&', TokenType.InfixAnd],
      ['||', TokenType.InfixOr],
      ['!', TokenType.Bang],
    ])('tokenizes %s as %s', (input, expectedType) => {
      const tokens = tokenize(input);
      expect(tokens[0]!.type).toBe(expectedType);
      expect(tokens[0]!.value).toBe(input);
    });
  });

  describe('delimiters', () => {
    it('tokenizes parentheses and comma', () => {
      const tokens = tokenize('(,)');
      expect(types(',')).toEqual([TokenType.Comma, TokenType.EOF]);
      expect(tokens[0]!.type).toBe(TokenType.LeftParen);
      expect(tokens[1]!.type).toBe(TokenType.Comma);
      expect(tokens[2]!.type).toBe(TokenType.RightParen);
    });
  });

  describe('number literals', () => {
    it('tokenizes integers', () => {
      const tokens = tokenize('42');
      expect(tokens[0]!.type).toBe(TokenType.NumberLiteral);
      expect(tokens[0]!.value).toBe('42');
    });

    it('tokenizes decimals', () => {
      const tokens = tokenize('3.14');
      expect(tokens[0]!.type).toBe(TokenType.NumberLiteral);
      expect(tokens[0]!.value).toBe('3.14');
    });

    it('tokenizes number without fractional digits as integer only', () => {
      // "3." followed by non-digit should be just "3"
      const tokens = tokenize('3 + 2');
      expect(tokens[0]!.value).toBe('3');
      expect(tokens[2]!.value).toBe('2');
    });
  });

  describe('string literals', () => {
    it('tokenizes double-quoted strings', () => {
      const tokens = tokenize('"hello"');
      expect(tokens[0]!.type).toBe(TokenType.StringLiteral);
      expect(tokens[0]!.value).toBe('hello');
    });

    it('tokenizes single-quoted strings', () => {
      const tokens = tokenize("'world'");
      expect(tokens[0]!.type).toBe(TokenType.StringLiteral);
      expect(tokens[0]!.value).toBe('world');
    });

    it('handles escape sequences: \\n \\r \\t \\" \\\' \\\\', () => {
      const tokens = tokenize('"\\n\\r\\t\\\"\\\'\\\\"');
      expect(tokens[0]!.value).toBe('\n\r\t"\'\\');
    });

    it('handles uppercase escape sequences: \\N \\R \\T', () => {
      const tokens = tokenize('"\\N\\R\\T"');
      expect(tokens[0]!.value).toBe('\n\r\t');
    });

    it('preserves unknown escape sequences', () => {
      const tokens = tokenize('"\\x"');
      expect(tokens[0]!.value).toBe('\\x');
    });
  });

  describe('boolean literals', () => {
    it.each(['true', 'TRUE', 'True', 'tRuE'])('tokenizes %s as BooleanLiteral', input => {
      const tokens = tokenize(input);
      expect(tokens[0]!.type).toBe(TokenType.BooleanLiteral);
      expect(tokens[0]!.value).toBe(input);
    });

    it.each(['false', 'FALSE', 'False'])('tokenizes %s as BooleanLiteral', input => {
      const tokens = tokenize(input);
      expect(tokens[0]!.type).toBe(TokenType.BooleanLiteral);
      expect(tokens[0]!.value).toBe(input);
    });
  });

  describe('null literal', () => {
    it.each(['null', 'NULL', 'Null'])('tokenizes %s as NullLiteral', input => {
      const tokens = tokenize(input);
      expect(tokens[0]!.type).toBe(TokenType.NullLiteral);
      expect(tokens[0]!.value).toBe(input);
    });
  });

  describe('NOT keyword', () => {
    it.each(['NOT', 'not', 'Not'])('tokenizes %s as Not', input => {
      const tokens = tokenize(input);
      expect(tokens[0]!.type).toBe(TokenType.Not);
      expect(tokens[0]!.value).toBe(input);
    });
  });

  describe('identifiers', () => {
    it('tokenizes simple identifiers', () => {
      const tokens = tokenize('Amount');
      expect(tokens[0]!.type).toBe(TokenType.Identifier);
      expect(tokens[0]!.value).toBe('Amount');
    });

    it('tokenizes dotted paths as single token', () => {
      const tokens = tokenize('Account.Name');
      expect(tokens[0]!.type).toBe(TokenType.Identifier);
      expect(tokens[0]!.value).toBe('Account.Name');
    });

    it('tokenizes $ prefixed identifiers', () => {
      const tokens = tokenize('$User.Id');
      expect(tokens[0]!.type).toBe(TokenType.Identifier);
      expect(tokens[0]!.value).toBe('$User.Id');
    });

    it('tokenizes colon-separated identifiers', () => {
      const tokens = tokenize('Contact:User.Name');
      expect(tokens[0]!.type).toBe(TokenType.Identifier);
      expect(tokens[0]!.value).toBe('Contact:User.Name');
    });

    it('tokenizes AND and OR as identifiers', () => {
      expect(tokenize('AND')[0]!.type).toBe(TokenType.Identifier);
      expect(tokenize('OR')[0]!.type).toBe(TokenType.Identifier);
      expect(tokenize('and')[0]!.type).toBe(TokenType.Identifier);
      expect(tokenize('or')[0]!.type).toBe(TokenType.Identifier);
    });

    it('tokenizes identifiers with # character', () => {
      const tokens = tokenize('Field#Value');
      expect(tokens[0]!.type).toBe(TokenType.Identifier);
      expect(tokens[0]!.value).toBe('Field#Value');
    });
  });

  describe('multi-token formulas', () => {
    it('tokenizes IF(Amount > 1000, "big", "small")', () => {
      const tokens = tokenize('IF(Amount > 1000, "big", "small")');
      const expectedTypes = [
        TokenType.Identifier, // IF
        TokenType.LeftParen, // (
        TokenType.Identifier, // Amount
        TokenType.Gt, // >
        TokenType.NumberLiteral, // 1000
        TokenType.Comma, // ,
        TokenType.StringLiteral, // big
        TokenType.Comma, // ,
        TokenType.StringLiteral, // small
        TokenType.RightParen, // )
        TokenType.EOF,
      ];
      expect(types('IF(Amount > 1000, "big", "small")')).toEqual(expectedTypes);
      expect(tokens[0]!.value).toBe('IF');
      expect(tokens[4]!.value).toBe('1000');
      expect(tokens[6]!.value).toBe('big');
      expect(tokens[8]!.value).toBe('small');
    });
  });

  describe('block comments', () => {
    it('strips block comments', () => {
      const tokens = tokenize('1 + /* comment */ 2');
      expect(types('1 + /* comment */ 2')).toEqual([TokenType.NumberLiteral, TokenType.Plus, TokenType.NumberLiteral, TokenType.EOF]);
      expect(tokens[0]!.value).toBe('1');
      expect(tokens[2]!.value).toBe('2');
    });

    it('strips multiline block comments', () => {
      const tokens = tokenize('1 + /* line1\nline2 */ 2');
      expect(tokens.length).toBe(4); // 1, +, 2, EOF
    });
  });

  describe('error cases', () => {
    it('throws LexerError for unterminated string', () => {
      expect(() => tokenize('"hello')).toThrow(LexerError);
      expect(() => tokenize('"hello')).toThrow(/Unterminated string/);
    });

    it('throws LexerError for unterminated block comment', () => {
      expect(() => tokenize('/* comment')).toThrow(LexerError);
      expect(() => tokenize('/* comment')).toThrow(/Unterminated block comment/);
    });

    it('throws LexerError for unexpected character', () => {
      expect(() => tokenize('~')).toThrow(LexerError);
      expect(() => tokenize('~')).toThrow(/Unexpected character/);
    });

    it('throws LexerError for lone pipe', () => {
      expect(() => tokenize('|')).toThrow(LexerError);
    });
  });

  describe('whitespace and line/column tracking', () => {
    it('skips whitespace', () => {
      const tokens = tokenize('  1  +  2  ');
      expect(types('  1  +  2  ')).toEqual([TokenType.NumberLiteral, TokenType.Plus, TokenType.NumberLiteral, TokenType.EOF]);
    });

    it('tracks line and column for single line', () => {
      const tokens = tokenize('1 + 2');
      expect(tokens[0]).toMatchObject({ line: 1, column: 1 });
      expect(tokens[1]).toMatchObject({ line: 1, column: 3 });
      expect(tokens[2]).toMatchObject({ line: 1, column: 5 });
    });

    it('tracks line and column across newlines', () => {
      const tokens = tokenize('1\n+ 2');
      expect(tokens[0]).toMatchObject({ line: 1, column: 1 }); // 1
      expect(tokens[1]).toMatchObject({ line: 2, column: 1 }); // +
      expect(tokens[2]).toMatchObject({ line: 2, column: 3 }); // 2
    });

    it('handles tabs as single column advance', () => {
      const tokens = tokenize('\t1');
      expect(tokens[0]).toMatchObject({ line: 1, column: 2 });
    });
  });

  describe('EOF', () => {
    it('produces EOF for empty input', () => {
      const tokens = tokenize('');
      expect(tokens.length).toBe(1);
      expect(tokens[0]!.type).toBe(TokenType.EOF);
    });

    it('always ends with EOF', () => {
      const tokens = tokenize('42');
      expect(tokens[tokens.length - 1]!.type).toBe(TokenType.EOF);
    });
  });
});
