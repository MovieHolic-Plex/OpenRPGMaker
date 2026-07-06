// player/questLog.ts
// 플레이어 퀘스트 로그 모델(순수). project.quests 메타 + 세션 스위치/변수 상태로 단계 진행을 계산한다.
// DOM 비의존 — 렌더러(playerStatusMenuQuestScene)와 테스트가 함께 소비한다.

import type { PlaySession } from "@/project/session";
import { questFlagIds, type QuestDef, type QuestStep } from "@/project/quest/questDef";
import type { Project } from "@/project/types";

export type QuestState = "not-started" | "active" | "done";

export interface QuestLogStep {
  readonly index: number;
  readonly label: string;
  readonly done: boolean;
}

export interface QuestLogEntry {
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly state: QuestState;
  readonly steps: readonly QuestLogStep[];
  readonly completedSteps: number;
  readonly totalSteps: number;
}

function stepLabel(step: QuestStep, index: number): string {
  switch (step.kind) {
    case "talk":
      return `${index + 1}. 대화`;
    case "collect":
      return `${index + 1}. 수집: ${step.itemId} ×${step.count}`;
    case "kill":
      return `${index + 1}. 전투`;
    case "reach":
      return `${index + 1}. 목적지 도달`;
  }
}

function questState(session: PlaySession, ids: ReturnType<typeof questFlagIds>): QuestState {
  if (session.switches[ids.done]) return "done";
  if (session.switches[ids.started]) return "active";
  return "not-started";
}

// 단일 퀘스트의 로그 엔트리를 계산한다.
export function questLogEntry(def: QuestDef, session: PlaySession): QuestLogEntry {
  const ids = questFlagIds(def.key, def.steps.length);
  const state = questState(session, ids);
  const steps = def.steps.map((step, index): QuestLogStep => ({
    index,
    label: stepLabel(step, index),
    // done 퀘스트는 모든 단계 완료로 간주.
    done: state === "done" || Boolean(session.switches[ids.stepSwitches[index]]),
  }));
  const completedSteps = steps.filter((step) => step.done).length;
  return {
    key: def.key,
    title: def.title,
    summary: def.summary,
    state,
    steps,
    completedSteps,
    totalSteps: steps.length,
  };
}

// 프로젝트의 모든 퀘스트 로그를 계산한다(미시작 퀘스트도 포함해 목록에 표시).
export function buildQuestLog(project: Project, session: PlaySession): QuestLogEntry[] {
  return (project.quests ?? []).map((def) => questLogEntry(def, session));
}

// 상태 라벨(한국어).
export function questStateLabel(state: QuestState): string {
  switch (state) {
    case "not-started":
      return "미시작";
    case "active":
      return "진행 중";
    case "done":
      return "완료";
  }
}
