import type { GameMap, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { tilesetHasHouseParts } from "@/project/defaults/forestHarmonyHouseParts";
import { layerTileAt } from "@/project/mapLayers";
import { terrainHeight, terrainSightObstacle } from "@/project/terrainGameplay";
import { appendStructurePlacement, captureStructureTiles, structurePlacementsOf, structurePlacementAt, structurePlacementIsOverpainted, restoreStructurePlacementTiles, removeStructurePlacement, cellsOwnedByLaterPlacements } from "@/project/structurePlacements";
import { HOUSE_KITS, houseKitForTileset, mixableHouseKitIds, rectHouseHeight, stampRectHouseKit, type HouseKitId } from "./houseKit";
import { structureKitFromMapRegion } from "./harnessSuggestion/structureKitModel";
import { terrainEditable, type TerrainDesignPlan } from "./terrainDesignPlans";
import { terrainIsReserved } from "./terrainMaterials";
import { BEODEUL_HOUSE_STYLES, beodeulHouseStyles, beodeulHouseMinWidth, isBeodeulHouseStyle, quickBeodeulHouse, type BeodeulHouseStyle } from "./beodeulQuickHouse";
import type { TerrainPoint } from "./terrainDesignGeometry";

export type QuickHouseStyle = HouseKitId | BeodeulHouseStyle;
export interface QuickHouseOptions { style: QuickHouseStyle; width: number; stories: 1 | 2; kitId?: string | null; roofBodyRows?: number; height?: number; resize?: "house" | "roof"; roofWidth?: number }
export function quickHouseOptions(s: Pick<import("./editorState").EditorState, "terrainHouseStyle" | "terrainHouseWidth" | "terrainHouseStories" | "terrainHouseKitId" | "terrainHouseResize" | "terrainHouseRoofWidth">): QuickHouseOptions {
  return { style: s.terrainHouseStyle, width: s.terrainHouseWidth, stories: s.terrainHouseStories, kitId: s.terrainHouseKitId, resize: s.terrainHouseResize,
    ...(s.terrainHouseResize === "roof" ? { roofWidth: s.terrainHouseRoofWidth } : {}) };
}
export interface QuickHouseDrag { mapId: string; start: TerrainPoint; end: TerrainPoint }
export function quickHouseCatalog(tileset: TilesetDef): SectionStructureKitDef[] {
  return (tileset.structureKits ?? []).filter((k): k is SectionStructureKitDef => k.kind === "section" && k.width <= 24 && k.height <= 24
    && !!k.parts?.some(p => p.kind === "entrance") && /house|home|집|주택|저택|여관|상점|대장간|성당|창고/i.test(`${k.id} ${k.name} ${k.ai?.tags?.join(" ")}`))
    .sort((a, b) => Number(!/살림집|cottage/i.test(a.name ?? "")) - Number(!/살림집|cottage/i.test(b.name ?? "")));
}
export function quickHouseStyles(tileset: TilesetDef): readonly QuickHouseStyle[] {
  if (tileset.id === "beodeul_city") return beodeulHouseStyles(tileset);
  if (tileset.tileSize !== 16 || ![COMBINED_TOWN_TILESET_ID, "forest_harmony"].includes(tileset.id)) return [];
  return mixableHouseKitIds(tilesetHasHouseParts(tileset));
}
export function quickHouseStyleName(style: QuickHouseStyle): string { return isBeodeulHouseStyle(style) ? BEODEUL_HOUSE_STYLES[style] : HOUSE_KITS[style].name; }
export function quickHouseMinWidth(style: QuickHouseStyle): number { return isBeodeulHouseStyle(style) ? beodeulHouseMinWidth(style) : 5; }
const kits = new Map<string, SectionStructureKitDef>();
/** Public house assembler: actual lower roofs/walls and transparent upper caps, never copied raster art. */
export function quickHouseKit(tileset: TilesetDef, options: QuickHouseOptions): SectionStructureKitDef | undefined {
  const catalog = quickHouseCatalog(tileset);
  const selected = options.kitId ? catalog.find(k => k.id === options.kitId) : undefined;
  if (selected) return selected;
  const styles = quickHouseStyles(tileset);
  if (!styles.length) return catalog[0];
  const chosen = styles.includes(options.style) ? options.style : styles[0]!;
  if (isBeodeulHouseStyle(chosen)) return quickBeodeulHouse(tileset, { ...options, style: chosen });
  const style = houseKitForTileset(chosen, tilesetHasHouseParts(tileset)), width = Math.max(5, Math.min(24, Math.round(options.width)));
  const roofBodyRows = Math.max(1, Math.min(12, Math.round(options.roofBodyRows ?? 2)));
  const plan = { x: 0, y: 0, width, stories: options.stories, roofBodyRows, kitId: style }, height = rectHouseHeight(plan);
  const id = `quick_house_${style}_${width}_${options.stories}${roofBodyRows === 2 ? "" : `_roof${roofBodyRows}`}`, old = kits.get(id); if (old) return old;
  const map = { width, height, lowerTiles: Array(width * height).fill(TILE.EMPTY), upperTiles: Array(width * height).fill(TILE.EMPTY) } as GameMap;
  const result = stampRectHouseKit(map, plan); if (!result.ok || !result.doorAt) return undefined;
  const door = result.doorAt;
  map.lowerTiles[(door.y - 1) * width + door.x] = 329;
  map.lowerTiles[door.y * width + door.x] = 359;
  const kit = structureKitFromMapRegion(map, { x: 0, y: 0, width, height }, { id, name: `${HOUSE_KITS[style].name} · ${width}×${height}칸 · ${options.stories}층` });
  kit.learnedFrom = "db-authored"; kit.createdAt = "2026-10-03T00:00:00.000Z"; kit.tileSize = 16;
  kit.parts = [{ id: "door", kind: "entrance", dx: door.x, dy: door.y - 1, w: 1, h: 2 }];
  kits.set(id, kit); return kit;
}
export interface QuickHousePlan extends TerrainDesignPlan { kit?: SectionStructureKitDef; x: number; y: number; resizedPlacementId?: string }
/** A click keeps the door anchor; a rectangle uses its top left and repeats authored house parts. */
export function planQuickHouseDrag(map: GameMap, tileset: TilesetDef, drag: QuickHouseDrag, options: QuickHouseOptions): QuickHousePlan {
  const single = drag.start.x === drag.end.x && drag.start.y === drag.end.y;
  const width = single ? options.roofWidth ?? options.width : Math.abs(drag.end.x - drag.start.x) + 1;
  const height = Math.abs(drag.end.y - drag.start.y) + 1;
  if (options.resize === "roof" && tileset.id === "beodeul_city") {
    const existing = structurePlacementAt(map, drag.start.x, drag.start.y);
    if (existing) {
      const original = tileset.structureKits?.find(k => k.id === existing.kitId);
      const parsed = /^quick_house_(beodeul-(?:manor-(?:a|b|lit)|log-(?:green|blue|red)))_(\d+)_(\d+)/.exec(existing.kitId);
      const oldRoof = original?.parts?.find(p => p.id === "roof"), oldWalls = original?.parts?.find(p => p.id === "walls");
      const roofHeight = oldRoof?.h ?? 3;
      const rejected: QuickHousePlan = { ok: false, reason: "조립식 집의 지붕에서 끌어 주세요", indices: [], x: existing.x, y: existing.y };
      if (!original || !parsed || drag.start.y >= existing.y + roofHeight) return rejected;
      if (structurePlacementIsOverpainted(map, existing)) { rejected.reason = "직접 덧칠한 집은 보호합니다. 구조물에서 먼저 수정해 주세요"; return rejected; }
      const later = cellsOwnedByLaterPlacements(map, existing.id);
      for (let y = existing.y; y < existing.y + existing.h; y++) for (let x = existing.x; x < existing.x + existing.w; x++) if (later.has(y * map.width + x)) {
        rejected.reason = "다른 구조물이 겹친 집은 지붕을 바꿀 수 없습니다"; return rejected;
      }
      const style = parsed[1] as BeodeulHouseStyle, wallWidth = oldWalls?.w ?? Number(parsed[2]);
      const wallHeight = oldWalls?.h ?? existing.h - roofHeight, wallX = existing.x + (oldWalls?.dx ?? 0), wallY = existing.y + roofHeight;
      const newRoofRows = roofHeight;
      const resized = { ...options, kitId: null, style, width: wallWidth, roofWidth: width, roofRows: newRoofRows, height: newRoofRows + wallHeight };
      const oldDoor = original.parts?.find(p => p.kind === "entrance"); if (!oldDoor) return rejected;
      const anchor = { x: existing.x + oldDoor.dx, y: existing.y + oldDoor.dy + oldDoor.h - 1 };
      const restored: GameMap = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles], structurePlacements: [...structurePlacementsOf(map)],
        lowerTileStacks: map.lowerTileStacks && { ...map.lowerTileStacks }, upperTileStacks: map.upperTileStacks && { ...map.upperTileStacks },
        events: map.events.filter(e => !(e.x >= wallX && e.x < wallX + wallWidth && e.y >= wallY && e.y < wallY + wallHeight)) };
      restoreStructurePlacementTiles(restored, existing); removeStructurePlacement(restored, existing.id);
      const plan = planQuickHouse(restored, tileset, anchor, resized), apply = plan.apply;
      plan.resizedPlacementId = existing.id;
      for (let y = existing.y; y < existing.y + existing.h; y++) for (let x = existing.x; x < existing.x + existing.w; x++) plan.indices.push(y * map.width + x);
      plan.indices = [...new Set(plan.indices)];
      if (plan.ok && apply) {
        plan.reason = "지붕 크기 변경 · 벽·창·문 위치 유지";
        plan.apply = draft => { const position = structurePlacementsOf(draft).findIndex(p => p.id === existing.id); restoreStructurePlacementTiles(draft, existing); removeStructurePlacement(draft, existing.id); apply(draft); const replacement = draft.structurePlacements!.pop()!; replacement.id = existing.id; draft.structurePlacements!.splice(position, 0, replacement); };
      }
      return plan;
    }
    if (single) return planQuickHouse(map, tileset, drag.start, options);
    const sized = { ...options, kitId: null, roofWidth: width }, kit = quickHouseKit(tileset, sized), door = kit?.parts?.find(p => p.kind === "entrance");
    return planQuickHouse(map, tileset, { x: Math.min(drag.start.x, drag.end.x) + (door?.dx ?? 0), y: Math.min(drag.start.y, drag.end.y) + (door ? door.dy + door.h - 1 : 0) }, sized);
  }
  if (single) return planQuickHouse(map, tileset, drag.start, options);
  const wallAndCaps = rectHouseHeight({ kitId: isBeodeulHouseStyle(options.style) ? "blue-stone" : options.style, stories: options.stories, roofBodyRows: 1 }) - 1;
  const sized = { ...options, width, height, roofBodyRows: height - wallAndCaps }, kit = quickHouseKit(tileset, sized), door = kit?.parts?.find(p => p.kind === "entrance");
  const x = Math.min(drag.start.x, drag.end.x), y = Math.min(drag.start.y, drag.end.y);
  return planQuickHouse(map, tileset, { x: x + (door?.dx ?? 0), y: y + (door ? door.dy + door.h - 1 : 0) }, sized);
}

