// editor/tools/buildingSite.ts — 손으로 찍는 건물(입구가 있는 킷)의 터: 어긋나면 거절하지 않고 고쳐 놓고 무엇을 고쳤는지 알린다.
//
// 왜(2026-11-16 실모델 확인 빌드 r6 «갈매나루»): 조수가 성당 킷을 손으로 찍다 네 번 거절당했다 — 완성된 집을 덮는다고 도구 앞 검사가 옮긴 자리가
// 벼랑 줄에 걸쳐 높이 규칙이 거절하고, 높이 규칙이 알려 준 자리는 다시 집을 덮어 같은 곳으로 되돌아왔다. 다섯 번째에 윗단 숲 위에 섰는데 문 앞은
// 벼랑 아래였고 지붕 위에 숲 머리 세 그루가 남았다. 오너 방향(2026-11-16): «모델이 고른 에셋이 실제로 있으면 깔고, 어긋나면 도구가 고쳐 놓고 알려
// 주고, 거절은 게임이 깨질 때만 한다.»
//
// 하는 일(stamp_object 가 site:'fix' 로 불렸을 때만 — 시공기·다른 도구가 부르는 찍기는 그대로다):
//   1) 터 고르기: 청한 자리가 맞으면 그대로, 아니면 가장 가까운 맞는 자리. 맞는 자리 = 맵 안 · 완성된 집·이동 도착 칸·사람을 덮지 않음 · 길을 끊지 않음 ·
//      킷 놓기 규칙(물 위 금지 등) · 한 단 위(경사로·가림 없음) · 문 앞 칸이 문과 같은 단의 땅이고 걸어서 닿는다(나무·소품을 치우면 닿는 것도 맞는 자리다).
//   2) 치우기: 발자국 아래 2~4층(나무·소품·숲 수관·숲 머리)을 걷는다 — 걸친 나무·머리는 그림 한 점을 통째로. 문 앞에서 걷는 그물까지 막은 나무·소품도 통째로.
//   3) 길: 치워서 연 칸에는 그 맵의 길 재료로 길을 깐다(길이 있는 맵만).
// 맞는 자리가 맵에 하나도 없을 때만 거절한다.
import { isPassable, passabilityOf } from "@/project/collision";
import { kitBaseTile } from "@/project/houseSetTiles";
import { objectBaseLabel } from "@/project/objectFootprint";
import { checkKitPlacement, checkReliefPlacement } from "@/project/kitPlacementRules";
import { reliefAllowsStep } from "@/project/relief/walk";
import { tilesetSurface } from "@/project/tilesetSurface";
import { villageScenesOfMap } from "@/project/villageKindPlan";
import { tilesetStandTableFor } from "@/assets/tilesetStands";
import { BEODEUL_NATURE, BEODEUL_NATURE_TEXTURE } from "@/project/defaults/beodeulNature";
import { isRoadCell } from "@/ai/v2/place/surface";
import type { StampPattern } from "@/project/objectStamp";
import type { GameMap, Project, StructureKitDef, TilesetDef } from "@/project/types";
import { protectedHouseCells } from "./houseProtection";
import { roadCutAt } from "./roadCutGuard";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { ToolError } from "./types";

type Cell = { x: number; y: number };
export type BuildingStamp = { readonly name: string; readonly objectId: string; readonly source: TilesetDef; readonly pattern: StampPattern; readonly kit: StructureKitDef };
export type BuildingSite = {
  readonly x: number; readonly y: number;
  /** 청한 자리에서 옮겼으면 까닭(영문 — 조수가 읽는다). */
  readonly movedWhy?: string;
  /** 문 앞 칸(맵 좌표). */
  readonly fronts: readonly Cell[];
  /** 문 앞에서 걷는 그물까지의 칸 줄(문 앞부터, 그물 칸으로 끝난다) — 이미 닿으면 빈 줄. */
  readonly ways: readonly (readonly number[])[];
};

/** 터를 고쳐 놓는 건물 킷인가 — 입구가 있고, 쓰임이 건물이거나 스무 칸 넘게 큰 것(등대 같은 큰 시설). 굴 입구·성문 같은 작은 입구 소품은 아니다(제 자리에 맞춰 찍는 것들). */
export function isBuildingKit(kit: StructureKitDef | undefined): kit is StructureKitDef {
  if (!kit || !(kit.parts ?? []).some((part) => part.kind === "entrance")) return false;
  return (kit.ai as { role?: string } | undefined)?.role === "building" || kit.width * kit.height >= 20;
}

// ───────────── 그림 한 점(소품 킷 · 숲 머리) 찾기 ─────────────

