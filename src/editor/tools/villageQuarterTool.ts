// dress_village_quarter — 지은 마을 맵의 트인 땅에 «쓰임 한 덩이»(광산 갱구 마당·포도원·신전 폐허·마법사의 탑 뜰·성벽 장터 좌판·조선 장터)를
// 번들 조각 그대로 한 번에 앉힌다(2026-10-22 마을 종류 표). 조각은 이미 있었다(버들항 bd-pick-mining-valley-* 50개, vineyard·temple-ruins·
// walled-market, 조선 jb-market_stall*). 마법사의 탑(11×16)은 지은 마을 안에 들어갈 땅이 없어 넣지 않았다. 빠져 있던 것은 «마을 종류 → 그 조각 덩이»를 길·문 앞을 막지 않고 모아 놓는 한 단계였다.
// 실조수 시험(r1): 모델이 조선 좌판을 손으로 찍다 7번 거절되고 남은 4개가 관아 마당·밭가에 흩어져 장터로 읽히지 않았다.
// 규칙: 조각 칸은 모두 비고(위층 그림·이벤트 없음)·걸을 수 있고 길(흔한 바닥이 아닌 칸)을 덮지 않는다 — 사방 7칸 넘게 트인 흙 마당은 예외.
// 조각 사이 1칸, 앞줄(아래 한 줄)은 걸을 수 있다. 찍을 때마다 통행을 다시 재서 원래 닿던 칸을 끊으면 되돌린다. 놓기 규칙·높이 단은 stamp_object 가 그대로 본다.
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

interface QuarterDef {
  readonly tilesetId: string;
  readonly ko: string;
  /** 앞의 조각부터 놓는다(첫 조각이 덩이의 중심). */
  readonly pieces: readonly string[];
  /**
   * 마당을 새로 낸다 — 빽빽한 완성 마을(조선 마을 20호)에는 좌판 덩이가 들어갈 빈 땅이 없다(r2 시험: 좌판 7개가 큰길·관아 옆에 흩어졌다).
   * 큰길에 맞닿은 w×h 풀밭(나무·덤불만 있는 곳)을 골라 나무를 통째로 걷고 마당 흙을 깐 뒤 좌판을 두 줄로 세운다. 집·담·소품·길·물은 건드리지 않는다.
   */
  readonly plaza?: { readonly w: number; readonly h: number; readonly ground: readonly number[]; readonly grass: readonly number[]; readonly soft: readonly string[] };
}

export const VILLAGE_QUARTERS: Record<string, QuarterDef> = {
  "joseon-market": { tilesetId: "joseon_baram", ko: "조선 장터 좌판", plaza: { w: 13, h: 9, ground: [4, 5], grass: [0, 1, 2, 3], soft: ["tree", "bush", "sapling", "tuft"] }, pieces: ["jb-market_stall", "jb-market_stall_cloth", "jb-market_stall_pots", "jb-market_stall", "jb-market_stall_cloth", "jb-market_stall_pots", "jb-market_stall", "jb-market_stall_pots"] },
  mining: { tilesetId: "beodeul_city", ko: "광산 갱구 마당", pieces: ["bd-pick-mining-valley-adit", "bd-pick-mining-valley-headframe", "bd-pick-mining-valley-smelt", "bd-pick-mining-valley-slagheap", "bd-pick-mining-valley-cart-h", "bd-pick-mining-valley-ore", "bd-pick-mining-valley-pile", "bd-pick-mining-valley-kiln", "bd-pick-mining-valley-lamp", "bd-pick-mining-valley-crates", "bd-pick-mining-valley-slagrock", "bd-pick-mining-valley-barrel"] },
  vineyard: { tilesetId: "beodeul_city", ko: "포도원", pieces: ["bd-pick-vineyard-winery", "bd-pick-vineyard-vine-field", "bd-pick-vineyard-vine-field", "bd-pick-vineyard-wine-press", "bd-pick-vineyard-pergola", "bd-pick-vineyard-cask-rack", "bd-pick-vineyard-barrels-standing", "bd-pick-vineyard-grape-baskets", "bd-pick-vineyard-olive-a", "bd-pick-vineyard-olive-b", "bd-pick-vineyard-olive-c"] },
  "temple-ruins": { tilesetId: "beodeul_city", ko: "신전 폐허", pieces: ["bd-pick-temple-ruins-roof-naiskos-pediment", "bd-pick-temple-ruins-roof-hip-shrine", "bd-pick-temple-ruins-column-temple-tall", "bd-pick-temple-ruins-column-temple-tall", "bd-pick-temple-ruins-column-temple", "bd-pick-temple-ruins-column-temple-broken", "bd-pick-temple-ruins-fallen-column-temple", "bd-pick-temple-ruins-ruined-wall-2", "bd-pick-temple-ruins-ruined-wall-2", "bd-pick-temple-ruins-cypress-ruin", "bd-pick-temple-ruins-cypress-ruin", "bd-pick-temple-ruins-rubble-temple", "bd-pick-temple-ruins-rubble-temple"] },
  "walled-market": { tilesetId: "beodeul_city", ko: "장터 좌판·짐수레", pieces: ["bd-pick-walled-market-cloth-stall", "bd-pick-walled-market-cloth-stall", "bd-pick-walled-market-wagon", "bd-pick-walled-market-cloth-stall", "bd-pick-walled-market-banner-red", "bd-pick-walled-market-banner-teal", "bd-pick-walled-market-sack-pile", "bd-pick-walled-market-hay-bales", "bd-pick-walled-market-trough", "bd-pick-walled-market-hitching-rail", "bd-pick-walled-market-forge-yard", "bd-pick-walled-market-toll-booth"] },
};

