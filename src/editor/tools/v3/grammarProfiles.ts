// editor/tools/v3/grammarProfiles.ts
// 시공 문법 프로파일 레지스트리 (타일 툴 v3, 2026-07-07 설계 축 5).
// TilesetDef.grammarProfile(기본 "rm-type")로 디스패치되며, V3B 공정 프리미티브
// (build_wall/lay_path 등)의 전개기가 이 프로파일 상수를 소비한다. V3A는 스텁까지.

import type { TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";
import type { VocabLayerHome } from "@/project/tileVocabulary";

export type GrammarPatternKind = NonNullable<TileGroupMetadata["patternGrammar"]>["kind"];

export interface GrammarProfile {
  readonly id: string;
  readonly label: string;
  // 이 프로파일의 시공 전개기가 이해하는 patternGrammar.kind 목록.
  readonly supportedPatternKinds: readonly GrammarPatternKind[];
  // role별 기본 홈 레이어 — 어휘에 layerHome이 명시되지 않았을 때의 결정론 폴백.
  readonly layerHomeByRole: Readonly<Record<TileGroupRole, VocabLayerHome>>;
  // 오토타일 이웃 판정 범위. 8 = inner corner 포함 variantMap(RM-TYPE 필수).
  readonly autotileNeighborhood: 4 | 8;
}

export const DEFAULT_GRAMMAR_PROFILE_ID = "rm-type";

// RM-TYPE — 현행 combined_town 규약: 9분할 벽 / 세로 확장 기둥 / 8-이웃 variantMap
// 오토타일(inner corner 포함) / upper·lower 홈. 1차 구현 대상(설계 축 5).
export const RM_TYPE_GRAMMAR_PROFILE: GrammarProfile = {
  id: DEFAULT_GRAMMAR_PROFILE_ID,
  label: "RM2003형 (combined_town 규약)",
  supportedPatternKinds: [
    "nine_slice_expandable", // 벽/지붕 몸체
    "vertical_expandable", // 기둥
    "horizontal_expandable", // 처마/울타리 행
    "autotile_3x3", // 8-이웃 variantMap 길/수면
    "single", // 낱개 소품
  ],
  layerHomeByRole: {
    terrain: "lower",
    water: "lower",
    wall: "lower",
    building: "lower",
    castle: "lower",
    fence: "upper",
    roof: "perCell", // 몸체는 하위, 사선/처마 오버레이는 상위 — 셀별 판정.
    prop: "perCell", // 투명 배경 소품은 상위, 불투명 소품은 하위.
  },
  autotileNeighborhood: 8,
};

// MODERN-EXTERIORS — Modern Exteriors v42.3 스탬프 도시 방언.
// 480칩 틀(30×16)은 유지하되 내용은 3×4 템플릿 블록이 아니라
// 하단 7~8행 건물 스탬프(8×8/6×8) + 0행 바닥/도로 스탬프다.
// 오토타일은 쓰지 않고 원본 배열 그대로 찍는 source_rect 스탬프/브러시가 정본.
export const MODERN_EXTERIORS_GRAMMAR_PROFILE: GrammarProfile = {
  id: "modern-exteriors",
  label: "Modern Exteriors (스탬프 도시)",
  supportedPatternKinds: [
    "source_rect", // 8×8/6×8 건물·온실·헬리패드 스탬프 (정본)
    "single", // 아스팔트/보도/플라자 낱바닥 브러시
    "horizontal_expandable", // 연석·차선·횡단보도 1열 확장
    "vertical_expandable", // 연석 1열 세로 확장
  ],
  layerHomeByRole: {
    terrain: "lower",
    water: "lower",
    wall: "lower",
    building: "lower",
    castle: "lower",
    fence: "lower",
    roof: "lower",
    prop: "lower",
  },
  autotileNeighborhood: 4,
};

const REGISTRY = new Map<string, GrammarProfile>([
  [RM_TYPE_GRAMMAR_PROFILE.id, RM_TYPE_GRAMMAR_PROFILE],
  [MODERN_EXTERIORS_GRAMMAR_PROFILE.id, MODERN_EXTERIORS_GRAMMAR_PROFILE],
]);

// 알 수 없는 id는 기본 프로파일로 폴백한다(구 프로젝트/오타에 대해 조용히 안전).
export function getGrammarProfile(id: string | undefined): GrammarProfile {
  return (id !== undefined ? REGISTRY.get(id) : undefined) ?? RM_TYPE_GRAMMAR_PROFILE;
}

export function tilesetGrammarProfile(tileset: TilesetDef): GrammarProfile {
  return getGrammarProfile(tileset.grammarProfile);
}

export function registerGrammarProfile(profile: GrammarProfile): void {
  REGISTRY.set(profile.id, profile);
}

export function listGrammarProfiles(): readonly GrammarProfile[] {
  return [...REGISTRY.values()];
}
