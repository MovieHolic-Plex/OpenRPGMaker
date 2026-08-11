// RM2K3식 타일 레이어 분류 — 타일마다 소속 레이어(하위/상위)를 단일 규칙으로 판정한다.
// 판정 우선순위: 하네스 타일 그룹(defaultLayer) → tileset.priority.
// - lower 그룹이라도 stackable 소품(울타리 등)은 상위 레이어가 홈이다. 단일 슬롯인
//   lowerTiles를 덮어쓰면 지면이 지워지므로 페인트 라우팅(effectiveLayer)과 동일한 규칙.
// - mixed/event 그룹은 양쪽 레이어를 허용한다("both").
// - 그룹 미소속 타일은 priority를 따르되, priority가 전부 lower인(=실질 분류가 없는)
//   타일셋에서는 기존처럼 요청 레이어를 존중해야 하므로 "both"로 본다.
import { userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { isPropOverlayChipsetTile } from "@/project/defaults/chipsetMapping";
import { harnessGroupForTile, isTreeTrunkTileId, isUpperOnlyOverlayTile } from "@/project/tilesetHarness";
import { isCustomTileset } from "@/project/tilesetKind";
import type { TilesetDef } from "@/project/types";

export type TileLayerHome = "lower" | "upper" | "both";

export function tilesetHasLayerClassification(tileset: TilesetDef): boolean {
  return isCustomTileset(tileset)
    ? tileset.priority.length >= tileset.count
      || tileset.tileGroups?.some((group) => group.defaultLayer === "upper") === true
    : tileset.priority.includes("upper");
}

export function tileLayerHome(tileset: TilesetDef, tile: number): TileLayerHome {
  // 1) 사용자가 DB 타일셋 편집기에서 명시한 레이어가 최우선.
  const override = userTileLayerOverride(tileset, tile);
  if (override) return override;
  // Arbitrary atlases have no RM2K tile-number semantics. Explicit priority is authoritative.
  if (isCustomTileset(tileset)) {
    if (!tilesetHasLayerClassification(tileset)) return "both";
    return tileset.priority[tile] ?? "lower";
  }
  // 2) 투명 배경 칩은 그룹/priority보다 먼저 상위 전용으로 판정한다 — 하위에 깔리면
  //    투명 부분 아래에 지형이 없어 검게 보인다(예: 벤치 357, 사선 지붕 385).
  //    나무 밑동(290…)은 투명해도 하위(수관과 같은 칸 스택).
  if (isTreeTrunkTileId(tile)) return "lower";
  if (isUpperOnlyOverlayTile(tileset, tile)) return "upper";
  // 3) 소품 오버레이(텐트 448 등) — 하네스 그룹이 없어도 상위.
  if (isPropOverlayChipsetTile(tile)) return "upper";
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
