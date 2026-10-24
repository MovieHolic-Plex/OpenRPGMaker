// 수납 뒤지기 저작 패턴 — 상자·통·자루·서랍 이벤트를 「연출 → 들킴 판정 → 전리품 → 뒤진 흔적」 꼴로 짓거나 고친다.
//
// 이 파일은 기존 명령만 쓴다(새 명령 종류 없음):
//  - 연출 = showAnimation `fx:container:<종류>`(wait), 전리품 떠오르기 = showAnimation `fx:popup:…`(project/containerFx.ts).
//  - 뒤진 흔적 = 「이미 뒤짐」 페이지의 interaction { kind: "container", searched: true }.
//  - 집주인: eventSeesPlayer(벽·방 경계를 지키는 시선) — 보면 돌아보고 「!」 뒤 꾸중. 시끄러운 수납(상자 부수기)은
//    hearRange 로 벽 너머에서도 듣는다 — 들으면 「?」 와 함께 이쪽을 돌아본다(꾸중은 보았을 때만).
// 두 가지로 쓴다: buildContainerSearchEvent(새로 짓기), applyContainerSearchPattern(이미 있는 수납 이벤트 고치기).
import {
  CONTAINER_FX,
  containerFxId,
  goldPopupFxId,
  itemPopupFxId,
  type ContainerStyle,
} from "@/project/containerFx";
import type { Command, Condition, GameEvent, GameMap } from "@/project/types";

type Page = NonNullable<GameEvent["pages"]>[number];

/** 수납을 여는 연출(소리·흔들림·파편·뚜껑). 끝날 때까지 기다린다. */
export function containerFxCommands(style: ContainerStyle): Command[] {
  return [{ kind: "showAnimation", target: { eventId: "" }, animationId: containerFxId(style), wait: true } as Command];
}

/** 전리품 명령(changeItem/changeGold +=) 하나에 맞는 떠오르기 연출. 해당 없으면 null. */
export function lootPopupFor(command: Command): Command | null {
  if (command.kind === "changeItem" && (command as { op?: string }).op !== "-=") {
    const itemId = (command as { itemId?: string }).itemId;
    return itemId ? ({ kind: "showAnimation", target: { eventId: "" }, animationId: itemPopupFxId(itemId), wait: false } as Command) : null;
  }
  if (command.kind === "changeGold" && (command as { op?: string }).op !== "-=") {
    const amount = Number((command as { amount?: unknown }).amount);
    return Number.isFinite(amount) && amount > 0 ? ({ kind: "showAnimation", target: { eventId: "" }, animationId: goldPopupFxId(amount), wait: false } as Command) : null;
  }
  return null;
}

const isPopup = (command: Command | undefined): boolean =>
  command?.kind === "showAnimation" && String((command as { animationId?: string }).animationId).startsWith("fx:popup:");

/** 명령 목록(분기 안까지)의 첫 전리품 명령 앞에 떠오르기 연출을 끼운다. 이미 있으면 두 번 넣지 않는다. */
export function withLootPopups(commands: readonly Command[]): Command[] {
  const out: Command[] = [];
  for (const command of commands) {
    const popup = lootPopupFor(command);
    if (popup && !out.some(isPopup)) {
      // 「…을 찾았다」 대사가 바로 앞에 있으면 그 대사(와 얼굴 바꾸기) 앞에 — 글과 함께 떠오른다.
      let at = out.length;
      if (out[at - 1]?.kind === "text") at--;
      if (at < out.length && out[at - 1]?.kind === "changeFace") at--;
      out.splice(at, 0, popup);
    }
    out.push(mapBranches(command, withLootPopups));
  }
  return out;
}

function mapBranches(command: Command, fn: (list: readonly Command[]) => Command[]): Command {
  if (command.kind !== "fork") return command;
  const fork = command as Command & { then?: Command[]; else?: Command[] };
  return { ...fork, ...(fork.then ? { then: fn(fork.then) } : {}), ...(fork.else ? { else: fn(fork.else) } : {}) } as Command;
}

