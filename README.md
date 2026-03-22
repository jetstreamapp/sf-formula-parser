<p align="center">
  <img src="logo.svg" alt="sf-formula-parser" width="480" />
</p>

# sf-formula-parser

> Built 100% by [Claude Code](https://claude.com/claude-code) — lexer, parser, evaluator, 90+ functions, tests, and docs.
>
> Some tests cases were extracted from [formula-engine](https://github.com/salesforce/formula-engine) to validate actual Salesforce behavior.

A JavaScript/TypeScript implementation of the Salesforce formula language. Parses formula strings into an AST and evaluates them against a record context — entirely client-side, with zero dependencies.

## Why?

Salesforce formulas are powerful, but evaluating them outside of Salesforce (in custom UIs, offline tools, testing harnesses, or migration scripts) has historically required either round-tripping to the API or reimplementing logic by hand. This library gives you a spec-faithful formula engine that runs anywhere JavaScript runs — browsers, Node.js, edge functions.

The implementation was built by studying the [open-source Salesforce formula engine](https://github.com/salesforce/formula-engine) to match real-world behavior, not just documentation.

## Features

- **90+ functions** across logical, math, text, and date/time categories
- **All operators** — arithmetic (`+`, `-`, `*`, `/`, `^`), comparison (`=`, `!=`, `<`, `>`, `<=`, `>=`), logical (`&&`, `||`, `!`), and string concatenation (`&`)
- **Case-insensitive** — `IF`, `if`, `If` all work, just like Salesforce
- **Lazy evaluation** — `IF`, `CASE`, `IFS`, and other branching functions only evaluate the branch that's taken
- **Related record traversal** — `Account.Name`, `Contact.Account.Industry`
- **Prior value support** — `ISCHANGED`, `PRIORVALUE`, `ISNEW`, `ISCLONE`
- **Zero dependencies** — pure TypeScript, compiles to ESM
- **Browser-compatible** — no Node.js APIs required

## Installation

```bash
npm install @jetstreamapp/sf-formula-parser
```

## Quick Start

```typescript
import { evaluateFormula } from '@jetstreamapp/sf-formula-parser';

const result = evaluateFormula('IF(Amount > 1000, "Large", "Small")', {
  record: {
    Amount: 5000,
  },
});
// result: "Large"
```

## API

### `evaluateFormula(formula, context, options?)`

Parse and evaluate a formula in one call.

```typescript
import { evaluateFormula } from '@jetstreamapp/sf-formula-parser';

const result = evaluateFormula('UPPER(LEFT(Name, 3))', {
  record: { Name: 'Acme Corp' },
});
// result: "ACM"
```

### `parseFormula(formula)`

Parse a formula string into an AST without evaluating it. Useful for caching, inspection, or building tooling on top of formulas.

```typescript
import { parseFormula } from '@jetstreamapp/sf-formula-parser';

const ast = parseFormula('1 + 2 * 3');
```

### `createEvaluator(registry?, context?, options?)`

Create a reusable evaluator instance. Useful when evaluating many formulas against the same context or with a custom function registry.

```typescript
import { createEvaluator, createDefaultRegistry } from '@jetstreamapp/sf-formula-parser';

const evaluator = createEvaluator(createDefaultRegistry(), {
  record: { Status: 'Active', Amount: 100 },
});
```

## Record Context

The `FormulaContext` object represents the record a formula is evaluated against:

```typescript
interface FormulaContext {
  record: FormulaRecord; // field values and related records
  globals?: Record<string, FormulaRecord>; // e.g., $User.Id
  priorRecord?: FormulaRecord; // for ISCHANGED / PRIORVALUE
  isNew?: boolean; // for ISNEW()
  isClone?: boolean; // for ISCLONE()
}

// A flat record — fields and related records coexist as keys, just like a SOQL result
type FormulaRecord = { [key: string]: FormulaValue | FormulaRecord };
```

`FormulaValue` can be `number`, `string`, `boolean`, `Date`, `SfTime`, `GeoLocation`, or `null`.

### Related Records

Related records are nested directly in the record — no separate `related` property needed:

```typescript
evaluateFormula('Account.Industry', {
  record: {
    Account: { Industry: 'Technology' },
  },
});
// result: "Technology"
```

### Options

```typescript
interface EvaluationOptions {
  treatBlanksAsZeroes?: boolean; // default: true (matches Salesforce default)
  now?: Date; // override current time for deterministic tests
}
```

## Supported Functions

| Category           | Functions                                                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Logical** (16)   | `IF`, `IFS`, `CASE`, `AND`, `OR`, `NOT`, `ISBLANK`, `ISNULL`, `ISNUMBER`, `BLANKVALUE`, `NULLVALUE`, `IFERROR`, `ISCHANGED`, `ISNEW`, `ISCLONE`, `PRIORVALUE`                                                                                                                             |
| **Math** (19)      | `ABS`, `CEILING`, `FLOOR`, `MCEILING`, `MFLOOR`, `EXP`, `LN`, `LOG`, `MAX`, `MIN`, `MOD`, `PI`, `POWER`, `RAND`, `ROUND`, `SQRT`, `TRUNC`, `DISTANCE`, `GEOLOCATION`                                                                                                                      |
| **Text** (27)      | `BEGINS`, `BR`, `CASESAFEID`, `CONTAINS`, `FIND`, `GETSESSIONID`, `HTMLENCODE`, `HYPERLINK`, `IMAGE`, `INCLUDES`, `ISPICKVAL`, `JSENCODE`, `JSINHTMLENCODE`, `LEFT`, `LEN`, `LOWER`, `LPAD`, `MID`, `RIGHT`, `RPAD`, `SUBSTITUTE`, `TEXT`, `TRIM`, `UPPER`, `URLENCODE`, `VALUE`, `REGEX` |
| **Date/Time** (17) | `ADDMONTHS`, `DATE`, `DATEVALUE`, `DATETIMEVALUE`, `DAY`, `HOUR`, `MILLISECOND`, `MINUTE`, `MONTH`, `NOW`, `SECOND`, `TIMENOW`, `TIMEVALUE`, `TODAY`, `WEEKDAY`, `YEAR`                                                                                                                   |

## Architecture

```
Formula String → Lexer → Tokens → Parser → AST → Evaluator → FormulaValue
                                                      ↑
                                              FormulaContext + Options
```

- **Lexer** — tokenizes the formula string, handling string escapes, comments, and operators
- **Parser** — hand-rolled Pratt parser (top-down operator precedence) producing a discriminated union AST
- **Evaluator** — tree-walking evaluator with lazy argument evaluation and a pluggable function registry

## Error Handling

The library throws typed errors you can catch and inspect:

```typescript
import { FormulaError, LexerError, ParseError } from '@jetstreamapp/sf-formula-parser';

try {
  evaluateFormula('IF(', { record: {} });
} catch (e) {
  if (e instanceof ParseError) {
    // syntax error
  } else if (e instanceof FormulaError) {
    // runtime evaluation error
  }
}
```

## License

MIT
