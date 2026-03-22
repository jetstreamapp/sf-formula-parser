# Salesforce Formula Parser & Executor - Implementation Plan

---

## Task Tracker

> **IMPORTANT — Read this first when resuming work.**
> This tracker is the single source of truth for what's done and what's next. Update it as you complete each phase or sub-task. When suspending a session, ensure the tracker reflects the current state so the next session can pick up without re-discovery.

| Phase | Description                         | Status | Notes                                                                                                                    |
| ----- | ----------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| 0     | Project Scaffolding + Test Fixtures | `DONE` | vitest, tsconfig, directory skeleton, error classes                                                                      |
| 1     | Lexer                               | `DONE` | 59 tests, all token types                                                                                                |
| 2     | Parser                              | `DONE` | Pratt parser, 35 tests, SF-specific precedence verified                                                                  |
| 3     | Evaluator Core                      | `DONE` | Full operator semantics, date/time arithmetic, null handling, 59 tests                                                   |
| 4     | Logical Functions (16)              | `DONE` | IF/IFS/CASE/AND/OR/NOT/ISBLANK/ISNULL/ISNUMBER/BLANKVALUE/NULLVALUE/IFERROR/ISCHANGED/ISNEW/ISCLONE/PRIORVALUE, 62 tests |
| 5     | Math Functions (19)                 | `DONE` | All 19 + GEOLOCATION/DISTANCE, 64 tests                                                                                  |
| 6     | Text Functions (27+3)               | `DONE` | 27 planned + CHR/ASCII/INITCAP, 98 tests                                                                                 |
| 7     | Date/Time Functions (17+4)          | `DONE` | 17 planned + ISOWEEK/ISOYEAR/DAYOFYEAR/UNIXTIMESTAMP/FROMUNIXTIME, 104 tests                                             |
| 8     | Integration Tests & Polish          | `DONE` | 371 test-cases.ts + 5 hand-written = 376 integration tests. 883 total tests all passing.                                 |
| 9     | Salesforce Verification             | `DONE` | 47/47 passed via FormulaEval API. IFS skipped (not supported by API, works in real fields).                              |

**Status values:** `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `DONE`

### Session Log

_Record a brief entry each time work starts or stops so context is never lost._

| Date       | Session | What was done                                                                                                                                    | What's next |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 2026-03-22 | 1       | All 9 phases complete. 883 unit/integration tests passing. 47/47 SF org verification passing. Phases 4-7 ran in parallel via worktree isolation. | Done.       |

### Keeping This Tracker Up to Date

1. **At session start** — read this tracker to know where you left off. Do NOT re-explore the codebase to figure out status; trust the tracker (verify quickly if unsure).
2. **After completing a phase** — update the status to `DONE` and add any notes (e.g., "371/371 test cases passing" or "skipped GETSESSIONID, returns empty string").
3. **Before suspending** — add a session log entry with what was done and what the immediate next step is. Update any `IN PROGRESS` phases with specifics (e.g., "lexer done, 3 tests failing on escape sequences").
4. **When blocked** — mark the phase `BLOCKED` and note the blocker in the Notes column.

---

## Agent Strategy

> This project is designed to be executed using parallel agents where possible. Follow these guidelines for the best outcome.

### Principles

- **Use agents for independent phases.** Phases 4, 5, 6, and 7 (function groups) are fully independent of each other once Phase 3 is complete. Launch them in parallel.
- **Use `feature-dev:code-architect` before starting.** At the beginning of a new phase, use an architect agent to review the plan section + existing code and confirm the approach before writing code.
- **Use `feature-dev:code-reviewer` after each phase.** Run a code review agent on the changes to catch bugs, null-handling errors, or deviations from the plan before moving on.
- **Use `Explore` agents for verification.** When something seems off (e.g., test failures), spawn an Explore agent to investigate rather than manually searching.
- **Use isolation worktrees for risky parallel work.** If running multiple function-group implementations in parallel, use `isolation: "worktree"` to avoid merge conflicts.

### Recommended Execution Flow

```
Phase 0: Scaffolding                          (single agent, sequential)
Phase 1: Lexer                                (single agent, sequential)
Phase 2: Parser                               (single agent, sequential)
Phase 3: Evaluator Core                       (single agent, sequential)
  ↓ checkpoint — all tests for Phases 0–3 green
Phase 4: Logical Functions  ─┐
Phase 5: Math Functions      ├─ parallel agents (worktree isolation)
Phase 6: Text Functions      │
Phase 7: Date/Time Functions ─┘
  ↓ merge + resolve any conflicts
Phase 8: Integration Tests & Polish           (single agent, sequential)
Phase 9: SF Verification                      (single agent, sequential)
```

### Per-Phase Agent Checklist

For each phase:

1. Read the relevant plan section and any existing code
2. Implement the code
3. Run tests (`npm test`) and fix failures
4. Run `npm run typecheck` to verify types
5. Update the Task Tracker above (status + session log)

---

## Context

Build a 100% JavaScript/TypeScript Salesforce formula parser and executor library. The library will parse formula strings into an AST, then evaluate them against a sample record context. It must support **every** Salesforce formula function and operator. Zero production dependencies, browser-compatible. The library lives in `formula-parser/` and will later be spun out into its own package. Correctness will be verified against a real Salesforce org via `sf` CLI.

This plan was refined by studying the actual open-source Salesforce formula engine (Java/ANTLR, `github.com/salesforce/formula-engine`). Behavioral details below reflect the real engine, not guesses.

---

## Architecture

```
Formula String → Lexer → Token[] → Parser → AST → Evaluator → FormulaValue
                                                      ↑
                                              RecordContext + Options
```

### Key Design Decisions

- **Hand-rolled Pratt parser** (top-down operator precedence) inside a recursive descent framework. One `parseExpression(minBp)` function handles all binary operators via a binding-power table - cleaner than 10 separate precedence-level functions.
- **Lazy function argument evaluation** - function implementations receive raw AST nodes + an `evaluate` callback, not pre-evaluated values. Required for `IF`, `IFS`, `CASE`, `AND`, `OR`, `BLANKVALUE` which must not evaluate unused branches.
- **Discriminated union AST** (`type ASTNode = NumberLiteral | StringLiteral | ...`) - idiomatic TypeScript, exhaustiveness checking via `switch`.
- **JS `Date` for dates/datetimes** (all UTC internally), custom `SfTime` type for time-only values (milliseconds since midnight, 0–86400000).
- **No bundler needed** - `tsc` emits ESM `.js` + `.d.ts` files, consumers bundle.

### Folder Structure

```
formula-parser/
  src/
    index.ts                    # Public API
    lexer/
      tokens.ts                 # TokenType enum + Token interface
      lexer.ts                  # Lexer implementation
      index.ts
    parser/
      ast.ts                    # AST node types (discriminated union)
      precedence.ts             # Operator binding powers
      parser.ts                 # Pratt parser
      index.ts
    evaluator/
      context.ts                # RecordContext, EvaluationOptions, FormulaValue types
      coercion.ts               # toNumber, toText, toBoolean, toDate, isBlank
      errors.ts                 # LexerError, ParseError, FormulaError
      evaluator.ts              # Tree-walking evaluator
      index.ts
    functions/
      registry.ts               # FunctionRegistry type + createDefaultRegistry
      logical.ts                # IF, IFS, CASE, AND, OR, NOT, ISBLANK, etc.
      math.ts                   # ABS, ROUND, MAX, MIN, etc.
      text.ts                   # LEFT, MID, CONTAINS, REGEX, etc.
      date-time.ts              # DATE, YEAR, ADDMONTHS, etc.
      index.ts
  tests/
    lexer/lexer.test.ts
    parser/parser.test.ts
    evaluator/evaluator.test.ts
    evaluator/coercion.test.ts
    functions/logical.test.ts
    functions/math.test.ts
    functions/text.test.ts
    functions/date-time.test.ts
    integration/formulas.test.ts
  vitest.config.ts
  tsconfig.build.json
