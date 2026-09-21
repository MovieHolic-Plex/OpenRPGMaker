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

/**
 * 이 스코프에서 허용하는 **읽기** 툴.
 *
 * 이 계약이 봉인하는 것은 **쓰기**다 — `onlyEventPageCommandsChanged` 가 지정 페이지 밖의 변경을
 * 거부하므로 읽기는 넓혀도 안전하다. 2026-09-20 사용자 요청으로 넓혔다.
 *
 * 왜 넓혀야 했나(실측): 종전 목록은 `get_event`·`get_database_records`·`run_lint` 뿐이라
 * **맵을 조회할 방법이 없었다.** 그래서 모델은 프롬프트에 실린 맵 정보만 보고 대사를 지어야 했고,
 * 그 정보는 맵당 한 줄(`이름 (가로 W × 세로 H, 밟을 수 있는 칸 예: x,y)`)이 전부였다.
 * "이 마을 광장에서"·"여관 안에서" 같은 지시를 받아도 그 자리가 어떤지 볼 수 없었다.
 * 조수 세션은 `eventScopeAllowsTool` 로 툴 목록을 거르므로, 여기 없으면 노출조차 되지 않는다.
 *
 * 노출은 `assistantSession` 의 세션 툴 루프가 하고, 읽기 결과는 대화에 남아 다음 라운드의
 * 근거가 된다. 프롬프트를 키우지 않고도 모델이 필요한 만큼 파고들 수 있다.
 */
const READ_TOOLS = new Set([
  "get_event",
  "get_database_records",
  "run_lint",
  // 맵·배치의 실제 모습. 시맨틱 문자 그리드 + 물 바운딩 박스까지 준다.
  "get_map_region",
  "get_project_summary",
  "find_events",
  "find_layout_regions",
  "list_resources",
]);
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
