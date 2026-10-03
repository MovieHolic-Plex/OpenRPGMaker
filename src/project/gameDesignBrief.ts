import { gameDesignExecutionContext } from "./gameDesignExecution";
import { detailedAuthoringPresetContext } from "./gameAuthoringPresets";
import { interviewPreset, normalizeGameInterview, type GameInterview } from "./gameInterview";
import { assert, requireRecord, requireString } from "./io/guards";
import { getHarness } from '../harnesses/_core/registry';
import { ROMANCE_ART_DIRECTION } from '../harnesses/romance-scene/artDirection';

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
  interview?: GameInterview;
  /** Model-only executable contract. Draft is distinct from validated implementation. */
  implementation?: { harnessId: string; contract: unknown };
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
  const interview = data.interview === undefined ? undefined : normalizeGameInterview(data.interview);
  let implementation: GameDesignBrief['implementation'];
  if (data.implementation !== undefined) {
    const raw = requireRecord('gameDesignBrief.implementation', data.implementation);
    const harnessId = requireString('implementation.harnessId', raw.harnessId);
    const harness = getHarness(harnessId);
    assert(Boolean(harness?.contract), '제작 하네스 계약을 읽을 수 없습니다.');
    implementation = { harnessId, contract: harness!.contract!.normalize(raw.contract) };
  }
  assert(!interview || interviewPreset(interview.genre, interview.secondary) === data.presetId, "인터뷰와 게임 시스템이 다릅니다.");
  return {
    version: 1, presetId: data.presetId as GamePresetId, answers: normalized,
    summary: bounded(data.summary, "게임 기획 요약", GAME_BRIEF_SUMMARY_LIMIT),
    ...(data.generationPending === undefined ? {} : { generationPending: data.generationPending }),
    ...(interview ? { interview } : {}),
    ...(implementation ? { implementation } : {}),
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
    "인터뷰 그림은 분위기 참고용이다. 그림에서 주인공의 이름·성별·외형·관계나 게임 자산을 추론해 확정하지 않는다. interview의 원문과 선택을 보존하고, 명시하지 않은 주인공 설정은 임시 결정으로 구분한다.",
    JSON.stringify({ preset: brief.presetId, summary: brief.summary, answers: brief.answers, interview: brief.interview }),
    detailedAuthoringPresetContext(brief),
    ...(brief.implementation?.harnessId === 'romance-scene' ? [ROMANCE_ART_DIRECTION] : []),
    ...(brief.implementation ? [
      '## 실행 하네스 계약', JSON.stringify(brief.implementation),
      '이 계약의 인물·장소·선택 문구·한 맵 범위는 보존한다. 임시 초안은 완료가 아니다. 첫 시공 배정의 첫 쓰기는 author_romance_scene으로 한다. 배경을 꾸미기 전에 첫 대화가 화면에 반영되어야 한다. 이 도구로 실제 도입·선택별 다른 반응·재대화·마무리를 작성한다. 장소를 실제 타일·구조·소품으로 꾸미고 inspect_romance_scene으로 동작을 확인한다. finish는 실행기가 같은 계약의 양쪽 선택·재대화·취소·종료를 검사하며 실패하면 받지 않는다. 이름 변경·맵 이름 변경만으로 완료하지 않는다. review_map의 검수자는 show_map_region으로 실제 원본 이미지를 보고 report_review에서 지적이 없는 결과를 제출해야 한다. 검수 후 바뀐 맵은 다시 검수한다. 이 검수 없이 finish하지 않는다. 정본 SQLite 저장·재로드는 별도로 확인한다.',
    ] : []),
    gameDesignExecutionContext(brief),
  ].join("\n");
}