```

SF CLI verification tests (separate from vitest):

```
scripts/
  formula-verify/
    verify.ts                   # Deploys formula fields, creates records, compares results
    formulas.json               # Test fixtures
```

### Public API

```typescript
// One-shot evaluation
evaluateFormula(formula: string, context: RecordContext, options?: EvaluationOptions): FormulaValue

// Parse for caching/inspection
parseFormula(formula: string): ASTNode

// Advanced: custom function registry
createEvaluator(registry?: FunctionRegistry): Evaluator
createDefaultRegistry(): FunctionRegistry

// Types: FormulaValue, RecordContext, EvaluationOptions, ASTNode, Token, etc.
```

---

## Complete Function Coverage (90+ functions + operators)

### Operators

| Category   | Operators                                   |
| ---------- | ------------------------------------------- |
| Arithmetic | `+`, `-`, `*`, `/`, `^`                     |
| Comparison | `=`, `==`, `!=`, `<>`, `<`, `>`, `<=`, `>=` |
| Logical    | `&&`, `\|\|`, `!`                           |
| String     | `&` (concatenation)                         |
| Grouping   | `(`, `)`                                    |

### Logical Functions (16)

`IF`, `IFS`, `CASE`, `AND`, `OR`, `NOT`, `ISBLANK`, `ISNULL`, `ISNUMBER`, `BLANKVALUE`, `NULLVALUE`, `IFERROR`, `ISCHANGED`, `ISNEW`, `ISCLONE`, `PRIORVALUE`

### Math Functions (19)

`ABS`, `CEILING`, `FLOOR`, `MCEILING`, `MFLOOR`, `EXP`, `LN`, `LOG`, `MAX`, `MIN`, `MOD`, `PI`, `POWER`, `RAND`, `ROUND`, `SQRT`, `TRUNC`, `DISTANCE`, `GEOLOCATION`

### Text Functions (27)

`BEGINS`, `BR`, `CASESAFEID`, `CONTAINS`, `FIND`, `GETSESSIONID`, `HTMLENCODE`, `HYPERLINK`, `IMAGE`, `INCLUDES`, `ISPICKVAL`, `JSENCODE`, `JSINHTMLENCODE`, `LEFT`, `LEN`, `LOWER`, `LPAD`, `MID`, `RIGHT`, `RPAD`, `SUBSTITUTE`, `TEXT`, `TRIM`, `UPPER`, `URLENCODE`, `VALUE`, `REGEX`

### Date/Time Functions (17)

`ADDMONTHS`, `DATE`, `DATEVALUE`, `DATETIMEVALUE`, `DAY`, `HOUR`, `MILLISECOND`, `MINUTE`, `MONTH`, `NOW`, `SECOND`, `TIMENOW`, `TIMEVALUE`, `TODAY`, `WEEKDAY`, `YEAR`

### Syntax Features

- **Case-insensitive** — `IF`, `if`, `If`, `iF` all work. The entire language is case-insensitive for identifiers, keywords, and function names.
- `/* block comments */` — consumed and discarded
- **String literals** — both double quotes (`"text"`) and single quotes (`'text'`) are valid
- **Escape sequences** in strings: `\n`, `\r`, `\t`, `\"`, `\'`, `\\` (also uppercase `\N`, `\R`, `\T`)
- **`null` literal** — keyword that produces a null value (alongside `true`/`false`)
- Field references: `FieldName`, `Object.Field`, `$User.Id`, `$Organization.Name`
- Nested function calls, mixed expressions

### Identifier / Field Reference Lexing

In the real Salesforce engine, the IDENT token regex is:

```
IDENT = [a-zA-Z$] [a-zA-Z0-9_$:.#]*
```

This means `Account.Name`, `$User.Id`, and `Contact:User.Name` are each **one token** — the dot and colon are part of the identifier, not separate operators.

**Recommended approach for our JS implementation**: Lex identifiers using the same regex pattern. Then in the parser/evaluator, **split on `.`** to get the path parts. This is simpler than trying to distinguish DOT tokens from the DOT inside identifiers. The lexer must take care not to confuse the DOT in identifiers vs the DOT in number literals — numbers always start with a digit (`0-9`), identifiers always start with a letter or `$`, so there is no ambiguity.

### Relational Field Path Resolution

Salesforce formulas frequently traverse lookup relationships: `Contact.Account.Name`, `Owner.Profile.Name`, `Lookup_Field__r.Number_Field__c`. This must be a first-class concern:

**Context shape** — `RecordContext` is a flat `Record<string, FieldValue>` for direct fields, but also supports a `related?: Record<string, RecordContext>` map for lookup-traversed objects:

```typescript
interface RecordContext {
  fields: Record<string, FormulaValue>; // direct fields on this record
  related?: Record<string, RecordContext>; // lookup traversal: "Account" → RecordContext
  globals?: Record<string, RecordContext>; // $User, $Organization, $Profile, etc.
}
```

**Evaluator resolution** — When a `FieldReference` has `parts = ["Account", "Name"]`, the evaluator:

1. Looks up `"Account"` in `related` (case-insensitive) to get the related `RecordContext`
2. Looks up `"Name"` in that context's `fields`
3. For `$`-prefixed globals (`$User`, `$Organization`), looks in `globals` instead

**Null traversal** — If the lookup field is null (no related record), the entire path evaluates to null/blank. This is standard SF behavior.

**Test coverage** — Integration tests must include:

- `Account.Name` on a Contact record (2-hop)
- `Lookup_Field__r.Number_Field__c` (custom lookup)
- Null lookup (related record absent → null result)
- `$User.Id`, `$Organization.Name` global references

---

## Operator Precedence (CRITICAL — verified from actual ANTLR grammar)

The real Salesforce grammar defines this exact precedence (lowest binding power to highest):

| BP  | Level          | Operators          | Associativity | Notes                                              |
| --- | -------------- | ------------------ | ------------- | -------------------------------------------------- |
| 1   | Logical OR     | `\|\|`             | Left          |                                                    |
| 2   | Logical AND    | `&&`               | Left          |                                                    |
| 3   | Equality       | `=` `==` `!=` `<>` | Left          | `==` normalizes to `=`, `!=` normalizes to `<>`    |
| 4   | Relational     | `<` `>` `<=` `>=`  | Left          |                                                    |
| 5   | Additive       | `+` `-` `&`        | Left          | **`&` (concat) is at the SAME level as `+`/`-`**   |
| 6   | Exponent       | `^`                | **Left**      | **BELOW multiply — `2*3^4` = `(2*3)^4` = 1296**    |
| 7   | Multiplicative | `*` `/`            | Left          | **ABOVE exponent — this is unusual but confirmed** |
| 8   | Unary          | `+` `-` `!` `NOT`  | Prefix        | `NOT` is also a unary prefix, not just a function  |

**Key surprises vs standard math:**

- `^` (exponent) has **lower** precedence than `*`/`/`. So `2 * 3 ^ 4` = `(2 * 3) ^ 4` = `6 ^ 4` = 1296, NOT `2 * (3 ^ 4)`.
- `^` is **left-associative**: `2 ^ 3 ^ 2` = `(2 ^ 3) ^ 2` = `8 ^ 2` = 64, NOT `2 ^ (3 ^ 2)` = `2 ^ 9` = 512.
- `&` (string concatenation) shares the same precedence level as `+`/`-`.
- `NOT` works both as a function `NOT(expr)` and as a unary prefix operator `NOT expr` (same as `!`).

**Pratt parser binding power table:**

```typescript
// Left binding power for each binary operator
const BINDING_POWER: Record<string, [number, number]> = {
  // [leftBP, rightBP] — left < right for left-assoc, left > right for right-assoc
  '||': [2, 3],
  '&&': [4, 5],
  '=': [6, 7],
  '==': [6, 7],
  '!=': [6, 7],
  '<>': [6, 7],
  '<': [8, 9],
  '>': [8, 9],
  '<=': [8, 9],
  '>=': [8, 9],
  '+': [10, 11],
  '-': [10, 11],
  '&': [10, 11],
  '^': [12, 13], // left-associative (leftBP < rightBP)
  '*': [14, 15],
  '/': [14, 15],
};
// Unary prefix: binding power 16
```

