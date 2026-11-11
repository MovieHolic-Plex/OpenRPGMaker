// 첫 장소를 깐 뒤의 시작 칸 — 바깥 장소면 그 장소로 들어오는 길 입구(roadMouths.ts)에서 두세 칸 안쪽, 지붕·나무 그림 밑이 아닌 칸.
//
// 왜(2026-11-11 map-vqa 깔기 village): 빈 시작 맵 위에 마을을 지으면 마을 도구가 옛 시작 칸 (10,8) 에서 «가장 가까운 트인 칸» 으로 옮긴다 —
// 그 칸 (10,5) 가 집 지붕 뒤(걸을 수 있고 윗층 그림이 덮는 칸)라 주인공이 지붕에 가려 보이지 않은 채 시작했다. 시작은 그 장소로 들어오는 길 끝이다.
import { largestWalkArea } from "@/editor/tools/startOnBuiltMap";
import type { GameMap, Project } from "@/project/types";
import type { Side } from "../shared/types";
import { edgeRoadMouths, mouthCenter } from "./roadMouths";
import { isRoadGround } from "./surface";
import { coveredCell } from "./underRoof";

type Cell = { readonly x: number; readonly y: number };
/** 들어오는 쪽을 고르는 순서 — 아래에서 들어와 위를 보는 화면이 장소를 가장 넓게 보여 준다. */
const SIDE_ORDER: readonly Side[] = ["south", "west", "east", "north"];
const INWARD: Readonly<Record<Side, readonly [number, number]>> = { south: [0, -1], north: [0, 1], west: [1, 0], east: [-1, 0] };

/** 길 입구 안쪽의 시작 칸. 길 이름표가 없는 칩셋·가장자리에 닿는 길이 없는 맵은 undefined(빌더가 정한 칸을 그대로 쓴다). */
export function roadEntranceStart(project: Project, map: GameMap): Cell | undefined {
  const W = map.width;
  const area = new Set(largestWalkArea(project, map));
  const taken = new Set((map.events ?? []).map((e) => e.y * W + e.x));
  const free = (c: Cell) => area.has(c.y * W + c.x) && isRoadGround(project, map, c.x, c.y) && !taken.has(c.y * W + c.x) && !coveredCell(project, map, c.x, c.y);
  const mouths = edgeRoadMouths(project, map);
  for (const side of SIDE_ORDER) {
    // 그 변의 입구 가운데 가장 넓은 것(큰길)부터.
    for (const mouth of mouths.filter((m) => m.side === side).sort((a, b) => b.cells.length - a.cells.length)) {
      const edge = mouthCenter(mouth), [dx, dy] = INWARD[side];
      for (const depth of [2, 3, 1]) {
        const c = { x: edge.x + dx * depth, y: edge.y + dy * depth };
        if (c.x >= 0 && c.y >= 0 && c.x < W && c.y < map.height && free(c)) return c;
      }
    }
  }
  return undefined;
}
