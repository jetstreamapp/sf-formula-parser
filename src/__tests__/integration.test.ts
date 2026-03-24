import { describe, it, expect } from 'vitest';
import { ALL_TEST_SUITES } from './test-cases.js';
import { evaluateFormula, isDateOnly } from '../index.js';
import type { FieldSchema } from '../evaluator/schema.js';
import { FormulaError } from '../evaluator/errors.js';
import type { FormulaContext } from '../evaluator/context.js';

/**
 * Helper: compare result against expected, handling Date-to-string,
 * SfTime-to-string, and float tolerance.
 */
function assertResult(formula: string, result: unknown, expected: unknown): void {
  if (expected === null) {
    expect(result).toBeNull();
    return;
  }

  // Expected is an ISO date string like "2020-01-15" or "2016-02-29 13:15:10"
  if (typeof expected === 'string' && result instanceof Date) {
    // Format result as the TEXT function would
    const d = result as Date;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');

    const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
    // Check if result was marked as datetime (has non-zero time or was marked)
    if (expected.includes(':') || hasTime) {
      const h = String(d.getUTCHours()).padStart(2, '0');
      const min = String(d.getUTCMinutes()).padStart(2, '0');
      const sec = String(d.getUTCSeconds()).padStart(2, '0');
      const formatted = `${y}-${m}-${day} ${h}:${min}:${sec}`;
      expect(formatted).toBe(expected);
    } else {
      expect(`${y}-${m}-${day}`).toBe(expected);
    }
    return;
  }

  // Expected is an ISO time string like "12:34:56.789", result is SfTime
  if (
    typeof expected === 'string' &&
    result !== null &&
    typeof result === 'object' &&
    'timeInMillis' in (result as Record<string, unknown>)
  ) {
    const t = result as { timeInMillis: number };
    const hours = Math.floor(t.timeInMillis / 3_600_000);
    const minutes = Math.floor((t.timeInMillis % 3_600_000) / 60_000);
    const seconds = Math.floor((t.timeInMillis % 60_000) / 1_000);
    const ms = t.timeInMillis % 1_000;
    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    expect(formatted).toBe(expected);
    return;
  }

  // SfTime subtraction result is a number (ms) — result might be SfTime object
  if (
    typeof expected === 'number' &&
    result !== null &&
    typeof result === 'object' &&
    'timeInMillis' in (result as Record<string, unknown>)
  ) {
    expect((result as { timeInMillis: number }).timeInMillis).toBe(expected);
    return;
  }

  if (typeof expected === 'number' && typeof result === 'number' && !Number.isInteger(expected)) {
    expect(result).toBeCloseTo(expected, 10);
    return;
  }

  expect(result).toEqual(expected);
}

// ============================================================================
// Run ALL test suites from test-cases.ts
// ============================================================================

for (const [suiteName, cases] of Object.entries(ALL_TEST_SUITES)) {
  describe(suiteName, () => {
    for (const tc of cases) {
      it((tc as { description?: string }).description || tc.formula, () => {
        const context: FormulaContext = (tc as { context?: FormulaContext }).context ?? { record: {} };

        if (tc.expected === 'ERROR') {
          expect(() => evaluateFormula(tc.formula, context)).toThrow();
        } else {
          const result = evaluateFormula(tc.formula, context);
          assertResult(tc.formula, result, tc.expected);
        }
      });
    }
  });
}

// ============================================================================
// Hand-written complex integration tests
// ============================================================================

describe('complex formulas', () => {
  it('IF with ISBLANK and arithmetic', () => {
    const ctx: FormulaContext = { record: { Amount: 1000 } };
    expect(evaluateFormula('IF(ISBLANK(Amount), 0, Amount * 1.1)', ctx)).toBe(1100);
  });

  it('nested functions with string operations', () => {
    const ctx: FormulaContext = {
      record: { Amount: 1234.5, Account: { Name: 'Acme Corp' } },
    };
    expect(
      evaluateFormula(
        'IF(AND(Amount > 0, NOT(ISBLANK(Account.Name))), UPPER(LEFT(Account.Name, 3)) & "-" & TEXT(ROUND(Amount, 0)), "N/A")',
        ctx,
      ),
    ).toBe('ACM-1235');
  });

  it('short-circuit prevents division by zero in IF', () => {
    expect(evaluateFormula('IF(false, 1/0, 42)', { record: {} })).toBe(42);
  });

  it('short-circuit prevents division by zero in AND', () => {
    expect(evaluateFormula('AND(false, 1/0 = 0)', { record: {} })).toBe(false);
  });

  it('short-circuit prevents division by zero in OR', () => {
    expect(evaluateFormula('OR(true, 1/0 = 0)', { record: {} })).toBe(true);
  });
});

