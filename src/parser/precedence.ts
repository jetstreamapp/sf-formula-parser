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
