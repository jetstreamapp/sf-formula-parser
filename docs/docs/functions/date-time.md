---
sidebar_position: 4
title: Date & Time Functions
---

# Date & Time Functions

21 functions for working with dates, times, and timestamps.

## Constructors

### `DATE(year, month, day)`

Creates a date from year, month, and day values.

```
DATE(2024, 6, 15)
// Date: 2024-06-15
```

### `DATEVALUE(textOrDate)`

Converts a text string or datetime to a date-only value (time portion stripped).

```
DATEVALUE("2024-06-15")
DATEVALUE("2024-06-15T10:30:00Z")
```

### `DATETIMEVALUE(text)`

Converts a text string to a datetime value.

```
DATETIMEVALUE("2024-06-15 10:30:00")
```

### `TIMEVALUE(text)`

Converts a text string to a time value (`SfTime`).

```
TIMEVALUE("10:30:00")
// { timeInMillis: 37800000 }
```

### `GEOLOCATION(latitude, longitude)`

Creates a geographic location. (Also listed under Math.)

## Current Date/Time

### `NOW()`

Returns the current date and time. Override with the `now` option for deterministic tests.

```
NOW()
// Current datetime
```

### `TODAY()`

Returns today's date (no time component).

```
TODAY()
// Current date
```

### `TIMENOW()`

Returns the current time as an `SfTime` value.

```
TIMENOW()
// Current time
```

## Date Parts

### `YEAR(date)`

Returns the year from a date.

```
YEAR(DATE(2024, 6, 15))  // 2024
```

### `MONTH(date)`

Returns the month number (1-12).

```
MONTH(DATE(2024, 6, 15))  // 6
```

### `DAY(date)`

Returns the day of the month (1-31).

```
DAY(DATE(2024, 6, 15))  // 15
```

### `WEEKDAY(date)`

Returns the day of the week. Sunday = 1, Saturday = 7.

```
WEEKDAY(DATE(2024, 6, 15))  // 7 (Saturday)
```

### `ISOWEEK(date)`

Returns the ISO week number (1-53).

```
ISOWEEK(DATE(2024, 1, 1))  // 1
```

### `ISOYEAR(date)`

Returns the ISO year (may differ from calendar year at year boundaries).

```
ISOYEAR(DATE(2024, 12, 30))  // 2025 (belongs to ISO week 1 of 2025)
```

### `DAYOFYEAR(date)`

Returns the day number within the year (1-366).

```
DAYOFYEAR(DATE(2024, 3, 1))  // 61 (2024 is a leap year)
```

## Time Parts

### `HOUR(timeOrDatetime)`

Returns the hour (0-23).

```
HOUR(TIMEVALUE("14:30:00"))  // 14
```

### `MINUTE(timeOrDatetime)`

Returns the minutes (0-59).

```
MINUTE(TIMEVALUE("14:30:00"))  // 30
```

### `SECOND(timeOrDatetime)`

Returns the seconds (0-59).

```
SECOND(TIMEVALUE("14:30:45"))  // 45
```

### `MILLISECOND(time)`

Returns the milliseconds (0-999).

```
MILLISECOND(TIMEVALUE("14:30:45.123"))  // 123
```

## Date Arithmetic

### `ADDMONTHS(date, months)`

Adds a number of months to a date. Handles month-end rollover correctly.

```
ADDMONTHS(DATE(2024, 1, 31), 1)  // 2024-02-29 (leap year)
ADDMONTHS(DATE(2024, 3, 15), -2) // 2024-01-15
```

## Unix Timestamps

### `UNIXTIMESTAMP(datetime)`

Converts a datetime to a Unix timestamp (seconds since epoch).

```
UNIXTIMESTAMP(DATETIMEVALUE("2024-01-01 00:00:00"))
// 1704067200
```

### `FROMUNIXTIME(seconds)`

Converts a Unix timestamp to a datetime.

```
FROMUNIXTIME(1704067200)
// 2024-01-01T00:00:00.000Z
```
