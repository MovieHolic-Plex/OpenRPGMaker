// 그 장소에 «그려진 물건» — 이야기 단계가 쓰게 하는 것(밸브·레버·쪽지)을 맨바닥의 반짝임이 아니라 그 맵의 그림에 앉히려고 읽는다.
// 읽는 것은 칩셋이 적어 둔 것뿐이다: 맵에 놓인 위층 그림 한 점(이름표)과 그 그림을 찍는 구조 키트의 이름·꼬리표. 요청 글의 낱말 표는 없다.
// 왜·규칙은 openwiki/assistant-v2.md 「이야기의 물건은 그 장소의 그림이다」.
import { isPassable } from "@/project/collision";
import { labelHasWord, labelWithoutNotes } from "@/project/labelWords";
import { objectBaseLabel, objectClusterAt } from "@/project/objectFootprint";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { reachableCells } from "../judge/eventReach";
import type { BuildRun } from "../shared/types";
import { isEntranceArt, passageTiles } from "./entrances";

type Cell = { x: number; y: number };
type Kit = { id: string; name?: string; width?: number; height?: number; rows?: { tiles?: number[]; upperTiles?: number[] }[]; parts?: { kind?: string }[]; ai?: { tags?: string[]; role?: string } };
type Meta = { label?: string; role?: string; passage?: string; tags?: string[] } | undefined;

/** 한 점으로 읽히는 그림의 칸 수 상한 — 건물 한 채·성벽은 넘는다. */
const MAX_CELLS = 12;
/** 물건이 아닌 그림(건물·벽·바닥·물)의 역할 — 칩셋 타일 메타가 적어 둔 것. */
const NOT_A_THING = new Set(["building", "wall", "roof", "terrain", "floor", "fence", "water", "stairs", "castle", "structure", "empty"]);
/** 꼬리표가 이 수보다 많은 키트에 붙었으면 갈래 이름(실내·거리·서재)이다 — 물건 이름으로 읽지 않는다. */
const TAG_MAX_KITS = 3;
/** 벽에 거는 그림이라고 칩셋이 적는 꼬리표 — 바닥 한가운데에 새로 찍지 않는다. */
const WALL_HUNG = new Set(["벽걸이", "wall-mounted", "hang"]);

/** 맵에 그려져 있는 물건 한 점. */
export interface DrawnThing {
  /** 이름표의 물건 이름(「벽 밸브 바퀴」) — 칸 자리·괄호 속 설명은 뗀 것. */
  readonly label: string;
  /** 그 그림을 찍는 키트(알면)의 이름 — 괄호 속 설명까지. */
  readonly kitName?: string;
  /** 그 그림을 찍는 키트 id(알면) — 같은 그림을 하나 더 찍을 때 쓴다. */
  readonly kitId?: string;
  /** 그 키트에만 붙은 꼬리표(「밸브」「쪽지」). */
  readonly tags: readonly string[];
  readonly cells: readonly Cell[];
}

interface KitIndex { readonly byTile: ReadonlyMap<number, Kit>; readonly props: readonly Kit[]; readonly tagCount: ReadonlyMap<string, number>; readonly passage: ReadonlySet<number> }
const indexCache = new Map<string, KitIndex>();

const kitTiles = (kit: Kit): number[] => (kit.rows ?? []).flatMap((r) => [...(r.tiles ?? []), ...(r.upperTiles ?? [])]).filter((t) => typeof t === "number" && t >= 0);

function kitIndex(tileset: TilesetDef | undefined): KitIndex {
  const kits = ((tileset as { structureKits?: readonly Kit[] } | undefined)?.structureKits ?? []) as readonly Kit[];
  const meta = ((tileset as { tileMeta?: unknown } | undefined)?.tileMeta ?? []) as Meta[];
  const key = `${tileset?.id}|${meta.length}|${kits.length}`;
  const hit = indexCache.get(key);
  if (hit) return hit;
  const tagCount = new Map<string, number>();
  for (const kit of kits) for (const tag of new Set(kit.ai?.tags ?? [])) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
  const props = kits.filter((kit) => !(kit.parts ?? []).some((p) => p.kind === "entrance") && !NOT_A_THING.has(kit.ai?.role ?? "")
    && (kit.width ?? 1) * (kit.height ?? 1) <= MAX_CELLS && kitTiles(kit).length > 0 && kitTiles(kit).every((t) => !NOT_A_THING.has(meta[t]?.role ?? "")));
  const byTile = new Map<number, Kit>();
  for (const kit of props) for (const t of kitTiles(kit)) if (!byTile.has(t)) byTile.set(t, kit);
  const out = { byTile, props, tagCount, passage: passageTiles(tileset) };
  if (indexCache.size > 32) indexCache.clear();
  indexCache.set(key, out);
  return out;
}

