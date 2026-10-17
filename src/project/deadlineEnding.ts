// project/deadlineEnding.ts
// 「N일 뒤 결말」 공통 이벤트를 짓는 순수 함수(2026-10-16 romance-fix-4). 조수 도구 set_deadline_ending 과 연애 프리셋 기본값이 같은 몸통을 쓴다.
// 하루가 끝날 때(timeSystem.onDayEnd) 지난 날을 세고, N일째가 되면 호감 문턱 순서대로 엔딩을 부른다.
import { isTalkFriendshipEnabled } from "@/project/friendship";
import { ROMANCE_ENDING_HAPPY_AT, ROMANCE_ENDING_HAPPY_ID, ROMANCE_ENDING_NORMAL_AT, ROMANCE_ENDING_NORMAL_ID, SEGMENT_END_ENDING_ID } from "@/project/playableSegmentContract";
import { ANY_FRIENDSHIP_KEY } from "@/project/session";
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

/** 호감 대화 인물(characterId 있는 talkFriendship 이벤트)마다 「OO와 함께」 엔딩을 보장하고, 인물 엔딩 tiers 를 돌려준다. 이미 있는 같은 id 엔딩은 건드리지 않는다. 인물이 둘 미만이면 빈 배열. */
export function ensureHeroineEndings(project: Project): { readonly tiers: DeadlineTier[]; readonly generated: string[]; readonly heroines: number } {
  const heroines = new Map<string, string>();
  for (const map of Object.values(project.maps ?? {})) for (const event of map.events ?? []) {
    const key = event.characterId?.trim();
    if (key && isTalkFriendshipEnabled(event) && !heroines.has(key)) heroines.set(key, (event.name ?? key).trim() || key);
  }
  if (heroines.size < 2) return { tiers: [], generated: [], heroines: heroines.size };
  project.endings ??= [];
  const tiers: DeadlineTier[] = [];
  const generated: string[] = [];
  for (const [key, name] of heroines) {
    const endingId = `ending_with_${key.replace(/[^A-Za-z0-9_]+/gu, "_")}`;
    if (!project.endings.some((ending) => ending.id === endingId)) {
      project.endings.push({
        id: endingId, name: `${name}와 함께`, priority: 36,
        conditions: [{ kind: "friendshipAtLeast", npcKey: key, value: ROMANCE_ENDING_HAPPY_AT }],
        epilogue: [{ kind: "say", text: `${name}와(과) 마음이 닿은 채 이야기가 끝난다. 한 계절의 끝에서 두 사람의 거리는 처음과 전혀 다르다.` }],
      });
      generated.push(endingId);
    }
    tiers.push({ endingId, threshold: ROMANCE_ENDING_HAPPY_AT, characterId: key });
  }
  return { tiers, generated, heroines: heroines.size };
}

function chainEndingIds(commands: readonly Command[] | undefined, out: string[] = []): string[] {
  for (const command of commands ?? []) {
    if (command.kind === "triggerEnding" && typeof command.endingId === "string") out.push(command.endingId);
    if (command.kind === "fork") { chainEndingIds((command as { then?: Command[] }).then, out); chainEndingIds((command as { else?: Command[] }).else, out); }
  }
  return out;
}

/**
 * 연애 프리셋이 깔아 둔(또는 인물 엔딩만 얹은) 기본 기한 판정이면, 호감 대화 인물이 둘 이상이 된 시점에 인물별 엔딩을 맨 위에 얹는다.
 * 모델이 set_deadline_ending 으로 직접 짠 tiers(뼈대·인물 엔딩 밖 엔딩이 들어 있는 것)는 건드리지 않는다. 새로 만든 엔딩 id 를 돌려준다.
 */
export function syncHeroineDeadline(project: Project): string[] {
  const index = project.commonEvents.findIndex((entry) => entry.id === DEADLINE_ENDING_COMMON_EVENT_ID);
  if (index < 0) return [];
  const event = project.commonEvents[index]!;
  const forkAt = (event.commands as Command[]).findIndex((command) => command.kind === "fork"
    && (command as { condition?: { kind?: string; variableId?: string } }).condition?.variableId === DEADLINE_ENDING_VARIABLE_ID);
  if (forkAt < 0) return [];
  const fork = event.commands[forkAt] as Command & { then?: Command[] };
  const known = new Set([SEGMENT_END_ENDING_ID, ROMANCE_ENDING_HAPPY_ID, ROMANCE_ENDING_NORMAL_ID]);
  if (!chainEndingIds(fork.then).every((id) => known.has(id) || id.startsWith("ending_with_"))) return [];
  if (!(project.endings ?? []).some((ending) => ending.id === ROMANCE_ENDING_HAPPY_ID)) return [];
  const { tiers, generated, heroines } = ensureHeroineEndings(project);
  if (heroines < 2) return [];
  const full: DeadlineTier[] = [
    ...tiers,
    { endingId: ROMANCE_ENDING_NORMAL_ID, threshold: ROMANCE_ENDING_NORMAL_AT, characterId: ANY_FRIENDSHIP_KEY },
    { endingId: SEGMENT_END_ENDING_ID },
  ];
  const next = deadlineEndingChain(full);
  if (JSON.stringify(next) === JSON.stringify(fork.then)) return generated;
  const commands = [...event.commands];
  commands[forkAt] = { ...fork, then: next } as Command;
  project.commonEvents[index] = { ...event, commands } as CommonEvent;
  return generated;
}
