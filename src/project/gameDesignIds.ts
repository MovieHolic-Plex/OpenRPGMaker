// 게임 기획 id 상수만 — 가벼운 모듈. gameDesignBrief.ts 는 하네스 레지스트리를 끌어오므로
// 스토어 서버·런처·컨셉 형식처럼 가벼워야 하는 곳은 이 파일을 읽는다.
export const GAME_PRESET_IDS = [
  "monster-collect", "story-cutscene", "adventure-jrpg", "horror-gallery",
  "school-horror", "farm-life", "partner-raise", "action-rpg",
] as const;
export type GamePresetId = typeof GAME_PRESET_IDS[number];
export const GAME_BRIEF_SLOTS = ["experience", "activity", "progression", "detail", "scope"] as const;
export type GameBriefSlot = typeof GAME_BRIEF_SLOTS[number];
