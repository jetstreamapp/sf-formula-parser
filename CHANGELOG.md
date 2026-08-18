# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- **Replaced Prettier with [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) and added
  [oxlint](https://oxc.rs/docs/guide/usage/linter) as the project linter** — the repository had no
  linter at all. Settings live in `.oxfmtrc.json` and `.oxlintrc.json`, with `npm run format`,
  `format:check`, `lint` and `lint:fix`. oxlint runs the `correctness`, `suspicious` and `perf`
  categories as errors across the `typescript`, `unicorn`, `oxc`, `import` and `vitest` plugins.
  `style` and `pedantic` stay off: oxfmt already owns layout, and the remainder asks for the code to
  be restructured rather than pointing at defects. Rules that genuinely misfire are disabled in
  narrowly scoped `overrides` with the reason recorded inline
- **The `pre-commit` hook blocks a commit when staged files are unformatted or fail lint**, running
  both checks so one attempt reports everything to fix. `npm install` wires it up by pointing
  `core.hooksPath` at `.githooks/`. Emergency bypass: `git commit --no-verify`
- **CI now gates on `format:check`, `lint` and `typecheck`** alongside the tests and build, since the
  pre-commit hook can be bypassed. CI also runs on pushes to `main` and on pull requests rather than
  on every push
- **A `Changelog` workflow requires an `[Unreleased]` entry on pull requests that touch published
  code.** That section decides the version, so a change nobody wrote down was previously only
  noticed at release time, after the bump had been derived. It fails when `CHANGELOG.md` is
  untouched, then runs `scripts/derive-increment.mjs` so a file edited without a real entry fails
  too. The `skip-changelog` label opts out
- **The release version is derived from the changelog headings alone.** The previous rule scanned the
  `[Unreleased]` body for a `BREAKING` marker, which fires on ordinary prose, and mapped
  `### Removed` to a minor. `scripts/derive-increment.mjs` now reads only `### ` headings —
  `Breaking Changes` is a major, `Added`/`Deprecated` a minor, `Changed`/`Removed`/`Fixed`/`Security`
  a patch — and an unrecognized heading is an error rather than a guess, because guessing risks
  publishing a breaking change as a patch. `npm run release` starts a release from the terminal and
  `npm run release:increment` shows the reasoning; `release-it` moved behind `npm run release:ci`
- **The release workflow now matches the one in the Jetstream monorepo.** It authenticates with
  `client-id` rather than `app-id`, which the action marks deprecated with `Use 'client-id' instead`.
  **This needs a `CLIENT_ID` secret holding the GitHub App's client ID.** The commit identity is
  derived from the token rather than hardcoded — `app-slug` names the committer and the App's numeric
  user id forms the `<id>+<slug>[bot]@users.noreply.github.com` address GitHub links back to the App
  account, so release commits carry the bot's avatar. Every action is pinned to a commit SHA with the
  version in a trailing comment, because a tag can be repointed at new code and a SHA cannot
- **Tooling is now shared with [soql-parser-js](https://github.com/jetstreamapp/soql-parser-js)** —
  `scripts/derive-increment.mjs`, `scripts/release.mjs`, `.githooks/pre-commit` and the `ci`,
  `release` and `changelog` workflows are identical in both repositories, as are `.oxfmtrc.json` and
  `.claude/settings.json`
- **Upgraded dependencies** — TypeScript 7, and the latest esbuild, tsx and release-it. `npm-run-all`
  was dropped in favour of chaining the build steps with `&&`, `prettier` and `vite` are gone, and
  `@types/node` and `@vitest/coverage-v8` were added so `npm run test:coverage` runs without
  prompting to install a provider. `vitest.config.ts` became `vitest.config.mts`, since it is ESM
  while the root package is CommonJS
- **Enabled `isolatedDeclarations`, and `npm run typecheck` now covers `scripts/` as well as `src/`.**
  The source already satisfied `isolatedDeclarations`, so this only locks the property in — every
  export keeps an explicit type, which keeps declaration emit independent of type inference.
  `tsconfig.typecheck.json` duplicated the compiler options rather than extending `tsconfig.json`, so
  the two could drift, and its `include` left the TypeScript under `scripts/formula-verify/`
  unchecked — oxlint read those files but `tsc` never did
- **Documentation** — `AGENTS.md` gained sections on linting, the commit hook, types and releasing,
  and no longer tells contributors to run `yarn` in `docs/`, which has a `package-lock.json` and no
  `yarn.lock`. The `IFS`, `CASE` and `DISTANCE` examples in the function reference were run through
  `formatFormula`, so they now show the same layout and upper-cased keywords the formatter produces

### Fixed

- Removed dead code found by the new linter: an unused `formatDate` helper and an unused `toNumber`
  import, plus an unused local in the `Date + Date` error path of the evaluator. No behavior change —
  the error message for adding two dates already reported only the right-hand operand's type
- The `basic-ftp` version pin was declared under `resolutions`, a Yarn field that npm ignores, so it
  was never applied. It is now an `overrides` entry
- `files` in `package.json` listed `LICENSE.txt`, but the file is named `LICENSE`, so the entry
  matched nothing. The license still shipped — npm always includes it — but the manifest now names
  the file that exists

## [2.2.0] - 2026-08-16

### Added

- **`formatFormula(formula, options?)`** — Prettier-style formatter for formulas. Normalizes whitespace and upper-cases function names and keywords (`TRUE`, `FALSE`, `NULL`, `NOT`) while preserving parentheses, comments, and string/number literals exactly as written; the output always parses to the same AST as the input. Calls that exceed `printWidth` (default `80`) break one argument per line, `CASE`/`IFS` value–result pairs stay together, and long operator chains break after each operator. Options: `printWidth`, `tabWidth`, `useTabs`
- **`formatAST(node, options?)`** — print an `ASTNode` back to formula source with the same layout rules, inserting only the parentheses required by operator precedence
- _Internal:_ the lexer can now preserve comments and tokens carry source offsets, and the formula grammar is shared by the AST and formatter parsers — groundwork for the formatter, with no change to the public API
- `"sideEffects": false` in `package.json` so bundlers can tree-shake unused exports (such as the formatter)

## [2.1.2] - 2026-08-06

### Removed

- Removed the GitHub Pages docs deployment from the release pipeline — documentation at https://sf-formula-parser.dev is now built and hosted by Cloudflare Pages

## [2.1.1] - 2026-06-10

### Security

- Updated dependencies to latest versions to resolve security vulnerabilities

## [2.1.0] - 2026-03-25

### Fixed

- **Schema-based type coercion for date/datetime/time fields** — when a schema is provided, field values stored as strings in the record (e.g., `"2024-01-15T12:00:00.000Z"` for a datetime field) are now automatically coerced to their proper types (`Date` for date/datetime, `SfTime` for time). Previously, operators like `+` would see two strings and concatenate instead of enforcing type rules (e.g., `CreatedDate + CreatedDate + "test"` returned a concatenated string instead of throwing an error)
- **Date-only values preserved through arithmetic** — date-only field values (e.g., `"2026-03-24"`) are now correctly treated as date-only even when the schema declares `datetime`. Date arithmetic (`Date + Number`) preserves date-only status, and datetime arithmetic (`DateTime + Number`) preserves the datetime marker on the result

## [2.0.0] - 2026-03-24

### Added

- **Return type validation** — new optional `returnType` field on `EvaluationOptions` validates the formula result matches the declared type (`number`, `string`, `boolean`, `date`, `datetime`, `time`). Throws a descriptive `FormulaError` on mismatch
- **Schema-aware validation** — new optional `schema` field on `EvaluationOptions` accepts Salesforce `describeSObject().fields` directly for:
  - Field existence validation (throws "Field X does not exist" instead of returning null)
  - Picklist/multipicklist field restrictions (matches Salesforce behavior — picklist fields only allowed in TEXT, ISPICKVAL, CASE, ISBLANK, ISNULL, NULLVALUE, BLANKVALUE, INCLUDES, ISCHANGED, PRIORVALUE)
  - **Related object and global schema** — pass `Record<string, FieldSchema[]>` to validate fields on related objects (e.g., `Account.Name`) and globals (e.g., `$User.FirstName`). Use `'$record'` key for root object, relationship names for related objects, `$`-prefixed names for globals
- **New exported types** — `FormulaReturnType`, `FieldSchema`, `SalesforceFieldType`, `FormulaType`, `SchemaInput`, `toFormulaType()`
- **Argument count validation** — all 70+ functions now validate argument counts with descriptive error messages matching Salesforce format
- **GEOLOCATION range validation** — latitude must be [-90, 90], longitude must be [-180, 180]
- **SfTime - Number subtraction** — `Time - Number` now works (was missing, only Time + Number was supported)

### Fixed

- **Strict operator type checking** — arithmetic operators (`+`, `-`, `*`, `/`, `^`) now reject boolean and string operands, matching Salesforce behavior
- **Date + Date rejection** — `Date + Date` and `DateTime + DateTime` now throw, matching Salesforce
- **Unary operator type checking** — unary `-`/`+` require Number, `!`/`NOT` require Boolean
- **Date/Time type guards in subtraction** — invalid combinations like `String - Date` now throw instead of returning null

### Changed

- Argument count error messages standardized to Salesforce format: "Incorrect number of parameters for function 'NAME()'. Expected N, received M"
- Date-time function validation uses strict equality (`!== N`) instead of minimum check (`< N`)

## [1.1.0]

### Added

- `extractFields(formula)` — extract field references from a formula string without evaluating
- `extractFieldsByCategory(formula)` — extract and categorize fields by `$`-prefix (objectFields, globals, customMetadata, customLabels, customSettings, customPermissions)
- `walkAST(node, visitor)` — generic AST walker utility
- docusaurus-plugin-llms for enhanced documentation support

## [1.0.0]

### Added

- Initial release
- Lexer, parser (Pratt), and tree-walking evaluator
- 90+ Salesforce formula functions across 4 categories
  - Logical: IF, IFS, CASE, AND, OR, NOT, ISBLANK, ISNULL, ISNUMBER, BLANKVALUE, NULLVALUE, IFERROR, ISCHANGED, ISNEW, ISCLONE, PRIORVALUE
  - Math: ABS, CEILING, FLOOR, MCEILING, MFLOOR, ROUND, TRUNC, MOD, MAX, MIN, EXP, LN, LOG, SQRT, PI, POWER, RAND, DISTANCE, GEOLOCATION
  - Text: BEGINS, BR, CASESAFEID, CONTAINS, FIND, GETSESSIONID, HTMLENCODE, HYPERLINK, IMAGE, INCLUDES, ISPICKVAL, JSENCODE, JSINHTMLENCODE, LEFT, LEN, LOWER, LPAD, MID, RIGHT, RPAD, SUBSTITUTE, TEXT, TRIM, UPPER, URLENCODE, VALUE, REGEX, CHR, ASCII, INITCAP
  - Date/Time: ADDMONTHS, DATE, DATEVALUE, DATETIMEVALUE, DAY, HOUR, MILLISECOND, MINUTE, MONTH, NOW, SECOND, TIMENOW, TIMEVALUE, TODAY, WEEKDAY, YEAR, ISOWEEK, ISOYEAR, DAYOFYEAR, UNIXTIMESTAMP, FROMUNIXTIME
- Salesforce-specific operator precedence (^ below \*, left-associative)
- Oracle three-valued null semantics
- Date/DateTime/Time arithmetic
- Field path resolution with related records and global variables
- Zero production dependencies
- 883 unit/integration tests
- Verified against live Salesforce org (47/47 FormulaEval API tests passing)
- Added documentation site

[Unreleased]: https://github.com/jetstreamapp/sf-formula-parser/compare/2.2.0...HEAD
[2.2.0]: https://github.com/jetstreamapp/sf-formula-parser/compare/2.1.2...2.2.0
[2.1.2]: https://github.com/jetstreamapp/sf-formula-parser/compare/2.1.1...2.1.2
[2.1.1]: https://github.com/jetstreamapp/sf-formula-parser/compare/2.1.0...2.1.1
[2.1.0]: https://github.com/jetstreamapp/sf-formula-parser/compare/2.0.0...2.1.0
