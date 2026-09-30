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
    return toOpenAiTools() as OpenAiTool[];
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
