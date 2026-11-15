// src/editor/tools/dungeonGateAudit.ts
// 레버로 여는 길막이(쇠창살문·막힌 바위·걷힌 다리)가 «말한 대로 갈라놓는가» 를 지은 맵에서 물 채우기로 확인한다.
//
// 왜(2026-11-15 버들항 던전): placeLeverGate 는 계획 자리(population.lockedGate)를 그대로 믿고 놓았다 — 고리 통로로 돌아가는 관문,
// 관문 너머 방에 선 레버가 나올 수 있었고, 이벤트로 막는 «막힌 바위» 는 판정(gatesThatOpenNothing — 타일 바꾸기만 봄)도 못 봤다.
// 여기 한 벌을 시공기(놓은 뒤 확인·되돌리기), 채우기(상자·쉼터가 레버 길을 끊지 않게), 판정, 시험·여러 씨앗 훑기가 같이 쓴다.
//
// 관문 = 한 이벤트(레버)가 스위치를 켜고, 그 스위치로 (a) 같은 맵의 다른 이벤트가 막는 페이지에서 비키는 페이지로 넘어가거나
// (b) 레버 자신의 changeTile 이 못 걷던 칸을 걷는 칸으로 바꾸는 것. 닫힘 = 지금 맵 + 길막이 칸 막힘, 열림 = 타일 바꾼 맵 + 길막이 없음.

import { isPassable } from "@/project/collision";
import { eventAlwaysBlocks } from "@/project/eventPassageBlock";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";

type Pt = { x: number; y: number };
type Obj = Record<string, unknown>;

export type GateIssueCode = "lever-unreachable" | "gate-opens-nothing";
export interface LeverGate {
  readonly switchId: string;
  readonly lever: GameEvent;
  /** 스위치가 꺼져 있을 때 막고 켜지면 비키는 이벤트(쇠창살·바위·문간). */
  readonly blockers: readonly GameEvent[];
  /** 레버가 바꾸는 칸 가운데 못 걷던 칸이 걷는 칸이 되는 것(다리). */
  readonly freed: readonly Pt[];
  /** 열린 뒤의 맵(타일 바꾼 사본). */
  readonly opened: GameMap;
}
export interface GateIssue { readonly code: GateIssueCode; readonly switchId: string; readonly leverId: string; readonly message: string }

const pageBlocks = (page: EventPage | undefined): boolean => !!page && (page.priority ?? "same") === "same" && (page.overlapForbidden ?? true);

function walk(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const n of node) walk(n, visit); return; }
  if (!node || typeof node !== "object") return;
  const o = node as Obj;
  if (typeof o.kind === "string") visit(o);
  for (const v of Object.values(o)) if (v && typeof v === "object") walk(v, visit);
}

const switchCond = (page: EventPage, sw: string): boolean => ((page.conditions ?? []) as unknown as Obj[]).some((c) => c.kind === "switch" && String(c.switchId) === sw && c.value !== false);

/**
 * 스위치 sw 로 길을 비키는 길막이인가: 스위치 조건이 없는 페이지는 막고(겹침 금지), 스위치 조건 페이지는 막지 않고 명령이 없다.
 * (쓰러뜨리면 사라지는 적·말을 걸면 비키는 인물은 스위치를 자기가 켜거나 열린 페이지에 할 일이 있다 — 길막이로 치지 않는다.)
 */
export function isSwitchBlocker(ev: GameEvent, sw: string): boolean {
  const pages = ev.pages ?? [];
  const closed = pages.filter((p) => !switchCond(p, sw)), open = pages.filter((p) => switchCond(p, sw));
  if (!closed.length || !open.length) return false;
  if (!closed.every((p) => pageBlocks(p) && p.overlapForbidden === true)) return false;
  if (!open.every((p) => !pageBlocks(p) && !(p.commands ?? []).length)) return false;
  let sets = false;
  walk(pages, (cmd) => { if (cmd.kind === "setSwitch" && String(cmd.switchId) === sw) sets = true; });
  return !sets;
}

