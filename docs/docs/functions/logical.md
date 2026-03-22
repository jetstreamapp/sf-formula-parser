---
sidebar_position: 1
title: Logical Functions
---

# Logical Functions

16 functions for branching, null-checking, and change detection.

## Branching

### `IF(condition, valueIfTrue, valueIfFalse)`

Returns the second argument if the condition is true, otherwise the third. The untaken branch is **not evaluated** (lazy evaluation).

```
IF(Amount > 1000, "Large", "Small")
// Amount = 5000 → "Large"
```

### `IFS(cond1, val1, cond2, val2, ..., default?)`

Evaluates conditions in order, returns the value for the first true condition. An optional final unpaired argument is the default.

```
IFS(
  Score >= 90, "A",
  Score >= 80, "B",
  Score >= 70, "C",
  "F"
)
```

### `CASE(expr, when1, then1, when2, then2, ..., default)`

Matches an expression against values and returns the corresponding result. The final argument is the default.

```
CASE(Status,
  "New", "Just Created",
  "Active", "In Progress",
  "Unknown"
)
```

## Boolean Logic

### `AND(cond1, cond2, ...)`

Returns `true` if **all** arguments are true.

```
AND(IsActive, Amount > 0)
```

### `OR(cond1, cond2, ...)`

Returns `true` if **any** argument is true.

```
OR(Status = "Active", Status = "Pending")
```

### `NOT(condition)`

Returns the logical negation.

```
NOT(IsActive)
// IsActive = true → false
```

## Null / Blank Checking

### `ISBLANK(value)`

Returns `true` if the value is null, undefined, or an empty string.

```
ISBLANK(Phone)
// Phone = null → true
// Phone = "" → true
// Phone = "555-1234" → false
```

### `ISNULL(value)`

Returns `true` if the value is null or undefined. Unlike `ISBLANK`, an empty string returns `false`.

```
ISNULL(Phone)
// Phone = null → true
// Phone = "" → false
```

### `ISNUMBER(value)`

Returns `true` if the value is a number or a string that can be parsed as a number.

```
ISNUMBER("42")    // true
ISNUMBER("hello") // false
ISNUMBER(3.14)    // true
```

### `BLANKVALUE(value, substitute)`

Returns the value if not blank, otherwise returns the substitute.

```
BLANKVALUE(Phone, "No phone on file")
// Phone = null → "No phone on file"
// Phone = "555-1234" → "555-1234"
```

### `NULLVALUE(value, substitute)`

Returns the value if not null, otherwise returns the substitute.

```
NULLVALUE(Amount, 0)
```

### `IFERROR(expression, errorValue)`

Evaluates the expression and returns its result. If an error occurs, returns the error value instead.

```
IFERROR(VALUE("abc"), 0)
// → 0 (VALUE("abc") throws, so the fallback is returned)
```

## Change Detection

These functions work with the `priorRecord`, `isNew`, and `isClone` properties on the `FormulaContext`.

### `ISCHANGED(field)`

Returns `true` if the field's value differs from its prior value.

```
ISCHANGED(Status)
// Status = "Closed", prior Status = "Open" → true
```

### `PRIORVALUE(field)`

Returns the previous value of the field.

```
PRIORVALUE(Amount)
// Amount = 200, prior Amount = 100 → 100
```

### `ISNEW()`

Returns `true` if the record is being created (no arguments).

```
ISNEW()
// isNew = true → true
```

### `ISCLONE()`

Returns `true` if the record is being cloned (no arguments).

```
ISCLONE()
// isClone = true → true
```