---

## Null / Blank Semantics (CRITICAL — from actual engine source)

Salesforce uses **Oracle three-valued logic** for nulls. Getting this right is essential.

### Core Rules

| Operation                | Behavior                                          | Example                                        |
| ------------------------ | ------------------------------------------------- | ---------------------------------------------- |
| **String equality**      | Null coerced to `""` before comparing             | `null = ""` → `true`, `null = "abc"` → `false` |
| **Non-string equality**  | Three-valued: null propagates                     | `null = null` → `null`, `null = 0` → `null`    |
| **String concatenation** | Null treated as `""`                              | `null & "abc"` → `"abc"`                       |
| **Arithmetic with null** | Null propagates                                   | `null + 5` → `null`, `null * 3` → `null`       |
| **Comparison with null** | Null propagates                                   | `null > 5` → `null`, `null < null` → `null`    |
| **NOT(null)**            | Returns `null` (preserves nullness)               |                                                |
| **AND with null**        | Null treated as false (returns false immediately) | `AND(true, null)` → `false`                    |
| **OR with null**         | Null treated as false (continues to next arg)     | `OR(false, null)` → `false`                    |
| **IF(null, ...)**        | Null condition treated as false → else branch     | `IF(null, "yes", "no")` → `"no"`               |
| **MAX/MIN with null**    | Null propagates (all-or-nothing)                  | `MAX(1, null, 3)` → `null`                     |
| **LEN(null)**            | Returns 0 (exception to null propagation)         | `LEN(null)` → `0`                              |
| **LEFT/RIGHT("", n)**    | Returns null for empty/null source                | `LEFT("", 37)` → `null`                        |
| **MID("", n, m)**        | Returns null for empty/null source                | `MID("", 4, 2)` → `null`                       |
| **BEGINS(text, null)**   | Empty/null search returns true                    | `BEGINS("abc", null)` → `true`                 |
| **CONTAINS(text, null)** | Empty/null search returns true                    | `CONTAINS("abc", null)` → `true`               |
| **BEGINS(null, "abc")**  | Null source returns null                          | `BEGINS(null, "abc")` → `null`                 |

### Implementation: Null-String Sentinel

The real engine uses a special `NullString` sentinel to distinguish "null value that originated from a string field" from "null value that originated from a number field". This matters for equality comparisons:

- If **either** operand is string-typed (even if null): coerce both nulls to `""`, then compare
- If **neither** is string-typed: use three-valued logic (null = null → null)

For the JS implementation, track field types in the context or add a `NullString` wrapper so that equality can decide which mode to use. Alternatively, since we know field types from the context at evaluation time, we can pass a `treatAsString` flag to the equality operator.

### treatBlanksAsZeroes

The `EvaluationOptions.treatBlanksAsZeroes` flag (default: true in most SF formula contexts) affects how null field values coerce in arithmetic:

- `true`: null numbers → 0, null text → "" before arithmetic/comparison
- `false`: null propagates through arithmetic (three-valued logic)

---

## Implementation Phases

### Phase 0: Project Scaffolding + Test Fixtures

**Goal**: Working build + test pipeline with test fixtures wired up from day one.

- Update `formula-parser/package.json`: add `vitest`, set `"type": "module"`, configure `main`/`types`/`exports` pointing to `dist/`, add scripts (`build`, `test`, `test:watch`, `test:coverage`, `typecheck`)
- Update `formula-parser/tsconfig.json`: uncomment `rootDir: "./src"` and `outDir: "./dist"`
- Create `formula-parser/tsconfig.build.json` extending base, excluding tests
- Create `formula-parser/vitest.config.ts`
- Create directory skeleton with empty `index.ts` files
- Create `formula-parser/src/evaluator/errors.ts` with error classes
- Verify `npm run build` and `npm test` run cleanly
- One smoke test that imports from the library

#### Pre-built Test Suite: `formula-parser/src/__tests__/test-cases.ts`

A comprehensive test file **already exists** at: `formula-parser/src/__tests__/test-cases.ts`. It contains **371 test cases** extracted from the official Salesforce formula engine's Java test suite (the open-source `salesforce/formula-engine` repo). Each test case has `{ formula, expected, description? }`.

**License attribution required**: The test data is derived from the Salesforce formula engine which is under the **BSD 3-Clause License**. The `formula-parser/src/__tests__/test-cases.ts` file already includes the full copyright notice and license text at the top. No other license file is needed for test data alone, but if you also copy implementation logic or algorithms from that repo, include the full LICENSE file in your project root.

Copy this file into `formula-parser/tests/fixtures/formula-cases.ts` and wire it into the vitest integration suite as table-driven tests:

```typescript
import { describe, it, expect } from 'vitest';
import { ALL_TEST_SUITES } from '../fixtures/formula-cases';
import { evaluateFormula } from '../../src';

for (const [suiteName, cases] of Object.entries(ALL_TEST_SUITES)) {
  describe(suiteName, () => {
    for (const tc of cases) {
      it(tc.description || tc.formula, () => {
        if (tc.expected === 'ERROR') {
          expect(() => evaluateFormula(tc.formula, {})).toThrow();
        } else {
          expect(evaluateFormula(tc.formula, {})).toEqual(tc.expected);
        }
      });
    }
  });
}
```

The test suites cover:

| Category    | Count | What's covered                                                                                     |
| ----------- | ----- | -------------------------------------------------------------------------------------------------- |
| Operators   | 84    | Arithmetic, comparison, equality (incl. null string coercion), precedence edge cases               |
| Logical     | 55    | IF, IFS, CASE (lazy eval), AND/OR (short-circuit + null), NOT (null preservation)                  |
| Math        | 73    | ROUND (near-zero), CEILING/FLOOR vs MCEILING/MFLOOR (negative numbers), MOD (sign), MAX/MIN (null) |
| Text        | 96    | BEGINS/CONTAINS (null edge cases), MID (1-based clamping), LPAD/RPAD (multi-char), FIND, TRIM      |
| Date/Time   | 56    | ADDMONTHS (end-of-month), date arithmetic (truncation), time wrapping, WEEKDAY, ISOWEEK/ISOYEAR    |
| Integration | 7     | Short-circuit safety (1/0 in dead branches), complex nested formulas                               |

Tests that need field context (e.g., `Account.Name`, `$User.Id`) are NOT in this file — add those manually in `tests/fixtures/` using real `RecordContext` objects once the evaluator is built. Also add additional edge cases discovered during SF org verification (Phase 9).

#### Supplementing with additional fixtures

Beyond the pre-built 371 cases, author additional fixtures in `tests/fixtures/` for:

| Category         | What to cover                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Field types      | Text, Number, Currency, Percent, Date, DateTime, Time, Checkbox, Picklist with actual RecordContext objects |
| Null/blank       | Every field type with a null value; BLANKVALUE vs NULLVALUE behavioral differences                          |
| Relational paths | `Account.Name` 2-hop, custom lookup, null lookup → null result                                              |
| Global refs      | `$User.Id`, `$User.Name`, `$Organization.Name`                                                              |

Use the existing custom field names (e.g. `Number_Field__c`, `Date_Field__c`, `Checkbox_Field__c`) as field names in fixture records so the same fixtures can later be reused by the SF CLI verification script.

### Phase 1: Lexer

**Goal**: Complete tokenizer for all Salesforce formula syntax.

**Files**: `src/lexer/tokens.ts`, `src/lexer/lexer.ts`, `src/lexer/index.ts`

Token types: `NumberLiteral`, `StringLiteral`, `BooleanLiteral`, `NullLiteral`, `Identifier`, all operators (`Plus`, `Minus`, `Star`, `Div`, `Exponent`, `Concat`, `Equal`, `Equal2`, `NotEqual`, `NotEqual2`, `Lt`, `Gt`, `Le`, `Ge`, `InfixAnd`, `InfixOr`, `Bang`, `Not`), `LeftParen`, `RightParen`, `Comma`, `EOF`

