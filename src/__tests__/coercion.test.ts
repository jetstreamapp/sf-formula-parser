import { describe, it, expect } from 'vitest';
import { isBlank, isSfTime, isGeoLocation, isDate, toNumber, toText, toBoolean } from '../evaluator/coercion.js';

describe('isBlank', () => {
  it('returns true for null', () => expect(isBlank(null)).toBe(true));
  it('returns true for empty string', () => expect(isBlank('')).toBe(true));
  it('returns false for zero', () => expect(isBlank(0)).toBe(false));
  it('returns false for false', () => expect(isBlank(false)).toBe(false));
  it('returns false for non-empty string', () => expect(isBlank('abc')).toBe(false));
});

describe('isSfTime', () => {
  it('detects SfTime objects', () => {
    expect(isSfTime({ timeInMillis: 1000 })).toBe(true);
  });
  it('rejects null', () => expect(isSfTime(null)).toBe(false));
  it('rejects numbers', () => expect(isSfTime(42)).toBe(false));
  it('rejects dates', () => expect(isSfTime(new Date())).toBe(false));
});

describe('isGeoLocation', () => {
  it('detects GeoLocation objects', () => {
    expect(isGeoLocation({ latitude: 37.7, longitude: -122.4 })).toBe(true);
  });
  it('rejects null', () => expect(isGeoLocation(null)).toBe(false));
  it('rejects numbers', () => expect(isGeoLocation(42)).toBe(false));
});

describe('isDate', () => {
  it('detects Date objects', () => expect(isDate(new Date())).toBe(true));
  it('rejects null', () => expect(isDate(null)).toBe(false));
  it('rejects strings', () => expect(isDate('2024-01-01')).toBe(false));
});

describe('toNumber', () => {
  it('returns null for null', () => expect(toNumber(null)).toBe(null));
  it('returns number as-is', () => expect(toNumber(42)).toBe(42));
  it('converts true to 1', () => expect(toNumber(true)).toBe(1));
  it('converts false to 0', () => expect(toNumber(false)).toBe(0));
  it('converts numeric string', () => expect(toNumber('3.14')).toBe(3.14));
  it('returns null for non-numeric string', () => expect(toNumber('abc')).toBe(null));
  it('returns null for Date', () => expect(toNumber(new Date())).toBe(null));
});

describe('toText', () => {
  it('returns null for null', () => expect(toText(null)).toBe(null));
  it('returns string as-is', () => expect(toText('hello')).toBe('hello'));
  it('converts number', () => expect(toText(42)).toBe('42'));
  it('converts true', () => expect(toText(true)).toBe('true'));
  it('converts false', () => expect(toText(false)).toBe('false'));
  it('converts Date to ISO date string', () => {
    const d = new Date('2024-06-15T00:00:00.000Z');
    expect(toText(d)).toBe('2024-06-15');
  });
});

describe('toBoolean', () => {
  it('returns null for null', () => expect(toBoolean(null)).toBe(null));
  it('returns boolean as-is', () => {
    expect(toBoolean(true)).toBe(true);
    expect(toBoolean(false)).toBe(false);
  });
  it('converts non-zero number to true', () => expect(toBoolean(1)).toBe(true));
  it('converts zero to false', () => expect(toBoolean(0)).toBe(false));
  it('converts non-empty string to true', () => expect(toBoolean('abc')).toBe(true));
  it('converts empty string to false', () => expect(toBoolean('')).toBe(false));
});
