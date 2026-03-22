---
sidebar_position: 1
title: Getting Started
---

# Getting Started

Get up and running with `sf-formula-parser` in under two minutes.

## Installation

```bash
npm install @jetstreamapp/sf-formula-parser
```

Or with your preferred package manager:

```bash
yarn add @jetstreamapp/sf-formula-parser
pnpm add @jetstreamapp/sf-formula-parser
```

## Quick Example

```typescript
import { evaluateFormula } from '@jetstreamapp/sf-formula-parser';

const result = evaluateFormula('IF(Amount > 1000, "Large Deal", "Small Deal")', {
  record: {
    Amount: 5000,
  },
});

console.log(result); // "Large Deal"
```

That's it — one function call, no setup required.

## How It Works

The library processes formulas in three stages:

```
Formula String → Lexer → Tokens → Parser → AST → Evaluator → Result
                                                       ↑
                                               Record Context
```

1. **Lexer** — tokenizes the formula string, handling string escapes, comments, and operators
2. **Parser** — a hand-rolled Pratt parser produces a typed AST
3. **Evaluator** — walks the AST, resolving field references against the record context you provide

You can use `evaluateFormula()` for the common case, or work with each stage independently for advanced use cases.

## Core Concepts

### Record Context

Every formula is evaluated against a **record context** — an object containing the Salesforce record as a flat object (the same shape as a SOQL query result):

```typescript
const context = {
  record: {
    Name: 'Acme Corp',
    Amount: 50000,
    IsActive: true,
    CreatedDate: new Date('2024-01-15'),
  },
};

evaluateFormula('UPPER(Name)', context);
// "ACME CORP"
```

### Related Records

Access parent relationships like `Account.Name` — related records are nested directly in the record:

```typescript
const context = {
  record: {
    Account: {
      Name: 'Acme Corp',
      Industry: 'Technology',
    },
  },
};

evaluateFormula('Account.Industry', context);
// "Technology"
```

### Type Safety

The library is written in TypeScript and exports all its types:

```typescript
import type { FormulaValue, FormulaContext, FormulaRecord, EvaluationOptions, ASTNode } from '@jetstreamapp/sf-formula-parser';
```

`FormulaValue` can be `number`, `string`, `boolean`, `Date`, `SfTime`, `GeoLocation`, or `null`.

## Next Steps

- **[API Reference](/docs/api-reference)** — full details on every exported function and type
- **[Record Context](/docs/record-context)** — related records, globals, prior values
- **[Functions](/docs/functions/logical)** — all 90+ supported functions
- **[Playground](/playground)** — try formulas live in your browser
