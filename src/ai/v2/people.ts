// 조수 v2 — 사람(NPC) 빌더.
//
// 모델은 «누가·어디쯤·무슨 말»만 쓴다(PersonSpec). 칸 번호는 이 파일이 정한다:
//  - 자리 낱말(입구·광장·문 앞·…)을 실제로 걸어 닿는 칸으로 옮기고,
//  - 막힌 칸·문(이동) 칸·외길을 막는 칸은 후보에서 뺀 뒤,
//  - 놓은 칸을 막힌 칸으로 두고 길찾기를 다시 돌려 «전에 닿던 칸에 아직 다 닿는지» 확인한다.
// 놓기는 v1 place_npc, 그림은 graphic.query, 대사는 페이지(첫 만남 / 두 번째부터).
import type { GameEvent, GameMap, Project } from "@/project/types";
import { canMove, isPassable } from "@/project/collision";
import { terrainReachability } from "@/project/terrainReachability";
import type { BuildRun, ContentBuildResult, PersonSpec } from "./types";

export const PEOPLE_CARD =
  "사람(people) 명세: {role,name?,where?,at?,looks?,firstTalk?,laterTalk?,movement?,mapId?}. " +
  "role=문지기·촌장·상인 같은 역할(그림 고르기에도 쓴다). looks=외형 낱말(경비병·노인·소녀·old woman). " +
  "where 낱말: 입구·성문·gate(길이 맵 밖으로 나가는 곳 옆) / 광장·plaza(사람이 모이는 한가운데) / 문 앞·door(집 문 옆) / 생략(시작 지점 근처). " +
  "at:{x,y} 는 정말 필요할 때만 — 막힌 칸이면 가까운 걸어 닿는 칸으로 옮긴다. " +
  "firstTalk=처음 말 걸 때 대사(배열), laterTalk=그 뒤 두 번째부터 대사(배열, 생략하면 같은 말 반복). " +
  "movement: still(기본, 제자리) · wander(배회, 길막 보장 약해짐) · patrol(제자리로 처리). " +
  "빌더가 길을 막지 않는 자리만 고르고, 놓은 뒤 길찾기로 확인한다.";

type Cell = { x: number; y: number };
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

// ───────────────────────── 공간 도우미 (events.ts 도 쓴다) ─────────────────────────

export function findMap(project: Project, mapId: string): GameMap | undefined {
  const maps = project.maps as unknown as Record<string, GameMap> | GameMap[];
  return Array.isArray(maps) ? maps.find((m) => m.id === mapId) : maps[mapId];
}

export function eventsOf(map: GameMap): GameEvent[] {
  return Object.values((map.events ?? []) as unknown as Record<string, GameEvent>);
}

function hasTransfer(ev: GameEvent): boolean {
  const lists: unknown[][] = [ev.commands ?? [], ...((ev.pages ?? []).map((p) => p.commands ?? []))];
  return lists.some((cmds) => cmds.some((c) => (c as { kind?: string }).kind === "transfer"));
}

/** 이동(문) 칸. */
export function transferCells(map: GameMap): Cell[] {
  return eventsOf(map).filter(hasTransfer).map((e) => ({ x: e.x, y: e.y }));
}

/** 사람이 서서 막는 칸: 이동 칸이 아닌 이벤트 칸 전부(그림 있는 이벤트·기존 NPC). */
export function eventBlockers(map: GameMap): Set<number> {
  const set = new Set<number>();
  for (const e of eventsOf(map)) if (!hasTransfer(e)) set.add(e.y * map.width + e.x);
  return set;
}

