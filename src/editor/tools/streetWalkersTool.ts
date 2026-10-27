// 거리 행인 — add_street_walkers. 출근길·퇴근길 거리에 오가는 사람(회사원·학생·점원…)을 한 번에 놓는다.
// 사람마다 반복 경로(custom route, repeat)를 지형 BFS 로 짜서 «걷기 → 멈춰 서기 → 다른 데로» 를 되풀이한다.
//   - 지나가는 사람(pass): 보도 한쪽 끝 → 다른 끝(가로질러 건너기 포함) → 되돌아오기.
//   - 기다리는 사람(wait): 정류장·입구 앞에 와서 한참 서 있다가 다른 곳으로.
//   - 드나드는 사람(enter): 문·지하철 계단 앞까지 걸어가 사라졌다가(투명) 잠시 뒤 다시 나와 다른 곳으로.
// 걷는 사람은 지나가는 차를 세우고(playSceneTransit), 차 몸 칸으로는 들어서지 않는다(canNpcMove).
// 길은 보도·횡단보도만 탄다 — 차도(칸 이름표 laneCells)는 횡단보도 칸이 아니면 걷지도 서지도 않는다.
//   차도도 통행 가능 칸이라 지형 BFS 만 쓰면 행인이 차선 한가운데로 질러가 섰다(2026-10-26 첫사랑 op5, #3535 과 같은 규칙).
// 그림은 프로젝트의 사람 칩(list_npc_graphics 결과·selectionId) 중에서 고른다 — 사람을 새로 생성하지 않는다.
import { crosswalkCells, laneCells } from "@/ai/v2/placementRules";
import { isPassable } from "@/project/collision";
import type { Dir, EventPage, GameEvent, GameMap, MoveCommand, Project } from "@/project/types";
import { charsetGraphic, resolveGraphic } from "./eventCompile";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { readonly x: number; readonly y: number };
export type WalkerStop = { readonly x: number; readonly y: number; readonly waitSec?: number; readonly vanish?: boolean; readonly face?: Dir };

/** 이 도구가 만든 행인 이벤트 id 머리(replace 가 이것만 지운다). */
export const WALKER_ID_PREFIX = "ev_walker_";

const DIRS: readonly [Dir, number, number][] = [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]];

/** 칸 a 에서 b 까지 걸음(4방향 BFS, 지형 통행 — 목표 칸 자체는 막혀 있어도 된다). 길이 없으면 null. */
export function walkPath(project: Project, map: GameMap, a: Cell, b: Cell, blocked?: (c: Cell) => boolean): Dir[] | null {
  const W = map.width, H = map.height;
  if (a.x === b.x && a.y === b.y) return [];
  const prev = new Int32Array(W * H).fill(-1), how = new Int8Array(W * H).fill(-1);
  const start = a.y * W + a.x, goal = b.y * W + b.x;
  prev[start] = start;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const k = q[h]!; if (k === goal) break;
    const x = k % W, y = Math.floor(k / W);
    for (let d = 0; d < 4; d++) {
      const [, dx, dy] = DIRS[d]!; const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx; if (prev[nk] !== -1) continue;
      // 목표 칸은 막힌 칸이어도 된다(문·계단 그림 칸에 닿아 사라지는 vanish) — 걸을 칸 검사는 호출자가 한다.
      if (nk !== goal && (!isPassable(project, map, nx, ny) || blocked?.({ x: nx, y: ny }))) continue;
      prev[nk] = k; how[nk] = d; q.push(nk);
    }
  }
  if (prev[goal] === -1) return null;
  const out: Dir[] = [];
  for (let k = goal; k !== start; k = prev[k]!) out.push(DIRS[how[k]!]![0]);
  return out.reverse();
}

/**
 * 행인이 걸으면 안 되는 차도 칸(횡단보도 칸은 뺀다). 이름표에 차도가 없는 맵(판타지 마을·광장)은 빈 집합 — 지형 통행만 본다.
 */
export function carLaneCells(project: Project, map: GameMap): Set<number> {
  const lanes = laneCells(project, map);
  if (!lanes.size) return lanes;
  const cross = crosswalkCells(project, map);
  for (const i of cross) lanes.delete(i);
  return lanes;
}

/** 머무는 시간(초) → wait 명령 수. wait 한 번 = 빈도 간격(moveIntervalMs). */
function waits(sec: number, intervalMs: number): MoveCommand[] {
  const n = Math.max(0, Math.round((sec * 1000) / Math.max(80, intervalMs)));
  return Array.from({ length: n }, () => ({ kind: "wait" }) as MoveCommand);
}

/**
 * 들른 곳을 차례로 도는 반복 경로. 마지막 들른 곳에서 첫 들른 곳으로 돌아와 이어진다(repeat).
 * vanish 인 곳(문·계단)은 그 칸까지 걸어가 사라지고(투명·통과), 머문 뒤 다시 나타나 이어 걷는다.
 */
