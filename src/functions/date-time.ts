import { FunctionRegistry, type FunctionContext } from './registry.js';
import { FormulaError } from '../evaluator/errors.js';
import { toNumber, isDate, isSfTime, markDateTime } from '../evaluator/coercion.js';
import type { FormulaValue, SfTime } from '../evaluator/context.js';

// ── Helpers ──────────────────────────────────────────────────────────

function isLeapYear(y: number): boolean {
  return y % 400 === 0 || (y % 100 !== 0 && y % 4 === 0);
}

function daysInMonth(year: number, month: number): number {
  const dim = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dim[month - 1]!;
}

function addMonthsToDate(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const originalDay = d.getUTCDate();
  const lastDayOfOriginalMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const isLastDay = originalDay === lastDayOfOriginalMonth;

  // Advance to a safe position: move to first of next month if on last day
  if (isLastDay) {
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    // Now go to last day of the resulting month
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(lastDay);
  } else {
    // Set day to 1 first to avoid overflow, then set month, then clamp day
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(originalDay, maxDay));
  }
  return d;
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoWeekDate(date: Date): { isoYear: number; isoWeek: number } {
  // ISO 8601 week number algorithm
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Mon=1, Sun=7)
  const dayNum = d.getUTCDay() || 7; // Convert Sun=0 to Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear, isoWeek: weekNo };
}

// ── Registration ─────────────────────────────────────────────────────

