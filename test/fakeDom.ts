type DomGlobalName =
  | "document"
  | "Node"
  | "HTMLElement"
  | "HTMLButtonElement"
  | "HTMLInputElement"
  | "HTMLSelectElement"
  | "HTMLImageElement"
  | "Image"
  | "HTMLTextAreaElement"
  | "requestAnimationFrame"
  | "cancelAnimationFrame";
type PreviousDomGlobals = {
  readonly document: Document | undefined;
  readonly Node: typeof Node | undefined;
  readonly HTMLElement: typeof HTMLElement | undefined;
  readonly HTMLButtonElement: typeof HTMLButtonElement | undefined;
  readonly HTMLInputElement: typeof HTMLInputElement | undefined;
  readonly HTMLSelectElement: typeof HTMLSelectElement | undefined;
  readonly HTMLImageElement: typeof HTMLImageElement | undefined;
  readonly Image: typeof Image | undefined;
  readonly HTMLTextAreaElement: typeof HTMLTextAreaElement | undefined;
  readonly requestAnimationFrame: typeof requestAnimationFrame | undefined;
  readonly cancelAnimationFrame: typeof cancelAnimationFrame | undefined;
};

type FakeDomOptions = {
  readonly animationFrames?: "manual";
};

const animationFrames = new Map<number, FrameRequestCallback>();
let nextAnimationFrameId = 1;

export class FakeNode {
  readonly childNodes: FakeNode[] = [];
  parentNode: FakeNode | null = null;

  get ownerDocument(): Document {
    return globalThis.document;
  }

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

  replaceWith(...nodes: FakeNode[]): void {
    const parent = this.parentNode;
    if (!parent) return;
    const index = parent.childNodes.indexOf(this);
    if (index < 0) return;
    for (const node of nodes) node.parentNode = parent;
    parent.childNodes.splice(index, 1, ...nodes);
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
  inert = false;
  max = "";
  min = "";
  scrollLeft = 0;
  scrollTop = 0;
  selectionEnd: number | null = 0;
  selectionStart: number | null = 0;
  // 선언 타입은 `createFakeStyle()` 이 정말 주는 것을 그대로 받는다. 손으로 `setProperty`
  // 하나만 적어 두면 `getPropertyValue` 가 인덱스 시그니처의 `string` 으로 해석돼
  // "호출할 수 없는 식" 이 된다 — 런타임에는 있는 함수를 타입만 없다고 말하는 셈이다.
  style: FakeStyle = createFakeStyle();
  type = "";
  value = "";
  isContentEditable = false;
  readonly attrs: Record<string, string> = {};
  readonly tagName: string;
  /** HTMLElement 호환 — 제안 모달 open()이 빈 host 가드에 사용. */
  get childElementCount(): number {
    return this.childNodes.filter((child) => child instanceof FakeElement).length;
  }
  get children(): FakeElement[] {
    return this.childNodes.filter((child): child is FakeElement => child instanceof FakeElement);
  }
  get selectedOptions(): FakeElement[] {
    if (this.tagName !== "SELECT") return [];
    const options = this.children.filter((child) => child.tagName === "OPTION");
    return options.filter((option, index) => option.value === this.value || (this.value === "" && index === 0));
  }
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
    // HTMLOptionElement / input 호환: attribute value 는 .value 프로퍼티와 동기화.
    if (name === "value") this.value = value;
    if (name.startsWith("data-")) {
      const camelKey = name
        .slice(5)
        .replace(/-([a-z])/gu, (_, ch: string) => ch.toUpperCase());
      this.dataset[camelKey] = value;
    }
  }

  getAttribute(name: string): string | null {
    if (name.startsWith("data-")) {
      const camelKey = name
        .slice(5)
        .replace(/-([a-z])/gu, (_, ch: string) => ch.toUpperCase());
      return this.dataset[camelKey] ?? this.attrs[name] ?? null;
    }
    return this.attrs[name] ?? null;
  }

  getAttributeNames(): string[] {
    return Object.keys(this.attrs);
  }

  removeAttribute(name: string): void {
    delete this.attrs[name];
  }

  // <canvas> 2D 컨텍스트는 흉내내지 않는다 — 호출부는 이미 null을 정상 처리하도록
  // 작성돼 있으므로(예: `if (!context) return;`), 여기선 그 계약만 지켜준다.
  getContext(): null {
    return null;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return;
    const listeners = this.listeners[type] ?? [];
    listeners.push(listener);
    this.listeners[type] = listeners;
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return;
    const listeners = this.listeners[type];
    if (!listeners) return;
    this.listeners[type] = listeners.filter((candidate) => candidate !== listener);
  }

  /** 테스트 편의: 이 요소에 해당 종류의 리스너가 붙었는지. */
  hasListener(type: string): boolean {
    return (this.listeners[type]?.length ?? 0) > 0;
  }


