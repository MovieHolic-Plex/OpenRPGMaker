import parts from "@/assets/forestHarmonyHouseParts.json";
import type { PassFlag, TileAiMetadata, TileGraft, TilesetDef } from "../types";

// 숲마을 집 부품 칸(3060~) — 굴뚝·지붕창·현관 차양·박공 꼭대기 장식 손 도트. 박공 조합 형태(editor/gableHouseCompose)가
// 집마다 0~2개를 결정적으로 붙인다. 원본: scripts/content/build-forest-harmony-house-parts.py →
// public/assets/forest-harmony/house-parts.png + src/assets/forestHarmonyHouseParts.json.
// 번호를 3060 부터 띄운 이유: 공용 이식 꼬리(2550~2759)와 기후 시트 덧칸(~3029)이 자랄 자리를 비워 둔다.

type PartSlot = { name: string; passability: PassFlag; priority: "lower" | "upper"; terrain: number; tileMeta: TileAiMetadata };
const PARTS = parts as unknown as { textureKey: string; start: number; count: number; grafts: TileGraft[]; slots: PartSlot[] };

export const FOREST_HARMONY_HOUSE_PARTS_START = PARTS.start;
export const FOREST_HARMONY_HOUSE_PARTS_END = PARTS.count;

/** 부품 이름 → forest_harmony 칸 번호. */
export const HOUSE_PART_TILE: Readonly<Record<string, number>> = Object.fromEntries(
  PARTS.slots.map((slot, index) => [slot.name, PARTS.start + index]));

export function housePartTile(name: string): number {
  const tile = HOUSE_PART_TILE[name];
  if (tile === undefined) throw new Error(`집 부품 칸이 없다: ${name}`);
  return tile;
}

const sameGraft = (a: TileGraft, b: TileGraft) => a.sourceChipset === b.sourceChipset && a.sourceTile === b.sourceTile;

function isBundledForestHarmony(tileset: TilesetDef): boolean {
  return tileset.id === "forest_harmony" && tileset.image.type === "bundled" && tileset.image.id === "tex_forest_harmony"
    && tileset.tileSize === 16 && tileset.tilesPerRow === 30;
}

/** 이 타일셋이 집 부품 칸을 제 번호로 갖고 있는가 — 없으면(기후 시트·다른 이식이 선 자리) 부품을 붙이지 않는다. */
export function tilesetHasHouseParts(tileset: TilesetDef | undefined): boolean {
  if (!tileset || !isBundledForestHarmony(tileset) || tileset.count < PARTS.count) return false;
  const byTarget = new Map((tileset.tileGrafts ?? []).map(graft => [graft.targetTile, graft]));
  return PARTS.grafts.every(graft => { const own = byTarget.get(graft.targetTile); return own !== undefined && sameGraft(own, graft); });
}

/**
 * forest_harmony 를 집 부품 칸까지 늘린다. 그 번호에 다른 이식이 이미 있으면(프로젝트가 따로 쓴 자리) 건드리지 않는다.
 * 끝(count)과 3060 사이의 빈 칸은 투명·통행 가능 빈칸으로 채운다. 바뀌었으면 true.
 */
export function ensureForestHarmonyHouseParts(tileset: TilesetDef): boolean {
  if (!isBundledForestHarmony(tileset)) return false;
  const wanted = new Map(PARTS.grafts.map(graft => [graft.targetTile, graft]));
  const own = (tileset.tileGrafts ?? []).filter(graft => graft.targetTile >= PARTS.start && graft.targetTile < PARTS.count);
  for (const graft of own) {
    const expected = wanted.get(graft.targetTile);
    if (!expected || !sameGraft(expected, graft)) return false;
  }
  const have = new Set(own.map(graft => graft.targetTile));
  const missing = PARTS.grafts.filter(graft => !have.has(graft.targetTile));
  if (missing.length === 0 && tileset.count >= PARTS.count) return false;
  tileset.tileMeta ??= [];
  for (let tile = tileset.count; tile < PARTS.start; tile += 1) {
    tileset.passability[tile] = { up: true, down: true, left: true, right: true };
    tileset.priority[tile] = "lower";
    tileset.terrain[tile] = 0;
    tileset.tileMeta[tile] = { label: "", description: "" };
  }
  for (let tile = PARTS.start; tile < PARTS.count; tile += 1) {
    if (have.has(tile)) continue;
    const slot = PARTS.slots[tile - PARTS.start]!;
    tileset.passability[tile] = structuredClone(slot.passability);
    tileset.priority[tile] = slot.priority;
    tileset.terrain[tile] = slot.terrain;
    tileset.tileMeta[tile] = structuredClone(slot.tileMeta);
  }
  tileset.count = Math.max(tileset.count, PARTS.count);
  tileset.tileGrafts = [...(tileset.tileGrafts ?? []), ...structuredClone(missing)];
  return true;
}