const QUARTER_IDS = Object.keys(VILLAGE_QUARTERS);
const GAP = 1;
const CLUSTER = 10;

const stampTool = (() => {
  const tool = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object");
  if (!tool) throw new Error("stamp_object 가 없습니다");
  return tool;
})();

function reachable(project: Project, map: GameMap, from: { x: number; y: number }): Set<number> {
  const seen = new Set<number>();
  if (!isPassable(project, map, from.x, from.y)) return seen;
  const queue = [from.y * map.width + from.x];
  seen.add(queue[0]!);
  while (queue.length) {
    const i = queue.pop()!;
    const x = i % map.width, y = Math.floor(i / map.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const ni = ny * map.width + nx;
      if (seen.has(ni) || !isPassable(project, map, nx, ny)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return seen;
}

function mainComponent(project: Project, map: GameMap): { seed: { x: number; y: number }; cells: Set<number> } | null {
  const done = new Set<number>();
  let best: { seed: { x: number; y: number }; cells: Set<number> } | null = null;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    if (done.has(i) || !isPassable(project, map, x, y)) continue;
    const comp = reachable(project, map, { x, y });
    for (const c of comp) done.add(c);
    if (!best || comp.size > best.cells.size) best = { seed: { x, y }, cells: comp };
  }
  return best;
}

interface Box { x: number; y: number; w: number; h: number }

/** 조각을 놓을 수 있는 칸 격자(1 = 놓을 수 있음)와 앞줄용 걸을 수 있는 칸 격자. */
function buildGrids(project: Project, map: GameMap, reach: Set<number>): { ok: Uint8Array; walk: Uint8Array } {
  const W = map.width, H = map.height;
  const walk = new Uint8Array(W * H);
  const free = new Uint8Array(W * H);
  const counts = new Map<number, number>();
  let walkN = 0;
  for (let i = 0; i < W * H; i++) {
    const x = i % W, y = Math.floor(i / W);
    if (!reach.has(i) || !isPassable(project, map, x, y)) continue;
    walk[i] = 1;
    walkN++;
    counts.set(map.lowerTiles[i]!, (counts.get(map.lowerTiles[i]!) ?? 0) + 1);
    // 아래 덧층(꽃·풀 포기 같은 바닥 꾸밈)은 덮어도 된다 — 조각이 그 위에 선다. 위층·위 덧층(나무·지붕·소품)은 비어야 한다.
    if ((map.upperTiles[i] ?? -1) < 0 && (map.upperOverlayTiles?.[i] ?? -1) < 0) free[i] = 1;
  }
  for (const e of map.events) if (e.x >= 0 && e.y >= 0 && e.x < W && e.y < H) free[e.y * W + e.x] = 0;
  // 흔한 바닥(걸을 수 있는 칸의 절반 이상을 덮는 바닥) = 풀밭. 나머지는 길로 본다 — 다만 사방 7칸 넘게 트인 흙 마당은 장터 자리다.
  const grass = new Set<number>();
  let covered = 0;
  for (const [tile, n] of [...counts.entries()].sort((p, q) => q[1] - p[1])) { if (covered >= walkN / 2) break; grass.add(tile); covered += n; }
  const isGrass = (i: number) => grass.has(map.lowerTiles[i]!);
  const run = (x: number, y: number, dx: number, dy: number) => {
    let n = 0;
    for (let k = -8; k <= 8; k++) { const nx = x + dx * k, ny = y + dy * k; if (nx >= 0 && ny >= 0 && nx < W && ny < H && free[ny * W + nx] && !isGrass(ny * W + nx)) n++; }
    return n;
  };
  const ok = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!free[i]) continue;
    const x = i % W, y = Math.floor(i / W);
    ok[i] = isGrass(i) || (run(x, y, 1, 0) >= 7 && run(x, y, 0, 1) >= 7) ? 1 : 0;
  }
  return { ok, walk };
}