**Identifier token** — matches `[a-zA-Z$][a-zA-Z0-9_$:.#]*`. This means `Account.Name`, `$User.Id`, `Contact:User.Name` are each a single `Identifier` token (dots are part of the identifier, not separate operators). The evaluator later splits on `.` for field path resolution.

Key behaviors:

- **Case-insensitive keywords**: After matching an identifier, check (case-insensitive) if it's `true`/`false` → `BooleanLiteral`, `null` → `NullLiteral`, `not` → `Not` operator. Everything else is `Identifier`.
- `&&` vs `&`: two-character lookahead. `&&` → `InfixAnd`, single `&` → `Concat`.
- `||`: two-character sequence → `InfixOr`.
- `==` vs `=`: lookahead. `==` → `Equal2`, single `=` → `Equal`.
- `!=` vs `!`: lookahead. `!=` → `NotEqual2`, single `!` → `Bang`.
- `<>` vs `<=` vs `<`: lookahead to distinguish.
- `>=` vs `>`: lookahead.
- **String literals**: Both `"..."` and `'...'` are valid. Same escape rules for both: `\n`, `\r`, `\t`, `\"`, `\'`, `\\`, and uppercase variants `\N`, `\R`, `\T`.
- **Number literals**: `[0-9]+ ('.' [0-9]+)?`. No ambiguity with identifier DOT since numbers start with digits and identifiers start with letters/`$`.
- **Block comments** `/* ... */`: consumed and discarded (handle nested `\*\/` within — the real engine uses non-greedy matching).
- Track line/column for error reporting.

**Tests**: `tests/lexer/lexer.test.ts`

- Every operator token type individually
- Number literals (integer, decimal)
- String literals with **both** quote styles and all escape sequences
- Boolean literals (case-insensitive: `TRUE`, `true`, `True`)
- `null` literal (case-insensitive)
- Identifiers including dotted paths: `Account.Name`, `$User.Id`
- Multi-token formulas: `IF(Amount > 1000, "big", "small")`
- Comments stripped correctly
- Error cases: unterminated string, unterminated comment

### Phase 2: Parser

**Goal**: Produce an AST from tokens.

**Files**: `src/parser/ast.ts`, `src/parser/precedence.ts`, `src/parser/parser.ts`, `src/parser/index.ts`

AST node types: `NumberLiteral`, `StringLiteral`, `BooleanLiteral`, `NullLiteral`, `FieldReference` (with `parts: string[]`), `FunctionCall` (with `name` + `args`), `UnaryExpression`, `BinaryExpression`

**Operator precedence** — see the binding power table in the dedicated section above. Key points:

- `&` shares level with `+`/`-`
- `^` is **below** `*`/`/` and is **left-associative**
- All binary operators are left-associative

Key behaviors:

- Identifier token followed by `(` → `FunctionCall`, parse comma-separated args until `)`. The identifier value is the function name. Since identifiers can contain dots, `Account.Name(` would parse as a function call — but this doesn't occur in practice since SF function names are never dotted.
- Identifier token NOT followed by `(` → `FieldReference`. Split the identifier text on `.` to get `parts`. E.g., identifier `Account.Name` → `FieldReference { parts: ["Account", "Name"] }`.
- `$`-prefixed identifiers → `FieldReference` with the `$` preserved in parts. E.g., `$User.Id` → `FieldReference { parts: ["$User", "Id"] }`. Split on `.`, keep `$` prefix on first part.
- `NOT` token (case-insensitive) followed by `(` → `FunctionCall` named `"NOT"`. `NOT` without `(` → unary prefix operator (same as `!`).
- `AND`/`OR` followed by `(` → `FunctionCall` (variadic). `AND`/`OR` as infix → binary operators `&&`/`||`.
- No arity checking in parser — evaluator handles that.

**Tests**: `tests/parser/parser.test.ts`

- Precedence: `1 + 2 * 3` → `(+ 1 (* 2 3))`
- Precedence: `2 * 3 ^ 4` → `(^ (* 2 3) 4)` (confirmed from real grammar)
- Left-assoc exponent: `2 ^ 3 ^ 2` → `(^ (^ 2 3) 2)`
- Concat same level as add: `1 + 2 & "x"` → `(& (+ 1 2) "x")`
- Function calls, field references, null literal, nested parens

### Phase 3: Evaluator Core

**Goal**: Evaluate literals, field references, and all operators against a record.

**Files**: `src/evaluator/context.ts`, `src/evaluator/coercion.ts`, `src/evaluator/errors.ts`, `src/evaluator/evaluator.ts`, `src/evaluator/index.ts`, `src/functions/registry.ts`, `src/functions/index.ts`, `src/index.ts` (public API wiring)

#### Type System

```typescript
type FormulaValue = number | string | boolean | Date | SfTime | null;

interface SfTime {
  timeInMillis: number; // 0–86400000 (milliseconds since midnight, GMT)
}
```

Dates represent date-only values (midnight UTC). DateTimes are also `Date` objects but with nonzero time components. Use a `{ isDateTime: boolean }` tag in the context or a wrapper type to distinguish them for `TEXT()` formatting.

#### Operator Semantics

