// 『첫사랑』 정적 탐침 — 사용자가 직접 지적한 실패가 돌아오지 않게 막는다(r2, 2026-10-21).
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/first-love-probes.mts
// 종료 코드 0 = 모두 통과. 실패는 한 줄씩 「[탐침] 맵 · 이벤트 · 무엇」으로 찍는다.
//
// 1. 인물 길·퇴장(actor): 자동 장면을 갈래마다 따라가며 이벤트·주인공의 위치를 흉내 낸다.
//    - 걷는 칸마다 실제로 걸을 수 있어야 하고(통행 + 칸 사이 이동), 다른 보이는 인물·주인공 칸에 겹치면 안 된다.
//    - 스위치·단계가 바뀌어 보이던 인물이 사라지면, 그 순간 그 인물은 출구(문·계단·엘리베이터 이벤트 옆 칸)에 있거나,
//      같은 칸에 같은 인물이 이어받거나(자리 이동 뒤 교대), 화면이 검어야 한다. 나타날 때도 같다.
// 2. 옮기기 짝(transfer): 모든 옮기기의 도착 칸은 걸을 수 있어야 하고, 도착 칸 바로 옆에 문·계단이 있으면 주인공은 그 문을 등져야 한다.
//    문 이벤트(밟으면 옮기는 칸)는 그 맵의 도착 칸에서 걸어서 닿아야 한다(벽·허공으로 가는 문 금지).
// 3. 대화창 자리(dialogue): 모든 대사는 아래 고정, 시작 장면이 첫 대사 전에 창 설정을 「아래·주인공 안 피함」으로 잠근다.
import { isPassable, canMove } from "../../../src/project/collision";
import { resolveEventPage } from "../../../src/project/io/pageResolution";
import type { Command, Dir, EventPage, GameEvent, GameMap, Project } from "../../../src/project/types";

const { createFlagshipDemoProject } = await import("../../../src/project/flagship");
const project: Project = createFlagshipDemoProject("first-love").project;

type Cell = { x: number; y: number };
const key = (c: Cell): string => `${c.x},${c.y}`;
const DELTA: Record<Dir, Cell> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } } as Record<Dir, Cell>;
const fails: string[] = [];
const fail = (area: string, msg: string): void => { fails.push(`[탐침:${area}] ${msg}`); };

type Session = { variables: Record<string, number>; switches: Record<string, boolean>; selfSwitches: Record<string, Record<string, boolean>> };
const visiblePage = (ev: GameEvent, s: Session): EventPage | undefined => {
  const page = resolveEventPage(ev, s as never);
  const g = page?.graphic as { sprite?: unknown } | undefined;
  return page && g?.sprite ? page : undefined;
};
/** 같은 인물인지 — 걷기 칩 시트 + 이벤트 이름(보는 방향은 페이지마다 달라도 같은 사람이다). */
const spriteOf = (ev: GameEvent, p: EventPage): string => JSON.stringify(((p.graphic as { sprite?: unknown }).sprite)) + "#" + ev.name;

/** 문·계단·엘리베이터 — 밟으면(또는 말 걸면) 옮기기·막힘 문구가 나오는 이벤트. door() 가 만든 것은 id 끝이 문 성격이다. */
function doorCells(map: GameMap): Cell[] {
  return map.events.filter((e) => (e.pages ?? []).some((p) => (p.trigger as { kind?: string })?.kind === "playerTouch")).map((e) => ({ x: e.x, y: e.y }));
}
const near = (a: Cell, b: Cell): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;

function isFade(c: Command, which: "fadeOut" | "fadeIn"): boolean {
  return c.kind === "m2Command" && (c as { fields?: { effect?: string } }).fields?.effect === which;
}

// ── 옮기기 목록(도착 맵·칸·방향, 그 앞의 마지막 단계 값) ──
type Transfer = { from: string; eventId: string; mapId: string; at: Cell; dir: Dir; stage?: number; physical: boolean };
const transfers: Transfer[] = [];
function collectTransfers(list: Command[], from: string, eventId: string, physical: boolean, stage?: number): number | undefined {
  let st = stage;
  for (const c of list) {
    if (c.kind === "setVariable" && (c as { variableId: string }).variableId === "var_fl_stage" && (c as { op: string }).op === "=") st = (c as { value: number }).value;
    if (c.kind === "transfer") {
      const t = c as unknown as { mapId: string; x: number; y: number; direction: Dir };
      transfers.push({ from, eventId, mapId: t.mapId, at: { x: t.x, y: t.y }, dir: t.direction, stage: st, physical });
    }
    for (const sub of childLists(c)) collectTransfers(sub, from, eventId, physical, st);
  }
  return st;
}
function childLists(c: Command): Command[][] {
  const any = c as unknown as { then?: Command[]; else?: Command[]; options?: { branch: Command[] }[] };
  const out: Command[][] = [];
  if (c.kind === "fork") { out.push(any.then ?? []); if (any.else) out.push(any.else); }
  if (c.kind === "choices") for (const o of any.options ?? []) out.push(o.branch);
  return out;
}
for (const [mapId, map] of Object.entries(project.maps)) {
  for (const ev of map.events) for (const p of ev.pages ?? []) {
    const physical = (p.trigger as { kind?: string })?.kind === "playerTouch";
    collectTransfers(p.commands as Command[], mapId, ev.id, physical);
  }
}

