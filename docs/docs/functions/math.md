---
sidebar_position: 2
title: Math Functions
---

# Math Functions

19 functions for arithmetic, rounding, and geolocation.

## Rounding

### `ROUND(value, scale)`

Rounds a number to the specified number of decimal places.

```
ROUND(3.14159, 2)   // 3.14
ROUND(2.5, 0)       // 3
```

### `CEILING(value)`

Rounds away from zero (positive numbers round up, negative numbers round down in magnitude).

```
CEILING(2.1)   // 3
CEILING(-2.1)  // -3
```

### `FLOOR(value)`

Rounds toward zero.

```
FLOOR(2.9)   // 2
FLOOR(-2.9)  // -2
```

### `MCEILING(value)`

Mathematical ceiling — always rounds toward positive infinity.

```
MCEILING(2.1)   // 3
MCEILING(-2.1)  // -2
```

### `MFLOOR(value)`

Mathematical floor — always rounds toward negative infinity.

```
MFLOOR(2.9)   // 2
MFLOOR(-2.9)  // -3
```

### `TRUNC(value, scale?)`

Truncates decimal places without rounding. Optional scale parameter.

```
TRUNC(3.789)      // 3
TRUNC(3.789, 2)   // 3.78
```

## Arithmetic

### `ABS(value)`

Returns the absolute value.

```
ABS(-42)  // 42
ABS(42)   // 42
```

### `MOD(dividend, divisor)`

Returns the remainder of division.

```
MOD(10, 3)   // 1
MOD(7, 2)    // 1
```

### `POWER(base, exponent)`

Raises the base to the power of the exponent.

```
POWER(2, 10)  // 1024
POWER(9, 0.5) // 3
```

### `SQRT(value)`

Returns the square root.

```
SQRT(144)  // 12
SQRT(2)    // 1.4142135623730951
```

### `EXP(value)`

Returns _e_ raised to the given power.

```
EXP(1)  // 2.718281828459045
EXP(0)  // 1
```

### `LN(value)`

Returns the natural logarithm (base _e_).

```
LN(2.718281828459045)  // 1
LN(1)                  // 0
```

### `LOG(value)`

Returns the base-10 logarithm.

```
LOG(100)  // 2
LOG(1000) // 3
```

## Aggregation

### `MAX(value1, value2, ...)`

Returns the largest value among all arguments.

```
MAX(10, 20, 5)  // 20
```

### `MIN(value1, value2, ...)`

Returns the smallest value among all arguments.

```
MIN(10, 20, 5)  // 5
```

## Constants

### `PI()`

Returns the mathematical constant pi.

```
PI()  // 3.141592653589793
```

### `RAND()`

Returns a random number between 0 (inclusive) and 1 (exclusive).

```
RAND()  // e.g. 0.7391482...
```

## Geolocation

### `GEOLOCATION(latitude, longitude)`

Creates a geographic location value.

```
GEOLOCATION(37.7749, -122.4194)
```

### `DISTANCE(location1, location2, unit)`

Calculates the distance between two locations. Unit is `"mi"` for miles or `"km"` for kilometers.

```
DISTANCE(
  GEOLOCATION(37.7749, -122.4194),
  GEOLOCATION(34.0522, -118.2437),
  "mi"
)
// ~347.42 miles (San Francisco to Los Angeles)
```
