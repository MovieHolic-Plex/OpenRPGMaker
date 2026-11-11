// 걸어 닿지 못하는 자리 고치기 — 조사 이벤트를 닿는 칸 옆으로 옮기고(repairEventReach), 이동 칸 앞 길·대상 앞 칸을 비우고, 몰린 사람을 흩는다. 닿기 읽기는 judge/eventReach.ts.
import { canMove, isPassable } from "@/project/collision";
import { playerAnchors } from "@/editor/tools/transferReachability";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { PERSON_SPOT_BAD, personSpotContext, personSpotCost } from "./personSpot";
import { objectAt, tileLabel } from "./cells";
import { objectBaseLabel, objectClusterAt } from "@/project/objectFootprint";
import type { BuildRun } from "../shared/types";
import { Cell, DIRS, eventBlocks, anchorsOf, reachFrom, blockersOf, bodyReached, nextTo, reachableCells, unreachableEvents, isDoorName, doorArtCells, baseLabel, hostWords, itemTileWords, objectCells, singleTileObject, invisibleEvent } from "../judge/eventReach";

export interface ReachRepair { readonly moved: string[]; readonly stuck: string[] }

/**
 * 이벤트들(순서 = 고리 순서)을 걸어 가 말을 걸 수 있게 고친다.
 *  1) 문 이름 이벤트는 그림 문 칸으로.
 *  2) 이름이 가리키는 물건(책상·책장·벽난로·금고·그림·서랍·상자…)이 맵에 있으면 그 물건 칸 위로 — 앞(아래)에 설 칸이 있는 칸이 먼저.
 *  3) 그래도 막혔거나 길목을 막으면 가까운 닿는 빈 바닥으로(물건 옆 우선).
 *  4) 맞는 물건이 없고 그림 없는 이벤트면 그 명사의 1칸 물건 그림을 칩셋에서 골라 이벤트 칸에 깐다.
 * 다른 이벤트(목록 밖 포함)를 못 닿게 만드는 자리는 고르지 않는다.
 */