/** Anchor is the front door, so the road approach remains the next cell south. */
export function planQuickHouse(map: GameMap, tileset: TilesetDef, anchor: TerrainPoint, options: QuickHouseOptions): QuickHousePlan {
  const kit = quickHouseKit(tileset, options), door = kit?.parts?.find(p => p.kind === "entrance");
  const x = anchor.x - (door?.dx ?? Math.floor((kit?.width ?? options.width) / 2)), y = anchor.y - (door ? door.dy + door.h - 1 : (kit?.height ?? 1) - 1);
  const out: QuickHousePlan = { ok: false, reason: "이 칩셋에서는 기본 집 외관을 사용할 수 없습니다", indices: [], kit, x, y };
  if (!kit) return out;
  for (let dy = 0; dy < kit.height; dy++) for (let dx = 0; dx < kit.width; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < map.width && y + dy < map.height) out.indices.push((y + dy) * map.width + x + dx);
  if (out.indices.length !== kit.width * kit.height || anchor.y + 1 >= map.height) { out.reason = "집과 문 앞 공간이 맵 안에 들어오게 놓으세요"; return out; }
  const level = terrainHeight(map, anchor.x, anchor.y), placements = structurePlacementsOf(map);
  for (const i of out.indices) {
    const cx = i % map.width, cy = Math.floor(i / map.width);
    if (!terrainEditable(map, i) || layerTileAt(map, 2, i) >= 0 || terrainIsReserved(map, tileset, i) || terrainSightObstacle(map, cx, cy, tileset)
      || placements.some(p => cx >= p.x && cx < p.x + p.w && cy >= p.y && cy < p.y + p.h)) { out.reason = "잠금·물·도로·물체를 피해 빈 땅에 놓으세요"; return out; }
    if (Math.abs(terrainHeight(map, cx, cy) - level) > .05) { out.reason = "집 전체가 같은 높이의 땅에 들어오게 놓으세요"; return out; }
  }
  const front = { x: anchor.x, y: anchor.y + 1 }, frontIndex = front.y * map.width + front.x;
  const pass = tileset.passability[layerTileAt(map, 1, frontIndex)];
  if (!terrainEditable(map, frontIndex) || (map.terrainDesign?.waterDepth?.[frontIndex] ?? 0) > 0 || pass && !pass.up && !pass.down && !pass.left && !pass.right || terrainSightObstacle(map, front.x, front.y, tileset) || Math.abs(terrainHeight(map, front.x, front.y) - level) > .05) { out.reason = "문 앞에 걸을 수 있는 공간이 필요합니다"; return out; }
  out.ok = true; out.reason = `${kit.name} 배치`;
  out.apply = draft => {
    const rect = { x, y, w: kit.width, h: kit.height }, before = captureStructureTiles(draft, rect);
    for (let row = 0; row < kit.height; row++) for (let col = 0; col < kit.width; col++) {
      const i = (y + row) * draft.width + x + col, lower = kit.rows[row]!.tiles[col] ?? TILE.EMPTY, upper = kit.rows[row]!.upperTiles?.[col] ?? TILE.EMPTY;
      if (lower !== TILE.EMPTY) draft.lowerTiles[i] = lower;
      if (upper !== TILE.EMPTY) draft.upperTiles[i] = upper;
    }
    appendStructurePlacement(draft, { kitId: out.kit!.id, rect, before });
  };
  return out;
}
