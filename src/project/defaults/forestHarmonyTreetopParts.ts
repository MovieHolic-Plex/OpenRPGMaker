import parts from "@/assets/forestHarmonyTreetopParts.json";
import type { AutotileGroup, PassFlag, TileAiMetadata, TileGraft, TileGroupMetadata, TilesetDef } from "../types";
import { FOREST_HARMONY_HOUSE_PARTS_END, tilesetHasHouseParts } from "./forestHarmonyHouseParts";

// 나무 위 마을 칸(3131~) — 판자 데크 오토타일·밧줄 다리·큰 나무 줄기 집·밧줄 사다리·요정 등불·깊은 숲 손 도트.
// 장소 「엘프 나무 위 마을」(tiledata/elf-treetop)이 쓴다. 원본: scripts/content/elf-treetop.py →
// public/assets/forest-harmony/treetop-parts.png + src/assets/forestHarmonyTreetopParts.json.
// 집 부품(3060~3130) 바로 뒤에 붙는다 — 집 부품이 제 번호로 있을 때만 늘린다.

type PartSlot = { name: string; passability: PassFlag; priority: "lower" | "upper"; terrain: number; tileMeta: TileAiMetadata };
const PARTS = parts as unknown as {
  textureKey: string; start: number; count: number; frames: number; grafts: TileGraft[]; slots: PartSlot[];
  autotileGroups: AutotileGroup[]; tileGroups: TileGroupMetadata[];
};

export const FOREST_HARMONY_TREETOP_START = PARTS.start;
export const FOREST_HARMONY_TREETOP_END = PARTS.count;
export const FOREST_HARMONY_TREETOP_TEXTURE = PARTS.textureKey;

const sameGraft = (a: TileGraft, b: TileGraft) => a.sourceChipset === b.sourceChipset && a.sourceTile === b.sourceTile;

/** 이 타일셋이 나무 위 마을 칸을 제 번호로 갖고 있는가. */
export function tilesetHasTreetopParts(tileset: TilesetDef | undefined): boolean {
  if (!tileset || !tilesetHasHouseParts(tileset) || tileset.count < PARTS.count) return false;
  const byTarget = new Map((tileset.tileGrafts ?? []).map(graft => [graft.targetTile, graft]));
  return PARTS.grafts.every(graft => { const own = byTarget.get(graft.targetTile); return own !== undefined && sameGraft(own, graft); });
}

/**
 * forest_harmony 를 나무 위 마을 칸까지 늘리고 데크 오토타일·조각 묶음을 붙인다. 집 부품 칸이 제 번호로 없거나
 * 그 번호에 다른 이식이 이미 있으면(프로젝트가 따로 쓴 자리) 건드리지 않는다. 바뀌었으면 true.
 */
export function ensureForestHarmonyTreetopParts(tileset: TilesetDef): boolean {
  if (!tilesetHasHouseParts(tileset) || PARTS.start !== FOREST_HARMONY_HOUSE_PARTS_END) return false;
  const wanted = new Map(PARTS.grafts.map(graft => [graft.targetTile, graft]));
  const own = (tileset.tileGrafts ?? []).filter(graft => graft.targetTile >= PARTS.start && graft.targetTile < PARTS.count);
  for (const graft of own) {
    const expected = wanted.get(graft.targetTile);
    if (!expected || !sameGraft(expected, graft)) return false;
  }
  if (tileset.count > PARTS.start && own.length === 0) return false;
  let changed = false;
  const have = new Set(own.map(graft => graft.targetTile));
  const missing = PARTS.grafts.filter(graft => !have.has(graft.targetTile));
  if (missing.length > 0 || tileset.count < PARTS.count) {
    tileset.tileMeta ??= [];
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
    changed = true;
  }
  const autotileIds = new Set((tileset.autotileGroups ?? []).map(group => group.id));
  const newAutotiles = PARTS.autotileGroups.filter(group => !autotileIds.has(group.id));
  if (newAutotiles.length > 0) { tileset.autotileGroups = [...(tileset.autotileGroups ?? []), ...structuredClone(newAutotiles)]; changed = true; }
  const groupIds = new Set((tileset.tileGroups ?? []).map(group => group.id));
  const newGroups = PARTS.tileGroups.filter(group => !groupIds.has(group.id));
  if (newGroups.length > 0) { tileset.tileGroups = [...(tileset.tileGroups ?? []), ...structuredClone(newGroups)]; changed = true; }
  return changed;
}
