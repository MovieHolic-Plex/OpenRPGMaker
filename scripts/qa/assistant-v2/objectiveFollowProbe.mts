// 목표 화살표만 따라 걷는 플레이어가 «정말 다음에 해야 할 일»에 닿는가(모델 없음).
//   bun scripts/qa/assistant-v2/objectiveFollowProbe.mts <run-dir>... [--hold 1,4,8] [--spread 24] [--blind] [--impl <폴더>] [--out <json>] [--verbose]
//
// objectiveArrowProbe 와 다른 점(그 자의 눌러 걷기는 스위치를 모두 켠 세션이라 «떠난» 보스 칸을 지나갔다):
//   · 순간 = 자동 플레이(실제 헤드리스 런타임)가 다음 목표를 실행하기 직전의 판 — 그때의 세션(스위치·아이템·셀프 스위치)·맵·자리·떠 있는 목표 글.
//   · 과녁 = 그 순간 불러서 게임이 나아가는 이벤트들: 자동 플레이의 다음 목표(「맵 진입」은 그 뒤 첫 실제 목표로 묶는다) +
//     남은 목표 가운데 그 일을 하는 페이지가 지금 열려 있는 이벤트(순서가 자유로운 일은 어느 쪽을 먼저 해도 된다).
//   · 걷는 사람 = 화살표를 읽고 그 방향키(대각선이면 더 기운 축)를 N칸까지 누른 뒤 다시 읽는다. 화살표가 없고 표시가 화면 안이면 그쪽으로 곧장.
//     바닥에 길(routeTrail)이 그려지는 구현이면 그 점을 따라 걷는다 — 점이 꺾이는 칸에서 멈춘다(N칸보다 짧게). --blind 는 길을 안 보고 화살표만 본다.
//     표시가 붙은 대상 옆에 서면 멈춘다 — 그것이 과녁이면 닿음, 문이면 들어가 다음 맵에서 이어 걷고, 다른 이벤트면 «엉뚱한 대상».
//   · 출발 = 그 순간의 실제 자리(play) + 그 맵의 착지 칸들과 걸어 닿는 칸에서 고르게 뽑은 자리(spread).
// 걷기 규칙 = 타일 통행(canMove) + 막는 이벤트(같은 층·겹침 금지) 칸에는 못 선다. 움직이는 사람은 그 순간 서 있던 칸에 둔다.
// --trace <순간 번호>[:x,y] --trace-out <json>: 그 순간(그 자리)의 걸음 자취와 QA 체크포인트(맵·자리·스위치·아이템·목표)를 적는다 — 실제 플레이어에서 같은 판을 띄워 볼 때.
// --impl <폴더>: 그 폴더의 objectiveTarget.ts · objectiveRoute.ts 를 대신 쓴다(전/후 비교 — 저장소 안 폴더여야 `@/` 가 풀린다).
// 수치는 그림을 보지 않은 것이다. 문서: openwiki/assistant-v2.md 「목표 화살표를 따라 걷는 자」.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import { runtimeEventViewsForMap, type RuntimeEventView } from "../../../src/project/runtimeEventState.ts";
import { runAutoPlay, type AutoPlayMoment } from "../../../src/qa/gameCheck/autoPlay.ts";
import type { GameMap, Project } from "../../../src/project/types.ts";
import type { PlaySession } from "../../../src/project/session.ts";