/** 이 맵의 레버 관문들(스위치마다 하나). */
export function leverGates(project: Project, map: GameMap): LeverGate[] {
  const out: LeverGate[] = [];
  const seen = new Set<string>();
  for (const lever of map.events ?? []) {
    const switches = new Set<string>();
    const edits: { layer: "lower" | "upper"; x: number; y: number; tile: number }[] = [];
    walk(lever.pages, (cmd) => {
      if (cmd.kind === "setSwitch" && cmd.value !== false && cmd.switchId !== undefined) switches.add(String(cmd.switchId));
      if (cmd.kind === "changeTile" && (cmd.mapId === undefined || cmd.mapId === map.id) && Number.isInteger(cmd.x) && Number.isInteger(cmd.y) && Number.isInteger(cmd.tile)) {
        const x = cmd.x as number, y = cmd.y as number;
        if (x >= 0 && y >= 0 && x < map.width && y < map.height) edits.push({ layer: cmd.layer === "upper" ? "upper" : "lower", x, y, tile: cmd.tile as number });
      }
    });
    for (const sw of switches) {
      if (seen.has(sw)) continue;
      const blockers = (map.events ?? []).filter((e) => e.id !== lever.id && isSwitchBlocker(e, sw));
      const lowerTiles = map.lowerTiles.slice(), upperTiles = map.upperTiles.slice();
      for (const e of edits) (e.layer === "upper" ? upperTiles : lowerTiles)[e.y * map.width + e.x] = e.tile;
      const opened: GameMap = edits.length ? { ...map, lowerTiles, upperTiles } : map;
      const freedKeys = new Set(edits.filter((e) => !isPassable(project, map, e.x, e.y) && isPassable(project, opened, e.x, e.y)).map((e) => e.y * map.width + e.x));
      if (!blockers.length && !freedKeys.size) continue;
      seen.add(sw);
      out.push({ switchId: sw, lever, blockers, freed: [...freedKeys].map((i) => ({ x: i % map.width, y: Math.floor(i / map.width) })), opened });
    }
  }
  return out;
}

/** 던전 입구 표식(dungeon-entrance 의 land:/gate: 태그)에서 플레이어가 서는 칸. */
export function dungeonStartCell(map: GameMap): Pt | undefined {
  for (const loc of map.locations ?? []) {
    const tags = loc.tags ?? [];
    if (!tags.includes("dungeon-entrance")) continue;
    for (const prefix of ["land:", "gate:"]) {
      const t = tags.find((s) => s.startsWith(prefix));
      const m = t ? /^(\d+),(\d+)$/u.exec(t.slice(prefix.length)) : null;
      if (m) return { x: Number(m[1]), y: Number(m[2]) };
    }
  }
  return undefined;
}

/** start 에서 걸어 닿는 칸(타일 통행, blocked 칸 제외). start 가 막힌 칸이어도 거기서 출발한다(계단 칸). */
export function floodFrom(project: Project, map: GameMap, start: Pt, blocked: ReadonlySet<number>): Uint8Array {
  const W = map.width, H = map.height, seen = new Uint8Array(W * H);
  if (start.x < 0 || start.y < 0 || start.x >= W || start.y >= H) return seen;
  const q = [start.y * W + start.x]; seen[q[0]!] = 1;
  for (let k = 0; k < q.length; k += 1) {
    const i = q[k]!, x = i % W, y = (i - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, ni = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ni] || blocked.has(ni) || !isPassable(project, map, nx, ny)) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  return seen;
}

/** 그 칸에 서거나 네 이웃에서 마주 볼 수 있는가. */
export const touchable = (map: GameMap, seen: Uint8Array, p: Pt): boolean =>
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const x = p.x + dx!, y = p.y + dy!; return x >= 0 && y >= 0 && x < map.width && y < map.height && seen[y * map.width + x] === 1; });

