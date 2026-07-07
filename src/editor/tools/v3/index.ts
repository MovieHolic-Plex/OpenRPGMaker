// editor/tools/v3/index.ts
// 타일 v3 툴 집합 — 승인 보캐뷸러리 계층 (2026-07-07 설계, 원칙 0: Zero-Trust Perception).
// V3A: propose_tile_vocabulary + 문법 프로파일 레지스트리. 공정 프리미티브 6종은 V3B.

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
