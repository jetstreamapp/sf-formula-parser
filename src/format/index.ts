import type { ASTNode } from '../parser/ast.js';
import { printDoc } from './doc.js';
import { parseForFormat } from './parse.js';
import { fromAST } from './from-ast.js';
import { printNode } from './printer.js';

export interface FormatOptions {
  /** Preferred maximum line width. Constructs that fit stay on one line; longer ones break. Default `80`. */
  printWidth?: number;
  /** Number of spaces per indentation level (also the visual width of a tab when `useTabs` is set). Default `2`. */
  tabWidth?: number;
  /** Indent with tabs instead of spaces. Default `false`. */
  useTabs?: boolean;
}

function resolveOptions(options: FormatOptions | undefined) {
  return {
    printWidth: options?.printWidth ?? 80,
    tabWidth: options?.tabWidth ?? 2,
    useTabs: options?.useTabs ?? false,
  };
}

/**
 * Format a formula string. Only whitespace and the casing of function names and
 * keywords (`TRUE`, `FALSE`, `NULL`, `NOT`) change — parentheses, comments, string
 * and number literals are preserved exactly as written, and the result always
 * parses to the same AST as the input.
 *
 * Throws `LexerError` / `ParseError` for invalid formulas.
 */
export function formatFormula(formula: string, options?: FormatOptions): string {
  return printDoc(printNode(parseForFormat(formula)), resolveOptions(options));
}

/**
 * Print an AST back to formula source. Because the AST carries no parentheses or
 * comments, only the parentheses required by operator precedence are emitted and
 * strings are double-quoted (single-quoted when they contain a double quote).
 */
export function formatAST(node: ASTNode, options?: FormatOptions): string {
  return printDoc(printNode(fromAST(node)), resolveOptions(options));
}
