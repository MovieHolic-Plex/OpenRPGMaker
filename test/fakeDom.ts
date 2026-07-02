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
  };

  constructor(tagName: string) {
    super();
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return;
    const listeners = this.listeners[type] ?? [];
    listeners.push(listener);
    this.listeners[type] = listeners;
  }

  dispatchEvent(event: Event): boolean {
    for (const listener of this.listeners[event.type] ?? []) {
      if (typeof listener === "function") {
        listener(event);
        continue;
      }
      listener.handleEvent(event);
    }
    return true;
  }

  focus(): void {
    const doc = globalThis.document as unknown as { activeElement?: FakeElement };
    doc.activeElement = this;
  }

  querySelector(selector: string): FakeElement | null {
    const tags = selector.split(",").map((part) => part.trim().toUpperCase());
    return findFirstByTag(this, tags);
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
    createTextNode: (text: string) => {
      const node = new FakeNode();
      node.textContent = text;
      return node;
    },
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

function findFirstByTag(root: FakeNode, tags: readonly string[]): FakeElement | null {
  if (root instanceof FakeElement && tags.includes(root.tagName)) return root;
  for (const child of root.childNodes) {
    const match = findFirstByTag(child, tags);
    if (match) return match;
  }
  return null;
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
