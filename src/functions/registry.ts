import type { ASTNode } from '../parser/ast.js';
import type { FormulaValue, FormulaContext, EvaluationOptions } from '../evaluator/context.js';
import { registerLogicalFunctions } from './logical.js';
import { registerMathFunctions } from './math.js';
import { registerTextFunctions } from './text.js';
import { registerDateTimeFunctions } from './date-time.js';

export type EvaluateFn = (node: ASTNode) => FormulaValue;

export interface FunctionContext {
  evaluate: EvaluateFn;
  context: FormulaContext;
  options: EvaluationOptions;
  args: ASTNode[]; // raw AST nodes (for lazy evaluation)
}

export type FormulaFunction = (ctx: FunctionContext) => FormulaValue;

export class FunctionRegistry {
  private functions: Map<string, FormulaFunction> = new Map();

  register(name: string, fn: FormulaFunction): void {
    this.functions.set(name.toUpperCase(), fn);
  }

  get(name: string): FormulaFunction | undefined {
    return this.functions.get(name.toUpperCase());
  }

  has(name: string): boolean {
    return this.functions.has(name.toUpperCase());
  }
}

export function createDefaultRegistry(): FunctionRegistry {
  const registry = new FunctionRegistry();
  registerLogicalFunctions(registry);
  registerMathFunctions(registry);
  registerTextFunctions(registry);
  registerDateTimeFunctions(registry);
  return registry;
}