function boxFits(grid: Uint8Array, walk: Uint8Array, taken: Uint8Array, W: number, H: number, b: Box): boolean {
  if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h + 1 > H) return false;
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) { const i = y * W + x; if (!grid[i] || taken[i]) return false; }
  // 앞줄(아래 한 줄)은 걸을 수 있고 다른 조각이 차지하지 않는다.
  for (let x = b.x; x < b.x + b.w; x++) { const i = (b.y + b.h) * W + x; if (!walk[i] || taken[i]) return false; }
  return true;
}

function mark(taken: Uint8Array, W: number, H: number, b: Box): void {
  for (let y = b.y - GAP; y < b.y + b.h + 1 + GAP; y++) for (let x = b.x - GAP; x < b.x + b.w + GAP; x++) if (x >= 0 && y >= 0 && x < W && y < H) taken[y * W + x] = 1;
}

/** 기준점 둘레(반경 CLUSTER)에서 가까운 순서로 자리 하나. */
function nearestSlot(grid: Uint8Array, walk: Uint8Array, taken: Uint8Array, W: number, H: number, w: number, h: number, ax: number, ay: number, skip = 0): Box | null {
  const found: Box[] = [];
  for (let r = 0; r <= CLUSTER; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const b = { x: ax + dx - Math.floor(w / 2), y: ay + dy - Math.floor(h / 2), w, h };
      if (boxFits(grid, walk, taken, W, H, b)) { found.push(b); if (found.length > skip) return found[skip]!; }
    }
  }
  return null;
}

function kitSize(project: Project, tilesetId: string, kitId: string): { w: number; h: number } | null {
  const kit = project.tilesets[tilesetId]?.structureKits?.find((k) => k.id === kitId);
  return kit ? { w: kit.width, h: kit.height } : null;
}

type TileMetaRow = { readonly tags?: readonly string[] } | null | undefined;

