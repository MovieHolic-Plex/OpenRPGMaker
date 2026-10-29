// 필드 추격 AI 헤드리스 시뮬레이션 — 실제 런타임 갱신기(updateAutonomousNPCs)를 60Hz 로 돌리고
// 주인공을 정해진 정책(도망·기둥 돌기·멈춤)으로 움직여, 잡기까지 걸린 시간·막힘·되돌기·경로 효율을 잰다.
// 실행: node_modules/.bin/vite-node scripts/qa/chase-sim/sim.mts -- [--json out.json] [--trace dir]
// Phaser·브라우저 없이 돈다(스프라이트 없음 → 말풍선·그림 갱신은 건너뛴다).
import { writeFileSync, mkdirSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { initialRuntimeEventPositions, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { canMove } from "@/project/collision";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { EventPageMovement, GameEvent, GameMap, Project } from "@/project/types";

type P = { x: number; y: number };
type PlayerPolicy = "flee" | "loop" | "still" | "breakSight";
type Scenario = {
  name: string;
  label: string;
  rows: string[]; // '#' 벽, '.' 바닥, 'P' 주인공, 'C' 추격자, 'L' 기둥 돌기 경로(시계 방향 순서는 loop 로 준다)
  movement: EventPageMovement;
  policy: PlayerPolicy;
  loop?: P[];
  timeoutMs: number;
};

const FRAME = 1000 / 60;
const PLAYER_STEP = 160;

function legacyMovement(pace: "slow" | "normal" | "fast", extra: Partial<EventPageMovement> = {}): EventPageMovement {
  const table = { slow: { speed: 3, frequency: 4 }, normal: { speed: 4, frequency: 5 }, fast: { speed: 5, frequency: 6 } }[pace];
  return {
    type: "chase", ...table, sightRange: 8, giveUpRange: 14, pathfind: true,
    sight: { range: 8, lineOfSight: true, facing: "any" },
    pursuit: { scope: "map", doorDelayMs: 0, searchMs: 2500, onLost: "return" },
    sightAlert: { emote: "exclamation", holdMs: 700 },
    ...extra,
  } as EventPageMovement;
}

const SCENARIOS: Scenario[] = [
  {
    name: "open-flee", label: "열린 들판, 주인공 도망(보통 추격 1마리)", policy: "flee", timeoutMs: 30000,
    movement: legacyMovement("normal", { sight: { range: 12, lineOfSight: true, facing: "any" }, sightRange: 12, giveUpRange: 24 }),
    rows: [
      "########################",
      "#......................#",
      "#..##.......#.......##.#",
      "#..##.......#.......##.#",
      "#.......C......P.......#",
      "#......................#",
      "#....###.........###...#",
      "#......................#",
      "#..........##..........#",
      "#......................#",
      "########################",
    ],
  },
  {
    name: "open-flee-fast", label: "열린 들판, 주인공 도망(빠른 추격 1마리 — 주인공보다 빠름)", policy: "flee", timeoutMs: 30000,
    movement: legacyMovement("fast", { sight: { range: 12, lineOfSight: true, facing: "any" }, sightRange: 12, giveUpRange: 24 }),
    rows: [
      "########################",
      "#......................#",
      "#..##.......#.......##.#",
      "#..##.......#.......##.#",
      "#.......C......P.......#",
      "#......................#",
      "#....###.........###...#",
      "#......................#",
      "#..........##..........#",
      "#......................#",
      "########################",
    ],
  },
  {
    name: "detour", label: "ㄷ자 벽 돌아오기(멈춘 주인공, 보통 추격)", policy: "still", timeoutMs: 30000,
    movement: legacyMovement("normal", { sight: { range: 14, lineOfSight: false, facing: "any" }, sightRange: 14 }),
    rows: [
      "####################",
      "#..................#",
      "#..........#.......#",
      "#..C.......#...P...#",
      "#..........#.......#",
      "#....#######.......#",
      "#..................#",
      "####################",
    ],
  },
  {
    name: "pillar-loop", label: "기둥 돌며 도망(같은 빠르기 160ms/칸 명시)", policy: "loop", timeoutMs: 30000,
    movement: legacyMovement("fast", { chaseStepMs: 160, speed: 7, moveIntervalMs: 80, sight: { range: 12, lineOfSight: false, facing: "any" }, sightRange: 12, sightAlert: { emote: "exclamation", holdMs: 300 } }),
    rows: [
      "############",
      "#..........#",
      "#..........#",
      "#...####...#",
      "#...####...#",
      "#...####..C#",
      "#...####...#",
      "#..........#",
      "#.....P....#",
      "############",
    ],
    loop: [
      ...range(6, 2).map((x) => ({ x, y: 8 })), // 아래 줄 왼쪽으로
      ...range(7, 2).map((y) => ({ x: 2, y })),
      ...range(3, 9).map((x) => ({ x, y: 2 })),
      ...range(3, 8).map((y) => ({ x: 9, y })),
      ...range(8, 7).map((x) => ({ x, y: 8 })),
    ],
  },
  {
    name: "two-flank", label: "두 마리 협공, 주인공보다 느림(170ms/칸 명시)", policy: "flee", timeoutMs: 30000,
    movement: legacyMovement("fast", { chaseStepMs: 170, speed: 7, moveIntervalMs: 90, sight: { range: 20, lineOfSight: false, facing: "any" }, sightRange: 20, giveUpRange: 30, sightAlert: { emote: "exclamation", holdMs: 300 } }),
    rows: [
      "######################",
      "#....................#",
      "#..C.................#",
      "#.......##.....##....#",
      "#.......##.....##....#",
      "#..........P.........#",
      "#.......##.....##....#",
      "#.......##.....##....#",
      "#.................C..#",
      "#....................#",
      "######################",
    ],
  },
  {
    name: "break-sight", label: "벽 뒤로 끊고 계속 달아남(보통 추격, 놓친 뒤 수색)", policy: "breakSight", timeoutMs: 20000,
    movement: legacyMovement("normal", { sight: { range: 8, lineOfSight: true, facing: "any" }, pursuit: { scope: "map", doorDelayMs: 0, searchMs: 4000, onLost: "return" } as EventPageMovement["pursuit"] }),
    rows: [
      "##########################",
      "#........................#",
      "#........................#",
      "#..C....P......#.........#",
      "#..............#.........#",
      "#..............#.........#",
      "#..............###########",
      "#........................#",
      "##########################",
    ],
  },
];

function range(from: number, to: number): number[] {
  const out: number[] = [];
  if (from <= to) for (let i = from; i <= to; i += 1) out.push(i);
  else for (let i = from; i >= to; i -= 1) out.push(i);
  return out;
}

function buildProject(s: Scenario): { project: Project; map: GameMap; player: P; chasers: string[] } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const h = s.rows.length, w = s.rows[0]!.length;
  map.width = w; map.height = h;
  map.lowerTiles = Array<number>(w * h).fill(0);
  map.upperTiles = Array<number>(w * h).fill(-1);
  map.events = []; map.safeZones = [];
  const tileset = project.tilesets[map.tilesetId]!;
  tileset.passability[0] = { up: true, down: true, left: true, right: true };
  tileset.passability[1] = { up: false, down: false, left: false, right: false };
  let player: P = { x: 1, y: 1 };
  const chasers: string[] = [];
  s.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "#") map.lowerTiles[y * w + x] = 1;
    if (ch === "P") player = { x, y };
    if (ch === "C") {
      const id = `chaser${chasers.length}`;
      chasers.push(id);
      const event: GameEvent = { id, x, y, trigger: { kind: "eventTouch" }, commands: [], pages: [{
        id: `${id}_p`, name: id, conditions: [], graphic: {}, trigger: { kind: "eventTouch" }, priority: "same", overlapForbidden: true,
        movement: structuredClone(s.movement), commands: [],
      }] } as unknown as GameEvent;
      map.events.push(event);
    }
  }));
  return { project, map, player, chasers };
}