type Picture = { readonly name: string; readonly w: number; readonly h: number; readonly cells: readonly number[]; readonly n: number };
type PictureIndex = { readonly byCell: ReadonlyMap<number, readonly { p: Picture; k: number }[]>; readonly canon: (tile: number) => number };
const indexCache = new WeakMap<object, { kits: number; grafts: number; index: PictureIndex }>();
/** 숲·나무 이름표 — 한 이름표가 숲 전체에 걸려 있어, 이름표가 같다고 이웃 칸을 같은 물건으로 보지 않는다. */
const GROWN = /나무|덤불|숲|수관|canopy|forest|crown/iu;
/** 울타리·담은 그림 한 점이 아니라 줄이다 — 길을 내려고 걷지 않는다. */
const LINE_PROP = /fence|울타리|wall|성벽|담장|gate|성문/iu;

/**
 * 맵 위층 칸을 «어느 그림의 어느 자리» 로 되읽는 표. 그림 = 서는 소품 킷(입구 없음 · 바닥 칸 없음 · 8×8 이하 · 쓰임 prop)과 숲 구성의 나무 머리.
 * 변형 그림(숲 구성의 다른 개체 · 집 벌)은 원본 킷의 같은 자리 칸으로 읽는다(kitBaseTile). 머리 칸은 숲 그림판 번호의 음수 부호(-(칸+2))로 적는다.
 */
function pictureIndex(ts: TilesetDef): PictureIndex {
  const kits = ts.structureKits ?? [], grafts = ts.tileGrafts ?? [];
  const hit = indexCache.get(ts);
  if (hit && hit.kits === kits.length && hit.grafts === grafts.length) return hit.index;
  const byCell = new Map<number, { p: Picture; k: number }[]>();
  const add = (p: Picture): void => p.cells.forEach((cell, k) => { if (cell === -1) return; const list = byCell.get(cell); if (list) list.push({ p, k }); else byCell.set(cell, [{ p, k }]); });
  for (const kit of kits) {
    if (kit.width > 8 || kit.height > 8 || (kit.parts ?? []).some((part) => part.kind === "entrance")) continue;
    const role = (kit.ai as { role?: string } | undefined)?.role;
    if ((role && role !== "prop") || LINE_PROP.test(`${kit.id} ${kit.name ?? ""}`)) continue;
    if (kit.rows.some((row) => row.tiles.some((tile) => tile >= 0))) continue;
    const cells = kit.rows.flatMap((row) => Array.from({ length: kit.width }, (_, x) => { const t = row.upperTiles?.[x] ?? -1; return t >= 0 ? t : -1; }));
    const n = cells.filter((cell) => cell !== -1).length;
    if (n) add({ name: kit.name ?? kit.id, w: kit.width, h: kit.height, cells, n });
  }
  const crownOf = new Map<number, number>();
  const table = tilesetStandTableFor(ts.id);
  if (table) {
    const crownCells = new Set<number>();
    for (const stand of Object.values(table.stands)) for (const crown of stand.crowns ?? []) {
      const cells = crown.rows.flatMap((row) => Array.from({ length: crown.w }, (_, x) => { const cell = row[x] ?? -1; return cell >= 0 ? -(cell + 2) : -1; }));
      const n = cells.filter((cell) => cell !== -1).length;
      if (n) add({ name: "forest crown", w: crown.w, h: crown.h, cells, n });
      for (const row of crown.rows) for (const cell of row) if (cell >= 0) crownCells.add(cell);
    }
    for (const graft of grafts) if (graft.sourceChipset === table.texture && crownCells.has(graft.sourceTile)) crownOf.set(graft.targetTile, -(graft.sourceTile + 2));
  }
  const base = kitBaseTile(ts);
  const index: PictureIndex = { byCell, canon: (tile) => (tile < 0 ? -1 : crownOf.get(tile) ?? base(tile)) };
  indexCache.set(ts, { kits: kits.length, grafts: grafts.length, index });
  return index;
}

type Found = { readonly p: Picture; readonly x0: number; readonly y0: number; readonly hits: readonly { c: number; layer: 3 | 4 }[] };

/** 칸 i 의 위층(3·4층) 그림이 속한 그림 한 점 — 그 그림 칸의 절반 넘게가 제자리에 있어야 한다. 없으면 null. */
function pictureAt(map: GameMap, index: PictureIndex, i: number): Found | null {
  const W = map.width, H = map.height, l3 = map.upperTiles, l4 = map.upperOverlayTiles;
  const x = i % W, y = (i - x) / W;
  let best: Found | null = null;
  for (const tile of [l3[i] ?? -1, l4?.[i] ?? -1]) {
    if (tile < 0) continue;
    for (const { p, k } of index.byCell.get(index.canon(tile)) ?? []) {
      const x0 = x - (k % p.w), y0 = y - Math.floor(k / p.w);
      const hits: { c: number; layer: 3 | 4 }[] = [];
      for (let j = 0; j < p.h; j += 1) for (let n = 0; n < p.w; n += 1) {
        const want = p.cells[j * p.w + n]!;
        if (want === -1) continue;
        const cx = x0 + n, cy = y0 + j;
        if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
        const c = cy * W + cx;
        if (index.canon(l3[c] ?? -1) === want) hits.push({ c, layer: 3 });
        else if (index.canon(l4?.[c] ?? -1) === want) hits.push({ c, layer: 4 });
      }
      if (hits.length * 2 > p.n || p.n === 1) { if (!best || hits.length > best.hits.length) best = { p, x0, y0, hits }; }
    }
  }
  return best;
}

