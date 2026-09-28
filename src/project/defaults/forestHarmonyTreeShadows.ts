import shadows from "@/assets/forestHarmonyTreeShadows.json";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import type { GameMap, PassFlag, TileAiMetadata, TilesetDef } from "../types";

// 숲마을 나무 밑 그림자 칸 — 밑동 칸의 투명 부분에만 드리우는 그림자와, 밑동 바로 아래 바닥의 발치 그림자.
// 원본: scripts/content/bake-forest-harmony-tree-shadows.py → public/assets/forest-harmony/tree-shadows.png +
// src/assets/forestHarmonyTreeShadows.json. 2026-09-27: 수관·낱그루 밑동이 밝은 잔디 위에 그대로 앉아
// 「나무 하단에 그림자가 없어 어색하다」는 지적.
//
// 번호를 고정하지 않는다: 굽이숲 수관(ensureForestGroveTileset)·지나가는 수관(ensureWalkableCanopy)처럼 **마지막 이식 뒤 새 줄**에
// 붙인다. 고정 번호(예: 3611)는 지나가는 수관 쌍둥이·탈것 이식이 먼저 차지할 수 있다. 칸 번호는 이식 원본(sourceChipset/sourceTile)으로
// 다시 찾으므로 어느 줄에 붙었든 같은 뜻이다. 칸은 필요할 때(나무를 심는 도구가 처음 호출될 때) 붙인다.

type Slot = { passability: PassFlag; priority: "lower" | "upper"; terrain: number; tileMeta: TileAiMetadata };
const PARTS = shadows as unknown as {
  textureKey: string; frames: number;
  /** 밑동 타일 → 그림자 시트의 칸 번호(0~frames-1). */
  trunk: Record<string, number>; foot: Record<string, number>; slots: Slot[];
};

export const FOREST_HARMONY_TREE_SHADOW_TEXTURE = PARTS.textureKey;
const TRUNK_SOURCE = new Map(Object.entries(PARTS.trunk).map(([tile, source]) => [Number(tile), source]));
const FOOT_SOURCE = new Map(Object.entries(PARTS.foot).map(([tile, source]) => [Number(tile), source]));

function isBundledForestHarmony(tileset: TilesetDef | undefined): tileset is TilesetDef {
  return tileset?.id === "forest_harmony" && tileset.image.type === "bundled" && tileset.image.id === "tex_forest_harmony"
    && tileset.tileSize === 16 && tileset.tilesPerRow === 30;
}

/** 그림자 시트 칸 번호 → 이 타일셋에서의 타일 번호. 한 칸이라도 없으면 null. */
function shadowSlots(tileset: TilesetDef): Map<number, number> | null {
  const bySource = new Map<number, number>();
  for (const graft of tileset.tileGrafts ?? []) {
    if (graft.sourceChipset === PARTS.textureKey && graft.targetTile < tileset.count) bySource.set(graft.sourceTile, graft.targetTile);
  }
  return bySource.size === PARTS.frames ? bySource : null;
}

/** 이 타일셋이 그림자 칸을 모두 갖고 있는가. */
export function tilesetHasTreeShadows(tileset: TilesetDef | undefined): boolean {
  return isBundledForestHarmony(tileset) && shadowSlots(tileset) !== null;
}

/**
 * 그림자 칸은 ★(통행 + 상위 표시)여야 한다. 통행은 위층부터 내려가며 ★·빈칸을 건너뛰고 처음 만난 타일이 정하므로
 * (collision.passabilityOf), 2층 그림자가 ○ 면 1층 밑동의 × 를 덮어 나무를 걸어서 지나간다.
 * 실측(2026-09-28, AI 조수 숲마을 40×28): 막혀야 할 밑동 108칸이 뚫렸고 출하 플레이어에서 주인공이 밑동 줄 안으로 들어갔다.
 * 2층은 캐릭터 밑 묶음이라 priority 가 그리는 순서를 바꾸지 않는다 — ★ 는 통행 판정에서 빠지라는 뜻만 한다.
 * 2026-09-27 판(○)으로 이미 붙은 칸은 이 함수가 제자리에서 고친다. 바뀌었으면 true.
 */
export function repairForestTreeShadowPassage(tileset: TilesetDef | undefined): boolean {
  if (!isBundledForestHarmony(tileset)) return false;
  let changed = false;
  for (const graft of tileset.tileGrafts ?? []) {
    if (graft.sourceChipset !== PARTS.textureKey || graft.targetTile >= tileset.count) continue;
    const tile = graft.targetTile;
    const pass = tileset.passability[tile];
    const open = pass?.up && pass.down && pass.left && pass.right;
    const meta = tileset.tileMeta?.[tile];
    if (open && tileset.priority[tile] === "upper" && (!meta || meta.passage === "star")) continue;
    tileset.passability[tile] = { up: true, down: true, left: true, right: true };
    tileset.priority[tile] = "upper";
    if (meta) tileset.tileMeta![tile] = { ...meta, passage: "star" };
    changed = true;
  }
  return changed;
}