function bfsDist(project: Project, map: GameMap, from: P, blocked: Set<string> = new Set()): Map<string, number> {
  const dist = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  let frontier = [from];
  while (frontier.length) {
    const next: P[] = [];
    for (const p of frontier) for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
      const n = { x: p.x + dx, y: p.y + dy };
      const k = `${n.x},${n.y}`;
      if (dist.has(k) || blocked.has(k) || !canMove(project, map, p.x, p.y, n.x, n.y)) continue;
      dist.set(k, dist.get(`${p.x},${p.y}`)! + 1);
      next.push(n);
    }
    frontier = next;
  }
  return dist;
}

export type SimResult = {
  name: string; label: string; caughtMs: number | null; timeoutMs: number;
  stalls: number; stallMs: number; reversals: number; cellsWalked: number; optimalCells?: number; pathRatio?: number;
  avgCellMs: number | null; reacquired?: boolean; trace: { t: number; player: P; chasers: (P & { fx: number; fy: number })[] }[];
  rows: string[];
};

export function runScenario(s: Scenario): SimResult {
  const { project, map, player: start, chasers } = buildProject(s);
  (store as unknown as { getCurrent: () => Project }).getCurrent = () => project;
  const session = startSession(project);
  session.currentMapId = map.id; session.x = start.x; session.y = start.y;
  let caught: number | null = null;
  const scene = {
    map, session, eventPositions: initialRuntimeEventPositions(map.events),
    tileX: start.x, tileY: start.y, running: false, moving: false, movingTo: { x: start.x, y: start.y },
    autonomousNPCs: new Map<string, AutonomousMover>(), eventSprites: new Map(),
    runtimeDom: { upsertEventMarker: () => undefined }, runEvent: async () => { if (caught === null) caught = t; },
    pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(),
    registerAutonomousMover: (id: string, moves: never[], repeat: boolean) => registerAutonomousMover(scene as never, id, moves, repeat),
  };
  registerPageMoveRoutes(scene as never);
  const view = (id: string) => runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions).find((v) => v.event.id === id)!;
  const optimal = s.policy === "still" ? (bfsDist(project, map, view(chasers[0]!)).get(`${start.x},${start.y}`) ?? 0) - 1 : undefined;
  let t = 0;
  let playerMoveLeft = 0;
  let loopIndex = 0;
  const history = new Map<string, P[]>(chasers.map((id) => [id, [{ x: view(id).x, y: view(id).y }]]));
  const lastMoveAt = new Map<string, number>(chasers.map((id) => [id, 0]));
  let stalls = 0, stallMs = 0, reversals = 0, cells = 0;
  const stallOpen = new Map<string, boolean>();
  const trace: SimResult["trace"] = [];
  let sawLost = false, reacquired = false;
  const cellTimes: number[] = [];
  while (t < s.timeoutMs && caught === null) {
    // 주인공
    if (scene.moving) {
      playerMoveLeft -= FRAME;
      if (playerMoveLeft <= 0) {
        scene.moving = false;
        scene.tileX = scene.movingTo.x; scene.tileY = scene.movingTo.y;
        session.x = scene.tileX; session.y = scene.tileY;
      }
    }
    if (!scene.moving && s.policy !== "still") {
      const here = { x: scene.tileX, y: scene.tileY };
      let next: P | undefined;
      if (s.policy === "loop" && s.loop) {
        // 경로에서 지금 칸 다음 칸
        const idx = s.loop.findIndex((p) => p.x === here.x && p.y === here.y);
        loopIndex = idx >= 0 ? (idx + 1) % s.loop.length : loopIndex;
        next = s.loop[loopIndex];
      } else if (s.policy === "breakSight") {
        // 오른쪽으로 달려 벽 너머로, 그다음 아래로 꺾어 계속 오른쪽
        next = here.y < 7 && here.x < 14 ? { x: here.x + 1, y: here.y } : here.y < 7 ? { x: here.x, y: here.y + 1 } : here.x < 24 ? { x: here.x + 1, y: here.y } : undefined;
        if (next && !canMove(project, map, here.x, here.y, next.x, next.y)) next = undefined;
      } else {
        // 도망: 가장 가까운 추격자와의 BFS 거리가 가장 커지는 이웃(지금 자리 포함), 동률은 이동 우선
        const occupied = new Set(chasers.map((id) => `${view(id).x},${view(id).y}`));
        const maps = chasers.map((id) => bfsDist(project, map, { x: view(id).x, y: view(id).y }));
        const score = (p: P) => Math.min(...maps.map((m) => m.get(`${p.x},${p.y}`) ?? 99));
        let best: P = here, bestScore = score(here) - 0.5;
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
          const n = { x: here.x + dx, y: here.y + dy };
          if (occupied.has(`${n.x},${n.y}`) || !canMove(project, map, here.x, here.y, n.x, n.y)) continue;
          const sc = score(n);
          if (sc > bestScore) { best = n; bestScore = sc; }
        }
        next = best === here ? undefined : best;
      }
      if (next) {
        const occupied = chasers.some((id) => view(id).x === next!.x && view(id).y === next!.y);
        if (!occupied && canMove(project, map, here.x, here.y, next.x, next.y)) {
          scene.moving = true; scene.movingTo = next; playerMoveLeft = PLAYER_STEP;
        }
      }
    }
    updateAutonomousNPCs(scene as never, FRAME);
    t += FRAME;
    for (const id of chasers) {
      const v = view(id), m = scene.autonomousNPCs.get(id)!;
      const h = history.get(id)!;
      const last = h[h.length - 1]!;
      if (last.x !== v.x || last.y !== v.y) {
        cells += 1;
        cellTimes.push(t - lastMoveAt.get(id)!);
        const prev = h[h.length - 2];
        if (prev && prev.x === v.x && prev.y === v.y) reversals += 1;
        h.push({ x: v.x, y: v.y });
        lastMoveAt.set(id, t);
        stallOpen.set(id, false);
      } else if (m.chaseActive && !m.activeMove && t - lastMoveAt.get(id)! > 600) {
        if (!stallOpen.get(id)) { stalls += 1; stallOpen.set(id, true); }
        stallMs += FRAME;
      }
      if (s.policy === "breakSight") {
        const st = session.horror?.pursuits[id];
        if (st && st.searchMs > 0) sawLost = true;
        if (sawLost && st && st.searchMs === 0 && st.active) reacquired = true;
      }
    }
    if (Math.round(t / FRAME) % 2 === 0) {
      const pf = scene.moving ? 1 - Math.max(0, playerMoveLeft) / PLAYER_STEP : 0;
      trace.push({ t, player: { x: scene.tileX + (scene.movingTo.x - scene.tileX) * (scene.moving ? pf : 0), y: scene.tileY + (scene.movingTo.y - scene.tileY) * (scene.moving ? pf : 0) },
        chasers: chasers.map((id) => {
          const m = scene.autonomousNPCs.get(id)!; const v = view(id);
          const a = m.activeMove;
          const dur = a ? (a.durationMs ?? m.moveDurationMs) : 1;
          const k = a ? a.elapsedMs / dur : 1;
          return { x: v.x, y: v.y, fx: a ? a.fromX + (a.toX - a.fromX) * k : v.x, fy: a ? a.fromY + (a.toY - a.fromY) * k : v.y };
        }) });
    }
  }
  // 첫 칸(놀람 멈춤 포함)은 박자 평균에서 뺀다
  const steady = cellTimes.slice(chasers.length);
  return {
    name: s.name, label: s.label, caughtMs: caught, timeoutMs: s.timeoutMs, stalls, stallMs: Math.round(stallMs), reversals, cellsWalked: cells,
    ...(optimal !== undefined ? { optimalCells: optimal, pathRatio: Number((cells / Math.max(1, optimal)).toFixed(2)) } : {}),
    avgCellMs: steady.length ? Math.round(steady.reduce((a, b) => a + b, 0) / steady.length) : null,
    ...(s.policy === "breakSight" ? { reacquired } : {}),
    trace, rows: s.rows,
  };
}

const args = process.argv.slice(2);
const jsonAt = args.indexOf("--json");
const traceAt = args.indexOf("--trace");
const results = SCENARIOS.map(runScenario);
for (const r of results) {
  const { trace: _t, rows: _r, ...rest } = r;
  console.log(JSON.stringify(rest));
}
if (jsonAt >= 0) writeFileSync(args[jsonAt + 1]!, JSON.stringify(results.map(({ trace: _t, ...r }) => r), null, 1));
if (traceAt >= 0) {
  mkdirSync(args[traceAt + 1]!, { recursive: true });
  for (const r of results) writeFileSync(`${args[traceAt + 1]}/${r.name}.json`, JSON.stringify(r));
}
