// editor/tools/mapDoorTools.ts
// 문 종류·크기 적기 — set_map_door, 그리고 이동 문을 놓는 도구들(link_jp_city_interior·create_transfer_pair·link_maps)이 부르는 자동 기록.
//
// 문 그림은 칩셋 타일이라 프레임이 없다. 문이 「어떻게」 열리는지(유리 자동문은 양옆으로 미끄러지고, 여닫이는 경첩으로 접히고,
// 셔터는 말려 올라간다)와 「얼마나 큰지」(1×1·1×2·2×2 두 짝)를 map.doors 에 적으면 런타임(player/playSceneDoors.ts)이 그 문 그림
// 전체를 그 종류대로 연다. 추론 규칙은 project/mapDoorKinds.ts 한 곳 — 런타임도 정의가 없는 옛 맵에 같은 규칙을 쓴다.
import { DOOR_KINDS, inferMapDoor, recordInferredMapDoor, removeMapDoorsOver, upsertMapDoor, type DoorKind, type InferredMapDoor } from "@/project/mapDoorKinds";
import { doorKindName } from "@/project/eventCommands/doorAnimation";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { readonly x: number; readonly y: number };

function hasTransfer(event: GameEvent): boolean {
  return JSON.stringify(event.pages ?? []).includes('"kind":"transfer"');
}

/**
 * 두 칸 이상 폭의 문에 이동 발판이 한 칸뿐이면, 같은 줄(문 그림 맨 아래 줄 = 부딪힘, 문 앞 줄 = 밟기)의 다른 문 칸에 같은 이동 발판을 복제한다.
 * 왜: 편의점 유리문(2칸)의 오른쪽 짝 앞으로 걸어가면 유리에 막혀 들어가지 못했다(마왕 편의점, 2026-10-30). 복제한 이벤트 id 를 돌려준다.
 */
export function widenDoorTriggers(project: Project, map: GameMap, rect: { x: number; y: number; w: number; h: number }): string[] {
  if (rect.w < 2) return [];
  const bottom = rect.y + rect.h - 1;
  const added: string[] = [];
  const used = new Set(Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => e.id)));
  for (const row of [bottom, bottom + 1]) {
    const source = (map.events ?? []).find((e) => e.y === row && e.x >= rect.x && e.x < rect.x + rect.w && hasTransfer(e));
    if (!source) continue;
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x === source.x || (map.events ?? []).some((e) => e.x === x && e.y === row)) continue;
      const walk = isPassable(project, map, x, row);
      // 문 앞 줄 발판은 걸을 수 있는 칸에만, 문 그림 줄(부딪힘) 발판은 막힌 칸에만 — 원래 발판과 같은 성질의 칸.
      if ((row === bottom + 1) !== walk) continue;
      let id = `${source.id}_${x - source.x > 0 ? "r" : "l"}${Math.abs(x - source.x)}`;
      for (let n = 2; used.has(id); n++) id = `${source.id}_w${n}`;
      used.add(id);
      const clone = structuredClone(source) as GameEvent;
      clone.id = id; clone.x = x;
      for (const page of clone.pages ?? []) page.id = `${id}_${page.id.replace(/^.*?_page/u, "page")}`;
      map.events = [...(map.events ?? []), clone];
      added.push(id);
    }
  }
  return added;
}

/** 이동 문을 놓은 도구가 부른다 — 옛 여닫이 연출로 맞지 않는 문(자동문·미닫이·셔터·두 짝)만 map.doors 에 적고, 넓은 문이면 발판을 넓힌다. */
export function recordDoorForGate(project: Project, map: GameMap, gate: Cell): { door?: InferredMapDoor; widened: string[] } {
  const door = recordInferredMapDoor(project, map, gate);
  if (!door) return { widened: [] };
  return { door, widened: widenDoorTriggers(project, map, door.rect) };
}

/**
 * 문 앞 칸 gate 의 이동 이벤트를 문에 묶는다 — 이벤트는 문 칸에 서고(막힌 칸이면 같은 층 부딪힘), 그 문으로 나오는 도착은 문 앞 칸(gate)에
 * 문을 등지고 선다. 왜: 문 앞 칸을 밟는 순간 옮기면 「문 앞에 서자마자 이동」이다(2026-10-30 사용자). 문 칸 이벤트는 문 앞에서
 * 문 쪽으로 걸어 들어갈 때만 발동하고, 런타임이 문을 열고 문간으로 한 걸음 들어간 뒤 옮긴다(project/doorEntries.ts).
 * 문: doorAt(문 앞 칸과 맞닿은 칸) 또는 gate 바로 위의 문 그림(mapDoorKinds.inferMapDoor — 통로·아치·계단 같은 문짝 없는 출구는 빼고).
 * 문 칸에 이미 다른 이벤트가 있거나 문이 없으면 null(옛 발판 그대로).
 */
