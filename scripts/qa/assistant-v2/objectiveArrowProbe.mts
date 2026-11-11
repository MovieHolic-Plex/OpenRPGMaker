// 목표 화살표 vs 실제로 걸을 수 있는 길(모델 없음) — 저장된 게임의 맵·목표마다 ~10자리에서 화살표가 가리키는 쪽과 실제 걷기 규칙의 길을 견준다.
//   bun scripts/qa/assistant-v2/objectiveArrowProbe.mts <before|after> <run-dir | live.json> [--all] [--verbose] [--hold N] [--extra "맵이름:x,y;…"]
// before = 2026-11-11 이전 화살표(타일 통행만 본 길의 세 걸음 앞 칸을 주인공 발끝에서 본 각도)를 이 파일 안에 그대로 옮긴 것, after = 지금 제품 함수(objectiveArrowAim).
//   A 첫 걸음 불일치: 화살표 쪽(8방, 대각선이면 두 축 중 하나)으로 한 칸 못 걷거나, 걸으면 대상에서 멀어진다.
//   B 벽을 본다: 화살표가 «곧게 걸어 닿는 가장 먼 길목»과 45° 넘게 어긋난다(벽면을 향하다 꺾이는 안내).
//   C 막힌 칸 가로지름: 가리킨 칸까지의 직선 위에 설 수 없는 칸이 있다(모서리를 가로지르는 안내).
//   눌러 걷기: 화살표를 읽고 그 방향키를 N칸(기본 4) 누른 뒤 다시 읽는 플레이어 — 눈가림 판정자처럼 걷는다.
// 실제 걷기 규칙 = 타일 통행(canMove) + 막는 이벤트(같은 층·겹침 금지) 칸에는 못 선다. 이벤트 페이지는 스위치를 모두 켠 세션으로 고른다(부가 퀘스트 sw_q_ 제외).
// 왜: 2026-11-11 fun-x1 눈가림 플레이 «화살표가 벽 쪽을 가리킴» — openwiki/assistant-v2.md 「목표 화살표는 길목을 가리킨다」.
import { readFileSync } from "node:fs";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { canMove, isPassable } from "../../../src/project/collision.ts";
import { runtimeEventViewsForMap } from "../../../src/project/runtimeEventState.ts";
import { objectiveTargetViews } from "../../../src/player/objectiveTarget.ts";
import { objectiveArrowAim, objectiveRoute } from "../../../src/player/objectiveRoute.ts";