/** 길찾기: from 에서 걸어 닿는 칸 집합. blocked 칸은 서 있는 사람이라 못 지난다. */
export function walkReach(project: Project, map: GameMap, from: Cell, blocked: ReadonlySet<number>): Uint8Array {
  const w = map.width;
  const seen = new Uint8Array(w * map.height);
  if (blocked.has(from.y * w + from.x) || !isPassable(project, map, from.x, from.y)) return seen;
  const q: number[] = [from.y * w + from.x];
  seen[q[0]!] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (seen[j] || blocked.has(j)) continue;
      if (!canMove(project, map, x, y, nx, ny)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

/** 걷기 시작점: 시작 맵이면 startPos, 아니면 가장 큰 덩어리의 한 칸. */
export function walkStart(project: Project, map: GameMap): Cell {
  if (map.id === project.startMapId && isPassable(project, map, project.startPos.x, project.startPos.y)) {
    return { x: project.startPos.x, y: project.startPos.y };
  }
  const w = map.width;
  const done = new Uint8Array(w * map.height);
  let best: { cell: Cell; n: number } | null = null;
  const none = new Set<number>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < w; x++) {
      if (done[y * w + x] || !isPassable(project, map, x, y)) continue;
      const r = walkReach(project, map, { x, y }, none);
      let n = 0;
      for (let i = 0; i < r.length; i++) if (r[i]) { n++; done[i] = 1; }
      if (!best || n > best.n) best = { cell: { x, y }, n };
    }
  }
  return best?.cell ?? { x: project.startPos.x, y: project.startPos.y };
}

export function dist(a: Cell, b: Cell): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function shortestPathCells(project: Project, map: GameMap, from: Cell, to: Cell, blocked: ReadonlySet<number>): Set<number> {
  const w = map.width;
  const prev = new Int32Array(w * map.height).fill(-2);
  const q: number[] = [from.y * w + from.x];
  prev[q[0]!] = -1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!;
    const x = i % w;
    const y = (i - x) / w;
    if (x === to.x && y === to.y) break;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (prev[j] !== -2 || blocked.has(j) || !canMove(project, map, x, y, nx, ny)) continue;
      prev[j] = i;
      q.push(j);
    }
  }
  const out = new Set<number>();
  let cur = to.y * w + to.x;
  if (prev[cur] === -2) return out;
  while (cur >= 0) { out.add(cur); cur = prev[cur]!; }
  return out;
}

/** 이 칸을 막아도 («막기 전에 닿던 칸» − 이 칸) 전부에 아직 닿는가. */
export function keepsMapConnected(project: Project, map: GameMap, start: Cell, cell: Cell, baseBlocked: ReadonlySet<number>): boolean {
  const w = map.width;
  const before = walkReach(project, map, start, baseBlocked);
  const ci = cell.y * w + cell.x;
  if (start.x === cell.x && start.y === cell.y) return false;
  const blocked = new Set(baseBlocked);
  blocked.add(ci);
  const after = walkReach(project, map, start, blocked);
  for (let i = 0; i < before.length; i++) {
    if (before[i] && i !== ci && !after[i]) return false;
  }
  return true;
}

function openness(reach: Uint8Array, map: GameMap, c: Cell, r = 2): number {
  let n = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (x >= 0 && y >= 0 && x < map.width && y < map.height && reach[y * map.width + x]) n++;
    }
  }
  return n;
}

/**
 * 맵 가장자리에서 걸어 닿는 칸 중 «길로 보이는» 칸. 가장자리 바닥 그림 중 가장 흔한 것(풀밭)이 아닌 칸을 길로 본다.
 * 그런 칸이 없으면 닿는 가장자리 칸 전부.
 */
export function edgeExitCells(map: GameMap, reach: Uint8Array): Cell[] {
  const w = map.width;
  const edge: Cell[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < w; x++) {
      if ((x === 0 || y === 0 || x === w - 1 || y === map.height - 1) && reach[y * w + x]) edge.push({ x, y });
    }
  }
  const lower = (map as unknown as { lowerTiles?: ArrayLike<number> }).lowerTiles;
  if (!lower || edge.length === 0) return edge;
  const count = new Map<number, number>();
  for (const c of edge) count.set(lower[c.y * w + c.x], (count.get(lower[c.y * w + c.x]) ?? 0) + 1);
  let common = -1;
  let top = 0;
  for (const [k, n] of count) if (n > top) { top = n; common = k; }
  const odd = edge.filter((c) => lower[c.y * w + c.x] !== common);
  return odd.length > 0 && odd.length < edge.length ? odd : edge;
}

