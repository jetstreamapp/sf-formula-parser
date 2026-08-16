import { describe, it, expect } from 'vitest';
import { formatFormula, formatAST, parseFormula } from '../index.js';
import { LexerError, ParseError, FormulaError } from '../evaluator/errors.js';
import { ALL_TEST_SUITES } from './test-cases.js';
import { Lexer } from '../lexer/lexer.js';
import { TokenType } from '../lexer/tokens.js';
import type { ASTNode } from '../parser/ast.js';

/** Multi-line expected output helper: strips the common indent so tests read naturally. */
function lines(...rows: string[]): string {
  return rows.join('\n');
}

describe('formatFormula', () => {
  describe('spacing and casing', () => {
    it('normalizes whitespace around operators and commas', () => {
      expect(formatFormula('IF(Amount>100,"big","small")')).toBe('IF(Amount > 100, "big", "small")');
      expect(formatFormula('  1+2*3   ')).toBe('1 + 2 * 3');
      expect(formatFormula('a\n\n+\n\nb')).toBe('a + b');
    });

    it('upper-cases function names', () => {
      expect(formatFormula('if(isblank(x), upper(y), z)')).toBe('IF(ISBLANK(x), UPPER(y), z)');
    });

    it('upper-cases TRUE, FALSE, NULL and NOT keywords', () => {
      expect(formatFormula('IF(true, false, null)')).toBe('IF(TRUE, FALSE, NULL)');
      expect(formatFormula('not IsActive')).toBe('NOT IsActive');
      expect(formatFormula('Not(IsActive)')).toBe('NOT(IsActive)');
    });

    it('preserves field reference casing and special characters', () => {
      expect(formatFormula('account.name & $User.FirstName & $Setup.Cfg__c.Val__c & obj:field#1')).toBe(
        'account.name & $User.FirstName & $Setup.Cfg__c.Val__c & obj:field#1',
      );
    });

    it('preserves symbolic operators as written', () => {
      expect(formatFormula('a==b && c!=d || e<>f')).toBe('a == b && c != d || e <> f');
      expect(formatFormula('!IsActive')).toBe('!IsActive');
    });
  });

  describe('literals', () => {
    it('preserves string literals verbatim including quote style and escapes', () => {
      expect(formatFormula(`'single' & "double" & "esc\\"aped" & 'it\\'s' & "tab\\tnew\\n"`)).toBe(
        `'single' & "double" & "esc\\"aped" & 'it\\'s' & "tab\\tnew\\n"`,
      );
    });

    it('measures a string literal containing a line break from its last line, not its full length', () => {
      // The literal's own line break ends the line, so only what follows it competes for the
      // remaining width — measuring the whole literal as one run would break the call needlessly.
      const source = `IF("${'x'.repeat(30)}\nb", ccc, ddd)`;
      expect(formatFormula(source, { printWidth: 40 })).toBe(lines(`IF("${'x'.repeat(30)}`, 'b", ccc, ddd)'));
      // The text before the break still counts against the line it starts on.
      const wideHead = `IF(aaaa, "${'x'.repeat(45)}\nb", cccc)`;
      expect(formatFormula(wideHead, { printWidth: 40 })).toBe(lines('IF(', '  aaaa,', `  "${'x'.repeat(45)}`, 'b",', '  cccc', ')'));
    });

    it('preserves number literals verbatim', () => {
      expect(formatFormula('1.50 + 007 + 0.0')).toBe('1.50 + 007 + 0.0');
    });
  });

  describe('parentheses', () => {
    it('preserves required parentheses', () => {
      expect(formatFormula('(a+b)*c')).toBe('(a + b) * c');
    });

    it('preserves redundant parentheses', () => {
      expect(formatFormula('((a)) + (b * c)')).toBe('((a)) + (b * c)');
    });

    it('breaks long parenthesized expressions with indentation', () => {
      expect(formatFormula('(aaaaaaaaaaaaaaaaaaaa + bbbbbbbbbbbbbbbbbbbb + cccccccccccccccccccc) * 2', { printWidth: 40 })).toBe(
        lines('(', '  aaaaaaaaaaaaaaaaaaaa +', '    bbbbbbbbbbbbbbbbbbbb +', '    cccccccccccccccccccc', ') *', '  2'),
      );
    });
  });

  describe('function calls', () => {
    it('keeps a call on one line when it fits', () => {
      expect(formatFormula('IF(ISBLANK(Account.Name), "No Account", Account.Name)')).toBe(
        'IF(ISBLANK(Account.Name), "No Account", Account.Name)',
      );
    });

    it('breaks every argument onto its own line when the call does not fit', () => {
      const formula =
        'IF(AND(ISPICKVAL(StageName, "Closed Won"), Amount > 100000), "Big Deal", IF(Amount > 50000, "Medium Deal", "Small Deal"))';
      expect(formatFormula(formula)).toBe(
        lines(
          'IF(',
          '  AND(ISPICKVAL(StageName, "Closed Won"), Amount > 100000),',
          '  "Big Deal",',
          '  IF(Amount > 50000, "Medium Deal", "Small Deal")',
          ')',
        ),
      );
    });

    it('breaks nested calls independently', () => {
      const formula = 'IF(AND(ISPICKVAL(StageName, "Closed Won"), Amount > 100000, NOT(ISBLANK(CloseDate))), "Yes", "No")';
      expect(formatFormula(formula, { printWidth: 50 })).toBe(
        lines(
          'IF(',
          '  AND(',
          '    ISPICKVAL(StageName, "Closed Won"),',
          '    Amount > 100000,',
          '    NOT(ISBLANK(CloseDate))',
          '  ),',
          '  "Yes",',
          '  "No"',
          ')',
        ),
      );
    });

    it('accounts for trailing text on the same line when measuring whether a call fits', () => {
      // "IF(a, b, c) &" is 13 chars: the trailing " &" counts against the call's width
      expect(formatFormula('IF(a, b, c) & d', { printWidth: 15 })).toBe('IF(a, b, c) & d');
      expect(formatFormula('IF(a, b, c) & d', { printWidth: 13 })).toBe(lines('IF(a, b, c) &', '  d'));
      expect(formatFormula('IF(a, b, c) & d', { printWidth: 12 })).toBe(lines('IF(', '  a,', '  b,', '  c', ') &', '  d'));
    });

    it('formats calls with no arguments', () => {
      expect(formatFormula('TODAY( ) + 1')).toBe('TODAY() + 1');
    });

    it('formats single-argument calls', () => {
      expect(formatFormula('LEN( Name )')).toBe('LEN(Name)');
    });
  });

  describe('CASE and IFS pairs', () => {
    it('keeps CASE value/result pairs together when the call breaks', () => {
      const formula = 'CASE(StageName, "Prospecting", 1, "Qualification", 2, "Needs Analysis", 3, "Value Proposition", 4, 0)';
      expect(formatFormula(formula)).toBe(
        lines(
          'CASE(',
          '  StageName,',
          '  "Prospecting", 1,',
          '  "Qualification", 2,',
          '  "Needs Analysis", 3,',
          '  "Value Proposition", 4,',
          '  0',
          ')',
        ),
      );
    });

    it('keeps IFS condition/result pairs together when the call breaks', () => {
      const formula = 'IFS(Amount > 100000, "Large", Amount > 50000, "Medium", Amount > 10000, "Small", "Tiny")';
      expect(formatFormula(formula)).toBe(
        lines('IFS(', '  Amount > 100000, "Large",', '  Amount > 50000, "Medium",', '  Amount > 10000, "Small",', '  "Tiny"', ')'),
      );
    });

    it('handles CASE without an else value', () => {
      expect(formatFormula('CASE(x, 1, "one", 2, "two")', { printWidth: 12 })).toBe(
        lines('CASE(', '  x,', '  1, "one",', '  2, "two"', ')'),
      );
    });

    it('breaks a pair after the comma when the pair itself is too long', () => {
      expect(formatFormula('CASE(x, "aaaaaaaaaa", "bbbbbbbbbb", 0)', { printWidth: 20 })).toBe(
        lines('CASE(', '  x,', '  "aaaaaaaaaa",', '    "bbbbbbbbbb",', '  0', ')'),
      );
    });

    it('keeps CASE flat when it fits', () => {
      expect(formatFormula('CASE(x, 1, "a", "b")')).toBe('CASE(x, 1, "a", "b")');
    });

    it('does not pair when there are too few arguments', () => {
      expect(formatFormula('CASE(xxxxxxxxxx, yyyyyyyyyy)', { printWidth: 10 })).toBe(lines('CASE(', '  xxxxxxxxxx,', '  yyyyyyyyyy', ')'));
    });
  });

  describe('binary expressions', () => {
    it('keeps short chains on one line', () => {
      expect(formatFormula('FirstName & " " & LastName')).toBe('FirstName & " " & LastName');
    });

    it('breaks long chains after each operator with indented continuation', () => {
      const formula = '"Hello " & FirstName & " " & LastName & ", welcome to " & $Organization.Name & "!"';
      expect(formatFormula(formula, { printWidth: 40 })).toBe(
        lines('"Hello " &', '  FirstName &', '  " " &', '  LastName &', '  ", welcome to " &', '  $Organization.Name &', '  "!"'),
      );
    });

    it('indents a broken chain relative to its enclosing argument', () => {
      const formula = 'IF(ISBLANK(FirstName), LastName, "Hello there my good friend " & FirstName & " " & LastName)';
      expect(formatFormula(formula, { printWidth: 50 })).toBe(
        lines(
          'IF(',
          '  ISBLANK(FirstName),',
          '  LastName,',
          '  "Hello there my good friend " &',
          '    FirstName &',
          '    " " &',
          '    LastName',
          ')',
        ),
      );
    });

    it('flattens same-precedence operators into one chain', () => {
      expect(formatFormula('a + b - c & d', { printWidth: 5 })).toBe(lines('a +', '  b -', '  c &', '  d'));
    });

    it('keeps higher-precedence sub-expressions as their own group', () => {
      expect(formatFormula('aaaa + bbbb * cccc + dddd', { printWidth: 16 })).toBe(lines('aaaa +', '  bbbb * cccc +', '  dddd'));
    });

    it('breaks a nested lower-precedence chain when the outer chain breaks', () => {
      expect(formatFormula('a && b || c && d', { printWidth: 10 })).toBe(lines('a && b ||', '  c && d'));
      expect(formatFormula('a && b || c && d', { printWidth: 6 })).toBe(lines('a &&', '  b ||', '  c &&', '    d'));
    });

    it('does not flatten across parentheses', () => {
      expect(formatFormula('a & (b & c)', { printWidth: 5 })).toBe(lines('a &', '  (', '    b &', '      c', '  )'));
    });
  });

  describe('unary expressions', () => {
    it('prints NOT with a space and symbolic operators without', () => {
      expect(formatFormula('NOT IsActive && !IsDeleted && -Amount + +Tax')).toBe('NOT IsActive && !IsDeleted && -Amount + +Tax');
    });

    it('separates consecutive sign operators', () => {
      expect(formatFormula('- -5 + - + 3')).toBe('- -5 + - +3');
      expect(formatFormula('--5')).toBe('- -5');
    });

    it('preserves parentheses around unary operands', () => {
      expect(formatFormula('-(a+b) * NOT (c)')).toBe('-(a + b) * NOT(c)');
      expect(formatFormula('NOT (a && b)')).toBe('NOT(a && b)');
      expect(formatFormula('! (a)')).toBe('!(a)');
    });
  });

  describe('comments', () => {
    it('keeps inline leading comments inline', () => {
      expect(formatFormula('IF(/* cond */ IsActive, /* yes */ "Yes", "No")')).toBe('IF(/* cond */ IsActive, /* yes */ "Yes", "No")');
    });

    it('keeps own-line leading comments on their own line and breaks the enclosing call', () => {
      expect(formatFormula('IF(\n  /* check active */\n  IsActive, "Yes", "No")')).toBe(
        lines('IF(', '  /* check active */', '  IsActive,', '  "Yes",', '  "No"', ')'),
      );
    });

    it('keeps inline trailing comments before a comma or closing paren inline', () => {
      expect(formatFormula('IF(IsActive /* c1 */, "Yes", "No" /* c2 */)')).toBe('IF(IsActive /* c1 */, "Yes", "No" /* c2 */)');
    });

    it('attaches comments before an operator to the left operand and after it to the right operand', () => {
      expect(formatFormula('a /* left */ + /* right */ b')).toBe('a /* left */ + /* right */ b');
      expect(formatFormula('a + b /* c */ + c')).toBe('a + b /* c */ + c');
    });

    it('preserves comments at the start and end of the formula', () => {
      expect(formatFormula('/* header */\nIF(a, b, c)')).toBe(lines('/* header */', 'IF(a, b, c)'));
      expect(formatFormula('/* header */ IF(a, b, c)')).toBe('/* header */ IF(a, b, c)');
      expect(formatFormula('IF(a, b, c) /* footer */')).toBe('IF(a, b, c) /* footer */');
      expect(formatFormula('IF(a, b, c)\n/* footer */')).toBe(lines('IF(a, b, c)', '/* footer */'));
    });

    it('preserves comments inside empty calls and between a name and its parenthesis', () => {
      expect(formatFormula('TODAY( /* now */ )')).toBe('TODAY(/* now */)');
      expect(formatFormula('TODAY(/* a */ /* b */)')).toBe('TODAY(/* a */ /* b */)');
      expect(formatFormula('IF /* c */ (a, b, c)')).toBe('IF(/* c */ a, b, c)');
      expect(formatFormula('IF( /* c */ a, b, c)')).toBe('IF(/* c */ a, b, c)');
    });

    it('preserves comments around unary operators and parentheses', () => {
      expect(formatFormula('NOT /* c */ a')).toBe('NOT /* c */ a');
      expect(formatFormula('- /* c */ a')).toBe('- /* c */ a');
      expect(formatFormula('( /* c */ a + b /* d */ ) * c')).toBe('(/* c */ a + b /* d */) * c');
    });

    it('preserves multiple consecutive comments', () => {
      expect(formatFormula('/* a */ /* b */ x')).toBe('/* a */ /* b */ x');
      expect(formatFormula('/* a */\n/* b */\nx')).toBe(lines('/* a */', '/* b */', 'x'));
    });

    it('emits multi-line comments verbatim', () => {
      const formula = 'IF(\n  /* line one\n     line two */\n  a, b, c)';
      expect(formatFormula(formula)).toBe(lines('IF(', '  /* line one', '     line two */', '  a,', '  b,', '  c', ')'));
    });

    it('does not treat escaped newlines inside string literals as line breaks', () => {
      expect(formatFormula('"a\\nb" /* c */ & d')).toBe('"a\\nb" /* c */ & d');
    });

    it('normalizes CRLF line endings inside multi-line comments', () => {
      expect(formatFormula('/* one\r\n   two */\r\nx')).toBe(lines('/* one', '   two */', 'x'));
    });

    it('breaks a chain when a trailing comment is on its own line', () => {
      expect(formatFormula('a\n/* c */\n+ b')).toBe(lines('a', '/* c */ +', '  b'));
    });
  });

  describe('options', () => {
    it('respects printWidth', () => {
      expect(formatFormula('IF(a, b, c)', { printWidth: 5 })).toBe(lines('IF(', '  a,', '  b,', '  c', ')'));
      expect(formatFormula('IF(a, b, c)', { printWidth: 11 })).toBe('IF(a, b, c)');
    });

    it('respects tabWidth', () => {
      expect(formatFormula('IF(a, b, c)', { printWidth: 5, tabWidth: 4 })).toBe(lines('IF(', '    a,', '    b,', '    c', ')'));
    });

    it('respects useTabs and counts tabs as tabWidth columns', () => {
      expect(formatFormula('IF(a, IF(b, c, d), e)', { printWidth: 12, useTabs: true, tabWidth: 8 })).toBe(
        lines('IF(', '\ta,', '\tIF(', '\t\tb,', '\t\tc,', '\t\td', '\t),', '\te', ')'),
      );
    });

    it('ignores explicitly undefined options', () => {
      expect(formatFormula('IF(a, b, c)', { printWidth: undefined })).toBe('IF(a, b, c)');
    });
  });

  describe('output shape', () => {
    it('does not emit a trailing newline or trailing whitespace', () => {
      const out = formatFormula('IF(AND(a, b, c), "x", "y")', { printWidth: 5 });
      expect(out.endsWith('\n')).toBe(false);
      for (const row of out.split('\n')) {
        expect(row).toBe(row.trimEnd());
      }
    });
  });

  describe('errors', () => {
    it('throws ParseError for invalid syntax', () => {
      expect(() => formatFormula('IF(a,')).toThrow(ParseError);
      expect(() => formatFormula('a +')).toThrow(ParseError);
      expect(() => formatFormula('a b')).toThrow(ParseError);
      expect(() => formatFormula('')).toThrow(ParseError);
    });

    it('throws LexerError for invalid characters or unterminated comments', () => {
      expect(() => formatFormula('a ~ b')).toThrow(LexerError);
      expect(() => formatFormula('a /* b')).toThrow(LexerError);
    });

    it('reports the position of the offending token', () => {
      try {
        formatFormula('IF(a,\n  b c)');
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).line).toBe(2);
        expect((e as ParseError).column).toBe(5);
      }
    });
  });
});