type Cell = { x: number; y: number };
const STEPS: Cell[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const mode = process.argv[2] as "before" | "after";
const source = process.argv[3]!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const project: any = source.endsWith(".json") ? JSON.parse(readFileSync(source, "utf8")) : readProjectSqlite(path.join(source, "project"));
const verbose = process.argv.includes("--verbose");
const HOLD = process.argv.includes("--hold") ? Number(process.argv[process.argv.indexOf("--hold") + 1]) : 4;
const extraArg = process.argv.includes("--extra") ? process.argv[process.argv.indexOf("--extra") + 1]! : "";
function freshSession(switches: string[] = []): any {
  return { flags: {}, switches: Object.fromEntries(switches.map((s) => [s, true])), selfSwitches: {}, variables: {}, timers: {}, gold: 0, inventory: {}, partyActorIds: [], erasedEventIds: [] };
}
function views(map: any, session: any): any[] { return runtimeEventViewsForMap(project, map, session, {}); }
/** 주인공을 막는 이벤트 칸(같은 층 · 겹침 금지) — 런타임 findBlockingRuntimeEventAt 과 같은 조건. */
function blockers(vs: any[]): Set<string> {
  const out = new Set<string>();
  for (const v of vs) if (v.priority === "same" && v.overlapForbidden) {
    const r = v.passRect ?? { left: v.x, top: v.y, right: v.x, bottom: v.y };
    const x1 = r.right ?? (r.x + (r.width ?? 1) - 1), y1 = r.bottom ?? (r.y + (r.height ?? 1) - 1), x0 = r.left ?? r.x, y0 = r.top ?? r.y;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.add(`${x},${y}`);
  }
  return out;
}
/** 실제 걷기 규칙으로 잰 대상까지 걸음 수: 타일 통행(canMove) + 막는 이벤트 칸에는 못 선다. 대상 칸은 옆에 서면 닿는다. */
function trueField(map: any, targets: Cell[], blocked: Set<string>): Int32Array {
  const { width, height } = map;
  const dist = new Int32Array(width * height).fill(-1);
  const queue: number[] = []; const goal = new Set<number>();
  for (const t of targets) { const k = t.y * width + t.x; if (dist[k] !== 0) { dist[k] = 0; goal.add(k); queue.push(k); } }
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h]!; const cx = c % width, cy = (c - cx) / width;
    for (const s of STEPS) {
      const nx = cx + s.x, ny = cy + s.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (dist[n]! >= 0) continue;
      if (blocked.has(`${nx},${ny}`) && !goal.has(n)) continue; // 막는 이벤트 칸에는 설 수 없다
      if (goal.has(c)) { if (!isPassable(project, map, nx, ny)) continue; } // 대상 옆 칸: 서 있을 수 있으면 닿는다(조사·접촉)
      else if (!canMove(project, map, nx, ny, cx, cy)) continue;
      dist[n] = dist[c]! + 1; queue.push(n);
    }
  }
  return dist;
}
/** 게임 안의 모든 목표 글(걸리는 맵·이벤트). */
function objectives(): { mapId: string; event: string; message: string }[] {
  const out: { mapId: string; event: string; message: string }[] = [];
  const walk = (v: any, mapId: string, event: string): void => {
    if (Array.isArray(v)) { for (const x of v) walk(x, mapId, event); return; }
    if (!v || typeof v !== "object") return;
    if (v.kind === "m2Command" && v.fields?.surface === "objectiveChip" && typeof v.fields.message === "string") out.push({ mapId, event, message: v.fields.message });
    for (const x of Object.values(v)) if (x && typeof x === "object") walk(x, mapId, event);
  };
  for (const map of Object.values(project.maps as Record<string, any>)) for (const ev of map.events ?? []) walk(ev.pages ?? [], map.id, String(ev.name ?? ev.id));
  return out;
}
const VIEW = { w: 20, h: 15 }; // 960×720 화면, 칸 48px
function viewRect(map: any, here: Cell): { x0: number; y0: number; x1: number; y1: number } {
  const cx = here.x + 0.5, cy = here.y + 0.5;
  const x0 = map.width <= VIEW.w ? (map.width - VIEW.w) / 2 : Math.min(map.width - VIEW.w, Math.max(0, cx - VIEW.w / 2));
  const y0 = map.height <= VIEW.h ? (map.height - VIEW.h) / 2 : Math.min(map.height - VIEW.h, Math.max(0, cy - VIEW.h / 2));
  return { x0, y0, x1: x0 + VIEW.w, y1: y0 + VIEW.h };
}
const DIR8 = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
const DIR8_VEC: Cell[] = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }];
const dir8 = (angle: number): number => (((Math.round(angle / (Math.PI / 4))) % 8) + 8) % 8;

