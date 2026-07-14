export type CssNode = CssStyleRule | CssAtRule;

export interface CssStylesheet {
  type: 'stylesheet';
  rules: CssNode[];
}

export interface CssStyleRule {
  type: 'style-rule';
  selector: string;
  declarations: CssDeclaration[];
}

export interface CssAtRule {
  type: 'at-rule';
  name: string;
  prelude: string;
  rules?: CssNode[];
  declarations?: CssDeclaration[];
}

export interface CssDeclaration {
  property: string;
  value: string;
  important: boolean;
}

export function parseCss(source: string): CssStylesheet {
  const parser = new CssParser(stripComments(source));
  return parser.parseStylesheet();
}

class CssParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parseStylesheet(): CssStylesheet {
    return { type: 'stylesheet', rules: this.readRules() };
  }

  private readRules(stopAtBlockEnd = false): CssNode[] {
    const rules: CssNode[] = [];

    while (!this.eof()) {
      this.skipWhitespace();
      if (stopAtBlockEnd && this.peek() === '}') {
        this.index += 1;
        break;
      }
      if (this.eof()) break;
      rules.push(this.peek() === '@' ? this.readAtRule() : this.readStyleRule());
    }

    return rules;
  }

  private readAtRule(): CssAtRule {
    this.index += 1;
    const name = this.readIdentifier();
    const prelude = this.readUntil([';', '{']).trim();

    if (this.consume(';')) {
      return { type: 'at-rule', name, prelude };
    }

    this.consume('{');
    if (this.atRuleContainsDeclarations(name)) {
      return { type: 'at-rule', name, prelude, declarations: this.readDeclarations() };
    }

    return { type: 'at-rule', name, prelude, rules: this.readRules(true) };
  }

  private readStyleRule(): CssStyleRule {
    const selector = this.readUntil(['{']).trim();
    this.consume('{');
    return { type: 'style-rule', selector, declarations: this.readDeclarations() };
  }

  private readDeclarations(): CssDeclaration[] {
    const declarations: CssDeclaration[] = [];

    while (!this.eof()) {
      this.skipWhitespace();
      if (this.consume('}')) break;

      const property = this.readUntil([':', '}']).trim();
      if (!property || this.peek(-1) === '}') break;
      this.consume(':');

      const rawValue = this.readDeclarationValue().trim();
      const important = /!important\s*$/i.test(rawValue);
      const value = rawValue.replace(/!important\s*$/i, '').trim();
      declarations.push({ property, value, important });
      this.consume(';');
    }

    return declarations;
  }

  private readDeclarationValue(): string {
    const start = this.index;
    let quote: string | null = null;
    let parenDepth = 0;

    while (!this.eof()) {
      const char = this.peek();
      if (quote) {
        if (char === '\\') this.index += 2;
        else if (char === quote) { quote = null; this.index += 1; }
        else this.index += 1;
        continue;
      }

      if (char === '"' || char === "'") { quote = char; this.index += 1; continue; }
      if (char === '(') { parenDepth += 1; this.index += 1; continue; }
      if (char === ')') { parenDepth = Math.max(0, parenDepth - 1); this.index += 1; continue; }
      if (parenDepth === 0 && (char === ';' || char === '}')) break;
      this.index += 1;
    }

    return this.source.slice(start, this.index);
  }

  private readUntil(chars: string[]): string {
    const start = this.index;
    let quote: string | null = null;

    while (!this.eof()) {
      const char = this.peek();
      if (quote) {
        if (char === '\\') this.index += 2;
        else if (char === quote) { quote = null; this.index += 1; }
        else this.index += 1;
        continue;
      }

      if (char === '"' || char === "'") { quote = char; this.index += 1; continue; }
      if (chars.includes(char)) break;
      this.index += 1;
    }

    return this.source.slice(start, this.index);
  }

  private readIdentifier(): string {
    const start = this.index;
    while (!this.eof() && /[A-Za-z0-9_-]/.test(this.peek())) this.index += 1;
    return this.source.slice(start, this.index);
  }

  private atRuleContainsDeclarations(name: string): boolean {
    return ['font-face', 'page', 'counter-style', 'property'].includes(name.toLowerCase());
  }

  private skipWhitespace(): void {
    while (!this.eof() && /\s/.test(this.peek())) this.index += 1;
  }

  private consume(value: string): boolean {
    if (!this.source.startsWith(value, this.index)) return false;
    this.index += value.length;
    return true;
  }

  private peek(offset = 0): string {
    return this.source[this.index + offset] ?? '';
  }

  private eof(): boolean {
    return this.index >= this.source.length;
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}