  dispatchEvent(event: Event): boolean {
    if (event.target === null) Object.defineProperty(event, "target", { configurable: true, value: this });
    Object.defineProperty(event, "currentTarget", { configurable: true, value: this });
    for (const listener of this.listeners[event.type] ?? []) {
      if (typeof listener === "function") {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
      // stopImmediatePropagation 호환: 같은 타겟 리스너 중단.
      if (eventPropagationStopped(event) === "immediate") break;
    }
    // stopPropagation / cancelBubble — 부모로 올리지 않는다(실행 내용 Delete 가 이벤트 삭제로 새는 버그 방지).
    if (event.bubbles && !eventPropagationStopped(event)) {
      if (this.parentElement) {
        this.parentElement.dispatchEvent(event);
      } else {
        // 루트 요소(body)에 도달 — 실제 브라우저처럼 document 레벨 리스너를 발화한다.
        // capture 단계는 흉내내지 않지만, document.addEventListener 로 등록된
        // 리스너(모달 스택 Escape 처리 등)가 버블 도착 시 정상 동작하도록 한다.
        const doc = globalThis.document as unknown as { dispatchEvent?: (event: Event) => boolean };
        doc.dispatchEvent?.(event);
      }
    }
    return !event.defaultPrevented;
  }

  click(): void {
    this.dispatchEvent(new Event("click"));
  }

  focus(_options?: FocusOptions): void {
    const doc = globalThis.document as unknown as { activeElement?: FakeElement | null };
    doc.activeElement = this;
  }

  blur(): void {
    const doc = globalThis.document as unknown as { activeElement?: FakeElement | null };
    if (doc.activeElement === this) doc.activeElement = null;
  }

  setSelectionRange(start: number | null, end: number | null): void {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  closest(selector: string): FakeElement | null {
    let current: FakeElement | null = this;
    while (current) {
      if (matchesSelector(current, selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = [];
    for (const part of selector.split(",").map((item) => item.trim()).filter(Boolean)) {
      const found: FakeElement[] = [];
      collectMatches(this, part, found);
      for (const element of found) {
        if (!matches.includes(element)) matches.push(element);
      }
    }
    return matches;
  }

  scrollTo(options?: ScrollToOptions | number, y?: number): void {
    if (typeof options === "number") {
      this.scrollLeft = options;
      this.scrollTop = y ?? 0;
      return;
    }
    if (options?.left !== undefined) this.scrollLeft = options.left;
    if (options?.top !== undefined) this.scrollTop = options.top;
  }

  scrollIntoView(): void {
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

type FakeStyle = Record<string, string> & {
  setProperty: (name: string, value: string) => void;
  removeProperty: (name: string) => void;
  getPropertyValue: (name: string) => string;
};

function createFakeStyle(): FakeStyle {
  const style = {} as FakeStyle;
  style.setProperty = (name: string, value: string): void => {
    style[name] = value;
  };
  style.removeProperty = (name: string): void => {
    delete style[name];
  };
  style.getPropertyValue = (name: string): string => style[name] ?? "";
  return style;
}

// installFakeDom()이 재설치될 때마다 새로 비운다 — 모듈 스코프에 두는 이유는 테스트가
// document 리스너 누수를 단언할 때(예: 모달 close()가 keydown 리스너를 제대로 정리했는지)
// documentListenerCount()로 바깥에서 조회할 수 있어야 하기 때문(fix(db) M11).
let documentListeners: Partial<Record<string, EventListenerOrEventListenerObject[]>> = {};

export function documentListenerCount(type: string): number {
  return documentListeners[type]?.length ?? 0;
}

export function flushFakeAnimationFrames(timestamp = 0, maxBatches = Number.POSITIVE_INFINITY): void {
  let batches = 0;
  while (animationFrames.size > 0 && batches < maxBatches) {
    batches += 1;
    if (batches > 1000) throw new Error("fake DOM animation frame queue did not settle");
    const frameIds = [...animationFrames.keys()];
    for (const frameId of frameIds) {
      const callback = animationFrames.get(frameId);
      animationFrames.delete(frameId);
      callback?.(timestamp);
    }
  }
}

export function installFakeDom(options: FakeDomOptions = {}): () => void {
  const body = new FakeElement("body");
  const previous = {
    document: globalThis.document,
    Node: globalThis.Node,
    HTMLElement: globalThis.HTMLElement,
    HTMLButtonElement: globalThis.HTMLButtonElement,
    HTMLInputElement: globalThis.HTMLInputElement,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    HTMLImageElement: globalThis.HTMLImageElement,
    Image: globalThis.Image,
    HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  } satisfies PreviousDomGlobals;
  animationFrames.clear();
  nextAnimationFrameId = 1;
  defineDomGlobal("Node", FakeNode);
  defineDomGlobal("HTMLElement", FakeElement);
  defineDomGlobal("HTMLButtonElement", FakeElement);
  // 몬스터/장비 뷰 등이 `instanceof HTMLInputElement`(또는 Image/Select/TextArea)로 타입을
  // 좁히는 패턴을 쓴다 — FakeElement가 그 전부를 흉내내므로 같은 클래스를 매핑해둔다.
  defineDomGlobal("HTMLInputElement", FakeElement);
  defineDomGlobal("HTMLSelectElement", FakeElement);
  defineDomGlobal("HTMLImageElement", FakeElement);
  // `new Image()` 는 프로덕션 코드(chromaKey.getAutoKeyedDataUrl 등)가 직접 쓰는 생성자다.
  // HTMLImageElement 만 매핑해두면 생성자 전역이 없어 ReferenceError 가 난다.
  defineDomGlobal("Image", FakeImage);
  defineDomGlobal("HTMLTextAreaElement", FakeElement);
  if (options.animationFrames === "manual") {
    defineDomGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
      const frameId = nextAnimationFrameId;
      nextAnimationFrameId += 1;
      animationFrames.set(frameId, callback);
      return frameId;
    });
    defineDomGlobal("cancelAnimationFrame", (frameId: number): void => {
      animationFrames.delete(frameId);
    });
  }
  // document 레벨 키다운/포인터다운 리스너(Escape·바깥 클릭 처리용)를 등록/해제/발화할 수 있도록
  // 최소 EventTarget 동작을 흉내낸다(FakeElement.addEventListener 와 동일한 패턴).
  documentListeners = {};
  defineDomGlobal("document", {
    activeElement: null,
    body,
    get children(): readonly FakeElement[] {
      return body.children;
    },
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
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject | null): void => {
      if (listener === null) return;
      const listeners = documentListeners[type] ?? [];
      listeners.push(listener);
      documentListeners[type] = listeners;
    },
    removeEventListener: (type: string, listener: EventListenerOrEventListenerObject | null): void => {
      if (listener === null) return;
      const listeners = documentListeners[type];
      if (!listeners) return;
      documentListeners[type] = listeners.filter((entry) => entry !== listener);
    },
    dispatchEvent: (event: Event): boolean => {
      if (event.target === null) Object.defineProperty(event, "target", { configurable: true, value: body });
      for (const listener of documentListeners[event.type] ?? []) {
        if (typeof listener === "function") listener(event);
        else listener.handleEvent(event);
      }
      return !event.defaultPrevented;
    },
  });
  return () => {
    animationFrames.clear();
    restoreDomGlobal("document", previous.document);
    restoreDomGlobal("Node", previous.Node);
    restoreDomGlobal("HTMLElement", previous.HTMLElement);
    restoreDomGlobal("HTMLButtonElement", previous.HTMLButtonElement);
    restoreDomGlobal("HTMLInputElement", previous.HTMLInputElement);
    restoreDomGlobal("HTMLSelectElement", previous.HTMLSelectElement);
    restoreDomGlobal("HTMLImageElement", previous.HTMLImageElement);
    restoreDomGlobal("Image", previous.Image);
    restoreDomGlobal("HTMLTextAreaElement", previous.HTMLTextAreaElement);
    restoreDomGlobal("requestAnimationFrame", previous.requestAnimationFrame);
    restoreDomGlobal("cancelAnimationFrame", previous.cancelAnimationFrame);
  };
}

/**
 * `new Image()` 대체물. 헤드리스에는 디코딩할 픽셀이 없으므로 src 할당 시
 * 비동기로 `error` 를 딱 한 번 발화한다 — 실제 브라우저에서 로드 실패한 것과 같은 경로다.
 * 호출부(chromaKey)는 load/error 양쪽에서 resolve 하므로 프라미스가 확실히 정착하고,
 * 아무 이벤트도 쏘지 않는 스텁처럼 무한 pending 이 되지 않는다.
 */
export class FakeImage extends FakeElement {
  readonly naturalWidth = 0;
  readonly naturalHeight = 0;
  readonly complete = false;
  private currentSrc = "";
  private errorDispatched = false;

  constructor() {
    super("img");
  }

  get src(): string {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
    if (this.errorDispatched) return;
    this.errorDispatched = true;
    // addEventListener 가 { once: true } 를 무시하므로 발화 횟수는 이쪽에서 보장한다.
    queueMicrotask(() => {
      this.dispatchEvent(new Event("error"));
    });
  }
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
  // data-* 속성 선택자 (camelCase dataset 키로 매핑).
  const dataAttr = simpleSelector.match(/^\[data-([a-z0-9-]+)=['"]?([^'"\]]*)['"]?\]$/iu);
  if (dataAttr) {
    const rawKey = dataAttr[1] ?? "";
    const expected = dataAttr[2] ?? "";
    const camelKey = rawKey.replace(/-([a-z])/gu, (_, ch: string) => ch.toUpperCase());
    return (element.dataset[camelKey] ?? element.attrs[`data-${rawKey}`] ?? null) === expected;
  }
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

function eventPropagationStopped(event: Event): false | "bubble" | "immediate" {
  const anyEvent = event as Event & {
    readonly cancelBubble?: boolean;
    readonly eventPhase?: number;
    readonly __stopImmediate?: boolean;
  };
  if (anyEvent.__stopImmediate) return "immediate";
  // DOM Event.stopPropagation sets cancelBubble = true.
  if (anyEvent.cancelBubble) return "bubble";
  return false;
}