export function bindGateToDoor(project: Project, map: GameMap, gate: Cell, doorAt?: Cell, ignoreIds: ReadonlySet<string> = new Set()): { door: Cell; landing: Cell; bump: boolean; direction: "up" | "down" | "left" | "right" } | null {
  const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
  let door: Cell | null = null;
  if (doorAt && inside(doorAt) && Math.abs(doorAt.x - gate.x) + Math.abs(doorAt.y - gate.y) === 1) door = doorAt;
  else if (!doorAt) {
    const inferred = inferMapDoor(project, map, gate);
    const bottom = inferred ? inferred.rect.y + inferred.rect.h - 1 : -1;
    if (inferred && inferred.kind !== "none" && bottom === gate.y - 1 && gate.x >= inferred.rect.x && gate.x < inferred.rect.x + inferred.rect.w) door = { x: gate.x, y: bottom };
  }
  if (!door) return null;
  if ((map.events ?? []).some((e) => e.x === door!.x && e.y === door!.y && !ignoreIds.has(e.id))) return null;
  const dx = gate.x - door.x, dy = gate.y - door.y;
  const direction = dy > 0 ? "down" : dy < 0 ? "up" : dx > 0 ? "right" : "left";
  return { door, landing: gate, bump: !isPassable(project, map, door.x, door.y), direction };
}

export function doorLine(door: InferredMapDoor): string {
  return `${door.kind}(${door.rect.w}×${door.rect.h}, (${door.rect.x},${door.rect.y}))`;
}

const KIND_KO: Record<DoorKind, string> = {
  auto: "유리 자동문(다가가면 양옆으로 미끄러져 열림)", swing: "여닫이 외짝", double: "두 짝 여닫이", slide: "미닫이(손으로)", shutter: "셔터(말려 올라감)", kit: "열림 그림 짝(타일셋 그림으로)", none: "문짝 없는 출구(연출 없음)",
};