type Cell = { x: number; y: number };
const STEPS: Cell[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const DIR8 = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
const dir8 = (angle: number): number => (((Math.round(angle / (Math.PI / 4))) % 8) + 8) % 8;
const VIEW = { w: 20, h: 15 }; // 960×720 화면, 칸 48px

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const FLAGS = new Set(["--hold", "--spread", "--impl", "--out", "--trace", "--trace-out"]);
const traceArg = flag("--trace");
const traceOut = flag("--trace-out");
const dirs = argv.filter((a, i) => !a.startsWith("--") && !FLAGS.has(argv[i - 1] ?? ""));
const HOLDS = (flag("--hold") ?? "1,4,8").split(",").map(Number);
const SPREAD = Number(flag("--spread") ?? 24);
const verbose = argv.includes("--verbose");
const implDir = flag("--impl");
const BLIND = argv.includes("--blind");
const outFile = flag("--out");

const implBase = implDir ? path.resolve(implDir) : fileURLToPath(new URL("../../../src/player", import.meta.url));
const targetMod = await import(path.join(implBase, "objectiveTarget.ts"));
const routeMod = await import(path.join(implBase, "objectiveRoute.ts"));
const zone = await import("../../../src/player/zoneFeedback.ts");
/** 바닥 길을 그리는 구현인가(그리고 그 길을 보는 사람으로 재나). */
const SEES_TRAIL = !BLIND && typeof routeMod.routeTrail === "function";

/** 그 순간 떠 있는 목표 글. */
interface Objective { text: string | null }
function objectiveOf(session: PlaySession): Objective {
  return { text: zone.currentObjectiveText((session as { m2Runtime?: { ui?: never } }).m2Runtime?.ui) };
}
function targetViews(project: Project, map: GameMap, views: RuntimeEventView[], objective: Objective): RuntimeEventView[] {
  return targetMod.objectiveTargetViews(project, map, views, objective.text) as RuntimeEventView[];
}

interface Door { mapId: string; x: number; y: number }
function doorOf(view: RuntimeEventView): Door | undefined {
  let found: Door | undefined;
  const walk = (v: unknown): void => {
    if (found || !v || typeof v !== "object") return;
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    const r = v as Record<string, unknown>;
    if (r.kind === "transfer" && typeof r.mapId === "string" && typeof r.x === "number" && typeof r.y === "number") { found = { mapId: r.mapId, x: r.x, y: r.y }; return; }
    for (const x of Object.values(r)) if (x && typeof x === "object") walk(x);
  };
  walk(view.page?.commands);
  return found;
}

/** 지금 열린 페이지가 하는 일(대사만이면 «말만») — 엉뚱한 대상이 막다른 곳인지 본다. */
function pageDoes(view: RuntimeEventView): string {
  const kinds = new Set<string>();
  const walk = (v: unknown): void => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    const r = v as Record<string, unknown>;
    if (typeof r.kind === "string") {
      if (r.kind === "m2Command") { if ((r.fields as { surface?: string } | undefined)?.surface === "objectiveChip") kinds.add("목표"); }
      else if (["setSwitch", "setSelfSwitch", "changeItem", "setVariable", "transfer", "battleProcessing", "triggerEnding", "ending", "changeParty", "changeGold", "shop"].includes(r.kind)) kinds.add(r.kind);
    }
    for (const x of Object.values(r)) if (x && typeof x === "object") walk(x);
  };
  walk(view.page?.commands);
  return kinds.size ? [...kinds].join("+") : "말만";
}

/** 한 순간·한 맵에서 런타임이 그리는 것 그대로: 대상 · 막는 칸 · 길 · 실제 걷기 규칙의 걸음 수. */
interface MapCtx {
  map: GameMap; views: RuntimeEventView[]; targets: RuntimeEventView[]; tiles: Cell[];
  blocked: Set<number>; route: unknown; toTarget: Int32Array;
}
function blockedCells(map: GameMap, views: RuntimeEventView[], except?: ReadonlySet<string>): Set<number> {
  const out = new Set<number>();
  for (const v of views) {
    if (v.priority !== "same" || !v.overlapForbidden || except?.has(v.event.id)) continue;
    for (let y = v.passRect.top; y <= v.passRect.bottom; y += 1) for (let x = v.passRect.left; x <= v.passRect.right; x += 1) out.add(y * map.width + x);
  }
  return out;
}
/** 실제 걷기 규칙으로 잰 goal 까지 걸음 수 — 막는 이벤트 칸에는 못 서고, 대상 칸은 옆에 서면 닿는다. */
function walkField(project: Project, map: GameMap, goals: Cell[], blocked: Set<number>): Int32Array {
  const { width, height } = map;
  const dist = new Int32Array(width * height).fill(-1);
  const queue: number[] = []; const goal = new Set<number>();
  for (const t of goals) { const k = t.y * width + t.x; if (t.x >= 0 && t.y >= 0 && t.x < width && t.y < height && dist[k] !== 0) { dist[k] = 0; goal.add(k); queue.push(k); } }
  for (let h = 0; h < queue.length; h += 1) {
    const c = queue[h]!; const cx = c % width, cy = (c - cx) / width;
    for (const s of STEPS) {
      const nx = cx + s.x, ny = cy + s.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (dist[n]! >= 0 || blocked.has(n)) continue;
      if (goal.has(c)) { if (!isPassable(project, map, nx, ny)) continue; }
      else if (!canMove(project, map, nx, ny, cx, cy)) continue;
      dist[n] = dist[c]! + 1; queue.push(n);
    }
  }
  return dist;
}
/** start 에서 걸어 닿는 칸. */
function reachFrom(project: Project, map: GameMap, starts: Cell[], blocked: Set<number>): Set<number> {
  const seen = new Set<number>(); const queue: number[] = [];
  for (const s of starts) { const k = s.y * map.width + s.x; if (!seen.has(k)) { seen.add(k); queue.push(k); } }
  for (let h = 0; h < queue.length; h += 1) {
    const c = queue[h]!; const cx = c % map.width, cy = (c - cx) / map.width;
    for (const s of STEPS) {
      const nx = cx + s.x, ny = cy + s.y;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const n = ny * map.width + nx;
      if (seen.has(n) || blocked.has(n) || !canMove(project, map, cx, cy, nx, ny)) continue;
      seen.add(n); queue.push(n);
    }
  }
  return seen;
}
function viewRect(map: GameMap, here: Cell): { x: number; y: number; right: number; bottom: number } {
  const cx = here.x + 0.5, cy = here.y + 0.5;
  const x0 = map.width <= VIEW.w ? (map.width - VIEW.w) / 2 : Math.min(map.width - VIEW.w, Math.max(0, cx - VIEW.w / 2));
  const y0 = map.height <= VIEW.h ? (map.height - VIEW.h) / 2 : Math.min(map.height - VIEW.h, Math.max(0, cy - VIEW.h / 2));
  return { x: x0, y: y0, right: x0 + VIEW.w, bottom: y0 + VIEW.h };
}

