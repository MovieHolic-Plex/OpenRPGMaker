// editor/eventActions.ts
// 이벤트 및 명령(Command) 편집 액션. store.update 경유.
// 명령 리스트는 재귀 합타입이라 경로(인덱스 배열)로 특정 명령을 찾는다.

import { store, type ProjectChangeDescriptor } from "@/project/store";
import {
  commandContainerCaption,
  commandSlotCaption,
  createDefaultEventPage,
} from "@/editor/eventPages";
import { commandKindLabel } from "@/editor/panels/eventEditor/options";
import { genId } from "@/util/id";
import type {
  GameEvent,
  Command,
  MapId,
  Trigger,
  Condition,
} from "@/project/types";
// Default events are transparent (no charset) until the author picks a graphic.
import { resolveCommandAtPath, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
export { newCommand, newM2Command } from "@/editor/eventCommandFactory";

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
  // 이벤트를 mutator 밖에서 먼저 만든다 — 라벨/eventId 는 descriptor 인자라 mutator 실행
  // 전에 굳으므로, 안에서 만들면 "어느 이벤트가 생겼나" 를 로그에 실을 방법이 없다.
  const created = createDefaultGameEvent(x, y, trigger);
  let newId = "";
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) return;
    m.events.push(structuredClone(created));
    newId = created.id;
  }, { scope: "map", mapId, eventId: created.id, label: `이벤트 추가 (${x},${y})` });
  return newId;
}

export function deleteEvent(mapId: MapId, eventId: string): void {
  const removed = eventLogName(mapId, eventId);
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    m.events = m.events.filter((e) => e.id !== eventId);
  }, { scope: "map", mapId, eventId, label: `이벤트 삭제: ${removed}` });
}

export function moveEvent(mapId: MapId, eventId: string, x: number, y: number): void {
  const moved = eventLogName(mapId, eventId);
  store.updateMap(mapId, (m) => {
    const ev = m.events.find((e) => e.id === eventId);
    if (ev) {
      ev.x = x;
      ev.y = y;
    }
  // cells 는 일부러 비운다 — 리스너의 증분 재렌더 경로를 바꾸는 필드라서, 관측 목적으로
  // 채우면 드래그 이동의 렌더 경로가 함께 달라진다.
  }, { eventId, label: `이벤트 위치 이동: ${moved} → (${x},${y})` });
}

export function updateEvent(
  mapId: MapId,
  eventId: string,
  patch: Partial<Pick<GameEvent, "sprite" | "trigger" | "condition" | "schedule" | "characterId" | "giftPrefs" | "giftResponses" | "talkFriendship">>
): void {
  const label = `이벤트 속성 변경: ${eventLogName(mapId, eventId)} — ${eventPatchCaption(patch)}`;
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    const ev = m.events.find((e) => e.id === eventId);
    if (!ev) return;
    if ("sprite" in patch) ev.sprite = patch.sprite;
    if ("trigger" in patch && patch.trigger !== undefined) ev.trigger = patch.trigger;
    if ("condition" in patch) ev.condition = patch.condition;
    if ("schedule" in patch) ev.schedule = patch.schedule;
    if ("characterId" in patch) {
      const next = patch.characterId?.trim();
      if (next) ev.characterId = next;
      else {
        delete ev.characterId;
        // Avoid stamp restamping characterId=event.id solely from leftover talkFriendship.
        delete ev.talkFriendship;
      }
    }
    if ("giftPrefs" in patch) {
      if (patch.giftPrefs) ev.giftPrefs = patch.giftPrefs;
      else delete ev.giftPrefs;
    }
    if ("giftResponses" in patch) {
      if (patch.giftResponses) ev.giftResponses = patch.giftResponses;
      else delete ev.giftResponses;
    }
    if ("talkFriendship" in patch) {
      if (patch.talkFriendship === undefined || patch.talkFriendship === false) delete ev.talkFriendship;
      else ev.talkFriendship = patch.talkFriendship;
    }
  }, { scope: "map", mapId, eventId, label });
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
        : resolveCommandListAtPath(ev.commands, containerPath, { missingBranches: "create" });
    if (!list) return;
    list.push(structuredClone(command));
  }, eventCommandChange(
    mapId,
    eventId,
    `이벤트 커맨드 추가: ${commandKindLabel(command.kind)} (${commandContainerCaption(containerPath)})`
  ));
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
        : resolveCommandListAtPath(ev.commands, container, { missingBranches: "create" });
    if (!list) return;
    list.splice(lastIdx, 0, structuredClone(command));
  }, eventCommandChange(
    mapId,
    eventId,
    `이벤트 커맨드 삽입: ${commandKindLabel(command.kind)} (${commandSlotCaption(path)})`
  ));
}

