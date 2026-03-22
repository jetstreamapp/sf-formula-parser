---
sidebar_position: 4
title: Error Handling
---

# Error Handling

The library throws typed errors that you can catch and inspect. All errors extend the base `FormulaError` class.

## Error Hierarchy

```
FormulaError
├── LexerError    — invalid tokens (unterminated strings, bad characters)
└── ParseError    — syntax errors (missing parens, invalid expressions)
```

Runtime evaluation errors (division by zero, type mismatches) throw the base `FormulaError`.

## Catching Errors

```typescript
import { evaluateFormula, FormulaError, LexerError, ParseError } from '@jetstreamapp/sf-formula-parser';

try {
  evaluateFormula('IF(Amount >', { record: {} });
} catch (e) {
  if (e instanceof ParseError) {
    console.log('Syntax error:', e.message);
    console.log('Position:', e.line, e.column);
  } else if (e instanceof LexerError) {
    console.log('Tokenization error:', e.message);
    console.log('Position:', e.line, e.column);
  } else if (e instanceof FormulaError) {
    console.log('Runtime error:', e.message);
  }
}
```

## Error Properties

### `LexerError`

| Property  | Type     | Description                            |
| --------- | -------- | -------------------------------------- |
| `message` | `string` | Human-readable error description       |
| `line`    | `number` | Line number where the error occurred   |
| `column`  | `number` | Column number where the error occurred |

### `ParseError`

| Property  | Type     | Description                            |
| --------- | -------- | -------------------------------------- |
| `message` | `string` | Human-readable error description       |
| `line`    | `number` | Line number where the error occurred   |
| `column`  | `number` | Column number where the error occurred |

### `FormulaError`

| Property  | Type     | Description                      |
| --------- | -------- | -------------------------------- |
| `message` | `string` | Human-readable error description |

## Common Error Scenarios

### Syntax errors

```typescript
evaluateFormula('IF(', { record: {} });
// ParseError: Unexpected end of input at line 1, column 4

evaluateFormula('1 +', { record: {} });
// ParseError: Unexpected end of input at line 1, column 4
```

### Invalid tokens

```typescript
evaluateFormula('"unterminated string', { record: {} });
// LexerError: Unterminated string literal at line 1, column 1
```

### Runtime errors

```typescript
evaluateFormula('1 / 0', { record: {} });
// FormulaError or returns Infinity (matches Salesforce behavior)

evaluateFormula('MID("hello", -1, 3)', { record: {} });
// FormulaError: Invalid arguments
```

## Best Practices

**Validate formulas before storing them.** Use `parseFormula()` to check syntax without evaluating:

```typescript
import { parseFormula, ParseError } from '@jetstreamapp/sf-formula-parser';

function isValidFormula(formula: string): boolean {
  try {
    parseFormula(formula);
    return true;
  } catch (e) {
    return false;
  }
}
```

**Use type narrowing for specific handling:**

```typescript
import { FormulaError, ParseError } from '@jetstreamapp/sf-formula-parser';

function handleError(e: unknown): string {
  if (e instanceof ParseError) {
    return `Syntax error at line ${e.line}, column ${e.column}: ${e.message}`;
  }
  if (e instanceof FormulaError) {
    return `Formula error: ${e.message}`;
  }
  return 'Unknown error';
}
```
