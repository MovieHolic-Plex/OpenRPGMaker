// RM2K3식 타일 레이어 분류 — 타일마다 소속 레이어(하위/상위)를 단일 규칙으로 판정한다.
// 판정 우선순위: 하네스 타일 그룹(defaultLayer) → tileset.priority.
// - lower 그룹이라도 stackable 소품(울타리 등)은 상위 레이어가 홈이다. 단일 슬롯인
//   lowerTiles를 덮어쓰면 지면이 지워지므로 페인트 라우팅(effectiveLayer)과 동일한 규칙.
// - mixed/event 그룹은 양쪽 레이어를 허용한다("both").
// - 그룹 미소속 타일은 priority를 따르되, priority가 전부 lower인(=실질 분류가 없는)
//   타일셋에서는 기존처럼 요청 레이어를 존중해야 하므로 "both"로 본다.
import { userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { isPropOverlayChipsetTile } from "@/project/defaults/chipsetMapping";
import { harnessGroupForTile, isCombinedTownTileset, isTreeTrunkTileId, isUpperOnlyOverlayTile } from "@/project/tilesetHarness";
import { isCustomTileset } from "@/project/tilesetKind";
import type { TilesetDef } from "@/project/types";

export type TileLayerHome = "lower" | "upper" | "both";

export function tilesetHasLayerClassification(tileset: TilesetDef): boolean {
  return isCustomTileset(tileset)
    ? tileset.priority.length >= tileset.count
      || tileset.tileGroups?.some((group) => group.defaultLayer === "upper") === true
    : tileset.priority.includes("upper");
}

const kitUpperOnlyCache = new WeakMap<TilesetDef, ReadonlySet<number>>();
/**
 * Imported/custom atlases can have a tile priority that describes its backing
 * pixel layer, while an autotile group describes the map layer where the
 * transparent terrain is actually painted. Prefer a single explicit group
 * layer over that ambiguous priority. Conflicting groups deliberately return
 * both so a caller cannot silently move a shared tile between layers.
 */
function explicitAutotileLayer(tileset: TilesetDef, tile: number): TileLayerHome | undefined {
  const layers = new Set((tileset.autotileGroups ?? [])
    .filter((group) => group.memberTileIds.includes(tile) && group.layer !== undefined)
    .map((group) => group.layer!));
  if (layers.size === 1) return [...layers][0];
  if (layers.size > 1) return "both";
  return undefined;
}

/** 이 타일셋의 구조 키트가 upperTiles 로만 쓰고 tiles(1층)로는 한 번도 쓰지 않는 칸. */
function bundledKitUpperOnlyTiles(tileset: TilesetDef): ReadonlySet<number> {
  let set = kitUpperOnlyCache.get(tileset);
  if (set) return set;
  const upper = new Set<number>(), lower = new Set<number>();
  for (const kit of tileset.structureKits ?? []) for (const row of kit.rows ?? []) {
    for (const tile of row.tiles ?? []) if (tile >= 0) lower.add(tile);
    for (const tile of row.upperTiles ?? []) if (tile >= 0) upper.add(tile);
  }
  set = new Set([...upper].filter((tile) => !lower.has(tile)));
  kitUpperOnlyCache.set(tileset, set);
  return set;
}

export function tileLayerHome(tileset: TilesetDef, tile: number): TileLayerHome {
  // 공백은 어느 레이어 붓이든 그 레이어에 쓴다. priority[-1] 폴백이 lower 로
  // 떨어지면 덧그림 지우개가 바닥을 비운다.
  if (tile < 0) return "both";
  // 1) 사용자가 DB 타일셋 편집기에서 명시한 레이어가 최우선.
  const override = userTileLayerOverride(tileset, tile);
  if (override) return override;
  // Arbitrary atlases have no RM2K tile-number semantics. Explicit priority is authoritative.
  if (isCustomTileset(tileset)) {
    // Store/imported terrain groups may intentionally live on the upper map
    // layer even when their tile metadata has lower priority for transparent
    // pixel backing. The group is the authored source of truth here.
    const autotileLayer = explicitAutotileLayer(tileset, tile);
    if (autotileLayer) return autotileLayer;
    // 받침(layerBacking)까지 적힌 칸은 저자가 층을 정한 덧그림이다(몬스터 키트의 울타리·눈더미·얼음 바위 71칸).
    // priority 는 그 칸을 lower 로 두어, 조수가 3층으로 칠한 눈더미가 「상위 전용 칩 자동 라우팅」으로 1층에 놓여
    // 바닥 없이 검은 칸이 됐다(2026-10-06 실제 편집기 이어 고치기).
    const meta = tileset.tileMeta?.[tile];
    if (meta?.layerBacking !== undefined && (meta.defaultLayer === "upper" || meta.defaultLayer === "lower")) return meta.defaultLayer;
    // 번들 키트가 덧그림(upperTiles)으로만 쓰는 칸(침엽수 spine_a·눈사람 등)도 priority 는 lower 다 — 1층에 칠하면 투명 부분이 검게 뚫렸다
    // (2026-10-06 r10b). 번들 칸에 한해 그 타일셋 자신의 키트가 쓰는 층을 따른다.
    if (meta?.source === "bundled-default" && bundledKitUpperOnlyTiles(tileset).has(tile)) return "upper";
    if (!tilesetHasLayerClassification(tileset)) return "both";
    return tileset.priority[tile] ?? "lower";
  }
  // 2) 투명 배경 칩은 그룹/priority보다 먼저 상위 전용으로 판정한다 — 하위에 깔리면
  //    투명 부분 아래에 지형이 없어 검게 보인다(예: 벤치 357, 사선 지붕 385).
  //    나무 밑동(290…)은 투명해도 하위(수관과 같은 칸 스택).
  const town = isCombinedTownTileset(tileset);
  if (town && isTreeTrunkTileId(tile)) return "lower";
  if (isUpperOnlyOverlayTile(tileset, tile)) return "upper";
  // 3) 소품 오버레이(텐트 448 등) — 하네스 그룹이 없어도 상위.
  if (town && isPropOverlayChipsetTile(tile)) return "upper";
  const group = harnessGroupForTile(tileset, tile);
  if (group) {
    if (group.defaultLayer === "lower") return group.stackable === true ? "upper" : "lower";
    if (group.defaultLayer === "upper") return "upper";
    return "both";
  }
  if (!tilesetHasLayerClassification(tileset)) return "both";
  return tileset.priority[tile] ?? "lower";
}

// 팔레트 시트에서 현재 편집 레이어에 이 타일을 표시할지 여부.
export function tileVisibleOnLayer(tileset: TilesetDef, tile: number, layer: "lower" | "upper"): boolean {
  const home = tileLayerHome(tileset, tile);
  return home === "both" || home === layer;
}

// 팔레트 드래그 스탬프처럼 요청 레이어가 없는 문맥에서 타일이 실제로 놓일 레이어.
export function defaultPaintLayerForTile(tileset: TilesetDef, tile: number): "lower" | "upper" {
  const home = tileLayerHome(tileset, tile);
  if (home !== "both") return home;
  return tileset.priority[tile] ?? "lower";
}