/** 2026-11-11 이전 길: 타일 통행만 본 걸음 수 지도(막는 이벤트는 모른다). */
function oldField(map: any, targets: Cell[]): Int32Array { return trueField(map, targets, new Set()); }
/** 2026-11-11 이전 routeWaypoint: 걸음 수가 줄어드는 첫 이웃(위·오른쪽·아래·왼쪽 순)으로 세 걸음. */
function oldWaypoint(field: Int32Array, map: any, from: Cell): { cell: Cell; steps: number } | undefined {
  const steps = field[from.y * map.width + from.x]!;
  if (steps < 0) return undefined;
  let cur = from;
  for (let i = 0; i < 3; i += 1) {
    const d = field[cur.y * map.width + cur.x]!;
    if (d <= 0) break;
    const next = STEPS.map((s) => ({ x: cur.x + s.x, y: cur.y + s.y })).find((c) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height && field[c.y * map.width + c.x] === d - 1);
    if (!next) break;
    cur = next;
  }
  return { cell: cur, steps };
}
type Arrow = { visible: boolean; angle: number; aim?: Cell; kind: string };
/** 옛 화살표(syncObjectiveArrow 그대로): 3걸음 앞 칸을 주인공 발(칸 아래 끝)에서 본 각도. 길이 없으면 가장 가까운 대상으로 직선. */
function arrowBefore(map: any, tiles: Cell[], field: Int32Array, here: Cell): Arrow {
  const v = viewRect(map, here);
  const px = here.x + 0.5, py = here.y + 1;
  const pts = tiles.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
  const inside = (p: Cell) => p.x >= v.x0 && p.x <= v.x1 && p.y >= v.y0 && p.y <= v.y1;
  const way = oldWaypoint(field, map, here);
  const nearest = way ? tiles.reduce<Cell | undefined>((b, t) => !b || Math.abs(t.x - here.x) + Math.abs(t.y - here.y) < Math.abs(b.x - here.x) + Math.abs(b.y - here.y) ? t : b, undefined) : undefined;
  const detour = Boolean(way && nearest && way.steps > 1 && way.steps > (Math.abs(here.x - nearest.x) + Math.abs(here.y - nearest.y)) * 1.5 + 4);
  if (pts.some(inside) && !detour) return { visible: false, angle: 0, kind: "hidden" };
  if (way && way.steps > 0) return { visible: true, angle: Math.atan2(way.cell.y + 0.5 - py, way.cell.x + 0.5 - px), aim: way.cell, kind: "route" };
  const p = [...pts].sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0]!;
  return { visible: true, angle: Math.atan2(p.y - py, p.x - px), aim: { x: Math.floor(p.x), y: Math.floor(p.y) }, kind: "straight" };
}
function arrowAfter(map: any, tiles: Cell[], route: any, here: Cell): Arrow {
  const v = viewRect(map, here);
  const aim = objectiveArrowAim(project, map, route, tiles, here, { x: v.x0, y: v.y0, right: v.x1, bottom: v.y1 });
  if (!aim) return { visible: false, angle: 0, kind: "hidden" };
  return { visible: true, angle: aim.angle, aim: aim.cell, kind: aim.kind };
}

