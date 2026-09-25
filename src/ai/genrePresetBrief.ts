/**
 * 새 프로젝트 마법사가 보내는 장르 기획 요청의 첫 줄 표지. 이 요청은 게임 전체(마을·도로·동굴·전투·엔딩)를
 * 만드는 다영역 저작이다 — 의도 선언이 마을만 골라도 한 마을 계약으로 좁히면 안 된다.
 */
export const GENRE_PRESET_BRIEF_PREFIX = "장르 프리셋:";

export function isGenrePresetBriefRequest(text: string | undefined | null): boolean {
  return typeof text === "string" && text.trimStart().startsWith(GENRE_PRESET_BRIEF_PREFIX);
}
