import { assert, requireRecord, requireString } from "./io/guards";
import type { GameBriefSlot, GameDesignAnswer, GamePresetId } from "./gameDesignBrief";

export const INTERVIEW_GENRES = ["romance", "monster", "adventure", "mystery"] as const;
export type InterviewGenre = typeof INTERVIEW_GENRES[number];
/** Optional v1 brief extension. The engine preset and the author's genre are distinct. */
export interface GameInterview {
  version: 1;
  genre: InterviewGenre;
  secondary?: InterviewGenre;
  concept: string;
  protagonist: string;
  notes: string;
  choiceIds: Partial<Record<GameBriefSlot, string>>;
  blend?: GameDesignAnswer;
}

export function interviewPreset(genre: InterviewGenre, secondary?: InterviewGenre): GamePresetId {
  if (genre === "monster" || secondary === "monster") return "monster-collect";
  if (genre === "adventure" || secondary === "adventure") return "adventure-jrpg";
  return "story-cutscene";
}

export function normalizeGameInterview(value: unknown): GameInterview {
  const data = requireRecord("gameDesignBrief.interview", value);
  assert(data.version === 1, "인터뷰 버전을 읽을 수 없습니다.");
  const genre = (v: unknown): InterviewGenre => {
    assert(INTERVIEW_GENRES.includes(v as InterviewGenre), "인터뷰 장르가 올바르지 않습니다.");
    return v as InterviewGenre;
  };
  const text = (v: unknown, limit = 1000): string => {
    const s = requireString("인터뷰 답변", v);
    assert(s.length <= limit, "인터뷰 답변이 너무 깁니다.");
    return s;
  };
  const primary = genre(data.genre);
  const secondary = data.secondary === undefined ? undefined : genre(data.secondary);
  assert(primary !== secondary, "서로 다른 장르를 골라 주세요.");
  const ids = requireRecord("interview.choiceIds", data.choiceIds);
  const choiceIds: GameInterview["choiceIds"] = {};
  for (const slot of ["experience", "activity", "progression", "detail", "scope"] as const) {
    if (ids[slot] !== undefined) choiceIds[slot] = text(ids[slot], 80);
  }
  let blend: GameDesignAnswer | undefined;
  if (secondary) {
    const b = requireRecord("interview.blend", data.blend);
    assert(b.source === "user" || b.source === "recommended", "장르 결합 답변 출처가 올바르지 않습니다.");
    blend = { question: text(b.question, 300), label: text(b.label, 60), text: text(b.text), source: b.source };
    assert(blend.text.trim().length > 0, "장르를 연결할 방법을 골라 주세요.");
  } else assert(data.blend === undefined, "혼합 장르가 아닌 기획에 결합 답변이 있습니다.");
  return { version: 1, genre: primary, ...(secondary ? { secondary, blend } : {}),
    concept: text(data.concept), protagonist: text(data.protagonist, 300), notes: text(data.notes), choiceIds };
}