export interface WhereResolution {
  readonly cell: Cell;
  /** 낱말을 못 알아듣거나 못 찾아 기본 자리로 갔을 때의 한 줄. */
  readonly note?: string;
  /** 그 낱말이 가리킨 기준점(입구면 길이 나가는 가장자리 칸, 문 앞이면 문 칸). */
  readonly anchor?: Cell;
}

type WhereKind = "entrance" | "plaza" | "door" | "default";
function whereKind(word: string | undefined): WhereKind {
  const w = (word ?? "").toLowerCase();
  if (!w) return "default";
  if (/입구|성문|정문|출입구|마을 ?어귀|어귀|entrance|gate|entry/.test(w)) return "entrance";
  if (/광장|plaza|square|중앙|center|centre/.test(w)) return "plaza";
  if (/문 ?앞|문앞|현관|door|doorway/.test(w)) return "door";
  return "default";
}

/**
 * 자리 낱말 → 실제로 걸어 닿는 빈 칸. 못 찾으면 기본 자리(시작 근처) + note.
 * avoid: 이미 쓴 칸(다른 사람·컷신 자리).
 */
export function resolveWhere(
  project: Project,
  map: GameMap,
  word: string | undefined,
  opts: { at?: Cell; avoid?: readonly Cell[]; keepFree?: readonly Cell[] } = {},
): WhereResolution {
  const w = map.width;
  const start = walkStart(project, map);
  const blockers = eventBlockers(map);
  const reach = terrainReachability(project, map, start);
  const transfers = new Set(transferCells(map).map((c) => c.y * w + c.x));
  const avoid = new Set((opts.avoid ?? []).map((c) => c.y * w + c.x));
  const playerStart = project.startMapId === map.id ? project.startPos : null;

  const usable = (c: Cell): boolean => {
    const i = c.y * w + c.x;
    if (c.x < 0 || c.y < 0 || c.x >= w || c.y >= map.height) return false;
    if (!reach[i] || blockers.has(i) || transfers.has(i) || avoid.has(i)) return false;
    if (playerStart && c.x === playerStart.x && c.y === playerStart.y) return false;
    return true;
  };
  const cells: Cell[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) if (usable({ x, y })) cells.push({ x, y });

  const pick = (score: (c: Cell) => number): Cell | undefined => {
    const ranked = cells.map((c) => ({ c, s: score(c) })).sort((a, b) => a.s - b.s);
    let tries = 0;
    for (const { c } of ranked) {
      if (++tries > 80) break;
      if (keepsMapConnected(project, map, start, c, blockers)) return c;
    }
    return undefined;
  };

  // 칸을 직접 줬으면 가장 가까운 쓸 수 있는 칸.
  if (opts.at) {
    const at = opts.at;
    const c = pick((q) => dist(q, at));
    if (c) {
      const moved = c.x !== at.x || c.y !== at.y;
      return { cell: c, note: moved ? `at (${at.x},${at.y}) 은 못 서는 칸이라 (${c.x},${c.y}) 로 옮겼다.` : undefined };
    }
  }

  const kind = whereKind(word);
  if (kind === "entrance") {
    // 길이 맵 밖으로 나가는 곳: 가장자리에서 걸어 닿는 칸(시작에서 가장 가까운 것).
    const edge = edgeExitCells(map, reach);
    const exit = edge.sort((a, b) => dist(a, start) - dist(b, start))[0];
    if (exit) {
      const onRoad = shortestPathCells(project, map, exit, start, blockers);
      const c = pick((q) => {
        const d = dist(q, exit);
        const roadPenalty = onRoad.has(q.y * w + q.x) ? 6 : 0; // 길 위가 아니라 길 옆에 선다
        return Math.abs(d - 2.5) + roadPenalty - Math.min(openness(reach, map, q), 14) * 0.05;
      });
      if (c) return { cell: c, anchor: exit };
    }
  } else if (kind === "plaza") {
    const centre = { x: Math.floor(w / 2), y: Math.floor(map.height / 2) };
    const c = pick((q) => -openness(reach, map, q, 2) + dist(q, centre) * 0.4);
    if (c) return { cell: c, anchor: centre };
  } else if (kind === "door") {
    const doors = transferCells(map).filter((d) => reach[d.y * w + d.x]).sort((a, b) => dist(a, start) - dist(b, start));
    const door = doors[0];
    if (door) {
      const c = pick((q) => {
        const d = dist(q, door);
        const inFront = q.x === door.x && q.y === door.y + 1;
        return Math.abs(d - 2) + (inFront ? 5 : 0) + (d > 4 ? 20 : 0);
      });
      if (c) return { cell: c, anchor: door };
    }
  }

  // 기본: 시작 근처(3~4칸), 트인 곳.
  const c = pick((q) => Math.abs(dist(q, start) - 3.5) - Math.min(openness(reach, map, q), 14) * 0.05);
  if (c) {
    const miss = kind === "default" ? (word ? `자리 낱말 '${word}' 을 몰라` : undefined) : `'${word}' 자리를 이 맵에서 못 찾아`;
    return { cell: c, note: miss ? `${miss} 시작 지점 근처 (${c.x},${c.y}) 에 두었다.` : undefined };
  }
  return { cell: start, note: "걸어 닿는 빈 칸을 못 찾았다." };
}