type FailClass =
  | "목표 줄 없음" | "표시 없음" | "엉뚱한 대상" | "엉뚱한 대상(과녁이 8칸 안)" | "맵을 맴돎" | "제자리를 맴돎" | "막혀 섬" | "대상에 걸어 닿지 못함" | "과녁이 이 판에 없음" | "과녁에 걸어 닿는 길이 없음";
interface Hop { mapId: string; cells: Cell[]; arrows: string[]; aims: (Cell | null)[] }
interface RunResult {
  ok: boolean; cls?: FailClass; note?: string; holds: number; flips: number; walked: number; hops: Hop[];
  /** 닿은 곳이 과녁이 아닌 다른 진행 이벤트일 때 그 이름. */
  other?: string;
  /** 화살표가 떠 있는 동안 대상이 둘 이상이던 맵(이름들). */
  multi: string[];
}
interface Truth { mapId: string; eventId: string; name: string }

function follow(project: Project, session: PlaySession, moved: Record<string, Cell> | undefined, homeMapId: string, objective: Objective, truths: readonly Truth[], startMapId: string, start: Cell, hold: number, ctxCache: Map<string, MapCtx>): RunResult {
  const truth = truths[0]!;
  const result: RunResult = { ok: false, holds: 0, flips: 0, walked: 0, hops: [], multi: [] };
  const fail = (cls: FailClass, note?: string): RunResult => ({ ...result, cls, ...(note ? { note } : {}) });
  if (!objective.text) return fail("목표 줄 없음");
  let mapId = startMapId, here = start;
  const entered = new Set<string>();
  for (let hopCount = 0; hopCount < 12; hopCount += 1) {
    const entryKey = `${mapId}|${here.x},${here.y}`;
    if (entered.has(entryKey)) return fail("맵을 맴돎", `「${project.maps[mapId]?.name}」(${here.x},${here.y}) 에 다시 들어섬`);
    entered.add(entryKey);
    let ctx = ctxCache.get(mapId);
    if (!ctx) {
      const map = project.maps[mapId]!;
      const views = runtimeEventViewsForMap(project, map, session as never, (mapId === homeMapId ? moved : undefined) ?? {});
      const targets = targetViews(project, map, views, objective);
      const tiles = targets.map((v) => ({ x: v.x, y: v.y }));
      const blocked = blockedCells(map, views);
      const routeBlocked = blockedCells(map, views, new Set(targets.map((v) => v.event.id)));
      let route: unknown = null;
      if (tiles.length) { try { route = routeMod.objectiveRoute(project, map, tiles, routeBlocked); } catch { route = null; } }
      ctx = { map, views, targets, tiles, blocked, route, toTarget: walkField(project, map, tiles, blocked) };
      ctxCache.set(mapId, ctx);
    }
    const { map } = ctx;
    const hop: Hop = { mapId, cells: [here], arrows: [], aims: [] };
    result.hops.push(hop);
    if (!ctx.targets.length) {
      const truthHere = truths.some((t) => t.mapId === mapId);
      return fail("표시 없음", `「${map.name}」에 목표 표시·화살표가 없다(${truthHere ? "과녁이 이 맵에 있다" : `과녁은 「${project.maps[truth.mapId]?.name}」`})`);
    }
    // 같은 맵으로 가는 문 칸 여럿(넓은 길목)은 한 대상이다 — 서로 다른 것이 둘 이상일 때만 센다.
    const things = new Map<string, string>();
    for (const v of ctx.targets) { const d = doorOf(v); things.set(d ? `door:${d.mapId}` : v.event.id, d ? `${project.maps[d.mapId]?.name ?? d.mapId} 가는 문(${v.x},${v.y})` : `${v.event.name ?? v.event.id}(${v.x},${v.y})`); }
    if (things.size > 1) result.multi.push(`${map.name}: ${[...things.values()].join(" · ")}`);
    const dOf = (c: Cell): number => ctx!.toTarget[c.y * map.width + c.x]!;
    if (dOf(here) < 0) return fail("대상에 걸어 닿지 못함", `「${map.name}」(${here.x},${here.y}) 에서 표시된 대상 ${ctx.targets.map((v) => `${v.event.name ?? v.event.id}(${v.x},${v.y})`).join(" · ")} 옆에 설 수 없다`);
    const walk = (c: Cell, v: Cell): Cell | null => { const n = { x: c.x + v.x, y: c.y + v.y }; return n.x >= 0 && n.y >= 0 && n.x < map.width && n.y < map.height && canMove(project, map, c.x, c.y, n.x, n.y) && !ctx!.blocked.has(n.y * map.width + n.x) ? n : null; };
    const seen = new Set<number>(); let prev = -1;
    while (dOf(here) > 1) {
      const key = here.y * map.width + here.x;
      if (seen.has(key) || result.holds > 400) return fail("제자리를 맴돎", `「${map.name}」 ${hop.cells.slice(-6).map((c, i, a) => `(${c.x},${c.y})${hop.arrows[hop.cells.length - a.length + i] ?? ""}`).join(" ")}`);
      seen.add(key);
      const aim = routeMod.objectiveArrowAim(project, map, ctx.route, ctx.tiles, here, viewRect(map, here)) as { angle: number; cell: Cell } | undefined;
      let angle: number;
      let seen2: Cell | undefined; // 화살표가 없으면 대상(빛무리)이 화면에 보인다 — 그 줄까지만 걷는다(보이는 것을 지나치지 않는다).
      if (aim) angle = aim.angle;
      else { const t = ctx.tiles.reduce((b, c) => (Math.abs(c.x - here.x) + Math.abs(c.y - here.y) < Math.abs(b.x - here.x) + Math.abs(b.y - here.y) ? c : b)); angle = Math.atan2(t.y - here.y, t.x - here.x); seen2 = t; }
      const k = dir8(angle);
      if (aim) { if (prev >= 0 && prev !== k) result.flips += 1; prev = k; }
      hop.arrows.push(aim ? DIR8[k]! : "·"); hop.aims.push(aim ? aim.cell : null);
      const ax = Math.abs(Math.cos(angle)), ay = Math.abs(Math.sin(angle));
      let main: Cell = ax >= ay ? { x: Math.sign(Math.cos(angle)), y: 0 } : { x: 0, y: Math.sign(Math.sin(angle)) };
      const alt: Cell = ax >= ay ? { x: 0, y: Math.sign(Math.sin(angle)) || 1 } : { x: Math.sign(Math.cos(angle)) || 1, y: 0 };
      // 바닥 길이 보이면 첫 점 쪽으로, 점이 같은 줄로 이어지는 데까지만 누른다.
      let limit = seen2 ? Math.max(1, Math.min(hold, Math.abs(main.x ? seen2.x - here.x : seen2.y - here.y))) : hold;
      const trail = SEES_TRAIL && aim && ctx.route ? (routeMod.routeTrail(project, map, ctx.route, here) as { cells: Cell[] }).cells : [];
      if (trail.length && Math.abs(trail[0]!.x - here.x) + Math.abs(trail[0]!.y - here.y) === 1) {
        main = { x: trail[0]!.x - here.x, y: trail[0]!.y - here.y };
        let run = 1;
        while (run < trail.length && trail[run]!.x === here.x + main.x * (run + 1) && trail[run]!.y === here.y + main.y * (run + 1)) run += 1;
        limit = Math.min(hold, run);
      }
      let cur = here, moved2 = 0;
      for (const v of [main, alt]) { // 막힌 쪽이면 다른 축을 누른다(사람도 그렇게 한다)
        for (let i = 0; i < limit; i += 1) { const n = walk(cur, v); if (!n) break; cur = n; moved2 += 1; if (dOf(cur) >= 0 && dOf(cur) <= 1) break; }
        if (moved2) break;
      }
      result.holds += 1;
      if (!moved2) return fail("막혀 섬", `「${map.name}」(${here.x},${here.y}) 화살표 ${aim ? DIR8[k] : "없음"} — 두 축 모두 막힘`);
      result.walked += moved2;
      here = cur; hop.cells.push(here);
    }
    // 표시가 붙은 대상 옆(또는 그 칸)에 섰다 — 무엇인가.
    const near = ctx.targets.filter((v) => Math.abs(v.x - here.x) + Math.abs(v.y - here.y) <= 1);
    if (near.some((v) => truths.some((t) => t.mapId === mapId && t.eventId === v.event.id))) return { ...result, ok: true };
    const door = near.map((v) => ({ v, door: doorOf(v) })).find((d) => d.door && project.maps[d.door.mapId]);
    // 과녁은 아니지만 지금 열린 페이지가 판을 바꾸는(스위치·아이템·목표·전투) 이벤트 — 자동 플레이가 고른 순서와 다를 뿐 안내는 이어진다. 따로 센다.
    if (!door && near.some((v) => pageDoes(v) !== "말만")) return { ...result, ok: true, other: near.map((v) => `${v.event.name ?? v.event.id}[${pageDoes(v)}]`).join("·") };
    if (!door) {
      // 과녁이 같은 맵 한 화면 안(8칸)에 있으면 «가까운 엉뚱한 대상» — 사람은 곁에서 찾을 수도 있다. 따로 센다.
      const here2 = near[0] ?? { x: here.x, y: here.y };
      const gap = Math.min(...truths.filter((t) => t.mapId === mapId).map((t) => { const v = ctx!.views.find((w) => w.event.id === t.eventId); return v ? Math.abs(v.x - here2.x) + Math.abs(v.y - here2.y) : Infinity; }), Infinity);
      return fail(gap <= 8 ? "엉뚱한 대상(과녁이 8칸 안)" : "엉뚱한 대상", `「${map.name}」 ${near.map((v) => `${v.event.name ?? v.event.id}(${v.x},${v.y})[${pageDoes(v)}]`).join(" · ")} 로 데려감 — 과녁은 ${truths.map((t) => `${project.maps[t.mapId]?.name}/${t.name}`).join(" 또는 ")}${gap <= 8 ? ` (${gap}칸 떨어짐)` : ""}`);
    }
    mapId = door.door!.mapId; here = { x: door.door!.x, y: door.door!.y };
  }
  return fail("맵을 맴돎", "맵을 열두 번 넘게 옮김");
}

