# Changelog

All notable changes to this project will be documented in this file.

## 1.1.0 (2026-03-22)

### Added

- `extractFields(formula)` — extract field references from a formula string without evaluating
- `extractFieldsByCategory(formula)` — extract and categorize fields by `$`-prefix (objectFields, globals, customMetadata, customLabels, customSettings, customPermissions)
- `walkAST(node, visitor)` — generic AST walker utility
- docusaurus-plugin-llms for enhanced documentation support

## 1.0.0

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
