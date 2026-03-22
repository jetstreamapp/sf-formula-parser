import { describe, it, expect } from 'vitest';
import { Parser } from '../parser/parser.js';
import { ASTNode } from '../parser/ast.js';
import { ParseError } from '../evaluator/errors.js';

function parse(source: string): ASTNode {
  return Parser.parse(source);
}

describe('Parser', () => {
  describe('literals', () => {
    it('parses number literals', () => {
      expect(parse('42')).toEqual({ type: 'NumberLiteral', value: 42 });
    });

    it('parses decimal number literals', () => {
      expect(parse('3.14')).toEqual({ type: 'NumberLiteral', value: 3.14 });
    });

    it('parses string literals', () => {
      expect(parse('"hello"')).toEqual({ type: 'StringLiteral', value: 'hello' });
    });

    it('parses boolean true', () => {
      expect(parse('true')).toEqual({ type: 'BooleanLiteral', value: true });
    });

    it('parses boolean false', () => {
      expect(parse('false')).toEqual({ type: 'BooleanLiteral', value: false });
    });

    it('parses null literal', () => {
      expect(parse('null')).toEqual({ type: 'NullLiteral' });
    });
  });

  describe('field references', () => {
    it('parses simple field', () => {
      expect(parse('Amount')).toEqual({ type: 'FieldReference', parts: ['Amount'] });
    });

    it('parses dotted field reference', () => {
      expect(parse('Account.Name')).toEqual({
        type: 'FieldReference',
        parts: ['Account', 'Name'],
      });
    });

    it('parses global variable reference', () => {
      expect(parse('$User.Id')).toEqual({
        type: 'FieldReference',
        parts: ['$User', 'Id'],
      });
    });
  });

  describe('function calls', () => {
    it('parses function with arguments', () => {
      expect(parse('IF(a, b, c)')).toEqual({
        type: 'FunctionCall',
        name: 'IF',
        args: [
          { type: 'FieldReference', parts: ['a'] },
          { type: 'FieldReference', parts: ['b'] },
          { type: 'FieldReference', parts: ['c'] },
        ],
      });
    });

    it('parses zero-arg function', () => {
      expect(parse('NOW()')).toEqual({
        type: 'FunctionCall',
        name: 'NOW',
        args: [],
      });
    });

    it('normalizes function names to uppercase', () => {
      expect(parse('now()')).toEqual({
        type: 'FunctionCall',
        name: 'NOW',
        args: [],
      });
    });

    it('parses nested functions', () => {
      expect(parse('IF(ISBLANK(x), 0, x)')).toEqual({
        type: 'FunctionCall',
        name: 'IF',
        args: [
          {
            type: 'FunctionCall',
            name: 'ISBLANK',
            args: [{ type: 'FieldReference', parts: ['x'] }],
          },
          { type: 'NumberLiteral', value: 0 },
          { type: 'FieldReference', parts: ['x'] },
        ],
      });
    });

    it('parses AND as function call', () => {
      expect(parse('AND(a, b)')).toEqual({
        type: 'FunctionCall',
        name: 'AND',
        args: [
          { type: 'FieldReference', parts: ['a'] },
          { type: 'FieldReference', parts: ['b'] },
        ],
      });
    });

    it('parses OR as function call', () => {
      expect(parse('OR(a, b)')).toEqual({
        type: 'FunctionCall',
        name: 'OR',
        args: [
          { type: 'FieldReference', parts: ['a'] },
          { type: 'FieldReference', parts: ['b'] },
        ],
      });
    });

    it('parses NOT as function call when followed by paren', () => {
      expect(parse('NOT(x)')).toEqual({
        type: 'FunctionCall',
        name: 'NOT',
        args: [{ type: 'FieldReference', parts: ['x'] }],
      });
    });
  });

  describe('unary operators', () => {
    it('parses unary minus', () => {
      expect(parse('-x')).toEqual({
        type: 'UnaryExpression',
        operator: '-',
        operand: { type: 'FieldReference', parts: ['x'] },
      });
    });

    it('parses unary plus', () => {
      expect(parse('+x')).toEqual({
        type: 'UnaryExpression',
        operator: '+',
        operand: { type: 'FieldReference', parts: ['x'] },
      });
    });

    it('parses bang operator', () => {
      expect(parse('!x')).toEqual({
        type: 'UnaryExpression',
        operator: '!',
        operand: { type: 'FieldReference', parts: ['x'] },
      });
    });

    it('parses NOT as unary prefix operator', () => {
      expect(parse('NOT x')).toEqual({
        type: 'UnaryExpression',
        operator: 'NOT',
        operand: { type: 'FieldReference', parts: ['x'] },
      });
    });
  });

  describe('binary operators and precedence', () => {
    it('parses addition', () => {
      expect(parse('1 + 2')).toEqual({
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'NumberLiteral', value: 1 },
        right: { type: 'NumberLiteral', value: 2 },
      });
    });

    it('multiply has higher precedence than add: 1 + 2 * 3', () => {
      expect(parse('1 + 2 * 3')).toEqual({
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'NumberLiteral', value: 1 },
        right: {
          type: 'BinaryExpression',
          operator: '*',
          left: { type: 'NumberLiteral', value: 2 },
          right: { type: 'NumberLiteral', value: 3 },
        },
      });
    });

    it('exponent is BELOW multiply: 2 * 3 ^ 4', () => {
      // Salesforce-specific: ^ binds less tightly than *
      expect(parse('2 * 3 ^ 4')).toEqual({
        type: 'BinaryExpression',
        operator: '^',
        left: {
          type: 'BinaryExpression',
          operator: '*',
          left: { type: 'NumberLiteral', value: 2 },
          right: { type: 'NumberLiteral', value: 3 },
        },
        right: { type: 'NumberLiteral', value: 4 },
      });
    });

    it('exponent is LEFT-associative: 2 ^ 3 ^ 2', () => {
      // Salesforce-specific: NOT right-associative like math
      expect(parse('2 ^ 3 ^ 2')).toEqual({
        type: 'BinaryExpression',
        operator: '^',
        left: {
          type: 'BinaryExpression',
          operator: '^',
          left: { type: 'NumberLiteral', value: 2 },
          right: { type: 'NumberLiteral', value: 3 },
        },
        right: { type: 'NumberLiteral', value: 2 },
      });
    });

    it('concat is same level as add: 1 + 2 & "x"', () => {
      // Left-associative at same level means (1 + 2) & "x"
      expect(parse('1 + 2 & "x"')).toEqual({
        type: 'BinaryExpression',
        operator: '&',
        left: {
          type: 'BinaryExpression',
          operator: '+',
          left: { type: 'NumberLiteral', value: 1 },
          right: { type: 'NumberLiteral', value: 2 },
        },
        right: { type: 'StringLiteral', value: 'x' },
      });
    });

    it('OR is lowest precedence: true || false && true', () => {
      expect(parse('true || false && true')).toEqual({
        type: 'BinaryExpression',
        operator: '||',
        left: { type: 'BooleanLiteral', value: true },
        right: {
          type: 'BinaryExpression',
          operator: '&&',
          left: { type: 'BooleanLiteral', value: false },
          right: { type: 'BooleanLiteral', value: true },
        },
      });
    });

    it('comparison precedence: a = b && c = d', () => {
      expect(parse('a = b && c = d')).toEqual({
        type: 'BinaryExpression',
        operator: '&&',
        left: {
          type: 'BinaryExpression',
          operator: '=',
          left: { type: 'FieldReference', parts: ['a'] },
          right: { type: 'FieldReference', parts: ['b'] },
        },
        right: {
          type: 'BinaryExpression',
          operator: '=',
          left: { type: 'FieldReference', parts: ['c'] },
          right: { type: 'FieldReference', parts: ['d'] },
        },
      });
    });
  });

  describe('operator normalization', () => {
    it('normalizes == to =', () => {
      const ast = parse('a == b');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '=',
        left: { type: 'FieldReference', parts: ['a'] },
        right: { type: 'FieldReference', parts: ['b'] },
      });
    });

    it('normalizes != to <>', () => {
      const ast = parse('a != b');
      expect(ast).toEqual({
        type: 'BinaryExpression',
        operator: '<>',
        left: { type: 'FieldReference', parts: ['a'] },
        right: { type: 'FieldReference', parts: ['b'] },
      });
    });
  });

  describe('parentheses', () => {
    it('parses grouped expression: (1 + 2) * 3', () => {
      expect(parse('(1 + 2) * 3')).toEqual({
        type: 'BinaryExpression',
        operator: '*',
        left: {
          type: 'BinaryExpression',
          operator: '+',
          left: { type: 'NumberLiteral', value: 1 },
          right: { type: 'NumberLiteral', value: 2 },
        },
        right: { type: 'NumberLiteral', value: 3 },
      });
    });

    it('parses nested parentheses', () => {
      expect(parse('((1))')).toEqual({ type: 'NumberLiteral', value: 1 });
    });
  });

  describe('error handling', () => {
    it('throws on unexpected token at end', () => {
      expect(() => parse('1 + 2 )')).toThrow(ParseError);
    });

    it('throws on missing closing paren', () => {
      expect(() => parse('(1 + 2')).toThrow(ParseError);
    });

    it('throws on empty expression', () => {
      expect(() => parse('')).toThrow(ParseError);
    });

    it('throws on missing function closing paren', () => {
      expect(() => parse('IF(a, b')).toThrow(ParseError);
    });
  });
});