| Operator             | Behavior                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+` (numeric)        | Number addition. Null propagates.                                                                                                                                         |
| `+` (string)         | String concatenation (same as `&`). In SF, `+` between strings also concatenates.                                                                                         |
| `-` (numeric)        | Number subtraction. Null propagates.                                                                                                                                      |
| `*`, `/`             | Multiply/divide. Null propagates. Division by zero throws `FormulaError`.                                                                                                 |
| `^`                  | Exponentiation. Uses `Math.pow`. **Overflow protection**: if `log10(abs(base)) * exponent > 64`, throw error. Very small results `< 1e-39` → 0. Exponent must be integer. |
| `&`                  | String concatenation. Null treated as `""`. `null & "abc"` → `"abc"`.                                                                                                     |
| `=`/`==`             | Equality. See null semantics section.                                                                                                                                     |
| `!=`/`<>`            | Negated equality.                                                                                                                                                         |
| `<`, `>`, `<=`, `>=` | Comparison. Null propagates (returns null → treated as false in boolean context).                                                                                         |
| `&&`                 | Logical AND (binary). Same semantics as `AND(a, b)`.                                                                                                                      |
| `\|\|`               | Logical OR (binary). Same semantics as `OR(a, b)`.                                                                                                                        |
| `!` / `NOT`          | Logical NOT. `NOT(null)` → `null`.                                                                                                                                        |
| Unary `-`            | Numeric negation. `-(null)` → `null`.                                                                                                                                     |

#### Date Arithmetic

| Expression            | Result Type | Behavior                                                                                                         |
| --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| `Date + Number`       | Date        | Add N days. Fractional part **truncated** (only whole days added). `Date(2020-01-01) + 5.7` → `Date(2020-01-06)` |
| `DateTime + Number`   | DateTime    | Add N days. Fractional part **rounded to nearest second** (RoundingMode.HALF_UP).                                |
| `Date - Date`         | Number      | Days between. `(date1.getTime() - date2.getTime()) / 86400000`                                                   |
| `DateTime - DateTime` | Number      | Days between (same formula, fractional days preserved).                                                          |
| `Time + Number`       | Time        | Add N milliseconds. Wraps around 24h: `(time + ms) % 86400000`.                                                  |
| `Time - Time`         | Number      | Millisecond difference. Formula: `((t1 - t2 + 86400000) % 86400000)` to handle negative modulo.                  |
| `Number + Date`       | Date        | Commutative — same as `Date + Number`.                                                                           |

**Tests**: `tests/evaluator/evaluator.test.ts`, `tests/evaluator/coercion.test.ts`

### Phase 4: Logical Functions (16 functions)

**Files**: `src/functions/logical.ts`

| Function                                | Key Behavior                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `IF(cond, a, b)`                        | **Lazy** — only evaluate matching branch. Null condition treated as false.                                                                                                                                                           |
| `IFS(c1, r1, c2, r2, ..., else)`        | **Lazy** — evaluates conditions in order, stops at first true, returns corresponding result. If all false, returns last (else) value. Must have odd number of args, minimum 3.                                                       |
| `CASE(expr, v1, r1, v2, r2, ..., else)` | Evaluates expr once, compares with each value. Returns matching result or else. Uses same equality as `=` operator.                                                                                                                  |
| `AND(a, b, ...)`                        | Variadic, **short-circuit**. Returns `false` immediately if any arg is `null` or `false`. Only returns `true` if ALL args are true. **Null is treated as false, not as null.**                                                       |
| `OR(a, b, ...)`                         | Variadic, **short-circuit**. Returns `true` immediately on first true. Returns `false` if all args are false/null. **Null args are skipped**, not treated as true.                                                                   |
| `NOT(expr)`                             | Boolean negation. **`NOT(null)` → `null`** (preserves nullness, unlike AND/OR).                                                                                                                                                      |
| `ISBLANK(expr)`                         | Returns `true` if value is `null` or `""`. **Note**: In the real engine, ISBLANK on a string-typed field that has never been set returns `false` (optimized away at compile time). For our purposes, check for null or empty string. |
| `ISNULL(expr)`                          | Legacy alias. In the real engine, ISNULL has different string-type optimization than ISBLANK, but for runtime behavior they're nearly identical.                                                                                     |
| `ISNUMBER(expr)`                        | Returns `true` if text value is parseable as a number.                                                                                                                                                                               |
| `BLANKVALUE(expr, default)`             | Returns `expr` if non-null and non-`""`, otherwise `default`. **Lazy** — only evaluate default if needed.                                                                                                                            |
| `NULLVALUE(expr, default)`              | Returns `expr` if non-null (does NOT check for `""`), otherwise `default`. Subtle difference from BLANKVALUE.                                                                                                                        |
| `IFERROR(expr, fallback)`               | Evaluates `expr`; if it throws a FormulaError, returns `fallback`. Otherwise returns `expr` result.                                                                                                                                  |
| `ISCHANGED(field)`                      | Compare `context.fields[field]` vs `context.priorRecord.fields[field]`. Returns boolean. Reads field name from AST node directly.                                                                                                    |
| `ISNEW()`                               | Returns `context.isNew`.                                                                                                                                                                                                             |
| `ISCLONE()`                             | Returns `context.isClone`.                                                                                                                                                                                                           |
| `PRIORVALUE(field)`                     | Returns `context.priorRecord.fields[field]`. Reads field name from AST node directly.                                                                                                                                                |

**Tests**: `tests/functions/logical.test.ts`

### Phase 5: Math Functions (19 functions)

**Files**: `src/functions/math.ts`

| Function                     | Implementation Note                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ABS(n)`                     | `Math.abs(n)`. Null → null.                                                                                                                                                                                                                                                                             |
| `CEILING(n)`                 | **NOT just `Math.ceil`**. For negatives: rounds toward zero. `CEILING(-2.5)` → `-2`, `CEILING(2.3)` → `3`. Implementation: `n >= 0 ? Math.ceil(n) : Math.floor(n)`. (The real engine also pre-rounds to 18 digits with HALF_DOWN to avoid floating point edge cases like `CEILING(6/11*11)` = 6 not 7.) |
| `FLOOR(n)`                   | **NOT just `Math.floor`**. For negatives: rounds toward zero. `FLOOR(-2.5)` → `-2`, `FLOOR(2.3)` → `2`. Implementation: `n >= 0 ? Math.floor(n) : Math.ceil(n)`.                                                                                                                                        |
| `MCEILING(n)`                | **Mathematical** ceiling. Always rounds up (toward +∞). `MCEILING(-2.5)` → `-2`, `MCEILING(2.3)` → `3`. This IS just `Math.ceil(n)`.                                                                                                                                                                    |
| `MFLOOR(n)`                  | **Mathematical** floor. Always rounds down (toward -∞). `MFLOOR(-2.5)` → `-3`, `MFLOOR(2.3)` → `2`. This IS just `Math.floor(n)`.                                                                                                                                                                       |
| `ROUND(n, scale)`            | Uses **HALF_UP** rounding (round half away from zero). **Special behavior for values < 1**: add 1, round, subtract 1 to avoid precision issues (e.g., `ROUND(0.003, 2)` → `0.00` not `0.0`). Negative scales work: `ROUND(123.456, -2)` → `100`. See implementation algorithm below.                    |
| `TRUNC(n, scale)`            | Same as ROUND but uses **RoundingMode.DOWN** (truncate toward zero). `TRUNC(2.7, 0)` → `2`, `TRUNC(-2.7, 0)` → `-2`.                                                                                                                                                                                    |
| `MOD(n, d)`                  | Uses **JS `%` operator** (remainder semantics). Sign follows the dividend: `MOD(-7, 3)` → `-1`, `MOD(7, -3)` → `1`. Null propagates.                                                                                                                                                                    |
| `MAX(a, b)`                  | Returns larger value. **If ANY argument is null, returns null** (all-or-nothing null propagation).                                                                                                                                                                                                      |
| `MIN(a, b)`                  | Returns smaller value. Same null behavior as MAX.                                                                                                                                                                                                                                                       |
| `EXP(n)`                     | `Math.exp(n)`.                                                                                                                                                                                                                                                                                          |
| `LN(n)`                      | `Math.log(n)` (natural log).                                                                                                                                                                                                                                                                            |
| `LOG(n)`                     | `Math.log10(n)` (base-10 log).                                                                                                                                                                                                                                                                          |
| `SQRT(n)`                    | `Math.sqrt(n)`.                                                                                                                                                                                                                                                                                         |
| `PI()`                       | `Math.PI`.                                                                                                                                                                                                                                                                                              |
| `POWER(base, exp)`           | `Math.pow(base, exp)`. **Overflow protection**: if `Math.log10(Math.abs(base)) * exp > 64`, throw FormulaError. Results smaller than `1e-39` → `0`.                                                                                                                                                     |
| `RAND()`                     | `Math.random()`.                                                                                                                                                                                                                                                                                        |
| `DISTANCE(loc1, loc2, unit)` | Haversine formula. `unit` is `"mi"` or `"km"`. See implementation below.                                                                                                                                                                                                                                |
| `GEOLOCATION(lat, lng)`      | Creates a geolocation value `{ latitude, longitude }` for use with DISTANCE.                                                                                                                                                                                                                            |

#### ROUND Algorithm (matching SF engine)

```typescript
function sfRound(value: number, scale: number): number {
  if (value === 0) return 0;
  const abs = Math.abs(value);
  if (abs < 1) {
    // Special handling: add 1, round, subtract 1
    // This avoids precision issues where e.g. 0.003 rounded to 2 places
    // would give 0.0 instead of 0.00 due to BigDecimal precision semantics
    const shifted = abs + 1;
    const rounded = roundHalfUp(shifted, scale);
    return value < 0 ? -(rounded - 1) : rounded - 1;
  } else {
    return roundHalfUp(value, scale);
  }
}

function roundHalfUp(value: number, scale: number): number {
  // "Round half away from zero" implementation
  const factor = Math.pow(10, scale);
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
}
```

For negative scales: `ROUND(12345, -2)` → multiply by `10^(-2)` = 0.01, round, divide back → `12300`.

#### DISTANCE (Haversine) Algorithm

```typescript
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number, unit: string): number {
  const R = unit === 'mi' ? 3958.8 : 6371.0; // Earth radius
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
```

**Tests**: `tests/functions/math.test.ts`

Test CEILING/FLOOR/MCEILING/MFLOOR with negative numbers:

```
CEILING(2.3) = 3,  CEILING(-2.5) = -2   (toward zero for negatives)
FLOOR(2.3)  = 2,   FLOOR(-2.5)  = -2    (toward zero for negatives)
MCEILING(2.3) = 3, MCEILING(-2.5) = -2  (Math.ceil, toward +∞)
MFLOOR(2.3)  = 2,  MFLOOR(-2.5)  = -3   (Math.floor, toward -∞)
```

### Phase 6: Text Functions (27 functions)

**Files**: `src/functions/text.ts`

