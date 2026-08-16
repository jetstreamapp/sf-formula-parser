import { TokenType } from '../lexer/tokens.js';

/**
 * Returns [leftBP, rightBP] for binary operators.
 * left < right = left-associative, left > right = right-associative.
 *
 * Salesforce-specific precedence (unusual):
 * - ^ (exponent) is BELOW * / and is LEFT-associative
 * - & (concat) is at the SAME level as + -
 */
export function getBindingPower(tokenType: TokenType): [number, number] | null {
  switch (tokenType) {
    case TokenType.InfixOr:
      return [2, 3];
    case TokenType.InfixAnd:
      return [4, 5];
    case TokenType.Equal:
    case TokenType.Equal2:
    case TokenType.NotEqual:
    case TokenType.NotEqual2:
      return [6, 7];
    case TokenType.Lt:
    case TokenType.Gt:
    case TokenType.Le:
    case TokenType.Ge:
      return [8, 9];
    case TokenType.Plus:
    case TokenType.Minus:
    case TokenType.Concat:
      return [10, 11];
    case TokenType.Exponent:
      return [12, 13]; // LEFT-assoc, BELOW multiply
    case TokenType.Star:
    case TokenType.Div:
      return [14, 15];
    default:
      return null;
  }
}

export const UNARY_BP = 16;

/**
 * How each binary operator is spelled. Precedence itself is never repeated here — it is read
 * from `getBindingPower`, so this table can only ever drift in spelling, never in binding power.
 */
const OPERATOR_TOKENS: Record<string, TokenType> = {
  '||': TokenType.InfixOr,
  '&&': TokenType.InfixAnd,
  '=': TokenType.Equal,
  '==': TokenType.Equal2,
  '<>': TokenType.NotEqual,
  '!=': TokenType.NotEqual2,
  '<': TokenType.Lt,
  '>': TokenType.Gt,
  '<=': TokenType.Le,
  '>=': TokenType.Ge,
  '+': TokenType.Plus,
  '-': TokenType.Minus,
  '&': TokenType.Concat,
  '^': TokenType.Exponent,
  '*': TokenType.Star,
  '/': TokenType.Div,
};

/**
 * Binding powers looked up by an operator's source spelling, for callers holding operator text
 * rather than a token — printing an AST back to source. Returns `null` for spellings this
 * grammar has no operator for, which is only reachable through hand-built ASTs.
 */
export function getBindingPowerForOperator(operator: string): [number, number] | null {
  const tokenType = OPERATOR_TOKENS[operator];
  return tokenType === undefined ? null : getBindingPower(tokenType);
}
