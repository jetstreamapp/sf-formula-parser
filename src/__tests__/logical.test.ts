import { describe, it, expect } from 'vitest';
import { evaluateFormula } from '../index.js';
import type { FormulaContext } from '../index.js';

const emptyCtx: FormulaContext = { record: {} };

function eval_(formula: string, ctx: FormulaContext = emptyCtx) {
  return evaluateFormula(formula, ctx);
}

// ── IF ─────────────────────────────────────────────────────────────

describe('IF', () => {
  it('returns then-branch when true', () => {
    expect(eval_('IF(true, "yes", "no")')).toBe('yes');
  });

  it('returns else-branch when false', () => {
    expect(eval_('IF(false, "yes", "no")')).toBe('no');
  });

  it('treats null as false', () => {
    expect(eval_('IF(null, "yes", "no")')).toBe('no');
  });

  it('returns null when else-branch is omitted and condition is false', () => {
    expect(eval_('IF(false, "yes")')).toBeNull();
  });

  it('is lazy: does not evaluate the unused branch', () => {
    // 1/0 would throw FormulaError if evaluated
    expect(eval_('IF(false, 1/0, 42)')).toBe(42);
    expect(eval_('IF(true, 42, 1/0)')).toBe(42);
  });
});

// ── IFS ────────────────────────────────────────────────────────────

describe('IFS', () => {
  it('returns result for first true condition', () => {
    expect(eval_('IFS(false, "a", true, "b", "c")')).toBe('b');
  });

  it('returns else value when no condition is true', () => {
    expect(eval_('IFS(false, "a", false, "b", "c")')).toBe('c');
  });

  it('returns first match even if later ones also match', () => {
    expect(eval_('IFS(true, "first", true, "second", "else")')).toBe('first');
  });
});

// ── CASE ───────────────────────────────────────────────────────────

describe('CASE', () => {
  it('matches a numeric value', () => {
    expect(eval_('CASE(2, 1, "one", 2, "two", "other")')).toBe('two');
  });

  it('returns else when no match', () => {
    expect(eval_('CASE(3, 1, "one", 2, "two", "other")')).toBe('other');
  });

  it('matches string values', () => {
    expect(eval_('CASE("b", "a", 1, "b", 2, 0)')).toBe(2);
  });

  it('null expr goes to else (null never matches)', () => {
    expect(eval_('CASE(null, null, "matched", "unmatched")')).toBe('unmatched');
  });
});

// ── AND ────────────────────────────────────────────────────────────

describe('AND', () => {
  it('returns true when all true', () => {
    expect(eval_('AND(true, true)')).toBe(true);
  });

  it('returns false when any false', () => {
    expect(eval_('AND(true, false)')).toBe(false);
  });

  it('returns false when any null', () => {
    expect(eval_('AND(true, null)')).toBe(false);
  });

  it('short-circuits on false', () => {
    // 1/0 would throw if evaluated
    expect(eval_('AND(false, 1/0 = 0)')).toBe(false);
  });

  it('works with many args', () => {
    expect(eval_('AND(true, true, true, true)')).toBe(true);
    expect(eval_('AND(true, true, false, true)')).toBe(false);
  });
});

// ── OR ─────────────────────────────────────────────────────────────

describe('OR', () => {
  it('returns true when any true', () => {
    expect(eval_('OR(false, true)')).toBe(true);
  });

  it('returns false when all false', () => {
    expect(eval_('OR(false, false)')).toBe(false);
  });

  it('returns false when all null', () => {
    expect(eval_('OR(null, null)')).toBe(false);
  });

  it('short-circuits on true', () => {
    expect(eval_('OR(true, 1/0 = 0)')).toBe(true);
  });
});

// ── NOT ────────────────────────────────────────────────────────────

describe('NOT', () => {
  it('negates true', () => {
    expect(eval_('NOT(true)')).toBe(false);
  });

  it('negates false', () => {
    expect(eval_('NOT(false)')).toBe(true);
  });

  it('preserves null', () => {
    expect(eval_('NOT(null)')).toBeNull();
  });
});

// ── ISBLANK ────────────────────────────────────────────────────────

describe('ISBLANK', () => {
  it('returns true for null', () => {
    expect(eval_('ISBLANK(null)')).toBe(true);
  });

  it('returns true for empty string', () => {
    expect(eval_('ISBLANK("")')).toBe(true);
  });

  it('returns false for zero', () => {
    expect(eval_('ISBLANK(0)')).toBe(false);
  });

  it('returns false for non-empty string', () => {
    expect(eval_('ISBLANK("hello")')).toBe(false);
  });
});

// ── ISNULL ─────────────────────────────────────────────────────────

describe('ISNULL', () => {
  it('returns true for null', () => {
    expect(eval_('ISNULL(null)')).toBe(true);
  });

  it('returns false for empty string (empty string is NOT null)', () => {
    expect(eval_('ISNULL("")')).toBe(false);
  });

  it('returns false for zero', () => {
    expect(eval_('ISNULL(0)')).toBe(false);
  });
});

// ── ISNUMBER ───────────────────────────────────────────────────────