function removePicture(map: GameMap, found: Found): void {
  for (const { c, layer } of found.hits) { if (layer === 3) map.upperTiles[c] = -1; else if (map.upperOverlayTiles) map.upperOverlayTiles[c] = -1; }
}

// ───────────── 맵 살피기 ─────────────

/** 이 맵에 내리는 이동 명령의 도착 칸. */
function transferLandings(project: Project, mapId: string): Cell[] {
  const out: Cell[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { for (const n of node) visit(n); return; }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (o.kind === "transfer" && o.mapId === mapId && typeof o.x === "number" && typeof o.y === "number") out.push({ x: o.x, y: o.y });
    for (const [k, v] of Object.entries(o)) if (k !== "condition" && k !== "conditions" && v && typeof v === "object") visit(v);
  };
  for (const m of Object.values(project.maps)) for (const e of m.events ?? []) { visit((e as { commands?: unknown }).commands); visit((e as { pages?: unknown }).pages); }
  return out;
}

type Survey = {
  readonly W: number; readonly H: number;
  /** 0 막힘 · 1 지금 걷는다 · 2 나무·소품 한 점을 걷으면 걷는다 */
  readonly walk: Uint8Array;
  /** 걷는 그물 — 주인공이 다니는 한 덩이(닻 칸에서 걸어 닿는 칸) */
  readonly net: Uint8Array;
  /** 그물에서 «걷거나 치우면 걷는» 칸으로 닿는 칸 */
  readonly fix: Uint8Array;
  /** 그물의 닻 칸(시작 칸, 없으면 가장 큰 덩이의 이동 도착 칸·길 칸). 없으면 -1 — 닿는지 따질 그물이 없다. */
  readonly anchor: number;
  /** 그물 안에서 끊기면 안 되는 칸: 길 · 이동 도착 칸 · 이벤트와 그 옆 칸 */
  readonly important: readonly number[];
  /** blocked(건물이 덮을 칸)를 막았을 때 닻에서 걸어 닿는 칸 */
  readonly reachWithout: (blocked: ReadonlySet<number>) => Uint8Array;
  readonly owned: ReadonlySet<number>; readonly landings: ReadonlySet<number>; readonly road: Uint8Array;
  readonly events: ReadonlyMap<number, string>;
  /** 마을 종류가 통째로 놓은 장면(방앗간 마당 · 그물 말리는 자리)의 칸과 울타리·담 줄의 칸 — 옮길 때 덮지 않는다 */
  readonly scene: ReadonlySet<number>;
  readonly index: PictureIndex;
};

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function survey(project: Project, map: GameMap, ts: TilesetDef): Survey {
  const W = map.width, H = map.height, N = W * H;
  const index = pictureIndex(ts);
  const owned = new Set(protectedHouseCells(map).map((c) => c.y * W + c.x));
  const landingCells = transferLandings(project, map.id).filter((c) => c.x >= 0 && c.y >= 0 && c.x < W && c.y < H);
  const landings = new Set(landingCells.map((c) => c.y * W + c.x));
  const events = new Map<number, string>();
  for (const e of map.events) if (e.x >= 0 && e.y >= 0 && e.x < W && e.y < H) events.set(e.y * W + e.x, e.name ?? e.id);
  const scene = new Set<number>();
  for (const r of villageScenesOfMap(map)) for (let j = 0; j < r.h; j += 1) for (let i = 0; i < r.w; i += 1) if (r.x + i >= 0 && r.y + j >= 0 && r.x + i < W && r.y + j < H) scene.add((r.y + j) * W + r.x + i);
  // 울타리·담 줄도 장면처럼 친다 — 옮긴 건물이 밭 울타리를 반만 지우고 섰다. 시공기의 밭 울타리는 자연 덧그림 팩의 조각이라 이름표가 없다(이식 기록으로 안다).
  const fenceSource = new Set(Object.values(BEODEUL_NATURE.fence));
  const lineLabel = new Map<number, boolean>();
  for (const graft of ts.tileGrafts ?? []) if (graft.sourceChipset === BEODEUL_NATURE_TEXTURE && fenceSource.has(graft.sourceTile)) lineLabel.set(graft.targetTile, true);
  const isLine = (tile: number): boolean => { if (tile < 0) return false; let hit = lineLabel.get(tile); if (hit === undefined) { hit = LINE_PROP.test(ts.tileMeta?.[tile]?.label ?? ""); lineLabel.set(tile, hit); } return hit; };
  for (let i = 0; i < N; i += 1) if (isLine(map.upperTiles[i] ?? -1) || isLine(map.upperOverlayTiles?.[i] ?? -1)) scene.add(i);
  const walk = new Uint8Array(N), road = new Uint8Array(N);
  const depth = map.terrainDesign?.waterDepth;
  for (let i = 0; i < N; i += 1) {
    const x = i % W, y = (i - x) / W;
    if (isRoadCell(project, map, x, y)) road[i] = 1;
    if (isPassable(project, map, x, y)) { walk[i] = 1; continue; }
    if (owned.has(i) || (depth?.[i] ?? 0) > 0) continue;
    if ((map.upperTiles[i] ?? -1) < 0 && (map.upperOverlayTiles?.[i] ?? -1) < 0) continue;
    const ground = passabilityOf(ts, map.lowerTiles[i] ?? -1, map.lowerOverlayTiles?.[i] ?? -1, -1, -1);
    if (!(ground.up || ground.down || ground.left || ground.right)) continue;
    // 그 칸의 위층 그림이 그림 한 점에 들어 있고, 그 점을 걷으면 걸을 수 있어야 한다
    const found = pictureAt(map, index, i);
    if (!found) continue;
    const mine = (layer: 3 | 4): boolean => found.hits.some((h) => h.c === i && h.layer === layer);
    const after = passabilityOf(ts, map.lowerTiles[i] ?? -1, map.lowerOverlayTiles?.[i] ?? -1, mine(3) ? -1 : map.upperTiles[i] ?? -1, mine(4) ? -1 : map.upperOverlayTiles?.[i] ?? -1);
    if (!(after.up || after.down || after.left || after.right)) continue;
    walk[i] = 2;
  }
  /** seeds 에서 걸어 닿는 칸. open = 치우면 걷는 칸(2)도 지난다. blocked = 지나지 못하는 칸. */
  const spread = (seeds: readonly number[], open: boolean, blocked?: ReadonlySet<number>): Uint8Array => {
    const seen = new Uint8Array(N); const queue: number[] = [];
    for (const s of seeds) if ((walk[s] === 1 || (open && walk[s] === 2)) && !seen[s] && !blocked?.has(s)) { seen[s] = 1; queue.push(s); }
    for (let h = 0; h < queue.length; h += 1) {
      const c = queue[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of STEPS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (seen[n] || !walk[n] || (!open && walk[n] !== 1) || blocked?.has(n) || (map.relief && !reliefAllowsStep(map.relief, x, y, nx, ny))) continue;
        seen[n] = 1; queue.push(n);
      }
    }
    return seen;
  };
  // 걷는 그물 = 주인공이 다니는 한 덩이: 시작 칸이 이 맵에 있으면 거기서 닿는 칸, 아니면 이동 도착 칸·길 칸에서 닿는 덩이 가운데 가장 큰 것.
  // (길 칸이 있다고 다 그물이 아니다 — 윗단의 끊긴 길 조각에 문 앞을 대면 성당이 못 가는 숲 위에 선다.)
  let net: Uint8Array = new Uint8Array(N), anchor = -1;
  const start = project.startMapId === map.id && project.startPos ? project.startPos.y * W + project.startPos.x : -1;
  if (start >= 0 && walk[start] === 1) { net = spread([start], false); anchor = start; }
  else {
    const seeds: number[] = [...landings];
    for (let i = 0; i < N; i += 1) if (road[i]) seeds.push(i);
    const tried = new Uint8Array(N); let size = 0;
    for (const seed of seeds) {
      if (walk[seed] !== 1 || tried[seed]) continue;
      const part = spread([seed], false); let n = 0;
      for (let i = 0; i < N; i += 1) if (part[i]) { tried[i] = 1; n += 1; }
      if (n > size) { size = n; net = part; anchor = seed; }
    }
  }
  const netCells: number[] = []; for (let i = 0; i < N; i += 1) if (net[i]) netCells.push(i);
  const important = new Set<number>();
  for (const i of netCells) if (road[i] || landings.has(i)) important.add(i);
  for (const c of events.keys()) for (const n of [c, c - W, c + W, c % W > 0 ? c - 1 : -1, c % W < W - 1 ? c + 1 : -1]) if (n >= 0 && n < N && net[n]) important.add(n);
  return { W, H, walk, net, fix: spread(netCells, true), anchor, important: [...important], reachWithout: (blocked) => spread([anchor], false, blocked), owned, landings, road, events, scene, index };
}

