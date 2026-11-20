import { checkSmallTaskScope, type SmallTaskScopeResult } from "./smallTaskScope";
import { EVENT_COMMAND_ASSIST_TOOL } from "@/editor/tools/eventCommandAssistTool";
import type { Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";

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

export function eventScopeRefusal(scope: EventCommandScope, name: string, args: Record<string, unknown>): ToolResult | null {
  const mode = scope.mode ?? "edit";
  if (eventScopeAllowsTool(name) && args.mapId === scope.mapId && args.eventId === scope.eventId
    && args.pageId === scope.pageId && (args.mode ?? "edit") === mode) return null;
  const target = { mapId: scope.mapId, eventId: scope.eventId, pageId: scope.pageId, mode };
  const summary = `이 요청에서는 지정한 이벤트 페이지의 명령만 수정할 수 있습니다. event_command_assist에 ${JSON.stringify(target)}와 사용자 요청(prompt)을 넣어 다시 호출하세요.`;
  return { ok: false, summary, issues: [{ severity: "error", code: "event-page-scope", message: summary }] };
}

export function checkEventCommandScope(before: Project, after: Project, scope: EventCommandScope): SmallTaskScopeResult {
  return checkSmallTaskScope(before, after, { ...scope, kind: "eventPage" });
}

export function onlyEventPageCommandsChanged(before: Project, after: Project, scope: EventCommandScope): boolean {
  return checkEventCommandScope(before, after, scope).ok;
}
