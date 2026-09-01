import { tileAt } from "@/project/collision";
import { roleCapabilities } from "@/project/tileRoles";
import { isBlockedPassage } from "@/project/tilesetPassage";
import {
  paletteRolesForTile,
  primaryTileRole,
  tileCategoriesForTile,
} from "@/project/tilesetPalette";
import type { LintIssue } from "@/project/lint/projectLint";
import type { GameMap, PaletteSlotRole, Project, TilesetDef } from "@/project/types";

type CategoryCompatibility = Record<PaletteSlotRole, readonly PaletteSlotRole[]>;

export const TILE_CATEGORY_INCOMPATIBILITY: CategoryCompatibility = {
  ground: [],
  path: ["furniture", "roof"],
  wall: ["water"],
  water: ["furniture", "roof", "wall"],
  decor: [],
  boundary: [],
  roof: ["path", "water"],
  furniture: ["path", "water"],
};

const PALETTE_ROLE_SET = new Set<string>(([
  "ground",
  "path",
  "wall",
  "water",
  "decor",
  "boundary",
  "roof",
  "furniture",
] as const));

export function lintTilesetPalettes(project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const map of Object.values(project.maps)) {
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) continue;
    checkTileDiversity(map, tileset, issues);
    checkAwkwardBoundaries(map, tileset, issues);
    checkPassageConsistency(map, tileset, issues);
  }
  return issues;
}

function checkTileDiversity(map: GameMap, tileset: TilesetDef, issues: LintIssue[]): void {
  const presets = tileset.palettePresets ?? [];
  if (presets.length === 0) return;
  const usedTiles = usedTileSet(map);
  const slots = presets.flatMap((preset) => preset.slots.map((slot) => ({ preset, slot })));
  const covered = slots.filter(({ slot }) => slot.tileIds.some((tile) => usedTiles.has(tile))).length;
  const ratio = slots.length > 0 ? covered / slots.length : 0;
  issues.push({
    severity: "info",
    code: "tileset-palette-diversity",
    mapId: map.id,
    message: `타일 다양성: ${map.name} 고유 타일 ${usedTiles.size}개, 프리셋 slot 커버리지 ${covered}/${slots.length} (${ratio.toFixed(2)})`,
  });
}

function checkAwkwardBoundaries(map: GameMap, tileset: TilesetDef, issues: LintIssue[]): void {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      checkBoundaryPair(map, tileset, x, y, x + 1, y, issues);
      checkBoundaryPair(map, tileset, x, y, x, y + 1, issues);
    }
  }
}

function checkBoundaryPair(
  map: GameMap,
  tileset: TilesetDef,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  issues: LintIssue[]
): void {
  if (bx >= map.width || by >= map.height) return;
  const left = visibleTile(map, ax, ay);
  const right = visibleTile(map, bx, by);
  if (left < 0 || right < 0 || left === right) return;
  const leftCategory = paletteCategory(tileset, left);
  const rightCategory = paletteCategory(tileset, right);
  if (!leftCategory || !rightCategory) return;
  if (!isIncompatible(leftCategory, rightCategory)) return;
  issues.push({
    severity: "warning",
    code: "tileset-palette-boundary",
    mapId: map.id,
    x: ax,
    y: ay,
    message: `경계 어색도: ${map.name} (${ax},${ay}) ${leftCategory} 타일 ${left} ↔ (${bx},${by}) ${rightCategory} 타일 ${right}`,
  });
}

function checkPassageConsistency(map: GameMap, tileset: TilesetDef, issues: LintIssue[]): void {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = visibleTile(map, x, y);
      if (tile < 0 || tile >= tileset.count) continue;
      const role = primaryTileRole(tileset, tile);
      if (role === null) continue;
      const expected = roleCapabilities(tileset, role).expectedPassage;
      if (expected === undefined) continue;
      const blocked = isBlockedPassage(tileset.passability[tile]);
      const violated = expected === "passable" ? blocked : !blocked;
      if (!violated) continue;
      issues.push({
        severity: "warning",
        code: "tileset-palette-passage",
        mapId: map.id,
        x,
        y,
        message: expected === "passable"
          ? `통행 일관성: ${role} 역할 타일 ${tile}이 통행 불가입니다 (${map.name} ${x},${y})`
          : `통행 일관성: ${role} 역할 타일 ${tile}이 통행 가능입니다 (${map.name} ${x},${y})`,
      });
    }
  }
}

function usedTileSet(map: GameMap): ReadonlySet<number> {
  const tiles = new Set<number>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const cell = tileAt(map, x, y);
      if (cell.lower >= 0) tiles.add(cell.lower);
      if (cell.upper >= 0) tiles.add(cell.upper);
    }
  }
  return tiles;
}

function visibleTile(map: GameMap, x: number, y: number): number {
  const cell = tileAt(map, x, y);
  return cell.upper >= 0 ? cell.upper : cell.lower;
}

function paletteCategory(tileset: TilesetDef, tile: number): PaletteSlotRole | null {
  for (const category of tileCategoriesForTile(tileset, tile)) {
    if (PALETTE_ROLE_SET.has(category)) return category as PaletteSlotRole;
  }
  return paletteRolesForTile(tileset, tile)[0] ?? null;
}

function isIncompatible(left: PaletteSlotRole, right: PaletteSlotRole): boolean {
  return TILE_CATEGORY_INCOMPATIBILITY[left].includes(right) || TILE_CATEGORY_INCOMPATIBILITY[right].includes(left);
}
