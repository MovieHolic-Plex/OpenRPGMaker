// 노드 전용: 맵을 renderMapPng 로 그려 칸 단위로 읽고(어두운 칸·빈 칸·통행) src/qa/gameCheck/visualVoid 순수 함수에 넘긴다.
// `qa:game check` 가 부른다(--no-visual 로 끈다). 읽을 수 없는 타일셋은 건너뛰고 한 줄로 알린다 — 조용히 통과로 치지 않는다.

import { PNG } from "pngjs";
import { cellPassability } from "../../../src/project/collision.ts";
import { flatMapFinding, offendingVoidBlobs, VOID_DARK_LUMA, voidFinding, type VoidCell } from "../../../src/qa/gameCheck/visualVoid.ts";
import type { Finding } from "../../../src/qa/gameCheck/types.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";

export async function checkVisualVoids(project: Project, log: (line: string) => void = () => {}): Promise<Finding[]> {
  const { renderMapPng } = await import("../render.mts");
  const findings: Finding[] = [];
  for (const map of Object.values(project.maps)) {
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) continue;
    const flat = flatMapFinding(map);
    if (flat) findings.push(flat);
    const { png: bytes, note } = renderMapPng(project, map, 1);
    if (note) { log(`[visual-void] ${map.id}: ${note} — 건너뜀`); continue; }
    const png = PNG.sync.read(bytes);
    const size = tileset.tileSize;
    const cells: VoidCell[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      // 이벤트 표식 테두리를 피해 칸 안쪽(가장자리 3px 제외)만 본다.
      const margin = Math.min(3, Math.floor(size / 4));
      let sum = 0, count = 0;
      for (let py = y * size + margin; py < (y + 1) * size - margin; py++) for (let px = x * size + margin; px < (x + 1) * size - margin; px++) {
        const o = (py * png.width + px) * 4;
        sum += 0.299 * png.data[o]! + 0.587 * png.data[o + 1]! + 0.114 * png.data[o + 2]!;
        count += 1;
      }
      const flags = cellPassability(tileset, map, i);
      // 빈 칸에 맵 배경(그림·다른 맵 줄여 깔기)이 비치는 맵이면 빈 칸은 구멍이 아니라 배경 창이다(옥상 난간 너머 동네, 2026-10-25).
      // 이 렌더러는 배경을 그리지 않으므로 그 빈 칸은 검사에서 뺀다.
      const showsBackground = Boolean(map.background?.showInEmptyCells && (map.background.imageId || map.background.fromMap));
      const empty = emptyCell(map, i);
      cells.push({
        dark: !(showsBackground && empty) && count > 0 && sum / count < VOID_DARK_LUMA,
        empty: empty && !showsBackground,
        passable: flags.up || flags.down || flags.left || flags.right,
      });
    }
    for (const blob of offendingVoidBlobs(map.width, map.height, cells)) findings.push(voidFinding(map, blob));
  }
  return findings;
}

function emptyCell(map: GameMap, i: number): boolean {
  const tiles = [map.lowerTiles[i], map.upperTiles[i], map.lowerOverlayTiles?.[i], map.upperOverlayTiles?.[i]];
  return tiles.every((t) => t === undefined || t < 0);
}
