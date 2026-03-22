import { Parser } from './parser/index.js';
import { Evaluator } from './evaluator/evaluator.js';
import { createDefaultRegistry } from './functions/registry.js';
import type { ASTNode } from './parser/ast.js';
import type { FormulaValue, FormulaContext, EvaluationOptions } from './evaluator/context.js';
import { FunctionRegistry } from './functions/registry.js';

export function evaluateFormula(formula: string, context: FormulaContext, options?: EvaluationOptions): FormulaValue {
  const ast = Parser.parse(formula);
  const registry = createDefaultRegistry();
  const evaluator = new Evaluator(registry, context, options);
  return evaluator.evaluate(ast);
}

export function parseFormula(formula: string): ASTNode {
  return Parser.parse(formula);
}

export function createEvaluator(registry?: FunctionRegistry, context?: FormulaContext, options?: EvaluationOptions): Evaluator {
  return new Evaluator(registry ?? createDefaultRegistry(), context ?? { record: {} }, options);
}

// Re-export types
export type { FormulaValue, FormulaContext, FormulaRecord, EvaluationOptions, SfTime, GeoLocation } from './evaluator/context.js';
export type { ASTNode } from './parser/ast.js';
export { isFormulaValue, isFormulaRecord } from './evaluator/context.js';
export { FormulaError, LexerError, ParseError } from './evaluator/errors.js';
export { FunctionRegistry, createDefaultRegistry } from './functions/registry.js';
export { Parser } from './parser/index.js';
export { Evaluator } from './evaluator/evaluator.js';
export { isBlank, isSfTime, isGeoLocation, isDate, toNumber, toText, toBoolean } from './evaluator/coercion.js';