let rows = 0, wrongA = 0, wrongB = 0, wrongC = 0, hiddenOff = 0, holdRuns = 0, holdFail = 0, holdCount = 0, holdOver = 0, holdBump = 0, holdTurns = 0;
const seenKey = new Set<string>();
const extra = new Map<string, Cell[]>();
for (const part of extraArg.split(";").filter(Boolean)) { const [name, xy] = part.split(":"); const [x, y] = xy!.split(",").map(Number); extra.set(name!, [...(extra.get(name!) ?? []), { x: x!, y: y! }]); }
const allSwitches = new Set<string>();
JSON.stringify(project.maps, (_k, v) => { if (v && typeof v.switchId === "string" && !/^sw_q_/.test(v.switchId)) allSwitches.add(v.switchId); return v; });
const session = freshSession(process.argv.includes("--fresh") ? [] : [...allSwitches]);
for (const obj of objectives()) {
  for (const map of Object.values(project.maps as Record<string, any>)) {
    const vs = views(map, session);
    const targets = objectiveTargetViews(project, map, vs, obj.message) as any[];
    if (!targets.length) continue;
    const tiles: Cell[] = targets.map((t) => ({ x: t.x, y: t.y }));
    const key = `${map.id}|${tiles.map((t) => `${t.x},${t.y}`).join(";")}`;
    if (seenKey.has(key)) continue; seenKey.add(key);
    const blocked = blockers(vs);
    const truth = trueField(map, tiles, blocked);
    const blockedIdx = new Set<number>([...blocked].map((k) => { const [x, y] = k.split(",").map(Number); return y! * map.width + x!; }).filter((k) => !tiles.some((t) => t.y * map.width + t.x === k)));
    const field: any = mode === "before" ? oldField(map, tiles) : objectiveRoute(project, map, tiles, blockedIdx);
    // 표본: 이 맵으로 들어서는 착지 칸 + 실제로 닿는 칸을 고르게 10개 + 판정자가 섰던 자리(--extra).
    const cand: Cell[] = [];
    for (const other of Object.values(project.maps as Record<string, any>)) for (const ev of other.events ?? []) JSON.stringify(ev.pages ?? [], (_k, val) => { if (val && val.kind === "transfer" && val.mapId === map.id && typeof val.x === "number") cand.push({ x: val.x, y: val.y }); return val; });
    if (project.startMapId === map.id && project.startPos) cand.push({ x: project.startPos.x, y: project.startPos.y });
    for (const [name, cells] of extra) if (map.name.includes(name)) cand.push(...cells);
    const reach: Cell[] = [];
    for (let i = 0; i < truth.length; i++) if (truth[i]! > 0 && !blocked.has(`${i % map.width},${(i / map.width) | 0}`)) reach.push({ x: i % map.width, y: (i / map.width) | 0 });
    if (process.argv.includes("--all")) cand.push(...reach); else for (let k = 0; k < 10 && reach.length; k++) cand.push(reach[Math.floor(((k + 0.5) / 10) * reach.length)]!);
    const uniq = [...new Map(cand.filter((c) => truth[c.y * map.width + c.x]! > 0).map((c) => [`${c.x},${c.y}`, c])).values()];
    console.log(`\n## 「${map.name}」 대상 ${targets.map((t) => `${t.event.name ?? t.event.id.slice(0, 22)}(${t.x},${t.y})`).join(" ")} ← 목표 「${obj.message.slice(0, 46)}」`);
    for (const start of uniq) { const h = holdPlayer(map, tiles, field, truth, blocked, start); holdRuns++; if (!h.reached) holdFail++; holdCount += h.holds; holdOver += h.overshoots; holdBump += h.bumps; holdTurns += h.turns;
      if (verbose || !h.reached) console.log(`  걷기 (${start.x},${start.y}) ${h.reached ? "닿음" : "못 닿음"} · 누르기 ${h.holds} · 지나침 ${h.overshoots} · 제자리 막힘 ${h.bumps} · ${h.trace}`); }
    for (const here of uniq) {
      const d = truth[here.y * map.width + here.x]!;
      const arrow = mode === "before" ? arrowBefore(map, tiles, field, here) : arrowAfter(map, tiles, field, here);
      const ok = (n: Cell) => n.x >= 0 && n.y >= 0 && n.x < map.width && n.y < map.height && canMove(project, map, here.x, here.y, n.x, n.y) && truth[n.y * map.width + n.x] === d - 1 && (d - 1 === 0 || !blocked.has(`${n.x},${n.y}`));
      const good = STEPS.filter((s) => d === 1 ? truth[(here.y + s.y) * map.width + here.x + s.x] === 0 : ok({ x: here.x + s.x, y: here.y + s.y }));
      const goodNames = good.map((s) => DIR8[DIR8_VEC.findIndex((v) => v.x === s.x && v.y === s.y)]).join("");
      rows++;
      const v = viewRect(map, here);
      const onScreen = tiles.some((t) => t.x + 0.5 >= v.x0 && t.x + 0.5 <= v.x1 && t.y + 0.5 >= v.y0 && t.y + 0.5 <= v.y1);
      if (!arrow.visible) {
        if (!onScreen) { hiddenOff++; console.log(`  (${here.x},${here.y}) d=${d} 화살표 없음 · 대상 화면 밖 ✗`); }
        else if (verbose) console.log(`  (${here.x},${here.y}) d=${d} 화살표 없음(대상 화면 안) 길 ${goodNames}`);
        continue;
      }
      const k = dir8(arrow.angle); const vec = DIR8_VEC[k]!;
      const comps = vec.x !== 0 && vec.y !== 0 ? [{ x: vec.x, y: 0 }, { x: 0, y: vec.y }] : [vec];
      const a = comps.some((c) => good.some((g) => g.x === c.x && g.y === c.y));
      // 곧게 걸어갈 수 있는 가장 먼 길목(실제 규칙) — 화살표가 그쪽과 45° 넘게 어긋나면 «벽을 본다».
      const ideal = idealAim(map, truth, blocked, here);
      const idealAngle = Math.atan2(ideal.y - here.y, ideal.x - here.x);
      let diff = Math.abs(arrow.angle - idealAngle); if (diff > Math.PI) diff = 2 * Math.PI - diff;
      const b = diff <= Math.PI / 4 + 1e-6;
      const c = !arrow.aim || straightClear(map, blocked, truth, here, arrow.aim);
      if (!a) wrongA++; if (!b) wrongB++; if (!c) wrongC++;
      if (verbose || !a || !b || !c) console.log(`  (${here.x},${here.y}) d=${d} 화살표 ${DIR8[k]} ${(arrow.angle * 180 / Math.PI).toFixed(0)}° → (${arrow.aim?.x},${arrow.aim?.y}) [${arrow.kind}] · 길 첫걸음 ${goodNames || "없음"} · 길목 (${ideal.x},${ideal.y}) ${(idealAngle * 180 / Math.PI).toFixed(0)}°${a ? "" : "  ✗A 첫걸음"}${b ? "" : "  ✗B 벽을 본다"}${c ? "" : "  ✗C 막힌 칸 가로지름"}`);
    }
  }
}
console.log(`\n== ${mode} 눌러 걷기(화살표를 읽고 그 쪽 방향키를 최대 ${HOLD}칸 누른 뒤 다시 읽는 플레이어, 출발 ${holdRuns}곳): 못 닿음 ${holdFail} · 누르기 평균 ${(holdCount / Math.max(1, holdRuns)).toFixed(1)} · 지나쳐 되돌아옴 ${holdOver} · 제자리에서 막힘 ${holdBump} · 화살표 방향 바뀜 ${holdTurns}`);
console.log(`== ${mode}: 자리 ${rows} · A 첫 걸음 불일치 ${wrongA} · B 벽을 본다 ${wrongB} · C 막힌 칸 가로지름 ${wrongC} · 대상 화면 밖인데 화살표 없음 ${hiddenOff}`);

