// editor/tools/v3/index.ts
// 타일 시공 정공법 — 승인 보캐뷸러리 + 공정 프리미티브.
// V3A: propose_tile_vocabulary + 문법 프로파일 레지스트리.
// V3B: build_wall/build_roof/place_door/place_window/lay_path/place_props/fill_region/tile_erase
//      + RM-TYPE 전개기. 구 v2 배치 래퍼는 제거됨.

export { CONSTRUCTION_TOOLS_V3, wallCellsAt } from "./constructionTools";
export {
  EXPANDABLE_PATTERN_KINDS,
  buildEightNeighborVariantMap,
  derivePatternGrammar,
  expandRoof,
  expandWall,
  isExpandablePatternKind,
  layerForVocabTile,
  resolveAutotile,
  vocabLayerHomeFor,
  type CellEdit,
  type ExpandablePatternKind,
  type Expansion,
  type Rect,
} from "./rmTypeExpander";
export { VOCABULARY_TOOLS_V3 } from "./vocabularyTools";
export type { VocabularyFactBadge, VocabularyProposalCard } from "./vocabularyTools";
export {
  DEFAULT_GRAMMAR_PROFILE_ID,
  RM_TYPE_GRAMMAR_PROFILE,
  getGrammarProfile,
  listGrammarProfiles,
  registerGrammarProfile,
  tilesetGrammarProfile,
  type GrammarPatternKind,
  type GrammarProfile,
} from "./grammarProfiles";
