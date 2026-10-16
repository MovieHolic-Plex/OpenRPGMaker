// project/deadlineEnding.ts
// 「N일 뒤 결말」 공통 이벤트를 짓는 순수 함수(2026-10-16 romance-fix-4). 조수 도구 set_deadline_ending 과 연애 프리셋 기본값이 같은 몸통을 쓴다.
// 하루가 끝날 때(timeSystem.onDayEnd) 지난 날을 세고, N일째가 되면 호감 문턱 순서대로 엔딩을 부른다.
import type { Command, CommonEvent, Project } from "@/project/types";

export const DEADLINE_ENDING_COMMON_EVENT_ID = "ce_deadline_ending";
export const DEADLINE_ENDING_VARIABLE_ID = "var_days_elapsed";

export interface DeadlineTier {
  readonly endingId: string;
  /** 이 호감 이상이면 이 엔딩. 생략하면 항상 맞는 기본 결말(마지막 항목만). */
  readonly threshold?: number;
  /** 호감을 읽을 인물 키. 「*」 = 가장 가까운 사람. */
  readonly characterId?: string;
}

/** tiers 를 위에서부터 보아 처음 맞는 엔딩을 부르는 중첩 fork. 마지막은 기본 결말. */
export function deadlineEndingChain(tiers: readonly DeadlineTier[]): Command[] {
  const last = tiers[tiers.length - 1]!;
  let chain: Command[] = [{ kind: "triggerEnding", endingId: last.endingId }];
  for (let index = tiers.length - 2; index >= 0; index -= 1) {
    const tier = tiers[index]!;
    chain = [{
      kind: "fork",
      condition: { kind: "friendshipAtLeast", npcKey: tier.characterId, value: tier.threshold! },
      then: [{ kind: "triggerEnding", endingId: tier.endingId }],
      else: chain,
    }];
  }
  return chain;
}

/** 공통 이벤트 한 개(이전 onDayEnd 가 있으면 먼저 부른다). */
export function buildDeadlineEndingEvent(days: number, tiers: readonly DeadlineTier[], previousHook?: string): CommonEvent {
  const commands: Command[] = [
    ...(previousHook ? [{ kind: "callCommonEvent", commonEventId: previousHook } as Command] : []),
    { kind: "setVariable", variableId: DEADLINE_ENDING_VARIABLE_ID, op: "+=", value: 1 } as Command,
    { kind: "fork", condition: { kind: "variable", variableId: DEADLINE_ENDING_VARIABLE_ID, op: ">=", value: days }, then: deadlineEndingChain(tiers) },
  ];
  return { id: DEADLINE_ENDING_COMMON_EVENT_ID, name: `기한 엔딩 판정(${days}일)`, trigger: "none", commands } as CommonEvent;
}

/** 프로젝트에 기한 엔딩을 건다(변수·공통 이벤트·onDayEnd). 시간 시스템이 꺼져 있으면 false. 같은 호출은 갱신이다. */
export function installDeadlineEnding(project: Project, days: number, tiers: readonly DeadlineTier[]): boolean {
  const timeSystem = project.system.timeSystem;
  if (!timeSystem?.enabled || tiers.length === 0) return false;
  if (!project.variables.some((entry) => entry.id === DEADLINE_ENDING_VARIABLE_ID)) project.variables.push({ id: DEADLINE_ENDING_VARIABLE_ID, name: "지난 날" });
  project.session.variables[DEADLINE_ENDING_VARIABLE_ID] ??= 0;
  const previousHook = timeSystem.onDayEnd && timeSystem.onDayEnd !== DEADLINE_ENDING_COMMON_EVENT_ID ? timeSystem.onDayEnd : undefined;
  const event = buildDeadlineEndingEvent(days, tiers, previousHook && project.commonEvents.some((entry) => entry.id === previousHook) ? previousHook : undefined);
  const index = project.commonEvents.findIndex((entry) => entry.id === DEADLINE_ENDING_COMMON_EVENT_ID);
  if (index >= 0) project.commonEvents[index] = event; else project.commonEvents.push(event);
  project.system.timeSystem = { ...timeSystem, onDayEnd: DEADLINE_ENDING_COMMON_EVENT_ID };
  return true;
}