export interface GateReach { readonly gate: LeverGate; readonly closed: Uint8Array; readonly open: Uint8Array; readonly gateCells: ReadonlySet<number> }

/** 관문마다 닫힘·열림 물 채우기. 늘 막는 이벤트(상자·결정·바닥 레버)는 두 상태 모두 벽으로 친다. */
export function gateReaches(project: Project, map: GameMap, start: Pt): GateReach[] {
  const W = map.width;
  const gates = leverGates(project, map);
  if (!gates.length) return [];
  const solid = new Set((map.events ?? []).filter((e) => eventAlwaysBlocks(e)).map((e) => e.y * W + e.x));
  solid.delete(start.y * W + start.x);
  return gates.map((gate) => {
    const gateCells = new Set([...gate.blockers.map((e) => e.y * W + e.x), ...gate.freed.map((p) => p.y * W + p.x)]);
    // 다른 관문은 열렸다고 본다(관문 둘이 서로를 가두는 경우는 lever-unreachable 이 각각에서 잡는다 — 닫힘에는 다른 관문의 길막이도 막는다)
    const others = new Set(gates.filter((g) => g !== gate).flatMap((g) => g.blockers.map((e) => e.y * W + e.x)));
    const closed = floodFrom(project, map, start, new Set([...solid, ...gateCells, ...others]));
    const open = floodFrom(project, gate.opened, start, solid);
    return { gate, closed, open, gateCells };
  });
}

/**
 * 이 층의 레버 관문 결함. 빈 목록 = 관문마다 (1) 닫힌 채로 레버에 닿고 (2) 닫히면 못 가던 곳이 열면 열린다.
 * start 를 안 주면 던전 입구 표식에서 읽는다(표식이 없으면 검사하지 않는다).
 */
export function auditLeverGates(project: Project, map: GameMap, start: Pt | undefined = dungeonStartCell(map)): GateIssue[] {
  if (!start) return [];
  const out: GateIssue[] = [];
  for (const { gate, closed, open, gateCells } of gateReaches(project, map, start)) {
    const at = gate.blockers.length ? gate.blockers.map((e) => `(${e.x},${e.y})`).slice(0, 3).join("·") : gate.freed.map((p) => `(${p.x},${p.y})`).slice(0, 3).join("·");
    if (!touchable(map, closed, gate.lever)) {
      out.push({ code: "lever-unreachable", switchId: gate.switchId, leverId: gate.lever.id, message: `${map.name}의 「${gate.lever.name || gate.lever.id}」(${gate.lever.id}, ${gate.lever.x},${gate.lever.y})에 길막이 ${at} 를 열기 전에는 걸어 닿지 못한다 — 여는 장치가 제가 여는 길 너머에 있다` });
      continue;
    }
    let fresh = 0;
    for (let i = 0; i < open.length; i += 1) if (open[i] && !closed[i] && !gateCells.has(i)) fresh += 1;
    if (!fresh) out.push({ code: "gate-opens-nothing", switchId: gate.switchId, leverId: gate.lever.id, message: `${map.name}의 「${gate.lever.name || gate.lever.id}」(${gate.lever.id})가 길막이 ${at} 를 열지만 그 너머는 이미 다른 길로 걸어 닿는다 — 장치를 안 써도 끝까지 간다` });
  }
  return out;
}

export interface FloorGateReport { readonly gates: number; readonly issues: readonly GateIssue[]; /** 관문을 다 연 뒤에도 닿지 못하는 이벤트 id. */ readonly sealed: readonly string[] }

