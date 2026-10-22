// 실내 빈 바닥 — 1배 화면에서 보는 사람이 「빈 바닥」으로 세는 넓이를 잰다.
//
// 왜(2026-10-22 조수 시험 #3242 3차): 옛 자(layoutQuality — 3×3 이웃에 가구·깔개가 하나도 없는 바닥만 셈)는 조수 판을 9~21% 로 쟀고,
// 같은 그림을 본 Opus 검수자는 25~30% 로 봤다. 가구 옆 한 칸만 지나가도 「안 빈 칸」이 되어, 가구 몇 점 둘레로 펼쳐진 넓은 맨바닥을 놓쳤다.
// 사람 눈은 「아무것도 안 놓인 바닥이 덩어리로 펼쳐진 곳」을 센다. 그래서:
//   빈 칸     = 1층이 통행 바닥이고 2·3·4층(깔개·가구·걸이·바닥 무늬)이 없는 칸
//   빈 덩이   = 빈 칸으로만 된 2×2 에 드는 빈 칸(한 칸 통로·가구 사이 틈은 빼고, 맨바닥 띠·마당은 센다)
//   기준 넓이 = 방 바닥 + 그 위 벽면 두 줄(1배 화면에서 방으로 보이는 넓이)
//   빈 바닥 % = 빈 덩이 ÷ 기준 넓이
// 보정(scripts/qa/interior-bare-floor-calibrate.mts): 폴른 r28 세 방(검수 8.1~8.2) 15·7·12%, 조수 3차 32·32·15·27%(검수자 25~30%).
// 옛 자는 같은 판을 9·3·7 / 11·11·9·21 로 쟀다. 한도 15% 는 vqa-rubric 축 1(빈 바닥·허공 ≤ 화면의 15%)과 같다.
import { tileAt } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

export const INTERIOR_BARE_FLOOR_LIMIT = 15;

export interface InteriorBareRegion { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly cells: number }

export interface InteriorBareFloor {
  /** 빈 바닥 % — 빈 덩이 ÷ (방 바닥 + 위 벽면 두 줄). */
  readonly pct: number;
  /** 방 바닥 칸 수(가구가 선 칸 포함). */
  readonly floorCells: number;
  /** 빈 덩이 칸 수. */
  readonly bareCells: number;
  /** 큰 빈 덩이(이어진 것끼리) 최대 3개 — 칸 수 순. */
  readonly regions: readonly InteriorBareRegion[];
}

export function measureInteriorBareFloor(project: Project, map: GameMap): InteriorBareFloor | null {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset?.passability) return null;
  const { width: w, height: h } = map;
  const room = new Uint8Array(w * h), bare = new Uint8Array(w * h);
  let floorCells = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const { lower, upper, layers } = tileAt(map, x, y);
    const pass = lower >= 0 ? tileset.passability[lower] : undefined;
    if (!pass || !(pass.up || pass.down || pass.left || pass.right)) continue;
    room[i] = 1; floorCells++;
    if (layers[1] < 0 && upper < 0 && layers[3] < 0) bare[i] = 1;
  }
  const inRun = new Uint8Array(w * h);
  for (let y = 0; y + 1 < h; y++) for (let x = 0; x + 1 < w; x++) {
    const i = y * w + x;
    if (bare[i] && bare[i + 1] && bare[i + w] && bare[i + w + 1]) inRun[i] = inRun[i + 1] = inRun[i + w] = inRun[i + w + 1] = 1;
  }
  let bareCells = 0, faced = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    bareCells += inRun[i]!;
    if (room[i] || (y + 1 < h && room[i + w]) || (y + 2 < h && room[i + 2 * w])) faced++;
  }
  const seen = new Uint8Array(w * h);
  const regions: InteriorBareRegion[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!inRun[start] || seen[start]) continue;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, cells = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!, x = i % w, y = (i - x) / w;
      cells++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (inRun[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    regions.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, cells });
  }
  regions.sort((a, b) => b.cells - a.cells);
  return { pct: faced ? Math.round(100 * bareCells / faced) : 0, floorCells, bareCells, regions: regions.slice(0, 3) };
}