export const SET_MAP_DOOR_TOOL: ToolDefinition = {
  name: "set_map_door",
  mode: "write",
  domains: ["map", "event"],
  fillsCurrentMapId: true,
  description: "맵의 문 하나가 어떻게 열리는지(종류)와 크기를 적는다 — 런타임이 그 문 그림 전체(여러 칸)를 그 종류대로 연다. "
    + "kind: auto(편의점·역·맨션 로비 유리 자동문 — 다가가면 양옆으로 미끄러져 열리고 떠나면 닫힘, 들어갈 때 연출이 겹치지 않음) · swing(여닫이 외짝, 1×1·1×2) · "
    + "double(두 짝 여닫이 — 성문·대문·교회 문, 2×1·2×2, 두 짝이 같이 열림) · slide(손으로 여는 미닫이·격자문·장지) · shutter(셔터·롤업, 말려 올라감) · "
    + "none(통로·아치 — 문짝 없음, 연출 끔) · detect(생략과 같다 — 그림 이름표·조립 부품에서 종류와 크기를 추론). "
    + "x,y = 문 그림의 아무 칸이나 문 바로 아래 문 앞 칸(이동 발판 칸). width/height = 문 그림 칸 수(생략하면 그림에서 추론: 일체형 가게 정면 문 2×2, 찍힌 문 키트 크기, 같은 이름표가 이어진 폭, 윗칸이 벽이면 높이 2). "
    + "문짝 사각형(문틀 안쪽)은 런타임이 그림에서 잰다. 넓은 문(2칸 이상)인데 이동 발판이 한 칸뿐이면 같은 줄 다른 문 칸에도 같은 발판을 복제한다(widenTrigger:false 로 끈다). "
    + "chime:true = 주인공이 열 때 편의점 입점 차임(편의점 가게 정면은 기본 켬). openSe/closeSe = 소리 리소스 id. "
    + "link_jp_city_interior·create_transfer_pair·link_maps 는 자동문·미닫이·셔터·두 짝 문을 스스로 적는다 — 결과가 틀렸을 때(예: 일반 문인데 자동문으로 열림) 이 도구로 kind 를 바로잡는다. 열림 그림 짝이 있는 문(던전 문 등)은 적지 않아도 그 그림으로 열린다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "맵 id. 생략하면 지금 보는 맵" },
      x: { type: "integer", minimum: 0, description: "문 그림 칸 또는 문 앞 칸 x" },
      y: { type: "integer", minimum: 0, description: "문 그림 칸 또는 문 앞 칸 y" },
      kind: { type: "string", enum: [...DOOR_KINDS.filter((k) => k !== "kit"), "detect"], description: "문 종류. 생략·detect = 그림에서 추론" },
      width: { type: "integer", minimum: 1, maximum: 4, description: "문 그림 폭(칸). 생략 = 추론" },
      height: { type: "integer", minimum: 1, maximum: 4, description: "문 그림 높이(칸). 생략 = 추론(윗칸이 벽이면 2)" },
      hinge: { type: "string", enum: ["left", "right"], description: "외짝 여닫이 경첩 쪽. 생략 = left" },
      chime: { type: "boolean", description: "자동문: 주인공이 열 때 입점 차임" },
      openSe: { type: "string", description: "여는 소리 리소스 id(생략 = 종류 기본)" },
      closeSe: { type: "string", description: "닫는 소리 리소스 id(자동문)" },
      widenTrigger: { type: "boolean", description: "넓은 문의 이동 발판을 문 폭만큼 넓힌다. 기본 true" },
    },
    required: ["x", "y"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const at = { x: Number(args.x), y: Number(args.y) };
    if (!(at.x >= 0 && at.y >= 0 && at.x < map.width && at.y < map.height)) throw new ToolError(`(${at.x},${at.y}) 는 맵 밖이다`, { code: "invalid-args", mapId });
    const wanted = typeof args.kind === "string" && args.kind !== "detect" ? (args.kind as DoorKind) : undefined;
    const inferred = inferMapDoor(draft, map, at, {
      ...(wanted ? { kind: wanted } : {}),
      ...(Number.isInteger(args.width) ? { width: Number(args.width) } : {}),
      ...(Number.isInteger(args.height) ? { height: Number(args.height) } : {}),
      ...(args.hinge === "left" || args.hinge === "right" ? { hinge: args.hinge } : {}),
      ...(typeof args.chime === "boolean" ? { chime: args.chime } : {}),
      ...(typeof args.openSe === "string" && args.openSe ? { openSe: args.openSe } : {}),
      ...(typeof args.closeSe === "string" && args.closeSe ? { closeSe: args.closeSe } : {}),
    });
    if (!inferred) {
      throw new ToolError(`(${at.x},${at.y}) 와 그 윗칸에 문 그림이 없다 — 문 그림 칸(또는 문 바로 아래 칸)을 주거나 kind 와 width/height 를 함께 준다`, { code: "not-a-door", mapId, x: at.x, y: at.y });
    }
    if (!inferred.def) {
      const removed = removeMapDoorsOver(map, inferred.rect);
      return {
        summary: `${map.name} (${inferred.rect.x},${inferred.rect.y}) ${inferred.rect.w}×${inferred.rect.h} 문: ${KIND_KO[inferred.kind]} — ${inferred.reason}${removed ? ` · 적혀 있던 문 정의 ${removed}개를 지웠다` : ""}`,
        data: { mapId, kind: inferred.kind, rect: inferred.rect, door: null },
      };
    }
    upsertMapDoor(map, inferred.def);
    const widened = args.widenTrigger === false ? [] : widenDoorTriggers(draft, map, inferred.rect);
    const kindName = doorKindName(inferred.def);
    return {
      summary: `${map.name} 문 (${inferred.rect.x},${inferred.rect.y}) ${inferred.rect.w}×${inferred.rect.h} = ${KIND_KO[kindName]} — ${inferred.reason}${inferred.def.chimeSe ? " · 입점 차임" : ""}${widened.length ? ` · 이동 발판을 문 폭만큼 넓혔다(${widened.join(", ")})` : ""}`,
      data: { mapId, kind: kindName, rect: inferred.rect, door: inferred.def, widenedEventIds: widened },
    };
  },
};

export const MAP_DOOR_TOOLS: readonly ToolDefinition[] = [SET_MAP_DOOR_TOOL];
