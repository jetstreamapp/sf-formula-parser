import { describe, it, expect } from 'vitest';
import { evaluateFormula } from '../index.js';
import { FormulaError } from '../evaluator/errors.js';

const ctx = { record: {} };

describe('BEGINS', () => {
  it('returns true when text starts with search', () => {
    expect(evaluateFormula('BEGINS("abcdef", "abc")', ctx)).toBe(true);
  });
  it('returns false when text does not start with search', () => {
    expect(evaluateFormula('BEGINS("abcdef", "xyz")', ctx)).toBe(false);
  });
  it('returns true when search is null', () => {
    expect(evaluateFormula('BEGINS("abc", null)', ctx)).toBe(true);
  });
  it('returns true when search is empty string', () => {
    expect(evaluateFormula('BEGINS("abc", "")', ctx)).toBe(true);
  });
  it('returns null when text is null', () => {
    expect(evaluateFormula('BEGINS(null, "abc")', ctx)).toBe(null);
  });
});

describe('BR', () => {
  it('returns <br>', () => {
    expect(evaluateFormula('BR()', ctx)).toBe('<br>');
  });
});

describe('CASESAFEID', () => {
  it('converts 15-char ID to 18-char', () => {
    expect(evaluateFormula('CASESAFEID("001D000000IRFma")', ctx)).toBe('001D000000IRFmaIAH');
  });
  it('returns 18-char ID as-is', () => {
    expect(evaluateFormula('CASESAFEID("001D000000IRFmaIAH")', ctx)).toBe('001D000000IRFmaIAH');
  });
  it('returns null for null input', () => {
    expect(evaluateFormula('CASESAFEID(null)', ctx)).toBe(null);
  });
  it('returns non-15/18 char string as-is', () => {
    expect(evaluateFormula('CASESAFEID("short")', ctx)).toBe('short');
  });
});

describe('CONTAINS', () => {
  it('returns true when text contains search', () => {
    expect(evaluateFormula('CONTAINS("abcdef", "cde")', ctx)).toBe(true);
  });
  it('returns false when text does not contain search', () => {
    expect(evaluateFormula('CONTAINS("abcdef", "xyz")', ctx)).toBe(false);
  });
  it('returns true when search is null', () => {
    expect(evaluateFormula('CONTAINS("abc", null)', ctx)).toBe(true);
  });
  it('returns true when search is empty', () => {
    expect(evaluateFormula('CONTAINS("abc", "")', ctx)).toBe(true);
  });
  it('returns null when text is null', () => {
    expect(evaluateFormula('CONTAINS(null, "abc")', ctx)).toBe(null);
  });
});

describe('FIND', () => {
  it('returns 1-based position', () => {
    expect(evaluateFormula('FIND("b", "abc")', ctx)).toBe(2);
  });
  it('returns 0 when not found', () => {
    expect(evaluateFormula('FIND("x", "abc")', ctx)).toBe(0);
  });
  it('respects start position', () => {
    expect(evaluateFormula('FIND("a", "abca", 2)', ctx)).toBe(4);
  });
  it('returns 0 when search is null', () => {
    expect(evaluateFormula('FIND(null, "abc")', ctx)).toBe(0);
  });
  it('returns 0 when text is null', () => {
    expect(evaluateFormula('FIND("a", null)', ctx)).toBe(0);
  });
  it('returns 0 when start is past match', () => {
    expect(evaluateFormula('FIND("a", "abc", 2)', ctx)).toBe(0);
  });
});

describe('GETSESSIONID', () => {
  it('returns empty string', () => {
    expect(evaluateFormula('GETSESSIONID()', ctx)).toBe('');
  });
});

describe('HTMLENCODE', () => {
  it('encodes angle brackets and ampersand', () => {
    expect(evaluateFormula('HTMLENCODE("<b>bold & cool</b>")', ctx)).toBe('&lt;b&gt;bold &amp; cool&lt;/b&gt;');
  });
  it('encodes special chars', () => {
    expect(evaluateFormula('HTMLENCODE("<>&")', ctx)).toBe('&lt;&gt;&amp;');
  });
  it('returns null for null input', () => {
    expect(evaluateFormula('HTMLENCODE(null)', ctx)).toBe(null);
  });
});

