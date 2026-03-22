import { FunctionRegistry, type FunctionContext } from './registry.js';
import { FormulaError } from '../evaluator/errors.js';
import { toNumber, isGeoLocation } from '../evaluator/coercion.js';
import type { FormulaValue, GeoLocation } from '../evaluator/context.js';

// ── Helper functions ──────────────────────────────────────────────

function preRoundHalfDown(n: number): number {
  if (n === 0) return 0;
  const precision = 15;
  const digits = Math.floor(Math.log10(Math.abs(n))) + 1;
  const factor = Math.pow(10, precision - digits);
  return Math.round(n * factor) / factor;
}

function roundHalfUp(value: number, scale: number): number {
  const factor = Math.pow(10, scale);
  const abs = Math.abs(value);
  // Add a tiny epsilon to handle floating-point representation issues
  // e.g., 1.005 * 100 = 100.49999... but should round to 101
  const shifted = abs * factor;
  const rounded = Math.round(shifted + 1e-10);
  return (Math.sign(value) * rounded) / factor;
}

function sfRound(value: number, scale: number): number {
  if (value === 0) return 0;
  const abs = Math.abs(value);
  if (abs < 1) {
    const shifted = abs + 1;
    const rounded = roundHalfUp(shifted, scale);
    return value < 0 ? -(rounded - 1) : rounded - 1;
  }
  return roundHalfUp(value, scale);
}

function truncate(value: number, scale: number): number {
  const factor = Math.pow(10, scale);
  return Math.trunc(value * factor) / factor;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number, unit: string): number {
  const R = unit.toLowerCase() === 'mi' ? 3958.8 : 6371.0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── Arg evaluation helpers ────────────────────────────────────────

function evalNum(ctx: FunctionContext, index: number): number | null {
  const val = ctx.evaluate(ctx.args[index]!);
  if (val === null) return null;
  return toNumber(val);
}

function evalVal(ctx: FunctionContext, index: number): FormulaValue {
  return ctx.evaluate(ctx.args[index]!);
}

// ── Registration ──────────────────────────────────────────────────

export function registerMathFunctions(registry: FunctionRegistry): void {
  // 1. ABS
  registry.register('ABS', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    return Math.abs(n);
  });

  // 2. CEILING — rounds AWAY from zero (up magnitude) for both positive and negative
  registry.register('CEILING', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    const pr = preRoundHalfDown(n);
    // Away from zero: positive → Math.ceil, negative → -Math.ceil(abs)
    if (pr >= 0) return Math.ceil(pr);
    return -Math.ceil(Math.abs(pr));
  });

  // 3. FLOOR — rounds toward zero for negatives (= Math.trunc with pre-rounding)
  registry.register('FLOOR', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    const pr = preRoundHalfDown(n);
    const result = Math.trunc(pr);
    // Avoid -0
    return result === 0 ? 0 : result;
  });

  // 4. MCEILING — mathematical ceiling, always toward +inf
  registry.register('MCEILING', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    const result = Math.ceil(n);
    // Avoid -0
    return result === 0 ? 0 : result;
  });

  // 5. MFLOOR — mathematical floor, always toward -inf
  registry.register('MFLOOR', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    return Math.floor(n);
  });

  // 6. ROUND
  registry.register('ROUND', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    const scale = evalNum(ctx, 1);
    if (n === null || scale === null) return null;
    return sfRound(n, scale);
  });

  // 7. TRUNC
  registry.register('TRUNC', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    const scale = ctx.args.length > 1 ? evalNum(ctx, 1) : 0;
    if (scale === null) return null;
    return truncate(n, scale);
  });

  // 8. MOD
  registry.register('MOD', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    const d = evalNum(ctx, 1);
    if (n === null || d === null) return null;
    if (d === 0) throw new FormulaError('Division by zero');
    return n % d;
  });

  // 9. MAX (variadic)
  registry.register('MAX', (ctx: FunctionContext): FormulaValue => {
    let result: number | null = null;
    for (let i = 0; i < ctx.args.length; i++) {
      const n = evalNum(ctx, i);
      if (n === null) return null;
      if (result === null || n > result) result = n;
    }
    return result;
  });

  // 10. MIN (variadic)
  registry.register('MIN', (ctx: FunctionContext): FormulaValue => {
    let result: number | null = null;
    for (let i = 0; i < ctx.args.length; i++) {
      const n = evalNum(ctx, i);
      if (n === null) return null;
      if (result === null || n < result) result = n;
    }
    return result;
  });

  // 11. EXP
  registry.register('EXP', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    return Math.exp(n);
  });

  // 12. LN
  registry.register('LN', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    return Math.log(n);
  });

  // 13. LOG
  registry.register('LOG', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    return Math.log10(n);
  });

  // 14. SQRT
  registry.register('SQRT', (ctx: FunctionContext): FormulaValue => {
    const n = evalNum(ctx, 0);
    if (n === null) return null;
    return Math.sqrt(n);
  });

  // 15. PI
  registry.register('PI', (_ctx: FunctionContext): FormulaValue => {
    return Math.PI;
  });

  // 16. POWER
  registry.register('POWER', (ctx: FunctionContext): FormulaValue => {
    const base = evalNum(ctx, 0);
    const exp = evalNum(ctx, 1);
    if (base === null || exp === null) return null;
    if (base !== 0 && Math.log10(Math.abs(base)) * exp > 64) {
      throw new FormulaError('Exponent overflow');
    }
    let result = Math.pow(base, exp);
    if (Math.abs(result) < 1e-39 && result !== 0) {
      result = 0;
    }
    return result;
  });

  // 17. RAND
  registry.register('RAND', (_ctx: FunctionContext): FormulaValue => {
    return Math.random();
  });

  // 18. DISTANCE
  registry.register('DISTANCE', (ctx: FunctionContext): FormulaValue => {
    const loc1 = evalVal(ctx, 0);
    const loc2 = evalVal(ctx, 1);
    const unitVal = evalVal(ctx, 2);

    if (loc1 === null || loc2 === null || unitVal === null) return null;

    if (!isGeoLocation(loc1)) {
      throw new FormulaError('DISTANCE: first argument must be a GeoLocation');
    }
    if (!isGeoLocation(loc2)) {
      throw new FormulaError('DISTANCE: second argument must be a GeoLocation');
    }
    if (typeof unitVal !== 'string') {
      throw new FormulaError('DISTANCE: third argument must be a string ("mi" or "km")');
    }

    const unit = unitVal.toLowerCase();
    if (unit !== 'mi' && unit !== 'km') {
      throw new FormulaError('DISTANCE: unit must be "mi" or "km"');
    }

    return haversineDistance(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude, unit);
  });

  // 19. GEOLOCATION
  registry.register('GEOLOCATION', (ctx: FunctionContext): FormulaValue => {
    const lat = evalNum(ctx, 0);
    const lng = evalNum(ctx, 1);
    if (lat === null || lng === null) return null;
    return { latitude: lat, longitude: lng } as GeoLocation;
  });
}
