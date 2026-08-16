import { Lexer } from '../lexer/lexer.js';
import { Token, TokenType } from '../lexer/tokens.js';
import { PrattParser } from '../parser/pratt.js';
import { FmtComment, FmtNode, withComments } from './cst.js';

/** Parse a formula into a `FmtNode` tree, preserving comments. */
export function parseForFormat(source: string): FmtNode {
  const tokens = new Lexer(source, { preserveComments: true }).tokenize();
  return new FormatParser(source, tokens).parse();
}

/**
 * Builds the formatter's tree using the shared grammar in `PrattParser`, keeping the things
 * the AST drops: comments, parentheses, raw literal text and the exact operator spelling.
 *
 * Comment attachment is entirely this class's business — the grammar knows nothing about it.
 * `current()` buffers comments as it skips them, and the three overrides below decide where
 * each buffered run lands: on the node that follows it, on the node that precedes the token
 * being consumed, or on an empty call that has no argument to hold it.
 */
class FormatParser extends PrattParser<FmtNode> {
  /** Comments seen since the last non-comment token was consumed, waiting to be attached. */
  private pending: FmtComment[] = [];

  constructor(
    private readonly source: string,
    tokens: Token[],
  ) {
    super(tokens);
  }

  protected numberLiteral(token: Token): FmtNode {
    return withComments({ kind: 'literal', text: this.raw(token) });
  }

  protected stringLiteral(token: Token): FmtNode {
    return withComments({ kind: 'literal', text: this.raw(token) });
  }

  protected booleanLiteral(token: Token): FmtNode {
    return withComments({ kind: 'literal', text: token.value.toUpperCase() });
  }

  protected nullLiteral(token: Token): FmtNode {
    return withComments({ kind: 'literal', text: token.value.toUpperCase() });
  }

  protected field(token: Token): FmtNode {
    return withComments({ kind: 'field', text: token.value });
  }

  protected call(name: string, args: FmtNode[]): FmtNode {
    // A call with arguments has already handed its buffered comments to the last argument.
    // An empty call has nowhere else to put them, so they become the call's dangling comments.
    const dangling = args.length === 0 ? this.takeLeading() : [];
    return withComments({ kind: 'call', name: name.toUpperCase(), args, dangling });
  }

  protected unary(operator: string, operand: FmtNode): FmtNode {
    return withComments({ kind: 'unary', operator, operand });
  }

  protected binary(token: Token, leftBp: number, left: FmtNode, right: FmtNode): FmtNode {
    return withComments({ kind: 'binary', operator: token.value, precedence: leftBp, left, right });
  }

  protected paren(inner: FmtNode): FmtNode {
    return withComments({ kind: 'paren', inner });
  }

  /** Comments buffered in front of a node become that node's leading comments. */
  protected override parsePrefix(): FmtNode {
    this.current(); // buffer anything standing between the last token and this node
    const leading = this.takeLeading();
    const node = super.parsePrefix();
    node.leading.push(...leading);
    return node;
  }

  /** The next non-comment token, buffering any comments before it into `pending`. */
  protected override current(): Token {
    while (this.tokens[this.pos]!.type === TokenType.Comment) {
      this.pending.push(this.toComment(this.pos));
      this.pos++;
    }
    return this.tokens[this.pos]!;
  }

  /**
   * Consume the current (non-comment) token. When `precedingNode` is given, any comments
   * buffered before this token are attached to it as trailing comments — this is how
   * comments in front of an operator, `,`, `)` or the end of input find their home.
   */
  protected override advance(precedingNode?: FmtNode): Token {
    const token = this.current();
    if (precedingNode) {
      precedingNode.trailing.push(...this.takeLeading());
    }
    this.pos++;
    return token;
  }

  /** Take the comments buffered since the last consumed token. */
  private takeLeading(): FmtComment[] {
    const comments = this.pending;
    this.pending = [];
    return comments;
  }

  /** The exact source text of a token (used for literals so quotes, escapes and digits survive untouched). */
  private raw(token: Token): string {
    return this.source.slice(token.start, token.end);
  }

  private toComment(index: number): FmtComment {
    const token = this.tokens[index]!;
    const previous = this.tokens[index - 1];
    const next = this.tokens[index + 1];
    const endLine = token.line + countNewlines(token.value);
    return {
      text: token.value,
      // Use raw source text for the previous token: a string literal's decoded value may contain
      // newline characters that came from `\n` escapes rather than actual line breaks.
      newlineBefore: previous !== undefined && previous.line + countNewlines(this.raw(previous)) < token.line,
      newlineAfter: next !== undefined && next.type !== TokenType.EOF && next.line > endLine,
    };
  }
}

function countNewlines(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}