/** Every formula from the shared suite that parses; used for round-trip and idempotence checks. */
const PARSEABLE_FORMULAS = Object.values(ALL_TEST_SUITES)
  .flat()
  .map(tc => tc.formula)
  .filter(formula => {
    try {
      parseFormula(formula);
      return true;
    } catch {
      return false;
    }
  });

describe('formatting never changes meaning', () => {
  it('has a meaningful corpus', () => {
    expect(PARSEABLE_FORMULAS.length).toBeGreaterThan(300);
  });

  for (const printWidth of [80, 20, 1]) {
    it(`formatFormula round-trips and is idempotent at printWidth ${printWidth}`, () => {
      for (const formula of PARSEABLE_FORMULAS) {
        const formatted = formatFormula(formula, { printWidth });
        expect(parseFormula(formatted), formula).toEqual(parseFormula(formula));
        expect(formatFormula(formatted, { printWidth }), formula).toBe(formatted);
      }
    });
  }

  it('formatAST round-trips and is idempotent', () => {
    for (const formula of PARSEABLE_FORMULAS) {
      const ast = parseFormula(formula);
      const formatted = formatAST(ast, { printWidth: 30 });
      expect(parseFormula(formatted), formula).toEqual(ast);
      expect(formatAST(parseFormula(formatted), { printWidth: 30 }), formula).toBe(formatted);
    }
  });
});