describe('ISNUMBER', () => {
  it('returns true for numeric string', () => {
    expect(eval_('ISNUMBER("123")')).toBe(true);
  });

  it('returns true for actual number', () => {
    expect(eval_('ISNUMBER(42)')).toBe(true);
  });

  it('returns false for non-numeric string', () => {
    expect(eval_('ISNUMBER("abc")')).toBe(false);
  });

  it('returns false for null', () => {
    expect(eval_('ISNUMBER(null)')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(eval_('ISNUMBER("")')).toBe(false);
  });

  it('returns true for negative numeric string', () => {
    expect(eval_('ISNUMBER("-3.14")')).toBe(true);
  });
});

// ── BLANKVALUE ─────────────────────────────────────────────────────

describe('BLANKVALUE', () => {
  it('returns default for null', () => {
    expect(eval_('BLANKVALUE(null, "default")')).toBe('default');
  });

  it('returns default for empty string', () => {
    expect(eval_('BLANKVALUE("", "default")')).toBe('default');
  });

  it('returns value when not blank', () => {
    expect(eval_('BLANKVALUE("hello", "default")')).toBe('hello');
  });

  it('returns 0 when value is 0 (not blank)', () => {
    expect(eval_('BLANKVALUE(0, 99)')).toBe(0);
  });

  it('is lazy: does not evaluate default when value is present', () => {
    expect(eval_('BLANKVALUE(42, 1/0)')).toBe(42);
  });
});

// ── NULLVALUE ──────────────────────────────────────────────────────

describe('NULLVALUE', () => {
  it('returns null for null in string context (SF quirk)', () => {
    expect(eval_('NULLVALUE(null, "default")')).toBeNull();
  });

  it('returns null for empty string in string context (SF quirk)', () => {
    expect(eval_('NULLVALUE("", "default")')).toBeNull();
  });

  it('returns value when not null in string context', () => {
    expect(eval_('NULLVALUE("hello", "default")')).toBe('hello');
  });

  it('returns default for null in numeric context', () => {
    expect(eval_('NULLVALUE(null, 42)')).toBe(42);
  });
});

// ── IFERROR ────────────────────────────────────────────────────────

describe('IFERROR', () => {
  it('returns fallback on division by zero', () => {
    expect(eval_('IFERROR(1/0, 0)')).toBe(0);
  });

  it('returns value when no error', () => {
    expect(eval_('IFERROR(42, 0)')).toBe(42);
  });

  it('catches formula errors but not unexpected errors', () => {
    // Normal evaluation should work fine
    expect(eval_('IFERROR(10 + 5, -1)')).toBe(15);
  });
});

// ── ISNEW ──────────────────────────────────────────────────────────

describe('ISNEW', () => {
  it('returns true when record is new', () => {
    expect(eval_('ISNEW()', { record: {}, isNew: true })).toBe(true);
  });

  it('returns false when record is not new', () => {
    expect(eval_('ISNEW()', { record: {}, isNew: false })).toBe(false);
  });

  it('returns false when isNew is undefined', () => {
    expect(eval_('ISNEW()', { record: {} })).toBe(false);
  });
});

// ── ISCLONE ────────────────────────────────────────────────────────

describe('ISCLONE', () => {
  it('returns true when record is a clone', () => {
    expect(eval_('ISCLONE()', { record: {}, isClone: true })).toBe(true);
  });

  it('returns false when record is not a clone', () => {
    expect(eval_('ISCLONE()', { record: {}, isClone: false })).toBe(false);
  });

  it('returns false when isClone is undefined', () => {
    expect(eval_('ISCLONE()', { record: {} })).toBe(false);
  });
});

// ── ISCHANGED ──────────────────────────────────────────────────────

describe('ISCHANGED', () => {
  it('returns true when field value has changed', () => {
    const ctx: FormulaContext = {
      record: { Status: 'Closed' },
      priorRecord: { Status: 'Open' },
    };
    expect(eval_('ISCHANGED(Status)', ctx)).toBe(true);
  });

  it('returns false when field value is the same', () => {
    const ctx: FormulaContext = {
      record: { Status: 'Open' },
      priorRecord: { Status: 'Open' },
    };
    expect(eval_('ISCHANGED(Status)', ctx)).toBe(false);
  });

  it('returns true when no prior record (current vs null)', () => {
    const ctx: FormulaContext = {
      record: { Status: 'Open' },
    };
    // current = 'Open', prior = null → different
    expect(eval_('ISCHANGED(Status)', ctx)).toBe(true);
  });

  it('returns false when both current and prior are null', () => {
    const ctx: FormulaContext = {
      record: {},
      priorRecord: {},
    };
    expect(eval_('ISCHANGED(MissingField)', ctx)).toBe(false);
  });
});

// ── PRIORVALUE ─────────────────────────────────────────────────────

describe('PRIORVALUE', () => {
  it('returns the prior value of a field', () => {
    const ctx: FormulaContext = {
      record: { Amount: 200 },
      priorRecord: { Amount: 100 },
    };
    expect(eval_('PRIORVALUE(Amount)', ctx)).toBe(100);
  });

  it('returns null when no prior record', () => {
    const ctx: FormulaContext = {
      record: { Amount: 200 },
    };
    expect(eval_('PRIORVALUE(Amount)', ctx)).toBeNull();
  });

  it('returns null when field not in prior record', () => {
    const ctx: FormulaContext = {
      record: { Amount: 200 },
      priorRecord: {},
    };
    expect(eval_('PRIORVALUE(Amount)', ctx)).toBeNull();
  });

  it('is case-insensitive for field lookup', () => {
    const ctx: FormulaContext = {
      record: { Status: 'New' },
      priorRecord: { status: 'Old' },
    };
    expect(eval_('PRIORVALUE(Status)', ctx)).toBe('Old');
  });
});
