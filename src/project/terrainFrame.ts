import type { GameMap, Project } from "./types";
import { layerTileAt, shadowAt, TILE_LAYER_NOS } from "./mapLayers";

export interface TerrainFrameViolation {
  readonly mapId: string;
  readonly mapName: string;
  readonly cells: readonly { readonly x: number; readonly y: number; readonly what: "높이" | "경사로" | "물" | "잠긴 칸" }[];
  readonly reason?: string;
}

const level = (m: GameMap, i: number) => m.relief?.levels[i] ?? 0;
const ramp = (m: GameMap, i: number) => m.relief?.ramps?.[i] ?? 0;
const depth = (m: GameMap, i: number) => m.terrainDesign?.waterDepth?.[i] ?? 0;

function lockedCellChanged(before: GameMap, after: GameMap, i: number): boolean {
  if (level(before, i) !== level(after, i) || ramp(before, i) !== ramp(after, i) || depth(before, i) !== depth(after, i)) return true;
  if (shadowAt(before, i) !== shadowAt(after, i)) return true;
  return TILE_LAYER_NOS.some((layer) => layerTileAt(before, layer, i) !== layerTileAt(after, layer, i));
}

/**
 * 틀 고정(맵 단위 terrainDesign.frameLock)과 칸 잠금(lockedCells)을 AI 쓰기 확정 직전에 검사한다.
 * 틀 고정: 높이·경사로·물 깊이만 얼린다(타일은 열림). 칸 잠금: 그 칸의 타일 4층·그림자·높이·경사로·물 전부.
 * 맵을 지우거나 크기를 바꾸거나 잠금 자체를 풀면 그 맵 전체가 위반이다. 조용히 되돌리지 않는다 — 호출자가 거부한다.
 */
export function terrainFrameViolations(before: Project, after: Project): TerrainFrameViolation[] {
  const out: TerrainFrameViolation[] = [];
  for (const [mapId, prev] of Object.entries(before.maps)) {
    const frame = prev.terrainDesign?.frameLock === true;
    const locks = prev.terrainDesign?.lockedCells ?? [];
    if (!frame && !locks.length) continue;
    const next = after.maps[mapId];
    if (!next) { out.push({ mapId, mapName: prev.name, cells: [], reason: "틀이 있는 맵을 지울 수 없습니다" }); continue; }
    if (next === prev) continue;
    if (next.width !== prev.width || next.height !== prev.height) { out.push({ mapId, mapName: prev.name, cells: [], reason: "틀이 있는 맵의 크기를 바꿀 수 없습니다" }); continue; }
    if (frame && next.terrainDesign?.frameLock !== true) { out.push({ mapId, mapName: prev.name, cells: [], reason: "틀 고정은 사람만 풀 수 있습니다" }); continue; }
    const kept = new Set(next.terrainDesign?.lockedCells ?? []);
    if (locks.some((i) => !kept.has(i))) { out.push({ mapId, mapName: prev.name, cells: [], reason: "잠긴 칸은 사람만 풀 수 있습니다" }); continue; }
    const cells: { x: number; y: number; what: TerrainFrameViolation["cells"][number]["what"] }[] = [];
    const seen = new Set<number>();
    for (const i of locks) if (lockedCellChanged(prev, next, i)) { seen.add(i); cells.push({ x: i % prev.width, y: Math.floor(i / prev.width), what: "잠긴 칸" }); }
    if (frame && (prev.relief !== next.relief || prev.terrainDesign?.waterDepth !== next.terrainDesign?.waterDepth)) {
      for (let i = 0; i < prev.width * prev.height; i++) {
        if (seen.has(i)) continue;
        const what = level(prev, i) !== level(next, i) ? "높이" : ramp(prev, i) !== ramp(next, i) ? "경사로" : depth(prev, i) !== depth(next, i) ? "물" : null;
        if (what) cells.push({ x: i % prev.width, y: Math.floor(i / prev.width), what });
      }
    }
    if (cells.length) out.push({ mapId, mapName: prev.name, cells });
  }
  return out;
}

export function formatTerrainFrameViolations(violations: readonly TerrainFrameViolation[], limit = 40): string {
  return violations.map((v) => {
    if (v.reason) return `${v.mapName}(${v.mapId}): ${v.reason}`;
    const shown = v.cells.slice(0, limit).map((c) => `(${c.x},${c.y}) ${c.what}`).join(", ");
    return `${v.mapName}(${v.mapId}): 고정된 틀 칸 ${v.cells.length}곳을 바꾸려 했습니다 — ${shown}${v.cells.length > limit ? ` 외 ${v.cells.length - limit}곳` : ""}`;
  }).join(" / ");
}
