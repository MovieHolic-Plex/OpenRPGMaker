// ai/sessionToolExposure.ts
//
// Shared by the Pi chat entry point and the legacy AssistantSession.
// The editor assistant keeps a small control plane in the first request and
// expands it with tools named by intent, the active plan, read contracts and
// discovery results. The complete catalog remains an explicit fallback for
// neutral/failed routing and for a discovery miss. This keeps capability
// reachability without paying for every editor schema on every turn.

import { adventureToolNames, type AdventureRequirements } from "./adventureCompletion";
import { capabilityEscalationSchemas } from "./capabilityEscalation";
import { mentionedToolSchemas, planRequiredToolSchemas, toolSchemasForNames } from "./planToolExposure";
import type { IntentDeclaration } from "./intentDeclaration";
import { toOpenAiTools, type OpenAiTool } from "@/editor/tools";
import type { WorkPlan } from "./workPlan";
import { DEFAULT_COMPACTION_SETTINGS, estimateContextTokens } from "./contextCompaction";

/** Read/control tools that must remain reachable before any search round. */
export const DISCOVERY_CONTROL_TOOL_NAMES: readonly string[] = [
  "find_tools",
  "read_project_wiki",
  "get_project_summary",
  "get_map_region",
  "find_events",
  "get_event",
  "find_layout_regions",
  "get_database_records",
  "list_resources",
  "focus_editor_view",
];

export interface SessionToolExposureInput {
  readonly requestText: string;
  readonly intent: IntentDeclaration | null;
  readonly discoveredToolNames?: readonly string[];
  readonly requiredReadTools?: readonly string[];
  readonly workPlan?: WorkPlan | null;
  readonly fullCatalogFallback?: boolean;
  /**
   * 이 요청을 받을 모델의 컨텍스트 창. 주면 전체 카탈로그가 창에 안 들어갈 때 폴백도 좁힌 목록(코어+발견 도구)을 쓴다.
   * 실측(2026-10-02): 전체 카탈로그 약 189,000 토큰 + 예비분 16,384 가 claude·glm(200,000)·미지 모델(128,000) 창을 넘어
   * 폴백 턴이 요청 조립에서 죽었다.
   */
  readonly contextWindow?: number;
}

/** 폴백으로 전체 카탈로그를 보내도 대화가 쓸 자리(약 13,000 토큰)가 남는가. */
const CONVERSATION_FLOOR_TOKENS = 13_000;
let fullCatalogTokenCache: { readonly count: number; readonly tokens: number } | undefined;
export function fullCatalogFitsWindow(full: readonly OpenAiTool[], contextWindow: number): boolean {
  if (fullCatalogTokenCache?.count !== full.length) {
    fullCatalogTokenCache = { count: full.length, tokens: estimateContextTokens([{ role: "system", content: JSON.stringify(full) }]) };
  }
  return fullCatalogTokenCache.tokens + DEFAULT_COMPACTION_SETTINGS.reserveTokens + CONVERSATION_FLOOR_TOKENS <= contextWindow;
}

function appendUnique(target: OpenAiTool[], seen: Set<string>, schemas: readonly OpenAiTool[]): void {
  for (const schema of schemas) {
    const name = schema.function.name;
    if (seen.has(name)) continue;
    seen.add(name);
    target.push(schema);
  }
}

function schemasForIntent(intent: IntentDeclaration | null): OpenAiTool[] {
  if (!intent) return [];
  const names = [
    ...intent.tools,
    ...(intent.adventure ? adventureToolNames(intent.adventure as AdventureRequirements) : []),
  ];
  // 마을 시공 도구를 고른 요청에는 버들항 조립 도구·검사 도구를 함께 보인다 — 대상 계열이 버들항이면 author_village 는
  // 거절·우회되고 author_beodeul_town 이 짓는데, 선언이 고른 도구 8개 안에 그것이 없으면 모델이 존재를 모른다(2026-10-01).
  if (names.includes("author_village") || names.includes("author_beodeul_town")) {
    names.push("author_beodeul_town", "check_city_form", "check_reachability");
  }
  return toolSchemasForNames(names) as OpenAiTool[];
}

/**
 * Build the registry portion of one AssistantSession request.
 *
 * `fullCatalogFallback` is deliberately explicit. A missing declaration or a
 * search miss must never make a real editor capability unreachable; callers can
 * flip it for the next round without changing execution/approval policy.
 */
export function buildSessionRegistryTools(input: SessionToolExposureInput): OpenAiTool[] {
  if (input.fullCatalogFallback || input.intent === null || input.intent.source === "fallback") {
    const full = toOpenAiTools() as OpenAiTool[];
    // 창이 좁으면 전체를 밀어 넣지 않고 아래 좁힌 목록으로 간다 — 발견 도구가 나머지를 찾아 준다.
    if (input.contextWindow === undefined || fullCatalogFitsWindow(full, input.contextWindow)) return full;
  }

  const tools: OpenAiTool[] = [];
  const seen = new Set<string>();
  const core = toOpenAiTools(undefined, { domains: new Set(["core"]) });
  appendUnique(tools, seen, core);
  appendUnique(tools, seen, toolSchemasForNames(DISCOVERY_CONTROL_TOOL_NAMES) as OpenAiTool[]);
  appendUnique(tools, seen, schemasForIntent(input.intent));
  appendUnique(tools, seen, mentionedToolSchemas(input.requestText) as OpenAiTool[]);
  appendUnique(tools, seen, input.discoveredToolNames
    ? toolSchemasForNames(input.discoveredToolNames) as OpenAiTool[]
    : []);
  appendUnique(tools, seen, input.requiredReadTools
    ? toolSchemasForNames(input.requiredReadTools) as OpenAiTool[]
    : []);
  appendUnique(tools, seen, input.workPlan
    ? planRequiredToolSchemas(input.workPlan) as OpenAiTool[]
    : []);

  const capability = capabilityEscalationSchemas(input.requestText, seen);
  appendUnique(tools, seen, capability as OpenAiTool[]);
  return tools;
}
