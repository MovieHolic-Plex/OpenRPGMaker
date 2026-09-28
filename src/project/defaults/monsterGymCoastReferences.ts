import saved from "@/assets/monsterGymCoastReferences.json";
import { MONSTER_GYM_COAST_TEXTURE_KEY } from "@/assets/scarloxyPack";
import type { TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

// 체육관 내부 + 해변·항구 칩셋(사막/해안 0~479 + 생성 부품 480~)의 배치 지침. 번들이 소유한다 —
// 새 프로젝트는 타일셋 생성 때, 기존 프로젝트는 로드 보정(ensureBundledTilesets) 때 받는다.
// 원본: scripts/content/prepare-monster-gym-coast-references.mjs → src/assets/monsterGymCoastReferences.json.
const CATEGORY = saved as unknown as TilesetReferenceCategory;

/** 빠진 카테고리만 덧붙인다. 저자가 쓴 문서나 공유 포인터(referenceSourceTilesetId)는 건드리지 않는다. */
export function ensureMonsterGymCoastReferences(tileset: TilesetDef): boolean {
  if (tileset.image.type !== "bundled" || tileset.image.id !== MONSTER_GYM_COAST_TEXTURE_KEY || tileset.referenceSourceTilesetId) return false;
  if ((tileset.referenceDocuments ?? []).some((category) => category.id === CATEGORY.id)) return false;
  tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), structuredClone(CATEGORY)];
  return true;
}
