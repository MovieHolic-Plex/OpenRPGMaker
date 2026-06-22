import { clearChildren, el } from "@/util/dom";

type EventSubdialogOptions = {
  readonly title: string;
  readonly subtitle?: string;
  readonly testId: string;
  readonly width: "narrow" | "wide";
  readonly render: (body: HTMLElement, close: () => void) => void;
};

export function openEventSubdialog(options: EventSubdialogOptions): void {
  const backdrop = el("div", {
    class: "event-subdialog-backdrop",
    dataset: { testid: options.testId },
  });
  const windowEl = el("section", {
    class: `event-subdialog-window ${options.width}`,
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": options.title },
  });
  const body = el("div", { class: "event-subdialog-body" });
  const close = () => backdrop.remove();

  windowEl.append(renderHeader(options, close), body);
  backdrop.append(windowEl);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  document.body.append(backdrop);
  clearChildren(body);
  options.render(body, close);
  focusFirstControl(backdrop);
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