// ── 2. 옮기기 짝 ──
for (const t of transfers) {
  const map = project.maps[t.mapId];
  if (!map) { fail("transfer", `${t.from}/${t.eventId} → 없는 맵 ${t.mapId}`); continue; }
  if (!isPassable(project, map, t.at.x, t.at.y)) fail("transfer", `${t.from}/${t.eventId} → ${t.mapId} ${key(t.at)} 도착 칸이 벽·허공이다`);
  for (const d of doorCells(map)) {
    if (!near(d, t.at) || key(d) === key(t.at)) continue;
    const away = (Object.keys(DELTA) as Dir[]).find((k) => t.at.x - d.x === DELTA[k].x && t.at.y - d.y === DELTA[k].y);
    if (away && t.dir !== away) fail("transfer", `${t.from}/${t.eventId} → ${t.mapId} ${key(t.at)} 바로 옆 문(${key(d)})을 등지지 않는다: 방향 ${t.dir}, 맞는 방향 ${away}`);
  }
}
// 문은 그 맵 도착 칸에서 걸어서 닿아야 한다.
for (const [mapId, map] of Object.entries(project.maps)) {
  const entries = transfers.filter((t) => t.mapId === mapId).map((t) => t.at);
  if (mapId === project.startMapId && project.startPos) entries.push(project.startPos);
  if (!entries.length) continue;
  const seen = new Set(entries.map(key));
  const queue = [...entries];
  while (queue.length) {
    const c = queue.shift()!;
    for (const d of Object.values(DELTA)) {
      const n = { x: c.x + d.x, y: c.y + d.y };
      if (seen.has(key(n)) || !isPassable(project, map, n.x, n.y) || !canMove(project, map, c.x, c.y, n.x, n.y)) continue;
      seen.add(key(n)); queue.push(n);
    }
  }
  for (const ev of map.events) {
    const touches = (ev.pages ?? []).some((p) => (p.trigger as { kind?: string })?.kind === "playerTouch");
    if (touches && !seen.has(key(ev)) && ev.x > 1) fail("transfer", `${mapId}/${ev.id} 문 칸 ${key(ev)} 에 걸어서 닿지 못한다(벽·허공 문)`);
  }
}

// ── 1. 인물 길·퇴장 ──
const STAGE_VAR = "var_fl_stage";
function sceneStage(p: EventPage): number | undefined {
  const c = p.conditions.find((k) => (k as { kind: string; variableId?: string; op?: string }).kind === "variable" && (k as { variableId?: string }).variableId === STAGE_VAR && (k as { op?: string }).op === "==");
  return c ? (c as unknown as { value: number }).value : undefined;
}
function arrivalFor(mapId: string, stage: number | undefined): Cell | undefined {
  const hits = transfers.filter((t) => t.mapId === mapId && !t.physical && t.stage === stage);
  if (hits.length) return hits[0]!.at;
  const any = transfers.filter((t) => t.mapId === mapId);
  if (mapId === project.startMapId && project.startPos) return project.startPos;
  return any[0]?.at;
}

type Sim = { s: Session; pos: Record<string, Cell>; player: Cell; black: boolean; hidden: boolean; mapId: string; path: string };
const clone = (x: Sim): Sim => ({ s: { variables: { ...x.s.variables }, switches: { ...x.s.switches }, selfSwitches: {} }, pos: { ...x.pos }, player: { ...x.player }, black: x.black, hidden: x.hidden, mapId: x.mapId, path: x.path });

