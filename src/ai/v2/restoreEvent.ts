// 요청 전 이벤트를 그대로 되살린다(2026-10-26 ledger «toy-shop advisor turn 2»).
//
// 왜: 조수가 시키지 않은 이벤트(「깨어난 손님의 기억」)를 지웠고, 검토자가 짚자 기억으로 다시 썼다 — 이름이 빠지고(None) 조건 스위치가
// 바뀐(sw_v2scene_…_shown → sw_0003) 다른 이벤트가 생겼는데 보고는 「모두 복구」였다. 요청이 시작될 때의 프로젝트(env.request.project)에
// 원본이 있으니 다시 쓰지 말고 그대로 복사한다. 순수 함수 — after 를 고친다.
import type { Project } from "@/project/types";

export interface RestoreEventResult { readonly ok: boolean; readonly summary: string; readonly mapId?: string }

export function restoreEventFromBefore(before: Project, after: Project, eventId: string, mapId?: string): RestoreEventResult {
  const key = eventId.trim();
  const maps = mapId ? [before.maps[mapId]].filter(Boolean) : Object.values(before.maps);
  for (const map of maps) {
    const old = (map!.events ?? []).find((e) => e.id === key) ?? (map!.events ?? []).find((e) => (e.name ?? "").trim() === key);
    if (!old) continue;
    const target = after.maps[map!.id];
    if (!target) return { ok: false, summary: `맵 「${map!.name}」(${map!.id})이 지금 프로젝트에 없다 — 맵째 지워졌으면 이벤트만 되살릴 수 없다.` };
    const events = target.events ?? (target.events = []);
    const index = events.findIndex((e) => e.id === old.id);
    const copy = structuredClone(old);
    if (index >= 0) events[index] = copy; else events.push(copy);
    const other = events.find((e) => e.id !== old.id && e.x === old.x && e.y === old.y);
    const commands = (old.pages ?? []).reduce((n, p) => n + (p.commands?.length ?? 0), 0);
    return {
      ok: true, mapId: map!.id,
      summary: `「${old.name || old.id}」(${old.id})을 요청 전 그대로 ${index >= 0 ? "되돌렸다(지금 것을 덮음)" : "되살렸다"} — ${map!.name} (${old.x},${old.y}), 페이지 ${old.pages?.length ?? 0}개·명령 ${commands}개·조건·그림 원본 그대로.${other ? ` 같은 칸에 「${other.name || other.id}」(${other.id})도 있다 — 둘 중 하나를 옮긴다.` : ""}`,
    };
  }
  const known = Object.values(before.maps).flatMap((m) => (m.events ?? []).map((e) => `${e.id}${e.name ? ` 「${e.name}」` : ""}`));
  return { ok: false, summary: `요청 전 프로젝트에 「${key}」 이벤트가 없다${mapId ? `(맵 ${mapId})` : ""}. 요청 전에 있던 이벤트: ${known.slice(0, 20).join(", ") || "없음"}${known.length > 20 ? " …" : ""}` };
}