/** 이름표의 물건 이름 — 칸 자리·프레임 꼬리(「 (1,2) · 1/4프레임」)와 괄호 속 설명을 뗀다. */
const thingName = (label: string): string => labelWithoutNotes(objectBaseLabel(label.replace(/\s*\(\d+,\s*\d+\).*$/u, ""))).replace(/\s+/gu, " ").trim();

const ownTags = (index: KitIndex, kit: Kit | undefined): string[] => (kit?.ai?.tags ?? []).filter((t) => (index.tagCount.get(t) ?? 0) <= TAG_MAX_KITS);

/** 이 맵에 그려진 물건들(위에서 아래, 왼쪽에서 오른쪽). 이벤트가 이미 앉은 것도 든다 — 고르는 쪽이 거른다. */
export function drawnThings(project: Project, map: GameMap): DrawnThing[] {
  const tileset = project.tilesets[map.tilesetId];
  const meta = ((tileset as { tileMeta?: unknown } | undefined)?.tileMeta ?? []) as Meta[];
  const index = kitIndex(tileset);
  const seen = new Uint8Array(map.width * map.height);
  const out: (DrawnThing & { cells: Cell[]; kit?: Kit })[] = [];
  for (let i = 0; i < seen.length; i += 1) {
    if (seen[i]) continue;
    const cluster = objectClusterAt(project, map, i % map.width, Math.floor(i / map.width));
    if (!cluster) continue;
    for (const c of cluster.cells) seen[c] = 1;
    if (cluster.cells.length > MAX_CELLS) continue;
    const tiles = cluster.cells.flatMap((c) => [map.upperTiles[c] ?? -1, map.upperOverlayTiles?.[c] ?? -1]).filter((t) => t >= 0);
    if (tiles.some((t) => NOT_A_THING.has(meta[t]?.role ?? ""))) continue;
    const kit = tiles.map((t) => index.byTile.get(t)).find(Boolean);
    const cells = cluster.cells.map((c) => ({ x: c % map.width, y: Math.floor(c / map.width) }));
    // 움직이는 그림은 칸마다 이름표 꼬리(「(1,2) · 1/4프레임」)가 달라 한 점이 칸칸이 갈린다 — 같은 키트의 맞닿은 조각은 한 점으로 잇는다.
    const whole = kit ? out.find((t) => t.kit === kit && t.cells.some((a) => cells.some((b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1))) : undefined;
    if (whole) { whole.cells.push(...cells); continue; }
    out.push({ label: thingName(cluster.label), ...(kit?.name ? { kitName: kit.name } : {}), tags: ownTags(index, kit), cells, ...(kit ? { kit, kitId: kit.id } : {}) });
  }
  return out.filter((t) => t.cells.length <= MAX_CELLS);
}

const tokens = (text: string): string[] => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2);

/**
 * 이름(이벤트 이름·모델이 고른 on)이 이 그림을 가리키는 세기 — 0 이면 아니다.
 * 3 = 이름표가 그 이름을 통째로 담는다 · 2 = 이름의 물건 낱말(마지막 어절)이 이름표의 낱말이거나 그 키트만의 꼬리표다 · 1 = 그 낱말이 키트 이름의 괄호 속 부품 설명에 있다.
 */