describe('HYPERLINK', () => {
  it('creates a hyperlink with default target', () => {
    expect(evaluateFormula('HYPERLINK("https://example.com", "Example")', ctx)).toBe(
      '<a href="https://example.com" target="_blank">Example</a>',
    );
  });
  it('creates a hyperlink with custom target', () => {
    expect(evaluateFormula('HYPERLINK("https://example.com", "Example", "_self")', ctx)).toBe(
      '<a href="https://example.com" target="_self">Example</a>',
    );
  });
  it('returns null for null URL', () => {
    expect(evaluateFormula('HYPERLINK(null, "label")', ctx)).toBe(null);
  });
});

describe('IMAGE', () => {
  it('creates basic image tag', () => {
    expect(evaluateFormula('IMAGE("pic.png", "A picture")', ctx)).toBe('<img src="pic.png" alt="A picture">');
  });
  it('creates image tag with height and width', () => {
    expect(evaluateFormula('IMAGE("pic.png", "A picture", 100, 200)', ctx)).toBe(
      '<img src="pic.png" alt="A picture" height="100" width="200">',
    );
  });
  it('returns null for null URL', () => {
    expect(evaluateFormula('IMAGE(null, "alt")', ctx)).toBe(null);
  });
});

describe('INCLUDES', () => {
  it('returns true when value is in multi-select', () => {
    expect(evaluateFormula('INCLUDES("Red;Blue;Green", "Blue")', ctx)).toBe(true);
  });
  it('returns false when value is not in multi-select', () => {
    expect(evaluateFormula('INCLUDES("Red;Blue;Green", "Yellow")', ctx)).toBe(false);
  });
  it('returns false for null field', () => {
    expect(evaluateFormula('INCLUDES(null, "Red")', ctx)).toBe(false);
  });
  it('handles trimming', () => {
    expect(evaluateFormula('INCLUDES("Red ; Blue ; Green", "Blue")', ctx)).toBe(true);
  });
});

describe('ISPICKVAL', () => {
  it('returns true when values match', () => {
    expect(evaluateFormula('ISPICKVAL("Active", "Active")', ctx)).toBe(true);
  });
  it('returns false when values differ', () => {
    expect(evaluateFormula('ISPICKVAL("Active", "Inactive")', ctx)).toBe(false);
  });
  it('null picklist equals empty string', () => {
    expect(evaluateFormula('ISPICKVAL(null, "")', ctx)).toBe(true);
  });
  it('null picklist does not equal non-empty', () => {
    expect(evaluateFormula('ISPICKVAL(null, "Active")', ctx)).toBe(false);
  });
});

describe('JSENCODE', () => {
  it('returns null for null', () => {
    expect(evaluateFormula('JSENCODE(null)', ctx)).toBe(null);
  });
  it('passes through plain text', () => {
    expect(evaluateFormula('JSENCODE("hello")', ctx)).toBe('hello');
  });
});

describe('JSINHTMLENCODE', () => {
  it('applies JSENCODE then HTMLENCODE', () => {
    expect(evaluateFormula('JSINHTMLENCODE("<script>")', ctx)).toBe('&lt;script&gt;');
  });
  it('returns null for null', () => {
    expect(evaluateFormula('JSINHTMLENCODE(null)', ctx)).toBe(null);
  });
});

describe('LEFT', () => {
  it('returns leftmost n characters', () => {
    expect(evaluateFormula('LEFT("abcdef", 3)', ctx)).toBe('abc');
  });
  it('returns null when n <= 0', () => {
    expect(evaluateFormula('LEFT("abc", 0)', ctx)).toBe(null);
  });
  it('returns null when text is null', () => {
    expect(evaluateFormula('LEFT(null, 3)', ctx)).toBe(null);
  });
  it('returns entire text when n > length', () => {
    expect(evaluateFormula('LEFT("ab", 5)', ctx)).toBe('ab');
  });
});