export function repairEventReach(run: BuildRun, mapId: string, eventIds: readonly string[], hostsFor?: ReadonlyMap<string, readonly (readonly string[])[]>): ReachRepair {
  const moved: string[] = [];
  const stuck: string[] = [];
  // 두 바퀴 — 앞 이벤트가 옮겨 가야 뒤 이벤트의 물건 앞이 열리기도 한다(deepseek: 책장 앞 일기장이 벽난로 앞 구석을 막았다).
  for (const pass of [0, 1]) for (const id of eventIds) {
    if (pass === 1) stuck.length = 0;
    const project = run.ctx.project;
    const map = project.maps[mapId];
    const ev = map?.events.find((e) => e.id === id);
    if (!map || !ev) continue;
    const anchors = anchorsOf(project, map);
    if (!anchors.length) continue;
    const w = map.width;
    const othersBlocked = blockersOf(map, id);
    const free = reachFrom(project, map, anchors, othersBlocked);
    const others = (map.events ?? []).filter((e) => e.id !== id);
    const othersOk = (reach: Uint8Array) => others.every((o) => !free[o.y * w + o.x] && !nextTo(map, free, o) ? true : nextTo(map, reach, o) || !!reach[o.y * w + o.x]);
    // 길목을 막아 잃는 칸이 있어도 그 안에 이벤트가 없으면 괜찮다(막다른 구석 앞 책장) — 다른 이벤트를 못 닿게 하면 안 된다.
    const judge = (c: Cell): boolean => {
      const i = c.y * w + c.x;
      const blocked = new Set(othersBlocked);
      if (eventBlocks(ev)) blocked.add(i);
      const reach = reachFrom(project, map, anchors, blocked);
      if (!nextTo(map, reach, c) && !reach[i]) return false;
      return othersOk(reach);
    };
    const name = String((ev as { name?: string }).name ?? "");
    const here = { x: ev.x, y: ev.y };
    const taken = new Set(others.map((e) => e.y * w + e.x));
    const anchorSet = new Set(anchors.map((a) => a.y * w + a.x));
    const dist = (c: Cell) => Math.abs(c.x - ev.x) + Math.abs(c.y - ev.y);
    const usable = (c: Cell) => !taken.has(c.y * w + c.x) && !anchorSet.has(c.y * w + c.x);
    let target: Cell | undefined;
    let why = "";
    // 1) 문
    const door = isDoorName(name);
    const doors = door ? doorArtCells(project, map) : [];
    if (door && doors.length) {
      if (doors.some((d) => d.x === ev.x && d.y === ev.y) && judge(here)) continue;
      target = [...doors].sort((a, b) => dist(a) - dist(b)).find((c) => usable(c) && judge(c));
      if (target) why = " 문 그림 칸";
    }
    // 2) 이름이 가리키는 물건
    let host = false;
    if (!target && !door) {
      for (const words of hostsFor?.get(id) ?? hostWords(name)) {
        const cells = objectCells(project, map, words);
        if (!cells.size) continue;
        host = true;
        if (cells.has(ev.y * w + ev.x) && judge(here)) break; // 이미 그 물건 위
        // 물건 칸마다: 앞(아래) 칸에 닿으면 0, 옆 1, 뒤 2 + 원래 자리와의 거리.
        const ranked: { c: Cell; s: number }[] = [];
        for (const i of cells) {
          const c = { x: i % w, y: Math.floor(i / w) };
          if (!usable(c)) continue;
          const side = (dx: number, dy: number) => { const x = c.x + dx, y = c.y + dy; return x >= 0 && y >= 0 && x < w && y < map.height && !!free[y * w + x] && !cells.has(y * w + x); };
          const face = side(0, 1) ? 0 : side(-1, 0) || side(1, 0) ? 1 : side(0, -1) ? 2 : -1;
          if (face < 0) continue;
          ranked.push({ c, s: face * 4 + dist(c) * 0.2 });
        }
        ranked.sort((a, b) => a.s - b.s);
        target = ranked.slice(0, 60).find(({ c }) => judge(c))?.c;
        if (target) { why = ` ${baseLabel(tileLabel(project, map, (map as unknown as Record<string, ArrayLike<number>>).upperTiles?.[target.y * w + target.x]) || tileLabel(project, map, (map as unknown as Record<string, ArrayLike<number>>).upperOverlayTiles?.[target.y * w + target.x])) || words[0]} 위`; break; }
      }
      if (host && !target && judge(here)) continue;
    }
    // 3) 막혔거나 길목 — 가까운 닿는 빈 바닥(물건 옆 우선).
    if (!target && !judge(here)) {
      const cands: { c: Cell; s: number }[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!free[i] || !usable({ x, y })) continue;
        const besideThing = DIRS.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < map.height && (!isPassable(project, map, nx, ny) || objectAt(map, { x: nx, y: ny })); });
        cands.push({ c: { x, y }, s: dist({ x, y }) + (besideThing ? 0 : 3) });
      }
      cands.sort((a, b) => a.s - b.s);
      target = cands.slice(0, 80).find(({ c }) => judge(c))?.c;
      if (!target) { stuck.push(`${name || id}(${ev.x},${ev.y})`); continue; }
    }
    if (target) {
      const res = run.call("move_event", { mapId, eventId: id, x: target.x, y: target.y });
      if (res.ok) moved.push(`${name || id} (${ev.x},${ev.y})→(${target.x},${target.y})${why}`);
      else { stuck.push(`${name || id}: ${String(res.summary).slice(0, 120)}`); continue; }
    }
    // 4) 맞는 물건이 맵에 없고 그림도 없으면 — 그 명사의 1칸 물건 그림을 이벤트 칸(빈 바닥)에 깐다.
    if (!host && !door && !hostsFor?.has(id)) {
      const now = run.ctx.project.maps[mapId]!.events.find((e) => e.id === id)!;
      const cellMap = run.ctx.project.maps[mapId]!;
      const words = itemTileWords(name);
      if (words.length && invisibleEvent(now) && !objectAt(cellMap, now) && isPassable(run.ctx.project, cellMap, now.x, now.y)) {
        const art = singleTileObject(run.ctx.project, cellMap, words);
        if (art) {
          const copy = structuredClone(cellMap);
          (copy.upperTiles as number[])[now.y * copy.width + now.x] = art.tile;
          run.ctx.project = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: copy } } as Project;
          moved.push(`${name || id} (${now.x},${now.y})에 「${art.label}」 그림`);
        }
      }
    }
  }
  return { moved, stuck };
}

