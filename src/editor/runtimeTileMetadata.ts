import { applyCombinedTownHarness, isCombinedTownTileset } from "@/project/tilesetHarness";
import { confirmUserTileMetadata, tileMetaLocked, tileMetaOrigin } from "@/project/tilesetPalette";
import type { TileAiMetadata, TilesetDef } from "@/project/types";

type UserRuntimePatch = Partial<Pick<TileAiMetadata, "passage" | "terrainTag">>;

// DB 타일셋 편집기의 레이어 선택지 — "auto"는 하네스/투명 칩 판정에 맡긴다.
export type TileLayerChoice = "auto" | "lower" | "upper";

export function markUserTileRuntimeMetadata(tileset: TilesetDef, tile: number, patch: UserRuntimePatch): void {
  if (tile < 0 || tile >= tileset.count) return;
  const current = ensureTileMetaSlot(tileset, tile);
  const wasUser = tileMetaOrigin(current) === "user" || tileMetaLocked(current);
  const next = confirmUserTileMetadata(current, patch);
  // 번들/AI 메타를 통행·지형 편집으로 승격할 때 상속된 defaultLayer까지 "사용자 확정
  // 레이어"로 둔갑하면 안 된다 — 레이어 확정은 레이어 버튼(setTileLayerOverride)으로만.
  if (!wasUser) delete next.defaultLayer;
  tileset.tileMeta![tile] = next;
}

// 사용자가 명시적으로 확정한 레이어(있으면). 하네스·투명 칩 자동 판정보다 우선한다.
export function userTileLayerOverride(tileset: TilesetDef, tile: number): "lower" | "upper" | null {
  const meta = tileset.tileMeta?.[tile];
  if (!meta || (tileMetaOrigin(meta) !== "user" && !tileMetaLocked(meta))) return null;
  return meta.defaultLayer === "lower" || meta.defaultLayer === "upper" ? meta.defaultLayer : null;
}

// DB 타일셋 편집기에서 타일의 홈 레이어를 직접 지정/해제한다.
// - lower/upper: 사용자 확정(userLocked) 메타로 기록 → 로드 시 하네스가 덮지 않는다.
// - auto: 오버라이드를 지우고 하네스 판정(그룹 계약 + 투명 칩 승격)으로 되돌린다.
export function setTileLayerOverride(tileset: TilesetDef, tile: number, choice: TileLayerChoice): void {
  if (tile < 0 || tile >= tileset.count) return;
  const current = ensureTileMetaSlot(tileset, tile);
  if (choice === "auto") {
    const next: TileAiMetadata = { ...current };
    delete next.defaultLayer;
    // 레이어 때문에만 잠긴 메타라면 잠금도 해제해 하네스가 다시 관리하게 한다.
    if (!hasUserKnowledge(next)) {
      delete next.locked;
      delete next.origin;
      delete next.userLocked;
      next.source = "unknown";
    }
    tileset.tileMeta![tile] = next;
    if (isCombinedTownTileset(tileset)) applyCombinedTownHarness(tileset);
    return;
  }
  tileset.tileMeta![tile] = confirmUserTileMetadata(current, { defaultLayer: choice });
  tileset.priority[tile] = choice;
}

function hasUserKnowledge(meta: TileAiMetadata): boolean {
  return (
    meta.label.trim() !== "" ||
    meta.description.trim() !== "" ||
    (meta.tags?.length ?? 0) > 0 ||
    meta.passage !== undefined ||
    meta.terrainTag !== undefined
  );
}

function ensureTileMetaSlot(tileset: TilesetDef, tile: number): TileAiMetadata {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) {
    tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
  }
  return tileset.tileMeta[tile] ?? { label: "", description: "", source: "unknown" };
}
