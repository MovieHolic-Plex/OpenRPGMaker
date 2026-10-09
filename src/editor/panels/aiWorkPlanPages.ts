// editor/panels/aiWorkPlanPages.ts
// WorkPlan → 책 페이지. 표지(목표·목차) 한 장 + 레이어마다 한 장.
// 렌더/모달은 이 배열만 본다. 망가진 페이로드도 빈 배열이 아니라 표지라도 남긴다.

import type { WorkItem, WorkLayer, WorkPlan } from "@/ai/workPlan";

export type WorkPlanBookLayerSummary = {
  readonly id: string;
  readonly title: string;
  readonly done: number;
  readonly total: number;
  readonly current: boolean;
};

export type WorkPlanBookCoverPage = {
  readonly kind: "cover";
  readonly goal: string;
  readonly plannerNote: string;
  readonly done: number;
  readonly total: number;
  readonly layers: readonly WorkPlanBookLayerSummary[];
};

export type WorkPlanBookLayerPage = {
  readonly kind: "layer";
  readonly layerIndex: number;
  readonly layerCount: number;
  readonly id: string;
  readonly title: string;
  readonly current: boolean;
  readonly items: readonly WorkItem[];
};

export type WorkPlanBookPage = WorkPlanBookCoverPage | WorkPlanBookLayerPage;

export function planLayers(plan: WorkPlan): WorkLayer[] {
  return Array.isArray(plan.layers) ? plan.layers : [];
}

export function layerItems(layer: WorkLayer): WorkItem[] {
  return Array.isArray(layer.items) ? layer.items : [];
}

export function isItemFinished(item: WorkItem): boolean {
  return item.status === "done" || item.status === "skipped";
}

export function workPlanBookPages(plan: WorkPlan): readonly WorkPlanBookPage[] {
  const layers = planLayers(plan);
  const items = layers.flatMap(layerItems);
  const currentLayerIndex = Number.isFinite(plan.currentLayerIndex) ? plan.currentLayerIndex : 0;
  const summaries: WorkPlanBookLayerSummary[] = layers.map((layer, index) => {
    const list = layerItems(layer);
    const unfinished = list.some((item) => item.status === "pending" || item.status === "in_progress");
    return {
      id: layer.id ?? `L${index + 1}`,
      title: (layer.title ?? "").trim() || `레이어 ${index + 1}`,
      done: list.filter(isItemFinished).length,
      total: list.length,
      current: index === currentLayerIndex && unfinished,
    };
  });
  const cover: WorkPlanBookCoverPage = {
    kind: "cover",
    goal: (plan.goal ?? "").trim() || "작업 계획",
    plannerNote: (plan.plannerNote ?? "").trim(),
    done: items.filter(isItemFinished).length,
    total: items.length,
    layers: summaries,
  };
  const layerPages: WorkPlanBookLayerPage[] = layers.map((layer, index) => ({
    kind: "layer",
    layerIndex: index,
    layerCount: layers.length,
    id: summaries[index]?.id ?? `L${index + 1}`,
    title: summaries[index]?.title ?? `레이어 ${index + 1}`,
    current: summaries[index]?.current ?? false,
    items: layerItems(layer),
  }));
  return [cover, ...layerPages];
}