// ============================================================================
// Return type validation tests
// ============================================================================

describe('return type validation', () => {
  const ctx: FormulaContext = { record: {} };

  // ── Correct return types pass ──
  it('number formula with returnType number passes', () => {
    expect(evaluateFormula('1 + 2', ctx, { returnType: 'number' })).toBe(3);
  });

  it('string formula with returnType string passes', () => {
    expect(evaluateFormula('"hello"', ctx, { returnType: 'string' })).toBe('hello');
  });

  it('boolean formula with returnType boolean passes', () => {
    expect(evaluateFormula('true', ctx, { returnType: 'boolean' })).toBe(true);
  });

  it('date formula with returnType date passes', () => {
    const result = evaluateFormula('DATE(2024, 1, 15)', ctx, { returnType: 'date' });
    expect(result).toBeInstanceOf(Date);
  });

  it('datetime formula with returnType datetime passes', () => {
    const result = evaluateFormula('DATETIMEVALUE("2024-01-15 12:00:00")', ctx, { returnType: 'datetime' });
    expect(result).toBeInstanceOf(Date);
  });

  it('time formula with returnType time passes', () => {
    const result = evaluateFormula('TIMEVALUE("12:34:56.789")', ctx, { returnType: 'time' });
    expect(result).not.toBeNull();
    expect(typeof result === 'object' && result !== null && 'timeInMillis' in result).toBe(true);
  });

  it('null result passes any return type', () => {
    expect(evaluateFormula('null', ctx, { returnType: 'number' })).toBeNull();
    expect(evaluateFormula('null', ctx, { returnType: 'string' })).toBeNull();
    expect(evaluateFormula('null', ctx, { returnType: 'boolean' })).toBeNull();
    expect(evaluateFormula('null', ctx, { returnType: 'date' })).toBeNull();
    expect(evaluateFormula('null', ctx, { returnType: 'datetime' })).toBeNull();
    expect(evaluateFormula('null', ctx, { returnType: 'time' })).toBeNull();
  });

  // ── Mismatched return types throw ──
  it('number result with returnType string throws', () => {
    expect(() => evaluateFormula('1 + 2', ctx, { returnType: 'string' })).toThrow(FormulaError);
    expect(() => evaluateFormula('1 + 2', ctx, { returnType: 'string' })).toThrow(
      /Formula result is data type \(Number\), incompatible with expected data type \(Text\)/,
    );
  });

  it('string result with returnType number throws', () => {
    expect(() => evaluateFormula('"hello"', ctx, { returnType: 'number' })).toThrow(FormulaError);
  });

  it('boolean result with returnType number throws', () => {
    expect(() => evaluateFormula('true', ctx, { returnType: 'number' })).toThrow(FormulaError);
  });

  it('date result with returnType number throws', () => {
    expect(() => evaluateFormula('DATE(2024, 1, 15)', ctx, { returnType: 'number' })).toThrow(FormulaError);
  });

  it('datetime result with returnType date is allowed (Salesforce compatible)', () => {
    const result = evaluateFormula('DATETIMEVALUE("2024-01-15 12:00:00")', ctx, { returnType: 'date' });
    expect(result).toBeInstanceOf(Date);
  });

  it('date result with returnType datetime is allowed (Salesforce compatible)', () => {
    const result = evaluateFormula('DATE(2024, 1, 15)', ctx, { returnType: 'datetime' });
    expect(result).toBeInstanceOf(Date);
  });

  it('number result with returnType boolean throws', () => {
    expect(() => evaluateFormula('42', ctx, { returnType: 'boolean' })).toThrow(FormulaError);
  });

  // ── Without returnType, no validation ──
  it('no returnType option skips validation', () => {
    expect(evaluateFormula('1 + 2', ctx)).toBe(3);
    expect(evaluateFormula('"hello"', ctx)).toBe('hello');
  });

  // ── Date + Number with correct return type ──
  it('Date + Number passes with returnType date', () => {
    const baseDate = new Date('2024-01-01T00:00:00.000Z');
    const result = evaluateFormula('MyDate + 5', { record: { MyDate: baseDate } }, { returnType: 'date' });
    expect(result).toBeInstanceOf(Date);
  });

  it('Date + Number throws with returnType number', () => {
    const baseDate = new Date('2024-01-01T00:00:00.000Z');
    expect(() => evaluateFormula('MyDate + 5', { record: { MyDate: baseDate } }, { returnType: 'number' })).toThrow(
      /incompatible with expected data type/,
    );
  });
});