/** here→to 를 계단(4방) 직선으로 걸을 수 있나: 걸음마다 실제 규칙으로 걸리고 대상에 한 걸음씩 가까워진다. */
function stairWalk(map: any, truth: Int32Array, blocked: Set<string>, here: Cell, to: Cell): boolean {
  let x = here.x, y = here.y; const dx = to.x - here.x, dy = to.y - here.y; const ax = Math.abs(dx), ay = Math.abs(dy); const sx = Math.sign(dx), sy = Math.sign(dy);
  let ix = 0, iy = 0;
  while (ix < ax || iy < ay) {
    const stepX = iy >= ay || (ix < ax && (ix + 0.5) * ay <= (iy + 0.5) * ax);
    const nx = stepX ? x + sx : x, ny = stepX ? y : y + sy;
    const dHere = truth[y * map.width + x]!, dNext = truth[ny * map.width + nx]!;
    if (dNext !== dHere - 1 || !canMove(project, map, x, y, nx, ny) || (dNext > 0 && blocked.has(`${nx},${ny}`))) return false;
    x = nx; y = ny; if (stepX) ix++; else iy++;
  }
  return true;
}
function idealAim(map: any, truth: Int32Array, blocked: Set<string>, here: Cell): Cell {
  let best: Cell = here, bestD = truth[here.y * map.width + here.x]!;
  for (let y = Math.max(0, here.y - 12); y <= Math.min(map.height - 1, here.y + 12); y++) for (let x = Math.max(0, here.x - 12); x <= Math.min(map.width - 1, here.x + 12); x++) {
    const d = truth[y * map.width + x]!;
    if (d < 0 || d >= bestD) continue;
    if (stairWalk(map, truth, blocked, here, { x, y }) && straightClear(map, blocked, truth, here, { x, y })) { best = { x, y }; bestD = d; }
  }
  return best;
}
/** 가리킨 칸까지의 직선(칸 가운데 ↔ 가운데, 모서리 틈을 잡으려고 ±0.02 띠)이 지나는 칸이 모두 설 수 있는 칸인가(대상 칸 제외). */
function straightClear(map: any, blocked: Set<string>, truth: Int32Array, here: Cell, to: Cell): boolean {
  const dx = to.x - here.x, dy = to.y - here.y; const len = Math.hypot(dx, dy); if (!len) return true;
  const px = -dy / len * 0.02, py = dx / len * 0.02;
  const n = Math.ceil(len * 64);
  for (let i = 1; i < n; i++) for (const o of [-1, 0, 1]) {
    const x = Math.floor(here.x + 0.5 + (dx * i) / n + px * o), y = Math.floor(here.y + 0.5 + (dy * i) / n + py * o);
    if (x === to.x && y === to.y) continue;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const d = truth[y * map.width + x]!;
    if (d < 0 || (d > 0 && blocked.has(`${x},${y}`))) return false;
  }
  return true;
}

