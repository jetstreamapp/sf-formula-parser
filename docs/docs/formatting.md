---
sidebar_position: 5
title: Formatting
---

# Formatting

`formatFormula` pretty-prints a formula the way Prettier formats code: consistent spacing, one argument per line when a call gets too long, and predictable indentation — without ever changing what the formula means.

```typescript
import { formatFormula } from '@jetstreamapp/sf-formula-parser';

formatFormula('if(and(ispickval(StageName,"Closed Won"),Amount>100000),"Big Deal",if(Amount>50000,"Medium Deal","Small Deal"))');
```

```
IF(
  AND(ISPICKVAL(StageName, "Closed Won"), Amount > 100000),
  "Big Deal",
  IF(Amount > 50000, "Medium Deal", "Small Deal")
)
```

## Guarantees

- **Meaning is never changed.** The formatted output always parses to the same AST as the input — this is verified against the entire test corpus.
- **Parentheses are preserved exactly** — never added, never removed.
- **String and number literals are emitted verbatim** — quote style, escapes, and digits (`1.50`) stay as written.
- **Comments are preserved** and stay attached to the expression they were next to.
- **Idempotent** — formatting already-formatted output produces identical text.
- Only whitespace and the casing of function names and keywords change.
- Invalid formulas throw the same `LexerError` / `ParseError` as `parseFormula`.

## What changes

| Input                       | Output                                                      |
| --------------------------- | ----------------------------------------------------------- |
| `if(isblank(x),upper(y),z)` | `IF(ISBLANK(x), UPPER(y), z)`                               |
| `IF(true,false,null)`       | `IF(TRUE, FALSE, NULL)`                                     |
| `not IsActive`              | `NOT IsActive`                                              |
| `a==b&&c!=d`                | `a == b && c != d` (symbolic operators are kept as written) |
| `Amount>100`                | `Amount > 100`                                              |
| `( a + b )*c`               | `(a + b) * c`                                               |

Field references (`Account.Name`, `$User.Id`) are never re-cased.

## Layout rules

### Function calls

A call stays on one line when it fits within `printWidth`. Otherwise every argument goes on its own line, indented one level, with the closing parenthesis on its own line. Nested calls are decided independently, so a broken outer call can still contain one-line inner calls.

```
AND(
  ISPICKVAL(StageName, "Closed Won"),
  Amount > 100000,
  NOT(ISBLANK(CloseDate)),
  OR(Type = "New", Type = "Renewal")
)
```

### `CASE` and `IFS`

Value/result pairs are kept together on one line when the call breaks:

```
CASE(
  StageName,
  "Prospecting", 1,
  "Qualification", 2,
  "Needs Analysis", 3,
  "Proposal/Price Quote", 4,
  0
)

IFS(
  Amount > 1000000, "Enterprise",
  Amount > 100000, "Large",
  Amount > 50000, "Medium",
  "Small"
)
```

### Operators

Chains of the same operator level (`a & b & c`, `x && y && z`, `p + q - r`) are kept on one line when they fit. When they don't, the chain breaks after each operator and the continuation is indented:

```
IF(
  ISBLANK(FirstName),
  LastName,
  "Hello there my good friend " &
    FirstName &
    " " &
    MiddleName &
    " " &
    LastName &
    "!"
)
```

Sub-expressions of a different precedence (`a + b * c`) and parenthesized groups are laid out as their own units.

### Comments

Block comments (`/* ... */`) are preserved. A comment that was on its own line stays on its own line (and forces the surrounding call to break); an inline comment stays inline.

```
/* Deal sizing */
IF(
  /* only closed deals count */
  ISPICKVAL(StageName, "Closed Won"),
  Amount /* in USD */,
  0
)
```

## Options

```typescript
interface FormatOptions {
  printWidth?: number; // default 80 — preferred maximum line width
  tabWidth?: number; // default 2 — spaces per indent level (or the visual width of a tab)
  useTabs?: boolean; // default false — indent with tabs instead of spaces
}

formatFormula(formula, { printWidth: 100, tabWidth: 4 });
```

`printWidth` is a preference, not a hard limit: a single long token (a long string literal or field path) can still exceed it.

## Formatting an AST

`formatAST` prints an `ASTNode` back to source. Use it when you build or transform ASTs programmatically (for example, renaming field references) and need formula text back.

```typescript
import { parseFormula, formatAST, walkAST } from '@jetstreamapp/sf-formula-parser';

const ast = parseFormula('IF(ISBLANK(Old_Field__c), "n/a", Old_Field__c)');
walkAST(ast, node => {
  if (node.type === 'FieldReference' && node.parts[0] === 'Old_Field__c') {
    node.parts[0] = 'New_Field__c';
  }
});

formatAST(ast);
// IF(ISBLANK(New_Field__c), "n/a", New_Field__c)
```

Because the AST does not record parentheses, comments, or the original spelling of literals, `formatAST` differs from `formatFormula` in a few ways:

- Only the parentheses **required by operator precedence** are emitted (`(a + b) * c` keeps them, `(a * b) + c` becomes `a * b + c`).
- Strings are **double-quoted** (single-quoted when the value contains a `"` but no `'`), with `\`, quotes and control characters escaped so the value survives re-parsing.
- Numbers are printed as decimal digits (never exponent notation), booleans/null as `TRUE`/`FALSE`/`NULL`.
- Comments are not available and therefore not printed. `==` and `!=` were already normalized to `=` and `<>` by the parser.

The layout rules and options are the same as `formatFormula`.