/** 장터 마당 내기: 큰길에 맞닿은 풀밭(나무·덤불만)을 골라 나무를 통째로 걷고 마당 흙을 깐다. 고른 사각형 또는 null. */
function openPlaza(draft: Project, map: GameMap, plaza: NonNullable<QuarterDef["plaza"]>, near: { x: number; y: number } | null): Box | null {
  const W = map.width, H = map.height;
  const meta = (draft.tilesets[map.tilesetId] as unknown as { tileMeta?: readonly TileMetaRow[] }).tileMeta ?? [];
  const kind = (t: number) => (t >= 0 ? meta[t]?.tags?.[1] : undefined);
  const grass = new Set(plaza.grass), soft = new Set(plaza.soft);
  const eventAt = new Set(map.events.map((e) => e.y * W + e.x));
  const upper = (i: number) => map.upperTiles[i] ?? -1;
  const isRoad = (x: number, y: number) => { const i = y * W + x; return !grass.has(map.lowerTiles[i]!) && upper(i) < 0 && isPassable(draft, map, x, y); };
  // 숲 속 나무는 서로 겹쳐 «겹침 칸»으로 이어져 한 그루씩 떼기 어렵다 — 마당과 그 둘레 2칸(RING)의 위층(나무·덤불·겹침)을 통째로 걷는다.
  // 둘레에 집·담·소품(built·prop·wall)이 하나라도 있으면 그 자리는 고르지 않는다(남의 그림을 반쪽 내지 않는다).
  const RING = 1;
  const softOrOverlap = (t: number) => { const k = kind(t) ?? ""; return soft.has(k) || k === "overlap"; };
  let best: { box: Box; score: number; clear: number[] } | null = null;
  for (let y = 1; y + plaza.h < H - 1; y++) for (let x = 1; x + plaza.w < W - 1; x++) {
    let ok = true;
    for (let yy = y; yy < y + plaza.h && ok; yy++) for (let xx = x; xx < x + plaza.w && ok; xx++) {
      const i = yy * W + xx;
      ok = grass.has(map.lowerTiles[i]!) && !eventAt.has(i) && (upper(i) < 0 || softOrOverlap(upper(i)))
        && (map.lowerOverlayTiles?.[i] ?? -1) < 0 && (map.upperOverlayTiles?.[i] ?? -1) < 0;
    }
    if (!ok) continue;
    const clear: number[] = [];
    for (let yy = y - RING; yy < y + plaza.h + RING && ok; yy++) for (let xx = x - RING; xx < x + plaza.w + RING && ok; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx;
      if (upper(i) < 0) continue;
      if (!softOrOverlap(upper(i))) { ok = false; break; }
      clear.push(i);
    }
    if (!ok) continue;
    // 길·마당에 맞닿을수록 장터다(테두리 바깥 칸 중 걸을 수 있는 흙 칸).
    let road = 0;
    for (let xx = x; xx < x + plaza.w; xx++) { if (isRoad(xx, y - 1)) road++; if (isRoad(xx, y + plaza.h)) road++; }
    for (let yy = y; yy < y + plaza.h; yy++) { if (isRoad(x - 1, yy)) road++; if (isRoad(x + plaza.w, yy)) road++; }
    const c = near ?? { x: W / 2, y: H / 2 };
    const score = road * 4 - Math.hypot(x + plaza.w / 2 - c.x, y + plaza.h / 2 - c.y) * 0.5 - clear.length * 0.15;
    if (!best || score > best.score) best = { box: { x, y, w: plaza.w, h: plaza.h }, score, clear };
  }
  if (!best) return null;
  // 둘레 바깥으로 걸친 나무 끝(반쪽 나무)을 2칸까지 더 걷는다.
  const cleared = new Set(best.clear);
  let frontier = [...cleared];
  for (let step = 0; step < 1; step++) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (cleared.has(ni) || upper(ni) < 0 || !softOrOverlap(upper(ni))) continue;
        cleared.add(ni); next.push(ni);
      }
    }
    frontier = next;
  }
  for (const i of cleared) map.upperTiles[i] = -1;
  // 마당에서 가장 가까운 길·흙 칸까지 2칸 폭 흙길을 낸다(풀밭·걷은 칸만 지난다) — 외딴 마당이 아니라 길가 장터로.
  const b = best.box;
  const starts = [
    { x: b.x + Math.floor(b.w / 2), y: b.y - 1, dx: 0, dy: -1 }, { x: b.x + Math.floor(b.w / 2), y: b.y + b.h, dx: 0, dy: 1 },
    { x: b.x - 1, y: b.y + Math.floor(b.h / 2), dx: -1, dy: 0 }, { x: b.x + b.w, y: b.y + Math.floor(b.h / 2), dx: 1, dy: 0 },
  ];
  let lane: { cells: number[] } | null = null;
  for (const st of starts) {
    const cells: number[] = [];
    let x = st.x, y = st.y, hit = false;
    for (let k = 0; k < 14; k++, x += st.dx, y += st.dy) {
      if (x < 0 || y < 0 || x + Math.abs(st.dy) >= W || y + Math.abs(st.dx) >= H) break;
      const pair = [y * W + x, (y + Math.abs(st.dx)) * W + (x + Math.abs(st.dy))];
      if (pair.every((i) => isRoad(i % W, Math.floor(i / W)))) { hit = true; break; }
      if (!pair.every((i) => grass.has(map.lowerTiles[i]!) && (upper(i) < 0 || softOrOverlap(upper(i))) && !eventAt.has(i))) break;
      cells.push(...pair);
    }
    if (hit && (!lane || cells.length < lane.cells.length)) lane = { cells };
  }
  for (const i of lane?.cells ?? []) { map.lowerTiles[i] = plaza.ground[i % plaza.ground.length]!; map.upperTiles[i] = -1; }
  let k = 0;
  for (let yy = best.box.y; yy < best.box.y + best.box.h; yy++) for (let xx = best.box.x; xx < best.box.x + best.box.w; xx++) {
    map.lowerTiles[yy * W + xx] = plaza.ground[(k++ * 7 + yy) % plaza.ground.length]!;
  }
  return best.box;
}

