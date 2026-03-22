import type { ASTNode, FunctionCallNode, UnaryExpressionNode, BinaryExpressionNode } from '../parser/ast.js';
import type { FormulaValue, FormulaContext, FormulaRecord, EvaluationOptions, SfTime } from './context.js';
import { isFormulaValue, isFormulaRecord } from './context.js';
import { FormulaError } from './errors.js';
import { FunctionRegistry } from '../functions/registry.js';
import { isSfTime, isDate, toNumber, toBoolean, toText } from './coercion.js';

const MS_PER_DAY = 86_400_000;

export class Evaluator {
  private registry: FunctionRegistry;
  private context: FormulaContext;
  private options: EvaluationOptions;

  constructor(registry: FunctionRegistry, context: FormulaContext, options: EvaluationOptions = {}) {
    this.registry = registry;
    this.context = context;
    this.options = { treatBlanksAsZeroes: true, ...options };
  }

  evaluate(node: ASTNode): FormulaValue {
    switch (node.type) {
      case 'NumberLiteral':
        return node.value;
      case 'StringLiteral':
        return node.value;
      case 'BooleanLiteral':
        return node.value;
      case 'NullLiteral':
        return null;
      case 'FieldReference':
        return this.resolveField(node.parts);
      case 'FunctionCall':
        return this.callFunction(node);
      case 'UnaryExpression':
        return this.evalUnary(node);
      case 'BinaryExpression':
        return this.evalBinary(node);
    }
  }

  // ── Field resolution ──────────────────────────────────────────────

