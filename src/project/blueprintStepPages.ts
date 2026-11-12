// project/blueprintStepPages.ts
// 청사진 단계가 가진 이벤트에 다른 함수가 얹은 페이지는, 그 단계가 열려 있는 동안 단계의 «연 페이지» 를 가리지 못한다.
//
// 왜 (2026-11-12 r1w-fun 「불씨를 되찾아서」): 엔진은 조건이 맞는 페이지 가운데 가장 뒤의 것을 돌린다. 경로 빌더는 단계의 사람에게
// [잠김 → 연 페이지(이 단계가 넘길 것을 넘긴다) → 넘긴 뒤] 를 짓는데, 그 뒤 create_quest 가 같은 사람에게 의뢰 페이지(제안 = 「아직 안 받았다」)를
// 덧붙였다. 제안 페이지는 게임 시작부터 조건이 맞으므로 연 페이지를 영영 가렸다 — 주술사는 의뢰 대사만 되풀이했고, 늪 출구는 「먼저 주술사를
// 찾아보자」 로 되돌려 보냈고(그 말 자체는 맞다 — 주술사가 넘길 수 없었을 뿐), 모델은 patch_event_page 24번으로 땜질했다.
//
// 규칙 하나: 단계 이벤트에서 연 페이지 뒤에 선 페이지는 «그 단계를 넘긴 뒤» 에만 조건이 맞아야 한다.
//  - 넘긴 뒤를 알리는 스위치가 있으면(연 페이지가 켜고, 넘긴 뒤 페이지가 기다리는 스위치 — 없으면 단계가 넘기는 깃발) 그 스위치를 조건에 더한다.
//  - 그런 스위치가 없으면(엔딩을 부르는 마지막 단계) 연 페이지가 기다리는 조건의 반대를 더한다 — 단계가 열리기 전에만 돈다.
//  페이지를 옮기지 않는다(조건만 더한다): 자리를 바꾸면 모델이 pageIndex 로 부르는 다음 호출이 다른 페이지를 고친다
//  (2026-11-12 명세 은행 fun-x1 재생: 엔딩 페이지 앞으로 옮긴 뒤 `patch_event_page{pageIndex:2}` 가 엔딩 페이지의 명령을 덮어썼다).
// 쓰는 곳 둘: 도구 실행기(조수의 모든 쓰기 도구가 지나는 한 곳, toolRunner)와 의뢰 컴파일러(얹을 페이지의 바탕을 «넘긴 뒤의 그 사람» 으로 고른다).

import { nestedCommandLists } from "./authoredCommandIndex";
import type { GameBlueprintStep } from "./gameBlueprint";
import type { Command, EventPage, EventPageCondition, GameEvent, Project } from "./types";

export interface StepPages {
  readonly step: GameBlueprintStep;
  readonly event: GameEvent;
  /** 이 단계가 넘길 것을 넘기는 페이지(스위치를 켜거나 · 물건을 주거나 · 엔딩을 부른다)의 자리. */
  readonly liveIndex: number;
  /** 넘긴 뒤를 알리는 스위치. 없으면 이 단계는 넘긴 뒤가 없다(엔딩). */
  readonly doneSwitchId?: string;
  /** 넘긴 뒤가 없는 단계에서 «아직 열리지 않았다» 를 뜻하는 조건(연 페이지 조건 하나의 반대). 연 페이지에 뒤집을 조건이 없으면 없다. */
  readonly notOpen?: EventPageCondition;
}

/** 조건 하나의 반대 — 뒤집을 수 있는 종류만(스위치 · 셀프 스위치 · 물건 · 배우). */
function opposite(condition: EventPageCondition): EventPageCondition | undefined {
  if (condition.kind === "switch" || condition.kind === "selfSwitch") return { ...condition, value: !condition.value };
  if (condition.kind === "item" || condition.kind === "actor") return { ...condition, present: !condition.present };
  return undefined;
}
const sameCondition = (a: EventPageCondition, b: EventPageCondition): boolean => JSON.stringify(a) === JSON.stringify(b);

function some(commands: readonly Command[], hit: (command: Command) => boolean): boolean {
  return commands.some((command) => hit(command) || nestedCommandLists(command).some((list) => some(list, hit)));
}

