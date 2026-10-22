import shipped from "@/assets/sharedStairReferences.json";
import type { TilesetDef } from "../types";
import { REFERENCE_LIMITS, type TilesetReferenceCategory } from "../tilesetReferences";

// 계단 입구 참고문서(2026-10-22) — 번들이 소유한다. 칩셋마다 「계단 입구」 용도 하나(입구 계약 사전 + 4배 그림 + 정상/오류).
// 원본: scripts/content/stairs/prepare_stair_references.py → src/assets/sharedStairReferences.json + public/assets/stair-references/.
// 정본 계약은 src/assets/stairContracts.json(project/stairs/contract.ts) — 문서는 그 사본이다.

export const STAIR_REFERENCE_CATEGORY_ID = "stair-entrance";
const SHIPPED = shipped as unknown as Readonly<Record<string, TilesetReferenceCategory>>;

/** 이 칩셋 id 의 번들 계단 입구 용도(없으면 undefined). */
export function stairEntranceReferenceFor(tilesetId: string): TilesetReferenceCategory | undefined {
  const c = SHIPPED[tilesetId];
  return c ? structuredClone(c) : undefined;
}

/**
 * 새·기존 사본에 「계단 입구」 용도가 없으면 덧붙인다. 저자가 쓴 문서·공유 포인터(referenceSourceTilesetId)·
 * 일부러 비운 목록([])·용도 상한(32)은 건드리지 않는다. 같은 id 의 용도가 이미 있으면(저자가 고쳤을 수 있다) 그대로 둔다.
 */
export function ensureStairEntranceReferences(tileset: TilesetDef): boolean {
  const c = SHIPPED[tileset.id];
  if (!c || tileset.referenceSourceTilesetId) return false;
  if (Array.isArray(tileset.referenceDocuments) && tileset.referenceDocuments.length === 0) return false;
  const list = tileset.referenceDocuments ?? [];
  if (list.some((x) => x.id === STAIR_REFERENCE_CATEGORY_ID) || list.length >= REFERENCE_LIMITS.categories) return false;
  tileset.referenceDocuments = [...list, structuredClone(c)];
  return true;
}
