import { clearChildren, el } from "@/util/dom";
import { registerModal } from "@/editor/ui/modalStack";
import { installEventEditorCustomSelects } from "./customSelect";

type EventSubdialogOptions = {
  readonly title: string;
  readonly subtitle?: string;
  readonly testId: string;
  readonly width: "narrow" | "wide";
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
      text: "x",
      attrs: { type: "button", title: "Close" },
      on: { click: close },
    })
  );
  return header;
}

function focusFirstControl(root: HTMLElement): void {
  const first = root.querySelector("button, input, select, textarea");
  if (first instanceof HTMLElement) first.focus();
}