// ── 이동 칸 앞 비우기 ─────────────────────────────────────────────────────────────
// 2026-10-28 standin jrpg 「버들마을과 마왕의 동굴」: 시작 컷신에서 소녀가 주인공에게 다가와(approach @player) 동굴 입구 착지 칸 (9,7)
// 바로 앞 (9,8)에 섰다. 자동 플레이는 동굴 입구까지 걷다 그 NPC 에 막혀 엔딩에 못 갔다. 규칙:
//  - 이 맵으로 들어오는 착지 칸과 그 둘레 한 칸, 이 맵의 이동 이벤트(문·입구) 둘레 한 칸에는 막는 이벤트가 서 있으면 안 된다.
//  - 컷신에서 주인공에게 다가가는 이벤트는 «다가간 끝 칸»도 같은 규칙을 따른다(끝 칸은 BFS 최단 거리의 주인공 옆 칸들).
// 어기면 그 이벤트의 자리를 가장 가까운, 위 칸들이 아닌 닿는 빈 바닥으로 옮긴다(다른 이벤트를 못 닿게 하는 자리는 고르지 않는다).

function hasTransfer(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasTransfer);
  if (!node || typeof node !== "object") return false;
  const r = node as Record<string, unknown>;
  if (r.kind === "transfer") return true;
  return Object.values(r).some((v) => v && typeof v === "object" && hasTransfer(v));
}

/** 이 맵 이벤트들의 이동 명령 중 «id 가 주인공에게 다가가기»가 있나. */
function approachesPlayer(map: GameMap, id: string): boolean {
  let hit = false;
  const visit = (node: unknown): void => {
    if (hit || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    const r = node as Record<string, unknown>;
    if (r.kind === "moveEvent" && r.eventId === id) {
      const moves = ((r.route as { moves?: unknown[] } | undefined)?.moves ?? []) as Record<string, unknown>[];
      if (moves.some((m) => m.kind === "approach" && (m.target === "@player" || m.target === "player"))) { hit = true; return; }
    }
    for (const v of Object.values(r)) if (v && typeof v === "object") visit(v);
  };
  for (const ev of map.events ?? []) visit(ev.pages ?? ev.commands);
  return hit;
}

/** from 에서 걸어 player 옆에 닿는 최단 칸들(못 닿으면 빈 목록). */
function approachEnds(project: Project, map: GameMap, from: Cell, player: Cell): Cell[] {
  const w = map.width;
  const near = new Set(DIRS.map(([dx, dy]) => (player.y + dy) * w + player.x + dx).filter((i) => i >= 0 && i < w * map.height));
  const dist = new Int32Array(w * map.height).fill(-1);
  const pIdx = player.y * w + player.x;
  const q = [from.y * w + from.x];
  dist[q[0]!] = 0;
  let best = -1;
  const out: Cell[] = [];
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!, x = i % w, y = (i - x) / w;
    if (best >= 0 && dist[i]! > best) break;
    if (near.has(i)) { best = dist[i]!; out.push({ x, y }); continue; }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (dist[j]! >= 0 || j === pIdx || !canMove(project, map, x, y, nx, ny)) continue;
      dist[j] = dist[i]! + 1;
      q.push(j);
    }
  }
  return out;
}

/**
 * 착지점마다 따로 걸어 본 기준(base 막힘)에 대어, blocked 막힘에서 어느 착지점이든 닿던 이벤트를 잃는가.
 * 앵커를 한데 모은 닿기(reachFrom(anchors))는 잠긴 문 너머에서 돌아오는 착지점이 막힌 쪽을 채워 하나뿐인 목을 못 본다.
 */
