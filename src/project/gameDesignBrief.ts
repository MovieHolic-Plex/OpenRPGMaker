import { assert, requireRecord, requireString } from "./io/guards";

export const GAME_PRESET_IDS = [
  "monster-collect", "story-cutscene", "adventure-jrpg", "horror-gallery",
  "school-horror", "farm-life", "partner-raise", "action-rpg",
] as const;
export type GamePresetId = typeof GAME_PRESET_IDS[number];
export const GAME_BRIEF_SLOTS = ["experience", "activity", "progression", "detail", "scope"] as const;
export type GameBriefSlot = typeof GAME_BRIEF_SLOTS[number];
export const GAME_BRIEF_ANSWER_LIMIT = 1000;
export const GAME_BRIEF_SUMMARY_LIMIT = 4000;

export interface GameDesignAnswer {
  question: string;
  label: string;
  /** Original answer (or a verbatim excerpt from an earlier answer). */
  text: string;
  source: "user" | "recommended";
}
export type GameDesignAnswers = Partial<Record<GameBriefSlot, GameDesignAnswer>>;
export interface GameDesignBrief {
  version: 1;
  presetId: GamePresetId;
  answers: Record<GameBriefSlot, GameDesignAnswer>;
  /** The author's editable, confirmed summary. More recent than the interview transcript. */
  summary: string;
  /** Menu creation crosses a page reload. Consume only on the newly opened project. */
  generationPending?: boolean;
}

/** Optional authored metadata: old projects stay absent; malformed authored answers must not disappear. */
export function normalizeGameDesignBrief(value: unknown): GameDesignBrief {
  const data = requireRecord("gameDesignBrief", value);
  assert(data.version === 1, "게임 기획 버전을 읽을 수 없습니다.");
  assert(GAME_PRESET_IDS.includes(data.presetId as GamePresetId), "게임 기획 프리셋이 올바르지 않습니다.");
  const answers = requireRecord("gameDesignBrief.answers", data.answers);
  const bounded = (value: unknown, label: string, max: number): string => {
    const text = requireString(label, value);
    assert(text.trim().length > 0 && text.length <= max, `${label}의 길이가 올바르지 않습니다.`);
    return text;
  };
  const normalized = {} as Record<GameBriefSlot, GameDesignAnswer>;
  for (const slot of GAME_BRIEF_SLOTS) {
    const answer = requireRecord(`gameDesignBrief.answers.${slot}`, answers[slot]);
    assert(answer.source === "user" || answer.source === "recommended", "게임 기획 답변 출처가 올바르지 않습니다.");
    normalized[slot] = {
      question: bounded(answer.question, "게임 기획 질문", 300),
      label: bounded(answer.label, "게임 기획 항목", 60),
      text: bounded(answer.text, "게임 기획 답변", GAME_BRIEF_ANSWER_LIMIT),
      source: answer.source,
    };
  }
  assert(data.generationPending === undefined || typeof data.generationPending === "boolean", "게임 기획 시작 상태가 올바르지 않습니다.");
  return {
    version: 1, presetId: data.presetId as GamePresetId, answers: normalized,
    summary: bounded(data.summary, "게임 기획 요약", GAME_BRIEF_SUMMARY_LIMIT),
    ...(data.generationPending === undefined ? {} : { generationPending: data.generationPending }),
  };
}

export function gameDesignSummary(answers: GameDesignAnswers): string {
  return GAME_BRIEF_SLOTS.flatMap(slot => {
    const answer = answers[slot];
    return answer ? [`${answer.label}: ${answer.text}${answer.source === "recommended" ? " (추천안)" : ""}`] : [];
  }).join("\n");
}

/** Shared by the initial prompt, subsequent chat turns, and Pi workers. */
export function gameDesignBriefContext(brief: GameDesignBrief | undefined): string {
  if (!brief) return "";
  return [
    "## 사용자가 확정한 게임 기획",
    "프리셋은 기본 플레이 방식이다. 분위기·서사 변주와 별개로 보존한다. 예: 몬스터 수집 + 공포는 수집 시스템을 유지한다.",
    "아래 확정 요약은 인터뷰 이후 저자가 수정할 수 있는 최신 기획이다. 고정 프리셋의 톤·배경·체크리스트보다 우선한다. 이후 사용자의 명시적 변경 요청은 반영한다.",
    "기획에 맞는 핵심 행동 → 진행 → 사건의 결과를 실제로 연결하고, 첫 제작 범위 안에서 완주 가능한 구간을 만든다. 추천안을 사용자 원문으로 바꾸어 주장하지 않는다.",
    JSON.stringify({ preset: brief.presetId, summary: brief.summary, answers: brief.answers }),
  ].join("\n");
}
