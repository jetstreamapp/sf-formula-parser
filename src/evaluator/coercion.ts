import type { FormulaValue, SfTime, GeoLocation } from './context.js';

export function isBlank(value: FormulaValue): boolean {
  return value === null || value === undefined || value === '';
}

export function isSfTime(value: FormulaValue): value is SfTime {
  return value !== null && typeof value === 'object' && 'timeInMillis' in value;
}

export function isGeoLocation(value: FormulaValue): value is GeoLocation {
  return value !== null && typeof value === 'object' && 'latitude' in value && 'longitude' in value;
}

export function isDate(value: FormulaValue): value is Date {
  return value instanceof Date;
}

const DATETIME_MARKER = Symbol('isDateTime');

/** Mark a Date object as a DateTime (has meaningful time component) */
export function markDateTime(d: Date): Date {
  (d as unknown as Record<symbol, boolean>)[DATETIME_MARKER] = true;
  return d;
}

/** Check if a Date was explicitly marked as DateTime */
export function isDateTime(d: Date): boolean {
  return (d as unknown as Record<symbol, boolean>)[DATETIME_MARKER] === true;
}

/** Check if a Date is date-only (not marked as DateTime and has zero time parts) */
export function isDateOnly(d: Date): boolean {
  if (isDateTime(d)) return false;
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

export function toNumber(value: FormulaValue): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return isNaN(n) ? null : n;
  }
  return null;
}

export function toText(value: FormulaValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString().substring(0, 10);
  return String(value);
}

export function toBoolean(value: FormulaValue): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value !== '';
  return null;
}