/**
 * forest_harmony 끝(마지막 이식 뒤 새 줄)에 그림자 칸을 붙인다. 이미 있으면 아무것도 하지 않는다. 바뀌었으면 true.
 * 일부만 있는 타일셋(손으로 지운 경우)은 건드리지 않는다 — 번호를 다시 섞지 않는다.
 */
export function ensureForestHarmonyTreeShadows(tileset: TilesetDef): boolean {
  if (!isBundledForestHarmony(tileset) || shadowSlots(tileset)) return false;
  if ((tileset.tileGrafts ?? []).some(graft => graft.sourceChipset === PARTS.textureKey)) return false;
  const lastGraft = Math.max(-1, ...(tileset.tileGrafts ?? []).map(graft => graft.targetTile));
  const start = Math.ceil(Math.max(tileset.count, lastGraft + 1) / tileset.tilesPerRow) * tileset.tilesPerRow;
  const count = Math.ceil((start + PARTS.frames) / tileset.tilesPerRow) * tileset.tilesPerRow;
  tileset.tileMeta ??= [];
  const open: PassFlag = { up: true, down: true, left: true, right: true };
  for (let tile = tileset.count; tile < count; tile += 1) {
    const slot = PARTS.slots[tile - start];
    tileset.passability[tile] = structuredClone(slot?.passability ?? open);
    // 그림자 칸은 ★ — 1층 밑동의 통행을 덮지 않는다(repairForestTreeShadowPassage). 줄을 채우는 빈 칸만 하위.
    tileset.priority[tile] = slot ? "upper" : "lower";
    tileset.terrain[tile] = slot?.terrain ?? 0;
    tileset.tileMeta[tile] = slot ? { ...structuredClone(slot.tileMeta), passage: "star" } : { label: "", description: "" };
  }
  tileset.count = count;
  tileset.tileGrafts = [...(tileset.tileGrafts ?? []),
    ...Array.from({ length: PARTS.frames }, (_, i) => ({ targetTile: start + i, sourceChipset: PARTS.textureKey, sourceTile: i }))];
  return true;
}

/**
 * 맵의 모든 밑동에 그림자를 드리운다 — 밑동 칸의 2층에 그 밑동의 그림자, 밑동 바로 아래 통행 가능한 바닥 칸의
 * 2층에 발치 그림자. 2층이 이미 다른 타일로 차 있으면 건드리지 않는다(사람이 놓은 2층 우선).
 * 밑동이 사라진 칸에 남은 그림자는 지운다. 그림자 칸이 필요한데 없으면 타일셋 끝에 붙인다.
 * 바꾼 칸 수를 돌려준다.
 */
export function applyForestTreeShadows(map: GameMap, tileset: TilesetDef | undefined): number {
  if (!isBundledForestHarmony(tileset) || map.tilesetId !== tileset.id) return 0;
  const W = map.width, size = map.width * map.height;
  const wantedSource = new Map<number, { kind: "trunk" | "foot"; source: number }>();
  for (let index = 0; index < size; index += 1) {
    const lower = map.lowerTiles[index] ?? -1;
    const source = TRUNK_SOURCE.get(lower);
    if (source === undefined) continue;
    wantedSource.set(index, { kind: "trunk", source });
    const below = index + W;
    const foot = FOOT_SOURCE.get(lower);
    if (foot === undefined || below >= size) continue;
    const belowLower = map.lowerTiles[below] ?? -1;
    // 아래가 또 밑동이면(굽이숲 조립 안) 발치가 아니다. 물·벽 같은 통행 불가 바닥에도 드리우지 않는다.
    if (TRUNK_SOURCE.has(belowLower) || belowLower < 0) continue;
    const pass = tileset.passability[belowLower];
    if (!pass || !(pass.up || pass.down || pass.left || pass.right)) continue;
    if (!wantedSource.has(below)) wantedSource.set(below, { kind: "foot", source: foot });
  }
  let slots = shadowSlots(tileset);
  if (!slots && wantedSource.size > 0 && ensureForestHarmonyTreeShadows(tileset)) slots = shadowSlots(tileset);
  if (!slots) return 0;
  const shadowTiles = new Set(slots.values());
  let changed = 0;
  for (let index = 0; index < size; index += 1) {
    const current = layerTileAt(map, 2, index);
    const want = wantedSource.get(index);
    const next = want === undefined ? undefined : slots.get(want.source);
    if (next !== undefined) {
      if (current === next || (current >= 0 && !shadowTiles.has(current))) continue;
      setLayerTileAt(map, 2, index, next);
      changed += 1;
    } else if (shadowTiles.has(current)) {
      setLayerTileAt(map, 2, index, -1);
      changed += 1;
    }
  }
  return changed;
}