export function thingMatch(name: string, thing: { readonly label: string; readonly kitName?: string; readonly tags: readonly string[] }): number {
  const words = tokens(name);
  const head = words.at(-1);
  if (!head) return 0;
  const names = [thing.label, ...(thing.kitName ? [thing.kitName] : [])];
  if (words.length > 1 && names.some((n) => labelHasWord(n, name))) return 3;
  if (names.some((n) => labelHasWord(n, head)) || thing.tags.some((t) => t.toLowerCase() === head)) return 2;
  const notes = names.flatMap((n) => [...n.matchAll(/\(([^)]*)\)/gu)].flatMap((m) => tokens(m[1] ?? "")));
  return notes.includes(head) ? 1 : 0;
}

/** 물건 한 점의 «서서 쓰는 자리» — 그림 칸 c(이벤트가 앉는 칸)와 그 곁의 걸어 닿는 칸 stand. near 에 가까운 것, 남쪽에서 마주 보는 것 먼저. */
export function thingSeat(project: Project, map: GameMap, thing: DrawnThing, near?: Cell, claimed: readonly Cell[] = []): { cell: Cell; stand: Cell } | undefined {
  const reach = reachableCells(project, map);
  if (!reach) return undefined;
  // claimed = 아직 이벤트로 서지 않은 앞 단계들의 자리(같은 사슬이 한 번에 짓는다) — 같은 그림·같은 서는 칸을 두 단계가 쓰지 않는다.
  const taken = new Set([...(map.events ?? []), ...claimed].map((e) => `${e.x},${e.y}`));
  let best: { cell: Cell; stand: Cell; cost: number } | undefined;
  for (const cell of thing.cells) {
    if (taken.has(`${cell.x},${cell.y}`)) return undefined;
    for (const [dx, dy, turn] of [[0, 1, 0], [-1, 0, 1], [1, 0, 1], [0, -1, 2]] as const) {
      const stand = { x: cell.x + dx, y: cell.y + dy };
      if (stand.x < 0 || stand.y < 0 || stand.x >= map.width || stand.y >= map.height) continue;
      if (!reach[stand.y * map.width + stand.x] || !isPassable(project, map, stand.x, stand.y) || taken.has(`${stand.x},${stand.y}`)) continue;
      // 계단·문 그림 위는 서서 쓰는 자리가 아니다 — 밟으면 넘어가는 칸 곁이다.
      if (thing.cells.some((c) => c.x === stand.x && c.y === stand.y) || isEntranceArt(project, map, stand.x, stand.y)) continue;
      const cost = turn * 3 + (near ? Math.abs(stand.x - near.x) + Math.abs(stand.y - near.y) : 0) - (isPassable(project, map, cell.x, cell.y) ? 0 : 1);
      if (!best || cost < best.cost) best = { cell, stand, cost };
    }
  }
  return best ? { cell: best.cell, stand: best.stand } : undefined;
}

/** 바닥에 새로 찍을 수 있는 키트인가 — 벽에 거는 그림과 문·계단·창(지나다니는 그림)은 아니다. */
const floorKit = (index: KitIndex, kit: Kit): boolean => !(kit.ai?.tags ?? []).some((t) => WALL_HUNG.has(t)) && !kitTiles(kit).some((t) => index.passage.has(t));