// ───────────────────────── 그림 질의 ─────────────────────────

// v1 charset 검색은 «경비병·문지기·촌장» 같은 역할 낱말을 모른다(찾지 못하면 거절). 아는 낱말로 바꿔 차례로 시도한다.
const GRAPHIC_SYNONYMS: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  [/경비|문지기|수문장|파수|위병|보초|guard|sentry|gatekeeper/i, ["병사", "guard"]],
  [/촌장|장로|이장|elder|chief|headman/i, ["노인", "elder"]],
  [/기사|knight|paladin/i, ["기사", "knight"]],
  [/상인|장사|점원|merchant|shopkeeper|vendor/i, ["상인", "merchant"]],
  [/여관|주인|innkeeper/i, ["merchant"]],
  [/아이|꼬마|어린이|child|kid/i, ["소년", "child"]],
  [/마법사|wizard|mage/i, ["마법사", "wizard"]],
  [/신부|사제|priest|monk/i, ["priest"]],
  [/왕|king/i, ["king"]],
];

/** looks·role 을 v1 이 알아듣는 질의 순서로 펼친다(중복 제거, 마지막은 주민). */
export function graphicQueries(looks: string | undefined, role: string | undefined): string[] {
  const out: string[] = [];
  const add = (q: string | undefined): void => {
    const t = (q ?? "").trim();
    if (t && !out.includes(t)) out.push(t);
  };
  for (const word of [looks, role]) {
    add(word);
    for (const [re, alts] of GRAPHIC_SYNONYMS) if (word && re.test(word)) for (const a of alts) add(a);
  }
  add("villager");
  return out;
}

// ───────────────────────── 사람 놓기 ─────────────────────────

function cleanLines(lines: readonly string[] | undefined): string[] {
  return (lines ?? []).map((s) => String(s).trim()).filter(Boolean);
}