function anchorSplitter(project: Project, map: GameMap, anchors: readonly Cell[], base: ReadonlySet<number>, events: readonly GameEvent[]) {
  const perAnchor = anchors.map((a) => reachFrom(project, map, [a], base));
  return (blocked: ReadonlySet<number>, onMap: GameMap = map, onProject: Project = project) => anchors.some((a, k) => {
    const now = reachFrom(onProject, onMap, [a], blocked);
    return events.some((o) => !bodyReached(onMap, now, onMap.events.find((e) => e.id === o.id) ?? o) && bodyReached(map, perAnchor[k]!, o));
  });
}

/** 모든 페이지가 길을 막는가(어느 페이지에서든 비켜나면 이야기로 길을 여는 문지기일 수 있다). */
function alwaysBlocks(ev: GameEvent): boolean {
  const pages = ev.pages ?? [];
  return pages.length > 0 && pages.every((p) => eventBlocks({ ...ev, pages: [p] } as GameEvent));
}

/** 착지 칸·그 둘레, 이동 이벤트 둘레 — 막는 이벤트가 서면 안 되는 칸들. */
function transferLaneCells(project: Project, map: GameMap): Set<number> {
  const w = map.width;
  const out = new Set<number>();
  const around = (c: Cell, self: boolean) => {
    if (self) out.add(c.y * w + c.x);
    for (const [dx, dy] of DIRS) { const x = c.x + dx, y = c.y + dy; if (x >= 0 && y >= 0 && x < w && y < map.height && isPassable(project, map, x, y)) out.add(y * w + x); }
  };
  const start = project.startMapId === map.id ? project.startPos : undefined;
  for (const a of playerAnchors(project, map)) if (!(start && a.x === start.x && a.y === start.y)) around(a, true);
  for (const ev of map.events ?? []) if (hasTransfer(ev.pages ?? ev.commands)) around(ev, false);
  return out;
}

/** 이동 칸 앞을 막는(또는 컷신에서 다가가 막게 되는) 이벤트를 옆으로 옮긴다. */
/** 이벤트 칸(또는 그 둘레의 닿는 칸)에서 닿는 칸들(free)을 걸어 몇 걸음인가 — 못 가면 -1. */
export function walkSteps(map: GameMap, free: Uint8Array, from: Cell): Int32Array {
  const w = map.width, h = map.height;
  const out = new Int32Array(w * h).fill(-1);
  const queue: number[] = [];
  const seed = (x: number, y: number, d: number) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = y * w + x; if (out[i] !== -1 || !free[i]) return; out[i] = d; queue.push(i); };
  seed(from.x, from.y, 0);
  if (!queue.length) for (const [dx, dy] of DIRS) seed(from.x + dx, from.y + dy, 1);
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]!, x = i % w, y = Math.floor(i / w);
    for (const [dx, dy] of DIRS) seed(x + dx, y + dy, out[i]! + 1);
  }
  return out;
}

