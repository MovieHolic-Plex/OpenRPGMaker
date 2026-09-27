type DomGlobalName =
  | "document"
  | "Node"
  | "Element"
  | "MutationObserver"
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
  readonly Element: typeof Element | undefined;
  readonly MutationObserver: typeof MutationObserver | undefined;
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


  /** True while attached under document.body (or any parent chain). */
  get isConnected(): boolean {
    let node: FakeNode | null = this;
    const body = (globalThis.document as unknown as { body?: FakeNode }).body;
    while (node) {
      if (body && node === body) return true;
      if (node.parentNode === null) return false;
      node = node.parentNode;
    }
    return false;
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
    if (this instanceof FakeElement) {
      this.replaceChildren(...(value ? [value] : []));
      return;
    }
    const oldValue = this.ownText;
    this.ownText = value;
    this.childNodes.length = 0;
    notifyValueMutation(this, "characterData", null, oldValue);
  }

  append(...children: (FakeNode | string)[]): void {
    const nodes = convertFakeNodes(children);
    const previousSibling = this.childNodes.at(-1) ?? null;
    for (const node of nodes) {
      node.parentNode = this;
      this.childNodes.push(node);
    }
    notifyChildList(this, nodes, [], previousSibling, null);
    this.childrenChanged(nodes.at(-1));
  }

  removeChild(child: FakeNode): FakeNode {
    const index = this.childNodes.indexOf(child);
    if (index < 0) throw new DOMException("Node is not a child", "NotFoundError");
    const previousSibling = this.childNodes[index - 1] ?? null;
    const nextSibling = this.childNodes[index + 1] ?? null;
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    notifyChildList(this, [], [child], previousSibling, nextSibling);
    this.childrenChanged();
    return child;
  }

  insertBefore(child: FakeNode, reference: FakeNode | null): FakeNode {
    if (reference !== null && reference.parentNode !== this) throw new DOMException("Reference is not a child", "NotFoundError");
    if (child === reference) return child;
    child.remove();
    const index = reference === null ? this.childNodes.length : this.childNodes.indexOf(reference);
    this.childNodes.splice(index, 0, child);
    child.parentNode = this;
    notifyChildList(this, [child], [], this.childNodes[index - 1] ?? null, reference);
    this.childrenChanged(child);
    return child;
  }

  remove(): void {
    this.parentNode?.removeChild(this);
    this.parentNode = null;
  }

  replaceWith(...nodes: FakeNode[]): void {
    const parent = this.parentNode;
    if (!parent) return;
    const reference = parent.childNodes.slice(parent.childNodes.indexOf(this) + 1)
      .find((node) => !nodes.includes(node)) ?? null;
    const adopted = convertFakeNodes(nodes);
    const replacing = this.parentNode === parent;
    const index = replacing ? parent.childNodes.indexOf(this)
      : reference === null ? parent.childNodes.length : parent.childNodes.indexOf(reference);
    if (replacing) this.parentNode = null;
    for (const node of adopted) node.parentNode = parent;
    parent.childNodes.splice(index, replacing ? 1 : 0, ...adopted);
    notifyChildList(parent, adopted, replacing ? [this] : [], parent.childNodes[index - 1] ?? null, parent.childNodes[index + adopted.length] ?? null);
    parent.childrenChanged(adopted.at(-1));
  }

  prepend(...children: FakeNode[]): void {
    const nodes = convertFakeNodes(children);
    const nextSibling = this.firstChild;
    for (const child of nodes.slice().reverse()) {
      child.parentNode = this;
      this.childNodes.unshift(child);
    }
    notifyChildList(this, nodes, [], null, nextSibling);
    this.childrenChanged(nodes.at(-1));
  }

  replaceChildren(...children: (FakeNode | string)[]): void {
    const nodes = convertFakeNodes(children);
    const removed = [...this.childNodes];
    this.ownText = "";
    for (const child of removed) child.parentNode = null;
    this.childNodes.length = 0;
    for (const node of nodes) node.parentNode = this;
    this.childNodes.push(...nodes);
    notifyChildList(this, nodes, removed, null, null);
    this.childrenChanged(nodes.at(-1));
  }

  protected childrenChanged(inserted?: FakeNode): void {
    this.parentNode?.childrenChanged(inserted);
  }

  contains(node: unknown): boolean {
    if (node === this) return true;
    return this.childNodes.some((child) => child.contains(node));
  }
}

