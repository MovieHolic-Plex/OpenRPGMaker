// start/firstRun/firstRunBrief.ts
// 첫 사용자 프롬프트 홈(promptHome.ts)이 AI 없이 만들 때 쓰는 기획. AI 연결을 거절했거나 컨셉 초안이 실패해도
// 사용자를 빈 화면으로 되돌리지 않는다 — 낱말로 장르 틀을 고르고, 적은 문장을 기획 요약에 그대로 싣는다.
// 런처 번들에 들어가므로 가벼운 것만 부른다(gameDesignBrief 는 타입만 — 그 모듈은 하네스 레지스트리를 끌어온다).
import type { GameDesignAnswer, GameDesignBrief, GamePresetId } from "@/project/gameDesignBrief";
import { GAME_BRIEF_SLOTS, type GameBriefSlot } from "@/project/gameDesignIds";
import { NEW_PROJECT_CHOICES } from "@/editor/newProjectChoices";

/** 입력창 글자 수 상한 — 컨셉 초안도 400자까지만 읽는다(src/concepts/draft.ts draftPrompt). */
export const FIRST_RUN_TEXT_LIMIT = 400;

/** 앞에서부터 처음 맞는 줄이 이긴다. 「몬스터 + 공포」는 수집 틀을 지킨다(gameDesignBriefContext 와 같은 원칙). */
const KEYWORD_PRESETS: readonly { readonly preset: GamePresetId; readonly words: readonly string[] }[] = [
  { preset: "monster-collect", words: ["몬스터", "포켓", "포획", "도감", "체육관", "monster", "pokemon"] },
  { preset: "school-horror", words: ["학교 호러", "학교 공포", "폐교", "교실", "야간 학교"] },
  { preset: "horror-gallery", words: ["공포", "호러", "귀신", "괴담", "저택", "미술관", "horror"] },
  { preset: "farm-life", words: ["농장", "농사", "목장", "텃밭", "farm"] },
  { preset: "partner-raise", words: ["육성", "키우는", "키우기", "다마고치"] },
  { preset: "action-rpg", words: ["액션", "실시간", "action"] },
  { preset: "story-cutscene", words: ["연애", "로맨스", "사랑", "오피스", "조선", "사극", "추리", "회상", "코미디", "일상", "romance"] },
];

export const FIRST_RUN_DEFAULT_PRESET: GamePresetId = "adventure-jrpg";

export function pickFirstRunPreset(text: string): GamePresetId {
  const haystack = text.toLowerCase();
  for (const { preset, words } of KEYWORD_PRESETS) {
    if (words.some((word) => haystack.includes(word))) return preset;
  }
  return FIRST_RUN_DEFAULT_PRESET;
}

export function cleanFirstRunText(text: string): string {
  return text.replace(/\s+/gu, " ").trim().slice(0, FIRST_RUN_TEXT_LIMIT);
}

export function firstRunTitle(text: string): string {
  const clean = cleanFirstRunText(text);
  return (clean.length > 40 ? clean.slice(0, 40).trim() + "…" : clean) || "새 게임";
}

const SLOTS: Record<GameBriefSlot, { readonly label: string; readonly question: string; readonly recommended: string }> = {
  experience: { label: "핵심 경험", question: "이 게임에서 플레이어가 느낄 것은?", recommended: "" },
  activity: { label: "주로 하는 일", question: "플레이어가 주로 하는 행동은?", recommended: "사용자 문장과 시작 장르에 맞춰 정한다." },
  progression: { label: "진행", question: "게임은 어떻게 앞으로 나아가나?", recommended: "첫 장면에서 시작해 끝낼 수 있는 첫 구간까지 이어진다." },
  detail: { label: "인물과 무대", question: "누가 어디에서?", recommended: "사용자 문장에서 인물과 무대를 정한다. 문장에 없는 설정은 임시로 정한다." },
  scope: { label: "첫 제작 범위", question: "처음 만들 구간은?", recommended: "끝까지 플레이할 수 있는 첫 구간 하나." },
};

/** AI 없이 만드는 기획 — 사용자 문장은 「핵심 경험」(사용자 원문)과 요약 첫 줄에 그대로 남는다. */
export function firstRunBrief(text: string, presetId: GamePresetId = pickFirstRunPreset(text)): GameDesignBrief {
  const sentence = cleanFirstRunText(text) || "새 게임";
  const answers = {} as Record<GameBriefSlot, GameDesignAnswer>;
  for (const slot of GAME_BRIEF_SLOTS) {
    const meta = SLOTS[slot];
    answers[slot] = slot === "experience"
      ? { label: meta.label, question: meta.question, text: sentence, source: "user" }
      : { label: meta.label, question: meta.question, text: meta.recommended, source: "recommended" };
  }
  const genre = NEW_PROJECT_CHOICES.find((choice) => choice.id === presetId)?.label ?? presetId;
  const summary = [
    `사용자 문장: ${sentence}`,
    `시작 장르: ${genre} (문장의 낱말로 골랐다)`,
    ...GAME_BRIEF_SLOTS.filter((slot) => slot !== "experience").map((slot) => `${SLOTS[slot].label}: ${SLOTS[slot].recommended} (추천안)`),
  ].join("\n");
  return { version: 1, presetId, answers, summary };
}
