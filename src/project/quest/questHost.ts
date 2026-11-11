// project/quest/questHost.ts
// 이미 있는 NPC 에 의뢰를 얹는 법 — 그 사람이 하던 일(대사·상점·여관·얼굴·움직임)은 그대로 두고 의뢰 페이지를 뒤에 덧붙인다.
//
// 왜 (2026-11-11 작은 일 둘째 묶음): 「약초 배달」을 얹자 여관 주인이 여관 없이 「고맙네.」만 말했고, 의뢰인의 화자가 「의뢰인」이 됐고,
// 완료 뒤 대사가 「자네 덕분에 살았어」로 바뀌고 움직임이 fixed 가 됐다. 같은 사람에게 의뢰를 하나 더 얹으면 앞 의뢰 페이지가 지워졌다.
// 뒤 페이지가 이기므로 의뢰 페이지는 「그 의뢰가 걸려 있는 동안」만 조건이 맞게 두고, 끝나면 그 사람 자신의 페이지로 돌아간다.

import { nestedCommandLists } from "../authoredCommandIndex";
import { pageAtStart } from "../eventPageNow";
import type { Command, EventPage, EventPageCondition, EventPageGraphic, GameEvent, Project } from "../types";
import { questDefId } from "./questDef";

export interface QuestHost {
  readonly event: GameEvent;
  /** 의뢰가 없을 때 지금 도는 그 사람 자신의 페이지 — 의뢰 페이지는 이 페이지의 그림·움직임·발동을 물려받는다. */
  readonly base: EventPage;
  /** 그 사람 대사의 화자 이름. 대사에 화자가 없으면 undefined(그 사람은 서술 줄로 말한다). */
  readonly speaker: string | undefined;
  readonly graphic: EventPageGraphic;
  /** 그 사람 대사 앞에 붙던 얼굴 명령 — 의뢰 줄도 같은 얼굴로 말한다. */
  readonly face: readonly Command[];
  /** 그 사람이 하던 가게 일(상점·여관·제작소) — 의뢰가 걸려 있는 동안에도 열린다. */
  readonly service: readonly Command[];
}

/** 옛 컴파일러가 기존 의뢰인 대사에 붙이던 화자 — 그 사람 이름이 아니다. */
export const GENERIC_GIVER = "의뢰인";
const SERVICE_KINDS: ReadonlySet<string> = new Set(["shop", "inn", "openCraftShop"]);
const LEGACY_SUFFIXES = ["unavailable", "offer", "active", "done"] as const;

const switchIs = (switchId: string, value: boolean): EventPageCondition => ({ kind: "switch", switchId, value });

function offersService(command: Command): boolean {
  return SERVICE_KINDS.has(command.kind) || nestedCommandLists(command).some((list) => list.some(offersService));
}

function firstSpeaker(commands: readonly Command[]): string | undefined {
  for (const command of commands) {
    if (command.kind === "text" && command.speaker?.trim() && command.speaker.trim() !== GENERIC_GIVER) return command.speaker.trim();
    for (const list of nestedCommandLists(command)) {
      const found = firstSpeaker(list);
      if (found) return found;
    }
  }
  return undefined;
}

/** 첫 대사 앞의 얼굴 명령(없으면 빈 배열). */
function leadingFace(commands: readonly Command[]): Command[] {
  for (const command of commands) {
    if (command.kind === "changeFace") return [structuredClone(command)];
    if (command.kind === "text") break;
  }
  return [];
}

/** 의뢰 컴파일러가 만든 페이지인가 — 페이지 id 가 `<이벤트>_<의뢰 키>_…` 다. */
export function isQuestPage(project: Project, event: GameEvent, page: EventPage, alsoKey?: string): boolean {
  const keys = (project.quests ?? []).map(questDefId);
  if (alsoKey) keys.push(alsoKey);
  return keys.some((key) => page.id.startsWith(`${event.id}_${key}_`));
}

/** 그 사람 자신의 페이지(의뢰가 만든 것 제외). */
function ownPages(project: Project, event: GameEvent, key: string): EventPage[] {
  return (event.pages ?? []).filter((page) => !isQuestPage(project, event, page, key));
}

/** 옛 배치(키 없는 `<이벤트>_offer|_active|_done|_unavailable`)의 의뢰 키 — 진행 페이지 조건 `sw_<키>_started` 에서 읽는다. */
function legacyQuestKey(event: GameEvent): string | undefined {
  for (const suffix of ["active", "offer"] as const) {
    const page = event.pages?.find((entry) => entry.id === `${event.id}_${suffix}`);
    const ids = suffix === "active"
      ? (page?.conditions ?? []).flatMap((condition) => (condition.kind === "switch" ? [condition.switchId] : []))
      : acceptSwitches(page?.commands ?? []);
    const key = ids.map((id) => /^sw_(.+)_started$/u.exec(id)?.[1]).find(Boolean);
    if (key) return key;
  }
  return undefined;
}

function lastChoices(commands: readonly Command[]): number {
  for (let index = commands.length - 1; index >= 0; index -= 1) if (commands[index]!.kind === "choices") return index;
  return -1;
}

/** 제안 페이지의 수락 갈래가 켜는 스위치들. */
function acceptSwitches(commands: readonly Command[]): string[] {
  const choices = commands[lastChoices(commands)];
  const branch = choices?.kind === "choices" ? choices.options[0]?.branch ?? [] : [];
  return branch.flatMap((command) => (command.kind === "setSwitch" ? [command.switchId] : []));
}