export function clearTransferLanes(run: BuildRun, mapId: string): ReachRepair {
  const moved: string[] = [];
  const stuck: string[] = [];
  const first = run.ctx.project.maps[mapId];
  if (!first) return { moved, stuck };
  for (const id of first.events.map((e) => e.id)) {
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const ev = map.events.find((e) => e.id === id);
    if (!ev || !eventBlocks(ev) || hasTransfer(ev.pages ?? ev.commands)) continue;
    const lanes = transferLaneCells(project, map);
    if (!lanes.size) continue;
    const w = map.width;
    const start = project.startMapId === mapId && project.startPos ? { x: project.startPos.x, y: project.startPos.y } : undefined;
    const approach = !!start && approachesPlayer(map, id);
    const bad = (c: Cell) => lanes.has(c.y * w + c.x) || (approach && approachEnds(project, map, c, start!).some((e) => lanes.has(e.y * w + e.x)));
    const anchors = anchorsOf(project, map);
    const othersBlocked = blockersOf(map, id);
    const free = reachFrom(project, map, anchors, othersBlocked);
    const others = map.events.filter((e) => e.id !== id);
    // 하나뿐인 목: 이 이벤트가 서 있어서 못 닿는(빼면 닿는) 다른 이벤트가 있으면 비켜 세운다 — 출구 둘레만 보면 놓친다.
    // 2026-10-29 vm6 flash 추리: 마부 한스(7,7)가 식당 오른쪽으로 가는 한 칸 통로에 서서 창고 출입구(8,3)에 못 갔다.
    // vm6 argon 추리: 상인 도윤(8,7)이 뒷마당 출입구(4,3)로 올라가는 목을 막았다. 어느 페이지에서든 비켜나는(통과·아래 층) 이벤트는
    // 일부러 길을 막은 문지기일 수 있어 건드리지 않는다.
    // 착지점마다 따로 본다 — 앵커를 한데 모으면 창고에서 돌아오는 착지점(8,5)이 막힌 쪽을 «닿음»으로 채워 목을 못 본다(vm6 flash 추리).
    const splits = anchorSplitter(project, map, anchors, othersBlocked, others);
    const chokes = alwaysBlocks(ev) && anchors.length > 0 && splits(blockersOf(map));
    if (!bad(ev) && !chokes) continue;
    const taken = new Set(others.map((e) => e.y * w + e.x));
    const anchorSet = new Set(anchors.map((a) => a.y * w + a.x));
    const okOthers = (reach: Uint8Array) => others.every((o) => (!free[o.y * w + o.x] && !nextTo(map, free, o)) || nextTo(map, reach, o) || !!reach[o.y * w + o.x]);
    const cands: { c: Cell; s: number }[] = [];
    // 가까움은 걸음 수로 잰다 — 칸 거리(맨해튼)면 벽 너머 옆방 칸이 같은 방 칸보다 가깝다(2026-10-31 meb1 opus 추리: 「객실 발자국」이
    // 로엘의 객실 (8,3)에서 벽 건너 부엌 (6,3)으로 옮겨져, 목표 글 「북동쪽 로엘의 객실」을 따라간 판정자가 끝내 못 찾았다).
    const steps = walkSteps(map, free, ev);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!free[i] || taken.has(i) || anchorSet.has(i) || lanes.has(i)) continue;
      const manhattan = Math.abs(x - ev.x) + Math.abs(y - ev.y);
      cands.push({ c: { x, y }, s: steps[i]! >= 0 ? steps[i]! : 10_000 + manhattan });
    }
    cands.sort((a, b) => a.s - b.s);
    const target = cands.slice(0, 120).find(({ c }) => {
      if (bad(c)) return false;
      const blocked = new Set(othersBlocked);
      blocked.add(c.y * w + c.x);
      return okOthers(reachFrom(project, map, anchors, blocked)) && !splits(blocked);
    })?.c;
    const name = String((ev as { name?: string }).name ?? id);
    if (!target) { stuck.push(`${name}(${ev.x},${ev.y})`); continue; }
    const res = run.call("move_event", { mapId, eventId: id, x: target.x, y: target.y });
    if (res.ok) moved.push(`${name} (${ev.x},${ev.y})→(${target.x},${target.y})${chokes && !bad(ev) ? " 하나뿐인 목 비움" : " 이동 칸 앞 비움"}${approach ? "(컷신에서 다가가는 끝 칸 포함)" : ""}`);
    else stuck.push(`${name}: ${String(res.summary).slice(0, 120)}`);
  }
  return { moved, stuck };
}

