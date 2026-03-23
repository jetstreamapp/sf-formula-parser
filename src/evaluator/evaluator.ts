import type { ASTNode, FunctionCallNode, UnaryExpressionNode, BinaryExpressionNode } from '../parser/ast.js';
import type { FormulaValue, FormulaContext, FormulaRecord, EvaluationOptions, SfTime } from './context.js';
import { isFormulaValue, isFormulaRecord } from './context.js';
import { FormulaError } from './errors.js';
import { FunctionRegistry } from '../functions/registry.js';
import { isSfTime, isDate, isDateOnly, isGeoLocation, toNumber, toBoolean, toText } from './coercion.js';
import { SchemaMap, SCHEMA_SELF_KEY, markPicklist, markMultipicklist, isAnyPicklistValue, getPicklistFieldName } from './schema.js';

const MS_PER_DAY = 86_400_000;

export class Evaluator {
  private registry: FunctionRegistry;
  private context: FormulaContext;
  private options: EvaluationOptions;
  private schemaMap: SchemaMap | null;

  constructor(registry: FunctionRegistry, context: FormulaContext, options: EvaluationOptions = {}) {
    this.registry = registry;
    this.context = context;
    this.options = { treatBlanksAsZeroes: true, ...options };
    this.schemaMap = options.schema ? new SchemaMap(options.schema) : null;
  }

  /** Public evaluation entry point — unwraps internal markers (e.g., picklist boxed strings). */
  evaluate(node: ASTNode): FormulaValue {
    const result = this.evaluateNode(node);
    // Unwrap boxed String from picklist markers back to primitive string
    if (isAnyPicklistValue(result)) {
      return (result as object).valueOf() as string;
    }
    return result;
  }

  /** Internal evaluation — preserves picklist markers for type checking through the call chain. */
  private evaluateNode(node: ASTNode): FormulaValue {
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
      // Schema path for globals is the $-prefixed name (e.g., '$User')
      const schemaPath = first;
      return this.resolveFieldWithSchema(globalRecord, parts.slice(1), schemaPath);
    }

    // Single-part: direct field lookup on root object
    if (parts.length === 1) {
      return this.lookupFieldWithSchema(this.context.record, first, SCHEMA_SELF_KEY);
    }