function visibleSet(sim: Sim): Map<string, { cell: Cell; sprite: string }> {
  const map = project.maps[sim.mapId]!;
  const out = new Map<string, { cell: Cell; sprite: string }>();
  for (const ev of map.events) {
    const p = visiblePage(ev, sim.s);
    if (p) out.set(ev.id, { cell: sim.pos[ev.id] ?? { x: ev.x, y: ev.y }, sprite: spriteOf(ev, p) });
  }
  return out;
}
function checkVisibilityChange(sim: Sim, before: Map<string, { cell: Cell; sprite: string }>, why: string): void {
  if (sim.black) return;
  const after = visibleSet(sim);
  const map = project.maps[sim.mapId]!;
  const doors = doorCells(map);
  const atExit = (c: Cell): boolean => doors.some((d) => near(d, c));
  for (const [id, b] of before) {
    if (after.has(id)) continue;
    const handoff = [...after.entries()].some(([oid, a]) => oid !== id && !before.has(oid) && key(a.cell) === key(b.cell) && a.sprite === b.sprite);
    if (!handoff && !atExit(b.cell)) fail("actor", `${sim.mapId} ${sim.path}: ${id} 가 ${key(b.cell)} 에서 사라진다(${why}) — 출구 옆도, 같은 칸 교대도, 검은 화면도 아니다`);
  }
  for (const [id, a] of after) {
    if (before.has(id)) continue;
    const handoff = [...before.entries()].some(([oid, b]) => oid !== id && !after.has(oid) && key(a.cell) === key(b.cell) && a.sprite === b.sprite);
    if (!handoff && !atExit(a.cell)) fail("actor", `${sim.mapId} ${sim.path}: ${id} 가 ${key(a.cell)} 에 솟아난다(${why}) — 문 옆도, 같은 칸 교대도, 검은 화면도 아니다`);
  }
}

function step(sim: Sim, who: string, dir: Dir): void {
  const map = project.maps[sim.mapId]!;
  const from = who === "@player" ? sim.player : (sim.pos[who] ?? (() => { const e = map.events.find((x) => x.id === who)!; return { x: e.x, y: e.y }; })());
  const to = { x: from.x + DELTA[dir].x, y: from.y + DELTA[dir].y };
  if (!sim.black) {
    if (!isPassable(project, map, to.x, to.y) || !canMove(project, map, from.x, from.y, to.x, to.y)) fail("actor", `${sim.mapId} ${sim.path}: ${who} 가 ${key(from)}→${key(to)} 로 못 가는 칸을 걷는다`);
    const others = visibleSet(sim);
    for (const [oid, o] of others) if (oid !== who && key(o.cell) === key(to)) fail("actor", `${sim.mapId} ${sim.path}: ${who} 가 ${oid} 와 같은 칸 ${key(to)} 에 겹친다`);
    if (who !== "@player" && !sim.hidden && key(sim.player) === key(to)) fail("actor", `${sim.mapId} ${sim.path}: ${who} 가 주인공 칸 ${key(to)} 을 밟는다`);
  }
  if (who === "@player") sim.player = to; else sim.pos[who] = to;
}

let branches = 0;
function run(list: Command[], sim: Sim): void {
  for (let i = 0; i < list.length; i++) {
    const c = list[i]!;
    const look = c.kind === "m2Command" ? (c as { fields?: { target?: string; opacity?: string; reset?: boolean } }).fields : undefined;
    if (look?.target === "player" && look.opacity === "0") sim.hidden = true;
    else if (look?.target === "player" && look.reset) sim.hidden = false;
    if (isFade(c, "fadeOut")) sim.black = true;
    else if (isFade(c, "fadeIn")) sim.black = false;
    else if (c.kind === "transfer") return; // 장면 끝(다른 맵).
    else if (c.kind === "setSwitch" || c.kind === "setVariable") {
      const before = visibleSet(sim);
      if (c.kind === "setSwitch") sim.s.switches[(c as { switchId: string }).switchId] = (c as { value: boolean }).value;
      else {
        const v = c as { variableId: string; op: string; value: number };
        const cur = sim.s.variables[v.variableId] ?? 0;
        sim.s.variables[v.variableId] = v.op === "=" ? v.value : v.op === "+=" ? cur + v.value : cur - v.value;
      }
      checkVisibilityChange(sim, before, c.kind === "setSwitch" ? (c as { switchId: string }).switchId : `${(c as { variableId: string }).variableId}=${sim.s.variables[(c as { variableId: string }).variableId]}`);
    } else if (c.kind === "moveEvent") {
      const m = c as unknown as { eventId: string; route: { moves: { kind: string; dir?: Dir }[] } };
      for (const mv of m.route.moves) if (mv.kind === "move" && mv.dir) step(sim, m.eventId, mv.dir);
    } else if (c.kind === "fork" || c.kind === "choices") {
      const subs = childLists(c);
      if (c.kind === "fork" && subs.length === 1) subs.push([]);
      const rest = list.slice(i + 1);
      subs.forEach((sub, n) => { branches++; const b = clone(sim); b.path = `${sim.path}>${c.kind[0]}${n}`; run([...sub, ...rest], b); });
      return;
    }
  }
}

