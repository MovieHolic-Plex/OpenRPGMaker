import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { LOAD_REPAIR_KIND_LABEL, loadRepairSummary, type LoadRepairReport } from "@/project/loadRepairReport";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export function announceLoadRepairs(report: LoadRepairReport | null): void {
  if (!report || report.total === 0) return;
  toast(loadRepairSummary(report), {
    kind: "info",
    durationMs: 10000,
    action: { label: "자세히", testid: "load-repair-details", onClick: () => openLoadRepairDialog(report) },
  });
}

export function openLoadRepairDialog(report: LoadRepairReport): () => void {
  const opener = document.activeElement;
  const overlay = el("div", { class: "app-modal-overlay", dataset: { testid: "load-repair-dialog" } });
  const close = (): void => {
    unregisterModal(overlay);
    overlay.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };
  const rows = report.entries.map((entry) => el("li", {
    class: "load-repair-row",
    dataset: { code: entry.code, kind: entry.kind },
    children: [
      el("span", { class: `load-repair-kind is-${entry.kind}`, text: LOAD_REPAIR_KIND_LABEL[entry.kind] }),
      el("span", { class: "load-repair-label", text: entry.label }),
      el("span", { class: "load-repair-count", text: `${entry.count}건` }),
      ...(entry.where.length ? [el("code", { class: "load-repair-where", text: entry.where.join(", ") + (entry.count > entry.where.length ? " …" : "") })] : []),
    ],
  }));
  const done = el("button", {
    class: "app-modal-button is-confirm", text: "확인",
    attrs: { type: "button" }, dataset: { testid: "load-repair-close" }, on: { click: close },
  });
  const card = el("section", {
    class: "app-modal-card load-repair-card",
    attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": "load-repair-title" },
    children: [
      el("div", { class: "app-modal-title", text: `불러오면서 고친 것 ${report.total}건`, attrs: { id: "load-repair-title" } }),
      el("ul", { class: "load-repair-list", children: rows }),
      el("div", { class: "app-modal-actions", children: [done] }),
    ],
  });
  card.addEventListener("click", (event) => event.stopPropagation());
  overlay.append(card);
  overlay.addEventListener("click", close);
  document.body.append(overlay);
  registerModal(overlay, close);
  done.focus();
  return close;
}
