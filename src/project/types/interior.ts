// project/types/interior.ts
// 타일셋에 붙는 공간 종류 문법 — 가구·건물 모양은 structureKits 이고,
// 장소 종류(침실·주방·광장…)는 이 레코드다. 배치 알고리즘은 interiorRoomPipeline 에 남는다.

/** 가구를 어디에 붙일지. 실내 오브젝트 카탈로그 InteriorObjectSnap 과 같은 값. */
export type InteriorFurnitureSnap = "wall-north" | "wall-any" | "floor" | "free";

/**
 * 이 타일셋에서 AI 가 고를 수 있는 공간 한 종류.
 * requiredRoles 는 같은 타일셋 가구의 ai.interiorRole 과 맞춘다.
 * 저작 화면 이름은 「공간 종류」 — 구조물 탭과 데이터를 섞지 않는다.
 */
export interface InteriorRoomKindRecord {
  id: string;
  label: string;
  /** 이 방에 반드시 있어야 하는 가구 역할(bed, stove, …). */
  requiredRoles: string[];
  /** 분위기 제안. 파이프라인 modifier 이름(rustic, luxury, …) 또는 자유 문자열. */
  suggestedModifiers?: string[];
  /** true 면 복도 — 바닥 점유 가구를 두지 않는다. */
  walkway?: boolean;
}