export function dressVillageQuarter(draft: Project, mapId: string, quarterId: string, opts: { count?: number; near?: { x: number; y: number } } = {}): ToolExecResult {
  const quarter = VILLAGE_QUARTERS[quarterId];
  if (!quarter) throw new ToolError(`모르는 쓰임 덩이: ${quarterId} (${QUARTER_IDS.join(", ")})`, { code: "invalid-args" });
  const map = draft.maps[mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found" });
  if (map.tilesetId !== quarter.tilesetId) {
    throw new ToolError(`「${quarter.ko}」(${quarterId}) 조각은 ${quarter.tilesetId} 맵에만 놓는다(이 맵: ${map.tilesetId}).`, { code: "wrong-tileset", mapId: map.id });
  }
  const W = map.width, H = map.height;
  // 마당을 새로 내는 덩이(조선 장터)는 먼저 마당을 깔고 그 안에 좌판을 세운다.
  let plazaBox: Box | null = null;
  if (quarter.plaza) {
    // 좌판 두 줄이 들어가는 크기부터, 안 되면 한 줄 크기로.
    plazaBox = openPlaza(draft, map, quarter.plaza, opts.near ?? null) ?? openPlaza(draft, map, { ...quarter.plaza, h: quarter.plaza.h - 1 }, opts.near ?? null)
      ?? openPlaza(draft, map, { ...quarter.plaza, w: quarter.plaza.w - 4, h: quarter.plaza.h - 1 }, opts.near ?? null);
    if (!plazaBox) throw new ToolError(`「${quarter.ko}」 마당(${quarter.plaza.w}×${quarter.plaza.h}, 큰길에 맞닿은 풀밭·나무 자리)을 낼 곳이 없다 — near 를 주거나 맵을 키운다.`, { code: "no-quarter-slot", mapId: map.id });
    opts = { ...opts, near: { x: plazaBox.x + Math.floor(plazaBox.w / 2), y: plazaBox.y + Math.floor(plazaBox.h / 2) } };
  }
  const comp = mainComponent(draft, map);
  if (!comp) throw new ToolError("맵에 걸을 수 있는 칸이 없다.", { code: "no-walkable", mapId: map.id });
  const { ok: grid, walk } = buildGrids(draft, map, comp.cells);
  // 마당이 있으면 좌판은 마당 안에만(마당 바깥 줄은 통로로 남긴다).
  const ok = plazaBox ? grid.map((v, i) => { const x = i % W, y = Math.floor(i / W); return v && x > plazaBox!.x && x < plazaBox!.x + plazaBox!.w - 1 && y >= plazaBox!.y && y < plazaBox!.y + plazaBox!.h - 1 ? 1 : 0; }) : grid;
  const pieces = quarter.pieces.slice(0, Math.max(2, Math.min(quarter.pieces.length, opts.count ?? quarter.pieces.length)))
    .map((id) => ({ id, size: kitSize(draft, quarter.tilesetId, id) }))
    .filter((p): p is { id: string; size: { w: number; h: number } } => !!p.size);
  if (!pieces.length) throw new ToolError(`${quarter.tilesetId} 에 「${quarter.ko}」 조각이 없다.`, { code: "kit-missing", mapId: map.id });

  // 덩이 중심: near 가 있으면 그 자리, 없으면 앞 조각들이 가장 많이 들어가는 자리(격자 3칸마다 시험).
  let anchor = opts.near ?? null;
  if (!anchor) {
    let best = -1;
    for (let y = 2; y < H - 2; y += 3) for (let x = 2; x < W - 2; x += 3) {
      if (!ok[y * W + x]) continue;
      const taken = new Uint8Array(W * H);
      let fit = 0, area = 0;
      // 앞 조각(덩이의 얼굴 — 갱구·포도주 창고·탑)이 들어가야 그 덩이로 읽힌다: 첫 조각 3배 가산.
      for (const [k, p] of pieces.slice(0, 7).entries()) {
        const b = nearestSlot(ok, walk, taken, W, H, p.size.w, p.size.h, x, y);
        if (!b) continue;
        mark(taken, W, H, b); fit += k === 0 ? 3 : 1; area += b.w * b.h;
      }
      const centre = Math.hypot(x - W / 2, y - H / 2) / Math.max(W, H);
      const score = fit * 1000 + area - centre * 50;
      if (fit > 0 && score > best) { best = score; anchor = { x, y }; }
    }
  }
  if (!anchor) throw new ToolError(`「${quarter.ko}」 첫 조각이 들어갈 트인 땅이 없다 — 마을을 더 크게 짓거나(width·height) 빈 풀밭을 남긴 뒤 다시 부른다.`, { code: "no-quarter-slot", mapId: map.id });

  const taken = new Uint8Array(W * H);
  const placed: { objectId: string; x: number; y: number; w: number; h: number }[] = [];
  let rejected = 0;
  for (const piece of pieces) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const b = nearestSlot(ok, walk, taken, W, H, piece.size.w, piece.size.h, anchor.x, anchor.y, attempt);
      if (!b) break;
      const objectId = `kit:${quarter.tilesetId}/${piece.id}`;
      const snapshot = structuredClone(draft.maps[map.id]!);
      const startBefore = draft.startPos ? { ...draft.startPos } : undefined;
      try {
        stampTool.run(draft, { objectId, mapId: map.id, x: b.x, y: b.y });
      } catch {
        rejected++;
        draft.maps[map.id] = snapshot;
        continue;
      }
      const current = draft.maps[map.id]!;
      const all = [...placed, { objectId, ...b }];
      const inPiece = (x: number, y: number) => all.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h);
      let from = comp.seed;
      if (!isPassable(draft, current, from.x, from.y)) from = { x: b.x, y: b.y + b.h };
      const after = reachable(draft, current, from);
      let cut = false;
      for (const i of comp.cells) { const x = i % W, y = Math.floor(i / W); if (!inPiece(x, y) && !after.has(i)) { cut = true; break; } }
      if (cut) {
        rejected++;
        draft.maps[map.id] = snapshot;
        if (startBefore) draft.startPos = startBefore;
        mark(taken, W, H, { ...b, w: 1, h: 1 });
        continue;
      }
      mark(taken, W, H, b);
      placed.push({ objectId, ...b });
      break;
    }
  }
  if (!placed.length) throw new ToolError(`「${quarter.ko}」 조각을 하나도 놓지 못했다 — 트인 땅이 모자라거나 놓으면 길이 끊긴다. 마을을 더 크게 짓거나 near 를 바꾼다.`, { code: "no-quarter-slot", mapId: map.id });
  const box = placed.reduce((a, p) => ({ x0: Math.min(a.x0, p.x), y0: Math.min(a.y0, p.y), x1: Math.max(a.x1, p.x + p.w), y1: Math.max(a.y1, p.y + p.h) }), { x0: W, y0: H, x1: 0, y1: 0 });
  const missing = pieces.length - placed.length;
  return {
    summary: `${plazaBox ? `큰길가 (${plazaBox.x},${plazaBox.y}) ${plazaBox.w}×${plazaBox.h} 에 마당 흙을 깔고(그 자리 나무는 걷었다) ` : ""}「${quarter.ko}」 ${placed.length}조각을 (${box.x0},${box.y0})~(${box.x1 - 1},${box.y1 - 1}) 에 한 덩이로 앉혔다${missing ? ` (${pieces.length}개 중 — ${missing}개는 자리 부족·놓기 규칙으로 뺐다)` : ""}. 길·문 앞 통행은 그대로다.`,
    data: { mapId: map.id, quarter: quarterId, ...(plazaBox ? { plaza: plazaBox } : {}), pieces: placed, rejected, rect: { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 } },
    ...(missing ? { warnings: [`${missing}개 조각은 놓지 못했다 — 더 넣으려면 마을을 키워 다시 짓거나 near 를 다른 트인 땅으로 준다. 조각을 손으로 흩어 찍지 않는다.`] } : {}),
  };
}