function convertFakeNodes(children: readonly (FakeNode | string)[]): FakeNode[] {
  const nodes: FakeNode[] = [];
  for (const child of children) {
    const node = typeof child === "string" ? new FakeNode() : child;
    if (typeof child === "string") node.textContent = child;
    node.remove();
    const duplicate = nodes.indexOf(node);
    if (duplicate >= 0) nodes.splice(duplicate, 1);
    nodes.push(node);
  }
  return nodes;
}

// Mutation delivery follows a microtask checkpoint; values change through the
// fake DOM setters, while render-only media never claims successful playback.
const mutationObservers = new Set<FakeMutationObserver>();
type FakeMutationRecord = {
  readonly type: "childList" | "attributes" | "characterData";
  readonly target: FakeNode;
  readonly addedNodes: readonly FakeNode[];
  readonly removedNodes: readonly FakeNode[];
  readonly previousSibling: FakeNode | null;
  readonly nextSibling: FakeNode | null;
  readonly attributeName: string | null;
  readonly attributeNamespace: null;
  readonly oldValue: string | null;
};

class FakeMutationObserver {
  private readonly targets = new Map<FakeNode, MutationObserverInit>();
  private records: FakeMutationRecord[] = [];
  private queued = false;

  constructor(private readonly callback: (records: FakeMutationRecord[], observer: FakeMutationObserver) => void) {}

  observe(target: FakeNode | { readonly body: FakeNode }, options: MutationObserverInit): void {
    const normalized = { ...options,
      attributes: options.attributes ?? (options.attributeFilter !== undefined || options.attributeOldValue === true),
      characterData: options.characterData ?? options.characterDataOldValue === true,
    };
    if (!normalized.childList && !normalized.attributes && !normalized.characterData) throw new TypeError("No mutation type selected");
    const node = target instanceof FakeNode ? target : target.body;
    this.targets.set(node, normalized);
    mutationObservers.add(this);
  }

  disconnect(): void {
    this.targets.clear();
    this.records = [];
    mutationObservers.delete(this);
  }

  takeRecords(): FakeMutationRecord[] {
    const records = this.records;
    this.records = [];
    return records;
  }

  enqueue(target: FakeNode, record: FakeMutationRecord): void {
    const matching = [...this.targets].filter(([node, options]) => {
      if (node !== target && !(options.subtree && node.contains(target))) return false;
      switch (record.type) {
        case "childList": return options.childList;
        case "attributes": return options.attributes && (!options.attributeFilter || options.attributeFilter.includes(record.attributeName ?? ""));
        case "characterData": return options.characterData;
      }
    });
    if (matching.length === 0) return;
    const keepOld = matching.some(([, options]) => record.type === "attributes" ? options.attributeOldValue : options.characterDataOldValue);
    this.records.push({ ...record, oldValue: keepOld ? record.oldValue : null });
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      const records = this.takeRecords();
      if (records.length > 0) this.callback(records, this);
    });
  }
}

function notifyChildList(target: FakeNode, added: FakeNode[], removed: FakeNode[], previousSibling: FakeNode | null, nextSibling: FakeNode | null): void {
  if (added.length === 0 && removed.length === 0) return;
  const record: FakeMutationRecord = {
    type: "childList", target, addedNodes: [...added], removedNodes: [...removed],
    previousSibling, nextSibling, attributeName: null, attributeNamespace: null, oldValue: null,
  };
  for (const observer of mutationObservers) observer.enqueue(target, record);
}

