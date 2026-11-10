// 컷신 무대가 전투로 이어지는가 — 동사(add_event 결과 안내)와 끝맺음 관문(낡은 싸움 비평 걷기)이 같이 묻는다.
import type { Project } from "@/project/types";

/** 컷신 이벤트(또는 그 컷신이 세운 사람) 명령 안에 전투(battleProcessing)가 있나 — 지금 프로젝트 기준. */
export function stageOpensBattle(project: Project, mapId: string, eventIds: readonly string[] | undefined): boolean {
  const map = project.maps[mapId];
  if (!map || !eventIds?.length) return false;
  const has = (n: unknown): boolean => Array.isArray(n) ? n.some(has) : !!n && typeof n === "object" && ((n as { kind?: unknown }).kind === "battleProcessing" || Object.values(n).some(has));
  return map.events.some((e) => eventIds.includes(e.id) && has(e.pages ?? []));
}