for (const [mapId, map] of Object.entries(project.maps)) {
  for (const ev of map.events) for (const p of ev.pages ?? []) {
    if ((p.trigger as { kind?: string })?.kind !== "auto") continue;
    const stage = sceneStage(p);
    const player = arrivalFor(mapId, stage);
    if (!player) continue;
    const switches: Record<string, boolean> = {};
    for (const k of p.conditions) if ((k as { kind: string }).kind === "switch") switches[(k as unknown as { switchId: string }).switchId] = (k as unknown as { value: boolean }).value;
    for (const jihu of [0, 9]) {
      const first = (p.commands as Command[]).find((c) => c.kind !== "m2Command" || isFade(c, "fadeIn"));
      const sim: Sim = { s: { variables: { [STAGE_VAR]: stage ?? 0, var_fl_jihu: jihu }, switches: { ...switches }, selfSwitches: {} }, pos: {}, player: { ...player }, black: !!first && isFade(first, "fadeIn"), hidden: false, mapId, path: `${ev.id}[j${jihu}]` };
      run(p.commands as Command[], sim);
    }
  }
}

// ── 4. 말풍선·움직이는 탈것 없음 ──
const all = JSON.stringify(project);
const emotes = (all.match(/"kind":"showEmote"/g) ?? []).length;
if (emotes) fail("bubble", `머리 위 말풍선 아이콘(showEmote) ${emotes}개 — 이 데모는 대화창만 쓴다`);
const bubbles = (all.match(/"container":"(balloon|bark|corner)"/g) ?? []).length;
if (bubbles) fail("bubble", `말풍선·외침 대사 그릇 ${bubbles}개 — 모든 대사는 아래 상자`);
for (const [mapId, map] of Object.entries(project.maps)) {
  const routes = (map as { transit?: { routes?: { vehicles?: string[] }[] } }).transit?.routes ?? [];
  if (routes.some((r) => (r.vehicles ?? []).length)) fail("vehicle", `${mapId}: 움직이는 탈것 행렬 ${routes.length}개`);
  for (const ev of map.events) for (const p of ev.pages ?? []) {
    const mv = (p.movement as { type?: string } | undefined)?.type;
    if (mv && mv !== "fixed" && /veh|car|bike|scooter|bus|truck|택시|오토바이|차/.test(ev.name + JSON.stringify(p.graphic))) fail("vehicle", `${mapId}/${ev.id}: 스스로 움직이는 탈것 이벤트`);
  }
}

// ── 3. 대화창 자리 ──
let texts = 0;
const walkAll = (list: Command[], where: string): void => {
  for (const c of list) {
    if (c.kind === "text") {
      texts++;
      const pos = (c as { position?: string }).position;
      if (pos !== "bottom") fail("dialogue", `${where}: 「${(c as { body: string }).body.slice(0, 24)}」 창 자리 ${pos ?? "(프로젝트 설정)"} — 아래 고정이어야 한다`);
    }
    for (const sub of childLists(c)) walkAll(sub, where);
  }
};
for (const [mapId, map] of Object.entries(project.maps)) for (const ev of map.events) for (const p of ev.pages ?? []) walkAll(p.commands as Command[], `${mapId}/${ev.id}`);
const startMap = project.maps[project.startMapId]!;
const intro = startMap.events.flatMap((e) => e.pages ?? []).find((p) => (p.trigger as { kind?: string })?.kind === "auto" && sceneStage(p) === 0);
const introCmds = (intro?.commands ?? []) as Command[];
const lockAt = introCmds.findIndex((c) => c.kind === "displayTextSettings" && (c as { position?: string }).position === "bottom" && (c as { preventObscuringPlayer?: boolean }).preventObscuringPlayer === false);
const firstText = introCmds.findIndex((c) => c.kind === "text");
if (lockAt < 0 || (firstText >= 0 && lockAt > firstText)) fail("dialogue", "시작 장면이 첫 대사 전에 창 설정(아래·주인공 안 피함)을 잠그지 않는다 — 선택지 창이 위로 뛴다");

console.log(`[first-love probes] transfers=${transfers.length} branches=${branches} texts=${texts} fails=${fails.length}`);
for (const f of fails) console.log(f);
process.exit(fails.length ? 1 : 0);
