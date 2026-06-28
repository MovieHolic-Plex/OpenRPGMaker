// editor/eventActions.ts
// 이벤트 및 명령(Command) 편집 액션. store.update 경유.
// 명령 리스트는 재귀 합타입이라 경로(인덱스 배열)로 특정 명령을 찾는다.

import { store } from "@/project/store";
import { createDefaultEventPage } from "@/editor/eventPages";
import { genId } from "@/util/id";
import type {
  GameEvent,
  Command,
  MapId,
  Trigger,
  Condition,
} from "@/project/types";
import { DEFAULT_SPRITE_NPC } from "@/project/defaults";
export { newCommand, newM2Command } from "@/editor/eventCommandFactory";

const SHOP_TRANSACTION_BRANCH_INDEX = -1;

// ── 이벤트 CRUD ──
export function createDefaultGameEvent(
  x: number,
  y: number,
  trigger: Trigger = { kind: "action" }
): GameEvent {
  const eventId = genId("ev");
  const commands: Command[] = [];
  const ev: GameEvent = {
    id: eventId,
    x,
    y,
    sprite: { type: "bundled", id: DEFAULT_SPRITE_NPC },
    trigger,
    commands,
  };
  ev.pages = [createDefaultEventPage(ev, 1)];
  return ev;
}

export function addEvent(
  mapId: MapId,
  x: number,
  y: number,
  trigger: Trigger = { kind: "action" }
): string {
  let newId = "";
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) return;
    const ev = createDefaultGameEvent(x, y, trigger);
    m.events.push(ev);
    newId = ev.id;
  });
  return newId;
}

export function deleteEvent(mapId: MapId, eventId: string): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    m.events = m.events.filter((e) => e.id !== eventId);
  });
}

export function moveEvent(mapId: MapId, eventId: string, x: number, y: number): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    const ev = m.events.find((e) => e.id === eventId);
    if (ev) {
      ev.x = x;
      ev.y = y;
    }
  });
}

export function updateEvent(
  mapId: MapId,
  eventId: string,
  patch: Partial<Pick<GameEvent, "sprite" | "trigger" | "condition">>
): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    const ev = m.events.find((e) => e.id === eventId);
    if (!ev) return;
    if (patch.sprite !== undefined) ev.sprite = patch.sprite;
    if (patch.trigger !== undefined) ev.trigger = patch.trigger;
    if (patch.condition !== undefined) {
      ev.condition = patch.condition;
    }
  });
}

// ── 명령(Command) 편집 ──
// path: 이벤트 commands 안의 위치. 빈 배열 = 루트 리스트 자체.
// [0, "branch", 1] 식으로 인덱스/키가 번갈아 나옴: 숫자=배열 인덱스, "branch"=choices 옵션의 branch.
// 실제로는 path가 Command[]를 가리키는 "컨테이너 인덱스 배열" + 그 안의 "요소 인덱스".
// 단순화를 위해: containerPath(명령 리스트를 가리키는 경로) + index 사용.

// 경로 탐색: path는 commands 트리에서 "명령 리스트"를 가리킨다.
// 각 원소는 {cmd: index} 또는 {branchOf: parentPath, option: i}.
// 여기서는 단순화: path는 Command를 선택하기 위한 인덱스 배열이고,
// 짝수 위치(0,2,4)=해당 레벨의 command 인덱스, 마지막 인덱스까지가 대상.
// 단, choices 내부를 가리키려면 그 choices 명령을 찾은 뒤 option.branch로 진입.

function resolveList(
  commands: Command[],
  path: number[]
): Command[] | null {
  let list: Command[] = commands;
  for (let i = 0; i < path.length - 1; i += 2) {
    const cmdIdx = path[i];
    const branchIdx = path[i + 1];
    const cmd = list[cmdIdx];
    if (!cmd) return null;
    if (cmd.kind === "choices") {
      const opt = cmd.options[branchIdx];
      if (!opt) return null;
      list = opt.branch;
      continue;
    }
    if (cmd.kind === "shop" && branchIdx === SHOP_TRANSACTION_BRANCH_INDEX && cmd.transactionBranch) {
      list = cmd.transactionBranch;
      continue;
    }
    return null;
  }
  return list;
}

// 명령 추가: containerPath(리스트 경로, 빈 배열=루트 commands) 끝에 새 명령.
export function addCommand(
  mapId: MapId,
  eventId: string,
  containerPath: number[],
  command: Command
): void {
  store.update((p) => {
    const ev = p.maps[mapId]?.events.find((e) => e.id === eventId);
    if (!ev) return;
    const list =
      containerPath.length === 0
        ? ev.commands
        : resolveList(ev.commands, containerPath);
    if (!list) return;
    list.push(structuredClone(command));
  });
}

export function insertCommand(
  mapId: MapId,
  eventId: string,
  path: number[],
  command: Command
): void {
  store.update((p) => {
    const ev = p.maps[mapId]?.events.find((e) => e.id === eventId);
    if (!ev) return;
    const lastIdx = path[path.length - 1];
    const container = path.slice(0, -1);
    const list =
      container.length === 0
        ? ev.commands
        : resolveList(ev.commands, container);
    if (!list) return;
    list.splice(lastIdx, 0, structuredClone(command));
  });
}

export function deleteCommand(
  mapId: MapId,
  eventId: string,
  path: number[]
): void {
  store.update((p) => {
    const ev = p.maps[mapId]?.events.find((e) => e.id === eventId);
    if (!ev) return;
    const lastIdx = path[path.length - 1];
    const container = path.slice(0, -1);
    const list =
      container.length === 0
        ? ev.commands
        : resolveList(ev.commands, container);
    if (!list) return;
    list.splice(lastIdx, 1);
  });
}

export function replaceCommand(
  mapId: MapId,
  eventId: string,
  path: number[],
  command: Command
): void {
  store.update((p) => {
    const ev = p.maps[mapId]?.events.find((e) => e.id === eventId);
    if (!ev) return;
    const lastIdx = path[path.length - 1];
    const container = path.slice(0, -1);
    const list =
      container.length === 0
        ? ev.commands
        : resolveList(ev.commands, container);
    if (!list) return;
    list[lastIdx] = structuredClone(command);
  });
}

// 특정 경로의 명령 조회(편집기 폼 채우기용).
export function getCommand(
  event: GameEvent,
  path: number[]
): Command | null {
  const lastIdx = path[path.length - 1];
  const container = path.slice(0, -1);
  const list =
    container.length === 0
      ? event.commands
      : resolveList(event.commands, container);
  if (!list) return null;
  return list[lastIdx] ?? null;
}

// 빈 조건(사용 안 함) 헬퍼.
export function noCondition(): Condition | undefined {
  return undefined;
}
