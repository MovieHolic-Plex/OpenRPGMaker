// player/questLog.ts
// 플레이어 퀘스트 로그 모델(순수). project.quests 메타 + 세션 스위치/변수 상태로 단계 진행을 계산한다.
// DOM 비의존 — 렌더러(playerStatusMenuQuestScene)와 테스트가 함께 소비한다.

import type { PlaySession } from "@/project/session";
import {
  extractQuestGraphConditions,
  questGraphConditionMet,
} from "@/project/quest/questGraph";
import {
  isQuestGraphDef,
  questFlagIds,
  type AnyQuestDef,
  type QuestDef,
  type QuestGraphDef,
  type QuestStep,
} from "@/project/quest/questDef";
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
  if (step.label) return `${index + 1}. ${step.label}`;
  switch (step.kind) {
    case "talk":
      return `${index + 1}. 대화`;
    case "collect":
      return `${index + 1}. 수집: ${step.itemId} ×${step.count}`;
    case "kill":
      return `${index + 1}. 전투`;
    case "reach":
      return `${index + 1}. 목적지 도달`;
    case 'inspect': return `${index + 1}. 단서 조사`;
    case 'deliver': return `${index + 1}. 납품: ${step.itemId} ×${step.count}`;
    case 'choice': return `${index + 1}. 해결 방법 선택`;
    case 'escort': return `${index + 1}. 인물과 동행`;
    case 'craft': return `${index + 1}. 제작`;
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

function graphQuestLogEntry(project: Project, def: QuestGraphDef, session: PlaySession): QuestLogEntry {
  const steps = def.nodes.map((node, index): QuestLogStep => {
    const done = extractQuestGraphConditions(node.completesWhen).every((condition) => {
      try {
        return questGraphConditionMet(project, session, condition);
      } catch {
        return false;
      }
    });
    return {
      index,
      label: `${index + 1}. ${node.description}`,
      done,
    };
  });
  const completedSteps = steps.filter((step) => step.done).length;
  const state: QuestState = completedSteps === 0 ? "not-started" : completedSteps === steps.length ? "done" : "active";
  return {
    key: def.id,
    title: def.title,
    summary: def.summary ?? "",
    state,
    steps,
    completedSteps,
    totalSteps: steps.length,
  };
}

function questLogEntryForProject(project: Project, def: AnyQuestDef, session: PlaySession): QuestLogEntry {
  return isQuestGraphDef(def) ? graphQuestLogEntry(project, def, session) : questLogEntry(def, session);
}

// 프로젝트의 모든 퀘스트 로그를 계산한다(미시작 퀘스트도 포함해 목록에 표시).
export function buildQuestLog(project: Project, session: PlaySession): QuestLogEntry[] {
  return (project.quests ?? []).map((def) => questLogEntryForProject(project, def, session));
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
