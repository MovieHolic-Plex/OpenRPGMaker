import type { WorkItem } from "@/ai/workPlan";
import { el } from "@/util/dom";
import type { WorkPlanBookPage } from "./aiWorkPlanPages";

export type PlanBookSheetInput = {
  readonly active?: boolean;
  readonly activity?: string;
};

const STATUS_LABEL: Record<WorkItem["status"], string> = {
  pending: "대기",
  in_progress: "진행 중",
  done: "완료",
  skipped: "건너뜀",
  blocked: "막힘",
};

function assertNever(value: never): never {
  throw new Error(`unhandled work plan page: ${String(value)}`);
}

export function renderPlanBookSheet(
  page: WorkPlanBookPage,
  opts: {
    readonly current: boolean;
    readonly input: PlanBookSheetInput;
    readonly goTo: (index: number) => void;
  },
): HTMLElement {
  const sheet = el("section", {
    class: `ai-plan-book-sheet${opts.current ? " is-current" : ""}`,
    dataset: { testid: "ai-plan-book-sheet", kind: page.kind },
    attrs: { "aria-hidden": opts.current ? "false" : "true" },
  });
  if (page.kind === "cover") {
    sheet.append(
      el("p", {
        class: "ai-plan-book-progress",
        dataset: { testid: "ai-plan-book-progress" },
        text: page.total === 0 ? "항목 없음" : `${page.done}/${page.total} 완료`,
      }),
      ...(page.plannerNote ? [el("p", { class: "ai-plan-book-note", text: page.plannerNote })] : []),
      el("div", {
        class: "ai-plan-book-toc",
        dataset: { testid: "ai-plan-book-toc" },
        children: page.layers.map((layer, index) =>
          el("button", {
            class: `ai-plan-book-toc-row${layer.current ? " is-current" : ""}`,
            attrs: { type: "button" },
            dataset: { testid: "ai-plan-book-toc-row", layerId: layer.id },
            on: { click: () => opts.goTo(index + 1) },
            children: [
              el("span", { class: "ai-plan-book-toc-title", text: layer.title }),
              el("span", { class: "ai-plan-book-toc-meta", text: `${layer.done}/${layer.total}` }),
            ],
          }),
        ),
      }),
    );
    return sheet;
  }
  if (page.kind === "layer") {
    sheet.append(
      el("p", {
        class: "ai-plan-book-layer-kicker",
        text: `레이어 ${page.layerIndex + 1} / ${page.layerCount}`,
      }),
      el("h3", { class: "ai-plan-book-layer-title", text: page.title }),
      el("div", {
        class: "ai-plan-book-layer",
        dataset: {
          testid: "ai-autonomous-layer",
          layerId: page.id,
          current: String(page.current),
        },
        children: page.items.map((item) => renderPlanBookItem(item, opts.input)),
      }),
    );
    return sheet;
  }
  return assertNever(page);
}

export function renderPlanBookDot(
  page: WorkPlanBookPage,
  index: number,
  currentIndex: number,
  goTo: (index: number) => void,
): HTMLElement {
  return el("button", {
    class: `ai-plan-book-dot${index === currentIndex ? " is-current" : ""}`,
    attrs: {
      type: "button",
      "aria-label": page.kind === "cover" ? "표지" : page.title,
      "aria-current": index === currentIndex ? "page" : "false",
    },
    dataset: { testid: "ai-plan-book-dot", page: String(index) },
    on: { click: () => goTo(index) },
  });
}

function renderPlanBookItem(item: WorkItem, input: PlanBookSheetInput): HTMLElement {
  const status = item.status ?? "pending";
  const running = input.active !== false && status === "in_progress";
  const instruction = (item.instruction ?? "").trim();
  const doneWhen = (item.doneWhen ?? "").trim();
  const activity = input.activity?.trim() ?? "";
  return el("article", {
    class: `ai-plan-book-item is-${status}`,
    dataset: { testid: "ai-autonomous-item", itemId: item.id ?? "", status },
    attrs: { "aria-label": `${STATUS_LABEL[status] ?? status}: ${item.title ?? ""}` },
    children: [
      el("div", {
        class: "ai-plan-book-item-head",
        children: [
          el("span", { class: `ai-plan-book-pill is-${status}`, text: STATUS_LABEL[status] ?? status }),
          el("h4", {
            class: "ai-plan-book-item-title",
            text: (item.title ?? "").trim() || "(제목 없음)",
          }),
        ],
      }),
      ...(instruction ? [el("p", { class: "ai-plan-book-item-instruction", text: instruction })] : []),
      ...(doneWhen ? [el("p", { class: "ai-plan-book-item-done", text: `완료 조건 · ${doneWhen}` })] : []),
      ...(running
        ? [
            el("p", {
              class: "ai-plan-book-item-note",
              dataset: { testid: "ai-work-item-activity" },
              text: activity.length > 0 ? activity : "진행 중…",
            }),
          ]
        : []),
    ],
  });
}