// ── 조사·대화 대상 앞 비우기 ──────────────────────────────────────────────────────
// 2026-10-29 VM 측정 판(deepseek mystery 「은빛수레 여관」): 판정자 「가구·의자 때문에 NPC 앞으로 가는 길이 막히는 곳이 많다(베른·도릭·창고)」.
// 닿는지 검사(unreachableEvents·repairEventReach)는 «어느 한 면»만 닿아도 통과시킨다 — 베른(12,7)은 앞(아래) 칸에 의자가 놓여
// 옆·뒤로 돌아가야만 말을 걸 수 있었다. 3/4 시점에서 사람은 대상의 앞(아래 칸)에서 위를 보고 말을 건다고 기대한다.
// 규칙: 조사·대화 이벤트의 아래 칸에 못 닿는데 둘레 한 칸 안의 앉는 가구(의자·걸상·벤치) 하나를 치우면 닿게 되면 그 가구를 치운다.
// 탁자·장식장 같은 다른 가구는 건드리지 않는다(자리가 안 열리면 그대로 둔다 — 옆·뒤로는 여전히 닿는다).
const SEAT_LABEL = /의자|걸상|스툴|벤치|장의자|chair|stool|bench/iu;

const singleTileCache = new WeakMap<object, Set<string>>();

/** 이름표가 (0,0) 한 칸뿐인 물건 이름들(그 칩셋). */
function singleTileLabels(project: Project, map: GameMap): Set<string> {
  const tileset = project.tilesets[map.tilesetId];
  const meta = (tileset?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
  const hit = singleTileCache.get(meta);
  if (hit) return hit;
  const parts = new Map<string, Set<string>>();
  for (const t of meta) {
    const label = t?.label;
    if (!label) continue;
    const coord = /\((-?\d+,\s*-?\d+)\)\s*$/u.exec(label)?.[1]?.replace(/\s/gu, "") ?? "0,0";
    const base = objectBaseLabel(label);
    (parts.get(base) ?? parts.set(base, new Set()).get(base)!).add(coord);
  }
  const out = new Set([...parts].filter(([, coords]) => coords.size === 1 && coords.has("0,0")).map(([base]) => base));
  singleTileCache.set(meta, out);
  return out;
}

export function clearTargetFronts(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  for (let round = 0; round < 12; round++) {
    const project = run.ctx.project;
    const map = project.maps[mapId];
    if (!map) break;
    const reach = reachableCells(project, map);
    if (!reach) break;
    const w = map.width;
    const tileset = project.tilesets[map.tilesetId];
    const baseOf = (t: number | undefined) => (typeof t === "number" && t >= 0 ? objectBaseLabel(tileset?.tileMeta?.[t]?.label ?? "") : "");
    let changed = false;
    for (const ev of map.events ?? []) {
      if (ev.id.startsWith("ev_objective") || hasTransfer(ev.pages ?? ev.commands)) continue;
      if (!(ev.pages ?? []).some((p) => (typeof p.trigger === "string" ? p.trigger : p.trigger?.kind) === "action")) continue;
      const front = { x: ev.x, y: ev.y + 1 };
      if (front.y >= map.height || reach[front.y * w + front.x]) continue;
      if (!nextTo(map, reach, ev) && !reach[ev.y * w + ev.x]) continue; // 아예 못 닿는 것은 repairEventReach 몫
      const seen = new Set<string>();
      const seats: { label: string; cells: number[] }[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cluster = objectClusterAt(project, map, front.x + dx, front.y + dy);
        if (!cluster || !SEAT_LABEL.test(cluster.label)) continue;
        const key = [...cluster.cells].sort((a, b) => a - b).join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        seats.push(cluster);
      }
      // 같은 이름표가 이어지면 의자 여럿이 한 묶음이 된다(탁자 둘레 의자 줄) — 한 칸짜리 의자면 칸마다 따로(앞 칸에 가까운 것부터) 치워 본다.
      const units: { label: string; cells: number[] }[] = [];
      const dist = (i: number) => Math.abs((i % w) - front.x) + Math.abs(Math.floor(i / w) - front.y);
      for (const seat of seats) {
        if (singleTileLabels(project, map).has(seat.label)) for (const i of [...seat.cells].sort((a, b) => dist(a) - dist(b))) units.push({ label: seat.label, cells: [i] });
        else units.push(seat);
      }
      units.sort((a, b) => a.cells.length - b.cells.length || dist(a.cells[0]!) - dist(b.cells[0]!));
      for (const seat of units) {
        const copy = structuredClone(map) as GameMap & Record<string, number[] | undefined>;
        for (const i of seat.cells) for (const key of ["upperTiles", "upperOverlayTiles"] as const) {
          const layer = copy[key];
          if (layer && baseOf(layer[i]) === seat.label) layer[i] = -1;
        }
        const trial = { ...project, maps: { ...project.maps, [mapId]: copy } } as Project;
        const after = reachableCells(trial, copy);
        if (!after?.[front.y * w + front.x]) continue;
        run.ctx.project = trial;
        notes.push(`${String(ev.name ?? ev.id)}(${ev.x},${ev.y}) 앞을 막던 「${seat.label}」 ${seat.cells.map((i) => `(${i % w},${Math.floor(i / w)})`).join("·")} 을 치움`);
        changed = true;
        break;
      }
      if (changed) break;
    }
    if (!changed) break;
  }
  return notes;
}

// ── 사람 둘레 비우기 ─────────────────────────────────────────────────────────────
// 2026-10-29 vm3 flash 추리 「여관 도난 사건」 판정(major): 객실에 손님 넷이 (5,5)(6,5)(7,5)(5,6)에 붙어 서서 갈색 머리 손님 (5,5)는
// 왼쪽 벽·오른쪽 손님·아래 손님에 막혀 위 칸 하나에서만 말을 걸 수 있었다 — 판정자는 여러 번 헛누르다 위로 돌아가서야 대화했다.
// 규칙: 그림 있는 대화 이벤트(사람)가 다른 막는 이벤트와 붙어 서서 걸어 닿는 옆 칸이 둘 미만이면,
// 가까운(6칸 안) 닿는 빈 바닥 중 옆 칸이 둘 이상 열리고 다른 사람과 붙지 않는 칸으로 옮긴다.
// 카운터 뒤 주인처럼 사람과 붙지 않은 채 한 면만 열린 자리는 일부러 놓은 것으로 보고 건드리지 않는다.
// 옮긴 결과 못 닿는 이벤트가 늘거나 다른 사람의 열린 면이 둘 밑으로 줄면 그 자리는 고르지 않는다.

// 사물 칩(상자·철창·문 — Object 시트)은 사람이 아니다 — 시계 속·책상 위 상자를 「가구 칸 위에 선 사람」으로 보고 바닥으로 끌어냈다(2026-10-29 vm5 escape 재생).
const OBJECT_SHEET = /charset_object|_object\d|objects?$/iu;

const isPerson = (ev: GameEvent) => (ev.pages ?? []).some((p) => { const sprite = (p.graphic as { sprite?: { id?: string } } | undefined)?.sprite; return !!sprite && !OBJECT_SHEET.test(String(sprite.id ?? "")) && (typeof p.trigger === "string" ? p.trigger : p.trigger?.kind) === "action"; });

function openSides(map: GameMap, reach: Uint8Array, c: Cell): number {
  let n = 0;
  for (const [dx, dy] of DIRS) { const x = c.x + dx, y = c.y + dy; if (x >= 0 && y >= 0 && x < map.width && y < map.height && reach[y * map.width + x]) n++; }
  return n;
}

export function spreadCrowdedPeople(run: BuildRun, mapId: string): string[] {
  const notes: string[] = [];
  const ids = (run.ctx.project.maps[mapId]?.events ?? []).filter(isPerson).map((e) => e.id);
  for (const id of ids) {
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    const ev = map.events.find((e) => e.id === id);
    if (!ev || !eventBlocks(ev) || hasTransfer(ev.pages ?? ev.commands)) continue;
    const anchors = anchorsOf(project, map);
    if (!anchors.length) continue;
    const w = map.width;
    const reach = reachFrom(project, map, anchors, blockersOf(map));
    // 「막는 칸」(2026-10-29 room-vig6 tavern 88: 주인·선원·일꾼이 양탄자 윗머리에 위아래로 붙어 섰다): 실내에서 문 곁·가구의 하나뿐인 접근 칸·
    // 다른 사람 바로 위아래·큰 양탄자 위(people.ts personSpotCost ≥ 4)도 옮길 이유다 — 둘레가 열려 있어도, 다른 사람과 붙지 않았어도.
    const indoor = (map as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor";
    const spotCtx = indoor ? personSpotContext(project, map, id) : undefined;
    const spot = (c: Cell) => (spotCtx ? personSpotCost(project, map, c, spotCtx) : 0);
    const blocking = spot(ev) >= PERSON_SPOT_BAD;
    if (!blocking && openSides(map, reach, ev) >= 2) continue;
    const blockerAt = new Map((map.events ?? []).filter((e) => e.id !== id && eventBlocks(e)).map((e) => [e.y * w + e.x, e] as const));
    // 대각으로도 다른 사람과 붙은 칸은 덜 반긴다(줄 서 있는 듯 보이고, 다음 사람이 옮길 자리를 막는다).
    const nearPerson = (c: Cell) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const o = blockerAt.get((c.y + dy) * w + c.x + dx); if ((dx || dy) && o && isPerson(o)) return true; } return false; };
    if (!blocking && !DIRS.some(([dx, dy]) => blockerAt.has((ev.y + dy) * w + ev.x + dx))) continue; // 혼자 한 면만 열린 자리(카운터 뒤)
    const people = (map.events ?? []).filter((e) => e.id !== id && isPerson(e) && eventBlocks(e));
    const before = unreachableEvents(project, mapId).length;
    const sidesBefore = new Map(people.map((p) => [p.id, openSides(map, reach, p)]));
    const free = reachFrom(project, map, anchors, blockersOf(map, id));
    // 옮긴 자리가 어느 착지점에서든 닿던 이벤트를 끊으면 안 된다(vm6 flash 추리: 여행자 미라를 한스가 비운 목 (7,7)에 세웠다).
    const splits = anchorSplitter(project, map, anchors, blockersOf(map, id), (map.events ?? []).filter((e) => e.id !== id));
    const lanes = transferLaneCells(project, map);
    const anchorSet = new Set(anchors.map((a) => a.y * w + a.x));
    const cands: { c: Cell; s: number }[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = Math.abs(x - ev.x) + Math.abs(y - ev.y);
      if (!free[i] || d === 0 || d > 6 || blockerAt.has(i) || anchorSet.has(i) || lanes.has(i)) continue;
      if ((map.events ?? []).some((e) => e.id !== id && e.x === x && e.y === y)) continue;
      if (DIRS.some(([dx, dy]) => blockerAt.has((y + dy) * w + x + dx))) continue;
      const sc = spot({ x, y });
      if (sc >= PERSON_SPOT_BAD) continue; // 옮긴 자리도 막는 칸이면 안 된다
      cands.push({ c: { x, y }, s: d + (nearPerson({ x, y }) ? 2 : 0) + sc });
    }
    cands.sort((a, b) => a.s - b.s);
    let target: Cell | undefined;
    for (const { c } of cands.slice(0, 60)) {
      const copy = structuredClone(map);
      const moved = copy.events.find((e) => e.id === id)!;
      moved.x = c.x; moved.y = c.y;
      const trial = { ...project, maps: { ...project.maps, [mapId]: copy } } as Project;
      if (unreachableEvents(trial, mapId).length > before) continue;
      if (splits(blockersOf(copy), copy, trial)) continue;
      const r2 = reachFrom(trial, copy, anchors, blockersOf(copy));
      if (openSides(copy, r2, c) < 2) continue;
      if (people.some((p) => openSides(copy, r2, p) < Math.min(2, sidesBefore.get(p.id) ?? 0))) continue;
      target = c;
      break;
    }
    if (!target) continue;
    const res = run.call("move_event", { mapId, eventId: id, x: target.x, y: target.y });
    if (res.ok) notes.push(`${String(ev.name ?? id)} (${ev.x},${ev.y})→(${target.x},${target.y}) ${blocking ? "문 곁·가구 접근 칸·통로 양탄자를 막고 있었음" : "붙어 선 사람 사이에서 한 면만 열려 있었음"}`);
  }
  return notes;
}
