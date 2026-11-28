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
 * 대화(스레드)의 집 맵. `null` 은 「게임 전체」다.
 * 순서: 첫 사용자 글의 구조 맥락 → 같은 글의 꼬리말 → 첫 Pi 범위 줄(맵이 정확히 하나일 때만).
 * 맵이 지금 있는지는 보지 않는다 — 목록(aiThreadList)이 본다.
 */
export function threadHomeMapId(entries: readonly AuditEntry[]): string | null {
  const firstUser = entries.find(entry => entry.kind === "user");
  if (firstUser?.kind === "user") {
    const mapId = firstUser.context?.mapId;
    if (typeof mapId === "string" && mapId.trim()) return mapId;
    const footer = CONTEXT_FOOTER_MAP.exec(firstUser.text)?.[1];
    if (footer) return footer;
  }
  for (const entry of entries) {
    if (entry.kind !== "status") continue;
    const ids = piScopeMapIds(entry.text);
    if (ids === null) continue;
    const raw = PI_SCOPE_LINE.exec(entry.text)?.[1]?.split(",") ?? [];
    return raw.length === 1 && ids.length === 1 ? (ids[0] ?? null) : null;
  }
  return null;
}
