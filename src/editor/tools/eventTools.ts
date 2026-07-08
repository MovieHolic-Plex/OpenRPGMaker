// editor/tools/eventTools.ts
// 이벤트 쓰기 툴: upsert_event / place_npc / create_transfer_pair / place_battle_blocker
//              / duplicate_event / remove_event / move_event.

import { isPassable } from "@/project/collision";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { countLimitedRuntimeSupportCommandsForEvent } from "@/project/lint/projectLint";
import { genId } from "@/util/id";
import type { Command, EventPage, GameEvent, GameMap, Project, TransferFade } from "@/project/types";
import {
  charsetGraphic,
  compileSimplePages,
  resolveGraphic,
  type GraphicSpec,
} from "./eventCompile";
import { ensureNamedSwitch } from "./flagHelpers";
import { inMapBounds, requireMap, type Point } from "./mapHelpers";
import { ToolError, type SimplePage, type ToolDefinition, type ToolExecResult } from "./types";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };
const WANDER: EventPage["movement"] = { type: "random", speed: 2, frequency: 3 };

function knownIds(records: readonly { readonly id: string }[], limit = 8): string {
  return records.slice(0, limit).map((record) => record.id).join(", ") || "(없음)";
}

// 맵의 이벤트를 id로 upsert(있으면 교체, 없으면 push).
export function upsertEventIntoMap(map: GameMap, event: GameEvent): "added" | "modified" {
  const index = map.events.findIndex((entry) => entry.id === event.id);
  if (index >= 0) {
    map.events[index] = event;
    return "modified";
  }
  map.events.push(event);
  return "added";
}

// 페이지 커맨드 shape를 사전 검증(기존 io 검증기 위임).
function assertEventShape(event: GameEvent): void {
  try {
    validateCommandArray(`${event.id}.commands`, event.commands);
    for (const page of event.pages ?? []) {
      validateCommandArray(`${event.id}.${page.id}.commands`, page.commands);
    }
  } catch (cause) {
    throw new ToolError(`이벤트 형식이 올바르지 않습니다: ${cause instanceof Error ? cause.message : String(cause)}`, {
      code: "event-shape",
    });
  }
}

// (x,y) 주변(또는 자신)에서 통행 가능한 첫 칸을 착지 좌표로 고른다.
function passableLanding(project: Project, map: GameMap, x: number, y: number): Point | null {
  const candidates: Point[] = [
    { x, y: y + 1 },
    { x, y: y - 1 },
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y },
  ];
  for (const cell of candidates) {
    if (inMapBounds(map, cell.x, cell.y) && isPassable(project, map, cell.x, cell.y)) return cell;
  }
  return null;
}

const upsertEvent: ToolDefinition = {
  name: "upsert_event",
  description: "저수준 만능 이벤트 툴. 기존 GameEvent 구조 그대로 받아 shape 검증 후 맵에 upsert한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      event: { type: "object", description: "GameEvent(id/x/y/trigger/commands/pages...)" },
    },
    required: ["mapId", "event"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const event = args.event as GameEvent;
    if (!event || typeof event.id !== "string") throw new ToolError("event.id(문자열)가 필요합니다.");
    if (typeof event.x !== "number" || typeof event.y !== "number") throw new ToolError("event.x/y(숫자)가 필요합니다.");
    if (!event.trigger) (event as GameEvent).trigger = { kind: "action" };
    if (!Array.isArray(event.commands)) (event as GameEvent).commands = [];
    assertEventShape(event);
    const outcome = upsertEventIntoMap(map, event);
    const unsupportedCommands = countLimitedRuntimeSupportCommandsForEvent(event);
    return {
      summary: `${map.name}에 이벤트 '${event.id}' ${outcome === "added" ? "추가" : "수정"} — 미지원 커맨드 ${unsupportedCommands}건`,
      data: { eventId: event.id, unsupportedCommands },
    };
  },
};

