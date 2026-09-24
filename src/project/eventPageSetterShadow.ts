// 「켜는 곳이 함께 켜서」 가려지는 페이지 — eventPageShadow(조건 부분집합)의 다음 단계.
//
// 런타임은 조건이 맞는 **마지막** 페이지 하나만 실행한다. 앞 페이지 A 가 스위치 a 를, 뒤 페이지 B 가 스위치 b 를
// 기다릴 때 조건 집합끼리는 부분집합이 아니라 eventPageShadow 는 조용하다. 그런데 a 를 켜는 모든 명령 목록이
// 같은 자리에서 b 도 켜면, a 가 켜지는 순간 b 도 켜져 있어 A 는 영영 실행되지 않는다.
//
// 실측(2026-09-24 갤러리 호러): 출구 그림 페이지 2 = 「장미를 넘김」 → 쓸쓸한 엔딩, 페이지 3 = 「인형과 대면함」 →
// 진엔딩. 인형 선택지 「장미를 넘긴다」 분기가 두 스위치를 함께 켜서 쓸쓸한 엔딩에 절대 닿지 못했다.
//
// 스위치 조건만 본다(값 true). 켜는 곳을 모두 알 수 있는 경우에만 판정한다 — 보수적으로, 켜는 곳이 하나라도
// 뒤 페이지 조건을 같이 켜지 않으면 가려지지 않은 것으로 본다.

import { nestedCommandLists } from "./authoredCommandIndex";
import type { Command, EventPage, EventPageCondition, Project } from "./types";

export interface SetterShadowedPage {
  readonly index: number;
  readonly byIndex: number;
  readonly switchIds: readonly string[];
  readonly bySwitchIds: readonly string[];
  readonly setterCount: number;
}

function switchConditions(conditions: readonly EventPageCondition[] | undefined): string[] | null {
  const ids: string[] = [];
  for (const condition of conditions ?? []) {
    if (condition.kind === "switch" && condition.value === true) ids.push(condition.switchId);
    else if (condition.kind === "all") {
      const inner = switchConditions(condition.conditions);
      if (!inner) return null;
      ids.push(...inner);
    } else return null; // 다른 종류가 섞이면 판정하지 않는다.
  }
  return ids;
}

/** 명령 목록(분기 하나)마다 그 목록이 직접 켜는 스위치 집합. */
function collectSetterLists(commands: readonly Command[] | undefined, out: Set<string>[]): void {
  if (!Array.isArray(commands)) return;
  const here = new Set<string>();
  for (const command of commands) {
    if (!command || typeof command !== "object") continue;
    if (command.kind === "setSwitch" && command.value === true && typeof command.switchId === "string") here.add(command.switchId);
    let nested: readonly (readonly Command[])[] = [];
    try { nested = nestedCommandLists(command); } catch { nested = []; }
    for (const list of nested) collectSetterLists(list, out);
  }
  if (here.size > 0) out.push(here);
}

export function projectSwitchSetterLists(project: Project): Set<string>[] {
  const out: Set<string>[] = [];
  for (const map of Object.values(project.maps ?? {})) {
    for (const event of map.events ?? []) {
      collectSetterLists(event.commands, out);
      for (const page of event.pages ?? []) collectSetterLists(page.commands, out);
    }
  }
  for (const common of project.commonEvents ?? []) collectSetterLists(common.commands, out);
  for (const troop of project.database?.troops ?? []) for (const page of troop.battleEventPages ?? []) collectSetterLists(page.commands, out);
  return out;
}

export function findSetterShadowedPages(pages: readonly EventPage[] | undefined, setterLists: readonly Set<string>[], startOn: ReadonlySet<string> = new Set()): SetterShadowedPage[] {
  const list = pages ?? [];
  const found: SetterShadowedPage[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const mine = switchConditions(list[i]!.conditions);
    if (!mine || mine.length === 0 || mine.every((id) => startOn.has(id))) continue;
    // A 가 열리는 순간 = A 의 마지막 스위치가 켜질 때. 그 스위치를 켜는 모든 목록을 본다.
    const openers = setterLists.filter((set) => mine.some((id) => set.has(id)));
    if (openers.length === 0) continue;
    for (let j = list.length - 1; j > i; j -= 1) {
      const theirs = switchConditions(list[j]!.conditions);
      if (!theirs || theirs.length === 0) continue; // 무조건 페이지는 eventPageShadow 가 짚는다.
      if (openers.every((set) => theirs.every((id) => set.has(id) || startOn.has(id)))) {
        found.push({ index: i, byIndex: j, switchIds: mine, bySwitchIds: theirs, setterCount: openers.length });
        break;
      }
    }
  }
  return found;
}

export function setterShadowedPageWarnings(project: Project, label: string, pages: readonly EventPage[] | undefined): string[] {
  const startOn = new Set(Object.entries(project.session?.switches ?? {}).filter(([, on]) => on === true).map(([id]) => id));
  return findSetterShadowedPages(pages, projectSwitchSetterLists(project), startOn).map((hit) =>
    `${label} 페이지 ${hit.index + 1}(${hit.switchIds.join("·")})는 영영 실행되지 않습니다 — 그 스위치를 켜는 곳(${hit.setterCount}곳)이 모두 `
    + `페이지 ${hit.byIndex + 1}의 조건(${hit.bySwitchIds.join("·")})도 함께 켜고, 런타임은 조건이 맞는 마지막 페이지만 실행합니다. `
    + "페이지 순서를 바꾸거나(더 구체적인 결말을 뒤로) 한쪽 분기에서 다른 스위치를 켜지 마세요.");
}

/** 프로젝트 전체의 가려진 페이지 — 키는 `mapId/eventId#index`. 쓰기 도구가 「이번 쓰기로 새로 생긴 것」만 알릴 때 쓴다. */
export function projectSetterShadowedPages(project: Project): Map<string, { mapId: string; eventId: string; message: string }> {
  const startOn = new Set(Object.entries(project.session?.switches ?? {}).filter(([, on]) => on === true).map(([id]) => id));
  const setters = projectSwitchSetterLists(project);
  const out = new Map<string, { mapId: string; eventId: string; message: string }>();
  for (const map of Object.values(project.maps ?? {})) {
    for (const event of map.events ?? []) {
      if (!event.pages || event.pages.length < 2) continue;
      const hits = findSetterShadowedPages(event.pages, setters, startOn);
      if (hits.length === 0) continue;
      const messages = setterShadowedPageWarnings(project, `이벤트 '${event.name ?? event.id}'(${map.id}/${event.id})`, event.pages);
      hits.forEach((hit, index) => out.set(`${map.id}/${event.id}#${hit.index}`, { mapId: map.id, eventId: event.id, message: messages[index] ?? "" }));
    }
  }
  return out;
}
