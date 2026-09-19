// ai/planToolExposure.ts
// Helpers for explicitly scoped consumers, plan validation and the hybrid
// AssistantSession candidate set. Plan-required schemas bypass discovery ranking.
import { activeTools, getTool, toOpenAiTools, type ToolDefinition } from "@/editor/tools";
import type { OpenAiToolSchema } from "./llmClient";
import type { WorkPlan } from "./workPlan";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toolNameMentioned(text: string, name: string): boolean {
  // 단어 경계 매칭 — "build_village" 가 "build_villages" 등 부분 문자열로 안 잡히게 한다.
  return new RegExp(`(^|[^a-z0-9_])${escapeRegExp(name)}($|[^a-z0-9_])`, "i").test(text);
}

/**
 * 계획이 명시적으로 요구하는 툴 이름을 수집한다.
 * - 항목별 successTools (완료 조건 툴 — 계획 작성자가 보장한 실행 툴)
 * - 항목 지시문/완료 조건에 등장하는 활성 레지스트리 툴 이름
 */
export function planRequiredToolNames(plan: WorkPlan): string[] {
  const names = new Set<string>();
  const scan = (text: string | undefined): void => {
    if (!text) return;
    for (const tool of activeTools()) {
      if (toolNameMentioned(text, tool.name)) names.add(tool.name);
    }
  };
  for (const layer of plan.layers) {
    for (const item of layer.items) {
      for (const name of item.successTools ?? []) names.add(name);
      scan(item.instruction);
      scan(item.doneWhen);
    }
  }
  scan(plan.goal);
  return [...names];
}

export function toolSchemasForNames(names: readonly string[]): OpenAiToolSchema[] {
  const defs: ToolDefinition[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const tool = getTool(name);
    if (!tool) continue;
    // deprecated(빌더 v1 등)는 LLM 에 노출되지 않는다 — supersededBy 가 있으면 그 대체 툴을 노출한다.
    const effective = tool.deprecated === true && tool.supersededBy ? getTool(tool.supersededBy) : tool;
    if (!effective || effective.deprecated === true || seen.has(effective.name)) continue;
    seen.add(effective.name);
    defs.push(effective);
  }
  if (defs.length === 0) return [];
  return toOpenAiTools(defs, {});
}

/** 사용자가 정확한 레지스트리 이름으로 지목한 툴은 도메인 상한 밖에서도 보장한다. */
export function mentionedToolSchemas(text: string): OpenAiToolSchema[] {
  const names = activeTools()
    .filter((tool) => toolNameMentioned(text, tool.name))
    .map((tool) => tool.name);
  return toolSchemasForNames(names);
}

/** 계획 요구 툴을 OpenAI 스키마 배열로. deprecated 는 supersededBy 로 대체, 도메인/상한 미적용. */
export function planRequiredToolSchemas(plan: WorkPlan): OpenAiToolSchema[] {
  return toolSchemasForNames(planRequiredToolNames(plan));
}
