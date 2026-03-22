---
sidebar_position: 2
title: API Reference
---

# API Reference

## Functions

### `evaluateFormula(formula, context, options?)`

Parse and evaluate a formula in a single call. This is the simplest way to use the library.

```typescript
import { evaluateFormula } from '@jetstreamapp/sf-formula-parser';

const result = evaluateFormula('UPPER(LEFT(Name, 3))', { record: { Name: 'Acme Corp' } });
// "ACM"
```

**Parameters:**

| Parameter | Type                | Description                    |
| --------- | ------------------- | ------------------------------ |
| `formula` | `string`            | The Salesforce formula string  |
| `context` | `FormulaContext`    | The record to evaluate against |
| `options` | `EvaluationOptions` | Optional evaluation settings   |

**Returns:** `FormulaValue` — the result of evaluating the formula.

---

### `parseFormula(formula)`

Parse a formula string into an AST without evaluating it. Useful for caching parsed formulas, building linters, or inspecting formula structure.

```typescript
import { parseFormula } from '@jetstreamapp/sf-formula-parser';

const ast = parseFormula('1 + 2 * 3');
// Returns an ASTNode tree
```

**Parameters:**

| Parameter | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| `formula` | `string` | The Salesforce formula string |

**Returns:** `ASTNode` — the root node of the parsed AST.

---

### `createEvaluator(registry?, context?, options?)`

Create a reusable `Evaluator` instance. Useful when evaluating many formulas against the same context, or when using a custom function registry.

```typescript
import { createEvaluator, createDefaultRegistry } from '@jetstreamapp/sf-formula-parser';

const evaluator = createEvaluator(createDefaultRegistry(), { record: { Status: 'Active', Amount: 100 } });
```

**Parameters:**

| Parameter  | Type                | Default          | Description              |
| ---------- | ------------------- | ---------------- | ------------------------ |
| `registry` | `FunctionRegistry`  | Default registry | Function registry to use |
| `context`  | `FormulaContext`    | `{ record: {} }` | Record context           |
| `options`  | `EvaluationOptions` | `undefined`      | Evaluation options       |

**Returns:** `Evaluator`

---

### `createDefaultRegistry()`

Create a `FunctionRegistry` pre-loaded with all 90+ built-in Salesforce functions.

```typescript
import { createDefaultRegistry } from '@jetstreamapp/sf-formula-parser';

const registry = createDefaultRegistry();
```

**Returns:** `FunctionRegistry`

---

### `extractFields(formula)`

Extract all field references from a formula string without evaluating it. Returns a deduplicated array of field names in the order they appear. Useful for determining which fields to query before evaluation.

```typescript
import { extractFields } from '@jetstreamapp/sf-formula-parser';

const fields = extractFields('IF(Amount > 100, $User.FirstName, Name)');
// ['Amount', '$User.FirstName', 'Name']
```

**Parameters:**

| Parameter | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| `formula` | `string` | The Salesforce formula string |

**Returns:** `string[]` — deduplicated array of dot-joined field reference strings.

---

### `extractFieldsByCategory(formula)`

Extract and categorize field references from a formula string. Fields are grouped by their `$`-prefix into object fields, globals, custom metadata, custom labels, custom settings, and custom permissions.

```typescript
import { extractFieldsByCategory } from '@jetstreamapp/sf-formula-parser';

const result = extractFieldsByCategory('IF($User.IsActive, $Label.Greeting & " " & Name, $Setup.Default__c.Value__c)');
// {
//   objectFields: ['Name'],
//   globals: { '$User': ['$User.IsActive'] },
//   customMetadata: [],
//   customLabels: ['$Label.Greeting'],
//   customSettings: ['$Setup.Default__c.Value__c'],
//   customPermissions: [],
// }
```

**Parameters:**

| Parameter | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| `formula` | `string` | The Salesforce formula string |

**Returns:** `ExtractedFields` — categorized field references.

---

### `walkAST(node, visitor)`

Walk an AST tree in pre-order, calling the visitor function on each node. Useful for building custom analysis tools on top of the parsed AST.

```typescript
import { parseFormula, walkAST } from '@jetstreamapp/sf-formula-parser';

const ast = parseFormula('IF(Amount > 100, Name, "default")');
const functionNames: string[] = [];

walkAST(ast, node => {
  if (node.type === 'FunctionCall') {
    functionNames.push(node.name);
  }
});
// functionNames: ['IF']
```

**Parameters:**

| Parameter | Type                      | Description                        |
| --------- | ------------------------- | ---------------------------------- |
| `node`    | `ASTNode`                 | The root AST node to start walking |
| `visitor` | `(node: ASTNode) => void` | Callback invoked on each node      |

---

## Classes

### `FunctionRegistry`