const placeNpc: ToolDefinition = {
  name: "place_npc",
  description: "NPC 이벤트를 배치한다. graphic은 {query} 또는 {textureKey,characterIndex}. query는 기존 별칭(villager|people|npc|human|사람|주민|actor|hero|animal|monster)과 자유 질의를 허용한다: 예 '할머니', 'old woman', '노인 남성'. pages는 SimplePage로 EventPage로 컴파일된다. page.conditions 단수 객체/null, page.commands 단수 객체, command→kind alias는 warning과 함께 정규화한다. 통행 불가 칸이면 실패.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      name: { type: "string" },
      graphic: { type: "object", description: "{query} | {textureKey,characterIndex}" },
      movement: { type: "string", enum: ["fixed", "random"] },
      pages: { type: "array", description: "SimplePage[]", items: { type: "object" } },
      id: { type: "string" },
    },
    required: ["mapId", "x", "y", "name", "pages"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const requestedX = args.x as number;
    const requestedY = args.y as number;
    const name = args.name as string;
    if (!inMapBounds(map, requestedX, requestedY)) {
      throw new ToolError(`NPC 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, { code: "npc-out-of-bounds", mapId: map.id, x: requestedX, y: requestedY });
    }
    // 에이전틱 편의: 통행 불가 칸을 지정하면 실패 대신 근처(반경 3) 통행 가능 칸으로 자동 착지.
    const landing = nearestPassableCell(draft, map, requestedX, requestedY, 3);
    if (!landing) {
      throw new ToolError(
        `NPC를 놓을 통행 가능 칸이 없습니다: (${requestedX}, ${requestedY}) 주변 반경 3칸까지 전부 통행 불가입니다. get_map_region으로 지형을 확인하세요.`,
        { code: "npc-impassable", mapId: map.id, x: requestedX, y: requestedY }
      );
    }
    const { x, y } = landing;
    const graphic = resolveGraphic(args.graphic as GraphicSpec | undefined);
    const id = (args.id as string | undefined) ?? genId("ev_npc");
    const movement = (args.movement as string | undefined) === "random" ? WANDER : PASSIVE;
    const normalizationWarnings: string[] = [];
    const pages = compileSimplePages(id, name, args.pages as SimplePage[], graphic, { movement, warnings: normalizationWarnings });
    const event: GameEvent = { id, x, y, trigger: { kind: "action" }, commands: [], pages };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    const adjusted = x !== requestedX || y !== requestedY;
    const warnings = [
      ...(adjusted ? [`NPC '${name}' 위치 자동 조정: (${requestedX}, ${requestedY}) → (${x}, ${y})`] : []),
      ...normalizationWarnings,
    ];
    const normalizationSummary = normalizationWarnings.length > 0 ? ` — SimplePage 정규화 경고 ${normalizationWarnings.length}건` : "";
    return {
      summary: `${map.name}에 NPC '${name}' 배치 (${x}, ${y})${adjusted ? ` — 요청 좌표 (${requestedX}, ${requestedY})가 통행 불가라 자동 조정` : ""}${normalizationSummary}`,
      data: { eventId: id, x, y, adjusted },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

// (x,y)에서 가까운 순(링 확장)으로 통행 가능 + 이벤트 없는 칸을 찾는다.
function nearestPassableCell(project: Project, map: GameMap, x: number, y: number, maxRadius: number): Point | null {
  const occupied = new Set(map.events.map((event) => `${event.x},${event.y}`));
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const cx = x + dx;
        const cy = y + dy;
        if (!inMapBounds(map, cx, cy)) continue;
        if (occupied.has(`${cx},${cy}`)) continue;
        if (isPassable(project, map, cx, cy)) return { x: cx, y: cy };
      }
    }
  }
  return null;
}

const createTransferPair: ToolDefinition = {
  name: "create_transfer_pair",
  description: "두 맵 사이 양방향 출입구를 원자적으로 생성한다. 착지점은 상대 출입구에 인접한 통행 가능 칸으로 자동 선정(즉시 재전이 방지).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      a: { type: "object", description: "{mapId,x,y} 출입구 A" },
      b: { type: "object", description: "{mapId,x,y} 출입구 B" },
      fade: { type: "string", enum: ["black", "white", "none"] },
    },
    required: ["a", "b"],
  },
  run(draft, args): ToolExecResult {
    const a = args.a as { mapId: string; x: number; y: number };
    const b = args.b as { mapId: string; x: number; y: number };
    const fade = (args.fade as TransferFade | undefined) ?? "black";
    const mapA = requireMap(draft, a.mapId);
    const mapB = requireMap(draft, b.mapId);
    const landingB = passableLanding(draft, mapB, b.x, b.y);
    const landingA = passableLanding(draft, mapA, a.x, a.y);
    if (!landingB || !landingA) throw new ToolError("출입구 인접에 통행 가능한 착지 칸이 없습니다.", { code: "transfer-no-landing" });
    // 즉시 재전이 방지: 착지 칸이 상대 출입구 좌표와 겹치면 error.
    if (landingB.x === b.x && landingB.y === b.y) throw new ToolError("A→B 착지가 B 출입구와 겹칩니다.", { code: "transfer-retrigger" });
    if (landingA.x === a.x && landingA.y === a.y) throw new ToolError("B→A 착지가 A 출입구와 겹칩니다.", { code: "transfer-retrigger" });

    const idA = genId("ev_gate");
    const idB = genId("ev_gate");
    const transferTo = (mapId: string, x: number, y: number): Command => ({ kind: "transfer", mapId, x, y, fade });
    const gate = (id: string, x: number, y: number, target: Command): GameEvent => ({
      id,
      x,
      y,
      trigger: { kind: "playerTouch" },
      commands: [],
      pages: [
        {
          id: `${id}_page`,
          name: "출입구",
          conditions: [],
          graphic: { transparent: true },
          trigger: { kind: "playerTouch" },
          priority: "below",
          overlapForbidden: false,
          movement: PASSIVE,
          commands: [target],
        },
      ],
    });
    upsertEventIntoMap(mapA, gate(idA, a.x, a.y, transferTo(b.mapId, landingB.x, landingB.y)));
    upsertEventIntoMap(mapB, gate(idB, b.x, b.y, transferTo(a.mapId, landingA.x, landingA.y)));
    return {
      summary: `출입구 쌍 생성: ${mapA.name}(${a.x},${a.y}) ↔ ${mapB.name}(${b.x},${b.y})`,
      data: { eventIdA: idA, eventIdB: idB, landingA, landingB },
    };
  },
};

const placeBattleBlocker: ToolDefinition = {
  name: "place_battle_blocker",
  description: "전투 블로커를 배치한다(전투 페이지 + 승리 후 투명 페이지). clearSwitchId로 재전투를 막는다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      troopId: { type: "string" },
      clearSwitchId: { type: "string", description: "생략 시 자동 생성" },
      intro: { type: "array", description: "전투 전 대사", items: { type: "string" } },
      victory: { type: "array", description: "승리 후 대사", items: { type: "string" } },
      victoryItems: { type: "array", description: "[{itemId,amount}] 승리 보상", items: { type: "object" } },
      graphic: { type: "object", description: "{query} | {textureKey,characterIndex}" },
      id: { type: "string" },
    },
    required: ["mapId", "x", "y", "troopId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const x = args.x as number;
    const y = args.y as number;
    const troopId = args.troopId as string;
    if (!inMapBounds(map, x, y)) throw new ToolError(`블로커 위치가 맵 밖입니다: (${x}, ${y})`, { mapId: map.id, x, y });
    if (!draft.database.troops.some((troop) => troop.id === troopId)) {
      throw new ToolError(`존재하지 않는 troopId: ${troopId} — 허용 예시: ${knownIds(draft.database.troops)}`, { code: "troop-not-found", mapId: map.id, x, y });
    }
    const id = (args.id as string | undefined) ?? genId("ev_battle");
    const clearSwitchId = (args.clearSwitchId as string | undefined) ?? `sw_${id}_clear`;
    ensureNamedSwitch(draft, clearSwitchId, `전투 완료: ${id}`);
    const intro = (args.intro as string[] | undefined) ?? ["적이 앞을 가로막았다!"];
    const victory = (args.victory as string[] | undefined) ?? ["길이 열렸다."];
    const victoryItems = (args.victoryItems as Array<{ itemId: string; amount: number }> | undefined) ?? [];
    const graphic = resolveGraphic(args.graphic as GraphicSpec | undefined);

    const fightCommands: Command[] = [
      ...intro.map((body): Command => ({ kind: "text", body })),
      { kind: "battleProcessing", troopId, canEscape: true, canLose: false },
      { kind: "setSwitch", switchId: clearSwitchId, value: true },
      ...victoryItems.map((entry): Command => ({ kind: "changeItem", itemId: entry.itemId, op: "+=", amount: entry.amount })),
      ...victory.map((body): Command => ({ kind: "text", body })),
    ];
    const event: GameEvent = {
      id,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_fight`,
          name: "전투",
          conditions: [],
          graphic,
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: PASSIVE,
          commands: fightCommands,
        },
        {
          id: `${id}_cleared`,
          name: "정리된 자리",
          conditions: [{ kind: "switch", switchId: clearSwitchId, value: true }],
          graphic: { transparent: true },
          trigger: { kind: "action" },
          priority: "below",
          overlapForbidden: false,
          movement: PASSIVE,
          commands: [],
        },
      ],
    };
    assertEventShape(event);
    upsertEventIntoMap(map, event);
    return { summary: `${map.name}에 전투 블로커 '${troopId}' 배치 (${x}, ${y})`, data: { eventId: id, clearSwitchId } };
  },
};

