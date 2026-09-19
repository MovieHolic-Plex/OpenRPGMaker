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

const READ_TOOLS = new Set(["get_event", "get_database_records", "run_lint"]);
export function eventScopeAllowsTool(name: string): boolean {
  return name === "event_command_assist" || READ_TOOLS.has(name);
}

export function eventScopeRefusal(scope: EventCommandScope, name: string, args: Record<string, unknown>): ToolResult | null {
  const wrongTarget = (name === "event_command_assist" || name === "get_event")
    && (args.mapId !== scope.mapId || args.eventId !== scope.eventId
      || (name === "event_command_assist" && (args.pageId !== scope.pageId || (args.mode ?? "edit") !== (scope.mode ?? "edit"))));
  if (eventScopeAllowsTool(name) && !wrongTarget) return null;
  const summary = "이 요청에서는 지정한 이벤트 페이지의 명령만 수정할 수 있습니다. event_command_assist를 사용하세요.";
  return { ok: false, summary, issues: [{ severity: "error", code: "event-page-scope", message: summary }] };
}

export function onlyEventPageCommandsChanged(before: Project, after: Project, scope: EventCommandScope): boolean {
  const original = before.maps[scope.mapId]?.events.find(e => e.id === scope.eventId)?.pages?.find(p => p.id === scope.pageId);
  const copy = structuredClone(after);
  const changed = copy.maps[scope.mapId]?.events.find(e => e.id === scope.eventId)?.pages?.find(p => p.id === scope.pageId);
  if (!original || !changed) return false;
  changed.commands = structuredClone(original.commands);
  return JSON.stringify(before) === JSON.stringify(copy);
}
