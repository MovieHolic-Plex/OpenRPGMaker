// ai/session/workItemLookup.ts
// 툴 결과가 가리키는 작업 항목을 계획에서 되찾는다. 완료 직후에는 currentItemId 가 이미
// 다음 항목으로 넘어가 있으므로, 방금 끝난 항목은 결과가 실어 준 id 로만 찾을 수 있다.

import type { ToolResult } from "@/editor/tools";
import type { WorkItem, WorkPlan } from "../workPlan";

/** 완료된 work-item을 id로 찾는다 — 완료 직후 currentItemId는 다음 항목으로 넘어가 있다. */
export function findWorkItemById(plan: WorkPlan, itemId: string): WorkItem | null {
  for (const layer of plan.layers) {
    const item = layer.items.find((entry) => entry.id === itemId);
    if (item) return item;
  }
  return null;
}

/** complete_work_item ToolResult.data.completed(항목 id)를 안전하게 꺼낸다. */
export function completedWorkItemIdFromResult(result: ToolResult): string | null {
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) return null;
  const completed = (result.data as Record<string, unknown>).completed;
  return typeof completed === "string" && completed.length > 0 ? completed : null;
}