| Function                            | Detailed Behavior                                                                                                                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BEGINS(text, search)`              | If search is null or `""`: returns `true`. If text is null or `""`: returns `null`. Otherwise: `text.startsWith(search)`.                                                                                                                                                                                    |
| `BR()`                              | Returns `"<br>"`.                                                                                                                                                                                                                                                                                            |
| `CASESAFEID(id)`                    | Converts 15-char Salesforce ID to 18-char case-safe version. Algorithm: split into 3 groups of 5 chars, for each group build a 5-bit number (1 if char is uppercase, 0 otherwise), index into `ABCDEFGHIJKLMNOPQRSTUVWXYZ012345` to get check char. Append 3 check chars. If already 18 chars, return as-is. |
| `CONTAINS(text, search)`            | If search is null or `""`: returns `true`. If text is null or `""`: returns `null`. Otherwise: `text.includes(search)`.                                                                                                                                                                                      |
| `FIND(search, text, [start])`       | **1-based**. Returns position of first occurrence of search in text, starting at optional `start` position (1-based, default 1). Returns `0` if not found (never null). Implementation: `text.indexOf(search, start - 1) + 1`. If search or text is null: returns `0`.                                       |
| `GETSESSIONID()`                    | Returns `""` (not available outside SF runtime).                                                                                                                                                                                                                                                             |
| `HTMLENCODE(text)`                  | Escape `&`, `<`, `>`, `"`, `'` for HTML.                                                                                                                                                                                                                                                                     |
| `HYPERLINK(url, label, [target])`   | Returns `<a href="url" target="target">label</a>`. Default target `"_blank"`.                                                                                                                                                                                                                                |
| `IMAGE(url, alt, [height, width])`  | Returns `<img src="url" alt="alt" ...>`.                                                                                                                                                                                                                                                                     |
| `INCLUDES(multiSelectField, value)` | Checks if a semicolon-separated multi-select picklist string contains the given value. Split on `";"`, trim each, check for membership.                                                                                                                                                                      |
| `ISPICKVAL(picklistField, value)`   | Simple string equality between picklist value and the given string. Null picklist == `""` (so `ISPICKVAL(null, "")` → `true`).                                                                                                                                                                               |
| `JSENCODE(text)`                    | Escape `\`, `"`, `'`, newlines, etc. for JavaScript strings.                                                                                                                                                                                                                                                 |
| `JSINHTMLENCODE(text)`              | `HTMLENCODE(JSENCODE(text))` — encode for JS inside HTML.                                                                                                                                                                                                                                                    |
| `LEFT(text, n)`                     | Returns leftmost n characters. If `n <= 0`: returns `null`. If text is null/empty: returns `null`. If `n > text.length`: returns entire text.                                                                                                                                                                |
| `LEN(text)`                         | Returns length. **`LEN(null)` → `0`** (not null — exception to null propagation). `LEN("")` → `0`.                                                                                                                                                                                                           |
| `LOWER(text)`                       | `text.toLowerCase()`. Null → null.                                                                                                                                                                                                                                                                           |
| `LPAD(text, length, [padStr])`      | Left-pad to `length` chars. Default padStr `" "`. If length ≤ 0: returns `null`.                                                                                                                                                                                                                             |
| `MID(text, start, length)`          | **1-based**. `MID("abcdef", 2, 3)` → `"bcd"`. Start < 1 clamped to 1. Length ≤ 0 → `null`. If text null/empty → `null`. If start+length exceeds text, returns to end of string.                                                                                                                              |
| `RIGHT(text, n)`                    | Returns rightmost n characters. Same null/edge-case behavior as LEFT.                                                                                                                                                                                                                                        |
| `RPAD(text, length, [padStr])`      | Right-pad to `length` chars. Same as LPAD but right side.                                                                                                                                                                                                                                                    |
| `SUBSTITUTE(text, old, new)`        | Replace all occurrences of `old` with `new`. If text is null or empty → `null`. If old is null → `null`. If new is null → treated as `""`.                                                                                                                                                                   |
| `TEXT(value)`                       | Format value as string. **Number**: plain decimal string (no scientific notation). **Date**: `"YYYY-MM-DD"`. **DateTime**: `"YYYY-MM-DD HH:mm:ssZ"`. **Time**: `"HH:mm:ss.SSS"`. **Boolean**: `"true"`/`"false"`. **Null**: returns `null`.                                                                  |
| `TRIM(text)`                        | Removes leading/trailing whitespace. Null → null.                                                                                                                                                                                                                                                            |
| `UPPER(text)`                       | `text.toUpperCase()`. Null → null.                                                                                                                                                                                                                                                                           |
| `URLENCODE(text)`                   | `encodeURIComponent(text)`.                                                                                                                                                                                                                                                                                  |
| `VALUE(text)`                       | Parse text as number. Returns `null` if text is null. Throws `FormulaError` if text is not a valid number (or returns null depending on context).                                                                                                                                                            |
| `REGEX(text, pattern)`              | **Full-string match** (not substring). Internally: `new RegExp("^(?:" + pattern + ")$").test(text)`. Null text treated as `""`. Null pattern treated as `""` (matches only empty string). Returns boolean.                                                                                                   |

#### CASESAFEID Algorithm

```typescript
function caseSafeId(id: string): string {
  if (!id || id.length === 18) return id;
  if (id.length !== 15) return id; // Invalid, return as-is
  const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
  let suffix = '';
  for (let block = 0; block < 3; block++) {
    let bits = 0;
    for (let i = 0; i < 5; i++) {
      const ch = id.charAt(block * 5 + i);
      if (ch >= 'A' && ch <= 'Z') bits |= 1 << i;
    }
    suffix += lookup[bits];
  }
  return id + suffix;
}
```

**Tests**: `tests/functions/text.test.ts`

### Phase 7: Date/Time Functions (17 functions)

**Files**: `src/functions/date-time.ts`