describe('LEN', () => {
  it('returns length of string', () => {
    expect(evaluateFormula('LEN("abc")', ctx)).toBe(3);
  });
  it('returns 0 for null', () => {
    expect(evaluateFormula('LEN(null)', ctx)).toBe(0);
  });
  it('returns 0 for empty string', () => {
    expect(evaluateFormula('LEN("")', ctx)).toBe(0);
  });
});

describe('LOWER', () => {
  it('converts to lowercase', () => {
    expect(evaluateFormula('LOWER("ABC")', ctx)).toBe('abc');
  });
  it('returns null for null', () => {
    expect(evaluateFormula('LOWER(null)', ctx)).toBe(null);
  });
});

describe('LPAD', () => {
  it('left-pads with default space', () => {
    expect(evaluateFormula('LPAD("abc", 6)', ctx)).toBe('   abc');
  });
  it('left-pads with custom character', () => {
    expect(evaluateFormula('LPAD("abc", 6, "0")', ctx)).toBe('000abc');
  });
  it('truncates when text is longer than length', () => {
    expect(evaluateFormula('LPAD("abcdef", 3)', ctx)).toBe('abc');
  });
  it('returns null for null text', () => {
    expect(evaluateFormula('LPAD(null, 5)', ctx)).toBe(null);
  });
  it('returns null for length <= 0', () => {
    expect(evaluateFormula('LPAD("abc", 0)', ctx)).toBe(null);
  });
});

describe('MID', () => {
  it('extracts substring (1-based)', () => {
    expect(evaluateFormula('MID("abcdef", 2, 3)', ctx)).toBe('bcd');
  });
  it('returns to end when length exceeds text', () => {
    expect(evaluateFormula('MID("abc", 1, 10)', ctx)).toBe('abc');
  });
  it('returns null when text is null', () => {
    expect(evaluateFormula('MID(null, 1, 3)', ctx)).toBe(null);
  });
  it('returns null when length <= 0', () => {
    expect(evaluateFormula('MID("abc", 1, 0)', ctx)).toBe(null);
  });
  it('clamps start < 1 to 1', () => {
    expect(evaluateFormula('MID("abcdef", 0, 3)', ctx)).toBe('abc');
  });
});

describe('RIGHT', () => {
  it('returns rightmost n characters', () => {
    expect(evaluateFormula('RIGHT("abcdef", 3)', ctx)).toBe('def');
  });
  it('returns null when n <= 0', () => {
    expect(evaluateFormula('RIGHT("abc", 0)', ctx)).toBe(null);
  });
  it('returns null when text is null', () => {
    expect(evaluateFormula('RIGHT(null, 3)', ctx)).toBe(null);
  });
  it('returns entire text when n > length', () => {
    expect(evaluateFormula('RIGHT("ab", 5)', ctx)).toBe('ab');
  });
});

describe('RPAD', () => {
  it('right-pads with default space', () => {
    expect(evaluateFormula('RPAD("abc", 6)', ctx)).toBe('abc   ');
  });
  it('right-pads with custom character', () => {
    expect(evaluateFormula('RPAD("abc", 6, "0")', ctx)).toBe('abc000');
  });
  it('truncates when text is longer than length', () => {
    expect(evaluateFormula('RPAD("abcdef", 3)', ctx)).toBe('abc');
  });
  it('returns null for null text', () => {
    expect(evaluateFormula('RPAD(null, 5)', ctx)).toBe(null);
  });
});

describe('SUBSTITUTE', () => {
  it('replaces all occurrences', () => {
    expect(evaluateFormula('SUBSTITUTE("abc abc", "abc", "xyz")', ctx)).toBe('xyz xyz');
  });
  it('returns null when text is null', () => {
    expect(evaluateFormula('SUBSTITUTE(null, "a", "b")', ctx)).toBe(null);
  });
  it('returns null when old is null', () => {
    expect(evaluateFormula('SUBSTITUTE("abc", null, "b")', ctx)).toBe(null);
  });
  it('treats null new as empty string', () => {
    expect(evaluateFormula('SUBSTITUTE("abc", "b", null)', ctx)).toBe('ac');
  });
});