/** 층 하나의 관문 보고(시험·훑기용): 관문 결함 + 관문을 모두 연 뒤에도 걸어 닿지 못하는 이벤트. */
export function floorGateReport(project: Project, map: GameMap, start: Pt | undefined = dungeonStartCell(map)): FloorGateReport {
  if (!start) return { gates: 0, issues: [], sealed: [] };
  const gates = leverGates(project, map);
  const issues = auditLeverGates(project, map, start);
  if (!gates.length) return { gates: 0, issues, sealed: [] };
  const lowerTiles = map.lowerTiles.slice(), upperTiles = map.upperTiles.slice();
  for (const g of gates) for (let i = 0; i < lowerTiles.length; i += 1) {
    if (g.opened.lowerTiles[i] !== map.lowerTiles[i]) lowerTiles[i] = g.opened.lowerTiles[i]!;
    if (g.opened.upperTiles[i] !== map.upperTiles[i]) upperTiles[i] = g.opened.upperTiles[i]!;
  }
  const all: GameMap = { ...map, lowerTiles, upperTiles };
  const W = map.width;
  const solid = new Set((map.events ?? []).filter((e) => eventAlwaysBlocks(e)).map((e) => e.y * W + e.x));
  solid.delete(start.y * W + start.x);
  const open = floodFrom(project, all, start, solid);
  const sealed = (map.events ?? []).filter((e) => !touchable(map, open, e)).map((e) => e.id);
  return { gates: gates.length, issues, sealed };
}

/**
 * 나중에 놓은 것(상자·쉼터 결정처럼 늘 막는 이벤트)이 레버로 가는 길을 끊었으면 그 이벤트를 걷는다 — 후보 id 를 하나씩 빼 보며 결함이 사라지는 것만.
 * 걷은 id 를 돌려준다. 후보 밖의 원인으로 남은 결함은 그대로다(부르는 쪽이 auditLeverGates 로 다시 본다).
 */
export function dropGateBreakers(project: Project, map: GameMap, candidateIds: readonly string[], start: Pt | undefined = dungeonStartCell(map)): string[] {
  if (!start || !leverGates(project, map).length) return [];
  const dropped: string[] = [];
  let issues = auditLeverGates(project, map, start).length;
  for (const id of candidateIds) {
    if (!issues) break;
    const at = map.events.findIndex((e) => e.id === id);
    if (at < 0) continue;
    const [ev] = map.events.splice(at, 1);
    const left = auditLeverGates(project, map, start).length;
    if (left < issues) { issues = left; dropped.push(id); } else map.events.splice(at, 0, ev!);
  }
  return dropped;
}

/** 입구에서 걸어 닿는 칸 — 늘 막는 이벤트(상자·결정)는 벽으로 친다. 놓기 전후를 견줄 때 쓴다(keepsReach). */
export function solidFlood(project: Project, map: GameMap, start: Pt): Uint8Array {
  const W = map.width;
  const solid = new Set((map.events ?? []).filter((e) => eventAlwaysBlocks(e)).map((e) => e.y * W + e.x));
  solid.delete(start.y * W + start.x);
  return floodFrom(project, map, start, solid);
}

/**
 * 무언가를 놓은 뒤에도 전에 닿던 곳에 다 닿는가 — 전에 닿던 칸 가운데 지금도 걸을 수 있고 늘 막는 이벤트가 서지 않은 칸은 모두 닿아야 한다.
 * 왜(2026-11-15): 채우기의 쉼터 결정(받침 위 수정 키트 — 막힌 타일)이 한 칸 목에 서 화산 굴(씨앗 2)의 입구 쪽과 나머지 반이 끊겼다 — 레버·보스·상자 전부 못 닿는 층.
 */
export function keepsReach(project: Project, map: GameMap, start: Pt, before: Uint8Array): boolean {
  const W = map.width, now = solidFlood(project, map, start);
  const solid = new Set((map.events ?? []).filter((e) => eventAlwaysBlocks(e)).map((e) => e.y * W + e.x));
  for (let i = 0; i < before.length; i += 1) {
    if (!before[i] || now[i] || solid.has(i)) continue;
    if (isPassable(project, map, i % W, (i - (i % W)) / W)) return false;
  }
  return true;
}
