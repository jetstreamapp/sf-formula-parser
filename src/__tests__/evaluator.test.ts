import { describe, it, expect } from 'vitest';
import { evaluateFormula } from '../index.js';
import { FormulaError } from '../evaluator/errors.js';

const ctx = { record: {} };

describe('Evaluator – literals', () => {
  it('number literal', () => {
    expect(evaluateFormula('42', ctx)).toBe(42);
  });
  it('string literal', () => {
    expect(evaluateFormula('"hello"', ctx)).toBe('hello');
  });
  it('boolean literal true', () => {
    expect(evaluateFormula('true', ctx)).toBe(true);
  });
  it('boolean literal false', () => {
    expect(evaluateFormula('false', ctx)).toBe(false);
  });
  it('null literal', () => {
    expect(evaluateFormula('null', ctx)).toBe(null);
  });
});

describe('Evaluator – arithmetic', () => {
  it('addition', () => expect(evaluateFormula('1 + 2', ctx)).toBe(3));
  it('subtraction', () => expect(evaluateFormula('10 - 3', ctx)).toBe(7));
  it('multiplication', () => expect(evaluateFormula('2 * 3', ctx)).toBe(6));
  it('division', () => expect(evaluateFormula('10 / 4', ctx)).toBe(2.5));
  it('division by zero throws', () => {
    expect(() => evaluateFormula('1 / 0', ctx)).toThrow(FormulaError);
  });
  it('null propagates in arithmetic', () => {
    expect(evaluateFormula('null + 1', ctx)).toBe(null);
    expect(evaluateFormula('1 * null', ctx)).toBe(null);
  });
});

describe('Evaluator – exponentiation', () => {
  it('2 ^ 10 = 1024', () => expect(evaluateFormula('2 ^ 10', ctx)).toBe(1024));
  it('left-assoc: 2 ^ 3 ^ 2 = 64', () => {
    // Left-associative: (2^3)^2 = 8^2 = 64
    expect(evaluateFormula('2 ^ 3 ^ 2', ctx)).toBe(64);
  });
  it('overflow throws', () => {
    expect(() => evaluateFormula('10 ^ 100', ctx)).toThrow(FormulaError);
  });
  it('null propagates', () => {
    expect(evaluateFormula('null ^ 2', ctx)).toBe(null);
  });
});

describe('Evaluator – precedence', () => {
  it('2 + 3 * 4 = 14', () => expect(evaluateFormula('2 + 3 * 4', ctx)).toBe(14));
});

describe('Evaluator – string concatenation', () => {
  it('& operator', () => expect(evaluateFormula('"a" & "b"', ctx)).toBe('ab'));
  it('& with null', () => expect(evaluateFormula('null & "abc"', ctx)).toBe('abc'));
  it('+ between strings', () => expect(evaluateFormula('"a" + "b"', ctx)).toBe('ab'));
});

describe('Evaluator – equality', () => {
  it('1 = 1', () => expect(evaluateFormula('1 = 1', ctx)).toBe(true));
  it('1 = 2', () => expect(evaluateFormula('1 = 2', ctx)).toBe(false));
  it('null = "" (string context)', () => expect(evaluateFormula('null = ""', ctx)).toBe(true));
  it('null = 0 (three-valued)', () => expect(evaluateFormula('null = 0', ctx)).toBe(null));
  it('"" <> "a"', () => expect(evaluateFormula('"" <> "a"', ctx)).toBe(true));
});

describe('Evaluator – comparison', () => {
  it('1 < 2', () => expect(evaluateFormula('1 < 2', ctx)).toBe(true));
  it('2 > 1', () => expect(evaluateFormula('2 > 1', ctx)).toBe(true));
  it('1 <= 1', () => expect(evaluateFormula('1 <= 1', ctx)).toBe(true));
  it('2 >= 3', () => expect(evaluateFormula('2 >= 3', ctx)).toBe(false));
  it('null > 5 → null', () => expect(evaluateFormula('null > 5', ctx)).toBe(null));
  it('null < 5 → null', () => expect(evaluateFormula('null < 5', ctx)).toBe(null));
});

describe('Evaluator – logical operators', () => {
  it('true && true', () => expect(evaluateFormula('true && true', ctx)).toBe(true));
  it('true && false', () => expect(evaluateFormula('true && false', ctx)).toBe(false));
  it('true || false', () => expect(evaluateFormula('true || false', ctx)).toBe(true));
  it('false || false', () => expect(evaluateFormula('false || false', ctx)).toBe(false));
  it('null && true → false', () => expect(evaluateFormula('null && true', ctx)).toBe(false));
  it('null || true → true', () => expect(evaluateFormula('null || true', ctx)).toBe(true));
});

describe('Evaluator – unary operators', () => {
  it('negation', () => expect(evaluateFormula('-5', ctx)).toBe(-5));
  it('!true', () => expect(evaluateFormula('!true', ctx)).toBe(false));
  it('!false', () => expect(evaluateFormula('!false', ctx)).toBe(true));
  it('!null → null', () => expect(evaluateFormula('!null', ctx)).toBe(null));
  it('-null → null', () => expect(evaluateFormula('-null', ctx)).toBe(null));
});

describe('Evaluator – field references', () => {
  it('simple field lookup', () => {
    expect(evaluateFormula('Amount', { record: { Amount: 100 } })).toBe(100);
  });
  it('case-insensitive field lookup', () => {
    expect(evaluateFormula('amount', { record: { Amount: 100 } })).toBe(100);
  });
  it('dotted field (related record)', () => {
    expect(
      evaluateFormula('Account.Name', {
        record: { Account: { Name: 'Acme' } },
      }),
    ).toBe('Acme');
  });
  it('global reference ($User.Id)', () => {
    expect(
      evaluateFormula('$User.Id', {
        record: {},
        globals: { $User: { Id: '005xxx' } },
      }),
    ).toBe('005xxx');
  });
  it('null traversal for missing related', () => {
    expect(evaluateFormula('Account.Name', { record: {} })).toBe(null);
  });
  it('null traversal for missing field', () => {
    expect(evaluateFormula('MissingField', { record: {} })).toBe(null);
  });
});

describe('Evaluator – date arithmetic', () => {
  it('Date + Number adds days', () => {
    const baseDate = new Date('2024-01-01T00:00:00.000Z');
    const result = evaluateFormula('MyDate + 5', { record: { MyDate: baseDate } });
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-01-06T00:00:00.000Z');
  });
  it('Date - Date returns days between', () => {
    const d1 = new Date('2024-01-10T00:00:00.000Z');
    const d2 = new Date('2024-01-01T00:00:00.000Z');
    const result = evaluateFormula('D1 - D2', { record: { D1: d1, D2: d2 } });
    expect(result).toBe(9);
  });
});

describe('Evaluator – unknown function', () => {
  it('throws FormulaError for unknown function', () => {
    expect(() => evaluateFormula('UNKNOWN_FUNC(1)', ctx)).toThrow(FormulaError);
  });
});
