// harnessSuggestion/builtinHouseStructureKits.ts
// 내장 파라메트릭 집 스탬프(2026-07-20) — 3계층 사다리 '파라메트릭' 단의 사용자 노출.
// 프로젝트 데이터에 저장하지 않는 가상 목록: 팔레트 선반·stamp_structure_kit이
// tileset.structureKits 앞에 합쳐 쓴다. 전개는 정본 stampFootprintHouseKit(구조 킷 모델 경유).

import { ALL_HOUSE_KIT_IDS, HOUSE_KITS } from "@/editor/houseKit";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { HouseStructureKitDef, TilesetDef } from "@/project/types";

/** 기본 몸체 — 카탈로그 A열과 같은 9×8 (aframe은 h가 폭 종속: 벽3+⌊(9-1)/2⌋+1 = 8). */
const DEFAULT_WINGS = [{ x: 0, y: 0, w: 9, h: 8 }];

export const BUILTIN_HOUSE_STRUCTURE_KITS: readonly HouseStructureKitDef[] = ALL_HOUSE_KIT_IDS.map((kitId) => ({
  id: `kit_house_${kitId}`,
  kind: "house",
  name: HOUSE_KITS[kitId].name,
  houseKitId: kitId,
  wings: DEFAULT_WINGS.map((wing) => ({ ...wing })),
  chimney: true,
  learnedFrom: "builtin-parametric",
}));

/** 집 킷은 combined_town 칩셋 문법 — 그 타일셋에서만 노출한다. */
export function builtinHouseStructureKitsFor(tileset: Pick<TilesetDef, "id">): readonly HouseStructureKitDef[] {
  return tileset.id === DEFAULT_TILESET_ID ? BUILTIN_HOUSE_STRUCTURE_KITS : [];
}
