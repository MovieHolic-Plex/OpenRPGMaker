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

// ── 이벤트 CRUD ──
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
    const eventId = genId("ev");
    const commands: Command[] = [{ kind: "text", body: "..." }];
    const ev: GameEvent = {
      id: eventId,
      x,
      y,
      sprite: { type: "bundled", id: DEFAULT_SPRITE_NPC },
      trigger,
      commands,
    };
    ev.pages = [createDefaultEventPage(ev, 1)];
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

// 실용적 접근: path = [cmdIdx, optIdx, cmdIdx, optIdx, ...]
//   - cmdIdx: 현재 리스트에서 명령 선택
//   - (선택 후) 그게 choices면 optIdx로 옵션 선택 → 그 옵션의 branch가 다음 리스트
// 마지막 원소가 항상 cmdIdx(대상 명령).

function resolveList(
  commands: Command[],
  path: number[]
): Command[] | null {
  // path 길이가 홀수여야 함(마지막은 cmdIdx).
  // path[0] = cmd, path[1] = option, path[2] = cmd, ...
  // 리스트를 반환하기 위해 마지막 cmdIdx 직전까지 타고 내려간다.
  // 즉 path.length가 1이면 commands 자체.
  // path.length가 3이면: commands[path[0]].choices.options[path[1]].branch 가 리스트.
  let list: Command[] = commands;
  for (let i = 0; i < path.length - 1; i += 2) {
    const cmdIdx = path[i];
    const optIdx = path[i + 1];
    const cmd = list[cmdIdx];
    if (!cmd || cmd.kind !== "choices") return null;
    const opt = cmd.options[optIdx];
    if (!opt) return null;
    list = opt.branch;
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

// ── 기본 명령 팩토리 ──
// O1에선 모든 v2 kind의 기본값을 제공(컴파일 통과). 상세 폼은 O4에서.
export function newCommand(kind: Command["kind"]): Command {
  switch (kind) {
    case "text":
      return { kind: "text", speaker: "", body: "" };
    case "choices":
      return {
        kind: "choices",
        prompt: "",
        options: [{ text: "선택지 1", branch: [{ kind: "text", body: "" }] }],
      };
    case "fork":
      return {
        kind: "fork",
        condition: { kind: "switch", switchId: "", value: true },
        then: [{ kind: "text", body: "" }],
      };
    case "wait":
      return { kind: "wait", ms: 500 };
    case "inputWait":
      return { kind: "inputWait" };
    case "label":
      return { kind: "label", name: "L1" };
    case "gotoLabel":
      return { kind: "gotoLabel", name: "L1" };
    case "setSwitch":
      return { kind: "setSwitch", switchId: "", value: true };
    case "setVariable":
      return { kind: "setVariable", variableId: "", op: "=", value: 0 };
    case "timer":
      return { kind: "timer", action: "set", seconds: 60 };
    case "transfer":
      return { kind: "transfer", mapId: "", x: 0, y: 0 };
    case "moveEvent":
      return { kind: "moveEvent", eventId: "", route: { moves: [], repeat: false } };
    case "changeTile":
      return { kind: "changeTile", mapId: "", layer: "lower", x: 0, y: 0, tile: 0 };
    case "callCommonEvent":
      return { kind: "callCommonEvent", commonEventId: "" };
    case "battleProcessing":
      return { kind: "battleProcessing", troopId: "", canEscape: true, canLose: false };
    case "learnSkill":
      return { kind: "learnSkill", actorId: "", skillId: "" };
    case "showPicture":
      return { kind: "showPicture", pictureId: "pic1", resourceId: "tex_tiles_default", x: 0, y: 0 };
    case "erasePicture":
      return { kind: "erasePicture", pictureId: "pic1" };
    case "playAudio":
      return { kind: "playAudio", resourceId: "", loop: false };
    case "stopAudio":
      return { kind: "stopAudio" };
    case "shop":
      return { kind: "shop", itemIds: [] };
    case "inn":
      return { kind: "inn", price: 0 };
    case "gameOver":
      return { kind: "gameOver" };
    case "ending":
      return { kind: "ending", title: "The End", message: "Thank you for playing." };
    case "returnToTitle":
      return { kind: "returnToTitle" };
    case "setFlag": // 레거시(마이그레이션 잔여 호환)
      return { kind: "setFlag", flag: "flag1", value: true };
    default: {
      // never 체크: 새 kind 추가 시 여기서 컴파일 에러.
      const _exhaustive: never = kind;
      void _exhaustive;
      return { kind: "text", body: "" };
    }
  }
}

// 빈 조건(사용 안 함) 헬퍼.
export function noCondition(): Condition | undefined {
  return undefined;
}
