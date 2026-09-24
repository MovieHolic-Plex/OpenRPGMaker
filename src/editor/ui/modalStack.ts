import { closeTransientLayers } from "@/editor/ui/transientLayer";

/**
 * Layered modal ESC handling.
 * Newest registered modal wins: one Escape closes only the top layer.
 */

type ModalEntry = {
  readonly id: number;
  readonly element: Element;
  open: boolean;
  readonly close: () => void;
};

const stack: ModalEntry[] = [];
let nextId = 1;
// Track the document we registered on so that a document swap (e.g. fakeDom
// reinstall between tests) triggers re-registration instead of silently
// skipping because a stale `listening` boolean is still true.
let listeningDoc: Document | null = null;

function ensureListening(): void {
  if (typeof document === "undefined") return;
  if (listeningDoc === document) return;
  listeningDoc = document;
  // Capture phase so nested field handlers do not swallow Escape first.
  document.addEventListener("keydown", onDocumentKeyDown, true);
}

function onDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape") return;
  if (event.defaultPrevented) return;
  pruneDetached();
  const top = stack[stack.length - 1];
  if (!top) return;
  event.preventDefault();
  event.stopPropagation();
  top.close();
}

function pruneDetached(): void {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const entry = stack[index];
    if (!entry) continue;
    if (entry.open && isElementAttached(entry.element)) continue;
    stack.splice(index, 1);
  }
}

function isElementAttached(element: Element): boolean {
  if (typeof document === "undefined") return false;
  // Prefer contains when available; fakeDom may only expose body.append/remove.
  if (typeof document.contains === "function") return document.contains(element);
  let node: Node | null = element;
  while (node) {
    if (node === document || node === document.body || node === document.documentElement) return true;
    node = node.parentNode;
  }
  return false;
}

/**
 * Register a modal layer. Returns close() used for Escape / Cancel.
 * Prefer the same close() for X / backdrop so the stack stays consistent.
 * If the UI closes via a different path (e.g. Confirm with saved=true), call
 * unregisterModal(element) before removing the node.
 */
export function registerModal(element: Element, closeUi: () => void): () => void {
  ensureListening();
  // 모달이 뜨면 떠 있던 메뉴·팝오버는 치운다 — 남겨 두면 모달 위·아래에서 입력을 가린다.
  closeTransientLayers();
  const id = nextId++;
  const entry: ModalEntry = {
    id,
    element,
    open: true,
    close: () => {
      if (!entry.open) return;
      entry.open = false;
      const index = stack.findIndex((item) => item.id === id);
      if (index >= 0) stack.splice(index, 1);
      closeUi();
    },
  };
  stack.push(entry);
  return entry.close;
}

/** Drop a layer without invoking its closeUi (when teardown already runs elsewhere). */
export function unregisterModal(element: Element): void {
  const index = stack.findIndex((entry) => entry.element === element);
  if (index < 0) return;
  const entry = stack[index];
  if (entry) entry.open = false;
  stack.splice(index, 1);
}

/**
 * Escape 를 소유한 중첩 계층이 살아 있는가.
 * 자체 document 리스너로 Escape 를 처리하는 하위 모달(데이터베이스 모달 등)이
 * "내 위에 창이 떠 있으면 손대지 않는다"를 판정하는 데 쓴다. 리스너 등록 순서에
 * 의존하지 않으므로 캡처/버블 순서와 무관하게 안전하다.
 */
export function hasOpenModalLayer(): boolean {
  pruneDetached();
  return stack.length > 0;
}

/** Whether this layer currently owns modal keyboard interaction. */
export function isTopModal(element: Element): boolean {
  pruneDetached();
  return stack[stack.length - 1]?.element === element;
}

/** Test helper: how many live modals are registered. */
export function modalStackDepthForTest(): number {
  pruneDetached();
  return stack.length;
}

/** Test helper: raw entry count, including stale detached entries that indicate teardown leaks. */
export function modalStackEntryCountForTest(): number {
  return stack.length;
}

/** Test helper: clear stack without invoking closeUi. */
export function resetModalStackForTest(): void {
  stack.length = 0;
  listeningDoc = null;
}