/** 문 앞 f 에서 reach(건물이 선 뒤에도 닻에서 닿는 칸)까지 가장 싼 칸 줄(걷는 칸 1 · 치울 칸 5) — 문 앞부터, reach 칸으로 끝난다. 못 닿으면 null. */
function wayTo(map: GameMap, s: Survey, front: number, blocked: ReadonlySet<number>, reach: Uint8Array): number[] | null {
  if (!s.walk[front] || blocked.has(front)) return null;
  const { W, H } = s, N = W * H;
  const cost = new Int32Array(N).fill(-1), from = new Int32Array(N).fill(-1);
  const buckets: number[][] = [[front]]; cost[front] = 0;
  for (let d = 0; d < buckets.length; d += 1) {
    const list = buckets[d]; if (!list) continue;
    for (let k = 0; k < list.length; k += 1) {
      const c = list[k]!;
      if (cost[c] !== d) continue;
      if (reach[c]) { const path: number[] = []; for (let at = c; at >= 0; at = from[at]!) path.push(at); return path.reverse(); }
      const x = c % W, y = (c - x) / W;
      for (const [dx, dy] of STEPS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (!s.walk[n] || blocked.has(n) || (map.relief && !reliefAllowsStep(map.relief, x, y, nx, ny))) continue;
        const next = d + (s.walk[n] === 2 ? 5 : 1);
        if (cost[n] >= 0 && cost[n]! <= next) continue;
        cost[n] = next; from[n] = c; (buckets[next] ??= []).push(n);
      }
    }
  }
  return null;
}