export const DRESS_VILLAGE_QUARTER_TOOL: ToolDefinition = {
  name: "dress_village_quarter",
  mode: "write",
  domains: ["map"],
  description:
    "지은 마을 맵의 트인 땅에 마을의 쓰임 한 덩이를 번들 조각 그대로 한 번에 앉힌다 — 마을 종류 표(find_village_type)의 recipe 가 부른다. "
    + "quarter: mining 광산 갱구 마당(갱구·권양탑·제련소·광재 더미·광차 — 광산촌) · vineyard 포도원(포도주 창고·포도밭 이랑·압착기·올리브 — 포도원 마을) · temple-ruins 신전 폐허(소신전·기둥·무너진 벽 — 고대 유적 마을) · "
    + walled-market 장터 좌판·짐수레·통행세 초소(중세 장터) — 버들항(beodeul_city) 맵 · joseon-market 조선 장터 좌판 — 조선(joseon_baram) 맵. "
    + "조각 칸은 빈 풀밭·트인 흙 마당에만, 길을 덮지 않고, 조각 사이 1칸·앞줄 통행을 지키며, 찍을 때마다 통행을 다시 재서 길·문 앞을 끊는 자리는 되돌린다. near 를 주면 그 둘레, 생략하면 덩이가 가장 크게 들어가는 자리. "
    + "조각을 stamp_object 로 하나씩 흩어 찍지 말 것. 자리가 모자라면 마을을 더 크게 짓는다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      quarter: { type: "string", enum: QUARTER_IDS, description: "쓰임 덩이" },
      count: { type: "integer", minimum: 2, maximum: 13, description: "조각 수 상한(기본 그 덩이 전부)" },
      near: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], additionalProperties: false, description: "덩이 중심(생략하면 도구가 고른다)" },
    },
    required: ["mapId", "quarter"],
    additionalProperties: false,
  },
  invalidArgsExample: { mapId: "map_beodeul_river_1", quarter: "mining" },
  run(draft, args) {
    const near = args.near as { x?: unknown; y?: unknown } | undefined;
    return dressVillageQuarter(draft, String(args.mapId), String(args.quarter), {
      ...(Number.isInteger(args.count) ? { count: args.count as number } : {}),
      ...(near && Number.isInteger(near.x) && Number.isInteger(near.y) ? { near: { x: near.x as number, y: near.y as number } } : {}),
    });
  },
};

