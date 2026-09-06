import { clearChildren, el } from "@/util/dom";
import { renderEditorIcon } from "./editorIcons";
import { registerModal } from "@/editor/ui/modalStack";
import { installEventEditorCustomSelects } from "./customSelect";

type EventSubdialogOptions = {
  readonly title: string;
  readonly onClose?: () => void;
  readonly subtitle?: string;
  readonly testId: string;
  // full = 상점처럼 표가 넓은 특수 명령용 전체화면. narrow/wide 는 기존 폭 고정 창.
  readonly width: "narrow" | "wide" | "full";
  readonly render: (body: HTMLElement, close: () => void) => void;
};

export function openEventSubdialog(options: EventSubdialogOptions): void {
  const returnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const returnFocusAncestors: HTMLElement[] = [];
  let ancestor = returnFocus?.parentElement ?? null;
  while (ancestor && ancestor !== document.body) {
    returnFocusAncestors.push(ancestor);
    ancestor = ancestor.parentElement;
  }
  const activeScope = returnFocus?.closest<HTMLElement>('[role="dialog"]') ?? null;
  const returnFocusScopes = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"]'),
  ).reverse();
  if (activeScope) {
    const activeScopeIndex = returnFocusScopes.indexOf(activeScope);
    if (activeScopeIndex >= 0) returnFocusScopes.splice(activeScopeIndex, 1);
    returnFocusScopes.unshift(activeScope);
  }
  const backdrop = el("div", {
    class: "event-subdialog-backdrop",
    dataset: { testid: options.testId },
  });
  const windowEl = el("section", {
    class: `event-subdialog-window ${options.width}`,
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": options.title },
  });
  const body = el("div", { class: "event-subdialog-body" });
  let disposeCustomSelects = (): void => undefined;
  const close = registerModal(backdrop, () => {
    options.onClose?.();
    disposeCustomSelects();
    backdrop.remove();
    if (returnFocus && document.body.contains(returnFocus) && returnFocus.getAttribute("disabled") === null) {
      returnFocus.focus({ preventScroll: true });
      return;
    }
    const scope = returnFocusAncestors.find((candidate) => document.body.contains(candidate))
      ?? returnFocusScopes.find((candidate) => document.body.contains(candidate));
    if (!scope) return;
    const fallback = ["button", "input", "select", "textarea", "[tabindex]"]
      .map((selector) => scope.querySelector<HTMLElement>(selector))
      .find((candidate) => candidate?.getAttribute("disabled") === null);
    if (fallback) {
      fallback.focus({ preventScroll: true });
      return;
    }
    if (scope.getAttribute("tabindex") === null) scope.setAttribute("tabindex", "-1");
    scope.focus({ preventScroll: true });
  });

  windowEl.append(renderHeader(options, close), body);
  backdrop.append(windowEl);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  windowEl.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = focusableControls(windowEl);
    if (controls.length === 0) return;
    const first = controls[0]!;
    const last = controls[controls.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  });

  document.body.append(backdrop);
  clearChildren(body);
  options.render(body, close);
  const customSelects = installEventEditorCustomSelects(backdrop);
  disposeCustomSelects = customSelects.dispose;
  customSelects.refresh();
  if (!backdrop.contains(document.activeElement)) focusFirstControl(backdrop);
}

function renderHeader(options: EventSubdialogOptions, close: () => void): HTMLElement {
  const header = el("div", { class: "event-subdialog-header" });
  const copy = el("div", {});
  copy.append(el("h3", { text: options.title }));
  if (options.subtitle) copy.append(el("p", { text: options.subtitle }));
  header.append(
    copy,
    el("button", {
      class: "btn event-subdialog-close",
      children: [renderEditorIcon("close")],
      attrs: { type: "button", title: "닫기", "aria-label": "닫기" },
      on: { click: close },
    })
  );
  return header;
}

function focusFirstControl(root: HTMLElement): void {
  const first = root.querySelector("button, input, select, textarea");
  if (first instanceof HTMLElement) first.focus();
}

function focusableControls(root: HTMLElement): HTMLElement[] {
  const controls: HTMLElement[] = [];
  const visit = (parent: HTMLElement): void => {
    for (const child of Array.from(parent.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.hidden || child.getAttribute("aria-hidden") === "true" || child.classList.contains("is-hidden")) continue;
      if (typeof getComputedStyle === "function" && getComputedStyle(child).display === "none") continue;
      const isControl = ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(child.tagName)
        || child.getAttribute("tabindex") !== null;
      const disabled = "disabled" in child && child.disabled === true;
      if (isControl && !disabled && child.getAttribute("tabindex") !== "-1") controls.push(child);
      visit(child);
    }
  };
  visit(root);
  return controls;
}