// ───────────── 터 고르기 ─────────────

/** 자리 검사기 — 맵을 한 번 살피고(survey), 자리마다 «설 수 있는가 · 왜 못 서는가 · 문 앞 길» 을 답한다. */
function siteChecker(project: Project, map: GameMap, ts: TilesetDef, b: BuildingStamp) {
  const s = survey(project, map, ts), { W, H } = s;
  const { pattern } = b, pw = pattern.width, ph = pattern.height;
  const drawn: Cell[] = [];
  for (let dy = 0; dy < ph; dy += 1) for (let dx = 0; dx < pw; dx += 1) if ((pattern.lower[dy * pw + dx] ?? -1) >= 0 || (pattern.upper[dy * pw + dx] ?? -1) >= 0) drawn.push({ x: dx, y: dy });
  const isDrawn = (dx: number, dy: number): boolean => dx >= 0 && dy >= 0 && dx < pw && dy < ph && ((pattern.lower[dy * pw + dx] ?? -1) >= 0 || (pattern.upper[dy * pw + dx] ?? -1) >= 0);
  const doors = (b.kit.parts ?? []).filter((part) => part.kind === "entrance").map((part) => ({ x: part.dx, y: part.dy + Math.max(1, part.h ?? 1) - 1 }));
  // 문 앞 = 문 칸 바로 아래. 그 칸이 건물 그림 안이면(현관이 그림 안쪽) 터 검사에서 뺀다.
  const fronts = doors.filter((d) => !isDrawn(d.x, d.y + 1));
  const level = (i: number): number => map.relief?.levels?.[i] ?? 0;

  const check = (ox: number, oy: number): { why: string } | { ways: number[][]; clutter: number; onScene: boolean } => {
    if (ox < 0 || oy < 0 || ox + pw > W || oy + ph > H) return { why: "it runs off the map" };
    const cover = new Set<number>(); let onRoad = false, clutter = 0, onScene = false;
    for (const d of drawn) {
      const c = (oy + d.y) * W + ox + d.x;
      if (s.owned.has(c)) return { why: "it covers a completed house" };
      if (s.landings.has(c)) return { why: `it covers the transfer arrival cell (${ox + d.x},${oy + d.y})` };
      const event = s.events.get(c);
      if (event !== undefined && !doors.some((door) => door.x === d.x && door.y === d.y)) return { why: `it covers the event «${event}» at (${ox + d.x},${oy + d.y})` };
      if (s.road[c]) onRoad = true;
      if (s.scene.has(c)) onScene = true;
      if (s.walk[c] !== 1 || s.road[c]) clutter += 1; // 나무·소품·숲이 선 칸과 길·광장 칸 — 옮길 때는 이런 칸이 적은 자리를 고른다(예배당이 광장 윗줄 두 줄을 덮고 섰다)
      cover.add(c);
    }
    if (onRoad) { const cut = roadCutAt(project, map, drawn.map((d) => ({ x: ox + d.x, y: oy + d.y }))); if (cut) return { why: `it cuts the road in two at (${cut.x},${cut.y})` }; }
    if (checkReliefPlacement(map, b.source, b.objectId, b.name, pattern, ox, oy)) return { why: "its footprint is not on one height level (it straddles a cliff, sits on a ramp, or higher ground to the south would hide its bottom row)" };
    if (checkKitPlacement(map, ts, b.kit.id, b.kit, ox, oy)) return { why: "it breaks the kit's placement rule (a building does not stand on water or unsupported ground)" };
    // 건물이 선 뒤에도 닻(시작 칸)에서 닿는 칸 — 건물이 길목을 막아 길·출입구·사람을 끊으면 게임이 깨진다
    let reach: Uint8Array | null = null;
    if (s.anchor >= 0) {
      if (cover.has(s.anchor)) return { why: "it covers the cell the player starts or arrives on" };
      reach = s.reachWithout(cover);
      const cut = s.important.find((i) => !cover.has(i) && !reach![i]);
      if (cut !== undefined) return { why: `it blocks the only way to (${cut % W},${Math.floor(cut / W)}) — a road, exit or person there could no longer be walked to` };
    }
    const ways: number[][] = []; let why = "";
    for (const d of fronts) {
      const fx = ox + d.x, fy = oy + d.y + 1;
      if (fx < 0 || fy < 0 || fx >= W || fy >= H) { why ||= "its door front is off the map"; continue; }
      const f = fy * W + fx, door = (oy + d.y) * W + ox + d.x;
      if (!s.walk[f]) { why ||= `its door front (${fx},${fy}) is not walkable ground`; continue; }
      if (level(f) !== level(door)) { why ||= `its door front (${fx},${fy}) is on another height level than the door (a cliff between them)`; continue; }
      if (!reach) { ways.push(s.walk[f] === 2 ? [f] : []); continue; }
      const way = reach[f] ? [] : s.fix[f] ? wayTo(map, s, f, cover, reach) : null;
      if (!way) { why ||= `its door front (${fx},${fy}) cannot be reached on foot`; continue; }
      ways.push(way);
    }
    // 문이 여럿이면 하나만 닿아도 된다(곁문). 문 앞을 잡을 수 없는 킷(현관이 그림 안쪽)은 터만 본다.
    if (fronts.length && !ways.length) return { why };
    return { ways, clutter, onScene };
  };
  const site = (ox: number, oy: number, ways: number[][], movedWhy?: string): BuildingSite =>
    ({ x: ox, y: oy, ...(movedWhy ? { movedWhy } : {}), fronts: fronts.map((d) => ({ x: ox + d.x, y: oy + d.y + 1 })), ways });

  return { s, check, site };
}