/** 「조선 장터 마을」 — dress_village_quarter({quarter:"joseon-market"}) 의 이름 있는 입구(조선 노트·r1 시험이 이 이름을 부른다). */
export const DRESS_JOSEON_MARKET_TOOL: ToolDefinition = {
  name: "dress_joseon_market",
  mode: "write",
  domains: ["map"],
  description: "조선(joseon_baram) 마을 맵에 장터 좌판(jb-market_stall·_cloth·_pots, 3×3) 덩이를 한 번에 앉힌다 — 「조선 장터 마을」은 import_region_reference({id:\"joseon-v20-64x56\"}) 뒤 이 도구 한 번. dress_village_quarter({quarter:\"joseon-market\"}) 와 같다. 좌판을 stamp_object 로 하나씩 흩어 찍지 말 것.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "joseon_baram 맵 id" },
      count: { type: "integer", minimum: 2, maximum: 8, description: "좌판 수(기본 8)" },
      near: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], additionalProperties: false },
    },
    required: ["mapId"],
    additionalProperties: false,
  },
  invalidArgsExample: { mapId: "map_ref_joseon_v20_64x56" },
  run(draft, args) {
    return DRESS_VILLAGE_QUARTER_TOOL.run(draft, { ...args, quarter: "joseon-market" });
  },
};