// ============================================================================
// Schema validation tests
// ============================================================================

describe('schema validation', () => {
  const schema: FieldSchema[] = [
    { name: 'Name', type: 'string' },
    { name: 'Amount', type: 'currency' },
    { name: 'IsActive', type: 'boolean' },
    { name: 'CreatedDate', type: 'datetime' },
    { name: 'Status', type: 'picklist' },
    { name: 'Interests', type: 'multipicklist' },
  ];

  const ctx = {
    record: {
      Name: 'Acme',
      Amount: 1000,
      IsActive: true,
      CreatedDate: new Date('2024-01-15T12:00:00.000Z'),
      Status: 'Active',
      Interests: 'Golf;Tennis',
    },
  };

  // ── Field existence ──
  it('existing field resolves normally with schema', () => {
    expect(evaluateFormula('Name', ctx, { schema })).toBe('Acme');
  });

  it('missing field throws with schema', () => {
    expect(() => evaluateFormula('MissingField', ctx, { schema })).toThrow(FormulaError);
    expect(() => evaluateFormula('MissingField', ctx, { schema })).toThrow(/does not exist/);
  });

  it('missing field returns null without schema', () => {
    expect(evaluateFormula('MissingField', ctx)).toBeNull();
  });

  it('field lookup is case-insensitive with schema', () => {
    expect(evaluateFormula('name', ctx, { schema })).toBe('Acme');
    expect(evaluateFormula('amount', ctx, { schema })).toBe(1000);
  });

  // ── Picklist restrictions in operators ──
  it('picklist in & operator throws', () => {
    expect(() => evaluateFormula('Status & " test"', ctx, { schema })).toThrow(/picklist field/);
  });

  it('picklist in = operator throws', () => {
    expect(() => evaluateFormula('Status = "Active"', ctx, { schema })).toThrow(/picklist field/);
  });

  it('multipicklist in + operator throws', () => {
    expect(() => evaluateFormula('Interests & " more"', ctx, { schema })).toThrow(/picklist field/);
  });

  // ── Picklist restrictions in non-allowed functions ──
  it('picklist in UPPER() throws', () => {
    expect(() => evaluateFormula('UPPER(Status)', ctx, { schema })).toThrow(/picklist field/);
  });

  it('picklist in CONTAINS() throws', () => {
    expect(() => evaluateFormula('CONTAINS(Status, "Act")', ctx, { schema })).toThrow(/picklist field/);
  });

  it('picklist in LEN() throws', () => {
    expect(() => evaluateFormula('LEN(Status)', ctx, { schema })).toThrow(/picklist field/);
  });

  // ── Picklist allowed in specific functions ──
  it('picklist in TEXT() works', () => {
    expect(evaluateFormula('TEXT(Status)', ctx, { schema })).toBe('Active');
  });

  it('picklist in ISPICKVAL() works', () => {
    expect(evaluateFormula('ISPICKVAL(Status, "Active")', ctx, { schema })).toBe(true);
    expect(evaluateFormula('ISPICKVAL(Status, "Closed")', ctx, { schema })).toBe(false);
  });

  it('picklist in ISBLANK() works', () => {
    expect(evaluateFormula('ISBLANK(Status)', ctx, { schema })).toBe(false);
  });

  it('picklist in CASE() works', () => {
    expect(evaluateFormula('CASE(Status, "Active", 1, "Closed", 2, 0)', ctx, { schema })).toBe(1);
  });

  it('picklist in NULLVALUE() works', () => {
    expect(evaluateFormula('NULLVALUE(Status, "None")', ctx, { schema })).not.toBeNull();
  });

  it('picklist in BLANKVALUE() works', () => {
    expect(evaluateFormula('BLANKVALUE(Status, "None")', ctx, { schema })).toBe('Active');
  });

  // ── Multipicklist allowed in INCLUDES ──
  it('multipicklist in INCLUDES() works', () => {
    expect(evaluateFormula('INCLUDES(Interests, "Golf")', ctx, { schema })).toBe(true);
    expect(evaluateFormula('INCLUDES(Interests, "Swimming")', ctx, { schema })).toBe(false);
  });

  // ── No schema = no picklist enforcement ──
  it('picklist field used in operator without schema does not throw', () => {
    expect(evaluateFormula('Status & " test"', ctx)).toBe('Active test');
  });

  it('picklist field used in UPPER without schema does not throw', () => {
    expect(evaluateFormula('UPPER(Status)', ctx)).toBe('ACTIVE');
  });

  // ── Non-picklist fields work normally with schema ──
  it('string field in operators works with schema', () => {
    expect(evaluateFormula('UPPER(Name)', ctx, { schema })).toBe('ACME');
  });

  it('number field in arithmetic works with schema', () => {
    expect(evaluateFormula('Amount + 1', ctx, { schema })).toBe(1001);
  });

  it('boolean field works with schema', () => {
    expect(evaluateFormula('IF(IsActive, "yes", "no")', ctx, { schema })).toBe('yes');
  });

  // ── Related field schema validation (flat array only covers root) ──
  it('related field without relationship schema bypasses validation', () => {
    const ctxWithRelated = {
      record: {
        Name: 'Acme',
        Account: { Name: 'Parent Corp', Industry: 'Tech' },
      },
    };
    // schema (flat array) only covers root object — Account.Name is not validated
    expect(evaluateFormula('Account.Name', ctxWithRelated, { schema })).toBe('Parent Corp');
  });

  it('global field without global schema bypasses validation', () => {
    const ctxWithGlobals = {
      record: {},
      globals: { $User: { FirstName: 'Jane' } },
    };
    expect(evaluateFormula('$User.FirstName', ctxWithGlobals, { schema })).toBe('Jane');
  });
});