/** 그 건물이 설 수 없는 까닭을 자리마다 센 표(맵 전체) — «왜 이 맵에는 자리가 없는가» 를 잴 때. */
export function buildingSiteReasons(project: Project, map: GameMap, b: BuildingStamp): Record<string, number> {
  const ts = project.tilesets[map.tilesetId];
  const out: Record<string, number> = {};
  if (!ts) return out;
  const { check } = siteChecker(project, map, ts, b);
  for (let y = 0; y + b.pattern.height <= map.height; y += 1) for (let x = 0; x + b.pattern.width <= map.width; x += 1) {
    const hit = check(x, y);
    const key = "why" in hit ? hit.why.replace(/\(\d+,\d+\)/gu, "(x,y)").replace(/«[^»]*»/gu, "«…»") : "fits";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/**
 * 건물 킷을 (x, y) 에 찍을 터. 청한 자리가 맞으면 그대로, 아니면 가장 가까운 맞는 자리(치울 것이 적은 쪽 먼저 — 결정적).
 * 맞는 자리가 맵에 없으면 ToolError(code building-site) — 까닭과 걸어서 닿는 가장 가까운 땅을 적는다.
 */
export function chooseBuildingSite(project: Project, map: GameMap, b: BuildingStamp, x: number, y: number): BuildingSite {
  const ts = project.tilesets[map.tilesetId];
  if (!ts) return { x, y, fronts: [], ways: [] };
  const { s, check, site } = siteChecker(project, map, ts, b);
  const { W, H } = s, pw = b.pattern.width, ph = b.pattern.height;
  const asked = check(x, y);
  if ("ways" in asked) return site(x, y, asked.ways);
  // 옮길 자리: 가까울수록, 그리고 치울 것이 적을수록 좋다(나무·소품이 서거나 길이 깔린 두 칸 = 한 칸 더 먼 것, 열두 칸까지) — 빈 땅을 두고 마을의 장면 소품이나 숲을 밀지 않는다.
  // (한 칸 = 한 칸, 스물네 칸까지로 쳤을 때는 맵 반대편의 빈 땅까지 건물이 갔다 — 청한 자리에서 너무 멀다.)
  let best: { x: number; y: number; ways: number[][]; score: number } | undefined;
  for (let r = 1; r <= Math.max(W, H) && !(best && r > best.score); r += 1) {
    const ring: Cell[] = [];
    for (let oy = -r; oy <= r; oy += 1) for (let ox = -r; ox <= r; ox += 1) if (Math.max(Math.abs(ox), Math.abs(oy)) === r) ring.push({ x: x + ox, y: y + oy });
    ring.sort((a, c) => (Math.abs(a.x - x) + Math.abs(a.y - y)) - (Math.abs(c.x - x) + Math.abs(c.y - y)) || a.y - c.y || a.x - c.x);
    for (const c of ring) {
      const hit = check(c.x, c.y);
      if (!("ways" in hit)) continue;
      // 마을 종류의 장면·울타리 줄 위로는 옮기지 않는다 — 다른 자리가 하나도 없을 때만(청한 자리가 장면 위면 그대로 세운다 — 조수가 고른 것이다)
      const score = r + Math.min(12, Math.ceil(hit.clutter / 2)) + (hit.onScene ? 1000 : 0);
      if (!best || score < best.score) best = { x: c.x, y: c.y, ways: hit.ways, score };
    }
  }
  if (best) return site(best.x, best.y, best.ways, asked.why);
  // 고칠 수 없다 — 걸어서 닿는 가장 가까운 땅을 알려 준다
  let near: Cell | undefined, nearD = Infinity;
  const cx = x + (pw >> 1), cy = y + ph;
  for (let i = 0; i < W * H; i += 1) if (s.net[i]) { const nx = i % W, ny = (i - nx) / W, d = Math.abs(nx - cx) + Math.abs(ny - cy); if (d < nearD) { nearD = d; near = { x: nx, y: ny }; } }
  throw new ToolError(`Nothing was stamped: 「${b.name}」 (${pw}x${ph}) cannot stand at (${x},${y}) — ${asked.why} — and no other spot on this map holds it: it needs ${pw}x${ph} cells on one height level, clear of completed houses, roads and water, with the cell below its door walkable on that level.${near ? ` The nearest ground that can be walked to is (${near.x},${near.y}).` : ""} Do not retry other coordinates. Use a smaller building of the same kind (list_spatial_designs{kind:"object"} rows with an entrance), or, for a village not built yet, ask for it in make_place hints.buildings so the builder lays the village around it; otherwise report that it does not fit.`,
    { code: "building-site", mapId: map.id, ...(near ?? {}) });
}

// ───────────── 고쳐 놓기 ─────────────

/** 찍기 전에: 발자국 아래 2~4층을 걷고(걸친 나무·소품·숲 머리는 그림 한 점을 통째로), 문 앞 길을 막은 나무·소품을 걷는다. 조수가 읽는 알림 줄. */
export function clearBuildingSite(project: Project, map: GameMap, b: BuildingStamp, site: BuildingSite): { notes: string[]; cleared: number; opened: number[] } {
  const ts = project.tilesets[map.tilesetId];
  if (!ts) return { notes: [], cleared: 0, opened: [] };
  const index = pictureIndex(ts), W = map.width, H = map.height;
  const { pattern } = b, pw = pattern.width;
  const names = new Map<string, number>(); let loose = 0;
  /** 칸 i 에 걸린 그림을 통째로 걷는다. any = 걷은 것이 있다 · whole = 여러 칸짜리 그림을 걷었다. */
  const lift = (i: number): { any: boolean; whole: boolean } => {
    let any = false, whole = false;
    for (let guard = 0; guard < 4; guard += 1) {
      const found = pictureAt(map, index, i);
      if (!found) break;
      removePicture(map, found); any = true; if (found.p.n > 1) whole = true;
      names.set(found.p.name, (names.get(found.p.name) ?? 0) + 1);
    }
    return { any, whole };
  };
  const labelOf = (tile: number): string => (tile >= 0 ? objectBaseLabel(ts.tileMeta?.[tile]?.label ?? "") : "");
  const footprint = new Set<number>();
  /** 한 칸짜리로 걷었거나 그림을 못 알아본 채 지운 칸 — 같은 물건의 나머지가 발자국 밖에 남았을 수 있다(이름표가 같은 이웃 칸). */
  const stubs: { i: number; label: string }[] = [];
  for (let k = 0; k < pattern.lower.length; k += 1) {
    if ((pattern.lower[k] ?? -1) < 0 && (pattern.upper[k] ?? -1) < 0) continue;
    const cx = site.x + (k % pw), cy = site.y + Math.floor(k / pw);
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
    const i = cy * W + cx;
    footprint.add(i);
    const had = [labelOf(map.upperTiles[i] ?? -1), labelOf(map.upperOverlayTiles?.[i] ?? -1)].filter((label) => label && !GROWN.test(label));
    const lifted = lift(i);
    let left = false;
    if ((map.upperTiles[i] ?? -1) >= 0) { map.upperTiles[i] = -1; left = true; }
    if (map.upperOverlayTiles && (map.upperOverlayTiles[i] ?? -1) >= 0) { map.upperOverlayTiles[i] = -1; left = true; }
    if (map.lowerOverlayTiles && (map.lowerOverlayTiles[i] ?? -1) >= 0) map.lowerOverlayTiles[i] = -1;
    if (left) loose += 1;
    if ((left || lifted.any) && !lifted.whole) for (const label of had) stubs.push({ i, label });
  }
  // 발자국 밖에 남은 토막: 위에서 지운 칸과 이름표가 같은 이웃 칸(두 칸까지) — 여러 칸짜리로 알아본 그림은 다른 물건이니 둔다. 지붕 위로 자루 더미 윗동이 남았다.
  const owned = new Set(protectedHouseCells(map).map((c) => c.y * W + c.x));
  let strays = 0;
  const queue = stubs.map((stub) => ({ ...stub, d: 0 }));
  for (let h = 0; h < queue.length; h += 1) {
    const { i, label, d } = queue[h]!;
    if (d >= 2) continue;
    const x = i % W, y = (i - x) / W;
    for (const [dx, dy] of STEPS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (footprint.has(n) || owned.has(n)) continue;
      const on3 = labelOf(map.upperTiles[n] ?? -1) === label, on4 = labelOf(map.upperOverlayTiles?.[n] ?? -1) === label;
      if (!on3 && !on4) continue;
      const found = pictureAt(map, index, n);
      if (found && found.p.n > 1) continue;
      if (on3) map.upperTiles[n] = -1;
      if (on4 && map.upperOverlayTiles) map.upperOverlayTiles[n] = -1;
      strays += 1; queue.push({ i: n, label, d: d + 1 });
    }
  }
  const opened: number[] = [];
  for (const way of site.ways) for (const c of way) {
    if (isPassable(project, map, c % W, Math.floor(c / W))) continue;
    if (lift(c).any) opened.push(c);
  }
  const cleared = [...names.values()].reduce((a, n) => a + n, 0);
  const notes: string[] = [];
  if (cleared || loose) {
    const list = [...names].sort((a, c) => c[1] - a[1]).slice(0, 4).map(([name, n]) => `${n}× ${name.replace(/^버들항\s*/u, "")}`).join(", ");
    notes.push(`Site cleared for 「${b.name}」: ${cleared ? `${cleared} tree/prop picture(s) under the footprint or across the door way were removed whole (${list})` : "nothing whole had to go"}${loose ? `${cleared ? "; " : ", but "}${loose} other upper cell(s) under the footprint (forest canopy, decals) were wiped` : ""}${strays ? `; ${strays} leftover cell(s) of the same objects beside the footprint went with them` : ""}. Nothing is left standing on the roof.`);
  }
  return { notes, cleared, opened };
}

/** 찍은 뒤: 치워서 연 문 앞 길에 그 맵의 길 재료로 길을 깐다(길이 있는 맵 · 경사로 칸은 빼고). 깐 칸 수. */
export function paveBuildingWays(project: Project, map: GameMap, site: BuildingSite, opened: readonly number[]): { paved: number; note?: string } {
  if (!opened.length) return { paved: 0 };
  const W = map.width, ts = project.tilesets[map.tilesetId];
  const lay = tilesetSurface(ts).lay;
  const fill = CONSTRUCTION_TOOLS_V3.find((tool) => tool.name === "fill_region");
  const front = site.fronts[0];
  const from = front ? `(${front.x},${front.y})` : "the door front";
  const plain = { paved: 0, note: `Door way opened: the trees/props between the door front ${from} and the walkable ground were removed, so the door can be walked to.` };
  if (!lay.length || !fill) return plain;
  // 그 맵에 가장 많이 깔린 길 재료
  const count = lay.map((l) => { let n = 0; for (let i = 0; i < map.lowerTiles.length; i += 1) if (l.tiles.has(map.lowerTiles[i] ?? -1)) n += 1; return n; });
  const top = count.indexOf(Math.max(...count));
  if (top < 0 || !count[top]) return plain;
  const ramps = map.relief?.ramps;
  const cells = new Set<number>();
  for (const way of site.ways) { if (!way.some((c) => opened.includes(c))) continue; for (const c of way.slice(0, -1)) if (!(ramps?.[c] ?? 0) && !lay.some((l) => l.tiles.has(map.lowerTiles[c] ?? -1))) cells.add(c); }
  let paved = 0;
  for (const c of cells) {
    try { fill.run(project, { mapId: map.id, material: lay[top]!.material, rect: { x: c % W, y: Math.floor(c / W), w: 1, h: 1 }, _exactCells: true }); paved += 1; } catch { /* 길을 못 깔아도 치운 칸은 걷는다 */ }
  }
  if (!paved) return plain;
  return { paved, note: `Door way opened and paved: ${paved} road cell(s) (${lay[top]!.material}) now run from the door front ${from} to the walkable ground.` };
}
