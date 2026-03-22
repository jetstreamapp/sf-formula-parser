import { describe, it, expect } from 'vitest';
import { evaluateFormula } from '../index.js';
import { FormulaError } from '../evaluator/errors.js';
import type { FormulaValue, SfTime, FormulaContext } from '../evaluator/context.js';
import {
  DATE_TESTS,
  DAY_TESTS,
  MONTH_TESTS,
  YEAR_TESTS,
  WEEKDAY_TESTS,
  ADDMONTHS_TESTS,
  DATEVALUE_TESTS,
  DATETIMEVALUE_TESTS,
  TIMEVALUE_TESTS,
  DATE_ARITHMETIC_TESTS,
  DAYOFYEAR_TESTS,
  ISOWEEK_TESTS,
  ISOYEAR_TESTS,
  UNIXTIMESTAMP_TESTS,
} from './test-cases.js';

const ctx: FormulaContext = { record: {} };

/** Format a FormulaValue to match test-case string conventions */
function formatResult(val: FormulaValue): FormulaValue {
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const mo = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    const h = val.getUTCHours();
    const mi = val.getUTCMinutes();
    const s = val.getUTCSeconds();
    // If it has time component, format as datetime
    if (h !== 0 || mi !== 0 || s !== 0) {
      return `${y}-${mo}-${d} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${y}-${mo}-${d}`;
  }
  if (val !== null && typeof val === 'object' && 'timeInMillis' in val) {
    const ms = (val as SfTime).timeInMillis;
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }
  return val;
}

function normalizeResult(result: FormulaValue, expected: FormulaValue): FormulaValue {
  // If expected is a number and result is SfTime, extract timeInMillis
  if (typeof expected === 'number' && result !== null && typeof result === 'object' && 'timeInMillis' in result) {
    return (result as SfTime).timeInMillis;
  }
  return formatResult(result);
}

function runTestCases(cases: Array<{ formula: string; expected: FormulaValue; description?: string }>) {
  for (const tc of cases) {
    const desc = tc.description ? `${tc.formula} (${tc.description})` : tc.formula;
    it(desc, () => {
      if (tc.expected === 'ERROR') {
        expect(() => evaluateFormula(tc.formula, ctx)).toThrow(FormulaError);
      } else {
        const result = evaluateFormula(tc.formula, ctx);
        const normalized = normalizeResult(result, tc.expected);
        expect(normalized).toEqual(tc.expected);
      }
    });
  }
}

// ── Test-case-driven tests ───────────────────────────────────────────

describe('DATE', () => runTestCases(DATE_TESTS));
describe('DAY', () => runTestCases(DAY_TESTS));
describe('MONTH', () => runTestCases(MONTH_TESTS));
describe('YEAR', () => runTestCases(YEAR_TESTS));
describe('WEEKDAY', () => runTestCases(WEEKDAY_TESTS));
describe('ADDMONTHS', () => runTestCases(ADDMONTHS_TESTS));
describe('DATEVALUE', () => runTestCases(DATEVALUE_TESTS));
describe('DATETIMEVALUE', () => runTestCases(DATETIMEVALUE_TESTS));
describe('TIMEVALUE', () => runTestCases(TIMEVALUE_TESTS));
describe('DATE_ARITHMETIC', () => runTestCases(DATE_ARITHMETIC_TESTS));
describe('DAYOFYEAR', () => runTestCases(DAYOFYEAR_TESTS));
describe('ISOWEEK', () => runTestCases(ISOWEEK_TESTS));
describe('ISOYEAR', () => runTestCases(ISOYEAR_TESTS));
describe('UNIXTIMESTAMP', () => runTestCases(UNIXTIMESTAMP_TESTS));

// ── Additional hand-written tests ────────────────────────────────────

