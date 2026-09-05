// AI 타일 시공 후검증. 커밋을 막지 않는 warning 만 낸다.
// 지붕은 집(벽 연결 성분) 단위로 덮였는지 보고, 나무는 요청 대비 하층식생·0그루를 본다.
// repairTreePairs(밑동-수관 보정)와 layoutValidationBlocking 을 대체하지 않는다.

import type { GameMap, Project, TilesetDef } from "@/project/types";
import { LAYOUT_TREE_CANOPY_IDS, LAYOUT_TREE_TRUNK_IDS } from "./layoutPlacementValidate";
import type { LintIssue } from "./projectLint";

export interface PostTileCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly data: unknown;
}

type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type Bounds = { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number };

const TREE_TOOLS = new Set(["place_props", "scatter_object", "tile_scatter"]);
const TREE_INTENT = /나무|침엽|활엽|숲|수목|tree|forest|conifer|broadleaf/i;
const FURNITURE_EXCLUDE = /상자|바닥|가구|문|탁자|테이블|의자|box|furniture|floor|door|table|chest/i;

export function verifyPostTilePlacement(project: Project, call: PostTileCall): LintIssue[] {
  if (call.name === "build_roof") return verifyRoofForCall(project, call);
  if (TREE_TOOLS.has(call.name)) return verifyTrees(project, call);
  return [];
}

export function verifyPlacedTiles(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const map of Object.values(project.maps)) {
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) continue;
    issues.push(...roofIssuesForComponents(map, tileset, wallComponents(map, wallTileIds(tileset)), null));
  }
  return issues;
}

function asMap(project: Project, call: PostTileCall): GameMap | null {
  const mapId = call.args["mapId"];
  if (typeof mapId !== "string") return null;
  return project.maps[mapId] ?? null;
}

function asRect(value: unknown): Rect | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const { x, y, w, h } = record;
  if (![x, y, w, h].every((entry) => typeof entry === "number" && Number.isInteger(entry))) return null;
  return { x: x as number, y: y as number, w: w as number, h: h as number };
}

function callData(call: PostTileCall): Record<string, unknown> {
  return typeof call.data === "object" && call.data !== null ? (call.data as Record<string, unknown>) : {};
}

function verifyRoofForCall(project: Project, call: PostTileCall): LintIssue[] {
  const map = asMap(project, call);
  if (!map) return [];
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return [];
  const data = callData(call);
  const wallRect = asRect(data["wallRegion"]) ?? asRect(call.args["wallRect"]);
  const roofRect = asRect(data["roofRegion"]) ?? wallRect;
  if (!roofRect) return [];
  const components = wallComponents(map, wallTileIds(tileset));
  const seeded = wallRect
    ? components.filter((bounds) => intersects(bounds, wallRect))
    : components;
  return roofIssuesForComponents(map, tileset, seeded, roofRect);
}

function roofIssuesForComponents(
  map: GameMap,
  tileset: TilesetDef,
  components: readonly Bounds[],
  roofRect: Rect | null,
): LintIssue[] {
  const issues: LintIssue[] = [];
  const roofIds = roofTileIds(tileset);
  for (const bounds of components) {
    const wallWidth = bounds.maxX - bounds.minX + 1;
    if (wallWidth <= 0) continue;
    const covered = roofRect
      ? overlapWidth(roofRect, bounds)
      : roofSpanOverComponent(map, roofIds, bounds);
    if (covered <= 0) continue;
    const uncovered = wallWidth - covered;
    if (uncovered <= 0) continue;
    issues.push({
      severity: "warning",
      code: "post-roof-incomplete",
      mapId: map.id,
      x: bounds.minX,
      y: bounds.minY,
      message: `지붕 미완성: 벽 ${wallWidth}칸 중 ${uncovered}칸이 지붕 밖에 있습니다. 벽 전체를 덮도록 wallRect를 넓히세요.`,
    });
  }
  return issues;
}

function overlapWidth(roofRect: Rect, bounds: Bounds): number {
  return Math.max(0, Math.min(roofRect.x + roofRect.w, bounds.maxX + 1) - Math.max(roofRect.x, bounds.minX));
}

