import type { Command, Condition, EventPage, GameEvent, GameMap, MapNamedLocation, Project } from "@/project/types";
import { assertEventShape, upsertEventIntoMap } from "./eventTools";
import { ensureNamedSwitch } from "./flagHelpers";
import { FIXED_MOVEMENT, particles, se, shake } from "./puzzleKit";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

// 제한 시간 탈출(2026-10-25, 폴른 스타 2막 과제 10 — 갈라지는 호수 얼음·무너지는 탑) — 일반 도구.
// 엔진 타이머(timer 명령)가 화면 카운트다운을 띄우고, 남은 시간 조건 페이지가 바닥 칸을 차례로 무너뜨린다
// (changeTile 로 그림을 바꾸고, 그 칸의 투명 이벤트가 「주인공과 같은 층」 페이지로 바뀌어 길을 막는다, 화면 흔들림).
// 출구 칸을 밟으면 성공, 시간이 다 되거나 무너지는 칸 위에 서 있으면 칸을 되돌리고 체크포인트로 보낸다.

type Layer = "lower" | "upper" | "lower2" | "upper2";
type LayerKey = "lowerTiles" | "upperTiles" | "lowerOverlayTiles" | "upperOverlayTiles";
const LAYER_KEY: Readonly<Record<Layer, LayerKey>> = { lower: "lowerTiles", upper: "upperTiles", lower2: "lowerOverlayTiles", upper2: "upperOverlayTiles" };
type Rect = { x: number; y: number; w: number; h: number };
type Cell = { x: number; y: number };
const MAX_CELLS = 400;

const RECT_SCHEMA = {
  type: "object",
  properties: {
    x: { type: "integer", description: "왼쪽 위 칸 x" },
    y: { type: "integer", description: "왼쪽 위 칸 y" },
    width: { type: "integer", description: "폭(칸). 기본 1" },
    height: { type: "integer", description: "높이(칸). 기본 1" },
  },
  required: ["x", "y"],
  additionalProperties: false,
} as const;

function int(v: unknown, lo: number, hi: number, d: number): number {
  return v !== undefined && v !== null && Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d;
}

function readRect(map: GameMap, raw: unknown, label: string): Rect {
  const r = (raw ?? {}) as Record<string, unknown>;
  const x = Number(r.x), y = Number(r.y);
  const w = int(r.width, 1, map.width, 1), h = int(r.height, 1, map.height, 1);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + w > map.width || y + h > map.height) {
    throw new ToolError(`${label} (${String(r.x)},${String(r.y)}) ${w}×${h} 가 맵 ${map.id}(${map.width}×${map.height}) 밖입니다.`, { code: "escape-bounds" });
  }
  return { x, y, w, h };
}

function cellsOf(rect: Rect): Cell[] {
  const out: Cell[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) for (let x = rect.x; x < rect.x + rect.w; x += 1) out.push({ x, y });
  return out;
}

/** 칸 목록을 가로 줄 토막(높이 1 직사각형)으로 — 「무너지는 칸 위에 서 있나」 로케이션용. */
function rowRuns(cells: readonly Cell[]): Rect[] {
  const sorted = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
  const runs: Rect[] = [];
  for (const c of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.y === c.y && last.x + last.w === c.x) last.w += 1;
    else runs.push({ x: c.x, y: c.y, w: 1, h: 1 });
  }
  return runs;
}