/** 키트 한 벌을 near 곁 빈 바닥에 찍는다 — 걸어 닿던 칸이 끊기면 되돌리고 다음 자리. 찍은 물건(서서 쓸 자리가 있는 것)을 돌려준다. */
function stampKitNear(run: BuildRun, mapId: string, kit: Kit, near: Cell, claimed: readonly Cell[]): DrawnThing | undefined {
  const map0 = run.ctx.project.maps[mapId];
  const reach0 = map0 ? reachableCells(run.ctx.project, map0) : undefined;
  if (!map0 || !reach0) return undefined;
  const reached = (r: Uint8Array) => { let n = 0; for (const v of r) n += v ? 1 : 0; return n; };
  const w = kit.width ?? 1, h = kit.height ?? 1;
  const spots: { x: number; y: number; d: number }[] = [];
  for (let y = Math.max(0, near.y - 7); y <= Math.min(map0.height - h, near.y + 7); y += 1) for (let x = Math.max(0, near.x - 7); x <= Math.min(map0.width - w, near.x + 7); x += 1) {
    let free = true;
    // 발자국과 그 남쪽 한 줄(서는 자리)이 빈 걷는 바닥이어야 한다 — 문 앞·길목을 막지 않게 둘레 이벤트도 피한다.
    for (let yy = y; yy <= y + h && free; yy += 1) for (let xx = x; xx < x + w && free; xx += 1) {
      if (yy >= map0.height || !reach0[yy * map0.width + xx] || !isPassable(run.ctx.project, map0, xx, yy) || objectClusterAt(run.ctx.project, map0, xx, yy)) free = false;
      else if ([...(map0.events ?? []), ...claimed].some((e) => Math.abs(e.x - xx) + Math.abs(e.y - yy) <= 1)) free = false;
    }
    if (free) spots.push({ x, y, d: Math.abs(x - near.x) + Math.abs(y + h - 1 - near.y) });
  }
  spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  for (const spot of spots.slice(0, 16)) {
    const snapshot = run.ctx.project;
    const res = run.call("stamp_object", { objectId: `kit:${map0.tilesetId}/${kit.id}`, mapId, x: spot.x, y: spot.y });
    const map = run.ctx.project.maps[mapId]!;
    const reach = res.ok ? reachableCells(run.ctx.project, map) : undefined;
    // 찍은 발자국만큼만 걷는 칸이 줄어야 한다 — 더 줄면 길목을 끊은 것이다.
    if (!reach || reached(reach0) - reached(reach) > w * h) { run.ctx.project = snapshot; continue; }
    const made = drawnThings(run.ctx.project, map).find((t) => t.cells.some((c) => c.x >= spot.x && c.x < spot.x + w && c.y >= spot.y && c.y < spot.y + h));
    if (made && thingSeat(run.ctx.project, map, made, near, claimed)) return made;
    run.ctx.project = snapshot;
  }
  return undefined;
}

/** 이름이 가리키는 그림을 그 칩셋 키트에서 골라 near 곁 빈 바닥에 찍는다. 찍은 물건을 돌려준다. */
export function stampNamedThing(run: BuildRun, mapId: string, name: string, near: Cell, minMatch = 1, claimed: readonly Cell[] = []): DrawnThing | undefined {
  const map0 = run.ctx.project.maps[mapId];
  if (!map0) return undefined;
  const index = kitIndex(run.ctx.project.tilesets[map0.tilesetId]);
  const scored = index.props.map((kit) => ({ kit, score: thingMatch(name, { label: labelWithoutNotes(kit.name ?? ""), kitName: kit.name ?? "", tags: ownTags(index, kit) }) }))
    .filter((k) => k.score >= minMatch && floorKit(index, k.kit))
    .sort((a, b) => b.score - a.score || (a.kit.width ?? 1) * (a.kit.height ?? 1) - (b.kit.width ?? 1) * (b.kit.height ?? 1));
  for (const { kit } of scored.slice(0, 2)) {
    const made = stampKitNear(run, mapId, kit, near, claimed);
    if (made) return made;
  }
  return undefined;
}

/** 그 맵에 이미 놓인 물건과 같은 그림을 near 곁에 하나 더 찍는다 — 이름에 맞는 그림도, 가까이 놓인 물건도 없을 때 그 장소의 그림으로 대신한다. */
export function stampCopyNear(run: BuildRun, mapId: string, like: DrawnThing, near: Cell, claimed: readonly Cell[] = []): DrawnThing | undefined {
  const map0 = run.ctx.project.maps[mapId];
  if (!map0 || !like.kitId) return undefined;
  const index = kitIndex(run.ctx.project.tilesets[map0.tilesetId]);
  const kit = index.props.find((k) => k.id === like.kitId);
  return kit && floorKit(index, kit) ? stampKitNear(run, mapId, kit, near, claimed) : undefined;
}

/**
 * 이름이 가리키는 «벽에 거는» 그림(밸브 바퀴·압력계)을 벽면 아랫줄에 건다 — 바로 아래가 서서 쓸 빈 바닥인 벽 칸, near 에 가까운 곳.
 * 왜: 구성기가 건 벽 그림은 아래에 가구가 놓여 설 자리가 없을 때가 많다(보일러실의 밸브 바퀴 아래 화로·계단). 같은 그림을 쓸 수 있는 벽에 하나 더 건다.
 */
