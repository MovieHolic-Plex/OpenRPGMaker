type DomGlobalName = "document" | "Node" | "HTMLElement" | "HTMLButtonElement";

type PreviousDomGlobals = {
  readonly document: Document | undefined;
  readonly Node: typeof Node | undefined;
  readonly HTMLElement: typeof HTMLElement | undefined;
  readonly HTMLButtonElement: typeof HTMLButtonElement | undefined;
};

export class FakeNode {
  readonly childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;

  get parentElement(): FakeElement | null {
    return this.parentNode instanceof FakeElement ? this.parentNode : null;
  }
  private ownText = "";

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get textContent(): string {
    return `${this.ownText}${this.childNodes.map((child) => child.textContent).join("")}`;
  }

  set textContent(value: string) {
    this.ownText = value;
    this.childNodes.length = 0;
  }

  append(...children: FakeNode[]): void {
    for (const child of children) {
      child.parentNode = this;
      this.childNodes.push(child);
    }
  }

  removeChild(child: FakeNode): void {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
  }

  remove(): void {
    this.parentNode?.removeChild(this);
    this.parentNode = null;
  }

  prepend(...children: FakeNode[]): void {
    for (const child of children.slice().reverse()) {
      child.parentNode = this;
      this.childNodes.unshift(child);
    }
  }

  replaceChildren(...children: FakeNode[]): void {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes.length = 0;
    this.append(...children);
  }

  contains(node: unknown): boolean {
    if (node === this) return true;
    return this.childNodes.some((child) => child.contains(node));
  }
}

export class FakeElement extends FakeNode {
  checked = false;
  className = "";
  dataset: Record<string, string> = {};
  disabled = false;
  hidden = false;
  innerHTML = "";
  max = "";
  min = "";
  style: Record<string, string> & { setProperty: (name: string, value: string) => void } = createFakeStyle();
  type = "";
  value = "";
  isContentEditable = false;
  readonly attrs: Record<string, string> = {};
  readonly tagName: string;
  private readonly listeners: Partial<Record<string, EventListenerOrEventListenerObject[]>> = {};
  readonly classList = {
    add: (...tokens: string[]): void => {
      const classes = new Set(this.className.split(/\s+/).filter(Boolean));
      for (const token of tokens) classes.add(token);
      this.className = Array.from(classes).join(" ");
    },
    contains: (token: string): boolean => this.className.split(/\s+/).includes(token),
    remove: (...tokens: string[]): void => {
      const removed = new Set(tokens);
      this.className = this.className
        .split(/\s+/)
        .filter((token) => token && !removed.has(token))
        .join(" ");
    },
    toggle: (token: string, force?: boolean): boolean => {
      const has = this.className.split(/\s+/).includes(token);
      const shouldAdd = force === undefined ? !has : force;
      if (shouldAdd) {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        classes.add(token);
        this.className = Array.from(classes).join(" ");
      } else {
        this.className = this.className
          .split(/\s+/)
          .filter((cls) => cls && cls !== token)
          .join(" ");
      }
      return shouldAdd;
    },
  };

  constructor(tagName: string) {
    super();
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return;
    const listeners = this.listeners[type] ?? [];
    listeners.push(listener);
    this.listeners[type] = listeners;
  }

  dispatchEvent(event: Event): boolean {
    if (event.target === null) Object.defineProperty(event, "target", { configurable: true, value: this });
    Object.defineProperty(event, "currentTarget", { configurable: true, value: this });
    for (const listener of this.listeners[event.type] ?? []) {
      if (typeof listener === "function") {
        listener(event);
        continue;
      }
      listener.handleEvent(event);
    }
    if (event.bubbles) this.parentElement?.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  click(): void {
    this.dispatchEvent(new Event("click"));
  }

  focus(): void {
    const doc = globalThis.document as unknown as { activeElement?: FakeElement };
    doc.activeElement = this;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = [];
    collectMatches(this, selector, matches);
    return matches;
  }

  scrollTo(): void {
  }

  getBoundingClientRect(): DOMRect {
    return { bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) };
  }

  setPointerCapture(): void {
  }

  hasPointerCapture(): boolean {
    return false;
  }

  releasePointerCapture(): void {
  }
}

function createFakeStyle(): Record<string, string> & { setProperty: (name: string, value: string) => void } {
  const style = {} as Record<string, string> & { setProperty: (name: string, value: string) => void };
  style.setProperty = (name: string, value: string): void => {
    style[name] = value;
  };
  return style;
}

export function installFakeDom(): () => void {
  const body = new FakeElement("body");
  const previous = {
    document: globalThis.document,
    Node: globalThis.Node,
    HTMLElement: globalThis.HTMLElement,
    HTMLButtonElement: globalThis.HTMLButtonElement,
  } satisfies PreviousDomGlobals;
  defineDomGlobal("Node", FakeNode);
  defineDomGlobal("HTMLElement", FakeElement);
  defineDomGlobal("HTMLButtonElement", FakeElement);
  defineDomGlobal("document", {
    activeElement: null,
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    // SVG 아이콘(makeSvgIcon)이 createElementNS를 쓴다 — 네임스페이스는 무시하고 일반 요소로 위임.
    createElementNS: (_ns: string, tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => {
      const node = new FakeNode();
      node.textContent = text;
      return node;
    },
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector),
  });
  return () => {
    restoreDomGlobal("document", previous.document);
    restoreDomGlobal("Node", previous.Node);
    restoreDomGlobal("HTMLElement", previous.HTMLElement);
    restoreDomGlobal("HTMLButtonElement", previous.HTMLButtonElement);
  };
}

export function renderWithFakeDom(render: () => HTMLElement): FakeElement {
  const node = render();
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake DOM renderer to return FakeElement");
}

export function findByTestId(root: FakeNode, testId: string): FakeElement | null {
  if (root instanceof FakeElement && root.dataset.testid === testId) return root;
  for (const child of root.childNodes) {
    const match = findByTestId(child, testId);
    if (match) return match;
  }
  return null;
}

function collectMatches(root: FakeNode, selector: string, matches: FakeElement[]): void {
  for (const child of root.childNodes) {
    if (!(child instanceof FakeElement)) continue;
    if (matchesSelector(child, selector)) matches.push(child);
    collectMatches(child, selector, matches);
  }
}

function matchesSelector(element: FakeElement, selector: string): boolean {
  const simpleSelector = selector.trim().split(/\s+/).at(-1) ?? selector;
  if (simpleSelector.startsWith(".")) return element.className.split(/\s+/).includes(simpleSelector.slice(1));
  const testId = simpleSelector.match(/^\[data-testid=['"]?([^'"\]]+)['"]?\]$/u)?.[1];
  if (testId) return element.dataset.testid === testId;
  const tag = simpleSelector.match(/^([a-zA-Z]+)(?::not\(:disabled\))?$/u)?.[1];
  return tag ? element.tagName === tag.toUpperCase() && !element.disabled : false;
}

function defineDomGlobal(name: DomGlobalName, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

function restoreDomGlobal(name: DomGlobalName, value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  defineDomGlobal(name, value);
}
