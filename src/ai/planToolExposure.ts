// ai/planToolExposure.ts
// 자율 런(todo 8 실측): 도메인 게이트 + 40툴 상한이 계획 항목의 successTools 와 지시문에
// 적힌 툴을 노출에서 떨어뜨렸다(plan_world/play_walkthrough 등). 모델이 "툴이 없다"고
// 항목을 스킵해 전체 DAG 가 수행 불가능해졌다. 계획이 활성이면 계획에 명시된 툴을
// 도메인 상한과 무관하게 반드시 노출한다(CPEN 128툴 상한 내 — 40+α).
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

/** 계획 요구 툴을 OpenAI 스키마 배열로. deprecated 는 supersededBy 로 대체, 도메인/상한 미적용. */
export function planRequiredToolSchemas(plan: WorkPlan): OpenAiToolSchema[] {
  const defs: ToolDefinition[] = [];
  const seen = new Set<string>();
  for (const name of planRequiredToolNames(plan)) {
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
