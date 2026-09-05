import { el } from "@/util/dom";

/** Shared, modeless inspector. The surrounding document keeps its own scroll. */
export function worldDocumentProperties(
  children: readonly HTMLElement[],
  open: boolean,
  onToggle: (open: boolean) => void,
): HTMLDetailsElement {
  const summary = el("summary", {
    text: "속성",
    dataset: { testid: "world-properties-toggle" },
  });
  const details = el("details", {
    class: "world-document-properties",
    attrs: { ...(open ? { open: "" } : {}), "aria-label": "문서 속성" },
    dataset: { testid: "world-document-properties" },
    children: [
      summary,
      el("div", { class: "world-properties-body", children }),
    ],
  });
  details.addEventListener("toggle", () => onToggle(details.open));
  details.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !details.open) return;
    event.preventDefault();
    event.stopPropagation();
    details.open = false;
    onToggle(false);
    summary.focus();
  });
  return details;
}
