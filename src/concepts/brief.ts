// 컨셉 → 확정 게임 기획. 이후 경로(generationPending → prepareProjectInterviewStartup)는 인터뷰 기획과 같다.
// gameDesignBrief.ts 는 타입만 가져온다 — 그 모듈은 하네스 레지스트리를 끌어와 런처 번들을 키운다.
import type { GameDesignAnswer, GameDesignBrief } from "../project/gameDesignBrief";
import { GAME_BRIEF_SLOTS, type GameBriefSlot } from "../project/gameDesignIds";
import { CONCEPT_TWEAK_LIMIT, type GameConcept } from "./format";

const SUMMARY_LIMIT = 4000;

const SLOT_LABELS: Record<GameBriefSlot, { label: string; question: string }> = {
  experience: { label: "핵심 경험", question: "이 게임에서 플레이어가 느낄 것은?" },
  activity: { label: "주로 하는 일", question: "플레이어가 주로 하는 행동은?" },
  progression: { label: "진행", question: "게임은 어떻게 앞으로 나아가나?" },
  detail: { label: "인물과 무대", question: "누가 어디에서?" },
  scope: { label: "첫 제작 범위", question: "처음 만들 구간은?" },
};

/** 「살짝 바꾸기」 — 줄바꿈·연속 공백을 한 칸으로, 300자까지. 글자는 그대로 둔다(데이터로만 쓰인다). */
export function cleanTweak(tweak: string | undefined): string {
  return (tweak ?? "").replace(/\s+/gu, " ").trim().slice(0, CONCEPT_TWEAK_LIMIT);
}

export function conceptBrief(concept: GameConcept, tweak?: string): GameDesignBrief {
  const answers = {} as Record<GameBriefSlot, GameDesignAnswer>;
  for (const slot of GAME_BRIEF_SLOTS) answers[slot] = { ...SLOT_LABELS[slot], text: concept.brief[slot], source: "recommended" };
  const change = cleanTweak(tweak);
  // 사용자 변경은 요약의 마지막 줄에 온전히 남겨야 한다 — 요약이 길면 앞(추천안)을 줄인다.
  const tail = change ? `\n사용자 변경: ${change}` : "";
  const body = [
    `컨셉: ${concept.title} — ${concept.hook}`,
    `주인공: ${concept.protagonist}`,
    `무대: ${concept.stage}`,
    `첫 장면: ${concept.firstScene}`,
    ...GAME_BRIEF_SLOTS.map((slot) => `${answers[slot].label}: ${answers[slot].text} (추천안)`),
  ].join("\n").slice(0, SUMMARY_LIMIT - tail.length);
  return {
    version: 1,
    presetId: concept.presetId,
    answers,
    summary: body + tail,
    concept: { slug: concept.slug, title: concept.title, hook: concept.hook, ...(change ? { tweak: change } : {}) },
  };
}