| Function                 | Detailed Behavior                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ADDMONTHS(date, n)`     | Add n months. **End-of-month semantics**: if input is last day of its month, result is last day of target month. Algorithm: if `day == lastDayOfMonth`, advance +1 day, add months, go back -1 day. Examples: `ADDMONTHS(2023-01-31, 1)` → `2023-02-28`, `ADDMONTHS(2016-01-31, 1)` → `2016-02-29`. Null date or null months → null. Only integer months supported (fractional truncated). |
| `DATE(year, month, day)` | Construct date. **Strict validation**: year 1–9999, month 1–12, day 1–31 (validated per month including leap years). Throws FormulaError if invalid. Null any arg → null. Leap year: `(y%400==0) \|\| (y%100!=0 && y%4==0)`. February max: 28 or 29.                                                                                                                                       |
| `DATEVALUE(text)`        | Parse `"YYYY-MM-DD"` string to Date. **Strict** — rejects invalid dates. Also accepts DateTime values (extracts date portion). Null → null.                                                                                                                                                                                                                                                |
| `DATETIMEVALUE(text)`    | Parse `"YYYY-MM-DD HH:mm:ss"` string (assumed GMT) to DateTime. **Strict** — rejects invalid format. 4-digit year required. Null → null.                                                                                                                                                                                                                                                   |
| `DAY(date)`              | Extract day-of-month (1–31). Uses UTC. Null → null.                                                                                                                                                                                                                                                                                                                                        |
| `HOUR(time)`             | Extract hour (0–23) from Time value. Uses UTC. For our `SfTime`: `Math.floor(timeInMillis / 3600000)`. Null → null.                                                                                                                                                                                                                                                                        |
| `MILLISECOND(time)`      | Extract milliseconds (0–999) from Time value. `timeInMillis % 1000`.                                                                                                                                                                                                                                                                                                                       |
| `MINUTE(time)`           | Extract minute (0–59) from Time value. `Math.floor((timeInMillis % 3600000) / 60000)`.                                                                                                                                                                                                                                                                                                     |
| `MONTH(date)`            | Extract month (1–12). Uses UTC. **Remember**: JS `Date.getUTCMonth()` is 0-based, so add 1. Null → null.                                                                                                                                                                                                                                                                                   |
| `NOW()`                  | Returns current DateTime. **Cache within single evaluation** — same value throughout one formula execution. Respect `EvaluationOptions.now` override for deterministic tests.                                                                                                                                                                                                              |
| `SECOND(time)`           | Extract second (0–59) from Time value. `Math.floor((timeInMillis % 60000) / 1000)`.                                                                                                                                                                                                                                                                                                        |
| `TIMENOW()`              | Returns current Time-of-day as SfTime. Cache within single evaluation.                                                                                                                                                                                                                                                                                                                     |
| `TIMEVALUE(text)`        | Parse `"HH:mm:ss.SSS"` string to SfTime. **Strict** — rejects invalid times (hour 0-23, minute 0-59, second 0-59). Returns SfTime with milliseconds since midnight.                                                                                                                                                                                                                        |
| `TODAY()`                | Returns today's date at UTC midnight. Cache within single evaluation. Respect `EvaluationOptions.now` override.                                                                                                                                                                                                                                                                            |
| `WEEKDAY(date)`          | Returns day of week: **1=Sunday, 2=Monday, ..., 7=Saturday**. Implementation: `date.getUTCDay() + 1` (JS getUTCDay: 0=Sunday). Null → null.                                                                                                                                                                                                                                                |
| `YEAR(date)`             | Extract year. `date.getUTCFullYear()`. Null → null.                                                                                                                                                                                                                                                                                                                                        |

#### ADDMONTHS End-of-Month Algorithm

```typescript
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const originalDay = d.getUTCDate();
  const lastDayOfOriginalMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const isLastDay = originalDay === lastDayOfOriginalMonth;

  if (isLastDay) {
    d.setUTCDate(d.getUTCDate() + 1); // advance past month boundary
  }
  d.setUTCMonth(d.getUTCMonth() + months);
  if (isLastDay) {
    d.setUTCDate(d.getUTCDate() - 1); // go back to last day of new month
  }
  return d;
}
```

**Tests**: `tests/functions/date-time.test.ts`

Key test cases:

- `ADDMONTHS(2023-01-31, 1)` → `2023-02-28`
- `ADDMONTHS(2016-01-31, 1)` → `2016-02-29` (leap year)
- `ADDMONTHS(2023-03-31, -1)` → `2023-02-28`
- `DATE(2000, 2, 29)` → valid (leap year)
- `DATE(2001, 2, 29)` → error (not leap year)
- `WEEKDAY(DATE(2024, 1, 7))` → `1` (Sunday)
- `WEEKDAY(DATE(2024, 1, 13))` → `7` (Saturday)
- Date arithmetic truncation: `DATE(2020, 1, 1) + 5.7` → `DATE(2020, 1, 6)` (not 2020-01-07)

### Phase 8: Integration Tests & Polish

**Goal**: End-to-end formula tests, error handling, API polish.

**Files**: `tests/integration/formulas.test.ts`

Table-driven tests covering realistic multi-category formulas:

- `IF(ISBLANK(Amount), 0, Amount * 1.1)`
- `YEAR(TODAY()) - YEAR(CreatedDate)`
- `CASE(MONTH(CloseDate), 1, "Q1", 2, "Q1", ...)`
- `LEFT(Name, FIND(" ", Name) - 1)`
- `ROUND(Amount * TaxRate / 100, 2)`
- Complex nested: `IF(AND(Amount > 0, NOT(ISBLANK(Account.Name))), UPPER(LEFT(Account.Name, 3)) & "-" & TEXT(ROUND(Amount, 0)), "N/A")`
- `IFS(Score >= 90, "A", Score >= 80, "B", Score >= 70, "C", "F")`
- `IFERROR(VALUE(TextInput), 0)`

**Precedence edge case tests** (must match SF exactly):

- `2 * 3 ^ 4` = `1296` (not 162)
- `2 ^ 3 ^ 2` = `64` (not 512)
- `1 + 2 * 3 + 4 / 2` = `9`
- `(1 + 2) * (3 + 4) / 2` = `10.5`

**Null semantics tests**:

- `null = ""` → `true` (string equality)
- `null <> ""` → `false`
- `null = null` → `null` (non-string) or `true` (string context)
- `AND(1 < 2, 1/0 = 0)` → short-circuits to false without evaluating 1/0
- `OR(1 = 1, 1/0 = 0)` → short-circuits to true without evaluating 1/0
- `IF(false, 1/0, 37)` → `37` (lazy evaluation, no division by zero)

Error handling: syntax errors with positions, unknown functions, division by zero, wrong arity, invalid DATE arguments.

### Phase 9: Salesforce Verification

**Goal**: Validate against a real Salesforce org to catch anything the offline test suite misses.

**Files**: `scripts/formula-verify/verify.ts`, `scripts/formula-verify/apex-verify.ts`, `scripts/formula-verify/formulas.json`

#### Why we need BOTH the test file and live SF verification

The 371 test cases in `formula-parser/src/__tests__/test-cases.ts` are extracted from Salesforce's open-source formula engine (Java). They are the **primary development feedback loop** — fast, deterministic, and cover the vast majority of behavior. Use them during Phases 1–8. They run in milliseconds via vitest.

However, the live Salesforce org is still needed as a **final validation pass** because:

1. **The open-source engine may diverge from production SF** — it's a separate codebase that approximates SF behavior but isn't the actual platform code.
2. **Precedence ambiguity** — the ANTLR grammar says `2*3^4` = 1296, but if the live org returns 162, we must match the org. This is the single most important thing to verify early.
3. **JS `number` vs Java `BigDecimal`** — floating-point edge cases (e.g., `CEILING(6/11*11)`, `ROUND(0.003, 2)`) may differ due to precision differences. The test file has the Java-correct answers; the org confirms what users actually see.
4. **Live-data functions** — `$User.Id`, `$Organization.Name`, `INCLUDES()` on real multi-select picklists, `GETSESSIONID()` — these require real SF context that no offline test can simulate.
5. **Undocumented behaviors** — edge cases not covered by the open-source tests may exist in production SF.

**Recommended workflow:**

- **Phases 1–8**: Run `formula-parser/src/__tests__/test-cases.ts` via vitest as the primary test suite. Fast iteration, instant feedback.
- **Phase 9**: Run a targeted set of formulas against a real SF org to validate. Focus on: precedence, float edge cases, live-data functions, and any cases where the test file result seemed surprising.
- **Ongoing**: When SF org verification reveals a discrepancy with the test file, update the test file to match the org (the org wins).

#### Approach A — Apex `FormulaEval` API (fast, no deploy required)

Salesforce exposes `Formula.builder()` in Apex (available in API 56.0+), which can evaluate an arbitrary formula string against a record in-process:

```apex
Account rec = new Account(Name='Acme', AnnualRevenue=50000);
FormulaEval.FormulaInstance ff = Formula.builder()
    .withType(Schema.Account.class)
    .withReturnType(FormulaEval.FormulaReturnType.STRING)
    .withFormula('Name & " - " & TEXT(AnnualRevenue)')
    .build();