function roofSpanOverComponent(map: GameMap, roofIds: ReadonlySet<number>, bounds: Bounds): number {
  const y0 = Math.max(0, bounds.minY - 4);
  const y1 = Math.min(map.height - 1, bounds.minY);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const index = y * map.width + x;
      if (!roofIds.has(map.lowerTiles[index] ?? -1) && !roofIds.has(map.upperTiles[index] ?? -1)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (minX > maxX) return 0;
  return maxX - minX + 1;
}

function intersects(bounds: Bounds, rect: Rect): boolean {
  return !(bounds.maxX < rect.x || bounds.minX >= rect.x + rect.w || bounds.maxY < rect.y || bounds.minY >= rect.y + rect.h);
}

function wallTileIds(tileset: TilesetDef): Set<number> {
  const ids = new Set<number>();
  for (const group of tileset.tileGroups ?? []) {
    if (group.role !== "wall") continue;
    for (const tile of group.tileIds) ids.add(tile);
  }
  return ids;
}

function roofTileIds(tileset: TilesetDef): Set<number> {
  const ids = new Set<number>();
  for (const group of tileset.tileGroups ?? []) {
    if (group.role !== "roof") continue;
    for (const tile of group.tileIds) ids.add(tile);
  }
  return ids;
}

function isWallCell(map: GameMap, wallIds: ReadonlySet<number>, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return wallIds.has(map.lowerTiles[y * map.width + x] ?? -1);
}

function wallComponents(map: GameMap, wallIds: ReadonlySet<number>): Bounds[] {
  const seen = new Uint8Array(map.width * map.height);
  const components: Bounds[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const start = y * map.width + x;
      if (seen[start] || !isWallCell(map, wallIds, x, y)) continue;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [start];
      seen[start] = 1;
      while (stack.length > 0) {
        const current = stack.pop()!;
        const cx = current % map.width;
        const cy = (current / map.width) | 0;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neighbors: ReadonlyArray<readonly [number, number]> = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (!isWallCell(map, wallIds, nx, ny)) continue;
          const next = ny * map.width + nx;
          if (seen[next]) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
      components.push({ minX, maxX, minY, maxY });
    }
  }
  return components;
}

function treeMaterialLabels(data: unknown): readonly string[] {
  if (typeof data !== "object" || data === null) return [];
  const materials = (data as Record<string, unknown>)["materials"];
  if (!Array.isArray(materials)) return [];
  return materials.filter((entry): entry is string => typeof entry === "string");
}

function isTreeMaterial(label: string): boolean {
  return TREE_INTENT.test(label) && !FURNITURE_EXCLUDE.test(label);
}

function isTreeTile(tile: number): boolean {
  return LAYOUT_TREE_CANOPY_IDS.has(tile) || LAYOUT_TREE_TRUNK_IDS.has(tile);
}

function verifyTrees(project: Project, call: PostTileCall): LintIssue[] {
  const map = asMap(project, call);
  if (!map) return [];
  const materials = treeMaterialLabels(call.data);
  if (materials.length > 0) {
    if (materials.some(isTreeMaterial)) return [];
    return [{
      severity: "warning",
      code: "post-tree-only-undergrowth",
      mapId: map.id,
      message: `나무 없이 하층식생만 깔렸습니다(${materials.join("·")}). 나무를 요청했다면 밀도·재료를 확인하세요.`,
    }];
  }
  const material = call.args["material"];
  const expectsTrees = typeof material === "string" && isTreeMaterial(material);
  if (!expectsTrees) return [];
  const region = asRect(call.args["area"]) ?? { x: 0, y: 0, w: map.width, h: map.height };
  let treeCells = 0;
  for (let y = region.y; y < region.y + region.h; y += 1) {
    for (let x = region.x; x < region.x + region.w; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const index = y * map.width + x;
      if (isTreeTile(map.upperTiles[index] ?? -1) || isTreeTile(map.lowerTiles[index] ?? -1)) treeCells += 1;
    }
  }
  if (treeCells > 0) return [];
  return [{
    severity: "warning",
    code: "post-tree-missing",
    mapId: map.id,
    message: `「${material}」를 요청했으나 영역 안에 나무 타일이 없습니다. 육지·빈 상위 칸을 확인하세요.`,
  }];
}
