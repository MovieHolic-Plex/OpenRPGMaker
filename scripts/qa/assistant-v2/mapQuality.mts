// 맵 품질 지표(mvp-map-quality 와 같은 정의) — mapVariety.mts 와 탐침이 같이 쓴다.
import { eventBlockers, walkReach, walkStart } from "../../../src/ai/v2/place/cells.ts";
import { isPassable } from "../../../src/project/collision.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

/** mvp-map-quality 와 같은 지표: 빈 칸 %(위층·덧층·이벤트가 없는 칸), 소품/100칸(위층 물체 칸), 걸어 닿는 칸 비율(걸을 수 있는 칸 중). */
export function quality(project: Project, map: GameMap): { bare: number; props100: number; reach: number; size: string } {
  const n = map.width * map.height;
  const m = map as unknown as { upperTiles?: ArrayLike<number>; upperOverlayTiles?: ArrayLike<number>; lowerOverlayTiles?: ArrayLike<number> };
  const ev = new Set((map.events ?? []).map((e) => e.y * map.width + e.x));
  let bare = 0, props = 0, pass = 0, reached = 0;
  const start = walkStart(project, map);
  const reach = walkReach(project, map, start, eventBlockers(map));
  for (let i = 0; i < n; i++) {
    const up = (m.upperTiles?.[i] ?? -1) >= 0 || (m.upperOverlayTiles?.[i] ?? -1) >= 0;
    const lo = (m.lowerOverlayTiles?.[i] ?? -1) >= 0;
    if (up) props++;
    if (!up && !lo && !ev.has(i)) bare++;
    if (isPassable(project, map, i % map.width, Math.floor(i / map.width))) { pass++; if (reach[i]) reached++; }
  }
  return { bare: Math.round((100 * bare) / n), props100: Math.round((1000 * props) / n) / 10, reach: pass ? Math.round((1000 * reached) / pass) / 10 : 0, size: `${map.width}x${map.height}` };
}
