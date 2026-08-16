/**
 * Minimal Wadler/Prettier-style document IR and printer.
 *
 * A `Doc` describes output with optional line breaks. `printDoc` lays it out
 * for a target width: every `group` is printed flat (all `line`s become spaces,
 * all `softline`s vanish) if it fits on the remaining line, otherwise it is
 * printed in break mode (every `line`/`softline` directly inside it becomes a
 * newline). Nested groups are decided independently, so a broken outer call can
 * still contain flat inner calls.
 */

export type Doc = string | Doc[] | GroupDoc | IndentDoc | LineDoc;

export interface GroupDoc {
  type: 'group';
  contents: Doc;
  /** Set by `propagateBreaks` when the group contains a hard line break. */
  break?: boolean;
}

export interface IndentDoc {
  type: 'indent';
  contents: Doc;
}

export interface LineDoc {
  type: 'line';
  /** Prints as a space when flat, newline when broken. */
  soft?: boolean;
  /** Always a newline; forces every enclosing group to break. */
  hard?: boolean;
  /** Like `hard`, but the next line is not indented (used for raw multi-line text). */
  literal?: boolean;
}

export interface PrintDocOptions {
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
}

/** Newline when the enclosing group breaks, otherwise a single space. */
export const line: LineDoc = { type: 'line' };
/** Newline when the enclosing group breaks, otherwise nothing. */
export const softline: LineDoc = { type: 'line', soft: true };
/** Always a newline (indented); forces enclosing groups to break. */
export const hardline: LineDoc = { type: 'line', hard: true };
/** Always a newline with no indentation; forces enclosing groups to break. */
export const literalline: LineDoc = { type: 'line', hard: true, literal: true };

export function group(contents: Doc): GroupDoc {
  return { type: 'group', contents };
}

export function indent(contents: Doc): IndentDoc {
  return { type: 'indent', contents };
}

export function join(separator: Doc, docs: Doc[]): Doc[] {
  const result: Doc[] = [];
  docs.forEach((doc, index) => {
    if (index > 0) result.push(separator);
    result.push(doc);
  });
  return result;
}

const MODE_BREAK = 0;
const MODE_FLAT = 1;
type Mode = typeof MODE_BREAK | typeof MODE_FLAT;

interface Command {
  indent: number;
  mode: Mode;
  doc: Doc;
}

/** Mark every group that (transitively) contains a hard line as broken. Returns whether `doc` contains one. */
function propagateBreaks(doc: Doc): boolean {
  if (typeof doc === 'string') return false;
  if (Array.isArray(doc)) {
    // Evaluate every child so nested groups get marked even after the first hard line.
    let hasHard = false;
    for (const child of doc) {
      if (propagateBreaks(child)) hasHard = true;
    }
    return hasHard;
  }
  switch (doc.type) {
    case 'line':
      return doc.hard === true;
    case 'indent':
      return propagateBreaks(doc.contents);
    case 'group': {
      const hasHard = propagateBreaks(doc.contents);
      if (hasHard) doc.break = true;
      return hasHard;
    }
  }
}

/**
 * Whether `next` fits in `width` columns when printed in its mode. Continues through
 * `rest` (the printer's remaining stack, innermost last) until a newline is reached, so
 * text that follows the group on the same line (a trailing `,` or `)`) counts against it.
 */
function fits(next: Command, rest: Command[], width: number, tabWidth: number): boolean {
  const cmds: Command[] = [next];
  let restIndex = rest.length;

  while (width >= 0) {
    if (cmds.length === 0) {
      if (restIndex === 0) return true;
      cmds.push(rest[--restIndex]!);
      continue;
    }
    const { mode, doc, indent: ind } = cmds.pop()!;

    if (typeof doc === 'string') {
      const { head, hasNewline } = measureText(doc, tabWidth);
      width -= head;
      // A string carrying its own line break ends the line being measured, just like a `line` doc:
      // only the text up to that break competes for the remaining width.
      if (hasNewline) return width >= 0;
    } else if (Array.isArray(doc)) {
      for (let i = doc.length - 1; i >= 0; i--) {
        cmds.push({ indent: ind, mode, doc: doc[i]! });
      }
    } else if (doc.type === 'line') {
      if (mode === MODE_BREAK || doc.hard) return true;
      if (!doc.soft) width -= 1;
    } else if (doc.type === 'indent') {
      cmds.push({ indent: ind, mode, doc: doc.contents });
    } else {
      cmds.push({ indent: ind, mode: doc.break ? MODE_BREAK : mode, doc: doc.contents });
    }
  }
  return false;
}