export function walkerRoute(project: Project, map: GameMap, stops: readonly WalkerStop[], intervalMs: number, lanes: ReadonlySet<number> = carLaneCells(project, map)): MoveCommand[] | null {
  if (stops.length < 2) return null;
  const moves: MoveCommand[] = [];
  const onLane = (c: Cell): boolean => lanes.has(c.y * map.width + c.x);
  for (let i = 0; i < stops.length; i++) {
    const from = stops[i]!, to = stops[(i + 1) % stops.length]!;
    const path = walkPath(project, map, from, to, onLane);
    if (!path) return null;
    // 사라지는 곳(문·계단 그림 칸)은 막힌 칸이다 — 마지막 한 걸음 전에 통과를 켜야 들어선다.
    const last = to.vanish ? path.length - 1 : path.length;
    for (let k = 0; k < path.length; k++) {
      if (k === last) moves.push({ kind: "setThrough", enabled: true });
      moves.push({ kind: "move", dir: path[k]! });
    }
    if (to.vanish) {
      if (last < 0) moves.push({ kind: "setThrough", enabled: true });
      moves.push({ kind: "changeOpacity", delta: -255 }, ...waits(to.waitSec ?? 6, intervalMs), { kind: "changeOpacity", delta: 255 }, { kind: "setThrough", enabled: false });
    } else {
      if (to.face) moves.push({ kind: "turn", dir: to.face });
      moves.push(...waits(to.waitSec ?? 0, intervalMs));
    }
  }
  return moves;
}

function uniqueEventId(project: Project, base: string): string {
  const used = new Set(Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => e.id)));
  let id = base, n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  return id;
}

const STOP_SCHEMA = {
  type: "object",
  properties: {
    x: { type: "integer", minimum: 0 }, y: { type: "integer", minimum: 0 },
    waitSec: { type: "number", minimum: 0, maximum: 120, description: "그 자리에서 머무는 초(정류장에서 버스 기다리기 20~40, 지나가는 길 0)" },
    vanish: { type: "boolean", description: "그 칸(문·지하철 계단)에 닿으면 사라졌다가 waitSec 뒤 다시 나온다 — 들어갔다 나오는 사람" },
    face: { type: "string", enum: ["up", "down", "left", "right"], description: "머무는 동안 바라볼 쪽(정류장이면 차도 쪽)" },
  },
  required: ["x", "y"],
  additionalProperties: false,
} as const;