const duplicateEvent: ToolDefinition = {
  name: "duplicate_event",
  description: "이벤트를 다른 맵/좌표로 복제한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      fromMapId: { type: "string" },
      eventId: { type: "string" },
      toMapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      newId: { type: "string" },
    },
    required: ["fromMapId", "eventId", "toMapId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const fromMap = requireMap(draft, args.fromMapId as string);
    const toMap = requireMap(draft, args.toMapId as string);
    const source = fromMap.events.find((event) => event.id === args.eventId);
    if (!source) throw new ToolError(`복제할 이벤트를 찾을 수 없습니다: ${args.eventId}`, { code: "event-not-found" });
    const newId = (args.newId as string | undefined) ?? genId("ev_copy");
    const clone: GameEvent = { ...structuredClone(source), id: newId, x: args.x as number, y: args.y as number };
    upsertEventIntoMap(toMap, clone);
    return { summary: `이벤트 '${args.eventId}' → '${newId}' (${toMap.name})`, data: { eventId: newId } };
  },
};

const removeEvent: ToolDefinition = {
  name: "remove_event",
  description: "맵에서 이벤트를 제거한다(파괴적).",
  mode: "write",
  parameters: {
    type: "object",
    properties: { mapId: { type: "string" }, eventId: { type: "string" } },
    required: ["mapId", "eventId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const index = map.events.findIndex((event) => event.id === args.eventId);
    if (index < 0) throw new ToolError(`제거할 이벤트를 찾을 수 없습니다: ${args.eventId}`, { code: "event-not-found" });
    map.events.splice(index, 1);
    return { summary: `${map.name}에서 이벤트 '${args.eventId}' 제거`, warnings: [`파괴적 작업: 이벤트 '${args.eventId}'를 삭제했습니다.`] };
  },
};

const moveEvent: ToolDefinition = {
  name: "move_event",
  description: "이벤트를 같은 맵 내 다른 좌표로 옮긴다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { mapId: { type: "string" }, eventId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } },
    required: ["mapId", "eventId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const event = map.events.find((entry) => entry.id === args.eventId);
    if (!event) throw new ToolError(`옮길 이벤트를 찾을 수 없습니다: ${args.eventId}`, { code: "event-not-found" });
    const x = args.x as number;
    const y = args.y as number;
    if (!inMapBounds(map, x, y)) throw new ToolError(`이동 위치가 맵 밖입니다: (${x}, ${y})`, { mapId: map.id, x, y });
    event.x = x;
    event.y = y;
    return { summary: `이벤트 '${args.eventId}' → (${x}, ${y})` };
  },
};

export { charsetGraphic };
// 스위치 등록 헬퍼는 중립 모듈(flagHelpers)로 이전. 호환을 위해 재수출.
export { ensureNamedSwitch };
export const EVENT_TOOLS: readonly ToolDefinition[] = [
  upsertEvent,
  placeNpc,
  createTransferPair,
  placeBattleBlocker,
  duplicateEvent,
  removeEvent,
  moveEvent,
];