function switchesTurnedOn(commands: readonly Command[], out = new Set<string>()): Set<string> {
  for (const command of commands) {
    if (command.kind === "setSwitch" && command.value !== false) out.add(command.switchId);
    for (const list of nestedCommandLists(command)) switchesTurnedOn(list, out);
  }
  return out;
}

const waitsFor = (page: EventPage, switchId: string): boolean => page.conditions.some((c) => c.kind === "switch" && c.switchId === switchId);

/** 이 이벤트를 가진 청사진 단계와 그 연 페이지. 단계 것이 아니거나 연 페이지를 못 찾으면 undefined. */
export function stepPagesOf(project: Project, mapId: string, event: GameEvent): StepPages | undefined {
  const step = project.gameBlueprint?.steps.find((entry) => entry.built?.eventId === event.id && entry.built.mapId === mapId);
  const built = step?.built;
  const pages = event.pages ?? [];
  if (!step || !built || !pages.length) return undefined;
  const gives = (command: Command): boolean => built.switchId ? command.kind === "setSwitch" && command.switchId === built.switchId && command.value !== false
    : built.itemId ? command.kind === "changeItem" && command.itemId === built.itemId && command.op !== "-="
      : command.kind === "triggerEnding";
  let liveIndex = -1;
  pages.forEach((page, index) => { if (some(page.commands, gives)) liveIndex = index; });
  if (liveIndex < 0) return undefined;
  const turnedOn = switchesTurnedOn(pages[liveIndex]!.commands);
  // 넘긴 뒤 페이지가 기다리는 스위치(연 페이지가 켠 것 가운데) — 없으면 단계가 넘기는 깃발 자체가 «넘겼다» 다.
  const awaited = pages.slice(liveIndex + 1).flatMap((page) => page.conditions.flatMap((c) => (c.kind === "switch" && c.value !== false && turnedOn.has(c.switchId) ? [c.switchId] : [])))[0];
  const doneSwitchId = awaited ?? built.switchId;
  const notOpen = doneSwitchId ? undefined : pages[liveIndex]!.conditions.map(opposite).find((c): c is EventPageCondition => c !== undefined);
  return { step, event, liveIndex, ...(doneSwitchId ? { doneSwitchId } : {}), ...(notOpen ? { notOpen } : {}) };
}

/** 단계 이벤트에 얹는 페이지가 지녀야 할 조건 — 넘긴 뒤에만, 넘긴 뒤가 없는 단계면 열리기 전에만. 걸 조건이 없으면 빈 배열. */
export function stepHold(owner: StepPages | undefined): EventPageCondition[] {
  return owner?.doneSwitchId ? [{ kind: "switch", switchId: owner.doneSwitchId, value: true }] : owner?.notOpen ? [{ ...owner.notOpen }] : [];
}

/**
 * 프로젝트의 단계 이벤트마다 규칙을 맞춘다(제자리 수정). 바꾼 것을 한 줄씩 돌려준다 — 이미 맞으면 빈 배열(다시 불러도 같다).
 */
export function settleStepPages(project: Project): string[] {
  const notes: string[] = [];
  for (const step of project.gameBlueprint?.steps ?? []) {
    const built = step.built;
    const event = built ? project.maps[built.mapId]?.events.find((entry) => entry.id === built.eventId) : undefined;
    const owner = built && event ? stepPagesOf(project, built.mapId, event) : undefined;
    if (!owner || !event?.pages) continue;
    const pages = event.pages;
    const after = pages.slice(owner.liveIndex + 1);
    if (!after.length) continue;
    const name = event.name?.trim() || event.id;
    const hold = stepHold(owner)[0];
    if (!hold) continue;
    const held = after.filter((page) => !(owner.doneSwitchId ? waitsFor(page, owner.doneSwitchId) : page.conditions.some((c) => sameCondition(c, hold))));
    for (const page of held) page.conditions = [{ ...hold }, ...page.conditions];
    if (!held.length) continue;
    notes.push(owner.doneSwitchId
      ? `${step.id} «${name}»: ${held.length} page(s) added above this step's live page now wait for the step to be done (${owner.doneSwitchId}) — while the step is open its own page runs.`
      : `${step.id} «${name}»: ${held.length} page(s) added above the page that ends the game now run only before this step opens — once it is open the ending page runs.`);
  }
  return notes;
}