// ============================================================================
// Schema validation with relationship map
// ============================================================================

describe('schema validation with relationships', () => {
  const fullSchema: Record<string, FieldSchema[]> = {
    $record: [
      { name: 'Name', type: 'string' },
      { name: 'Amount', type: 'currency' },
      { name: 'Status', type: 'picklist' },
    ],
    Account: [
      { name: 'Name', type: 'string' },
      { name: 'Industry', type: 'picklist' },
    ],
    $User: [
      { name: 'FirstName', type: 'string' },
      { name: 'LastName', type: 'string' },
      { name: 'IsActive', type: 'boolean' },
    ],
  };

  const ctx = {
    record: {
      Name: 'Acme',
      Amount: 1000,
      Status: 'Active',
      Account: { Name: 'Parent Corp', Industry: 'Technology' },
    },
    globals: {
      $User: { FirstName: 'Jane', LastName: 'Smith', IsActive: true },
    },
  };

  // ── Root object fields validated ──
  it('root field resolves with relationship schema', () => {
    expect(evaluateFormula('Name', ctx, { schema: fullSchema })).toBe('Acme');
  });

  it('root missing field throws with relationship schema', () => {
    expect(() => evaluateFormula('MissingField', ctx, { schema: fullSchema })).toThrow(/does not exist/);
  });

  // ── Related object fields validated ──
  it('related field resolves with relationship schema', () => {
    expect(evaluateFormula('Account.Name', ctx, { schema: fullSchema })).toBe('Parent Corp');
  });

  it('related missing field throws with relationship schema', () => {
    expect(() => evaluateFormula('Account.Website', ctx, { schema: fullSchema })).toThrow(/does not exist/);
  });

  it('related picklist field enforced with relationship schema', () => {
    // Account.Industry is a picklist — can't use in UPPER
    expect(() => evaluateFormula('UPPER(Account.Industry)', ctx, { schema: fullSchema })).toThrow(/picklist field/);
  });

  it('related picklist field works in TEXT()', () => {
    expect(evaluateFormula('TEXT(Account.Industry)', ctx, { schema: fullSchema })).toBe('Technology');
  });

  it('related picklist field works in ISPICKVAL()', () => {
    expect(evaluateFormula('ISPICKVAL(Account.Industry, "Technology")', ctx, { schema: fullSchema })).toBe(true);
  });

  // ── Global fields validated ──
  it('global field resolves with relationship schema', () => {
    expect(evaluateFormula('$User.FirstName', ctx, { schema: fullSchema })).toBe('Jane');
  });

  it('global missing field throws with relationship schema', () => {
    expect(() => evaluateFormula('$User.Email', ctx, { schema: fullSchema })).toThrow(/does not exist/);
  });

  // ── Relationship without schema defined bypasses validation ──
  it('relationship not in schema map bypasses validation', () => {
    const ctxWithOwner = {
      ...ctx,
      record: { ...ctx.record, Owner: { Name: 'Bob' } },
    };
    // Owner is not in fullSchema — should resolve without error
    expect(evaluateFormula('Owner.Name', ctxWithOwner, { schema: fullSchema })).toBe('Bob');
  });

  // ── Root picklist still enforced ──
  it('root picklist enforced with relationship schema', () => {
    expect(() => evaluateFormula('Status & " test"', ctx, { schema: fullSchema })).toThrow(/picklist field/);
  });

  it('root picklist in ISPICKVAL works with relationship schema', () => {
    expect(evaluateFormula('ISPICKVAL(Status, "Active")', ctx, { schema: fullSchema })).toBe(true);
  });

  // ── Schema is case-insensitive ──
  it('relationship keys are case-insensitive', () => {
    const schemaWithCase: Record<string, FieldSchema[]> = {
      $record: [{ name: 'Name', type: 'string' }],
      account: [{ name: 'Name', type: 'string' }],
    };
    expect(evaluateFormula('Account.Name', ctx, { schema: schemaWithCase })).toBe('Parent Corp');
  });
});