/** 과녁에 걸어 닿는 길이 있나(맵을 건너) — 없으면 화살표 탓이 아니다(맵·문 문제). */
function truthReachable(project: Project, session: PlaySession, moved: Record<string, Cell> | undefined, homeMapId: string, truths: readonly Truth[], startMapId: string, start: Cell): boolean {
  const queue: { mapId: string; cell: Cell }[] = [{ mapId: startMapId, cell: start }];
  const done = new Set<string>();
  for (let h = 0; h < queue.length && h < 200; h += 1) {
    const { mapId, cell } = queue[h]!;
    const map = project.maps[mapId];
    if (!map) continue;
    const views = runtimeEventViewsForMap(project, map, session as never, (mapId === homeMapId ? moved : undefined) ?? {});
    const blocked = blockedCells(map, views);
    const reach = reachFrom(project, map, [cell], blocked);
    const touches = (v: RuntimeEventView): boolean => reach.has(v.y * map.width + v.x) || STEPS.some((s) => reach.has((v.y + s.y) * map.width + v.x + s.x) && v.x + s.x >= 0 && v.x + s.x < map.width);
    for (const v of views) {
      if (!v.page || !touches(v)) continue;
      if (truths.some((t) => t.mapId === mapId && t.eventId === v.event.id)) return true;
      const door = doorOf(v);
      if (!door || !project.maps[door.mapId]) continue;
      const key = `${door.mapId}|${door.x},${door.y}`;
      if (!done.has(key)) { done.add(key); queue.push({ mapId: door.mapId, cell: { x: door.x, y: door.y } }); }
    }
  }
  return false;
}

