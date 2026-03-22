import { describe, it, expect } from 'vitest';
import { ALL_TEST_SUITES } from './test-cases.js';
import { evaluateFormula } from '../index.js';
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
