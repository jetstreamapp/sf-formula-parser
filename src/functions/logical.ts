import { FunctionRegistry, type FunctionContext } from './registry.js';
import { FormulaError } from '../evaluator/errors.js';
import { isBlank, toNumber, toBoolean, toText } from '../evaluator/coercion.js';
import type { FormulaValue, FormulaRecord } from '../evaluator/context.js';
import { isFormulaValue, isFormulaRecord } from '../evaluator/context.js';

// ── Helpers ────────────────────────────────────────────────────────

/**
 * CASE-style equality: mirrors the evaluator's `=` semantics.
 * - If either is a string (or both null), compare as strings (null → "").
 * - Otherwise compare with ===, with Date special-cased by getTime().
 */
function valuesEqual(a: FormulaValue, b: FormulaValue): boolean {
  const aIsString = typeof a === 'string';
  const bIsString = typeof b === 'string';
  const aIsNull = a === null;
  const bIsNull = b === null;

  if (aIsString || bIsString || (aIsNull && bIsNull)) {
    const l = aIsNull ? '' : aIsString ? a : (toText(a) ?? '');
    const r = bIsNull ? '' : bIsString ? b : (toText(b) ?? '');
    return l === r;
  }

  if (aIsNull || bIsNull) return false;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  return a === b;
}

/**
 * Look up a field value in a FormulaRecord by walking the parts array.
 * For a simple field like ["Name"], just does a case-insensitive lookup.
 * For related fields like ["Account", "Name"], traverses nested records.
 */
function lookupPriorValue(record: FormulaRecord, parts: string[]): FormulaValue {
  if (parts.length === 0) return null;

  if (parts.length === 1) {
    const lower = parts[0]!.toLowerCase();
    for (const key of Object.keys(record)) {
      if (key.toLowerCase() === lower) {
        const val = record[key];
        if (isFormulaValue(val)) return val ?? null;
        return null;
      }
    }
    return null;
  }

  // Multi-part: traverse nested records
  let current: FormulaRecord = record;
  for (let i = 0; i < parts.length - 1; i++) {
    const lower = parts[i]!.toLowerCase();
    let found: FormulaRecord | null = null;
    for (const key of Object.keys(current)) {
      if (key.toLowerCase() === lower) {
        const val = current[key];
        if (isFormulaRecord(val)) {
          found = val;
        }
        break;
      }
    }
    if (!found) return null;
    current = found;
  }

  const lower = parts[parts.length - 1]!.toLowerCase();
  for (const key of Object.keys(current)) {
    if (key.toLowerCase() === lower) {
      const val = current[key];
      if (isFormulaValue(val)) return val ?? null;
      return null;
    }
  }
  return null;
}

// ── Function implementations ───────────────────────────────────────

function ifFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  const cond = ctx.evaluate(args[0]!);
  const b = toBoolean(cond);
  if (b === true) return ctx.evaluate(args[1]!);
  return args[2] ? ctx.evaluate(args[2]) : null;
}

function ifsFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  if (args.length < 3 || args.length % 2 === 0) {
    throw new FormulaError('IFS requires an odd number of arguments (minimum 3)');
  }
  for (let i = 0; i < args.length - 1; i += 2) {
    const cond = ctx.evaluate(args[i]!);
    if (toBoolean(cond) === true) return ctx.evaluate(args[i + 1]!);
  }
  return ctx.evaluate(args[args.length - 1]!);
}

function caseFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  const expr = ctx.evaluate(args[0]!);
  // If expr is null, no match is possible — go straight to else
  if (expr === null) {
    return ctx.evaluate(args[args.length - 1]!);
  }
  for (let i = 1; i < args.length - 1; i += 2) {
    const testVal = ctx.evaluate(args[i]!);
    // null when-values never match
    if (testVal === null) continue;
    if (valuesEqual(expr, testVal)) return ctx.evaluate(args[i + 1]!);
  }
  return ctx.evaluate(args[args.length - 1]!);
}

function andFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  for (const arg of args) {
    const val = ctx.evaluate(arg);
    const b = toBoolean(val);
    if (b === null || b === false) return false;
  }
  return true;
}

function orFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  for (const arg of args) {
    const val = ctx.evaluate(arg);
    const b = toBoolean(val);
    if (b === true) return true;
  }
  return false;
}

function notFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  const val = ctx.evaluate(args[0]!);
  if (val === null) return null;
  const b = toBoolean(val);
  if (b === null) return null;
  return !b;
}

function isBlankFn(ctx: FunctionContext): FormulaValue {
  const val = ctx.evaluate(ctx.args[0]!);
  return isBlank(val);
}

function isNumberFn(ctx: FunctionContext): FormulaValue {
  const val = ctx.evaluate(ctx.args[0]!);
  if (val === null) return false;
  if (typeof val === 'number') return true;
  if (typeof val === 'string') return !isNaN(Number(val)) && val.trim() !== '';
  return false;
}

function blankValueFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  const val = ctx.evaluate(args[0]!);
  if (!isBlank(val)) return val;
  return ctx.evaluate(args[1]!);
}

function nullValueFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  const val = ctx.evaluate(args[0]!);
  const substitute = ctx.evaluate(args[1]!);
  // Salesforce quirk: in string context, NULLVALUE is optimized away.
  // It returns the first arg if non-null and non-empty, otherwise null (not the substitute).
  if (typeof substitute === 'string') {
    if (val === null || val === '') return null;
    return val;
  }
  if (val !== null) return val;
  return substitute;
}

function ifErrorFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  try {
    return ctx.evaluate(args[0]!);
  } catch (e) {
    if (e instanceof FormulaError) return ctx.evaluate(args[1]!);
    throw e;
  }
}

function isChangedFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  const node = args[0]!;
  if (node.type !== 'FieldReference') {
    throw new FormulaError('ISCHANGED requires a field reference');
  }
  const current = ctx.evaluate(node);
  const prior = ctx.context.priorRecord ? lookupPriorValue(ctx.context.priorRecord, node.parts) : null;
  return current !== prior;
}

function isNewFn(ctx: FunctionContext): FormulaValue {
  return ctx.context.isNew ?? false;
}

function isCloneFn(ctx: FunctionContext): FormulaValue {
  return ctx.context.isClone ?? false;
}

function priorValueFn(ctx: FunctionContext): FormulaValue {
  const { args } = ctx;
  const node = args[0]!;
  if (node.type !== 'FieldReference') {
    throw new FormulaError('PRIORVALUE requires a field reference');
  }
  if (!ctx.context.priorRecord) return null;
  return lookupPriorValue(ctx.context.priorRecord, node.parts);
}

// ── Registration ───────────────────────────────────────────────────

export function registerLogicalFunctions(registry: FunctionRegistry): void {
  registry.register('IF', ifFn);
  registry.register('IFS', ifsFn);
  registry.register('CASE', caseFn);
  registry.register('AND', andFn);
  registry.register('OR', orFn);
  registry.register('NOT', notFn);
  registry.register('ISBLANK', isBlankFn);
  registry.register('ISNULL', (ctx: FunctionContext): FormulaValue => {
    const val = ctx.evaluate(ctx.args[0]!);
    return val === null || val === undefined;
  });
  registry.register('ISNUMBER', isNumberFn);
  registry.register('BLANKVALUE', blankValueFn);
  registry.register('NULLVALUE', nullValueFn);
  registry.register('IFERROR', ifErrorFn);
  registry.register('ISCHANGED', isChangedFn);
  registry.register('ISNEW', isNewFn);
  registry.register('ISCLONE', isCloneFn);
  registry.register('PRIORVALUE', priorValueFn);
}