interface Tally { runs: number; ok: number; other: number; holds: number; flips: number }
interface Example { game: string; moment: number; kind: "play" | "spread"; hold: number; cls: FailClass; note: string; objective: string; goal: string; truth: string; startMap: string; start: Cell; hops: Hop[] }
interface GameReport {
  game: string; autoplay: string; moments: number; skipped: string[];
  byHold: Record<number, { play: Tally; spread: Tally; classes: Record<string, number>; unreachable: number }>;
  multi: string[]; examples: Example[];
  momentsList: { index: number; goal: string; objective: string | null; shown: string | null; at: string; truth: string; play: Record<number, string> }[];
}

function measure(dir: string): GameReport {
  const game = path.basename(path.resolve(dir));
  const project = readProjectSqlite(path.join(dir, "project")) as Project;
  const raw: AutoPlayMoment[] = [];
  const report = runAutoPlay(project, { budgetMs: 90_000, onGoal: (m) => raw.push(m) });
  const run = report.runs[0];
  const autoplay = report.skipped ?? (run ? `${run.ok ? "엔딩 도달" : "막힘"}${run.failure ? ` — ${run.failure.goal}: ${run.failure.detail.slice(0, 90)}` : ""}` : "없음");
  const out: GameReport = { game, autoplay, moments: 0, skipped: [], byHold: {}, multi: [], examples: [], momentsList: [] };
  for (const h of HOLDS) out.byHold[h] = { play: { runs: 0, ok: 0, other: 0, holds: 0, flips: 0 }, spread: { runs: 0, ok: 0, other: 0, holds: 0, flips: 0 }, classes: {}, unreachable: 0 };
  const multi = new Set<string>();
  const spreadSeen = new Set<string>();
  raw.forEach((moment, index) => {
    if (moment.alreadyDone) { out.skipped.push(`${index} ${moment.goal}: 이미 채워짐(앞 대화가 함께 줌)`); return; }
    // 과녁: 이 목표가 「맵 진입」이면 그 뒤 첫 실제 목표의 이벤트.
    const rest = raw.slice(index).filter((m) => m.requirement !== "map" && !m.alreadyDone && m.where.mapId && m.where.eventId);
    const real = rest[0];
    if (!real) { out.skipped.push(`${index} ${moment.goal}: 과녁 이벤트 없음(공통 이벤트)`); return; }
    const where = real.where;
    const truth: Truth = { mapId: where.mapId!, eventId: where.eventId!, name: String(where.eventName || where.eventId) };
    const state = moment.state;
    const session = state.session;
    const homeMapId = state.finalState.mapId;
    const start = { x: state.finalState.x, y: state.finalState.y };
    const moved = state.movedEvents as Record<string, Cell> | undefined;
    const objective = objectiveOf(session);
    const home = project.maps[homeMapId]!;
    const truthMap = project.maps[truth.mapId];
    const viewsOn = new Map<string, RuntimeEventView[]>();
    const viewOf = (mapId: string, eventId: string): RuntimeEventView | undefined => {
      const map = project.maps[mapId];
      if (!map) return undefined;
      if (!viewsOn.has(mapId)) viewsOn.set(mapId, runtimeEventViewsForMap(project, map, session as never, (mapId === homeMapId ? moved : undefined) ?? {}));
      return viewsOn.get(mapId)!.find((v) => v.event.id === eventId);
    };
    const truthView = viewOf(truth.mapId, truth.eventId);
    // 남은 목표 가운데 그 일을 하는 페이지가 지금 열려 있는 이벤트도 과녁이다(순서가 자유로운 일).
    const truths: Truth[] = [truth];
    for (const later of rest.slice(1)) {
      const w = later.where;
      if (truths.some((t) => t.mapId === w.mapId && t.eventId === w.eventId)) continue;
      const view = viewOf(w.mapId!, w.eventId!);
      const page = view ? (view.event.pages ?? [])[w.pageIndex ?? -1] : undefined;
      if (view?.page && page && view.pageId === page.id) truths.push({ mapId: w.mapId!, eventId: w.eventId!, name: String(w.eventName || w.eventId) });
    }
    out.moments += 1;
    const shown = objective.text ? targetMod.objectiveTextOnMap(home, objective.text) as string : null;
    const row = { index, goal: moment.goal, objective: objective.text, shown, at: `${home.name}(${start.x},${start.y})`, truth: `${truthMap?.name}/${truth.name}(${truthView?.x ?? "?"},${truthView?.y ?? "?"})${truths.length > 1 ? ` (+${truths.slice(1).map((t) => t.name).join("·")})` : ""}`, play: {} as Record<number, string> };
    out.momentsList.push(row);
    const ctxCache = new Map<string, MapCtx>();
    const record = (kind: "play" | "spread", hold: number, startCell: Cell, r: RunResult): void => {
      const bucket = out.byHold[hold]!;
      if (!r.ok && (r.cls === "과녁이 이 판에 없음" || r.cls === "과녁에 걸어 닿는 길이 없음")) { bucket.unreachable += 1; bucket.classes[r.cls] = (bucket.classes[r.cls] ?? 0) + 1; }
      else {
        const b = bucket[kind];
        b.runs += 1; if (r.ok) { b.ok += 1; b.holds += r.holds; b.flips += r.flips; if (r.other) b.other += 1; }
        else bucket.classes[r.cls!] = (bucket.classes[r.cls!] ?? 0) + 1;
      }
      for (const m of r.multi) multi.add(`[${index}] ${m}`);
      if (!r.ok && (kind === "play" || out.examples.filter((e) => e.cls === r.cls && e.kind === "spread").length < 6)) {
        out.examples.push({ game, moment: index, kind, hold, cls: r.cls!, note: r.note ?? "", objective: objective.text ?? "", goal: moment.goal, truth: row.truth, startMap: home.name ?? homeMapId, start: startCell, hops: r.hops });
      }
      if (verbose) console.log(`    ${kind} hold${hold} (${startCell.x},${startCell.y}) ${r.ok ? `닿음 누르기 ${r.holds} 바뀜 ${r.flips}` : `✗ ${r.cls} ${r.note ?? ""}`}`);
    };
    const runFrom = (kind: "play" | "spread", startCell: Cell): void => {
      const reachable = truthView && truthReachable(project, session, moved, homeMapId, truths, homeMapId, startCell);
      for (const hold of HOLDS) {
        const r: RunResult = !truthView ? { ok: false, cls: "과녁이 이 판에 없음", holds: 0, flips: 0, walked: 0, hops: [], multi: [] }
          : !reachable ? { ok: false, cls: "과녁에 걸어 닿는 길이 없음", holds: 0, flips: 0, walked: 0, hops: [], multi: [] }
          : follow(project, session, moved, homeMapId, objective, truths, homeMapId, startCell, hold, ctxCache);
        record(kind, hold, startCell, r);
        if (kind === "play") row.play[hold] = r.ok ? `닿음${r.other ? `→${r.other}` : ""}(누르기 ${r.holds}·바뀜 ${r.flips})` : `✗ ${r.cls}`;
      }
    };
    if (verbose) console.log(`  [${index}] ${row.at} 목표 「${objective.text ?? "(없음)"}」 → 과녁 ${row.truth} (${moment.goal})`);
    if (traceArg && Number(traceArg.split(":")[0]) === index && traceOut) {
      const at = traceArg.split(":")[1]?.split(",").map(Number);
      const from = at ? { x: at[0]!, y: at[1]! } : start;
      const sess = session as unknown as { switches: Record<string, boolean>; variables: Record<string, number>; inventory: Record<string, number>; selfSwitches: Record<string, Record<string, boolean>>; gold: number };
      fs.writeFileSync(traceOut, JSON.stringify({
        checkpoint: { id: `follow-${game}-${index}`, mapId: homeMapId, x: from.x, y: from.y, switches: Object.keys(sess.switches).filter((k) => sess.switches[k]), variables: sess.variables, items: sess.inventory, selfSwitches: sess.selfSwitches, gold: sess.gold, ...(objective.text ? { objective: objective.text } : {}) },
        truth: row.truth,
        // 맵마다 그 순간 표시(빛무리·화살표)가 붙는 칸과 과녁 칸 — 그림에 겹쳐 그린다.
        marks: Object.fromEntries(Object.values(project.maps).map((m) => [m.id, targetViews(project, m, runtimeEventViewsForMap(project, m, session as never, (m.id === homeMapId ? moved : undefined) ?? {}), objective).map((v) => ({ x: v.x, y: v.y }))])),
        truthCells: Object.fromEntries(Object.values(project.maps).map((m) => [m.id, truths.filter((t) => t.mapId === m.id).map((t) => viewOf(t.mapId, t.eventId)).filter(Boolean).map((v) => ({ x: v!.x, y: v!.y }))])),
        traces: Object.fromEntries(HOLDS.map((hold) => { const r = follow(project, session, moved, homeMapId, objective, truths, homeMapId, from, hold, new Map()); return [hold, { ok: r.ok, cls: r.cls, hops: r.hops.map((h) => ({ mapId: h.mapId, cells: h.cells })) }]; })),
      }));
    }
    runFrom("play", start);
    // spread: 이 맵의 착지 칸 + 걸어 닿는 칸에서 고르게. 같은 판(맵·목표·과녁·세션의 스위치/아이템)이면 한 번만.
    const fp = `${homeMapId}|${objective.text}|${truth.mapId}/${truth.eventId}|${state.finalState.switchesOn.join(",")}|${JSON.stringify(state.finalState.inventory)}`;
    if (spreadSeen.has(fp)) return; spreadSeen.add(fp);
    const views = runtimeEventViewsForMap(project, home, session as never, moved ?? {});
    const blocked = blockedCells(home, views);
    const landings: Cell[] = [];
    for (const other of Object.values(project.maps)) for (const ev of other.events ?? []) JSON.stringify(ev.pages ?? [], (_k, val) => { if (val && val.kind === "transfer" && val.mapId === homeMapId && typeof val.x === "number") landings.push({ x: val.x, y: val.y }); return val; });
    if (project.startMapId === homeMapId && project.startPos) landings.push({ x: project.startPos.x, y: project.startPos.y });
    const standable = (c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < home.width && c.y < home.height && isPassable(project, home, c.x, c.y) && !blocked.has(c.y * home.width + c.x);
    const seeds = [start, ...landings].filter(standable);
    const reach = [...reachFrom(project, home, seeds, blocked)].sort((a, b) => a - b).map((k) => ({ x: k % home.width, y: (k / home.width) | 0 }));
    const picks: Cell[] = landings.filter(standable);
    for (let k = 0; k < SPREAD && reach.length; k += 1) picks.push(reach[Math.floor(((k + 0.5) / SPREAD) * reach.length)]!);
    const uniq = [...new Map(picks.filter((c) => c.x !== start.x || c.y !== start.y).map((c) => [`${c.x},${c.y}`, c])).values()];
    for (const cell of uniq) runFrom("spread", cell);
  });
  out.multi = [...multi];
  return out;
}

const reports: GameReport[] = [];
for (const dir of dirs) {
  let r: GameReport;
  try { r = measure(dir); } catch (error) { console.log(`\n# ${path.basename(dir)} — 재지 못함: ${error instanceof Error ? error.message : String(error)}`); continue; }
  reports.push(r);
  console.log(`\n# ${r.game} — 자동 플레이 ${r.autoplay} · 순간 ${r.moments}${r.skipped.length ? ` · 건너뜀 ${r.skipped.length}` : ""}`);
  for (const m of r.momentsList) console.log(`  [${m.index}] ${m.at} 「${(m.shown ?? "(목표 없음)").slice(0, 70)}」 → ${m.truth} · ${HOLDS.map((h) => `${h}칸: ${m.play[h]}`).join(" / ")}`);
  for (const h of HOLDS) {
    const b = r.byHold[h]!;
    const avg = (s: { ok: number; holds: number; flips: number }): string => (s.ok ? `누르기 ${(s.holds / s.ok).toFixed(1)} · 방향 바뀜 ${(s.flips / s.ok).toFixed(1)}` : "-");
    console.log(`  == ${h}칸 누르기: 실제 자리 ${b.play.ok}/${b.play.runs} 닿음(${b.play.other ? `그중 다른 진행 이벤트 ${b.play.other} · ` : ""}${avg(b.play)}) · 고른 자리 ${b.spread.ok}/${b.spread.runs} 닿음(${b.spread.other ? `그중 다른 진행 이벤트 ${b.spread.other} · ` : ""}${avg(b.spread)}) · 못 닿은 까닭 ${Object.entries(b.classes).map(([k, v]) => `${k} ${v}`).join(" · ") || "없음"}`);
  }
  if (r.multi.length) console.log(`  대상이 둘 이상인 채 안내한 판 ${r.multi.length}: ${r.multi.slice(0, 8).join(" | ")}`);
  const shownCls = new Set<string>();
  for (const e of r.examples) { const k = `${e.cls}|${e.moment}`; if (shownCls.has(k)) continue; shownCls.add(k); console.log(`  ✗ [${e.moment}] ${e.kind} ${e.hold}칸 (${e.start.x},${e.start.y}) ${e.cls}: ${e.note}`); }
}
if (outFile) fs.writeFileSync(outFile, JSON.stringify(reports));