describe('DATE – additional', () => {
  it('constructs a date at UTC midnight', () => {
    const result = evaluateFormula('DATE(2024, 1, 15)', ctx);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('rejects invalid date: Feb 29 non-leap', () => {
    expect(() => evaluateFormula('DATE(2001, 2, 29)', ctx)).toThrow(FormulaError);
  });

  it('accepts Feb 29 on leap year', () => {
    const result = evaluateFormula('DATE(2024, 2, 29)', ctx);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });

  it('null any arg returns null', () => {
    expect(evaluateFormula('DATE(null, 1, 1)', ctx)).toBe(null);
    expect(evaluateFormula('DATE(2024, null, 1)', ctx)).toBe(null);
    expect(evaluateFormula('DATE(2024, 1, null)', ctx)).toBe(null);
  });

  it('rejects month out of range', () => {
    expect(() => evaluateFormula('DATE(2024, 0, 1)', ctx)).toThrow(FormulaError);
    expect(() => evaluateFormula('DATE(2024, 13, 1)', ctx)).toThrow(FormulaError);
  });

  it('rejects day out of range', () => {
    expect(() => evaluateFormula('DATE(2024, 4, 31)', ctx)).toThrow(FormulaError); // April has 30 days
  });
});

describe('ADDMONTHS – additional', () => {
  it('Jan 31 + 1 month → Feb 28 (non-leap)', () => {
    const result = evaluateFormula('ADDMONTHS(DATE(2023, 1, 31), 1)', ctx);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2023-02-28T00:00:00.000Z');
  });

  it('Jan 31 + 1 month → Feb 29 (leap)', () => {
    const result = evaluateFormula('ADDMONTHS(DATE(2016, 1, 31), 1)', ctx);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2016-02-29T00:00:00.000Z');
  });

  it('null date returns null', () => {
    expect(evaluateFormula('ADDMONTHS(null, 1)', ctx)).toBe(null);
  });

  it('null months returns null', () => {
    expect(evaluateFormula('ADDMONTHS(DATE(2024, 1, 1), null)', ctx)).toBe(null);
  });
});

describe('DATEVALUE – additional', () => {
  it('parses ISO date string', () => {
    const result = evaluateFormula('DATEVALUE("2024-01-15")', ctx);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('null returns null', () => {
    expect(evaluateFormula('DATEVALUE(null)', ctx)).toBe(null);
  });

  it('throws on invalid format', () => {
    expect(() => evaluateFormula('DATEVALUE("not-a-date")', ctx)).toThrow(FormulaError);
  });
});

describe('DATETIMEVALUE – additional', () => {
  it('parses datetime string to Date', () => {
    const result = evaluateFormula('DATETIMEVALUE("2024-01-15 10:30:00")', ctx);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-01-15T10:30:00.000Z');
  });

  it('null returns null', () => {
    expect(evaluateFormula('DATETIMEVALUE(null)', ctx)).toBe(null);
  });
});

describe('DAY – additional', () => {
  it('DAY(DATE(2024, 3, 15)) → 15', () => {
    expect(evaluateFormula('DAY(DATE(2024, 3, 15))', ctx)).toBe(15);
  });

  it('null returns null', () => {
    expect(evaluateFormula('DAY(null)', ctx)).toBe(null);
  });
});

describe('HOUR/MINUTE/SECOND/MILLISECOND', () => {
  it('HOUR with SfTime via TIMEVALUE', () => {
    expect(evaluateFormula('HOUR(TIMEVALUE("10:30:45.123"))', ctx)).toBe(10);
  });

  it('MINUTE with SfTime via TIMEVALUE', () => {
    expect(evaluateFormula('MINUTE(TIMEVALUE("10:30:45.123"))', ctx)).toBe(30);
  });

  it('SECOND with SfTime via TIMEVALUE', () => {
    expect(evaluateFormula('SECOND(TIMEVALUE("10:30:45.123"))', ctx)).toBe(45);
  });

  it('MILLISECOND with SfTime via TIMEVALUE', () => {
    expect(evaluateFormula('MILLISECOND(TIMEVALUE("10:30:45.123"))', ctx)).toBe(123);
  });

  it('HOUR with DateTime via DATETIMEVALUE', () => {
    expect(evaluateFormula('HOUR(DATETIMEVALUE("2024-01-15 14:30:45"))', ctx)).toBe(14);
  });

  it('MINUTE with DateTime', () => {
    expect(evaluateFormula('MINUTE(DATETIMEVALUE("2024-01-15 14:30:45"))', ctx)).toBe(30);
  });

  it('SECOND with DateTime', () => {
    expect(evaluateFormula('SECOND(DATETIMEVALUE("2024-01-15 14:30:45"))', ctx)).toBe(45);
  });

  it('HOUR null returns null', () => {
    expect(evaluateFormula('HOUR(null)', ctx)).toBe(null);
  });

  it('MINUTE null returns null', () => {
    expect(evaluateFormula('MINUTE(null)', ctx)).toBe(null);
  });

  it('SECOND null returns null', () => {
    expect(evaluateFormula('SECOND(null)', ctx)).toBe(null);
  });

  it('MILLISECOND null returns null', () => {
    expect(evaluateFormula('MILLISECOND(null)', ctx)).toBe(null);
  });
});

describe('MONTH – additional', () => {
  it('MONTH(DATE(2024, 3, 15)) → 3', () => {
    expect(evaluateFormula('MONTH(DATE(2024, 3, 15))', ctx)).toBe(3);
  });

  it('null returns null', () => {
    expect(evaluateFormula('MONTH(null)', ctx)).toBe(null);
  });
});

describe('NOW', () => {
  it('returns the overridden now value', () => {
    const now = new Date('2024-01-15T10:30:00Z');
    const result = evaluateFormula('NOW()', ctx, { now });
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-01-15T10:30:00.000Z');
  });
});

describe('TODAY', () => {
  it('returns today at UTC midnight using options.now', () => {
    const now = new Date('2024-01-15T10:30:00Z');
    const result = evaluateFormula('TODAY()', ctx, { now });
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });
});

describe('TIMENOW', () => {
  it('returns current time as SfTime using options.now', () => {
    const now = new Date('2024-01-15T10:30:45.123Z');
    const result = evaluateFormula('TIMENOW()', ctx, { now }) as SfTime;
    expect(result).toHaveProperty('timeInMillis');
    // 10*3600000 + 30*60000 + 45*1000 + 123 = 37845123
    expect(result.timeInMillis).toBe(37845123);
  });
});

describe('TIMEVALUE – additional', () => {
  it('parses HH:mm:ss.SSS', () => {
    const result = evaluateFormula('TIMEVALUE("10:30:45.123")', ctx) as SfTime;
    expect(result.timeInMillis).toBe(10 * 3600000 + 30 * 60000 + 45 * 1000 + 123);
  });

  it('parses HH:mm:ss without millis', () => {
    const result = evaluateFormula('TIMEVALUE("10:30:45")', ctx) as SfTime;
    expect(result.timeInMillis).toBe(10 * 3600000 + 30 * 60000 + 45 * 1000);
  });

  it('null returns null', () => {
    expect(evaluateFormula('TIMEVALUE(null)', ctx)).toBe(null);
  });

  it('rejects invalid format', () => {
    expect(() => evaluateFormula('TIMEVALUE("invalid")', ctx)).toThrow(FormulaError);
  });
});

describe('WEEKDAY – additional', () => {
  it('Sunday = 1', () => {
    expect(evaluateFormula('WEEKDAY(DATE(2024, 1, 7))', ctx)).toBe(1);
  });

  it('Saturday = 7', () => {
    expect(evaluateFormula('WEEKDAY(DATE(2024, 1, 13))', ctx)).toBe(7);
  });

  it('null returns null', () => {
    expect(evaluateFormula('WEEKDAY(null)', ctx)).toBe(null);
  });
});

describe('YEAR – additional', () => {
  it('YEAR(DATE(2024, 3, 15)) → 2024', () => {
    expect(evaluateFormula('YEAR(DATE(2024, 3, 15))', ctx)).toBe(2024);
  });

  it('null returns null', () => {
    expect(evaluateFormula('YEAR(null)', ctx)).toBe(null);
  });
});

describe('FROMUNIXTIME', () => {
  it('converts unix timestamp to datetime', () => {
    const result = evaluateFormula('FROMUNIXTIME(1112659200)', ctx);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2005-04-05T00:00:00.000Z');
  });

  it('null returns null', () => {
    expect(evaluateFormula('FROMUNIXTIME(null)', ctx)).toBe(null);
  });
});