/** area 를 from 쪽부터 bands 개 띠로 나눈다(앞 띠가 먼저 무너진다). */
function bandsOf(area: Rect, from: string, bands: number): Rect[] {
  const vertical = from === "south" || from === "north";
  const span = vertical ? area.h : area.w;
  const n = Math.max(1, Math.min(bands, span));
  const out: Rect[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = Math.floor((span * i) / n), b = Math.floor((span * (i + 1)) / n);
    const len = b - a;
    if (len <= 0) continue;
    if (from === "south") out.push({ x: area.x, y: area.y + area.h - b, w: area.w, h: len });
    else if (from === "north") out.push({ x: area.x, y: area.y + a, w: area.w, h: len });
    else if (from === "east") out.push({ x: area.x + area.w - b, y: area.y, w: len, h: area.h });
    else out.push({ x: area.x + a, y: area.y, w: len, h: area.h });
  }
  return out;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

const page = (
  id: string,
  name: string,
  conditions: Condition[],
  trigger: "action" | "playerTouch" | "auto" | "parallel",
  priority: EventPage["priority"],
  commands: Command[],
): EventPage => ({
  id, name, conditions,
  graphic: { transparent: true } as EventPage["graphic"],
  trigger: { kind: trigger } as EventPage["trigger"],
  priority, overlapForbidden: false, animationType: "fixedGraphic", movement: FIXED_MOVEMENT,
  commands,
});

const swOn = (switchId: string): Condition => ({ kind: "switch", switchId, value: true });
const swOff = (switchId: string): Condition => ({ kind: "switch", switchId, value: false });
const setSw = (switchId: string, value: boolean): Command => ({ kind: "setSwitch", switchId, value });

const makeTimedEscape: ToolDefinition = {
  name: "make_timed_escape",
  mode: "write",
  domains: ["event", "map"],
  description:
    "제한 시간 탈출(무너지는 얼음·붕괴하는 탑·가라앉는 다리)을 한 번에 짓는다. 시작 칸(start)을 밟거나 startSwitchId 가 켜지면 엔진 타이머가 seconds 초 카운트다운을 화면에 띄우고, " +
    "바닥 칸이 시간에 따라 차례로 무너진다 — 칸 그림이 collapsedTile 로 바뀌고(기본: 그 층을 비움) 그 칸이 막히며 화면이 흔들린다. 출구 칸(exit)을 밟으면 성공(타이머 끔, successSwitchId 켬), " +
    "시간이 다 되거나 무너지는 칸 위에 서 있으면 무너진 칸을 되돌리고 checkpoint 로 보낸다(다시 시작은 시작 칸을 다시 밟기). " +
    "무너지는 순서는 area + from(south|north|east|west: 그쪽부터) + bands(띠 수)로 주거나, steps([{x,y,width,height,atSecond}])로 칸 묶음과 시작 후 몇 초에 무너질지를 직접 준다. " +
    "start·exit·checkpoint 칸은 무너지지 않는다. 대사·페이드 타이머로 흉내내지 말고 이 도구를 쓴다. 같은 escapeId 로 다시 부르면 그 탈출을 새로 짓는다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "탈출이 벌어지는 맵" },
      escapeId: { type: "string", description: "이 탈출의 짧은 영문 id(이벤트·스위치 이름에 쓴다). 기본 escape" },
      seconds: { type: "integer", description: "제한 시간(초, 10~600). 기본 60" },
      timerId: { type: "string", enum: ["timer1", "timer2"], description: "쓸 엔진 타이머. 기본 timer1" },
      start: { ...RECT_SCHEMA, description: "밟으면 탈출이 시작되는 칸 묶음(x,y,width,height). startSwitchId 와 둘 중 하나는 필요" },
      startSwitchId: { type: "string", description: "이 스위치가 켜지면 시작(컷신 끝에서 켜기). 실패하면 꺼진다" },
      startCellsSwitchId: { type: "string", description: "시작 칸(start)이 이 스위치가 켜졌을 때만 작동한다 — 컷신 끝(startSwitchId)으로 처음 시작하고, 실패한 뒤 다시 하기는 시작 칸으로 할 때(컷신 전 그 칸을 밟아도 시작되지 않게)" },
      exit: { ...RECT_SCHEMA, description: "닿으면 성공하는 출구 칸 묶음" },
      checkpoint: {
        type: "object",
        properties: {
          mapId: { type: "string", description: "되돌아갈 맵. 기본 같은 맵" },
          x: { type: "integer" },
          y: { type: "integer" },
          direction: { type: "string", enum: ["up", "down", "left", "right"], description: "되돌아가서 보는 방향. 기본 up" },
        },
        required: ["x", "y"],
        additionalProperties: false,
        description: "시간이 다 됐을 때 되돌아갈 지점(사당·입구 등)",
      },
      area: { ...RECT_SCHEMA, description: "무너질 바닥 영역. from·bands 와 함께 쓴다" },
      from: { type: "string", enum: ["south", "north", "east", "west"], description: "area 에서 먼저 무너지는 쪽(보통 출발 쪽). 기본 south" },
      bands: { type: "integer", description: "area 를 나눌 띠 수(1~20). 기본 5. 시간에 고르게 나눠 무너진다" },
      steps: {
        type: "array",
        description: "직접 정하는 붕괴 순서. 각 묶음은 시작 후 atSecond 초에 무너진다(area 대신)",
        items: {
          type: "object",
          properties: {
            x: { type: "integer" },
            y: { type: "integer" },
            width: { type: "integer", description: "기본 1" },
            height: { type: "integer", description: "기본 1" },
            atSecond: { type: "integer", description: "시작 후 몇 초에 무너지나(1 ~ seconds-1)" },
          },
          required: ["x", "y", "atSecond"],
          additionalProperties: false,
        },
      },
      layer: { type: "string", enum: ["lower", "lower2", "upper", "upper2"], description: "무너질 때 바꿀 층. 기본 lower(바닥)" },
      collapsedTile: { type: "integer", description: "무너진 칸 그림(그 층 칩셋 칸 번호, 예: 물·구렁). 기본 -1(비움 = 어두운 구멍)" },
      fallOnCollapse: { type: "boolean", description: "무너지는 순간 그 칸에 서 있으면 실패로 친다. 기본 true" },
      startText: { type: "string", description: "시작할 때 한 줄. 기본 「발밑이 갈라지기 시작했다! 서둘러!」. 빈 문자열이면 없음" },
      successText: { type: "string", description: "출구에 닿았을 때 한 줄. 빈 문자열이면 없음" },
      failText: { type: "string", description: "시간이 다 됐을 때 한 줄. 기본 「…늦었다. 처음부터 다시.」" },
      fallText: { type: "string", description: "무너지는 칸에 있었을 때 한 줄. 기본 「발밑이 무너졌다!」" },
      successSwitchId: { type: "string", description: "성공하면 켤 스위치(다음 장면이 이어 받음)" },
    },
    required: ["mapId", "exit", "checkpoint"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    mapId: "map_frozen_lake", seconds: 60, start: { x: 10, y: 28, width: 4, height: 1 }, exit: { x: 8, y: 2, width: 8, height: 1 },
    checkpoint: { mapId: "map_shrine", x: 6, y: 9 }, area: { x: 4, y: 3, width: 16, height: 24 }, from: "south", bands: 6,
  },
  run(draft: Project, args): ToolExecResult {
    const map = draft.maps[String(args.mapId)];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${String(args.mapId)}`, { code: "escape-map" });
    const escapeId = (str(args.escapeId) ?? "escape").replace(/[^A-Za-z0-9_]/g, "_");
    const seconds = int(args.seconds, 10, 600, 60);
    const timerId = args.timerId === "timer2" ? "timer2" : "timer1";
    const layer: Layer = (["lower", "lower2", "upper", "upper2"] as const).find((l) => l === args.layer) ?? "lower";
    const collapsedTile = Number.isInteger(args.collapsedTile) ? Number(args.collapsedTile) : -1;
    const fallOnCollapse = args.fallOnCollapse !== false;
    const startSwitchId = str(args.startSwitchId);
    const startRect = args.start ? readRect(map, args.start, "시작 칸") : undefined;
    const startCellsSwitchId = str(args.startCellsSwitchId);
    if (!startRect && !startSwitchId) throw new ToolError("start(밟으면 시작하는 칸) 또는 startSwitchId 가 필요합니다.", { code: "escape-start" });
    const exitRect = readRect(map, args.exit, "출구 칸");
    const cp = (args.checkpoint ?? {}) as Record<string, unknown>;
    const cpMapId = str(cp.mapId) ?? map.id;
    const cpMap = draft.maps[cpMapId];
    if (!cpMap) throw new ToolError(`체크포인트 맵을 찾을 수 없습니다: ${cpMapId}`, { code: "escape-checkpoint-map" });
    const cpRect = readRect(cpMap, { x: cp.x, y: cp.y }, "체크포인트");
    const cpDir = ["up", "down", "left", "right"].includes(String(cp.direction)) ? String(cp.direction) : "up";

    // 무너지는 묶음 — 시작 후 atSecond 초.
    type Step = { atSecond: number; cells: Cell[] };
    let rawSteps: { rect: Rect; atSecond: number }[];
    if (Array.isArray(args.steps) && args.steps.length > 0) {
      rawSteps = (args.steps as Record<string, unknown>[]).map((s, i) => ({
        rect: readRect(map, s, `steps[${i}]`),
        atSecond: int(s.atSecond, 1, seconds - 1, Math.max(1, Math.round((seconds * (i + 1)) / ((args.steps as unknown[]).length + 1)))),
      }));
    } else if (args.area) {
      const area = readRect(map, args.area, "무너질 영역");
      const from = ["south", "north", "east", "west"].includes(String(args.from)) ? String(args.from) : "south";
      const bands = bandsOf(area, from, int(args.bands, 1, 20, 5));
      rawSteps = bands.map((rect, i) => ({ rect, atSecond: Math.max(1, Math.round((seconds * (i + 1)) / (bands.length + 1))) }));
    } else {
      throw new ToolError("무너질 칸이 없습니다 — area(+from·bands) 또는 steps 를 주세요.", { code: "escape-no-collapse" });
    }
    const keep = new Set<string>([...cellsOf(exitRect), ...(startRect ? cellsOf(startRect) : []), ...(cpMap === map ? [cpRect] : [])].map((c) => `${c.x},${c.y}`));
    // 다른 이벤트(사람·상자·연출)가 선 칸은 무너뜨리지 않는다 — 붕괴 칸 이벤트가 겹치면 그 칸의 조사를 가로챈다(얼음 위 인물에게 말이 안 걸렸다, 2026-10-26).
    for (const e of map.events ?? []) if (!String(e.id).startsWith(`ev_escape_${map.id}_${escapeId}`)) keep.add(`${e.x},${e.y}`);
    const taken = new Set<string>();
    const steps: Step[] = rawSteps
      .map(({ rect, atSecond }) => ({
        atSecond,
        cells: cellsOf(rect).filter((c) => {
          const key = `${c.x},${c.y}`;
          if (keep.has(key) || taken.has(key)) return false;
          taken.add(key);
          return true;
        }),
      }))
      .filter((s) => s.cells.length > 0)
      .sort((a, b) => a.atSecond - b.atSecond);
    if (steps.length === 0) throw new ToolError("무너질 칸이 시작·출구·체크포인트 칸을 빼면 하나도 남지 않습니다.", { code: "escape-empty" });
    const totalCells = steps.reduce((n, s) => n + s.cells.length, 0);
    if (totalCells > MAX_CELLS) throw new ToolError(`무너질 칸이 ${totalCells}칸으로 너무 많습니다(최대 ${MAX_CELLS}). 영역을 줄이거나 길 칸만 steps 로 주세요.`, { code: "escape-too-many" });

    // 이전 판 지우기(같은 escapeId 재호출).
    const base = `ev_escape_${map.id}_${escapeId}`;
    const locBase = `loc_escape_${escapeId}`;
    map.events = map.events.filter((e) => !e.id.startsWith(`${base}_`));
    if (map.locations) map.locations = map.locations.filter((l) => !l.id.startsWith(`${locBase}_`));

    const swBase = `sw_escape_${map.id}_${escapeId}`;
    const swActive = `${swBase}_active`;
    const swDone = `${swBase}_done`;
    const swFell = `${swBase}_fell`;
    ensureNamedSwitch(draft, swActive, `탈출 ${escapeId} 진행 중`);
    ensureNamedSwitch(draft, swDone, `탈출 ${escapeId} 성공`);
    ensureNamedSwitch(draft, swFell, `탈출 ${escapeId} 무너진 칸에 빠짐`);
    const stepSw = steps.map((_, i) => {
      const id = `${swBase}_c${i}`;
      ensureNamedSwitch(draft, id, `탈출 ${escapeId} 붕괴 ${i + 1}`);
      return id;
    });
    const successSwitchId = str(args.successSwitchId);
    if (successSwitchId) ensureNamedSwitch(draft, successSwitchId, successSwitchId);
    if (startSwitchId) ensureNamedSwitch(draft, startSwitchId, startSwitchId);
    if (startCellsSwitchId) ensureNamedSwitch(draft, startCellsSwitchId, startCellsSwitchId);

    const tiles = (map as unknown as Record<LayerKey, number[] | undefined>);
    const tileAt = (l: Layer, c: Cell): number => tiles[LAYER_KEY[l]]?.[c.y * map.width + c.x] ?? -1;
    const changeTile = (l: Layer, c: Cell, tile: number): Command => ({ kind: "changeTile", mapId: map.id, layer: l, x: c.x, y: c.y, tile });
    const clearOverlay = layer !== "lower2";
    const collapseTiles = (cells: readonly Cell[]): Command[] => cells.flatMap((c) => [
      changeTile(layer, c, collapsedTile),
      ...(clearOverlay && tileAt("lower2", c) >= 0 ? [changeTile("lower2", c, -1)] : []),
    ]);
    const restoreTiles = (cells: readonly Cell[]): Command[] => cells.flatMap((c) => [
      changeTile(layer, c, tileAt(layer, c)),
      ...(clearOverlay && tileAt("lower2", c) >= 0 ? [changeTile("lower2", c, tileAt("lower2", c))] : []),
    ]);

    const text = (v: unknown, d: string): Command[] => {
      const body = typeof v === "string" ? v.trim() : d;
      return body ? [{ kind: "text", body } as Command] : [];
    };
    const startCmds: Command[] = [
      { kind: "timer", action: "start", seconds, timerId } as Command,
      setSw(swActive, true),
      se("earth2"),
      shake(3, 600),
      ...text(args.startText, "발밑이 갈라지기 시작했다! 서둘러!"),
    ];
    const failCmds: Command[] = [
      setSw(swActive, false),
      { kind: "timer", action: "set", seconds: 0, timerId } as Command,
      ...(startSwitchId ? [setSw(startSwitchId, false)] : []),
      se("fall1"),
      shake(6, 500),
      {
        kind: "fork",
        condition: swOn(swFell),
        then: [...text(args.fallText, "발밑이 무너졌다!"), setSw(swFell, false)],
        else: text(args.failText, "…늦었다. 처음부터 다시."),
      } as Command,
      ...steps.flatMap((s, i) => [setSw(stepSw[i]!, false), ...restoreTiles(s.cells)]),
      { kind: "transfer", mapId: cpMap.id, x: cpRect.x, y: cpRect.y, direction: cpDir, fade: "black" } as Command,
    ];
    // 진행 스위치를 먼저 끈다 — 타이머를 먼저 0 으로 두면 그 사이 「시간 초과」 자동 페이지가 실패로 받는다.
    const successCmds: Command[] = [
      setSw(swActive, false),
      { kind: "timer", action: "set", seconds: 0, timerId } as Command,
      setSw(swDone, true),
      ...(successSwitchId ? [setSw(successSwitchId, true)] : []),
      se("chime2"),
      ...text(args.successText, ""),
    ];

    const made: string[] = [];
    const put = (event: GameEvent): void => {
      assertEventShape(event);
      upsertEventIntoMap(map, event);
      made.push(event.id);
    };
    const idle = (id: string): EventPage => page(`${id}_idle`, "대기", [], "action", "below", []);

    // 진행 이벤트: 시간 초과 → 실패, (startSwitchId) 스위치가 켜지면 시작.
    const ctrlId = `${base}_ctrl`;
    put({
      id: ctrlId, name: "제한 시간 탈출", x: cpMap === map ? cpRect.x : exitRect.x, y: cpMap === map ? cpRect.y : exitRect.y,
      trigger: { kind: "action" }, commands: [],
      pages: [
        idle(ctrlId),
        ...(startSwitchId ? [page(`${ctrlId}_start`, "시작", [swOn(startSwitchId), swOff(swActive), swOff(swDone)], "auto", "below", startCmds)] : []),
        page(`${ctrlId}_timeout`, "시간 초과", [swOn(swActive), { kind: "timer", timerId, seconds: 0, op: "<=" }], "auto", "below", failCmds),
      ],
    } as GameEvent);

    if (startRect) {
      for (const c of cellsOf(startRect)) {
        const id = `${base}_start_${c.x}_${c.y}`;
        put({ id, name: "탈출 시작", x: c.x, y: c.y, trigger: { kind: "playerTouch" }, commands: [], pages: [
          idle(id),
          page(`${id}_go`, "시작", [swOff(swActive), swOff(swDone), ...(startCellsSwitchId ? [swOn(startCellsSwitchId)] : [])], "playerTouch", "below", JSON.parse(JSON.stringify(startCmds)) as Command[]),
        ] } as GameEvent);
      }
    }
    for (const c of cellsOf(exitRect)) {
      const id = `${base}_exit_${c.x}_${c.y}`;
      put({ id, name: "탈출 출구", x: c.x, y: c.y, trigger: { kind: "playerTouch" }, commands: [], pages: [
        idle(id),
        page(`${id}_ok`, "성공", [swOn(swActive)], "playerTouch", "below", JSON.parse(JSON.stringify(successCmds)) as Command[]),
      ] } as GameEvent);
    }

    // 붕괴 칸: 묶음의 첫 칸(대표)이 남은 시간 조건으로 묶음 전체를 무너뜨리고, 모든 칸은 무너진 뒤 길을 막는다.
    const locations: MapNamedLocation[] = [];
    steps.forEach((step, i) => {
      const remainingAt = seconds - step.atSecond;
      const runs = fallOnCollapse ? rowRuns(step.cells) : [];
      const locIds = runs.map((r, j) => {
        const id = `${locBase}_c${i}_${j}`;
        locations.push({ id, name: `탈출 ${escapeId} 붕괴 ${i + 1}-${j + 1}`, x: r.x, y: r.y, w: r.w, h: r.h, tags: ["timed-escape"] });
        return id;
      });
      const fall: Command[] = locIds.length
        ? [{
            kind: "fork",
            condition: { kind: "any", conditions: locIds.map((locationId) => ({ kind: "insideLocation", locationId, inside: true })) },
            then: [setSw(swFell, true), { kind: "timer", action: "set", seconds: 0, timerId } as Command],
            else: [],
          } as Command]
        : [];
      const mid = step.cells[Math.floor(step.cells.length / 2)]!;
      const collapse: Command[] = [
        particles("dust", 900, mid),
        se("collapse1"),
        shake(i === steps.length - 1 ? 6 : 3, 450),
        ...collapseTiles(step.cells),
        ...fall,
        setSw(stepSw[i]!, true),
      ];
      step.cells.forEach((c, k) => {
        const id = `${base}_c${i}_${c.x}_${c.y}`;
        const pages: EventPage[] = [idle(id)];
        if (k === 0) {
          pages.push(page(`${id}_collapse`, "무너짐", [
            swOn(swActive), swOff(stepSw[i]!),
            { kind: "timer", timerId, seconds: remainingAt, op: "<=" },
            { kind: "timer", timerId, seconds: 0, op: ">" },
          ], "parallel", "below", collapse));
        }
        pages.push(page(`${id}_gone`, "무너진 칸", [swOn(stepSw[i]!)], "action", "same", []));
        put({ id, name: `붕괴 ${i + 1}`, x: c.x, y: c.y, trigger: { kind: "action" }, commands: [], pages } as GameEvent);
      });
    });
    if (locations.length) map.locations = [...(map.locations ?? []), ...locations];

    return {
      summary:
        `${map.id} 제한 시간 탈출 「${escapeId}」 — ${timerId} ${seconds}초 카운트다운, ${steps.length}묶음 ${totalCells}칸이 ` +
        `${steps.map((s) => `${s.atSecond}s`).join("·")} 에 무너짐, 출구 (${exitRect.x},${exitRect.y}) ${exitRect.w}×${exitRect.h}, ` +
        `시간 초과 → ${cpMap.id} (${cpRect.x},${cpRect.y}).` + (startRect ? ` 시작 칸 (${startRect.x},${startRect.y}) ${startRect.w}×${startRect.h}.` : "") +
        (startSwitchId ? ` 시작 스위치 ${startSwitchId}.` : ""),
      data: {
        mapId: map.id, escapeId, timerId, seconds,
        activeSwitchId: swActive, doneSwitchId: swDone, ...(successSwitchId ? { successSwitchId } : {}),
        controllerEventId: ctrlId, events: made.length,
        steps: steps.map((s, i) => ({ atSecond: s.atSecond, cells: s.cells.length, switchId: stepSw[i] })),
        checkpoint: { mapId: cpMap.id, x: cpRect.x, y: cpRect.y },
      },
    };
  },
};

export const TIMED_ESCAPE_TOOLS: readonly ToolDefinition[] = [makeTimedEscape];