describe('TEXT', () => {
  it('converts number to string', () => {
    expect(evaluateFormula('TEXT(123)', ctx)).toBe('123');
  });
  it('converts decimal number', () => {
    expect(evaluateFormula('TEXT(3.14)', ctx)).toBe('3.14');
  });
  it('converts boolean true', () => {
    expect(evaluateFormula('TEXT(true)', ctx)).toBe('true');
  });
  it('converts boolean false', () => {
    expect(evaluateFormula('TEXT(false)', ctx)).toBe('false');
  });
  it('returns null for null', () => {
    expect(evaluateFormula('TEXT(null)', ctx)).toBe(null);
  });
  it('converts a date-only value', () => {
    const record = { record: { MyDate: new Date('2024-03-15T00:00:00.000Z') } };
    expect(evaluateFormula('TEXT(MyDate)', record)).toBe('2024-03-15');
  });
  it('converts a datetime value', () => {
    const record = { record: { MyDT: new Date('2024-03-15T14:30:00.000Z') } };
    expect(evaluateFormula('TEXT(MyDT)', record)).toBe('2024-03-15 14:30:00Z');
  });
  it('converts a time value', () => {
    // 10:30:45.123
    const timeMs = 10 * 3600000 + 30 * 60000 + 45 * 1000 + 123;
    const record = { record: { MyTime: { timeInMillis: timeMs } } };
    expect(evaluateFormula('TEXT(MyTime)', record)).toBe('10:30:45.123');
  });
});

describe('TRIM', () => {
  it('removes leading and trailing whitespace', () => {
    expect(evaluateFormula('TRIM("  hello  ")', ctx)).toBe('hello');
  });
  it('returns null for null', () => {
    expect(evaluateFormula('TRIM(null)', ctx)).toBe(null);
  });
});

describe('UPPER', () => {
  it('converts to uppercase', () => {
    expect(evaluateFormula('UPPER("abc")', ctx)).toBe('ABC');
  });
  it('returns null for null', () => {
    expect(evaluateFormula('UPPER(null)', ctx)).toBe(null);
  });
});

describe('URLENCODE', () => {
  it('encodes URL components', () => {
    expect(evaluateFormula('URLENCODE("hello world")', ctx)).toBe('hello%20world');
  });
  it('encodes special characters', () => {
    expect(evaluateFormula('URLENCODE("a=b&c=d")', ctx)).toBe('a%3Db%26c%3Dd');
  });
  it('returns null for null', () => {
    expect(evaluateFormula('URLENCODE(null)', ctx)).toBe(null);
  });
});

describe('VALUE', () => {
  it('parses a numeric string', () => {
    expect(evaluateFormula('VALUE("123")', ctx)).toBe(123);
  });
  it('parses a decimal string', () => {
    expect(evaluateFormula('VALUE("3.14")', ctx)).toBe(3.14);
  });
  it('returns null for null', () => {
    expect(evaluateFormula('VALUE(null)', ctx)).toBe(null);
  });
  it('throws for non-numeric string', () => {
    expect(() => evaluateFormula('VALUE("abc")', ctx)).toThrow(FormulaError);
  });
});

describe('REGEX', () => {
  it('returns true for matching pattern', () => {
    expect(evaluateFormula('REGEX("abc123", "[a-z]+[0-9]+")', ctx)).toBe(true);
  });
  it('returns false for non-matching pattern', () => {
    expect(evaluateFormula('REGEX("abc", "[0-9]+")', ctx)).toBe(false);
  });
  it('null text treated as empty string', () => {
    expect(evaluateFormula('REGEX(null, "")', ctx)).toBe(true);
  });
  it('null pattern treated as empty string', () => {
    expect(evaluateFormula('REGEX("", null)', ctx)).toBe(true);
  });
  it('partial match does not pass (full-string match)', () => {
    expect(evaluateFormula('REGEX("abc123xyz", "[0-9]+")', ctx)).toBe(false);
  });
});