// ============================================================================
// Schema-based type coercion for date/datetime/time fields
// ============================================================================

describe('schema-based type coercion', () => {
  const schema: Record<string, FieldSchema[]> = {
    $record: [
      { name: 'CreatedDate', type: 'datetime' },
      { name: 'CloseDate', type: 'date' },
      { name: 'StartTime', type: 'time' },
      { name: 'Name', type: 'string' },
    ],
  };

  const ctx = {
    record: {
      CreatedDate: '2024-01-15T12:00:00.000Z',
      CloseDate: '2024-06-15',
      StartTime: '13:30:00.000Z',
      Name: 'Test',
    },
  };

  // ── Datetime fields coerced from strings ──
  it('datetime + datetime throws error when schema is provided', () => {
    expect(() => evaluateFormula('CreatedDate + CreatedDate', ctx, { schema })).toThrow(/Incorrect parameter type for operator/);
  });

  it('datetime + datetime + string throws error (left-to-right evaluation)', () => {
    expect(() => evaluateFormula('CreatedDate + CreatedDate + "test"', ctx, { schema })).toThrow(/Incorrect parameter type for operator/);
  });

  it('datetime + number adds days correctly', () => {
    const result = evaluateFormula('CreatedDate + 1', ctx, { schema });
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-01-16T12:00:00.000Z');
  });

  it('datetime - datetime returns number of days', () => {
    const schema2: Record<string, FieldSchema[]> = {
      $record: [
        { name: 'StartDate', type: 'datetime' },
        { name: 'EndDate', type: 'datetime' },
      ],
    };
    const ctx2 = {
      record: {
        StartDate: '2024-01-15T12:00:00.000Z',
        EndDate: '2024-01-17T12:00:00.000Z',
      },
    };
    expect(evaluateFormula('EndDate - StartDate', ctx2, { schema: schema2 })).toBe(2);
  });

  // ── Date fields coerced from strings ──
  it('date + date throws error when schema is provided', () => {
    const schema2: Record<string, FieldSchema[]> = {
      $record: [
        { name: 'DateA', type: 'date' },
        { name: 'DateB', type: 'date' },
      ],
    };
    const ctx2 = { record: { DateA: '2024-01-15', DateB: '2024-01-20' } };
    expect(() => evaluateFormula('DateA + DateB', ctx2, { schema: schema2 })).toThrow(/Incorrect parameter type for operator/);
  });

  it('date + number adds days correctly', () => {
    const result = evaluateFormula('CloseDate + 5', ctx, { schema });
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toContain('2024-06-20');
  });

  // ── Time fields coerced from strings ──
  it('time + time throws error when schema is provided', () => {
    const schema2: Record<string, FieldSchema[]> = {
      $record: [
        { name: 'TimeA', type: 'time' },
        { name: 'TimeB', type: 'time' },
      ],
    };
    const ctx2 = { record: { TimeA: '10:00:00.000Z', TimeB: '14:00:00.000Z' } };
    expect(() => evaluateFormula('TimeA + TimeB', ctx2, { schema: schema2 })).toThrow(/Incorrect parameter type for operator/);
  });

  it('time + number adds milliseconds correctly', () => {
    const result = evaluateFormula('StartTime + 3600000', ctx, { schema }) as { timeInMillis: number };
    expect(result).toHaveProperty('timeInMillis');
    // 13:30 + 1 hour = 14:30 = 52200000ms
    expect(result.timeInMillis).toBe(52200000);
  });

  // ── Date-only value with datetime schema ──
  it('date-only string value treated as date even with datetime schema', () => {
    const dateOnlyCtx = { record: { CreatedDate: '2026-03-24' } };
    const result = evaluateFormula('CreatedDate + 365', dateOnlyCtx, { schema });
    expect(result).toBeInstanceOf(Date);
    // Should remain date-only (no time component), not become datetime
    const d = result as Date;
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.toISOString()).toBe('2027-03-24T00:00:00.000Z');
  });

  it('date-only string value treated as date with date schema', () => {
    const dateOnlyCtx = { record: { CloseDate: '2026-03-24' } };
    const result = evaluateFormula('CloseDate + 365', dateOnlyCtx, { schema });
    expect(result).toBeInstanceOf(Date);
    const d = result as Date;
    expect(d.getUTCHours()).toBe(0);
    expect(d.toISOString()).toBe('2027-03-24T00:00:00.000Z');
  });

  // ── Datetime arithmetic preserves datetime marker ──
  it('datetime + number result is still datetime (not date-only)', () => {
    const result = evaluateFormula('CreatedDate + 1', ctx, { schema, returnType: 'datetime' });
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-01-16T12:00:00.000Z');
  });

  it('date + number result is date-only (compatible with returnType date)', () => {
    const result = evaluateFormula('CloseDate + 5', ctx, { schema, returnType: 'date' });
    expect(result).toBeInstanceOf(Date);
  });

  // ── Midnight datetime is still datetime (not date-only) ──
  it('midnight datetime string is treated as datetime, not date-only', () => {
    const midnightCtx = { record: { CreatedDate: '2024-01-15T00:00:00.000Z' } };
    const result = evaluateFormula('CreatedDate + 1', midnightCtx, { schema });
    expect(result).toBeInstanceOf(Date);
    expect(isDateOnly(result as Date)).toBe(false);
  });

  it('midnight datetime + midnight datetime throws (not silently concatenated)', () => {
    const midnightCtx = { record: { CreatedDate: '2024-01-15T00:00:00.000Z' } };
    expect(() => evaluateFormula('CreatedDate + CreatedDate', midnightCtx, { schema })).toThrow(/Incorrect parameter type/);
  });

  // ── Time fractional seconds normalization ──
  it('time with 1-digit fractional seconds normalizes correctly', () => {
    const timeSchema: Record<string, FieldSchema[]> = { $record: [{ name: 'T', type: 'time' }] };
    // ".5" should be 500ms, not 5ms
    const result = evaluateFormula('T + 0', { record: { T: '01:00:00.5' } }, { schema: timeSchema }) as { timeInMillis: number };
    expect(result.timeInMillis).toBe(3600500);
  });

  it('time with 2-digit fractional seconds normalizes correctly', () => {
    const timeSchema: Record<string, FieldSchema[]> = { $record: [{ name: 'T', type: 'time' }] };
    // ".50" should be 500ms
    const result = evaluateFormula('T + 0', { record: { T: '01:00:00.50' } }, { schema: timeSchema }) as { timeInMillis: number };
    expect(result.timeInMillis).toBe(3600500);
  });

  // ── Without schema, string behavior is preserved ──
  it('datetime fields without schema remain strings (backward compatible)', () => {
    const result = evaluateFormula('CreatedDate + CreatedDate + "test"', ctx);
    expect(typeof result).toBe('string');
  });

  // ── Mixed operations ──
  it('datetime field compared correctly when schema is provided', () => {
    expect(evaluateFormula('CreatedDate < CloseDate', ctx, { schema })).toBe(true);
  });

  it('YEAR/MONTH/DAY work on schema-coerced date fields', () => {
    expect(evaluateFormula('YEAR(CloseDate)', ctx, { schema })).toBe(2024);
    expect(evaluateFormula('MONTH(CloseDate)', ctx, { schema })).toBe(6);
    expect(evaluateFormula('DAY(CloseDate)', ctx, { schema })).toBe(15);
  });
});
