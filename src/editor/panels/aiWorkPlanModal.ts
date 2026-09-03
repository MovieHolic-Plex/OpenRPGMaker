// editor/panels/aiWorkPlanModal.ts
// 작업 계획 책 모달 — 표지 + 레이어 페이지. app-modal 스택에 올라가는 커스텀 오버레이.

import type { WorkPlan } from "@/ai/workPlan";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { el } from "@/util/dom";
import { renderPlanBookDot, renderPlanBookSheet } from "./aiWorkPlanBookDom";
import { workPlanBookPages } from "./aiWorkPlanPages";

export type WorkPlanBookInput = {
  readonly plan: WorkPlan;
  readonly active?: boolean;
  readonly activity?: string;
  readonly onStop?: () => void;
  readonly onClose?: () => void;
};

type BookChrome = {
  overlay: HTMLElement;
  title: HTMLElement;
  stage: HTMLElement;
  pager: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  dots: HTMLElement;
  pageIndex: number;
  input: WorkPlanBookInput;
};

let book: BookChrome | null = null;

function domAvailable(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof document.createElement === "function" &&
    Boolean(document.body)
  );
}

function overlayAttached(overlay: HTMLElement): boolean {
  let node: Node | null = overlay;
  while (node) {
    if (node === document.body || node === document) return true;
    node = node.parentNode;
  }
  return false;
}

export function closeWorkPlanBook(): void {
  tearDown(false);
}

export function workPlanBookIsOpen(): boolean {
  return Boolean(book && overlayAttached(book.overlay));
}

export function openWorkPlanBook(input: WorkPlanBookInput): HTMLElement | null {
  if (!domAvailable()) return null;
  if (book && overlayAttached(book.overlay)) {
    book.input = input;
    paintBook(book);
    return book.overlay;
  }
  book = mountBook(input);
  return book.overlay;
}

export function updateWorkPlanBook(input: WorkPlanBookInput): void {
  if (!book || !overlayAttached(book.overlay)) {
    book = null;
    return;
  }
  book.input = input;
  paintBook(book);
}

function tearDown(notify: boolean): void {
  if (!book) return;
  const current = book;
  book = null;
  unregisterModal(current.overlay);
  current.overlay.remove();
  if (notify) current.input.onClose?.();
}

function mountBook(input: WorkPlanBookInput): BookChrome {
  const pager = el("span", {
    class: "ai-plan-book-count",
    dataset: { testid: "ai-plan-book-count" },
  });
  const title = el("h2", {
    class: "ai-plan-book-title",
    attrs: { id: "ai-plan-book-title" },
    dataset: { testid: "ai-plan-book-title" },
  });
  const stage = el("div", {
    class: "ai-plan-book-stage",
    dataset: { testid: "ai-plan-book-stage" },
  });
  const dots = el("div", {
    class: "ai-plan-book-dots",
    dataset: { testid: "ai-plan-book-dots" },
    attrs: { role: "tablist", "aria-label": "계획 페이지" },
  });
  const prev = el("button", {
    class: "ai-plan-book-nav",
    text: "이전",
    attrs: { type: "button" },
    dataset: { testid: "ai-plan-book-prev" },
  });
  const next = el("button", {
    class: "ai-plan-book-nav",
    text: "다음",
    attrs: { type: "button" },
    dataset: { testid: "ai-plan-book-next" },
  });
  const closeBtn = el("button", {
    class: "ai-plan-book-close",
    text: "닫기",
    attrs: { type: "button", "aria-label": "계획 닫기" },
    dataset: { testid: "ai-plan-book-close" },
  });
  const card = el("article", {
    class: "ai-plan-book",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "ai-plan-book-title",
      tabindex: "-1",
    },
    dataset: { testid: "ai-plan-book" },
    children: [
      el("header", {
        class: "ai-plan-book-head",
        children: [
          el("div", {
            class: "ai-plan-book-titles",
            children: [
              el("p", { class: "ai-plan-book-kicker", text: "작업 계획" }),
              title,
              pager,
            ],
          }),
          closeBtn,
        ],
      }),
      stage,
      el("footer", {
        class: "ai-plan-book-foot",
        children: [prev, dots, next],
      }),
    ],
  });
  const overlay = el("div", {
    class: "ai-plan-book-overlay",
    dataset: { testid: "ai-plan-book-overlay" },
    children: [card],
  });
  const chrome: BookChrome = {
    overlay,
    title,
    stage,
    pager,
    prev,
    next,
    dots,
    pageIndex: 0,
    input,
  };
  const userClose = (): void => tearDown(true);
  closeBtn.addEventListener("click", userClose);
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) userClose();
  });
  card.addEventListener("mousedown", (event) => event.stopPropagation());
  prev.addEventListener("click", () => goTo(chrome, chrome.pageIndex - 1));
  next.addEventListener("click", () => goTo(chrome, chrome.pageIndex + 1));
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(chrome, chrome.pageIndex - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(chrome, chrome.pageIndex + 1);
    }
  });
  document.body.append(overlay);
  registerModal(overlay, userClose);
  paintBook(chrome);
  card.focus();
  return chrome;
}

function goTo(chrome: BookChrome, index: number): void {
  const last = workPlanBookPages(chrome.input.plan).length - 1;
  if (last < 0) return;
  chrome.pageIndex = Math.max(0, Math.min(index, last));
  paintBook(chrome);
}

function paintBook(chrome: BookChrome): void {
  const pages = workPlanBookPages(chrome.input.plan);
  chrome.title.textContent = (chrome.input.plan.goal ?? "").trim() || "작업 계획";
  if (pages.length === 0) {
    chrome.pageIndex = 0;
    chrome.stage.replaceChildren();
    chrome.pager.textContent = "0 / 0";
    chrome.dots.replaceChildren();
    chrome.prev.disabled = true;
    chrome.next.disabled = true;
    return;
  }
  chrome.pageIndex = Math.max(0, Math.min(chrome.pageIndex, pages.length - 1));
  chrome.pager.textContent = `${chrome.pageIndex + 1} / ${pages.length}`;
  chrome.prev.disabled = chrome.pageIndex === 0;
  chrome.next.disabled = chrome.pageIndex === pages.length - 1;
  chrome.stage.replaceChildren(
    ...pages.map((page, index) =>
      renderPlanBookSheet(page, {
        current: index === chrome.pageIndex,
        input: chrome.input,
        goTo: (target) => goTo(chrome, target),
      }),
    ),
  );
  chrome.dots.replaceChildren(
    ...pages.map((page, index) =>
      renderPlanBookDot(page, index, chrome.pageIndex, (target) => goTo(chrome, target)),
    ),
  );
}