export function deleteCommand(
  mapId: MapId,
  eventId: string,
  path: number[]
): void {
  // 지운 뒤에는 무엇이 사라졌는지 알 수 없다 — 라벨용으로 먼저 읽는다.
  const removed = rootCommandKindCaption(mapId, eventId, path);
  store.update((p) => {
    const ev = p.maps[mapId]?.events.find((e) => e.id === eventId);
    if (!ev) return;
    const lastIdx = path[path.length - 1];
    const container = path.slice(0, -1);
    const list =
      container.length === 0
        ? ev.commands
        : resolveCommandListAtPath(ev.commands, container, { missingBranches: "create" });
    if (!list) return;
    list.splice(lastIdx, 1);
  }, eventCommandChange(
    mapId,
    eventId,
    `이벤트 커맨드 삭제: ${removed ?? "알 수 없음"} (${commandSlotCaption(path)})`
  ));
}

export function replaceCommand(
  mapId: MapId,
  eventId: string,
  path: number[],
  command: Command
): void {
  const before = rootCommandKindCaption(mapId, eventId, path);
  store.update((p) => {
    const ev = p.maps[mapId]?.events.find((e) => e.id === eventId);
    if (!ev) return;
    const lastIdx = path[path.length - 1];
    const container = path.slice(0, -1);
    const list =
      container.length === 0
        ? ev.commands
        : resolveCommandListAtPath(ev.commands, container, { missingBranches: "create" });
    if (!list) return;
    list[lastIdx] = structuredClone(command);
  }, eventCommandChange(
    mapId,
    eventId,
    `이벤트 커맨드 교체: ${before === null ? "" : `${before} → `}${commandKindLabel(command.kind)} (${commandSlotCaption(path)})`
  ));
}

// 특정 경로의 명령 조회(편집기 폼 채우기용).
export function getCommand(
  event: GameEvent,
  path: number[]
): Command | null {
  return resolveCommandAtPath(event.commands, path);
}

// 빈 조건(사용 안 함) 헬퍼.
export function noCondition(): Condition | undefined {
  return undefined;
}

// ── 편집 행위 라벨 ────────────────────────────────────────────────
//
// 2026-08-29 관측성 감사 실측: 이 파일은 `{ scope:"map", mapId }` 만 넘겨서 감사 로그에
// "어느 맵이 바뀌었다" 까지만 남았다 — 이벤트 추가/삭제/이동/속성 변경이 서로 구분되지
// 않았고 어떤 이벤트인지도 없었다. 라벨과 eventId 를 실어 그 둘을 채운다.
// 관측만 붙인다 — 되돌리기 스냅샷은 호출자(`DragOperationHandler` 등)가 이미 소유한다.
//
// 커맨드 자리 표기는 `eventPages.ts` 것을 그대로 쓴다. 이 파일이 만지는 건 페이지가
// 생기기 전의 레거시 루트 `event.commands` 트리라서, 라벨 접두를 `이벤트 커맨드` 로
// 갈라 페이지 커맨드 로그와 섞이지 않게 한다.

/** 레거시 루트 커맨드 편집의 공통 descriptor. */
function eventCommandChange(mapId: MapId, eventId: string, label: string): ProjectChangeDescriptor {
  return { scope: "map", mapId, eventId, label };
}

/**
 * 라벨에 박을 이벤트 이름. 규칙은 `eventMarkerUx.eventDisplayName`(마지막 이름 있는
 * 페이지)과 같지만 그 모듈은 패널 계층을 끌고 와 순환이 되므로 여기서 다시 쓴다.
 */
function eventLogName(mapId: MapId, eventId: string): string {
  const event = store.getCurrent().maps[mapId]?.events.find((e) => e.id === eventId);
  if (!event) return eventId;
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const name = pages[index]?.name.trim();
    if (name) return name;
  }
  return event.id;
}

/** 경로에 지금 있는 루트 커맨드의 종류 이름. read 모드라 없는 분기를 만들지 않는다. */
function rootCommandKindCaption(mapId: MapId, eventId: string, path: number[]): string | null {
  const event = store.getCurrent().maps[mapId]?.events.find((e) => e.id === eventId);
  if (!event) return null;
  const command = resolveCommandAtPath(event.commands, path);
  return command ? commandKindLabel(command.kind) : null;
}

/** patch 키 → 사람이 읽는 이름. 라벨이 영어 필드명으로 새는 걸 막는다. */
const EVENT_FIELD_LABELS: Readonly<Record<string, string>> = {
  sprite: "그림",
  trigger: "실행 방법",
  condition: "출현 조건",
  schedule: "생활 일정",
  characterId: "인물 연결 키",
  giftPrefs: "선물 취향",
  giftResponses: "선물 반응",
  talkFriendship: "대화 호감도",
};

/** 라벨이 화면을 넘기지 않게 3개까지만 적고 나머지는 개수로 접는다. */
function eventPatchCaption(patch: object): string {
  const keys = Object.keys(patch);
  if (keys.length === 0) return "변경 없음";
  const named = keys.map((key) => EVENT_FIELD_LABELS[key] ?? key);
  if (named.length <= 3) return named.join(", ");
  return `${named.slice(0, 3).join(", ")} 외 ${named.length - 3}개`;
}