function notifyValueMutation(target: FakeNode, type: "attributes" | "characterData", attributeName: string | null, oldValue: string | null): void {
  const record: FakeMutationRecord = { type, target, attributeName, oldValue,
    addedNodes: [], removedNodes: [], previousSibling: null, nextSibling: null, attributeNamespace: null };
  for (const observer of mutationObservers) observer.enqueue(target, record);
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
  private inputValue = "";
  private optionSelected = false;
  /** Number-input conversion, including HTML's rejection of blank/hex/nonfinite values. */
  get valueAsNumber(): number {
    if (this.tagName !== "INPUT" || (this.getAttribute("type") ?? this.type) !== "number") return NaN;
    if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(this.value)) return NaN;
    const value = Number(this.value);
    return Number.isFinite(value) ? value : NaN;
  }

  /** Numeric constraint validation; native validation bubbles are not rendered by this DOM. */
  checkValidity(): boolean {
    if (this.disabled || this.getAttribute("disabled") !== null || this.getAttribute("readonly") !== null) return true;
    const value = this.valueAsNumber;
    let valid = true;
    if (Number.isNaN(value)) {
      valid = this.getAttribute("required") === null;
    } else {
      const numberAttribute = (name: string, fallback: string): number | undefined => {
        const raw = this.getAttribute(name) ?? fallback;
        return raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
      };
      const min = numberAttribute("min", this.min);
      const max = numberAttribute("max", this.max);
      const stepAttribute = this.getAttribute("step");
      const step = numberAttribute("step", "1");
      const unit = step !== undefined && step > 0 ? step : 1;
      const base = min ?? numberAttribute("value", "") ?? 0;
      const steps = (value - base) / unit;
      valid = (min === undefined || value >= min) && (max === undefined || value <= max)
        && (stepAttribute === "any" || Math.abs(steps - Math.round(steps)) < 1e-8);
    }
    if (!valid) this.dispatchEvent(new Event("invalid", { cancelable: true }));
    return valid;
  }

  reportValidity(): boolean {
    return this.checkValidity();
  }
  isContentEditable = false;
  readonly attrs: Record<string, string> = {};
  tagName: string;
  /** HTMLElement 호환 — 제안 모달 open()이 빈 host 가드에 사용. */
  get childElementCount(): number {
    return this.childNodes.filter((child) => child instanceof FakeElement).length;
  }
  get children(): FakeElement[] {
    return this.childNodes.filter((child): child is FakeElement => child instanceof FakeElement);
  }
  get options(): FakeElement[] {
    if (this.tagName !== "SELECT") return [];
    return this.children.flatMap((child) => child.tagName === "OPTION" ? [child]
      : child.tagName === "OPTGROUP" ? child.children.filter((option) => option.tagName === "OPTION") : []);
  }
  get selectedOptions(): FakeElement[] {
    return this.options.filter((option) => option.optionSelected);
  }
  get selectedIndex(): number {
    return this.options.findIndex((option) => option.optionSelected);
  }
  set selectedIndex(index: number) {
    this.options.forEach((option, optionIndex) => { option.optionSelected = optionIndex === index; });
  }
  get value(): string {
    if (this.tagName === "SELECT") return this.options[this.selectedIndex]?.value ?? "";
    if (this.tagName === "OPTION") return this.attrs.value ?? this.optionText;
    return this.inputValue;
  }
  set value(value: string) {
    if (this.tagName === "SELECT") this.selectedIndex = this.options.findIndex((option) => option.value === value);
    else if (this.tagName === "OPTION") this.attrs.value = value;
    else this.inputValue = value;
  }
  private get optionText(): string {
    return this.textContent.replace(/[\t\n\f\r ]+/gu, " ").trim();
  }
  get label(): string {
    return this.attrs.label ?? (this.tagName === "OPTION" ? this.optionText : "");
  }
  set label(value: string) {
    this.attrs.label = value;
  }
  private get owningSelect(): FakeElement | null {
    const parent = this.parentElement?.tagName === "OPTGROUP" ? this.parentElement.parentElement : this.parentElement;
    return parent?.tagName === "SELECT" ? parent : null;
  }
  get index(): number {
    return this.owningSelect?.options.indexOf(this) ?? 0;
  }
  get selected(): boolean {
    return this.optionSelected;
  }
  set selected(value: boolean) {
    this.optionSelected = value;
    const select = this.owningSelect;
    if (value && select) select.selectedIndex = this.index;
    else select?.childrenChanged();
  }
  protected override childrenChanged(inserted?: FakeNode): void {
    if (this.tagName !== "SELECT") {
      super.childrenChanged(inserted);
      return;
    }
    const options = this.options;
    // A selected option being adopted wins over the old single-select default.
    const selected = options.findLast((option) => option.optionSelected && inserted?.contains(option))
      ?? options.findLast((option) => option.optionSelected)
      ?? options.find((option) => !option.disabled && option.getAttribute("disabled") === null
        && !(option.parentElement?.tagName === "OPTGROUP"
          && (option.parentElement.disabled || option.parentElement.getAttribute("disabled") !== null)));
    this.selectedIndex = selected ? options.indexOf(selected) : -1;
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
    const oldValue = this.getAttribute(name);
    this.attrs[name] = value;
    // HTMLOptionElement / input 호환: attribute value 는 .value 프로퍼티와 동기화.
    if (name === "value") this.value = value;
    if (name === "selected" && this.tagName === "OPTION") this.selected = true;
    if (name.startsWith("data-")) {
      const camelKey = name
        .slice(5)
        .replace(/-([a-z])/gu, (_, ch: string) => ch.toUpperCase());
      this.dataset[camelKey] = value;
    }
    notifyValueMutation(this, "attributes", name, oldValue);
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
    const oldValue = this.getAttribute(name);
    delete this.attrs[name];
    if (name === "selected" && this.tagName === "OPTION") this.selected = false;
    if (name.startsWith("data-")) delete this.dataset[name.slice(5).replace(/-([a-z])/gu, (_, ch: string) => ch.toUpperCase())];
    if (oldValue !== null) notifyValueMutation(this, "attributes", name, oldValue);
  }

  // <canvas> 2D 컨텍스트는 흉내내지 않는다 — 호출부는 이미 null을 정상 처리하도록
  // 작성돼 있으므로(예: `if (!context) return;`), 여기선 그 계약만 지켜준다.
  getContext(): null {
    return null;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (listener === null) return;
    const signal = typeof options === "object" && options ? options.signal : undefined;
    if (signal?.aborted) return;
    const listeners = this.listeners[type] ?? [];
    listeners.push(listener);
    this.listeners[type] = listeners;
    // Real DOM removes the listener when AbortSignal aborts; tests need the same for cursor dispose.
    signal?.addEventListener("abort", () => this.removeEventListener(type, listener), { once: true });
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

  /** <input>.select() — 값 전체 선택. 텍스트 렌더가 없으니 범위만 남긴다. */
  select(): void {
    this.setSelectionRange(0, this.value.length);
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

// Tests also construct FakeElement("select") directly; identity follows the tag.
class FakeSelectElement extends FakeElement {
  constructor() { super("select"); }
  static [Symbol.hasInstance](value: unknown): boolean {
    return value instanceof FakeElement && value.tagName === "SELECT";
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
    Element: globalThis.Element,
    MutationObserver: globalThis.MutationObserver,
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
  for (const observer of mutationObservers) observer.disconnect();
  nextAnimationFrameId = 1;
  defineDomGlobal("Node", FakeNode);
  defineDomGlobal("Element", FakeElement);
  defineDomGlobal("MutationObserver", FakeMutationObserver);
  defineDomGlobal("HTMLElement", FakeElement);
  defineDomGlobal("HTMLButtonElement", FakeElement);
  // Inputs/images/textareas retain their shared fake; select identity is tag-specific.
  defineDomGlobal("HTMLInputElement", FakeElement);
  defineDomGlobal("HTMLSelectElement", FakeSelectElement);
  defineDomGlobal("HTMLImageElement", FakeElement);
  // `new Image()` 는 프로덕션 코드(chromaKey.getAutoKeyedDataUrl 등)가 직접 쓰는 생성자다.
  // HTMLImageElement 만 매핑해두면 생성자 전역이 없어 ReferenceError 가 난다.
  defineDomGlobal("Image", FakeImage);
  defineDomGlobal("HTMLTextAreaElement", FakeElement);
  // Manual frames are opt-in: do not activate optional animation paths in
  // existing render tests merely to support cancelling an idle audio preview.
  if (options.animationFrames === "manual") {
    defineDomGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
      const frameId = nextAnimationFrameId;
      nextAnimationFrameId += 1;
      animationFrames.set(frameId, callback);
      return frameId;
    });
  }
  if (options.animationFrames === "manual" || !previous.cancelAnimationFrame) {
    defineDomGlobal("cancelAnimationFrame", (frameId: number): void => {
      animationFrames.delete(frameId);
    });
  }
  // document 레벨 키다운/포인터다운 리스너(Escape·바깥 클릭 처리용)를 등록/해제/발화할 수 있도록
  // 최소 EventTarget 동작을 흉내낸다(FakeElement.addEventListener 와 동일한 패턴).
  documentListeners = {};
  // 루트 요소 — 프로덕션 코드가 document.documentElement.dataset 에 전역 표시 상태를 쓴다
  // (aiPanelLayout.applyAiRenderWeight). 없으면 설정 폼 렌더가 TypeError 로 멈춘다.
  const documentElement = new FakeElement("html");
  defineDomGlobal("document", {
    activeElement: null,
    body,
    documentElement,
    get children(): readonly FakeElement[] {
      return body.children;
    },
    createElement: (tagName: string) => tagName.toLowerCase() === "audio" ? new FakeAudio() : new FakeElement(tagName),
    // SVG 아이콘(makeSvgIcon)이 createElementNS를 쓴다 — 네임스페이스는 무시하고 일반 요소로 위임.
    createElementNS: (_ns: string, tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => {
      const node = new FakeNode();
      node.textContent = text;
      return node;
    },
    querySelector: (selector: string) => body.querySelector(selector),
    querySelectorAll: (selector: string) => body.querySelectorAll(selector),
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void => {
      if (listener === null) return;
      const signal = typeof options === "object" && options ? options.signal : undefined;
      if (signal?.aborted) return;
      const listeners = documentListeners[type] ?? [];
      listeners.push(listener);
      documentListeners[type] = listeners;
      signal?.addEventListener("abort", () => {
        const current = documentListeners[type];
        if (!current) return;
        documentListeners[type] = current.filter((entry) => entry !== listener);
      }, { once: true });
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
    for (const observer of mutationObservers) observer.disconnect();
    restoreDomGlobal("document", previous.document);
    restoreDomGlobal("Node", previous.Node);
    restoreDomGlobal("Element", previous.Element);
    restoreDomGlobal("MutationObserver", previous.MutationObserver);
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

// Idle media lifecycle only. Acoustic playback belongs to the media event harness,
// not render tests; no loaded/playing events or successful play promises are faked.
class FakeAudio extends FakeElement {
  readonly paused = true;
  readonly duration = Number.NaN;
  currentTime = 0;

  constructor() { super("audio"); }

  pause(): void {}

  load(): void { this.currentTime = 0; }
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
  const dataPresence = simpleSelector.match(/^\[data-([a-z0-9-]+)\]$/iu)?.[1];
  if (dataPresence) {
    const key = dataPresence.replace(/-([a-z])/gu, (_, ch: string) => ch.toUpperCase());
    return key in element.dataset || `data-${dataPresence}` in element.attrs;
  }
  if (simpleSelector.startsWith('[') && !simpleSelector.startsWith('[data-')) {
    const generic = simpleSelector.match(/^\[([a-zA-Z-]+)=['"]?([^'"\]]+)['"]?\]$/u);
    if (generic) return (element.getAttribute(generic[1] ?? '') ?? null) === (generic[2] ?? '');
    const presence = simpleSelector.match(/^\[([a-zA-Z-]+)\]$/u);
    if (presence) return element.getAttribute(presence[1] ?? '') !== null;
  }
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