/** 집주인이 알아차리는 몸짓: 주인공 쪽으로 돌아보고 말풍선, 잠깐 멈춤. emote = exclamation(봄) · question(들음). */
export function ownerNoticeCommands(ownerId: string, emote: "exclamation" | "question" = "exclamation"): Command[] {
  return [
    { kind: "moveEvent", eventId: ownerId, route: { moves: [{ kind: "turnTowardPlayer" }], repeat: false, wait: false, skippable: true } } as Command,
    { kind: "showEmote", target: { eventId: ownerId }, emote, durationMs: 900 } as Command,
    { kind: "wait", ms: emote === "exclamation" ? 420 : 300 } as Command,
  ];
}

/** 집주인이 「지금 어느 방에 있나」 로 고르는 대사 — 방(로케이션)마다 하나. 어느 방에도 없으면 fallback. */
export function roomAwareCommands(
  ownerId: string,
  locations: GameMap["locations"] | undefined,
  line: (location: NonNullable<GameMap["locations"]>[number]) => Command[] | null,
  fallback: Command[] = [],
): Command[] {
  let chain: Command[] = fallback;
  for (const location of [...(locations ?? [])].reverse()) {
    const then = line(location);
    if (!then) continue;
    chain = [{
      kind: "fork",
      condition: { kind: "insideLocation", locationId: location.id, inside: true, eventId: ownerId } as Condition,
      then,
      else: chain,
    } as unknown as Command];
  }
  return chain;
}

/** 시끄러운 행동을 들었는가(벽 하나당 +3칸). 보는 판정은 섞지 않는다(range 0). */
export function ownerHearsCondition(ownerId: string, hearRange: number): Condition {
  return { kind: "eventSeesPlayer", eventId: ownerId, range: 0, hearRange } as Condition;
}

export interface ContainerSearchOptions {
  readonly style: ContainerStyle;
  /** 집주인 이벤트 id(없으면 누구도 지켜보지 않는 수납). */
  readonly ownerId?: string;
  /** 들을 수 있는 거리. 생략 = 종류의 noise(상자·통만 시끄럽다). 0 = 듣지 않는다. */
  readonly hearRange?: number;
  /** 들었을 때 집주인 대사(「?」 뒤). 생략 = 말없이 돌아보기만. */
  readonly heardLines?: readonly Command[];
}

/**
 * 이미 있는 수납 이벤트를 패턴으로 고친다(제자리 수정, 두 번 불러도 같다).
 *  - 뒤지기 페이지(조건 없는 첫 페이지): interaction container, 맨 앞에 여는 연출, 전리품마다 떠오르기.
 *    집주인 「봄」 분기(eventSeesPlayer range>0)의 「!」 를 돌아보기+「!」+멈춤으로 바꾼다.
 *    시끄러운 종류면 「못 봄」 쪽에 「들음」 분기(돌아보기+「?」)를 끼운다.
 *  - 이미 뒤짐 페이지(셀프 스위치 조건): interaction container searched → 흔적.
 * 반환: 바꾼 것이 있으면 true.
 */
export function applyContainerSearchPattern(event: GameEvent, options: ContainerSearchOptions): boolean {
  const pages = event.pages ?? [];
  if (pages.length === 0) return false;
  const search = pages.find((page) => (page.conditions ?? []).length === 0) ?? pages[0]!;
  let changed = false;
  for (const page of pages) {
    const searched = page !== search;
    const wanted = { kind: "container" as const, style: options.style, ...(searched ? { searched: true } : {}) };
    if (JSON.stringify(page.interaction ?? null) !== JSON.stringify(wanted)) { (page as Page).interaction = wanted; changed = true; }
  }
  const fxId = containerFxId(options.style);
  const commands = search.commands ?? [];
  if (JSON.stringify(commands).includes(fxId)) return changed;
  let body = withLootPopups(commands);
  if (options.ownerId) body = body.map((command) => upgradeOwnerFork(command, options));
  search.commands = [...containerFxCommands(options.style), ...body];
  return true;
}