export function hangNamedThing(run: BuildRun, mapId: string, name: string, near: Cell, minMatch = 1, claimed: readonly Cell[] = []): DrawnThing | undefined {
  const map0 = run.ctx.project.maps[mapId];
  const reach = map0 ? reachableCells(run.ctx.project, map0) : undefined;
  if (!map0 || !reach) return undefined;
  const tileset = run.ctx.project.tilesets[map0.tilesetId];
  const meta = ((tileset as { tileMeta?: unknown } | undefined)?.tileMeta ?? []) as Meta[];
  const index = kitIndex(tileset);
  const hung = index.props.map((kit) => ({ kit, score: thingMatch(name, { label: labelWithoutNotes(kit.name ?? ""), kitName: kit.name ?? "", tags: ownTags(index, kit) }) }))
    .filter((k) => k.score >= minMatch && (k.kit.ai?.tags ?? []).some((t) => WALL_HUNG.has(t)) && (k.kit.rows ?? []).every((r) => (r.tiles ?? []).every((t) => t < 0)))
    .sort((a, b) => b.score - a.score || (a.kit.width ?? 1) * (a.kit.height ?? 1) - (b.kit.width ?? 1) * (b.kit.height ?? 1));
  const wall = (x: number, y: number) => x >= 0 && y >= 0 && x < map0.width && y < map0.height && meta[map0.lowerTiles[y * map0.width + x] ?? -1]?.role === "wall"
    && (map0.upperTiles[y * map0.width + x] ?? -1) < 0 && (map0.upperOverlayTiles?.[y * map0.width + x] ?? -1) < 0;
  const taken = [...(map0.events ?? []), ...claimed];
  const floor = (x: number, y: number) => y < map0.height && !!reach[y * map0.width + x] && isPassable(run.ctx.project, map0, x, y) && !objectClusterAt(run.ctx.project, map0, x, y)
    && !isEntranceArt(run.ctx.project, map0, x, y) && !taken.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
  for (const { kit } of hung.slice(0, 2)) {
    const w = kit.width ?? 1, h = kit.height ?? 1;
    const spots: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y + h < map0.height; y += 1) for (let x = 0; x + w <= map0.width; x += 1) {
      let ok = true;
      for (let yy = y; yy < y + h && ok; yy += 1) for (let xx = x; xx < x + w && ok; xx += 1) ok = wall(xx, yy);
      for (let xx = x; xx < x + w && ok; xx += 1) ok = floor(xx, y + h);
      if (ok) spots.push({ x, y, d: Math.abs(x - near.x) + Math.abs(y + h - near.y) });
    }
    spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const spot of spots.slice(0, 4)) {
      const snapshot = run.ctx.project;
      const painted = (kit.rows ?? []).every((row, dy) => (row.upperTiles ?? []).every((tile, dx) => tile < 0 || run.call("paint_tiles", { mapId, layer: "3", mode: "cells", tile, cells: [{ x: spot.x + dx, y: spot.y + dy }] }).ok));
      const map = run.ctx.project.maps[mapId]!;
      const made = painted ? drawnThings(run.ctx.project, map).find((t) => t.cells.some((c) => c.x === spot.x && c.y === spot.y + h - 1)) : undefined;
      if (made && thingSeat(run.ctx.project, map, made, near, claimed)) return made;
      run.ctx.project = snapshot;
    }
  }
  return undefined;
}

/** 그 칸(이벤트 자리)이 그려진 물건 한 점 위인가 — 뒤 단계가 «물건에 앉힌 이벤트»를 옮기거나 다른 그림으로 덮지 않게 읽는다. */
export function onDrawnThing(project: Project, map: GameMap, at: Cell): DrawnThing | undefined {
  return drawnThings(project, map).find((t) => t.cells.some((c) => c.x === at.x && c.y === at.y));
}

/** 그 장소에 그려진 물건 이름들(겹치지 않게, 많이 놓인 것부터 max 개) — build_places 결과가 모델에게 보인다. */
export function drawnThingNames(project: Project, map: GameMap, max = 10): string[] {
  const count = new Map<string, number>();
  for (const t of drawnThings(project, map)) count.set(t.label, (count.get(t.label) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([label]) => label);
}