    // Multi-part: traverse nested records, last part is the field name
    // Schema path = relationship parts joined (e.g., 'Account' or 'Contact.Account')
    let current: FormulaRecord = this.context.record;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = this.lookupRelated(current, parts[i]!);
      if (!next) return null;
      current = next;
    }
    const schemaPath = parts.slice(0, -1).join('.');
    return this.lookupFieldWithSchema(current, parts[parts.length - 1]!, schemaPath);
  }

  /** Resolve field parts with schema path tracking. */
  private resolveFieldWithSchema(record: FormulaRecord, parts: string[], basePath: string): FormulaValue {
    if (parts.length === 0) return null;
    if (parts.length === 1) {
      return this.lookupFieldWithSchema(record, parts[0]!, basePath);
    }
    let current: FormulaRecord = record;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = this.lookupRelated(current, parts[i]!);
      if (!next) return null;
      current = next;
    }
    const schemaPath = basePath ? basePath + '.' + parts.slice(0, -1).join('.') : parts.slice(0, -1).join('.');
    return this.lookupFieldWithSchema(current, parts[parts.length - 1]!, schemaPath);
  }

  /** Case-insensitive field lookup with schema validation scoped to a relationship path. */
  private lookupFieldWithSchema(record: FormulaRecord, name: string, schemaPath: string): FormulaValue {
    const lower = name.toLowerCase();

    // Schema validation: check field exists if schema is defined for this path
    if (this.schemaMap) {
      if (this.schemaMap.hasSchemaFor(schemaPath)) {
        const fieldInfo =
          schemaPath === SCHEMA_SELF_KEY ? this.schemaMap.getField(lower) : this.schemaMap.getRelatedField(schemaPath, lower);
        if (!fieldInfo) {
          throw new FormulaError(`Field ${name} does not exist. Check spelling.`);
        }
      }
      // If no schema for this path, skip validation (schema not provided for this object)
    }

    return this.lookupFieldRaw(record, name, schemaPath);
  }

  /** Case-insensitive field lookup without schema validation. */
  private lookupFieldRaw(record: FormulaRecord, name: string, schemaPath?: string): FormulaValue {
    const lower = name.toLowerCase();
    for (const key of Object.keys(record)) {
      if (key.toLowerCase() === lower) {
        const val = record[key];
        if (isFormulaValue(val)) {
          return this.applySchemaMarkers(val ?? null, lower, schemaPath ?? SCHEMA_SELF_KEY);
        }
        // It's a nested record, not a field value
        return null;
      }
    }
    return null;
  }

  /** Apply picklist/multipicklist markers based on schema info. */
  private applySchemaMarkers(value: FormulaValue, fieldNameLower: string, schemaPath: string): FormulaValue {
    if (!this.schemaMap || value === null) return value;
    const fieldInfo =
      schemaPath === SCHEMA_SELF_KEY ? this.schemaMap.getField(fieldNameLower) : this.schemaMap.getRelatedField(schemaPath, fieldNameLower);
    if (!fieldInfo) return value;

    if (fieldInfo.formulaType === 'picklist' && typeof value === 'string') {
      return markPicklist(value, fieldNameLower);
    }
    if (fieldInfo.formulaType === 'multipicklist' && typeof value === 'string') {
      return markMultipicklist(value, fieldNameLower);
    }
    return value;
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

  // Functions that accept picklist/multipicklist arguments
  private static readonly PICKLIST_ALLOWED_FUNCTIONS = new Set([
    'TEXT',
    'ISPICKVAL',
    'ISBLANK',
    'ISNULL',
    'NULLVALUE',
    'BLANKVALUE',
    'CASE',
    'ISCHANGED',
    'PRIORVALUE',
    'INCLUDES', // multipicklist only, but we allow it here and let the function validate
  ]);

  private callFunction(node: FunctionCallNode): FormulaValue {
    const fn = this.registry.get(node.name);
    if (!fn) {
      throw new FormulaError(`Unknown function: ${node.name}`);
    }

    // For functions that don't support picklists, wrap evaluate to reject picklist values
    const baseEvaluate = (n: ASTNode) => this.evaluateNode(n);
    const evaluate =
      this.schemaMap && !Evaluator.PICKLIST_ALLOWED_FUNCTIONS.has(node.name)
        ? (n: ASTNode) => {
            const val = baseEvaluate(n);
            if (isAnyPicklistValue(val)) {
              const name = getPicklistFieldName(val) ?? 'unknown';
              throw new FormulaError(`Field ${name} is a picklist field. Picklist fields are only supported in certain functions.`);
            }
            return val;
          }
        : baseEvaluate;

    return fn({
      evaluate,
      context: this.context,
      options: this.options,
      args: node.args,
    });
  }

  // ── Unary expressions ─────────────────────────────────────────────

  private evalUnary(node: UnaryExpressionNode): FormulaValue {
    const val = this.evaluateNode(node.operand);
    this.assertNotPicklistUnary(val);
    switch (node.operator) {
      case '-': {
        if (val === null) return null;
        if (typeof val !== 'number') {
          throw new FormulaError(`Incorrect parameter type for operator '-'. Expected Number, received ${this.describeType(val)}`);
        }
        return -val;
      }
      case '+': {
        if (val === null) return null;
        if (typeof val !== 'number') {
          throw new FormulaError(`Incorrect parameter type for operator '+'. Expected Number, received ${this.describeType(val)}`);
        }
        return val;
      }
      case '!':
      case 'NOT': {
        if (val === null) return null;
        if (typeof val !== 'boolean') {
          throw new FormulaError(
            `Incorrect parameter type for operator '${node.operator}'. Expected Boolean, received ${this.describeType(val)}`,
          );
        }
        return !val;
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

    const left = this.evaluateNode(node.left);
    const right = this.evaluateNode(node.right);

    // Picklist values cannot be used in any operator
    this.assertNotPicklist(left, right);

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

  // ── Picklist enforcement ─────────────────────────────────────────

  /** Throws if either operand is a picklist value (operators don't support picklists). */
  private assertNotPicklist(left: FormulaValue, right: FormulaValue): void {
    if (isAnyPicklistValue(left)) {
      const name = getPicklistFieldName(left) ?? 'unknown';
      throw new FormulaError(`Field ${name} is a picklist field. Picklist fields are only supported in certain functions.`);
    }
    if (isAnyPicklistValue(right)) {
      const name = getPicklistFieldName(right) ?? 'unknown';
      throw new FormulaError(`Field ${name} is a picklist field. Picklist fields are only supported in certain functions.`);
    }
  }

  /** Throws if the value is a picklist (for unary operators). */
  private assertNotPicklistUnary(val: FormulaValue): void {
    if (isAnyPicklistValue(val)) {
      const name = getPicklistFieldName(val) ?? 'unknown';
      throw new FormulaError(`Field ${name} is a picklist field. Picklist fields are only supported in certain functions.`);
    }
  }

  // ── Arithmetic ────────────────────────────────────────────────────

  /** Returns the Salesforce type name for a runtime value (for error messages). */
  private describeType(value: FormulaValue): string {
    if (value === null || value === undefined) return 'Null';
    if (typeof value === 'number') return 'Number';
    if (typeof value === 'string') return 'Text';
    if (typeof value === 'boolean') return 'Boolean';
    if (isDate(value)) return isDateOnly(value) ? 'Date' : 'Date/Time';
    if (isSfTime(value)) return 'Time';
    if (isGeoLocation(value)) return 'Location';
    return 'Unknown';
  }

  /** Salesforce rejects booleans in arithmetic operators (+, -, *, /, ^). */
  private assertNotBoolean(left: FormulaValue, right: FormulaValue, op: string): void {
    if (typeof left === 'boolean' || typeof right === 'boolean') {
      const received = typeof left === 'boolean' ? 'Boolean' : 'Boolean';
      throw new FormulaError(`Incorrect parameter type for operator '${op}'. Expected Number, Date, Date/Time, received ${received}`);
    }
  }

  /** Salesforce rejects strings in arithmetic operators (-, *, /, ^). Not + since + does concatenation. */
  private assertNotString(left: FormulaValue, right: FormulaValue, op: string): void {
    if (typeof left === 'string' || typeof right === 'string') {
      throw new FormulaError(`Incorrect parameter type for operator '${op}'. Expected Number, Date, Date/Time, received Text`);
    }
  }

  /** Rejects non-numeric types in strict arithmetic (-, *, /, ^). */
  private assertArithmeticTypes(left: FormulaValue, right: FormulaValue, op: string): void {
    this.assertNotBoolean(left, right, op);
    this.assertNotString(left, right, op);
  }

  private evalAdd(left: FormulaValue, right: FormulaValue): FormulaValue {
    // String + String → concatenation (like &)
    if (typeof left === 'string' || typeof right === 'string') {
      return (toText(left) ?? '') + (toText(right) ?? '');
    }

    // Date + Date or DateTime + DateTime → error (Salesforce rejects this)
    if (isDate(left) && isDate(right)) {
      const lType = isDateOnly(left) ? 'Date' : 'Date/Time';
      const rType = isDateOnly(right) ? 'Date' : 'Date/Time';
      throw new FormulaError(`Incorrect parameter type for operator '+'. Expected Number, received ${rType}`);
    }

    // Date + Number or Number + Date
    if (isDate(left) && typeof right === 'number') {
      return this.addDaysToDate(left, right);
    }
    if (typeof left === 'number' && isDate(right)) {
      return this.addDaysToDate(right, left);
    }

    // Date/DateTime + non-number → error
    if (isDate(left) || isDate(right)) {
      const received = this.describeType(isDate(left) ? right : left);
      throw new FormulaError(`Incorrect parameter type for operator '+'. Expected Number, received ${received}`);
    }

    // SfTime + SfTime → error (can subtract times but not add them)
    if (isSfTime(left) && isSfTime(right)) {
      throw new FormulaError(`Incorrect parameter type for operator '+'. Expected Number, received Time`);
    }

    // SfTime + Number
    if (isSfTime(left) && typeof right === 'number') {
      return this.addToTime(left, right);
    }
    if (typeof left === 'number' && isSfTime(right)) {
      return this.addToTime(right, left);
    }

    // SfTime + non-number → error
    if (isSfTime(left) || isSfTime(right)) {
      const received = this.describeType(isSfTime(left) ? right : left);
      throw new FormulaError(`Incorrect parameter type for operator '+'. Expected Number, received ${received}`);
    }

    // Numeric addition
    this.assertNotBoolean(left, right, '+');
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

    // SfTime - Number → subtract from time
    if (isSfTime(left) && typeof right === 'number') {
      return this.addToTime(left, -right);
    }

    // Date/DateTime/SfTime with invalid partner → error
    if (isDate(left) || isDate(right)) {
      const received = this.describeType(isDate(left) ? right : left);
      throw new FormulaError(`Incorrect parameter type for operator '-'. Expected Number, received ${received}`);
    }
    if (isSfTime(left) || isSfTime(right)) {
      const received = this.describeType(isSfTime(left) ? right : left);
      throw new FormulaError(`Incorrect parameter type for operator '-'. Expected Time, received ${received}`);
    }

    // Numeric
    this.assertArithmeticTypes(left, right, '-');
    if (left === null || right === null) return null;
    const ln = toNumber(left);
    const rn = toNumber(right);
    if (ln === null || rn === null) return null;
    return ln - rn;
  }

  private evalMultiply(left: FormulaValue, right: FormulaValue): FormulaValue {
    this.assertArithmeticTypes(left, right, '*');
    if (left === null || right === null) return null;
    const ln = toNumber(left);
    const rn = toNumber(right);
    if (ln === null || rn === null) return null;
    return ln * rn;
  }

  private evalDivide(left: FormulaValue, right: FormulaValue): FormulaValue {
    this.assertArithmeticTypes(left, right, '/');
    if (left === null || right === null) return null;
    const ln = toNumber(left);
    const rn = toNumber(right);
    if (ln === null || rn === null) return null;
    if (rn === 0) throw new FormulaError('Division by zero');
    return ln / rn;
  }

  private evalExponent(left: FormulaValue, right: FormulaValue): FormulaValue {
    this.assertArithmeticTypes(left, right, '^');
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
    const left = this.evaluateNode(node.left);

    if (node.operator === '&&') {
      // If left is null or false, return false
      const lb = toBoolean(left);
      if (lb === null || lb === false) return false;
      // Otherwise return right coerced to boolean
      const right = this.evaluateNode(node.right);
      const rb = toBoolean(right);
      return rb ?? false;
    }

    if (node.operator === '||') {
      // If left is true, return true
      const lb = toBoolean(left);
      if (lb === true) return true;
      // Otherwise return right coerced to boolean
      const right = this.evaluateNode(node.right);
      const rb = toBoolean(right);
      return rb ?? false;
    }

    throw new FormulaError(`Unknown logical operator: ${node.operator}`);
  }
}
