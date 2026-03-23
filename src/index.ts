import { Parser } from './parser/index.js';
import { Evaluator } from './evaluator/evaluator.js';
import { createDefaultRegistry } from './functions/registry.js';
import type { ASTNode } from './parser/ast.js';
import type { FormulaValue, FormulaContext, FormulaReturnType, EvaluationOptions } from './evaluator/context.js';
import { FunctionRegistry } from './functions/registry.js';
import { FormulaError } from './evaluator/errors.js';
import { isDate, isDateOnly, isSfTime, isGeoLocation } from './evaluator/coercion.js';

/** Returns the Salesforce type name for a runtime value. */
function describeValueType(value: FormulaValue): string {
  if (value === null || value === undefined) return 'Null';
  if (typeof value === 'number') return 'Number';
  if (typeof value === 'string') return 'Text';
  if (typeof value === 'boolean') return 'Boolean';
  if (isDate(value)) return isDateOnly(value) ? 'Date' : 'Date/Time';
  if (isSfTime(value)) return 'Time';
  if (isGeoLocation(value)) return 'Location';
  return 'Unknown';
}

/** Map FormulaReturnType to its display name for error messages. */
function returnTypeDisplayName(rt: FormulaReturnType): string {
  switch (rt) {
    case 'number':
      return 'Number';
    case 'string':
      return 'Text';
    case 'boolean':
      return 'Boolean';
    case 'date':
      return 'Date';
    case 'datetime':
      return 'Date/Time';
    case 'time':
      return 'Time';
  }
}

/** Check if a result value is compatible with the declared return type. */
function isCompatibleReturnType(value: FormulaValue, returnType: FormulaReturnType): boolean {
  if (value === null) return true; // null is compatible with any return type
  switch (returnType) {
    case 'number':
      return typeof value === 'number';
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return isDate(value) && isDateOnly(value);
    case 'datetime':
      return isDate(value) && !isDateOnly(value);
    case 'time':
      return isSfTime(value);
  }
}

export function evaluateFormula(formula: string, context: FormulaContext, options?: EvaluationOptions): FormulaValue {
  const ast = Parser.parse(formula);
  const registry = createDefaultRegistry();
  const evaluator = new Evaluator(registry, context, options);
  const result = evaluator.evaluate(ast);

  // Validate return type when provided
  if (options?.returnType && !isCompatibleReturnType(result, options.returnType)) {
    const actual = describeValueType(result);
    const expected = returnTypeDisplayName(options.returnType);
    throw new FormulaError(`Formula result is data type (${actual}), incompatible with expected data type (${expected}).`);
  }

  return result;
}

export function parseFormula(formula: string): ASTNode {
  return Parser.parse(formula);
}

export function createEvaluator(registry?: FunctionRegistry, context?: FormulaContext, options?: EvaluationOptions): Evaluator {
  return new Evaluator(registry ?? createDefaultRegistry(), context ?? { record: {} }, options);
}

// Re-export types
export type {
  FormulaValue,
  FormulaContext,
  FormulaRecord,
  FormulaReturnType,
  EvaluationOptions,
  SfTime,
  GeoLocation,
} from './evaluator/context.js';
export type { ASTNode } from './parser/ast.js';
export { isFormulaValue, isFormulaRecord } from './evaluator/context.js';
export { FormulaError, LexerError, ParseError } from './evaluator/errors.js';
export { FunctionRegistry, createDefaultRegistry } from './functions/registry.js';
export { Parser } from './parser/index.js';
export { Evaluator } from './evaluator/evaluator.js';
export { isBlank, isSfTime, isGeoLocation, isDate, toNumber, toText, toBoolean } from './evaluator/coercion.js';
export { extractFields, extractFieldsByCategory } from './extract.js';
export type { ExtractedFields } from './extract.js';
export { walkAST } from './parser/walk.js';
export type { FieldSchema, SalesforceFieldType, FormulaType, SchemaInput } from './evaluator/schema.js';
export { toFormulaType, SCHEMA_SELF_KEY } from './evaluator/schema.js';
