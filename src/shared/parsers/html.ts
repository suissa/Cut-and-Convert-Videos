export type HtmlNode = HtmlDocument | HtmlElement | HtmlText | HtmlComment | HtmlDoctype;

export interface HtmlDocument {
  type: 'document';
  children: HtmlNode[];
}

export interface HtmlElement {
  type: 'element';
  tagName: string;
  attributes: HtmlAttribute[];
  children: HtmlNode[];
  selfClosing: boolean;
}

export interface HtmlAttribute {
  name: string;
  value: string | true;
}

export interface HtmlText {
  type: 'text';
  value: string;
}

export interface HtmlComment {
  type: 'comment';
  value: string;
}

export interface HtmlDoctype {
  type: 'doctype';
  value: string;
}

const voidElements = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

export function parseHtml(source: string): HtmlDocument {
  const parser = new HtmlParser(source);
  return parser.parse();
}

class HtmlParser {
  private index = 0;
  private readonly root: HtmlDocument = { type: 'document', children: [] };
  private readonly stack: Array<HtmlDocument | HtmlElement> = [this.root];

  constructor(private readonly source: string) {}

  parse(): HtmlDocument {
    while (!this.eof()) {
      if (this.startsWith('<!--')) {
        this.readComment();
      } else if (/^<!doctype/i.test(this.source.slice(this.index, this.index + 9))) {
        this.readDoctype();
      } else if (this.startsWith('</')) {
        this.readClosingTag();
      } else if (this.peek() === '<' && /[A-Za-z]/.test(this.source[this.index + 1] ?? '')) {
        this.readElement();
      } else {
        this.readText();
      }
    }

    return this.root;
  }

  private readComment(): void {
    this.index += 4;
    const end = this.source.indexOf('-->', this.index);
    const value = end === -1 ? this.source.slice(this.index) : this.source.slice(this.index, end);
    this.current().children.push({ type: 'comment', value });
    this.index = end === -1 ? this.source.length : end + 3;
  }

  private readDoctype(): void {
    this.index += 2;
    const end = this.source.indexOf('>', this.index);
    const value = (end === -1 ? this.source.slice(this.index) : this.source.slice(this.index, end)).trim();
    this.current().children.push({ type: 'doctype', value });
    this.index = end === -1 ? this.source.length : end + 1;
  }

  private readClosingTag(): void {
    this.index += 2;
    this.skipWhitespace();
    const tagName = this.readName().toLowerCase();
    const end = this.source.indexOf('>', this.index);
    this.index = end === -1 ? this.source.length : end + 1;

    for (let i = this.stack.length - 1; i > 0; i -= 1) {
      const node = this.stack[i];
      if (node.type === 'element' && node.tagName === tagName) {
        this.stack.length = i;
        return;
      }
    }
  }

  private readElement(): void {
    this.index += 1;
    const tagName = this.readName().toLowerCase();
    const attributes = this.readAttributes();
    const explicitSelfClosing = this.consume('/');
    this.consume('>');

    const selfClosing = explicitSelfClosing || voidElements.has(tagName);
    const element: HtmlElement = { type: 'element', tagName, attributes, children: [], selfClosing };
    this.current().children.push(element);

    if (!selfClosing) {
      this.stack.push(element);
    }
  }

  private readAttributes(): HtmlAttribute[] {
    const attributes: HtmlAttribute[] = [];

    while (!this.eof()) {
      this.skipWhitespace();
      if (this.peek() === '>' || this.peek() === '/') break;

      const name = this.readName();
      if (!name) break;

      this.skipWhitespace();
      if (!this.consume('=')) {
        attributes.push({ name, value: true });
        continue;
      }

      this.skipWhitespace();
      attributes.push({ name, value: this.readAttributeValue() });
    }

    return attributes;
  }

  private readAttributeValue(): string {
    const quote = this.peek();
    if (quote === '"' || quote === "'") {
      this.index += 1;
      const start = this.index;
      while (!this.eof() && this.peek() !== quote) this.index += 1;
      const value = this.source.slice(start, this.index);
      this.consume(quote);
      return decodeHtmlEntities(value);
    }

    const start = this.index;
    while (!this.eof() && !/[\s>]/.test(this.peek())) this.index += 1;
    return decodeHtmlEntities(this.source.slice(start, this.index));
  }

  private readText(): void {
    const start = this.index;
    while (!this.eof() && this.peek() !== '<') this.index += 1;
    const value = decodeHtmlEntities(this.source.slice(start, this.index));
    if (value) this.current().children.push({ type: 'text', value });
  }

  private readName(): string {
    const start = this.index;
    while (!this.eof() && /[A-Za-z0-9:_-]/.test(this.peek())) this.index += 1;
    return this.source.slice(start, this.index);
  }

  private skipWhitespace(): void {
    while (!this.eof() && /\s/.test(this.peek())) this.index += 1;
  }

  private consume(value: string): boolean {
    if (!this.startsWith(value)) return false;
    this.index += value.length;
    return true;
  }

  private current(): HtmlDocument | HtmlElement {
    return this.stack[this.stack.length - 1];
  }

  private startsWith(value: string): boolean {
    return this.source.startsWith(value, this.index);
  }

  private peek(): string {
    return this.source[this.index] ?? '';
  }

  private eof(): boolean {
    return this.index >= this.source.length;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