/** 옛 제안 페이지 앞머리에 접혀 있던 그 사람의 인사(요약 한 줄 + 선택지 앞까지). */
function foldedGreeting(offer: EventPage | undefined): Command[] {
  if (!offer) return [];
  const at = lastChoices(offer.commands);
  if (at < 0) return [];
  const head = offer.commands.slice(0, offer.commands[at - 1]?.kind === "text" ? at - 1 : at);
  // 화자가 「의뢰인」으로 바뀌기 직전에 끼워진 빈 얼굴 지우기 명령은 인사가 아니다.
  while (head.at(-1)?.kind === "changeFace") head.pop();
  return structuredClone(head);
}

/**
 * 의뢰를 얹기 전에 그 사람의 페이지를 정리한다.
 * - 이 의뢰가 전에 만든 페이지(다시 컴파일)는 뺀다.
 * - 옛 배치의 의뢰 페이지가 있으면: 접혀 사라진 인사를 그 사람 페이지로 되살리고, 이 의뢰 것이면 빼고, 다른 의뢰 것이면
 *   지금 배치로 맞춘다(걸려 있는 동안만 조건이 맞게 · 키가 든 id · 진행/완료 페이지에도 가게 일 · 화자는 그 사람 이름).
 */
export function prepareQuestHost(project: Project, event: GameEvent, key: string): void {
  if (!event.pages?.length) return;
  event.pages = event.pages.filter((page) => !page.id.startsWith(`${event.id}_${key}_`));
  const legacyKey = legacyQuestKey(event);
  const known = legacyKey !== undefined && (legacyKey === key || (project.quests ?? []).some((quest) => questDefId(quest) === legacyKey));
  if (!known) return;
  const legacy = new Map(LEGACY_SUFFIXES.flatMap((suffix) => {
    const page = event.pages!.find((entry) => entry.id === `${event.id}_${suffix}`);
    return page ? [[suffix, page] as const] : [];
  }));
  const offer = legacy.get("offer");
  const greeting = foldedGreeting(offer);
  const rest = event.pages.filter((page) => ![...legacy.values()].includes(page));
  const hasOwnTalk = rest.some((page) => page.conditions.length === 0 && !isQuestPage(project, event, page, key));
  if (offer && greeting.length > 0 && !hasOwnTalk) {
    rest.unshift({ ...structuredClone(offer), id: `${event.id}_base`, name: event.name ?? firstSpeaker(greeting) ?? offer.name, conditions: [], commands: greeting });
  }
  if (legacyKey === key) {
    event.pages = rest;
    return;
  }
  const started = `sw_${legacyKey}_started`, done = `sw_${legacyKey}_done`;
  const speaker = firstSpeaker(greeting) ?? firstSpeaker(rest.flatMap((page) => page.commands));
  const service = greeting.filter(offersService);
  const has = (page: EventPage, switchId: string): boolean => page.conditions.some((condition) => condition.kind === "switch" && condition.switchId === switchId);
  for (const [suffix, page] of legacy) {
    page.id = `${event.id}_${legacyKey}_${suffix}`;
    if (suffix === "offer" && !has(page, started)) page.conditions.push(switchIs(started, false));
    if (suffix === "active" && !has(page, done)) page.conditions.push(switchIs(done, false));
    if ((suffix === "active" || suffix === "done") && !page.commands.some(offersService)) page.commands.push(...structuredClone(service));
    if (speaker) renameSpeaker(page.commands, speaker);
  }
  event.pages = [...rest, ...legacy.values()];
}

function renameSpeaker(commands: readonly Command[], speaker: string): void {
  for (const command of commands) {
    if (command.kind === "text" && command.speaker === GENERIC_GIVER) command.speaker = speaker;
    for (const list of nestedCommandLists(command)) renameSpeaker(list, speaker);
  }
}

/** 그 사람이 지금 하는 일을 읽는다. prepareQuestHost 뒤에 부른다. */
export function questHost(project: Project, event: GameEvent, key: string): QuestHost {
  const own = ownPages(project, event, key);
  const first = event.pages![0]!;
  const base = pageAtStart(project, event, own) ?? own[0] ?? { ...structuredClone(first), conditions: [], commands: [] };
  return {
    event,
    base,
    speaker: firstSpeaker(base.commands) ?? firstSpeaker(own.flatMap((page) => page.commands)),
    graphic: base.graphic ?? { transparent: true },
    face: leadingFace(base.commands),
    service: base.commands.filter(offersService),
  };
}

/** 그 사람 페이지를 본뜬 의뢰 페이지 — 그림·움직임·몸 크기·우선순위를 물려받는다. 자동 실행 페이지를 본떠도 의뢰는 말을 걸어야 돈다. */
export function hostPage(host: QuestHost, id: string, conditions: EventPageCondition[], commands: Command[]): EventPage {
  const base = structuredClone(host.base);
  const talk = base.trigger.kind === "auto" || base.trigger.kind === "parallel" ? { kind: "action" as const } : base.trigger;
  return { ...base, id, conditions, trigger: talk, commands };
}

/** 의뢰 줄을 그 사람 얼굴로 말하고, 끝에 그 사람의 가게 일을 잇는다. */
export function hostCommands(host: QuestHost, commands: readonly Command[], withService = true): Command[] {
  return [...structuredClone(host.face), ...commands, ...(withService ? structuredClone(host.service) : [])];
}
