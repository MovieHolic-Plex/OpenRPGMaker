import type { AuditEntry } from "@/ai/assistantSession";

/** 패널이 사용자 글 끝에 붙이는 기계 꼬리말(aiChatPanel 의 contextFooter)에서 맵 id 를 읽는다. */
const CONTEXT_FOOTER_MAP = /\[컨텍스트\] 현재 맵: .*? \(([^()\s]+)\)/;
/** Pi 활동 기록의 마지막 줄(piAgent/activityLog.ts) — `Pi 에이전트 · 범위 map_a, map_b · …`. */
const PI_SCOPE_LINE = /^Pi (?:에이전트|팀) · 범위 (.+?) · /;
/** 맵 범위가 없는 Pi 실행의 범위 글자. */
export const PI_PROJECT_SCOPE = "프로젝트 전체";

/** Pi 범위 상태 줄이면 그 맵 id 들(「프로젝트 전체」는 빈 배열), 아니면 null. */
export function piScopeMapIds(text: string): string[] | null {
  const match = PI_SCOPE_LINE.exec(text);
  if (!match?.[1]) return null;
  return match[1].split(",").map(id => id.trim()).filter(id => id.length > 0 && id !== PI_PROJECT_SCOPE);
}

/**
 * 근거가 있을 때만 정한 집 맵. `undefined` = 아직 근거가 없다(저장하지 말고 다음 저장에서 다시 본다).
 * 근거와 순서:
 *  1. 첫 사용자 글에 구조 맥락(`context`)이 있다 — `mapId` 가 null 이면 일부러 게임 전체다.
 *  2. 같은 글에 기계 꼬리말 `[컨텍스트] 현재 맵: … (id)` 이 있다.
 *  3. Pi 범위 줄이 있다 — 첫 줄의 맵이 정확히 하나면 그 맵, 여러 맵·프로젝트 전체면 게임 전체.
 * Pi 앞 턴은 실행 전에 먼저 저장하고(실행 중 표지) 범위 줄은 끝에 붙으므로, 첫 저장에는 근거가 없을 수 있다.
 * 맵이 지금 있는지는 보지 않는다 — 목록(aiThreadList)이 본다.
 */
export function decidedThreadHomeMapId(entries: readonly AuditEntry[]): string | null | undefined {
  const firstUser = entries.find(entry => entry.kind === "user");
  if (firstUser?.kind === "user") {
    if (firstUser.context !== undefined) {
      const mapId = firstUser.context.mapId;
      return typeof mapId === "string" && mapId.trim() ? mapId : null;
    }
    const footer = CONTEXT_FOOTER_MAP.exec(firstUser.text)?.[1];
    if (footer) return footer;
  }
  for (const entry of entries) {
    if (entry.kind !== "status") continue;
    const match = PI_SCOPE_LINE.exec(entry.text);
    if (!match?.[1]) continue;
    const raw = match[1].split(",").map(id => id.trim());
    const only = raw.length === 1 ? raw[0] : undefined;
    return only && only !== PI_PROJECT_SCOPE ? only : null;
  }
  return undefined;
}

/** 대화(스레드)의 집 맵. `null` 은 「게임 전체」다(근거가 없을 때도). */
export function threadHomeMapId(entries: readonly AuditEntry[]): string | null {
  return decidedThreadHomeMapId(entries) ?? null;
}