export const ADD_STREET_WALKERS_TOOL: ToolDefinition = {
  name: "add_street_walkers",
  mode: "write",
  domains: ["event", "map"],
  fillsCurrentMapId: true,
  description: "거리·광장·역 앞에 오가는 행인(출근길 회사원·학생·쇼핑객)을 한 번에 놓는다. 사람마다 들를 곳(stops) 두 곳 이상을 주면 "
    + "보도·횡단보도만 따라 길을 찾아 그 사이를 반복해 걷는다(횡단보도 건너기·정류장에서 기다리기·지하철 계단·가게 문으로 들어갔다 나오기). "
    + "차도 칸(칸 이름표가 아스팔트·차선·교차로인 칸)은 횡단보도가 아니면 지나지도 서지도 않는다 — 들를 곳은 보도·횡단보도 칸으로 준다. "
    + "speed(1~6, 3 보통·2 느긋·4 바쁜 걸음)를 사람마다 다르게 주면 거리가 살아 보인다. 걷는 사람 앞에서는 지나가는 차가 선다. "
    + "graphic 은 place_npc 와 같다({selectionId} 또는 {query:\"회사원\"}). 대사(lines)를 주면 말을 걸 수 있다. 같은 이름 행인을 다시 부르면 replace:true 로 바꾼다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵(생략하면 지금 보는 맵)" },
      walkers: {
        type: "array",
        minItems: 1,
        maxItems: 24,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "행인 이름(예: 「출근하는 회사원」)" },
            graphic: { type: "object", description: "place_npc 의 graphic — {selectionId:\"charset:<시트>:<칸>\"} 또는 {query:\"회사원\"}", additionalProperties: true },
            stops: { type: "array", minItems: 2, maxItems: 8, items: STOP_SCHEMA, description: "차례로 들를 칸(첫 칸이 시작 자리). 마지막 다음은 다시 첫 칸" },
            speed: { type: "integer", minimum: 1, maximum: 6, description: "걷는 빠르기(기본 3)" },
            lines: { type: "array", items: { type: "string" }, description: "말을 걸면 하는 말(생략하면 말 없음)" },
          },
          required: ["name", "graphic", "stops"],
          additionalProperties: false,
        },
      },
      replace: { type: "boolean", description: "이 맵의 같은 이름 행인을 지우고 다시 놓는다" },
    },
    required: ["walkers"],
    additionalProperties: false,
  },
  invalidArgsExample: { walkers: [{ name: "출근하는 회사원", graphic: { query: "회사원" }, stops: [{ x: 2, y: 20 }, { x: 30, y: 20, waitSec: 2 }], speed: 4 }] },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const list = Array.isArray(args.walkers) ? args.walkers as Record<string, unknown>[] : [];
    if (!list.length) throw new ToolError("walkers 가 비었다 — 행인 하나 이상", { code: "invalid-args", mapId });
    const placed: string[] = [], made: GameEvent[] = [];
    const names = new Set(list.map((w) => String(w.name ?? "").trim()));
    if (args.replace === true) map.events = (map.events ?? []).filter((e) => !e.id.startsWith(WALKER_ID_PREFIX) || !names.has(e.name ?? ""));
    const occupied = new Set((map.events ?? []).map((e) => `${e.x},${e.y}`));
    const lanes = carLaneCells(draft, map);
    for (const [i, w] of list.entries()) {
      const name = String(w.name ?? "").trim() || `행인 ${i + 1}`;
      const stops = (Array.isArray(w.stops) ? w.stops : []) as WalkerStop[];
      for (const s of stops) {
        if (!(s.x >= 0 && s.y >= 0 && s.x < map.width && s.y < map.height)) throw new ToolError(`${name}: 칸 (${s.x},${s.y}) 이 맵 밖이다`, { code: "invalid-args", mapId });
        if (!s.vanish && !isPassable(draft, map, s.x, s.y)) throw new ToolError(`${name}: 칸 (${s.x},${s.y}) 은 걸을 수 없는 칸이다 — 보도·횡단보도 칸을 준다(문·계단 칸은 vanish:true)`, { code: "invalid-args", mapId });
        if (lanes.has(s.y * map.width + s.x)) throw new ToolError(`${name}: 칸 (${s.x},${s.y}) 은 차도다 — 행인은 보도·횡단보도 칸에만 선다(가까운 보도 칸으로 옮긴다)`, { code: "invalid-args", mapId });
      }
      if (stops[0]?.vanish) throw new ToolError(`${name}: 첫 칸(시작 자리)은 vanish 가 아닌 걸을 칸이어야 한다`, { code: "invalid-args", mapId });
      const speed = Math.max(1, Math.min(6, Math.round(Number(w.speed ?? 3))));
      const frequency = 3, intervalMs = Math.max(80, 1040 - frequency * 160);
      const moves = walkerRoute(draft, map, stops, intervalMs, lanes);
      if (!moves) throw new ToolError(`${name}: 들를 곳 사이에 보도·횡단보도로 걸어갈 길이 없다 — 칸을 보도로 옮기거나 횡단보도가 있는 쪽으로 잇는다`, { code: "invalid-args", mapId });
      const graphic = resolveGraphic(w.graphic as never);
      if (!("sprite" in graphic) || !graphic.sprite) throw new ToolError(`${name}: 사람 그림이 필요하다(graphic)`, { code: "graphic-not-found", mapId });
      const start = stops[0]!;
      if (occupied.has(`${start.x},${start.y}`)) throw new ToolError(`${name}: 시작 칸 (${start.x},${start.y}) 에 이미 이벤트가 있다`, { code: "invalid-args", mapId });
      occupied.add(`${start.x},${start.y}`);
      const lines = Array.isArray(w.lines) ? (w.lines as unknown[]).filter((l): l is string => typeof l === "string" && l.trim() !== "") : [];
      const id = uniqueEventId(draft, `${WALKER_ID_PREFIX}${mapId}_${i + 1}`);
      const page: EventPage = {
        id: `${id}_p`, name, conditions: [], graphic: { ...graphic, direction: walkPath(draft, map, start, stops[1]!, (c) => lanes.has(c.y * map.width + c.x))?.[0] ?? "down" },
        trigger: { kind: "action" }, priority: "same", animationType: "normal",
        movement: { type: "custom", speed, frequency, route: { moves, repeat: true, skippable: false } },
        commands: lines.length ? [{ kind: "text", speaker: name, body: lines.join("\n") }] : [],
      };
      const ev: GameEvent = { id, x: start.x, y: start.y, name, placementRole: "npc", trigger: { kind: "action" }, commands: [], pages: [page] };
      made.push(ev);
      const steps = moves.filter((m) => m.kind === "move").length;
      placed.push(`${name}(${start.x},${start.y}) 들를 곳 ${stops.length}·걸음 ${steps}·빠르기 ${speed}`);
    }
    map.events = [...(map.events ?? []), ...made];
    return {
      summary: `행인 ${made.length}명을 ${map.name}(${mapId})에 놓았다 — ${placed.join(" · ")}. 반복 경로라 늘 오간다. 대사가 없는 행인은 말을 걸어도 반응이 없다.`,
      data: { mapId, events: made.map((e) => ({ id: e.id, name: e.name, x: e.x, y: e.y })) },
    };
  },
};

/** 시험·플래그십 빌드용 — 그림 칩(텍스처·칸)으로 바로 만든다. */
export function streetWalkerGraphic(textureKey: string, index: number) { return charsetGraphic(textureKey, index); }
