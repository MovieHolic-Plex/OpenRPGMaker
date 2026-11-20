import { clusterRuleLintIssues } from "@/project/lint/clusterRuleLint";
import { layerTileAt } from "@/project/mapLayers";
import type { GameMap, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";
import { forEachCell, getTileset, includesCell, type Rect } from "./region";

type KitCell = { dx: number; dy: number; lower: number; upper: number };
type KitTransform = { next: GameMap; mirror?: "horizontal" | "vertical"; movingFrom?: Rect };

function matchesAt(map: GameMap, cells: readonly KitCell[], x: number, y: number): boolean {
  return cells.every(cell => {
    const index = (y + cell.dy) * map.width + x + cell.dx;
    return (cell.lower < 0 || layerTileAt(map, 1, index) === cell.lower)
      && (cell.upper < 0 || layerTileAt(map, 3, index) === cell.upper);
  });
}

/** Detect complete, unrecorded kits by their authored tile pattern. */
export function assertWholeKits(
  project: Project, map: GameMap, area: Rect, transform?: KitTransform,
): void {
  const positions = new Map<number, { x: number; y: number }[]>();
  forEachCell(area, (x, y) => {
    const index = y * map.width + x;
    const tile = layerTileAt(map, 3, index);
    if (tile < 0 || (transform && tile === layerTileAt(transform.next, 3, index))) return;
    const occurrences = positions.get(tile) ?? [];
    occurrences.push({ x, y });
    positions.set(tile, occurrences);
  });
  if (!positions.size) return;

  for (const kit of getTileset(project, map).structureKits ?? []) {
    if (kit.width * kit.height < 2) continue;
    const cells: KitCell[] = [];
    kit.rows.forEach((row, dy) => {
      for (let dx = 0; dx < kit.width; dx++) {
        const lower = row.tiles[dx] ?? -1;
        const upper = row.upperTiles?.[dx] ?? -1;
        if (lower >= 0 || upper >= 0) cells.push({ dx, dy, lower, upper });
      }
    });
    if (cells.length < 2) continue;
    for (const anchor of cells) {
      for (const point of positions.get(anchor.upper) ?? []) {
        const x = point.x - anchor.dx;
        const y = point.y - anchor.dy;
        if (x < 0 || y < 0 || x + kit.width > map.width || y + kit.height > map.height) continue;
        const inside = (rect: Rect) => cells.every(cell => includesCell(rect, x + cell.dx, y + cell.dy));
        if (transform?.movingFrom && inside(transform.movingFrom)) continue;
        const complete = inside(area);
        if (complete && !transform?.mirror) continue;
        if (!matchesAt(map, cells, x, y)) continue;
        if (!complete) throw new PrimitiveError("선택한 영역에 여러 칸짜리 물건의 일부만 들어 있어요.");

        // A whole prop can change position if its stitched image still matches at the mirrored location.
        if (!transform?.mirror) continue;
        const offsets = cells.map(cell => transform.mirror === "horizontal" ? cell.dx : cell.dy);
        const span = Math.min(...offsets) + Math.max(...offsets);
        const mirroredX = transform.mirror === "horizontal" ? 2 * area.x + area.w - 1 - x - span : x;
        const mirroredY = transform.mirror === "vertical" ? 2 * area.y + area.h - 1 - y - span : y;
        if (!matchesAt(transform.next, cells, mirroredX, mirroredY)) {
          throw new PrimitiveError("여러 칸짜리 물건의 그림이 조각나요. 물건을 선택해서 편집해 주세요.");
        }
      }
    }
  }
}

export function assertNoNewHardClusterViolations(before: Project, after: Project, mapId: string): void {
  const hardIssues = (project: Project) => clusterRuleLintIssues(project, [mapId])
    .filter(issue => issue.severity === "error")
    .map(issue => JSON.stringify([issue.code, issue.mapId, issue.x, issue.y]));
  const existing = new Set(hardIssues(before));
  if (hardIssues(after).some(issue => !existing.has(issue))) {
    throw new PrimitiveError("타일에 딸린 조각을 함께 선택해 주세요.");
  }
}