A registry that maps function names to implementations. Case-insensitive.

```typescript
import { FunctionRegistry } from '@jetstreamapp/sf-formula-parser';

const registry = new FunctionRegistry();

// Register a custom function
registry.register('DOUBLE', ctx => {
  const val = ctx.evaluate(ctx.args[0]);
  return (val as number) * 2;
});
```

**Methods:**

| Method               | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `register(name, fn)` | Register a function by name                               |
| `get(name)`          | Get a function by name (returns `undefined` if not found) |
| `has(name)`          | Check if a function is registered                         |

---

### `Evaluator`

The tree-walking evaluator. Evaluates an AST node against a record context.

```typescript
import { Evaluator, createDefaultRegistry } from '@jetstreamapp/sf-formula-parser';

const evaluator = new Evaluator(createDefaultRegistry(), { record: { x: 10 } });
```

---

### `Parser`

The Pratt parser. Converts a formula string into an AST.

```typescript
import { Parser } from '@jetstreamapp/sf-formula-parser';

const ast = Parser.parse('1 + 2');
```

---

## Types

### `FormulaValue`

```typescript
type FormulaValue = number | string | boolean | Date | SfTime | GeoLocation | null;
```

The result type of any formula evaluation.

### `FormulaRecord`

```typescript
type FormulaRecord = { [key: string]: FormulaValue | FormulaRecord };
```

A flat record where field values and related records coexist as keys — the same shape as a SOQL query result.

### `FormulaContext`

```typescript
interface FormulaContext {
  record: FormulaRecord;
  globals?: Record<string, FormulaRecord>;
  priorRecord?: FormulaRecord;
  isNew?: boolean;
  isClone?: boolean;
}
```

See [Record Context](/docs/record-context) for full documentation.

### `EvaluationOptions`

```typescript
interface EvaluationOptions {
  treatBlanksAsZeroes?: boolean; // default: true
  now?: Date; // override current time
}
```

| Option                | Default      | Description                                                                                                              |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `treatBlanksAsZeroes` | `true`       | When `true`, null/blank numeric fields are treated as `0` and blank text fields as `""`. Matches the Salesforce default. |
| `now`                 | `new Date()` | Override the current timestamp. Useful for deterministic tests with `NOW()` and `TODAY()`.                               |

### `ExtractedFields`

```typescript
interface ExtractedFields {
  objectFields: string[]; // Regular fields (no $ prefix)
  globals: Record<string, string[]>; // e.g. { '$User': ['$User.FirstName'] }
  customMetadata: string[]; // $CustomMetadata.* fields
  customLabels: string[]; // $Label.* fields
  customSettings: string[]; // $Setup.* fields
  customPermissions: string[]; // $Permission.* fields
}
```

Returned by `extractFieldsByCategory()`. The `globals` map uses the original `$`-prefix as the key (e.g., `$User`, `$Organization`, `$Profile`, `$UserRole`, `$System`, `$Api`).

### `ASTNode`

The discriminated union type representing parsed formula nodes. Includes types for literals, field references, function calls, binary/unary operations, and more.

### `SfTime`

```typescript
interface SfTime {
  timeInMillis: number; // 0–86400000 (ms since midnight, GMT)
}
```

### `GeoLocation`

```typescript
interface GeoLocation {
  latitude: number;
  longitude: number;
}
```

---

## Error Classes

### `FormulaError`

Base error class for all formula errors.

### `LexerError` extends `FormulaError`

Thrown when the formula string contains invalid tokens. Includes `line` and `column` properties.

### `ParseError` extends `FormulaError`

Thrown when the formula has a syntax error. Includes `line` and `column` properties.

```typescript
import { FormulaError, LexerError, ParseError } from '@jetstreamapp/sf-formula-parser';

try {
  evaluateFormula('IF(', { record: {} });
} catch (e) {
  if (e instanceof ParseError) {
    console.log(e.line, e.column); // position of the error
  }
}
```

See [Error Handling](/docs/error-handling) for more details.

## Utility Functions

The library also exports helper functions for type checking and coercion:

| Function                 | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `isBlank(value)`         | Check if a value is null, undefined, or empty string         |
| `isSfTime(value)`        | Type guard for `SfTime` values                               |
| `isGeoLocation(value)`   | Type guard for `GeoLocation` values                          |
| `isDate(value)`          | Type guard for `Date` values                                 |
| `isFormulaValue(value)`  | Type guard — true for field values, false for nested records |
| `isFormulaRecord(value)` | Type guard — true for nested records                         |
| `toNumber(value)`        | Coerce a formula value to a number                           |
| `toText(value)`          | Coerce a formula value to a string                           |
| `toBoolean(value)`       | Coerce a formula value to a boolean                          |
