import { checkSmallTaskScope, type SmallTaskScopeResult } from "./smallTaskScope";
import { EVENT_COMMAND_ASSIST_TOOL } from "@/editor/tools/eventCommandAssistTool";
import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";
import type { ToolCall } from "./llmClient";

/** Host-owned boundary; never read from model arguments or natural-language instructions. */
export interface EventCommandScope {
  readonly mapId: string;
  readonly eventId: string;
  readonly pageId: string;
  readonly selection?: readonly number[] | null;
  readonly selectionLabel?: string;
  readonly mode?: "edit" | "append";
}

export const EVENT_COMMAND_SCOPE_TOOLS: readonly string[] = [EVENT_COMMAND_ASSIST_TOOL];

export function eventScopeAllowsTool(name: string): boolean {
  return EVENT_COMMAND_SCOPE_TOOLS.includes(name);
}

/** 끝에 더하는 요청 — edit 는 명령 배열을 다시 써서 유지할 명령이 사라질 수 있다(도구 설명의 실측). */
const APPEND_REQUEST = /추가|덧붙|붙여|끝에|더해|\badd\b|\bappend\b/iu;

/** 범위의 첫 차례 — 편집기가 정한 대상에 사용자 문장을 그대로 넣은 event_command_assist 호출. 바깥 모델을 거치지 않는다. */
export function eventScopeToolCall(scope: EventCommandScope, instruction: string): ToolCall {
  const append = scope.mode === "append" || APPEND_REQUEST.test(instruction);
  const args = { mapId: scope.mapId, eventId: scope.eventId, pageId: scope.pageId, prompt: instruction.trim(), ...(append ? { mode: "append" } : {}) };
  return { id: `event-scope-${scope.pageId}`, type: "function", function: { name: EVENT_COMMAND_ASSIST_TOOL, arguments: JSON.stringify(args) } };
}

export function eventCommandScopeModeSchema(scope: EventCommandScope) {
  return scope.mode === "append"
    ? { type: "string" as const, enum: ["append"], description: "mode에 append를 명시하세요." }
    : { type: "string" as const, enum: ["edit", "append"], description: "추가 요청은 mode에 append를 사용하세요. 생략하면 edit입니다." };
}

export function eventScopeRefusal(scope: EventCommandScope, name: string, args: Record<string, unknown>): ToolResult | null {
  const mode = eventCommandScopeModeSchema(scope);
  const requestedMode = args.mode === undefined ? "edit" : args.mode;
  if (eventScopeAllowsTool(name) && args.mapId === scope.mapId && args.eventId === scope.eventId
    && args.pageId === scope.pageId && mode.enum.some(value => value === requestedMode)) return null;
  const target = { mapId: scope.mapId, eventId: scope.eventId, pageId: scope.pageId };
  const summary = `이 요청에서는 지정한 이벤트 페이지의 명령만 수정할 수 있습니다. event_command_assist에 ${JSON.stringify(target)}와 사용자 요청(prompt)을 넣어 다시 호출하세요. ${mode.description}`;
  return { ok: false, summary, issues: [{ severity: "error", code: "event-page-scope", message: summary }] };
}

export function checkEventCommandScope(before: Project, after: Project, scope: EventCommandScope): SmallTaskScopeResult {
  return checkSmallTaskScope(before, after, { ...scope, kind: "eventPage" });
}

export function onlyEventPageCommandsChanged(before: Project, after: Project, scope: EventCommandScope): boolean {
  return checkEventCommandScope(before, after, scope).ok;
}
