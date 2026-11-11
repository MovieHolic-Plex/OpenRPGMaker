// 지금 프로젝트 요약 블록 — 지시문 맨 끝에 싣는다.
import type { Project } from "@/project/types";

/**
 * 지금 프로젝트를 모델이 알 만큼만 — 맵(이름·칩셋·크기·사람 수·비었는지), 지금 보는 맵, 시작 맵.
 * 2026-10-30 실조수 e2e: 「map_blank_start 「버들 마을」 beodeul_city 20×15」처럼 칩셋 id 가 이름표 없이 맵 id 옆에 있어
 * 7번 중 5번 set_game_audio mapIds 에 칩셋 id 를 넣었다. 맵 id 는 `mapId=` 로, 칩셋은 괄호 안 `칩셋 …` 으로 이름을 붙인다.
 */
export function projectBrief(project: Project, currentMapId?: string): string {
  const maps = Object.values(project.maps).slice(0, 24).map((m) => {
    const filled = m.lowerTiles.some((t) => (t ?? -1) >= 0);
    const people = (m.events ?? []).filter((e) => e.pages?.[0]?.graphic).length;
    const marks = [m.id === project.startMapId ? "start map" : "", m.id === currentMapId ? "current map" : ""].filter(Boolean);
    const details = [`chipset ${m.tilesetId}`, `${m.width}×${m.height}`, ...(filled ? [] : ["empty map"]), ...(people ? [`people/objects ${people}`] : [])];
    return `- mapId=${m.id} 「${m.name}」 (${details.join(", ")})${marks.length ? ` ← ${marks.join("·")}` : ""}`;
  });
  return ["[Current project — fields that point at a map (mapId·mapIds) take the value after mapId=]", ...maps, Object.keys(project.maps).length > 24 ? `…first 24 of ${Object.keys(project.maps).length} maps` : ""].filter(Boolean).join("\n");
}
