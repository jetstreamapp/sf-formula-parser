import { FunctionRegistry, type FunctionContext } from './registry.js';
import { FormulaError } from '../evaluator/errors.js';
import { toNumber, toText, isSfTime, isDate, isDateOnly } from '../evaluator/coercion.js';
import type { FormulaValue, SfTime } from '../evaluator/context.js';

function caseSafeId(id: string): string {
  if (id.length === 18) return id;
  if (id.length !== 15) return id;
  const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
  let suffix = '';
  for (let block = 0; block < 3; block++) {
    let bits = 0;
    for (let i = 0; i < 5; i++) {
      const ch = id.charAt(block * 5 + i);
      if (ch >= 'A' && ch <= 'Z') bits |= 1 << i;
    }
    suffix += lookup[bits]!;
  }
  return id + suffix;
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  // Avoid scientific notation
  const s = String(n);
  if (!s.includes('e') && !s.includes('E')) return s;
  // Handle scientific notation
  return n.toPrecision(15).replace(/\.?0+$/, '');
}

function padDate(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function formatDateValue(d: Date): string {
  const y = d.getUTCFullYear();
  const m = padDate(d.getUTCMonth() + 1, 2);
  const day = padDate(d.getUTCDate(), 2);

  // Date-only values (not marked as DateTime and zero time parts) use short format
  if (isDateOnly(d)) {
    return `${y}-${m}-${day}`;
  }

  const h = padDate(d.getUTCHours(), 2);
  const min = padDate(d.getUTCMinutes(), 2);
  const sec = padDate(d.getUTCSeconds(), 2);
  return `${y}-${m}-${day} ${h}:${min}:${sec}Z`;
}

function formatSfTime(t: SfTime): string {
  const totalMs = t.timeInMillis;
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const ms = totalMs % 1_000;
  return `${padDate(hours, 2)}:${padDate(minutes, 2)}:${padDate(seconds, 2)}.${padDate(ms, 3)}`;
}

function htmlEncode(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function jsEncode(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

export function registerTextFunctions(registry: FunctionRegistry): void {
  // 1. BEGINS(text, search)
  registry.register('BEGINS', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 2)
      throw new FormulaError("Incorrect number of parameters for function 'BEGINS()'. Expected 2, received " + ctx.args.length);
    const search = toText(ctx.evaluate(ctx.args[1]!));
    if (search === null || search === '') return true;
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null || text === '') return null;
    return text.startsWith(search);
  });

  // 2. BR()
  registry.register('BR', (_ctx: FunctionContext): FormulaValue => {
    if (_ctx.args.length !== 0)
      throw new FormulaError("Incorrect number of parameters for function 'BR()'. Expected 0, received " + _ctx.args.length);
    return '<br>';
  });

  // 3. CASESAFEID(id)
  registry.register('CASESAFEID', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'CASESAFEID()'. Expected 1, received " + ctx.args.length);
    const id = toText(ctx.evaluate(ctx.args[0]!));
    if (id === null) return null;
    return caseSafeId(id);
  });

  // 4. CONTAINS(text, search)
  registry.register('CONTAINS', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 2)
      throw new FormulaError("Incorrect number of parameters for function 'CONTAINS()'. Expected 2, received " + ctx.args.length);
    const search = toText(ctx.evaluate(ctx.args[1]!));
    if (search === null || search === '') return true;
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null || text === '') return null;
    return text.includes(search);
  });

  // 5. FIND(search, text, [start])
  registry.register('FIND', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 2 || ctx.args.length > 3)
      throw new FormulaError("Incorrect number of parameters for function 'FIND()'. Expected 2-3, received " + ctx.args.length);
    const searchVal = ctx.evaluate(ctx.args[0]!);
    const textVal = ctx.evaluate(ctx.args[1]!);
    if (searchVal === null) return 0;
    if (textVal === null) return 0;
    const searchStr = toText(searchVal) ?? '';
    const textStr = toText(textVal);
    if (textStr === null) return 0;
    const startPos = ctx.args.length > 2 ? (toNumber(ctx.evaluate(ctx.args[2]!)) ?? 1) : 1;
    const idx = textStr.indexOf(searchStr, startPos - 1);
    return idx === -1 ? 0 : idx + 1;
  });

  // 6. GETSESSIONID()
  registry.register('GETSESSIONID', (_ctx: FunctionContext): FormulaValue => {
    if (_ctx.args.length !== 0)
      throw new FormulaError("Incorrect number of parameters for function 'GETSESSIONID()'. Expected 0, received " + _ctx.args.length);
    return '';
  });

  // 7. HTMLENCODE(text)
  registry.register('HTMLENCODE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'HTMLENCODE()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    return htmlEncode(text);
  });

  // 8. HYPERLINK(url, label, [target])
  registry.register('HYPERLINK', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 2 || ctx.args.length > 3)
      throw new FormulaError("Incorrect number of parameters for function 'HYPERLINK()'. Expected 2-3, received " + ctx.args.length);
    const url = toText(ctx.evaluate(ctx.args[0]!));
    if (url === null) return null;
    const label = toText(ctx.evaluate(ctx.args[1]!)) ?? '';
    const target = ctx.args.length > 2 ? (toText(ctx.evaluate(ctx.args[2]!)) ?? '_blank') : '_blank';
    return `<a href="${url}" target="${target}">${label}</a>`;
  });

  // 9. IMAGE(url, alt, [height, width])
  registry.register('IMAGE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 2 || ctx.args.length > 4)
      throw new FormulaError("Incorrect number of parameters for function 'IMAGE()'. Expected 2-4, received " + ctx.args.length);
    const url = toText(ctx.evaluate(ctx.args[0]!));
    if (url === null) return null;
    const alt = toText(ctx.evaluate(ctx.args[1]!)) ?? '';
    if (ctx.args.length > 2) {
      const height = toNumber(ctx.evaluate(ctx.args[2]!));
      const width = ctx.args.length > 3 ? toNumber(ctx.evaluate(ctx.args[3]!)) : null;
      let tag = `<img src="${url}" alt="${alt}"`;
      if (height !== null) tag += ` height="${height}"`;
      if (width !== null) tag += ` width="${width}"`;
      tag += '>';
      return tag;
    }
    return `<img src="${url}" alt="${alt}">`;
  });

  // 10. INCLUDES(multiSelectField, value)
  registry.register('INCLUDES', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 2)
      throw new FormulaError("Incorrect number of parameters for function 'INCLUDES()'. Expected 2, received " + ctx.args.length);
    const field = toText(ctx.evaluate(ctx.args[0]!));
    const value = toText(ctx.evaluate(ctx.args[1]!)) ?? '';
    if (field === null) return false;
    const values = field.split(';').map(s => s.trim());
    return values.includes(value);
  });

  // 11. ISPICKVAL(picklistField, value)
  registry.register('ISPICKVAL', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 2)
      throw new FormulaError("Incorrect number of parameters for function 'ISPICKVAL()'. Expected 2, received " + ctx.args.length);
    const picklist = toText(ctx.evaluate(ctx.args[0]!)) ?? '';
    const value = toText(ctx.evaluate(ctx.args[1]!)) ?? '';
    return picklist === value;
  });

  // 12. JSENCODE(text)
  registry.register('JSENCODE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'JSENCODE()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    return jsEncode(text);
  });

  // 13. JSINHTMLENCODE(text)
  registry.register('JSINHTMLENCODE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'JSINHTMLENCODE()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    return htmlEncode(jsEncode(text));
  });

  // 14. LEFT(text, n)
  registry.register('LEFT', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 2)
      throw new FormulaError("Incorrect number of parameters for function 'LEFT()'. Expected 2, received " + ctx.args.length);
    const n = toNumber(ctx.evaluate(ctx.args[1]!));
    if (n === null || n <= 0) return null;
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null || text === '') return null;
    return text.substring(0, n);
  });

  // 15. LEN(text)
  registry.register('LEN', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'LEN()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return 0;
    return text.length;
  });

  // 16. LOWER(text)
  registry.register('LOWER', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'LOWER()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    return text.toLowerCase();
  });

  // 17. LPAD(text, length, [padStr])
  registry.register('LPAD', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 2 || ctx.args.length > 3)
      throw new FormulaError("Incorrect number of parameters for function 'LPAD()'. Expected 2-3, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    const length = toNumber(ctx.evaluate(ctx.args[1]!));
    if (length === null || length <= 0) return null;
    const padStr = ctx.args.length > 2 ? (toText(ctx.evaluate(ctx.args[2]!)) ?? ' ') : ' ';
    if (text.length >= length) return text.substring(0, length);
    const needed = length - text.length;
    let pad = '';
    while (pad.length < needed) {
      pad += padStr;
    }
    return pad.substring(0, needed) + text;
  });

  // 18. MID(text, start, length)
  registry.register('MID', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 3)
      throw new FormulaError("Incorrect number of parameters for function 'MID()'. Expected 3, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null || text === '') return null;
    const startRaw = toNumber(ctx.evaluate(ctx.args[1]!));
    if (startRaw === null) return null;
    const length = toNumber(ctx.evaluate(ctx.args[2]!));
    if (length === null || length <= 0) return null;
    let start = startRaw;
    if (start < 1) start = 1;
    const startIdx = start - 1;
    if (startIdx >= text.length) return null;
    const result = text.substring(startIdx, startIdx + length);
    return result === '' ? null : result;
  });

  // 19. RIGHT(text, n)
  registry.register('RIGHT', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 2)
      throw new FormulaError("Incorrect number of parameters for function 'RIGHT()'. Expected 2, received " + ctx.args.length);
    const n = toNumber(ctx.evaluate(ctx.args[1]!));
    if (n === null || n <= 0) return null;
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null || text === '') return null;
    if (n >= text.length) return text;
    return text.substring(text.length - n);
  });

  // 20. RPAD(text, length, [padStr])
  registry.register('RPAD', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length < 2 || ctx.args.length > 3)
      throw new FormulaError("Incorrect number of parameters for function 'RPAD()'. Expected 2-3, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    const length = toNumber(ctx.evaluate(ctx.args[1]!));
    if (length === null || length <= 0) return null;
    const padStr = ctx.args.length > 2 ? (toText(ctx.evaluate(ctx.args[2]!)) ?? ' ') : ' ';
    if (text.length >= length) return text.substring(0, length);
    const needed = length - text.length;
    let pad = '';
    while (pad.length < needed) {
      pad += padStr;
    }
    return text + pad.substring(0, needed);
  });

  // 21. SUBSTITUTE(text, old, new)
  registry.register('SUBSTITUTE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 3)
      throw new FormulaError("Incorrect number of parameters for function 'SUBSTITUTE()'. Expected 3, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null || text === '') return null;
    const oldStr = toText(ctx.evaluate(ctx.args[1]!));
    if (oldStr === null) return null;
    const newStr = toText(ctx.evaluate(ctx.args[2]!)) ?? '';
    // Replace all occurrences
    return text.split(oldStr).join(newStr);
  });

  // 22. TEXT(value)
  registry.register('TEXT', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'TEXT()'. Expected 1, received " + ctx.args.length);
    const value = ctx.evaluate(ctx.args[0]!);
    if (value === null) return null;
    if (typeof value === 'number') return formatNumber(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (isDate(value)) return formatDateValue(value);
    if (isSfTime(value)) return formatSfTime(value);
    if (typeof value === 'string') return value;
    return String(value);
  });

  // 23. TRIM(text)
  registry.register('TRIM', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'TRIM()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    const trimmed = text.trim();
    return trimmed === '' ? null : trimmed;
  });

  // 24. UPPER(text)
  registry.register('UPPER', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'UPPER()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    return text.toUpperCase();
  });

  // 25. URLENCODE(text)
  registry.register('URLENCODE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'URLENCODE()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    return encodeURIComponent(text);
  });

  // 26. VALUE(text)
  registry.register('VALUE', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'VALUE()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    const n = Number(text);
    if (isNaN(n)) throw new FormulaError(`VALUE: cannot convert "${text}" to number`);
    return n;
  });

  // 27. CHR(code)
  registry.register('CHR', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'CHR()'. Expected 1, received " + ctx.args.length);
    const n = toNumber(ctx.evaluate(ctx.args[0]!));
    if (n === null) return null;
    const code = Math.trunc(n);
    if (code <= 0 || code > 0xffff) return null;
    return String.fromCharCode(code);
  });

  // 28. ASCII(text)
  registry.register('ASCII', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'ASCII()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null || text === '') return null;
    return text.charCodeAt(0);
  });

  // 29. INITCAP(text)
  registry.register('INITCAP', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 1)
      throw new FormulaError("Incorrect number of parameters for function 'INITCAP()'. Expected 1, received " + ctx.args.length);
    const text = toText(ctx.evaluate(ctx.args[0]!));
    if (text === null) return null;
    // Capitalize first letter after whitespace or underscore
    let result = '';
    let capitalize = true;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '_') {
        result += ch;
        capitalize = true;
      } else if (capitalize && ch >= 'a' && ch <= 'z') {
        result += ch.toUpperCase();
        capitalize = false;
      } else if (capitalize && ch >= 'A' && ch <= 'Z') {
        result += ch;
        capitalize = false;
      } else if (capitalize) {
        // Non-letter character (e.g. digit, punctuation like '.') after a boundary
        result += ch;
        // Digits and punctuation are content — they cancel the capitalize flag
        capitalize = false;
      } else {
        result += ch.toLowerCase();
      }
    }
    return result;
  });

  // 30. REGEX(text, pattern)
  registry.register('REGEX', (ctx: FunctionContext): FormulaValue => {
    if (ctx.args.length !== 2)
      throw new FormulaError("Incorrect number of parameters for function 'REGEX()'. Expected 2, received " + ctx.args.length);
    const textVal = ctx.evaluate(ctx.args[0]!);
    const patternVal = ctx.evaluate(ctx.args[1]!);
    const t = toText(textVal) ?? '';
    const p = toText(patternVal) ?? '';
    const fullPattern = p === '' ? '^$' : `^(?:${p})$`;
    return new RegExp(fullPattern).test(t);
  });
}