/** Every offset where a comment can be inserted without splitting a token. */
function tokenBoundaries(formula: string): number[] {
  return new Lexer(formula)
    .tokenize()
    .filter(token => token.type !== TokenType.EOF)
    .map(token => token.end);
}

function commentsIn(text: string): string[] {
  return text.match(/\/\*[\s\S]*?\*\//g) ?? [];
}

describe('comments survive the whole corpus', () => {
  // The shared corpus contains no comments, so the round-trip and idempotence guarantees above
  // never exercise comment attachment — the most intricate part of the formatter. Injecting a
  // comment at every token boundary covers each attachment position on every corpus formula.
  for (const printWidth of [80, 20]) {
    it(`preserves an injected comment at every token boundary at printWidth ${printWidth}`, () => {
      for (const formula of PARSEABLE_FORMULAS) {
        for (const offset of tokenBoundaries(formula)) {
          const withComment = `${formula.slice(0, offset)}/* c */${formula.slice(offset)}`;
          const formatted = formatFormula(withComment, { printWidth });
          const context = `${formula} @ ${offset}`;

          expect(commentsIn(formatted), context).toEqual(['/* c */']);
          expect(parseFormula(formatted), context).toEqual(parseFormula(formula));
          expect(formatFormula(formatted, { printWidth }), context).toBe(formatted);
        }
      }
    });
  }

  it('preserves a comment spanning multiple lines', () => {
    for (const formula of PARSEABLE_FORMULAS) {
      const offset = tokenBoundaries(formula)[0]!;
      const withComment = `${formula.slice(0, offset)}\n/* one\n   two */\n${formula.slice(offset)}`;
      const formatted = formatFormula(withComment);

      expect(commentsIn(formatted), formula).toEqual(['/* one\n   two */']);
      expect(parseFormula(formatted), formula).toEqual(parseFormula(formula));
      expect(formatFormula(formatted), formula).toBe(formatted);
    }
  });
});

describe('formatFormula rejects exactly what parseFormula rejects', () => {
  const MALFORMED = ['', '(', ')', '1 +', 'FOO(', 'a b', '"unterminated', 'NOT', '/* c */', 'IF(1,)', '@bad', '1 2 3', 'a.', '&& b'];

  it('accepts and rejects the same inputs, with the same error', () => {
    const attempt = (run: () => unknown) => {
      try {
        run();
        return { ok: true } as const;
      } catch (error) {
        return { ok: false, error: error as Error } as const;
      }
    };

    for (const formula of [...PARSEABLE_FORMULAS, ...MALFORMED]) {
      const parsed = attempt(() => parseFormula(formula));
      const formatted = attempt(() => formatFormula(formula));

      expect(formatted.ok, formula).toBe(parsed.ok);
      if (!parsed.ok && !formatted.ok) {
        expect(formatted.error.constructor, formula).toBe(parsed.error.constructor);
        expect(formatted.error.message, formula).toBe(parsed.error.message);
      }
    }
  });
});

describe('formatAST', () => {
  const roundTrip = (formula: string, options?: Parameters<typeof formatAST>[1]) => formatAST(parseFormula(formula), options);

  it('prints literals', () => {
    expect(roundTrip('1 + 2.5 + true + FALSE + null')).toBe('1 + 2.5 + TRUE + FALSE + NULL');
    expect(roundTrip("'text'")).toBe('"text"');
    expect(roundTrip('Account.Name & $User.Id')).toBe('Account.Name & $User.Id');
  });

  it('prefers double quotes and falls back to single quotes when the value contains a double quote', () => {
    expect(formatAST({ type: 'StringLiteral', value: 'say "hi"' })).toBe(`'say "hi"'`);
    expect(formatAST({ type: 'StringLiteral', value: `it's` })).toBe(`"it's"`);
    expect(formatAST({ type: 'StringLiteral', value: `both ' and "` })).toBe(`"both ' and \\""`);
  });

  it('escapes backslashes and control characters so the value survives re-parsing', () => {
    const value = 'back\\slash \n newline \t tab \r cr';
    expect(parseFormula(formatAST({ type: 'StringLiteral', value }))).toEqual({ type: 'StringLiteral', value });
    expect(formatAST({ type: 'StringLiteral', value: 'a\\b' })).toBe('"a\\\\b"');
    expect(formatAST({ type: 'StringLiteral', value: 'a\nb' })).toBe('"a\\nb"');
  });

  it('prints numbers without exponent notation', () => {
    for (const value of [1e21, 1.5e21, -2.25e22, 1e-7, 1.5e-7, -1.234e-10, 5e-324]) {
      const text = formatAST({ type: 'NumberLiteral', value });
      expect(text).not.toMatch(/e/i);
      expect(parseFormula(text.replace('-', '')), String(value)).toEqual({ type: 'NumberLiteral', value: Math.abs(value) });
    }
    expect(formatAST({ type: 'NumberLiteral', value: 1e21 })).toBe('1000000000000000000000');
    expect(formatAST({ type: 'NumberLiteral', value: 1e-7 })).toBe('0.0000001');
    expect(formatAST({ type: 'NumberLiteral', value: -5 })).toBe('-5');
  });

  it('throws for non-finite numbers', () => {
    expect(() => formatAST({ type: 'NumberLiteral', value: Infinity })).toThrow(FormulaError);
    expect(() => formatAST({ type: 'NumberLiteral', value: NaN })).toThrow(FormulaError);
  });

  it('inserts only the parentheses required by precedence', () => {
    expect(roundTrip('(a + b) * c')).toBe('(a + b) * c');
    expect(roundTrip('a + (b * c)')).toBe('a + b * c');
    expect(roundTrip('((a)) + (b)')).toBe('a + b');
    expect(roundTrip('a - (b - c)')).toBe('a - (b - c)');
    expect(roundTrip('(a - b) - c')).toBe('a - b - c');
    expect(roundTrip('a && (b || c)')).toBe('a && (b || c)');
    expect(roundTrip('(a && b) || c')).toBe('a && b || c');
  });

  it('respects the Salesforce-specific precedence of ^ and &', () => {
    // ^ binds looser than * and is left-associative
    expect(roundTrip('(2 * 3) ^ 2')).toBe('2 * 3 ^ 2');
    expect(roundTrip('2 * (3 ^ 2)')).toBe('2 * (3 ^ 2)');
    expect(roundTrip('2 ^ (3 ^ 2)')).toBe('2 ^ (3 ^ 2)');
    // & shares a level with + and -
    expect(roundTrip('(a & b) + c')).toBe('a & b + c');
    expect(roundTrip('a & (b + c)')).toBe('a & (b + c)');
  });

  it('parenthesizes binary operands of unary operators', () => {
    expect(roundTrip('-(a + b)')).toBe('-(a + b)');
    expect(roundTrip('NOT (a && b)')).toBe('NOT(a && b)'); // NOT( is a function call
    expect(roundTrip('NOT a && b')).toBe('NOT a && b');
    expect(roundTrip('!(a = b)')).toBe('!(a = b)');
    expect(roundTrip('-(-a)')).toBe('- -a');
    expect(roundTrip('!ISBLANK(a)')).toBe('!ISBLANK(a)');
  });

  it('emits the call form for a hand-built unary NOT whose operand needs parentheses', () => {
    // `NOT` followed by `(` always lexes as a function call, so `NOT (a && b)` would print as a
    // unary but read back as a call. The call form is the only honest spelling — and means the same.
    const operand: ASTNode = {
      type: 'BinaryExpression',
      operator: '&&',
      left: { type: 'FieldReference', parts: ['a'] },
      right: { type: 'FieldReference', parts: ['b'] },
    };
    expect(formatAST({ type: 'UnaryExpression', operator: 'NOT', operand })).toBe('NOT(a && b)');
    expect(parseFormula(formatAST({ type: 'UnaryExpression', operator: 'NOT', operand }))).toEqual({
      type: 'FunctionCall',
      name: 'NOT',
      args: [operand],
    });
    // An operand that needs no parentheses keeps the unary spelling.
    expect(formatAST({ type: 'UnaryExpression', operator: 'NOT', operand: { type: 'FieldReference', parts: ['a'] } })).toBe('NOT a');
  });

  it('separates a sign operator from a hand-built negative literal operand', () => {
    const negative: ASTNode = { type: 'NumberLiteral', value: -5 };
    expect(formatAST({ type: 'UnaryExpression', operator: '-', operand: negative })).toBe('- -5');
    expect(formatAST({ type: 'UnaryExpression', operator: '+', operand: negative })).toBe('+ -5');
    // Only sign operators can collide with a leading `-`
    expect(formatAST({ type: 'UnaryExpression', operator: '!', operand: negative })).toBe('!-5');
  });

  it('parenthesizes children of unknown operators in hand-built ASTs', () => {
    const ast: ASTNode = {
      type: 'BinaryExpression',
      operator: '??',
      left: {
        type: 'BinaryExpression',
        operator: '+',
        left: { type: 'FieldReference', parts: ['a'] },
        right: { type: 'FieldReference', parts: ['b'] },
      },
      right: { type: 'FieldReference', parts: ['c'] },
    };
    expect(formatAST(ast)).toBe('a + b ?? c');
    const nested: ASTNode = {
      type: 'BinaryExpression',
      operator: '+',
      left: ast,
      right: { type: 'FieldReference', parts: ['d'] },
    };
    expect(formatAST(nested)).toBe('(a + b ?? c) + d');
  });

  it('applies the same layout rules as formatFormula', () => {
    const formula = 'CASE(StageName, "Prospecting", 1, "Qualification", 2, "Needs Analysis", 3, "Value Proposition", 4, 0)';
    expect(roundTrip(formula)).toBe(formatFormula(formula));
    expect(roundTrip('IF(a, b, c)', { printWidth: 5 })).toBe(lines('IF(', '  a,', '  b,', '  c', ')'));
  });
});