function isSeesFork(command: Command, ownerId: string): boolean {
  const condition = (command as { condition?: { kind?: string; eventId?: string; range?: number; sameRoom?: boolean; requireFacing?: boolean } }).condition;
  return command.kind === "fork" && condition?.kind === "eventSeesPlayer" && condition.eventId === ownerId
    && condition.sameRoom !== false && condition.requireFacing !== false && (condition.range ?? 5) > 0;
}

function upgradeOwnerFork(command: Command, options: ContainerSearchOptions): Command {
  const ownerId = options.ownerId!;
  if (!isSeesFork(command, ownerId)) return mapBranches(command, (list) => list.map((c) => upgradeOwnerFork(c, options)));
  const fork = command as Command & { then?: Command[]; else?: Command[] };
  // 봄: 첫 「!」 말풍선을 돌아보기+「!」+멈춤으로.
  const then = [...(fork.then ?? [])];
  const emoteAt = then.findIndex((c) => c.kind === "showEmote" && (c as { emote?: string }).emote === "exclamation");
  if (emoteAt >= 0) then.splice(emoteAt, 1, ...ownerNoticeCommands(ownerId, "exclamation"));
  else then.unshift(...ownerNoticeCommands(ownerId, "exclamation"));
  // 못 봄: 시끄러우면 들음 분기.
  const hear = Math.max(0, options.hearRange ?? CONTAINER_FX[options.style].noise);
  const otherwise = fork.else ?? [];
  const heard = hear > 0
    ? [{
      kind: "fork",
      condition: ownerHearsCondition(ownerId, hear),
      then: [...ownerNoticeCommands(ownerId, "question"), ...(options.heardLines ?? []), ...otherwise],
      else: otherwise,
    } as unknown as Command]
    : otherwise;
  return { ...fork, then, else: heard } as Command;
}

export interface ContainerSearchEventSpec extends ContainerSearchOptions {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  /** 뒤져서 얻는 것(대사·changeItem·changeGold …). 셀프 스위치 A 는 패턴이 켠다. */
  readonly loot: readonly Command[];
  /** 집주인이 보았을 때(「!」 뒤): 꾸중·쫓아내기 …. 생략 = 꾸중 없이 그냥 챙긴다. */
  readonly caught?: readonly Command[];
  /** 이미 뒤진 칸을 다시 조사할 때. */
  readonly searchedText?: readonly Command[];
}

/** 새 수납 이벤트(투명, 조사 키, 두 페이지)를 패턴대로 짓는다. 칸의 그림은 타일이 맡는다. */
export function buildContainerSearchEvent(spec: ContainerSearchEventSpec): GameEvent {
  const take: Command[] = [...spec.loot, { kind: "setSelfSwitch", key: "A", value: true } as Command];
  const first: Command[] = spec.ownerId
    ? [{
      kind: "fork",
      condition: { kind: "eventSeesPlayer", eventId: spec.ownerId, range: 5 } as Condition,
      then: [{ kind: "showEmote", target: { eventId: spec.ownerId }, emote: "exclamation", durationMs: 900 } as Command, ...take, ...(spec.caught ?? [])],
      else: take,
    } as unknown as Command]
    : take;
  const page = (id: string, name: string, conditions: Page["conditions"], commands: Command[]): Page => ({
    id, name, conditions, graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  } as unknown as Page);
  const event = {
    id: spec.id, name: spec.name, x: spec.x, y: spec.y, trigger: { kind: "action" }, commands: [],
    pages: [
      page(`${spec.id}_p0`, "뒤지기", [], first),
      page(`${spec.id}_p1`, "이미 뒤짐", [{ kind: "selfSwitch", key: "A", value: true }] as Page["conditions"], [...(spec.searchedText ?? [])]),
    ],
  } as unknown as GameEvent;
  applyContainerSearchPattern(event, spec);
  return event;
}
