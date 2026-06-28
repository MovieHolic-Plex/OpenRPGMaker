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
}

export class FakeElement extends FakeNode {
  className = "";
  dataset: Record<string, string> = {};
  disabled = false;
  innerHTML = "";
  style: Record<string, string> = {};
  value = "";
  readonly attrs: Record<string, string> = {};
  readonly tagName: string;
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

  addEventListener(): void {
    return;
  }
}

export function installFakeDom(): () => void {
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