System.debug(ff.evaluate(rec));
```

Run via `sf apex run --file scripts/formula-verify/apex-verify.apex --json` and parse `result.logs` for the debug output.

**Pros**: No metadata deploy/undeploy cycle; can test dozens of formulas in one Apex execution; fast iteration during development.

**Limitations to be aware of**:

- Return type must be declared upfront — test each formula with the correct `FormulaReturnType` (STRING, DECIMAL, BOOLEAN, DATE, DATETIME)
- `$User`, `$Organization`, `$Profile` global references may not resolve against a synthetic sObject — use real queried records for those
- Some functions may behave differently or be unsupported (e.g. `GETSESSIONID`, `IMAGE`, `HYPERLINK`) — note gaps and skip those cases
- Multi-select picklist `INCLUDES()` requires a real record with live field data

#### Approach B — Formula Field Deploy + Query (authoritative, slower)

Process per formula:

1. Write formula field metadata XML for `Account` or `Contact` (use existing custom object structure in `force-app/`)
2. Deploy via `sf project deploy start --json`
3. Re-use an existing test record or create one via `sf data create record`
4. Query result via `sf data query --query="SELECT Formula_Field__c FROM Account WHERE Id='...'"`
5. Run same formula through `evaluateFormula()` with the same field values from the query
6. Compare outputs, report mismatches

Use this approach for cases where Approach A falls short (globals, picklist functions, complex field traversal).

#### Strategy

Run Approach A (Apex) first as a fast feedback loop during each phase. Run Approach B (deploy) for the final validation pass and for any cases where Apex evaluation is unavailable or shows a gap. Both approaches should share the same `formulas.json` fixture file used by the vitest integration suite.

#### Priority verification targets (run these against a real org first)

1. **Precedence**: `2 * 3 ^ 4` — must confirm 1296 vs 162. This determines the entire binding power table.
2. **Precedence**: `2 ^ 3 ^ 2` — must confirm 64 (left-assoc) vs 512 (right-assoc).
3. **Null equality**: `null = ""` — must confirm `true`.
4. **CEILING/FLOOR negatives**: `CEILING(-1.3)` — must confirm `-2` (toward zero) vs `-1` (Math.ceil).
5. **ROUND near zero**: `ROUND(0.003, 2)` — must confirm `0` vs `0.00`.
6. **Date truncation**: `DATE(2020,1,1) + 0.7` — must confirm same date (truncated) vs next day.
7. **ADDMONTHS last-day**: `ADDMONTHS(DATE(2020,1,31), 1)` — must confirm `2020-02-29`.
8. **AND null**: `AND(TRUE, NULL)` — must confirm `false` (not null).
9. **NOT null**: `NOT(NULL)` — must confirm `null` (not true/false).

---

## Verification

- **Unit tests**: `cd formula-parser && npm test` - runs vitest suite
- **Coverage**: `npm run test:coverage` - target 100% on evaluator and functions
- **Type check**: `npm run typecheck`
- **Build**: `npm run build` - produces `dist/` with ESM + declarations
- **SF verification**: `npm run verify:formulas` (from root) - compares against real org

---

## Tooling Summary

| Tool           | Purpose                                                 |
| -------------- | ------------------------------------------------------- |
| TypeScript 5.9 | Source language, `tsc` for build                        |
| Vitest         | Test runner (native ESM + TS support, no config needed) |
| `sf` CLI       | Deploy formula fields, create records, query results    |
| No bundler     | ESM output consumed directly by bundlers                |
| Zero prod deps | Only `typescript` and `vitest` as devDependencies       |

---

## Appendix: Behavioral Reference (from real SF engine source code)

This appendix contains exact behavioral specifications extracted from the official Salesforce formula engine Java source code. Reference this when implementing each function to ensure exact compatibility.

### A1. String Equality with Null

From `OperatorEquality.comparePointwise()`:

```
if treatAsString:
    coerce null → ""
    then compare normally
else:
    if either operand is null → return null (three-valued)
```

The `treatAsString` flag is `true` when either operand has a string type (even if its value is null). This requires tracking field types in the evaluation context.

### A2. CEILING/FLOOR Rounding Details

**CEILING**: First rounds to 18-digit precision with HALF_DOWN. Then: positive → `Math.ceil`, negative → `Math.floor` (toward zero). This means `CEILING(6/11*11)` correctly returns `6`, not `7` (the pre-rounding absorbs the floating-point noise).

**FLOOR**: First rounds to 18-digit precision with HALF_UP. Then: positive → `Math.floor`, negative → `Math.ceil` (toward zero).

In JS, you may need to implement the pre-rounding step to handle edge cases:

```typescript
function preRound(n: number, mode: 'halfUp' | 'halfDown'): number {
  // Round to ~15 significant digits to absorb float noise
  const precision = 15;
  const factor = Math.pow(10, precision - Math.floor(Math.log10(Math.abs(n))) - 1);
  return Math.round(n * factor) / factor; // Approximate; test against SF org
}
```

### A3. SUBSTITUTE Edge Cases

```
SUBSTITUTE(null, old, new)  → null
SUBSTITUTE("", old, new)    → null (empty treated as null for return)
SUBSTITUTE(text, null, new) → null
SUBSTITUTE(text, old, null) → replaces old with "" (null new = empty string)
```

### A4. FIND Edge Cases

```
FIND(null, text)            → 0
FIND(search, null)          → 0
FIND("a", "abc")            → 1 (1-based)
FIND("a", "abc", 2)         → 0 (not found after position 2)
FIND("", "abc")             → 1 (empty always found at start)
```

### A5. Division By Zero

The engine throws an exception (similar to `ArithmeticException`). In our JS implementation, check for zero divisor and throw `FormulaError` with a descriptive message. Short-circuit evaluation in IF/AND/OR prevents the error when the division is in an unevaluated branch.

### A6. Power Function Limits

```
if (Math.log10(Math.abs(base)) * exponent > 64) throw FormulaError("Out of range")
if (result != 0 && Math.abs(result) < 1e-39) return 0
// Exponent must be integer (throws if fractional)
```

### A7. TEXT() Formatting

```
TEXT(number)   → plain decimal, no scientific notation, no trailing zeros beyond scale
TEXT(date)     → "YYYY-MM-DD"
TEXT(datetime) → "YYYY-MM-DD HH:mm:ssZ"  (note the Z suffix, space separator)
TEXT(time)     → "HH:mm:ss.SSS"
TEXT(boolean)  → "true" / "false"
TEXT(null)     → null
```

For DateTime in JS: `d.toISOString().replace('T', ' ').substring(0, 19) + 'Z'`
For Date in JS: `d.toISOString().substring(0, 10)`
For Time in JS: construct from milliseconds, format with zero-padding.

### A8. Date Arithmetic Truncation

When adding a fractional number to a **Date** (not DateTime), the fractional part is **discarded** (truncated toward zero):

- `Date + 5.7` → adds 5 days
- `Date + 0.9` → adds 0 days (no change)
- `Date + (-1.5)` → subtracts 1 day

Implementation: `Math.trunc(days)` before converting to milliseconds.

When adding to a **DateTime**, fractional days represent hours/minutes/seconds and are **rounded to the nearest second** using HALF_UP.

### A9. FormulaTime Arithmetic

Time values are stored as milliseconds since midnight (0–86400000).

- `Time + Number`: the number is in **milliseconds** (not days). Result wraps: `(time + ms + 86400000) % 86400000`.
- `Time - Time`: returns milliseconds. `((t1 - t2 + 86400000) % 86400000)` to handle negative modulo in JS.

### A10. AND/OR Short-Circuit Null Handling

**AND** implementation (from real source):

```java
for each arg:
    result = checkBoolean(stack.pop())
    if result == null || result == false:
        return false   // ← null treated as false, returns false immediately
return true
```

**OR** implementation:

```java
for each arg:
    result = checkBoolean(stack.pop())
    if result != null && result == true:
        return true    // ← only stops on explicit true
// fell through all args without finding true
return false
```

Key difference: AND returns false on null (null is falsy), OR skips null (continues looking for true).

### A11. REGEX Full-String Match

The real engine wraps the pattern to enforce full-string match. In SQL it adds `^` and `$`. For our JS implementation:

```typescript
function sfRegex(text: string | null, pattern: string | null): boolean {
  const t = text ?? '';
  const p = pattern ?? '';
  // Full-string match — wrap in ^ and $ if not already present
  const fullPattern = p === '' ? '^$' : `^(?:${p})$`;
  return new RegExp(fullPattern).test(t);
}
```

### A12. INCLUDES (Multi-Select Picklist)

```typescript
function includes(multiSelectValue: string | null, checkValue: string): boolean {
  if (!multiSelectValue) return false;
  const values = multiSelectValue.split(';').map(v => v.trim());
  return values.includes(checkValue);
}
```

### A13. ISPICKVAL

```typescript
function isPickVal(picklistValue: string | null, compareValue: string): boolean {
  // Null picklist is treated as empty string
  const actual = picklistValue ?? '';
  return actual === compareValue;
}
```

So `ISPICKVAL(nullField, "")` → `true`.
