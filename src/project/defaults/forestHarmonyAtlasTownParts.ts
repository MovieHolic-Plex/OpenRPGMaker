import parts from "@/assets/forestHarmonyAtlasTownParts.json";
import type { PassFlag, TileAiMetadata, TileGraft, TileGroupMetadata, TilesetDef } from "../types";
import { FOREST_HARMONY_TREETOP_END, tilesetHasTreetopParts } from "./forestHarmonyTreetopParts";

// 마을·도시 부품 칸(3311~) — 범선 「푸른물결호」(EasyRPG 배 칩셋 CC0 굽기)·광장 분수·줄무늬 차양 노점·불길·연기·잿자리·
// 그을린 들보·비계·축제 깃발 줄·등롱 줄·등롱 기둥·온천 김·가죽 천막·토템·해골 창·전투 깃발 손 도트.
// 장소 묶음 「마을·도시 지도첩」(tiledata/atlas-towns)이 쓴다. 원본: scripts/content/bake-atlas-town-parts.py →
// public/assets/forest-harmony/atlas-town-parts.png + src/assets/forestHarmonyAtlasTownParts.json.
// 나무 위 마을 칸(3131~3310) 바로 뒤에 붙는다 — 그 칸이 제 번호로 있을 때만 늘린다. 이 범위의 끝은 3610(분야 A 소유).

type PartSlot = { name: string; passability: PassFlag; priority: "lower" | "upper"; terrain: number; tileMeta: TileAiMetadata };
const PARTS = parts as unknown as {
  textureKey: string; start: number; count: number; frames: number; grafts: TileGraft[]; slots: PartSlot[]; tileGroups: TileGroupMetadata[];
};

export const FOREST_HARMONY_ATLAS_TOWN_START = PARTS.start;
export const FOREST_HARMONY_ATLAS_TOWN_END = PARTS.count;
export const FOREST_HARMONY_ATLAS_TOWN_TEXTURE = PARTS.textureKey;

const sameGraft = (a: TileGraft, b: TileGraft) => a.sourceChipset === b.sourceChipset && a.sourceTile === b.sourceTile;

/** 이 타일셋이 마을·도시 부품 칸을 제 번호로 갖고 있는가. */
export function tilesetHasAtlasTownParts(tileset: TilesetDef | undefined): boolean {
  if (!tileset || !tilesetHasTreetopParts(tileset) || tileset.count < PARTS.count) return false;
  const byTarget = new Map((tileset.tileGrafts ?? []).map(graft => [graft.targetTile, graft]));
  return PARTS.grafts.every(graft => { const own = byTarget.get(graft.targetTile); return own !== undefined && sameGraft(own, graft); });
}

/**
 * forest_harmony 를 마을·도시 부품 칸까지 늘리고 조각 묶음을 붙인다. 나무 위 마을 칸이 제 번호로 없거나
 * 그 번호에 다른 이식이 이미 있으면(프로젝트가 따로 쓴 자리) 건드리지 않는다. 바뀌었으면 true.
 */
export function ensureForestHarmonyAtlasTownParts(tileset: TilesetDef): boolean {
  if (!tilesetHasTreetopParts(tileset) || PARTS.start !== FOREST_HARMONY_TREETOP_END) return false;
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
  const groupIds = new Set((tileset.tileGroups ?? []).map(group => group.id));
  const newGroups = PARTS.tileGroups.filter(group => !groupIds.has(group.id));
  if (newGroups.length > 0) { tileset.tileGroups = [...(tileset.tileGroups ?? []), ...structuredClone(newGroups)]; changed = true; }
  return changed;
}
