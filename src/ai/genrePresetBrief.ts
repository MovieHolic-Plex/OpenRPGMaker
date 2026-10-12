import { GOAL_CAMPAIGN_MARKER } from "./piAgent/goalCommand";

/**
 * 새 프로젝트 마법사가 보내는 장르 기획 요청의 내부 표지. 새 UI 핸드오프는 이 표지 앞에 `/goal`을
 * 붙여 장기 캠페인 계약을 타지만, 저장된 대화·헤드리스 QA의 예전 표지도 계속 읽는다.
 */
export const GENRE_PRESET_BRIEF_PREFIX = "장르 프리셋:";
export const GOAL_GENRE_PRESET_BRIEF_PREFIX = "/goal 장르 프리셋:";

export function isGenrePresetBriefRequest(text: string | undefined | null): boolean {
  if (typeof text !== "string") return false;
  let trimmed = text.trimStart();
  // Parsing /goal wraps the original brief. Keep its genre identity for the
  // production and playable-segment checks further down the execution route.
  if (trimmed.startsWith(GOAL_CAMPAIGN_MARKER)) {
    const boundary = trimmed.indexOf("\n\n사용자 목표:\n");
    if (boundary < 0) return false;
    trimmed = trimmed.slice(boundary + "\n\n사용자 목표:\n".length).trimStart();
  }
  return trimmed.startsWith(GENRE_PRESET_BRIEF_PREFIX) || trimmed.startsWith(GOAL_GENRE_PRESET_BRIEF_PREFIX);
}