export function registerDateTimeFunctions(registry: FunctionRegistry): void {
  // ADDMONTHS(date, n)
  registry.register('ADDMONTHS', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 2) throw new FormulaError('ADDMONTHS requires 2 arguments');
    const dateVal = ctx.evaluate(ctx.args[0]!);
    const nVal = ctx.evaluate(ctx.args[1]!);
    if (dateVal === null || nVal === null) return null;
    if (!isDate(dateVal)) throw new FormulaError('ADDMONTHS: first argument must be a date');
    const n = toNumber(nVal);
    if (n === null) throw new FormulaError('ADDMONTHS: second argument must be a number');
    const months = Math.trunc(n);
    return addMonthsToDate(dateVal, months);
  });

  // DATE(year, month, day)
  registry.register('DATE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 3) throw new FormulaError('DATE requires 3 arguments');
    const yVal = ctx.evaluate(ctx.args[0]!);
    const mVal = ctx.evaluate(ctx.args[1]!);
    const dVal = ctx.evaluate(ctx.args[2]!);
    if (yVal === null || mVal === null || dVal === null) return null;
    const year = toNumber(yVal);
    const month = toNumber(mVal);
    const day = toNumber(dVal);
    if (year === null || month === null || day === null) {
      throw new FormulaError('DATE: arguments must be numbers');
    }
    const y = Math.trunc(year);
    const m = Math.trunc(month);
    const d = Math.trunc(day);
    if (y < 1 || y > 9999) throw new FormulaError(`DATE: invalid year ${y}`);
    if (m < 1 || m > 12) throw new FormulaError(`DATE: invalid month ${m}`);
    const maxDay = daysInMonth(y, m);
    if (d < 1 || d > maxDay) throw new FormulaError(`DATE: invalid day ${d} for month ${m}/${y}`);
    return new Date(Date.UTC(y, m - 1, d));
  });

  // DATEVALUE(text|datetime)
  registry.register('DATEVALUE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('DATEVALUE requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (isDate(val)) {
      // Strip time part: return date-only at UTC midnight
      return new Date(Date.UTC(val.getUTCFullYear(), val.getUTCMonth(), val.getUTCDate()));
    }
    if (typeof val === 'string') {
      const match = val.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!match) throw new FormulaError(`DATEVALUE: invalid date string "${val}"`);
      const y = parseInt(match[1]!, 10);
      const m = parseInt(match[2]!, 10);
      const d = parseInt(match[3]!, 10);
      if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
        throw new FormulaError(`DATEVALUE: invalid date "${val}"`);
      }
      return new Date(Date.UTC(y, m - 1, d));
    }
    throw new FormulaError('DATEVALUE: argument must be a string or date');
  });

  // DATETIMEVALUE(text)
  registry.register('DATETIMEVALUE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('DATETIMEVALUE requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (typeof val !== 'string') throw new FormulaError('DATETIMEVALUE: argument must be a string');
    const trimmed = val.trim();
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
    if (!match) throw new FormulaError(`DATETIMEVALUE: invalid datetime string "${val}"`);
    const y = parseInt(match[1]!, 10);
    const mo = parseInt(match[2]!, 10);
    const d = parseInt(match[3]!, 10);
    const h = parseInt(match[4]!, 10);
    const mi = parseInt(match[5]!, 10);
    const s = parseInt(match[6]!, 10);
    if (mo < 1 || mo > 12) throw new FormulaError(`DATETIMEVALUE: invalid month ${mo}`);
    if (d < 1 || d > daysInMonth(y, mo)) throw new FormulaError(`DATETIMEVALUE: invalid day ${d}`);
    if (h < 0 || h > 23) throw new FormulaError(`DATETIMEVALUE: invalid hour ${h}`);
    if (mi < 0 || mi > 59) throw new FormulaError(`DATETIMEVALUE: invalid minute ${mi}`);
    if (s < 0 || s > 59) throw new FormulaError(`DATETIMEVALUE: invalid second ${s}`);
    return markDateTime(new Date(Date.UTC(y, mo - 1, d, h, mi, s)));
  });

  // DAY(date)
  registry.register('DAY', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('DAY requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (!isDate(val)) throw new FormulaError('DAY: argument must be a date');
    return val.getUTCDate();
  });

  // HOUR(timeOrDatetime)
  registry.register('HOUR', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('HOUR requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (isSfTime(val)) return Math.floor(val.timeInMillis / 3600000);
    if (isDate(val)) return val.getUTCHours();
    throw new FormulaError('HOUR: argument must be a time or datetime');
  });

  // MILLISECOND(time)
  registry.register('MILLISECOND', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('MILLISECOND requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (isSfTime(val)) return val.timeInMillis % 1000;
    throw new FormulaError('MILLISECOND: argument must be a time');
  });

  // MINUTE(timeOrDatetime)
  registry.register('MINUTE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('MINUTE requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (isSfTime(val)) return Math.floor((val.timeInMillis % 3600000) / 60000);
    if (isDate(val)) return val.getUTCMinutes();
    throw new FormulaError('MINUTE: argument must be a time or datetime');
  });

  // MONTH(date)
  registry.register('MONTH', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('MONTH requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (!isDate(val)) throw new FormulaError('MONTH: argument must be a date');
    return val.getUTCMonth() + 1;
  });

  // NOW()
  registry.register('NOW', (ctx: FunctionContext): FormulaValue => {
    return markDateTime(ctx.options.now ? new Date(ctx.options.now.getTime()) : new Date());
  });

  // SECOND(timeOrDatetime)
  registry.register('SECOND', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('SECOND requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (isSfTime(val)) return Math.floor((val.timeInMillis % 60000) / 1000);
    if (isDate(val)) return val.getUTCSeconds();
    throw new FormulaError('SECOND: argument must be a time or datetime');
  });

  // TIMENOW()
  registry.register('TIMENOW', (ctx: FunctionContext): FormulaValue => {
    const now = ctx.options.now ?? new Date();
    const ms = now.getUTCHours() * 3600000 + now.getUTCMinutes() * 60000 + now.getUTCSeconds() * 1000 + now.getUTCMilliseconds();
    return { timeInMillis: ms } as SfTime;
  });

  // TIMEVALUE(text)
  registry.register('TIMEVALUE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('TIMEVALUE requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (typeof val !== 'string') throw new FormulaError('TIMEVALUE: argument must be a string');
    const trimmed = val.trim();
    // Match HH:mm:ss or HH:mm:ss.SSS (strict: no trailing chars)
    const match = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
    if (!match) throw new FormulaError(`TIMEVALUE: invalid time string "${val}"`);
    const h = parseInt(match[1]!, 10);
    const m = parseInt(match[2]!, 10);
    const s = parseInt(match[3]!, 10);
    const ms = match[4] ? parseInt(match[4].padEnd(3, '0'), 10) : 0;
    if (h < 0 || h > 23) throw new FormulaError(`TIMEVALUE: invalid hour ${h}`);
    if (m < 0 || m > 59) throw new FormulaError(`TIMEVALUE: invalid minute ${m}`);
    if (s < 0 || s > 59) throw new FormulaError(`TIMEVALUE: invalid second ${s}`);
    const timeInMillis = h * 3600000 + m * 60000 + s * 1000 + ms;
    return { timeInMillis } as SfTime;
  });

  // TODAY()
  registry.register('TODAY', (ctx: FunctionContext): FormulaValue => {
    const now = ctx.options.now ?? new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  });

  // WEEKDAY(date)
  registry.register('WEEKDAY', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('WEEKDAY requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (!isDate(val)) throw new FormulaError('WEEKDAY: argument must be a date');
    return val.getUTCDay() + 1;
  });

  // YEAR(date)
  registry.register('YEAR', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('YEAR requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (!isDate(val)) throw new FormulaError('YEAR: argument must be a date');
    return val.getUTCFullYear();
  });

  // ISOWEEK(date)
  registry.register('ISOWEEK', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('ISOWEEK requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (!isDate(val)) throw new FormulaError('ISOWEEK: argument must be a date');
    return isoWeekDate(val).isoWeek;
  });

  // ISOYEAR(date)
  registry.register('ISOYEAR', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('ISOYEAR requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (!isDate(val)) throw new FormulaError('ISOYEAR: argument must be a date');
    return isoWeekDate(val).isoYear;
  });

  // DAYOFYEAR(date)
  registry.register('DAYOFYEAR', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('DAYOFYEAR requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (!isDate(val)) throw new FormulaError('DAYOFYEAR: argument must be a date');
    const start = new Date(Date.UTC(val.getUTCFullYear(), 0, 1));
    return Math.floor((val.getTime() - start.getTime()) / 86400000) + 1;
  });

  // UNIXTIMESTAMP(datetime)
  registry.register('UNIXTIMESTAMP', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('UNIXTIMESTAMP requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    if (!isDate(val)) throw new FormulaError('UNIXTIMESTAMP: argument must be a date or datetime');
    return Math.floor(val.getTime() / 1000);
  });

  // TEXT(value) - basic implementation for date/time formatting
  // TEXT is registered in text.ts (more complete implementation with SfTime and date-only support)

  // FROMUNIXTIME(seconds) - needed for UNIXTIMESTAMP test cases
  registry.register('FROMUNIXTIME', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 1) throw new FormulaError('FROMUNIXTIME requires 1 argument');
    const val = ctx.evaluate(ctx.args[0]!);
    if (val === null) return null;
    const n = toNumber(val);
    if (n === null) throw new FormulaError('FROMUNIXTIME: argument must be a number');
    return markDateTime(new Date(n * 1000));
  });
}
