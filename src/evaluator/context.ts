export interface SfTime {
  timeInMillis: number; // 0–86400000 (ms since midnight, GMT)
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export type FormulaValue = number | string | boolean | Date | SfTime | GeoLocation | null;

/**
 * A flat record where keys map to field values or nested related records.
 * Mirrors the shape of a SOQL query result — no need to wrap in `fields`/`related`.
 */
export type FormulaRecord = { [key: string]: FormulaValue | FormulaRecord };

export interface FormulaContext {
  record: FormulaRecord;
  globals?: Record<string, FormulaRecord>;
  priorRecord?: FormulaRecord;
  isNew?: boolean;
  isClone?: boolean;
}

export interface EvaluationOptions {
  treatBlanksAsZeroes?: boolean; // default: true
  now?: Date; // override for deterministic tests
}

/**
 * Returns true if the value is a FormulaValue (primitive, Date, SfTime, GeoLocation, or null)
 * rather than a nested FormulaRecord.
 */
export function isFormulaValue(v: unknown): v is FormulaValue {
  if (v === null || v === undefined) return true;
  if (typeof v !== 'object') return true; // string, number, boolean
  if (v instanceof Date) return true;
  if ('timeInMillis' in v) return true; // SfTime
  if ('latitude' in v && 'longitude' in v) return true; // GeoLocation
  return false;
}

/**
 * Returns true if the value is a nested FormulaRecord (a plain object that is not
 * a Date, SfTime, or GeoLocation).
 */
export function isFormulaRecord(v: unknown): v is FormulaRecord {
  return !isFormulaValue(v) && typeof v === 'object';
}
