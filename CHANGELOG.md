# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

[Unreleased]: https://github.com/jetstreamapp/sf-formula-parser/compare/2.1.0...HEAD
[2.1.0]: https://github.com/jetstreamapp/sf-formula-parser/compare/2.0.0...2.1.0
