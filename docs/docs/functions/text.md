---
sidebar_position: 3
title: Text Functions
---

# Text Functions

30 functions for string manipulation, encoding, and pattern matching.

## String Manipulation

### `LEFT(text, length)`

Returns the leftmost characters.

```
LEFT("Salesforce", 5)  // "Sales"
```

### `RIGHT(text, length)`

Returns the rightmost characters.

```
RIGHT("Salesforce", 5)  // "force"
```

### `MID(text, startPosition, length)`

Returns a substring. Position is 1-based (like Salesforce, not 0-based).

```
MID("Salesforce", 6, 5)  // "force"
```

### `LEN(text)`

Returns the length of the string.

```
LEN("hello")  // 5
```

### `TRIM(text)`

Removes leading and trailing whitespace.

```
TRIM("  hello  ")  // "hello"
```

### `UPPER(text)`

Converts to uppercase.

```
UPPER("hello")  // "HELLO"
```

### `LOWER(text)`

Converts to lowercase.

```
LOWER("HELLO")  // "hello"
```

### `INITCAP(text)`

Capitalizes the first letter of each word.

```
INITCAP("hello world")  // "Hello World"
```

### `LPAD(text, length, padString?)`

Left-pads the text to the specified length.

```
LPAD("42", 5, "0")  // "00042"
LPAD("hi", 5)       // "   hi"
```

### `RPAD(text, length, padString?)`

Right-pads the text to the specified length.

```
RPAD("hi", 5, ".")  // "hi..."
```

### `SUBSTITUTE(text, oldString, newString)`

Replaces all occurrences of a substring.

```
SUBSTITUTE("Hello World", "World", "Salesforce")
// "Hello Salesforce"
```

## Search

### `FIND(search, text, startPosition?)`

Returns the 1-based position of the first occurrence. Returns 0 if not found.

```
FIND("force", "Salesforce")     // 6
FIND("xyz", "Salesforce")       // 0
FIND("e", "Salesforce", 4)      // 10
```

### `CONTAINS(text, search)`

Returns `true` if the text contains the search string. Case-sensitive.

```
CONTAINS("Salesforce", "force")  // true
CONTAINS("Salesforce", "Force")  // false
```

### `BEGINS(text, search)`

Returns `true` if the text starts with the search string.

```
BEGINS("Salesforce", "Sales")  // true
```

### `REGEX(text, pattern)`

Returns `true` if the text matches the regular expression.

```
REGEX("415-555-1234", "[0-9]{3}-[0-9]{3}-[0-9]{4}")  // true
```

## Conversion

### `TEXT(value)`

Converts any value to its text representation.

```
TEXT(42)          // "42"
TEXT(true)        // "true"
TEXT(TODAY())     // date string
```

### `VALUE(text)`

Converts a numeric string to a number.

```
VALUE("42")      // 42
VALUE("3.14")    // 3.14
```

### `CHR(charCode)`

Returns the character for a character code.

```
CHR(65)   // "A"
CHR(97)   // "a"
```

### `ASCII(text)`

Returns the character code of the first character.

```
ASCII("A")  // 65
ASCII("a")  // 97
```

## Encoding

### `HTMLENCODE(text)`

Encodes HTML special characters.

```
HTMLENCODE("<script>alert('xss')</script>")
// "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;"
```

### `JSENCODE(text)`

Encodes text for safe use in JavaScript strings.

```
JSENCODE("it's a \"test\"")
// "it\\'s a \\\"test\\\""
```

### `JSINHTMLENCODE(text)`

Encodes text for JavaScript embedded in HTML.

### `URLENCODE(text)`

URL-encodes the text.

```
URLENCODE("hello world")  // "hello%20world"
```

## HTML Generation

### `BR()`

Returns an HTML line break tag (`<br>`).

### `HYPERLINK(url, label, target?)`

Creates an HTML anchor tag.

```
HYPERLINK("https://example.com", "Click here", "_blank")
// '<a href="https://example.com" target="_blank">Click here</a>'
```

### `IMAGE(url, alt, height?, width?)`

Creates an HTML image tag.

```
IMAGE("/img/logo.png", "Logo", 50, 200)
```

## Salesforce-Specific

### `CASESAFEID(id)`

Converts a 15-character Salesforce ID to its 18-character case-safe version.

```
CASESAFEID("001000000000001")  // "001000000000001AAA" (example)
```

### `INCLUDES(multiSelectField, value)`

Returns `true` if a multi-select picklist includes the specified value.

```
INCLUDES(Interests, "Technology")
```

### `ISPICKVAL(picklistField, value)`

Returns `true` if a picklist field equals the specified value.

```
ISPICKVAL(Status, "Active")
```

### `GETSESSIONID()`

Returns the current session ID. In this client-side implementation, returns an empty string.