  private resolveField(parts: string[]): FormulaValue {
    if (parts.length === 0) return null;

    const first = parts[0]!;

    // Global variable reference ($User, $Profile, etc.)
    if (first.startsWith('$')) {
      const globalRecord = this.lookupRelated(this.context.globals ?? {}, first);
      if (!globalRecord) return null;
      return this.resolveFieldParts(globalRecord, parts.slice(1));
    }

    // Single-part: direct field lookup
    if (parts.length === 1) {
      return this.lookupField(this.context.record, first);
    }

    // Multi-part: traverse nested records, last part is the field name
    let current: FormulaRecord = this.context.record;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = this.lookupRelated(current, parts[i]!);
      if (!next) return null;
      current = next;
    }
    return this.lookupField(current, parts[parts.length - 1]!);
  }

  private resolveFieldParts(record: FormulaRecord, parts: string[]): FormulaValue {
    if (parts.length === 0) return null;
    if (parts.length === 1) {
      return this.lookupField(record, parts[0]!);
    }
    let current: FormulaRecord = record;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = this.lookupRelated(current, parts[i]!);
      if (!next) return null;
      current = next;
    }
    return this.lookupField(current, parts[parts.length - 1]!);
  }

  /** Case-insensitive field lookup — returns only FormulaValue entries */
  private lookupField(record: FormulaRecord, name: string): FormulaValue {
    const lower = name.toLowerCase();
    for (const key of Object.keys(record)) {
      if (key.toLowerCase() === lower) {
        const val = record[key];
        if (isFormulaValue(val)) return val ?? null;
        // It's a nested record, not a field value
        return null;
      }
    }
    return null;
  }

  /** Case-insensitive related record lookup — returns only nested FormulaRecord entries */
  private lookupRelated(record: FormulaRecord | Record<string, FormulaRecord>, name: string): FormulaRecord | null {
    const lower = name.toLowerCase();
    for (const key of Object.keys(record)) {
      if (key.toLowerCase() === lower) {
        const val = record[key];
        if (isFormulaRecord(val)) return val;
        return null;
      }
    }
    return null;
  }

  // ── Function calls ────────────────────────────────────────────────

  private callFunction(node: FunctionCallNode): FormulaValue {
    const fn = this.registry.get(node.name);
    if (!fn) {
      throw new FormulaError(`Unknown function: ${node.name}`);
    }
    return fn({
      evaluate: (n: ASTNode) => this.evaluate(n),
      context: this.context,
      options: this.options,
      args: node.args,
    });
  }

  // ── Unary expressions ─────────────────────────────────────────────

  private evalUnary(node: UnaryExpressionNode): FormulaValue {
    const val = this.evaluate(node.operand);
    switch (node.operator) {
      case '-': {
        if (val === null) return null;
        const n = toNumber(val);
        if (n === null) return null;
        return -n;
      }
      case '+': {
        if (val === null) return null;
        const n = toNumber(val);
        if (n === null) return null;
        return n;
      }
      case '!':
      case 'NOT': {
        if (val === null) return null;
        const b = toBoolean(val);
        if (b === null) return null;
        return !b;
      }
      default:
        throw new FormulaError(`Unknown unary operator: ${node.operator}`);
    }
  }

  // ── Binary expressions ────────────────────────────────────────────

  private evalBinary(node: BinaryExpressionNode): FormulaValue {
    const op = node.operator;

    // Short-circuit logical operators
    if (op === '&&' || op === '||') {
      return this.evalLogical(node);
    }

    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);

    switch (op) {
      case '+':
        return this.evalAdd(left, right);
      case '-':
        return this.evalSubtract(left, right);
      case '*':
        return this.evalMultiply(left, right);
      case '/':
        return this.evalDivide(left, right);
      case '^':
        return this.evalExponent(left, right);
      case '&':
        return this.evalConcat(left, right);
      case '=':
        return this.evalEquality(left, right);
      case '<>':
      case '!=': {
        const eq = this.evalEquality(left, right);
        if (eq === null) return null;
        return !eq;
      }
      case '<':
        return this.evalComparison(left, right, (a, b) => a < b);
      case '>':
        return this.evalComparison(left, right, (a, b) => a > b);
      case '<=':
        return this.evalComparison(left, right, (a, b) => a <= b);
      case '>=':
        return this.evalComparison(left, right, (a, b) => a >= b);
      default:
        throw new FormulaError(`Unknown operator: ${op}`);
    }
  }

  // ── Arithmetic ────────────────────────────────────────────────────

  private evalAdd(left: FormulaValue, right: FormulaValue): FormulaValue {
    // String + String → concatenation (like &)
    if (typeof left === 'string' || typeof right === 'string') {
      return (toText(left) ?? '') + (toText(right) ?? '');
    }

    // Date + Number or Number + Date
    if (isDate(left) && typeof right === 'number') {
      return this.addDaysToDate(left, right);
    }
    if (typeof left === 'number' && isDate(right)) {
      return this.addDaysToDate(right, left);
    }

    // SfTime + Number
    if (isSfTime(left) && typeof right === 'number') {
      return this.addToTime(left, right);
    }
    if (typeof left === 'number' && isSfTime(right)) {
      return this.addToTime(right, left);
    }

    // Numeric addition
    if (left === null || right === null) return null;
    const ln = toNumber(left);
    const rn = toNumber(right);
    if (ln === null || rn === null) return null;
    return ln + rn;
  }

  private evalSubtract(left: FormulaValue, right: FormulaValue): FormulaValue {
    // Date - Date → days between
    if (isDate(left) && isDate(right)) {
      return (left.getTime() - right.getTime()) / MS_PER_DAY;
    }

    // Date - Number → subtract days
    if (isDate(left) && typeof right === 'number') {
      return this.addDaysToDate(left, -right);
    }

    // SfTime - SfTime
    if (isSfTime(left) && isSfTime(right)) {
      return { timeInMillis: (left.timeInMillis - right.timeInMillis + MS_PER_DAY) % MS_PER_DAY };
    }

    // Numeric
    if (left === null || right === null) return null;
    const ln = toNumber(left);
    const rn = toNumber(right);
    if (ln === null || rn === null) return null;
    return ln - rn;
  }

  private evalMultiply(left: FormulaValue, right: FormulaValue): FormulaValue {
    if (left === null || right === null) return null;
    const ln = toNumber(left);
    const rn = toNumber(right);
    if (ln === null || rn === null) return null;
    return ln * rn;
  }

  private evalDivide(left: FormulaValue, right: FormulaValue): FormulaValue {
    if (left === null || right === null) return null;
    const ln = toNumber(left);
    const rn = toNumber(right);
    if (ln === null || rn === null) return null;
    if (rn === 0) throw new FormulaError('Division by zero');
    return ln / rn;
  }

  private evalExponent(left: FormulaValue, right: FormulaValue): FormulaValue {
    if (left === null || right === null) return null;
    const base = toNumber(left);
    const exp = toNumber(right);
    if (base === null || exp === null) return null;

    // Overflow protection
    if (base !== 0 && Math.log10(Math.abs(base)) * Math.abs(exp) > 64) {
      throw new FormulaError('Exponent overflow');
    }

    let result = Math.pow(base, exp);

    // Underflow: results < 1e-39 → 0
    if (Math.abs(result) < 1e-39 && result !== 0) {
      result = 0;
    }

    return result;
  }

  // ── Date/Time arithmetic helpers ──────────────────────────────────

  private isDateOnly(d: Date): boolean {
    return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  }

  private addDaysToDate(d: Date, days: number): Date {
    if (this.isDateOnly(d)) {
      // Date (not DateTime): truncate fractional part
      const wholeDays = Math.trunc(days);
      return new Date(d.getTime() + wholeDays * MS_PER_DAY);
    } else {
      // DateTime: round fractional part to nearest second
      const ms = Math.round((days * MS_PER_DAY) / 1000) * 1000;
      return new Date(d.getTime() + ms);
    }
  }

  private addToTime(time: SfTime, value: number): SfTime {
    const ms = time.timeInMillis + value;
    return { timeInMillis: ((ms % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY };
  }

  // ── String concat ─────────────────────────────────────────────────

  private evalConcat(left: FormulaValue, right: FormulaValue): string {
    // Null treated as ""
    const l = toText(left) ?? '';
    const r = toText(right) ?? '';
    return l + r;
  }

  // ── Equality ──────────────────────────────────────────────────────

  private evalEquality(left: FormulaValue, right: FormulaValue): FormulaValue {
    // String equality mode: if either operand is a string, or both are null
    const leftIsString = typeof left === 'string';
    const rightIsString = typeof right === 'string';
    const leftIsNull = left === null;
    const rightIsNull = right === null;

    if (leftIsString || rightIsString || (leftIsNull && rightIsNull)) {
      // Coerce nulls to "" for comparison
      const l = leftIsNull ? '' : leftIsString ? left : (toText(left) ?? '');
      const r = rightIsNull ? '' : rightIsString ? right : (toText(right) ?? '');
      return l === r;
    }

    // If either is null in non-string context → three-valued null
    if (leftIsNull || rightIsNull) {
      return null;
    }

    // Date comparison
    if (isDate(left) && isDate(right)) {
      return left.getTime() === right.getTime();
    }

    // SfTime comparison
    if (isSfTime(left) && isSfTime(right)) {
      return left.timeInMillis === right.timeInMillis;
    }

    // Numeric/boolean comparison
    if (typeof left === 'number' && typeof right === 'number') {
      return left === right;
    }
    if (typeof left === 'boolean' && typeof right === 'boolean') {
      return left === right;
    }

    // Fallback: coerce to text
    return toText(left) === toText(right);
  }

  // ── Comparison ────────────────────────────────────────────────────

  private evalComparison(left: FormulaValue, right: FormulaValue, cmp: (a: number, b: number) => boolean): FormulaValue {
    if (left === null || right === null) return null;

    // Date comparison
    if (isDate(left) && isDate(right)) {
      return cmp(left.getTime(), right.getTime());
    }

    // SfTime comparison
    if (isSfTime(left) && isSfTime(right)) {
      return cmp(left.timeInMillis, right.timeInMillis);
    }

    // String comparison
    if (typeof left === 'string' && typeof right === 'string') {
      // Use localeCompare-style but simple code-point comparison
      if (cmp(-1, 0)) {
        // This is a "less than" style comparison
        return left < right;
      }
      if (cmp(1, 0)) {
        // "greater than"
        return left > right;
      }
      if (cmp(0, 0)) {
        // "less than or equal" or "greater than or equal" — includes equality
        // Determine which by also checking cmp(-1, 0)
        if (cmp(-1, 0)) return left <= right;
        return left >= right;
      }
      return false;
    }

    // Numeric comparison
    const ln = toNumber(left);
    const rn = toNumber(right);
    if (ln === null || rn === null) return null;
    return cmp(ln, rn);
  }

  // ── Logical ───────────────────────────────────────────────────────

  private evalLogical(node: BinaryExpressionNode): FormulaValue {
    const left = this.evaluate(node.left);

    if (node.operator === '&&') {
      // If left is null or false, return false
      const lb = toBoolean(left);
      if (lb === null || lb === false) return false;
      // Otherwise return right coerced to boolean
      const right = this.evaluate(node.right);
      const rb = toBoolean(right);
      return rb ?? false;
    }

    if (node.operator === '||') {
      // If left is true, return true
      const lb = toBoolean(left);
      if (lb === true) return true;
      // Otherwise return right coerced to boolean
      const right = this.evaluate(node.right);
      const rb = toBoolean(right);
      return rb ?? false;
    }

    throw new FormulaError(`Unknown logical operator: ${node.operator}`);
  }
}