export function buildPeople(run: BuildRun, people: readonly PersonSpec[], mapId?: string): ContentBuildResult {
  const warnings: string[] = [];
  const eventIds: { mapId: string; eventId: string }[] = [];
  const mapIds = new Set<string>();
  const used: Cell[] = [];
  const firstCall = run.calls.length;
  let failed = 0;

  for (const person of people) {
    const targetMapId = person.mapId ?? mapId ?? run.ctx.currentMapId ?? run.ctx.project.startMapId;
    const label = person.name ?? person.role;
    const map = findMap(run.ctx.project, targetMapId);
    if (!map) {
      warnings.push(`${label}: 맵 '${targetMapId}' 이 없다.`);
      failed++;
      continue;
    }
    const where = resolveWhere(run.ctx.project, map, person.where, { at: person.at, avoid: used });
    if (where.note) warnings.push(`${label}: ${where.note}`);
    const cell = where.cell;

    const first = cleanLines(person.firstTalk);
    const later = cleanLines(person.laterTalk);
    const pages: Record<string, unknown>[] = [];
    if (first.length > 0 && later.length > 0) {
      pages.push({ name: "첫 만남", lines: first, commands: [{ kind: "setSelfSwitch", key: "A", value: true }] });
      pages.push({ name: "다시 말 걸면", lines: later, conditions: [{ kind: "selfSwitch", key: "A", value: true }] });
    } else if (first.length > 0 || later.length > 0) {
      pages.push({ name: "대화", lines: first.length > 0 ? first : later });
    }

    const movement = person.movement === "wander" ? "random" : "fixed";
    if (person.movement === "wander") warnings.push(`${label}: wander 는 걸어 다니다 길목에 설 수 있어 «길을 막지 않는다» 보장이 약해진다.`);
    if (person.movement === "patrol") warnings.push(`${label}: patrol 은 v1 에 순찰 경로 도구가 없어 제자리(fixed)로 두었다.`);

    const baseArgs: Record<string, unknown> = { mapId: targetMapId, name: label, x: cell.x, y: cell.y, movement };
    if (pages.length > 0) baseArgs.pages = pages;
    const queries = graphicQueries(person.looks, person.role);

    let result = undefined as ReturnType<BuildRun["call"]> | undefined;
    const missed: string[] = [];
    for (const q of queries) {
      result = run.call("place_npc", { ...baseArgs, graphic: { query: q } });
      if (result.ok) {
        if (missed.length > 0) warnings.push(`${label}: 그림 질의 ${missed.map((m) => `'${m}'`).join(", ")} 은(는) 없어 '${q}' 로 놓았다.`);
        break;
      }
      missed.push(q);
    }
    if (!result?.ok && missed.length > 0) warnings.push(`${label}: 그림 질의 ${missed.map((m) => `'${m}'`).join(", ")} 모두 실패(${String(result?.summary).slice(0, 80)}).`);
    if (!result?.ok) {
      result = run.call("place_npc", baseArgs);
      if (result.ok) warnings.push(`${label}: 그림을 못 골라 도구 기본 그림으로 놓았다.`);
    }
    if (!result.ok) {
      warnings.push(`${label}: 놓기 실패 — ${String(result.summary).slice(0, 160)}`);
      failed++;
      continue;
    }
    for (const w of result.warnings ?? []) warnings.push(`${label}: ${w}`);
    const data = (result.data ?? {}) as { eventId?: string; x?: number; y?: number; adjusted?: boolean };
    const placed = { x: data.x ?? cell.x, y: data.y ?? cell.y };
    used.push(placed);
    mapIds.add(targetMapId);
    if (data.eventId) eventIds.push({ mapId: targetMapId, eventId: data.eventId });

    // 놓은 뒤 확인: 이 NPC 칸을 막고도 전에 닿던 칸에 다 닿는가.
    const after = findMap(run.ctx.project, targetMapId);
    if (after && movement === "fixed") {
      const blockers = eventBlockers(after);
      blockers.delete(placed.y * after.width + placed.x);
      const start = walkStart(run.ctx.project, after);
      if (!keepsMapConnected(run.ctx.project, after, start, placed, blockers)) {
        warnings.push(`${label}: (${placed.x},${placed.y}) 에 놓고 보니 길을 막는다 — 도구가 칸을 옮겼을 수 있다. 자리를 다시 정해야 한다.`);
      }
    }
  }

  const ok = failed === 0 && eventIds.length > 0;
  return {
    ok,
    mapIds: [...mapIds],
    summary: ok
      ? `사람 ${eventIds.length}명 놓음: ${people.map((p) => p.name ?? p.role).join("·")}`
      : `사람 ${people.length}명 중 ${failed}명 실패`,
    warnings,
    missingArt: [],
    calls: run.calls.slice(firstCall),
    eventIds,
  };
}
