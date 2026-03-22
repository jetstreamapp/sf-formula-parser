import { describe, it, expect } from 'vitest';
import { evaluateFormula } from '../index.js';
import { FormulaError } from '../evaluator/errors.js';

const ctx = { record: {} };

function eval_(formula: string) {
  return evaluateFormula(formula, ctx);
}

describe('Math Functions', () => {
  // ── ABS ──────────────────────────────────────────────────────────
  describe('ABS', () => {
    it('returns absolute value of negative', () => {
      expect(eval_('ABS(-5)')).toBe(5);
    });
    it('returns absolute value of positive', () => {
      expect(eval_('ABS(5)')).toBe(5);
    });
    it('returns null for null', () => {
      expect(eval_('ABS(NULL)')).toBeNull();
    });
    it('returns 0 for 0', () => {
      expect(eval_('ABS(0)')).toBe(0);
    });
  });

  // ── CEILING ──────────────────────────────────────────────────────
  describe('CEILING', () => {
    it('rounds positive up', () => {
      expect(eval_('CEILING(2.3)')).toBe(3);
    });
    it('rounds negative away from zero (up in magnitude)', () => {
      expect(eval_('CEILING(-2.5)')).toBe(-3);
    });
    it('rounds negative away from zero (fractional)', () => {
      expect(eval_('CEILING(-1.3)')).toBe(-2);
    });
    it('handles floating point noise (6/11*11)', () => {
      expect(eval_('CEILING(6/11*11)')).toBe(6);
    });
    it('returns null for null', () => {
      expect(eval_('CEILING(NULL)')).toBeNull();
    });
  });

  // ── FLOOR ────────────────────────────────────────────────────────
  describe('FLOOR', () => {
    it('rounds positive down', () => {
      expect(eval_('FLOOR(2.3)')).toBe(2);
    });
    it('rounds negative toward zero', () => {
      expect(eval_('FLOOR(-2.5)')).toBe(-2);
    });
    it('rounds negative toward zero (fractional)', () => {
      expect(eval_('FLOOR(-1.3)')).toBe(-1);
    });
    it('returns null for null', () => {
      expect(eval_('FLOOR(NULL)')).toBeNull();
    });
  });

  // ── MCEILING ─────────────────────────────────────────────────────
  describe('MCEILING', () => {
    it('rounds positive up', () => {
      expect(eval_('MCEILING(2.3)')).toBe(3);
    });
    it('rounds negative toward +inf', () => {
      expect(eval_('MCEILING(-2.5)')).toBe(-2);
    });
    it('returns null for null', () => {
      expect(eval_('MCEILING(NULL)')).toBeNull();
    });
  });

  // ── MFLOOR ───────────────────────────────────────────────────────
  describe('MFLOOR', () => {
    it('rounds positive down', () => {
      expect(eval_('MFLOOR(2.3)')).toBe(2);
    });
    it('rounds negative toward -inf', () => {
      expect(eval_('MFLOOR(-2.5)')).toBe(-3);
    });
    it('returns null for null', () => {
      expect(eval_('MFLOOR(NULL)')).toBeNull();
    });
  });

  // ── ROUND ────────────────────────────────────────────────────────
  describe('ROUND', () => {
    it('rounds half up (positive)', () => {
      expect(eval_('ROUND(2.5, 0)')).toBe(3);
    });
    it('rounds half up (negative)', () => {
      expect(eval_('ROUND(-2.5, 0)')).toBe(-3);
    });
    it('negative scale', () => {
      expect(eval_('ROUND(12345, -2)')).toBe(12300);
    });
    it('rounds 1.005 to 2 places', () => {
      expect(eval_('ROUND(1.005, 2)')).toBe(1.01);
    });
    it('rounds 0 to 0', () => {
      expect(eval_('ROUND(0, 2)')).toBe(0);
    });
    it('rounds small number (< 1)', () => {
      expect(eval_('ROUND(0.5, 0)')).toBe(1);
    });
    it('returns null for null', () => {
      expect(eval_('ROUND(NULL, 2)')).toBeNull();
      expect(eval_('ROUND(2, NULL)')).toBeNull();
    });
  });

  // ── TRUNC ────────────────────────────────────────────────────────
  describe('TRUNC', () => {
    it('truncates positive', () => {
      expect(eval_('TRUNC(2.7, 0)')).toBe(2);
    });
    it('truncates negative', () => {
      expect(eval_('TRUNC(-2.7, 0)')).toBe(-2);
    });
    it('truncates with scale', () => {
      expect(eval_('TRUNC(2.789, 2)')).toBe(2.78);
    });
    it('default scale is 0', () => {
      expect(eval_('TRUNC(3.14)')).toBe(3);
    });
    it('returns null for null', () => {
      expect(eval_('TRUNC(NULL)')).toBeNull();
    });
  });

  // ── MOD ──────────────────────────────────────────────────────────
  describe('MOD', () => {
    it('positive mod', () => {
      expect(eval_('MOD(7, 3)')).toBe(1);
    });
    it('negative dividend', () => {
      expect(eval_('MOD(-7, 3)')).toBe(-1);
    });
    it('positive dividend, negative divisor', () => {
      expect(eval_('MOD(7, -3)')).toBe(1);
    });
    it('division by zero throws', () => {
      expect(() => eval_('MOD(7, 0)')).toThrow(FormulaError);
    });
    it('returns null for null', () => {
      expect(eval_('MOD(NULL, 3)')).toBeNull();
      expect(eval_('MOD(7, NULL)')).toBeNull();
    });
  });

  // ── MAX ──────────────────────────────────────────────────────────
  describe('MAX', () => {
    it('returns larger', () => {
      expect(eval_('MAX(1, 3)')).toBe(3);
    });
    it('returns null if any arg is null', () => {
      expect(eval_('MAX(1, NULL)')).toBeNull();
      expect(eval_('MAX(NULL, 3)')).toBeNull();
    });
  });

  // ── MIN ──────────────────────────────────────────────────────────
  describe('MIN', () => {
    it('returns smaller', () => {
      expect(eval_('MIN(1, 3)')).toBe(1);
    });
    it('returns null if any arg is null', () => {
      expect(eval_('MIN(1, NULL)')).toBeNull();
      expect(eval_('MIN(NULL, 3)')).toBeNull();
    });
  });

  // ── EXP ──────────────────────────────────────────────────────────
  describe('EXP', () => {
    it('computes e^1', () => {
      expect(eval_('EXP(1)')).toBeCloseTo(Math.E, 10);
    });
    it('computes e^0 = 1', () => {
      expect(eval_('EXP(0)')).toBe(1);
    });
    it('returns null for null', () => {
      expect(eval_('EXP(NULL)')).toBeNull();
    });
  });

  // ── LN ───────────────────────────────────────────────────────────
  describe('LN', () => {
    it('computes ln(e) = 1', () => {
      expect(eval_('LN(2.718281828459045)')).toBeCloseTo(1, 10);
    });
    it('computes ln(1) = 0', () => {
      expect(eval_('LN(1)')).toBe(0);
    });
    it('returns null for null', () => {
      expect(eval_('LN(NULL)')).toBeNull();
    });
  });

  // ── LOG ──────────────────────────────────────────────────────────
  describe('LOG', () => {
    it('computes log10(100) = 2', () => {
      expect(eval_('LOG(100)')).toBe(2);
    });
    it('computes log10(1) = 0', () => {
      expect(eval_('LOG(1)')).toBe(0);
    });
    it('returns null for null', () => {
      expect(eval_('LOG(NULL)')).toBeNull();
    });
  });

  // ── SQRT ─────────────────────────────────────────────────────────
  describe('SQRT', () => {
    it('computes sqrt(9) = 3', () => {
      expect(eval_('SQRT(9)')).toBe(3);
    });
    it('computes sqrt(2)', () => {
      expect(eval_('SQRT(2)')).toBeCloseTo(1.4142135623730951, 10);
    });
    it('returns null for null', () => {
      expect(eval_('SQRT(NULL)')).toBeNull();
    });
  });

  // ── PI ───────────────────────────────────────────────────────────
  describe('PI', () => {
    it('returns Math.PI', () => {
      expect(eval_('PI()')).toBe(Math.PI);
    });
  });

  // ── POWER ────────────────────────────────────────────────────────
  describe('POWER', () => {
    it('computes 2^10 = 1024', () => {
      expect(eval_('POWER(2, 10)')).toBe(1024);
    });
    it('computes 3^0 = 1', () => {
      expect(eval_('POWER(3, 0)')).toBe(1);
    });
    it('throws on overflow', () => {
      expect(() => eval_('POWER(10, 100)')).toThrow(FormulaError);
    });
    it('returns null for null', () => {
      expect(eval_('POWER(NULL, 2)')).toBeNull();
      expect(eval_('POWER(2, NULL)')).toBeNull();
    });
  });

  // ── RAND ─────────────────────────────────────────────────────────
  describe('RAND', () => {
    it('returns a number between 0 and 1', () => {
      const result = eval_('RAND()');
      expect(typeof result).toBe('number');
      expect(result as number).toBeGreaterThanOrEqual(0);
      expect(result as number).toBeLessThan(1);
    });
  });

  // ── GEOLOCATION ──────────────────────────────────────────────────
  describe('GEOLOCATION', () => {
    it('creates a GeoLocation object', () => {
      const result = eval_('GEOLOCATION(37.7749, -122.4194)');
      expect(result).toEqual({ latitude: 37.7749, longitude: -122.4194 });
    });
    it('returns null for null args', () => {
      expect(eval_('GEOLOCATION(NULL, -122.4194)')).toBeNull();
      expect(eval_('GEOLOCATION(37.7749, NULL)')).toBeNull();
    });
  });

  // ── DISTANCE ─────────────────────────────────────────────────────
  describe('DISTANCE', () => {
    it('computes distance between SF and LA in miles', () => {
      // SF: 37.7749, -122.4194  LA: 34.0522, -118.2437
      const result = eval_('DISTANCE(GEOLOCATION(37.7749, -122.4194), GEOLOCATION(34.0522, -118.2437), "mi")');
      expect(typeof result).toBe('number');
      // ~347 miles
      expect(result as number).toBeGreaterThan(340);
      expect(result as number).toBeLessThan(360);
    });

    it('computes distance in km', () => {
      const result = eval_('DISTANCE(GEOLOCATION(37.7749, -122.4194), GEOLOCATION(34.0522, -118.2437), "km")');
      expect(typeof result).toBe('number');
      // ~559 km
      expect(result as number).toBeGreaterThan(550);
      expect(result as number).toBeLessThan(570);
    });

    it('is case-insensitive for unit', () => {
      const result = eval_('DISTANCE(GEOLOCATION(0, 0), GEOLOCATION(0, 1), "KM")');
      expect(typeof result).toBe('number');
    });

    it('returns null for null location', () => {
      expect(eval_('DISTANCE(NULL, GEOLOCATION(0, 0), "mi")')).toBeNull();
    });
  });
});