/**
 * 눈가림 판정자처럼 걷는 플레이어: 화살표를 읽고(8방 → 크게 기운 축의 방향키) 막힐 때까지(최대 15칸) 누른 뒤 다시 읽는다.
 * 화살표가 없으면(대상이 화면 안) 대상 쪽으로 곧장 누른다. 지나침 = 누르는 동안 대상에 가장 가까웠던 칸을 지나 더 멀어진 채 멈춤.
 */
function holdPlayer(map: any, tiles: Cell[], field: any, truth: Int32Array, blocked: Set<string>, start: Cell): { reached: boolean; holds: number; overshoots: number; bumps: number; turns: number; trace: string } {
  let here = start, holds = 0, overshoots = 0, bumps = 0, turns = 0, prev = -1; const trace: string[] = [];
  const dOf = (c: Cell) => truth[c.y * map.width + c.x]!;
  const walk = (c: Cell, v: Cell): Cell | null => { const n = { x: c.x + v.x, y: c.y + v.y }; return n.x >= 0 && n.y >= 0 && n.x < map.width && n.y < map.height && canMove(project, map, c.x, c.y, n.x, n.y) && !blocked.has(`${n.x},${n.y}`) ? n : null; };
  while (holds < 120 && dOf(here) > 1) {
    const arrow = mode === "before" ? arrowBefore(map, tiles, field, here) : arrowAfter(map, tiles, field, here);
    let angle = arrow.angle;
    if (!arrow.visible) { const t = tiles.reduce((b, c) => Math.abs(c.x - here.x) + Math.abs(c.y - here.y) < Math.abs(b.x - here.x) + Math.abs(b.y - here.y) ? c : b); angle = Math.atan2(t.y - here.y, t.x - here.x); }
    const k = dir8(angle); if (arrow.visible) { if (prev >= 0 && prev !== k) turns++; prev = k; }
    const ax = Math.abs(Math.cos(angle)), ay = Math.abs(Math.sin(angle));
    const v: Cell = ax >= ay ? { x: Math.sign(Math.cos(angle)), y: 0 } : { x: 0, y: Math.sign(Math.sin(angle)) };
    let cur = here, best = dOf(here), moved = 0;
    for (let i = 0; i < HOLD; i++) { const n = walk(cur, v); if (!n) break; cur = n; moved++; if (dOf(cur) >= 0 && dOf(cur) < best) best = dOf(cur); if (dOf(cur) <= 1) break; }
    holds++;
    if (!moved) { bumps++; // 막힌 쪽이면 다른 축을 누른다(사람도 그렇게 한다)
      const alt: Cell = ax >= ay ? { x: 0, y: Math.sign(Math.sin(angle)) || 1 } : { x: Math.sign(Math.cos(angle)) || 1, y: 0 };
      for (let i = 0; i < HOLD; i++) { const n = walk(cur, alt); if (!n) break; cur = n; moved++; if (dOf(cur) >= 0 && dOf(cur) < best) best = dOf(cur); if (dOf(cur) <= 1) break; }
      if (!moved) { trace.push(`(${here.x},${here.y})${DIR8[k]}✗`); break; } }
    if (dOf(cur) > best + 1) overshoots++;
    trace.push(`(${here.x},${here.y})${arrow.visible ? DIR8[k] : "·"}`);
    here = cur;
  }
  return { reached: dOf(here) <= 1, holds, overshoots, bumps, turns, trace: trace.slice(0, 14).join(" ") };
}
