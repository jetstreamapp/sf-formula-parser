---
sidebar_position: 3
title: Record Context
---

# Record Context

Every formula is evaluated against a `FormulaContext` — the object that represents the Salesforce record and its environment.

## Basic Fields

The `record` property is a flat object mapping field names to their values — the same shape as a SOQL query result:

```typescript
import { evaluateFormula } from '@jetstreamapp/sf-formula-parser';

evaluateFormula('Name & " - $" & TEXT(Amount)', {
  record: {
    Name: 'Acme Corp',
    Amount: 50000,
  },
});
// "Acme Corp - $50000"
```

Field values can be any `FormulaValue`:

| Type          | Example                                       |
| ------------- | --------------------------------------------- |
| `number`      | `42`, `3.14`                                  |
| `string`      | `"Acme Corp"`                                 |
| `boolean`     | `true`, `false`                               |
| `Date`        | `new Date('2024-01-15')`                      |
| `SfTime`      | `{ timeInMillis: 43200000 }` (noon)           |
| `GeoLocation` | `{ latitude: 37.7749, longitude: -122.4194 }` |
| `null`        | `null` (blank field)                          |

## Related Records

Access fields on related records using dot-notation in the formula. Related records are nested directly in the `record` object:

```typescript
// Formula: Account.Name
evaluateFormula('Account.Name', {
  record: {
    Account: { Name: 'Acme Corp' },
  },
});
// "Acme Corp"
```

### Multi-Level Relationships

Relationships can be nested:

```typescript
// Formula: Contact.Account.Industry
evaluateFormula('Contact.Account.Industry', {
  record: {
    Contact: {
      Account: { Industry: 'Technology' },
    },
  },
});
// "Technology"
```

## Global Variables

Salesforce global variables like `$User`, `$Profile`, and `$Organization` are supported via the `globals` property:

```typescript
// Formula: $User.FirstName
evaluateFormula('$User.FirstName', {
  record: {},
  globals: {
    $User: {
      FirstName: 'Jane',
      LastName: 'Smith',
      Email: 'jane@example.com',
    },
  },
});
// "Jane"
```

## Prior Value Support

For trigger-context formulas that use `ISCHANGED`, `PRIORVALUE`, `ISNEW`, or `ISCLONE`:

```typescript
// ISCHANGED(Status) - true when Status differs from prior value
evaluateFormula('ISCHANGED(Status)', {
  record: { Status: 'Closed' },
  priorRecord: { Status: 'Open' },
});
// true

// PRIORVALUE(Amount) - returns the previous value
evaluateFormula('PRIORVALUE(Amount)', {
  record: { Amount: 200 },
  priorRecord: { Amount: 100 },
});
// 100

// ISNEW() - true when the record is newly created
evaluateFormula('ISNEW()', {
  record: {},
  isNew: true,
});
// true

// ISCLONE() - true when the record is a clone
evaluateFormula('ISCLONE()', {
  record: {},
  isClone: true,
});
// true
```

## Evaluation Options

Pass options as the third argument to `evaluateFormula`:

```typescript
evaluateFormula(formula, context, {
  treatBlanksAsZeroes: true, // default
  now: new Date('2024-06-15T12:00:00Z'),
});
```

### `treatBlanksAsZeroes`

**Default: `true`**

When enabled (the Salesforce default), null/blank values are coerced:

- Blank numbers become `0`
- Blank text becomes `""`

When disabled, null values propagate through calculations, which can be useful for detecting missing data.

### `now`

Override the timestamp returned by `NOW()` and `TODAY()`. Essential for writing deterministic tests:

```typescript
evaluateFormula('TEXT(TODAY())', context, {
  now: new Date('2024-06-15T12:00:00Z'),
});
// Returns a consistent result regardless of when the test runs
```

## Full Interface

```typescript
// A flat record — fields and related records coexist as keys
type FormulaRecord = { [key: string]: FormulaValue | FormulaRecord };

interface FormulaContext {
  record: FormulaRecord;
  globals?: Record<string, FormulaRecord>;
  priorRecord?: FormulaRecord;
  isNew?: boolean;
  isClone?: boolean;
}

interface EvaluationOptions {
  treatBlanksAsZeroes?: boolean;
  now?: Date;
}

type FormulaValue = number | string | boolean | Date | SfTime | GeoLocation | null;
```