interface TextMeasure {
  /** Columns the text adds to the line it starts on — everything up to its first line break. */
  head: number;
  /** Column the text leaves the cursor on: after its last line break, or `head` if it has none. */
  tail: number;
  hasNewline: boolean;
}

/**
 * Measure a chunk of output text. String literals are printed verbatim from source and the lexer
 * allows real line breaks inside them, so a single `Doc` string can span lines; counting it as one
 * long run would both overstate what it costs the current line and leave the column stale after it.
 */
function measureText(text: string, tabWidth: number): TextMeasure {
  const firstNewline = text.indexOf('\n');
  if (firstNewline === -1) {
    const width = columnsOf(text, tabWidth);
    return { head: width, tail: width, hasNewline: false };
  }
  return {
    head: columnsOf(text.slice(0, firstNewline).replace(/\r$/, ''), tabWidth),
    tail: columnsOf(text.slice(text.lastIndexOf('\n') + 1), tabWidth),
    hasNewline: true,
  };
}

function columnsOf(text: string, tabWidth: number): number {
  let width = 0;
  for (const ch of text) {
    width += ch === '\t' ? tabWidth : 1;
  }
  return width;
}

function trimTrailingWhitespace(out: string[]): void {
  while (out.length > 0) {
    const last = out[out.length - 1]!;
    const trimmed = last.replace(/[ \t]+$/, '');
    if (trimmed.length > 0) {
      out[out.length - 1] = trimmed;
      return;
    }
    out.pop();
  }
}

export function printDoc(doc: Doc, options: PrintDocOptions): string {
  const { printWidth, tabWidth, useTabs } = options;
  propagateBreaks(doc);

  const out: string[] = [];
  const cmds: Command[] = [{ indent: 0, mode: MODE_BREAK, doc }];
  let pos = 0;

  while (cmds.length > 0) {
    const { indent: ind, mode, doc: current } = cmds.pop()!;

    if (typeof current === 'string') {
      out.push(current);
      const { tail, hasNewline } = measureText(current, tabWidth);
      pos = hasNewline ? tail : pos + tail;
    } else if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i--) {
        cmds.push({ indent: ind, mode, doc: current[i]! });
      }
    } else if (current.type === 'indent') {
      cmds.push({ indent: ind + 1, mode, doc: current.contents });
    } else if (current.type === 'group') {
      if (mode === MODE_FLAT && !current.break) {
        cmds.push({ indent: ind, mode: MODE_FLAT, doc: current.contents });
      } else {
        const flat: Command = { indent: ind, mode: MODE_FLAT, doc: current.contents };
        if (!current.break && fits(flat, cmds, printWidth - pos, tabWidth)) {
          cmds.push(flat);
        } else {
          cmds.push({ indent: ind, mode: MODE_BREAK, doc: current.contents });
        }
      }
    } else if (mode === MODE_FLAT && !current.hard) {
      if (!current.soft) {
        out.push(' ');
        pos += 1;
      }
    } else {
      trimTrailingWhitespace(out);
      if (current.literal) {
        out.push('\n');
        pos = 0;
      } else {
        const indentation = useTabs ? '\t'.repeat(ind) : ' '.repeat(ind * tabWidth);
        out.push('\n' + indentation);
        pos = ind * tabWidth;
      }
    }
  }

  return out.join('');
}
