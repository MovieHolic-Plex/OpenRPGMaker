// dress_village_quarter — 지은 마을 맵의 트인 땅에 «쓰임 한 덩이»(광산 갱구 마당·포도원·신전 폐허·마법사의 탑 뜰·성벽 장터 좌판·조선 장터)를
// 번들 조각 그대로 한 번에 앉힌다(2026-10-22 마을 종류 표). 조각은 이미 있었다(버들항 bd-pick-mining-valley-* 50개, vineyard·temple-ruins·
// walled-market, 조선 jb-market_stall*). 마법사의 탑(11×16)은 지은 마을 안에 들어갈 땅이 없어 넣지 않았다. 빠져 있던 것은 «마을 종류 → 그 조각 덩이»를 길·문 앞을 막지 않고 모아 놓는 한 단계였다.
// 실조수 시험(r1): 모델이 조선 좌판을 손으로 찍다 7번 거절되고 남은 4개가 관아 마당·밭가에 흩어져 장터로 읽히지 않았다.
// 규칙: 조각 칸은 모두 비고(위층 그림·이벤트 없음)·걸을 수 있고 길(흔한 바닥이 아닌 칸)을 덮지 않는다 — 사방 7칸 넘게 트인 흙 마당은 예외.
// 조각 사이 1칸, 앞줄(아래 한 줄)은 걸을 수 있다. 찍을 때마다 통행을 다시 재서 원래 닿던 칸을 끊으면 되돌린다. 놓기 규칙·높이 단은 stamp_object 가 그대로 본다.
import { isPassable } from "@/project/collision";
import { BEODEUL_YARD_BASE } from "@/project/defaults/beodeulCity";
import type { GameMap, Project } from "@/project/types";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { protectedHouseCells } from "./houseProtection";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

interface QuarterDef {
  readonly tilesetId: string;
  readonly ko: string;
  /** 앞의 조각부터 놓는다(첫 조각이 덩이의 중심). */
  readonly pieces: readonly string[];
  /** 맵마다 몇 개를 골라 더하는 조각(r6: 두 맵이 같은 조각 묶음이었다) */
  readonly extras?: readonly string[];
  /** 얼굴 조각(첫 조각) 대신 맵마다 고르는 다른 얼굴 */
  readonly faces?: readonly string[];
  /**
   * 마당을 새로 낸다 — 빽빽한 완성 마을(조선 마을 20호)에는 좌판 덩이가 들어갈 빈 땅이 없다(r2 시험: 좌판 7개가 큰길·관아 옆에 흩어졌다).
   * 큰길에 맞닿은 w×h 풀밭(나무·덤불만 있는 곳)을 골라 나무를 통째로 걷고 마당 흙을 깐 뒤 좌판을 두 줄로 세운다. 집·담·소품·길·물은 건드리지 않는다.
   */
  readonly plaza?: { readonly w: number; readonly h: number; readonly ground: readonly number[]; readonly grass: readonly number[]; readonly soft: readonly string[]; /** 풀밭 위 걷어도 되는 칸 번호(버들항 자연 이식 칸 — 꽃·풀 무늬·나무, tileMeta 태그 없음) */ readonly softTiles?: readonly number[]; /** 길로 치는 바닥 tileMeta tags[2](또는 tags[1])(밭·논은 길이 아니다) */ readonly roads?: readonly string[]; /** 마당 테두리를 맵마다 다르게 파고(notch), ruin 이면 판석 속에 풀 구멍(빠진 돌)도 낸다 */ readonly rough?: "notch" | "ruin" | "fray" };
  /**
   * 버들항 쓰임 마당(2026-10-22 village-art, ART_GAPS beodeul-quarter-yard): 쓰임 조각을 풀밭에 흩지 않고 «마당 바닥» 위에 모은다.
   * 큰길가 풀밭(나무만 있는 곳)을 w×h 로 개간해 마당 오토타일(8방, 가장자리·안쪽 모서리)을 깔고, 길까지 같은 바닥으로 샛길을 낸 뒤 그 안에 조각을 세운다.
   * 마당 그룹이 시트에 없으면(옛 번들) 예전처럼 마당 없이 앉힌다.
   */
  readonly yard?: { /** 무너진 마당(빠진 판석 사이 풀) */ readonly ruin?: true; /** 조각을 마당 가운데가 아니라 북서 귀부터 채운다(큰 조각 여럿이 한 마당에 들어가야 할 때) */ readonly pack?: "corner"; /** 마당 밖 풀밭에 두는 조각(밭 이랑·과수처럼 땅에 심는 것) */ readonly outside?: readonly string[]; readonly group: string; readonly w: number; readonly h: number };
}

/** 버들항 마당 바닥: 풀밭 칸(tags[1] grass)·걷어 낼 위층(tree)·길(road·plaza·sand). */
const BEODEUL_YARD_SOFT = ["tree", "bush", "sapling", "tuft", "decal"] as const;
const BEODEUL_YARD_ROADS = ["road", "plaza", "sand", "walk", "bridge"] as const;

/** 버들항 마을에서 마당을 까는 덩이 — author_beodeul_town({quarter}) 이 그 크기(마당 + 둘레·흔들기 여유)를 미리 비워 둔다. */
export const BEODEUL_YARD_QUARTERS = ["mining", "vineyard", "temple-ruins"] as const;
export function beodeulYardReserve(quarter: string): { w: number; h: number } | undefined {
  const y = VILLAGE_QUARTERS[quarter]?.yard;
  return y && VILLAGE_QUARTERS[quarter]!.tilesetId === "beodeul_city" ? { w: y.w + 3, h: y.h + 3 } : undefined;
}

export const VILLAGE_QUARTERS: Record<string, QuarterDef> = {
  "joseon-market": { tilesetId: "joseon_baram", ko: "조선 장터 좌판", plaza: { w: 13, h: 9, ground: [4, 5], grass: [0, 1, 2, 3], soft: ["tree", "bush", "sapling", "tuft"], roads: ["road16", "yard16", "yard"] }, pieces: ["jb-market_stall", "jb-market_stall_cloth", "jb-market_stall_pots", "jb-market_stall", "jb-market_stall_cloth", "jb-market_stall_pots", "jb-market_stall", "jb-market_stall_pots"] },
  mining: { tilesetId: "beodeul_city", ko: "광산 갱구 마당", yard: { group: "beodeul_yard_dirt", w: 20, h: 12 }, pieces: ["bd-pick-mining-valley-adit", "bd-pick-mining-valley-headframe", "bd-pick-mining-valley-smelt", "bd-pick-mining-valley-slagheap", "bd-pick-mining-valley-cart-h", "bd-pick-mining-valley-ore", "bd-pick-mining-valley-pile", "bd-pick-mining-valley-kiln", "bd-pick-mining-valley-lamp", "bd-pick-mining-valley-crates", "bd-pick-mining-valley-slagrock", "bd-pick-mining-valley-barrel"], extras: ["bd-pick-mining-valley-chimney", "bd-pick-mining-valley-bin", "bd-pick-mining-valley-sluice", "bd-pick-mining-valley-rack", "bd-pick-mining-valley-board", "bd-pick-mining-valley-cart", "bd-pick-mining-valley-bench", "bd-pick-mining-valley-buffer", "bd-pick-mining-valley-s2", "bd-pick-mining-valley-slagheap"] },
  vineyard: { tilesetId: "beodeul_city", ko: "포도원", yard: { group: "beodeul_yard_dirt", w: 26, h: 15, pack: "corner", outside: ["bd-pick-vineyard-olive-a", "bd-pick-vineyard-olive-b", "bd-pick-vineyard-olive-c"] }, pieces: ["bd-pick-vineyard-winery", "bd-pick-vineyard-olive-a", "bd-pick-vineyard-olive-b", "bd-pick-vineyard-olive-c"],
    // r10: 두 seed 가 같은 창고·술통 시렁·압착기·바구니 도장이었다 — 창고만 늘 두고 나머지 살림은 맵마다 2~4개 골라 쓴다. 포도밭은 조각이 아니라 남은 마당을 두 칸 높이 포도나무 줄로 채운다(fillVineRows).
    extras: ["bd-pick-vineyard-wine-press", "bd-pick-vineyard-pergola", "bd-pick-vineyard-cask-rack", "bd-pick-vineyard-barrels-standing", "bd-pick-vineyard-grape-baskets", "bd-pick-walled-market-wagon", "bd-pick-walled-market-sack-pile", "bd-pick-mining-valley-barrel", "bd-out-woodshed", "bd-pick-riverside-mill-laundry-line", "bd-farm-coop"],
    // r11: 두 seed 가 같은 포도주 창고였다 — 맵 열에 넷은 농장 헛간을 압착·저장 집으로.
    faces: ["bd-farm-barn"] },
  "temple-ruins": { tilesetId: "beodeul_city", ko: "신전 폐허", yard: { group: "beodeul_yard_dirt", w: 16, h: 11, ruin: true }, pieces: ["bd-pick-temple-ruins-roof-naiskos-pediment", "bd-pick-temple-ruins-roof-hip-shrine", "bd-pick-temple-ruins-column-temple-tall", "bd-pick-temple-ruins-column-temple-tall", "bd-pick-temple-ruins-column-temple", "bd-pick-temple-ruins-column-temple-broken", "bd-pick-temple-ruins-fallen-column-temple", "bd-pick-temple-ruins-ruined-wall-2", "bd-pick-temple-ruins-ruined-wall-2", "bd-pick-temple-ruins-cypress-ruin", "bd-pick-temple-ruins-rubble-temple", "bd-pick-temple-ruins-rubble-temple"], faces: ["bd-pick-temple-ruins-roof-baldachin", "bd-pick-temple-ruins-roof-hip-storehouse"], extras: ["bd-pick-temple-ruins-mosaic-medallion-5x5", "bd-pick-temple-ruins-floor-ruin", "bd-pick-temple-ruins-floor-ruin", "bd-pick-temple-ruins-floor-ruin", "bd-pick-temple-ruins-column-temple-broken", "bd-pick-temple-ruins-fallen-column-temple", "bd-pick-temple-ruins-rubble-temple", "bd-pick-temple-ruins-face-temple-2h", "bd-pick-temple-ruins-roof-hip-shrine"] },
  // 북방 바이킹: 눈 마을(compose_snow_north_map village)에 북방 표지(룬석·방패 무기 걸이·오로라 깃발, 자리가 나면 통널 교회)를 광장 둘레에 한 덩이로. 장옥(7×5)은 작곡기가 빈 눈밭을 마당 덩이로 채워 들어갈 자리가 없다 — r2 적대 검수 «바이킹 표지가 없어 그냥 눈 마을» 수정.
  viking: { tilesetId: "snow_north", ko: "바이킹 표지(룬석·방패 걸이·오로라 깃발)", pieces: ["sn-rune-stone", "sn-weapon-rack", "sn-banner-aurora", "sn-rune-stone", "sn-weapon-rack", "sn-banner-aurora-b", "sn-cairn", "sn-rune-stone", "sn-weapon-rack", "sn-stave-church"] },
  "walled-market": { tilesetId: "beodeul_city", ko: "장터 좌판·짐수레", yard: { group: "beodeul_yard_cobble", w: 18, h: 11 }, pieces: ["bd-pick-walled-market-cloth-stall", "bd-pick-walled-market-cloth-stall", "bd-pick-walled-market-wagon", "bd-pick-walled-market-cloth-stall", "bd-pick-walled-market-banner-red", "bd-pick-walled-market-banner-teal", "bd-pick-walled-market-sack-pile", "bd-pick-walled-market-hay-bales", "bd-pick-walled-market-trough", "bd-pick-walled-market-hitching-rail", "bd-pick-walled-market-forge-yard", "bd-pick-walled-market-toll-booth"] },
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

/** 완성된 집 보호 칸 — 덩이·마당·샛길이 여기 들어가면 커밋 관문(houseProtection)이 맵 변경 전체를 거절한다(village-art r0: 신전 폐허 덩이가 이것으로 통째 실패). */
function protectedSet(map: GameMap): Set<number> {
  return new Set(protectedHouseCells(map).map((c) => c.y * map.width + c.x));
}

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
  for (const i of protectedSet(map)) free[i] = 0;
  // 흔한 바닥(걸을 수 있는 칸의 절반 이상을 덮는 바닥) = 풀밭. 나머지는 길로 본다 — 다만 사방 7칸 넘게 트인 흙 마당은 장터 자리다.
  const grass = new Set<number>();
  let covered = 0;
  for (const [tile, n] of [...counts.entries()].sort((p, q) => q[1] - p[1])) { if (covered >= walkN / 2) break; grass.add(tile); covered += n; }
  // 같은 바닥의 변주(눈밭 물결·발자국·마른 풀 끝 등)도 풀밭이다 — tileMeta 태그 앞 네 개가 같으면 같은 바닥. 실측(설원): 눈밭 1번만 풀밭으로 치면 2·3·4번 변주가 «길»로 잡혀 7×5 장옥 자리가 하나도 없었다.
  const meta = (project.tilesets[map.tilesetId] as unknown as { tileMeta?: readonly ({ tags?: readonly string[] } | null)[] }).tileMeta ?? [];
  const sig = (t: number) => { const tags = t >= 0 ? meta[t]?.tags : undefined; return tags && tags.length >= 3 ? tags.slice(0, 4).join("|") : null; };
  const grassSigs = new Set([...grass].map(sig).filter((k): k is string => !!k));
  if (grassSigs.size) for (const tile of counts.keys()) { const k = sig(tile); if (k && grassSigs.has(k)) grass.add(tile); }
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
function nearestSlot(grid: Uint8Array, walk: Uint8Array, taken: Uint8Array, W: number, H: number, w: number, h: number, ax: number, ay: number, skip = 0, radius = CLUSTER): Box | null {
  const found: Box[] = [];
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const b = { x: ax + dx - Math.floor(w / 2), y: ay + dy - Math.floor(h / 2), w, h };
      if (boxFits(grid, walk, taken, W, H, b)) { found.push(b); if (found.length > skip) return found[skip]!; }
    }
  }
  return null;
}

/** 마당 안을 북서 귀부터 읽는 순서로 훑어 첫 자리(skip 번째). 큰 조각 여럿이 한 마당에 빽빽이 들어가게. */
function packSlot(grid: Uint8Array, walk: Uint8Array, taken: Uint8Array, W: number, H: number, w: number, h: number, box: Box, skip = 0, fromRight = false, fromBottom = false): Box | null {
  let n = 0;
  for (let r = 0; r + h <= box.h; r++) for (let k = 0; k + w <= box.w; k++) {
    const y = fromBottom ? box.y + box.h - h - r : box.y + r;
    const x = fromRight ? box.x + box.w - w - k : box.x + k;
    const b = { x, y, w, h };
    if (boxFits(grid, walk, taken, W, H, b)) { if (n === skip) return b; n++; }
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
  for (const i of protectedSet(map)) eventAt.add(i); // 집 보호 칸은 이벤트 칸처럼 피한다(마당·샛길 모두)
  const upper = (i: number) => map.upperTiles[i] ?? -1;
  const roadTags = new Set(plaza.roads ?? []);
  const isRoad = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = y * W + x, t = map.lowerTiles[i]!;
    if (roadTags.size && !roadTags.has(t >= 0 ? meta[t]?.tags?.[2] ?? "" : "") && !roadTags.has(t >= 0 ? meta[t]?.tags?.[1] ?? "" : "")) return false;
    return !grass.has(t) && upper(i) < 0 && isPassable(draft, map, x, y);
  };
  // 숲 속 나무는 서로 겹쳐 «겹침 칸»으로 이어져 한 그루씩 떼기 어렵다 — 마당과 그 둘레 2칸(RING)의 위층(나무·덤불·겹침)을 통째로 걷는다.
  // 둘레에 집·담·소품(built·prop·wall)이 하나라도 있으면 그 자리는 고르지 않는다(남의 그림을 반쪽 내지 않는다).
  const RING = 1;
  // 버들항 장소 조각(tags = [버들항, 버들항 장소, tree|decal|…])은 종류가 세 번째 칸에 있다 — 두 칸 다 본다.
  const softTiles = new Set(plaza.softTiles ?? []);
  const softOrOverlap = (t: number) => { if (softTiles.has(t)) return true; const k = kind(t) ?? "", k2 = (t >= 0 ? meta[t]?.tags?.[2] : undefined) ?? ""; return soft.has(k) || soft.has(k2) || k === "overlap"; };
  const freeOverlay = (t: number | undefined) => (t ?? -1) < 0 || softTiles.has(t!);
  // 높이 지형(relief) 맵: 마당은 한 단 위에만(둘레 위 1줄·아래 2줄까지 같은 단) — 절벽이 마당을 가로지르거나 갱구가 절벽 끝에 붙지 않게.
  const lv = (i: number) => map.relief?.levels?.[i] ?? 0;
  const sameLevel = (x: number, y: number, w: number, h: number) => {
    const at = lv(y * W + x);
    for (let yy = y - 1; yy < y + h + 2; yy++) for (let xx = x - 1; xx < x + w + 1; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if (lv(yy * W + xx) !== at) return false;
    }
    return true;
  };
  // 마당(자연 이식 칸을 아는 경우): 나무 덩이 크기를 먼저 잰다. 숲(24칸 넘는 덩이)을 건드리는 자리는 고르지 않는다 — 숲을 깎으면 계단처럼 잘린 수관·반쪽 나무가 남는다.
  // 이 크기 이하 덩이(덤불·나무 몇 그루·작은 숲 덩이)는 통째로 걷을 수 있다. 더 큰 숲은 건드리지 않는다.
  const FOREST = 90;
  const compSize = new Int32Array(W * H);
  if (softTiles.size) {
    const seen = new Uint8Array(W * H);
    for (let i0 = 0; i0 < W * H; i0++) {
      if (seen[i0] || upper(i0) < 0 || !softOrOverlap(upper(i0))) continue;
      const comp = [i0]; seen[i0] = 1;
      for (let q = 0; q < comp.length; q++) { const i = comp[q]!, x = i % W, y = (i - x) / W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
          if (j < 0 || seen[j] || upper(j) < 0 || !softOrOverlap(upper(j))) continue; seen[j] = 1; comp.push(j); } }
      for (const i of comp) compSize[i] = comp.length;
    }
  }
  let best: { box: Box; score: number; clear: number[] } | null = null;
  for (let y = 1; y + plaza.h < H - 1; y++) for (let x = 1; x + plaza.w < W - 1; x++) {
    let ok = true;
    for (let yy = y; yy < y + plaza.h && ok; yy++) for (let xx = x; xx < x + plaza.w && ok; xx++) {
      const i = yy * W + xx;
      ok = grass.has(map.lowerTiles[i]!) && !eventAt.has(i) && (upper(i) < 0 || (softOrOverlap(upper(i)) && !(softTiles.size && compSize[i]! > FOREST)))
        && freeOverlay(map.lowerOverlayTiles?.[i]) && freeOverlay(map.upperOverlayTiles?.[i])
        // 숲 나무의 줄기·그림자 칸(덧칠)도 마당에 넣지 않는다 — 지우면 수관만 떠 있다.
        && !(softTiles.size && (map.lowerOverlayTiles?.[i] ?? -1) >= 0 && [i - W, i - W - 1, i - W + 1, i - 1, i + 1].some((j) => j >= 0 && j < W * H && compSize[j]! > FOREST));
    }
    if (!ok) continue;
    if (softTiles.size && map.relief && !sameLevel(x, y, plaza.w, plaza.h)) continue;
    const clear: number[] = [];
    let forestCut = 0;
    for (let yy = y - RING; yy < y + plaza.h + RING && ok; yy++) for (let xx = x - RING; xx < x + plaza.w + RING && ok; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx;
      if (upper(i) < 0) continue;
      if (!softOrOverlap(upper(i))) { ok = false; break; }
      // 둘레의 숲(큰 덩이)은 베지 않고 그대로 둔다 — r3: 숲 끝을 칸 선으로 잘라 계단·성가퀴 모양과 넓은 빈 풀 띠가 남았다.
      if (softTiles.size && compSize[i]! > FOREST) { forestCut++; continue; }
      clear.push(i);
    }
    if (!ok) continue;
    // 길·마당에 맞닿을수록 장터다(테두리 바깥 칸 중 걸을 수 있는 흙 칸).
    let road = 0;
    for (let xx = x; xx < x + plaza.w; xx++) { if (isRoad(xx, y - 1)) road++; if (isRoad(xx, y + plaza.h)) road++; }
    for (let yy = y; yy < y + plaza.h; yy++) { if (isRoad(x - 1, yy)) road++; if (isRoad(x + plaza.w, yy)) road++; }
    const c = near ?? { x: W / 2, y: H / 2 };
    const score = road * 4 - Math.hypot(x + plaza.w / 2 - c.x, y + plaza.h / 2 - c.y) * 0.5 - clear.length * 0.15 - forestCut * 2; // r2: 숲 가장자리를 베면 계단 모양 끝이 남는다 — 숲을 덜 베는 자리를 고른다.
    if (!best || score > best.score) best = { box: { x, y, w: plaza.w, h: plaza.h }, score, clear };
  }
  if (!best) return null;
  // 둘레 바깥으로 걸친 나무 끝(반쪽 나무)을 2칸까지 더 걷는다.
  const cleared = new Set(best.clear);
  let frontier = [...cleared];
  const nb4 = (i: number): number[] => { const x = i % W, y = Math.floor(i / W); const o: number[] = [];
    if (x > 0) o.push(i - 1); if (x < W - 1) o.push(i + 1); if (y > 0) o.push(i - W); if (y < H - 1) o.push(i + W); return o; };
  if (softTiles.size) {
    // 마당(자연 이식 칸을 아는 경우): 걷은 칸에 붙은 나무·덤불 덩이를 통째로 걷는다(반쪽 나무 금지). 덩이가 숲(24칸 넘음)이면 3걸음까지만.
    for (const seed of [...cleared]) for (const n0 of nb4(seed)) {
      if (cleared.has(n0) || upper(n0) < 0 || !softOrOverlap(upper(n0))) continue;
      const comp = [n0], seen = new Set([n0]);
      for (let q = 0; q < comp.length && comp.length <= FOREST; q++) for (const n of nb4(comp[q]!)) {
        if (seen.has(n) || cleared.has(n) || upper(n) < 0 || !softOrOverlap(upper(n))) continue; seen.add(n); comp.push(n);
      }
      if (comp.length <= FOREST) for (const c of comp) cleared.add(c);
      // 큰 숲 덩이는 건드리지 않는다(반쪽 나무·계단 끝 금지).
    }
  } else for (let step = 0; step < 1; step++) {
    const next: number[] = [];
    for (const i of frontier) {
      for (const ni of nb4(i)) {
        if (cleared.has(ni) || upper(ni) < 0 || !softOrOverlap(upper(ni))) continue;
        cleared.add(ni); next.push(ni);
      }
    }
    frontier = next;
  }
  for (const i of cleared) map.upperTiles[i] = -1;
  // 마당 칸과 걷은 나무 칸(과 그 바로 아래 그림자 칸)의 자연 덧칠(꽃·풀 무늬·나무 그림자)도 걷는다 — 유령 그림자가 남지 않게.
  if (softTiles.size) {
    const wipe = (i: number) => {
      if (map.lowerOverlayTiles && softTiles.has(map.lowerOverlayTiles[i]!)) map.lowerOverlayTiles[i] = -1;
      if (map.upperOverlayTiles && softTiles.has(map.upperOverlayTiles[i]!)) map.upperOverlayTiles[i] = -1;
    };
    for (let yy = best.box.y; yy < best.box.y + best.box.h; yy++) for (let xx = best.box.x; xx < best.box.x + best.box.w; xx++) wipe(yy * W + xx);
    // 걷은 칸 둘레 한 칸까지: 남은 나무가 위·옆에 없는 칸의 자연 덧칠(그림자 조각)은 지운다.
    const natureUpperNear = (i: number) => [i - W, i - 1, i + 1, i - W - 1, i - W + 1].some((j) => j >= 0 && j < W * H && Math.abs((j % W) - (i % W)) <= 1 && upper(j) >= 0 && softTiles.has(upper(j)));
    for (const i of cleared) { wipe(i); for (const j of [i + W, i - 1, i + 1, i + W - 1, i + W + 1]) if (j >= 0 && j < W * H && Math.abs((j % W) - (i % W)) <= 1 && upper(j) < 0 && !natureUpperNear(j) && map.lowerOverlayTiles && softTiles.has(map.lowerOverlayTiles[j]!)) map.lowerOverlayTiles[j] = -1; }
  }
  // 마당 테두리 어디서든 가장 가까운 길·흙 칸까지 흙길을 낸다(BFS, 나무 없는 풀밭만 지난다 — 나무를 반쪽 내지 않는다) — 외딴 마당이 아니라 길가 장터로.
  // r3 실측: 가운데 네 방향 직선만 보던 이전 판은 밭·숲을 돌아가야 하는 마당에서 길을 못 냈다.
  const b = best.box;
  const inBox = (x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  const boxLevel = lv(b.y * W + b.x);
  const walkable = (i: number) => grass.has(map.lowerTiles[i]!) && upper(i) < 0 && !eventAt.has(i) && (!softTiles.size || lv(i) === boxLevel)
    && freeOverlay(map.lowerOverlayTiles?.[i]) && freeOverlay(map.upperOverlayTiles?.[i]);
  const prev = new Map<number, number>();
  let queue: number[] = [];
  let touching = false;
  const touchCells: number[] = [];
  for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = xx + dx, ny = yy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || inBox(nx, ny)) continue;
      const ni = ny * W + nx;
      if (isRoad(nx, ny) && (!softTiles.size || lv(ni) === boxLevel)) { touching = true; touchCells.push(ni); } // 이미 길에 맞닿았다 — 길을 낼 필요 없다.
      else if (!prev.has(ni) && walkable(ni)) { prev.set(ni, -1); queue.push(ni); }
    }
  }
  let laneCells: number[] = [];
  for (let depth = 0; !touching && queue.length && depth < 24 && !laneCells.length; depth++) {
    const next: number[] = [];
    for (const i of queue) {
      const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || inBox(nx, ny)) continue;
        const ni = ny * W + nx;
        if (isRoad(nx, ny) && (!softTiles.size || lv(ni) === boxLevel)) { for (let c = i; c !== -1; c = prev.get(c)!) laneCells.push(c); break; }
        if (prev.has(ni) || !walkable(ni)) continue;
        prev.set(ni, i); next.push(ni);
      }
      if (laneCells.length) break;
    }
    queue = next;
  }
  // 맞닿은 길이 모랫길(가는 길 그림 — 칸 둘레가 풀)이면 마당과 길 사이에 풀 띠가 보였다(r4 검수) — 마당 가운데에 가까운 맞닿은 길 두 칸을 마당 흙으로 이어 입구를 낸다.
  if (touching && softTiles.size && touchCells.length) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const near = [...new Set(touchCells)].sort((p, q) => Math.hypot(p % W - cx, Math.floor(p / W) - cy) - Math.hypot(q % W - cx, Math.floor(q / W) - cy));
    const first = near[0]!; const pair = near.find((c) => c !== first && Math.abs(c - first) === 1 && Math.floor(c / W) === Math.floor(first / W)) ?? near.find((c) => c !== first && Math.abs(c - first) === W);
    laneCells = [first, ...(pair !== undefined ? [pair] : [])];
  }
  const lane = laneCells.length ? { cells: laneCells } : null;
  // 마당 샛길은 두 칸 폭(한 칸 띠는 양쪽 연석만 남아 장난감 같다) — 걸을 수 있는 옆 칸을 하나 더 붙인다.
  // r14: 늘 오른쪽·아래로만 붙인 두 칸 띠가 마당에서 길까지 «자로 그은 한 칸 꼬리»로 읽혔다 — 붙이는 쪽을 2~4칸마다 바꿔 띠가 한 칸씩 어긋나게 꺾이고,
  // 마당 쪽 끝과 길 쪽 끝은 세 칸으로 벌린다(입구 나팔). 한쪽이 막히면 다른 쪽을 쓴다.
  if (lane && softTiles.size) {
    const set = new Set(lane.cells), extra: number[] = [];
    let ls = fdFmix(((b.x * 2246822519) ^ (b.y * 3266489917) ^ (lane.cells.length * 668265263)) >>> 0);
    const lrnd = () => { ls = (Math.imul(ls, 1664525) + 1013904223) >>> 0; return ls / 4294967296; };
    const add = (i: number, ni: number) => {
      if (ni < 0 || ni >= W * H || set.has(ni) || Math.abs((ni % W) - (i % W)) > 1 || !walkable(ni)) return false;
      set.add(ni); extra.push(ni); return true;
    };
    let side = lrnd() < 0.5 ? 1 : -1, left = 2 + Math.floor(lrnd() * 3);
    const cells = [...lane.cells];
    cells.forEach((i, k) => {
      const vertical = cells.includes(i - W) || cells.includes(i + W) || (cells.length === 1 && (inBox(i % W, Math.floor(i / W) - 1) || inBox(i % W, Math.floor(i / W) + 1)));
      if (--left <= 0) { side = -side; left = 2 + Math.floor(lrnd() * 3); }
      const [p, q] = vertical ? [i + side, i - side] : [i + side * W, i - side * W];
      // 길에 바로 맞닿은 입구(모랫길 두 칸)는 예전처럼 아래·오른쪽 한 칸만 — 양쪽을 벌리면 길 건너 풀밭까지 흙이 번진다.
      if (touching) { add(i, vertical ? i + 1 : i + W); return; }
      if (k === 0 || k === cells.length - 1) { add(i, p); add(i, q); } else if (!add(i, p)) add(i, q);
    });
    lane.cells.push(...extra);
  }
  for (const i of lane?.cells ?? []) {
    map.lowerTiles[i] = plaza.ground[i % plaza.ground.length]!; map.upperTiles[i] = -1;
    if (map.lowerOverlayTiles && softTiles.has(map.lowerOverlayTiles[i]!)) map.lowerOverlayTiles[i] = -1;
    if (map.upperOverlayTiles && softTiles.has(map.upperOverlayTiles[i]!)) map.upperOverlayTiles[i] = -1;
  }
  const origLower = map.lowerTiles.slice();
  let k = 0;
  for (let yy = best.box.y; yy < best.box.y + best.box.h; yy++) for (let xx = best.box.x; xx < best.box.x + best.box.w; xx++) {
    map.lowerTiles[yy * W + xx] = plaza.ground[(k++ * 7 + yy) % plaza.ground.length]!;
  }
  // 마당 네 귀를 한 칸씩 풀밭으로 되돌려 각진 상자 대신 귀가 둥근 마당으로(오토타일이 안쪽 모서리를 맞춘다).
  if (softTiles.size) for (const [cx, cy] of [[b.x, b.y], [b.x + b.w - 1, b.y], [b.x, b.y + b.h - 1], [b.x + b.w - 1, b.y + b.h - 1]] as const) {
    const i = cy * W + cx; map.lowerTiles[i] = origLower[i]!;
  }
  if (softTiles.size && plaza.rough) roughenYard(map, b, origLower, new Set(lane?.cells ?? []), plaza.rough);
  return best.box;
}

/**
 * 마당 테두리·속을 맵마다 다르게(r5 검수: 두 맵의 마당이 같은 둥근 사각형·같은 윤곽으로 읽혔다, 신전 판석 마당이 «새로 깐 광장»이었다).
 * notch: 네 변에 폭 2~3·깊이 1 홈을 0~2개씩 판다(귀에서 2칸 떨어져, 샛길 칸·그 이웃은 건드리지 않는다). 오토타일에 변·안쪽 모서리가 다 있어 폭 2 이상이면 맞는다.
 * ruin: 판석 속 풀 구멍은 연석 테두리 때문에 «네모 화단»으로 읽혀 쓰지 않는다 — 조각을 놓은 뒤 overgrowYard 가 돌 틈 풀을 덧그린다.
 */
function roughenYard(map: GameMap, b: Box, origLower: readonly number[], lane: ReadonlySet<number>, mode: "notch" | "ruin" | "fray"): void {
  const W = map.width;
  let st = ((b.x * 2654435761) ^ (b.y * 40503) ^ (W * 97) ^ (b.w * 7919)) >>> 0;
  const rnd = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
  const nearLane = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (lane.has((y + dy) * W + x + dx)) return true; return false; };
  const revert = (cells: [number, number][]) => { if (cells.some(([x, y]) => nearLane(x, y))) return; for (const [x, y] of cells) map.lowerTiles[y * W + x] = origLower[y * W + x]!; };
  const sides: { len: number; at: (t: number) => [number, number] }[] = [
    { len: b.w, at: (t) => [b.x + t, b.y] }, { len: b.w, at: (t) => [b.x + t, b.y + b.h - 1] },
    { len: b.h, at: (t) => [b.x, b.y + t] }, { len: b.h, at: (t) => [b.x + b.w - 1, b.y + t] },
  ];
  // r14 fray(포도원): 홈 몇 개로는 풀과 맞닿은 변이 자로 그은 직선으로 남았다 — 변 전체를 2~5칸 구간마다 깊이 0~2(이웃 구간과 한 칸 차)로 풀에 내준다.
  // 구간이 두 칸 이상이고 깊이 차가 한 칸이라 한 칸 손가락은 생기지 않는다. 귀 두 칸은 깊이 1 이상(둥근 귀).
  if (mode === "fray") {
    const inward = [[0, 1], [0, -1], [1, 0], [-1, 0]] as const;
    sides.forEach((sd, si) => {
      const [ix, iy] = inward[si]!;
      let d = rnd() < 0.5 ? 0 : 1, run = 2 + Math.floor(rnd() * 4);
      for (let t = 0; t < sd.len; t++) {
        if (--run <= 0) { d = Math.max(0, Math.min(2, d + (rnd() < 0.5 ? -1 : 1))); run = 2 + Math.floor(rnd() * 4); }
        const dd = t < 2 || t >= sd.len - 2 ? Math.max(1, d) : d;
        const [x0, y0] = sd.at(t);
        const cells: [number, number][] = Array.from({ length: dd }, (_, k) => [x0 + ix * k, y0 + iy * k]);
        if (cells.length) revert(cells);
      }
    });
    // 깎고 남은 한 칸 폭 혀(좌우 또는 위아래가 다 풀)와 외톨이 칸은 풀로 — 마당 변이 «빗살»로 읽히지 않게.
    const H = map.height;
    const dirtAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (lane.has(y * W + x) || (x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h && map.lowerTiles[y * W + x] !== origLower[y * W + x]));
    for (let pass = 0; pass < 3; pass++) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      if (!dirtAt(x, y) || nearLane(x, y)) continue;
      const n = dirtAt(x, y - 1), s = dirtAt(x, y + 1), e = dirtAt(x + 1, y), w = dirtAt(x - 1, y);
      if ((!e && !w) || (!n && !s) || [n, s, e, w].filter(Boolean).length <= 1) map.lowerTiles[y * W + x] = origLower[y * W + x]!;
    }
    return;
  }
  for (const sd of sides) {
    const n = mode === "ruin" ? 1 + Math.floor(rnd() * 3) : Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const nw = 2 + Math.floor(rnd() * (mode === "ruin" ? 3 : 2)); if (sd.len < nw + 6) continue;
      const t0 = 2 + Math.floor(rnd() * (sd.len - nw - 4));
      revert(Array.from({ length: nw }, (_, j) => sd.at(t0 + j)));
    }
  }
  void mode;
}

/**
 * 무너진 판석 섬(r11, 버들항 판석→흙 가장자리 beodeul_yard_flag_dirt — flag_dirt_art.py r7): 신전 폐허 마당은 다진 흙이고, 그 안쪽에
 * 판석 섬을 깐다. 판석 가장자리는 연석 없이 판 단위로 깨져 흙으로 무너진다(옛 판석 마당은 연석 테가 «갓 깐 광장», 흙으로 바꾼 칸은 «네모 구멍»으로 읽혔다, r8~r10).
 * 섬 = 마당 바깥(풀)에서 두 칸 이상 안쪽 칸 — 바깥 고리 두세 줄은 잡음 덩이로 들쭉날쭉 깎고, 외톨이 칸·한 칸 구멍은 메운다.
 * 가장자리 칸 벌은 flag_dirt_art.phase_role 그대로(같은 변을 따라 세 칸 안에 같은 칸이 없다). 그룹이 없는 옛 사본은 null(마당은 흙만).
 */
const FD_BASE_ROLES = ["N", "S", "W", "E", "NW", "NE", "SW", "SE", "iso", "inNW", "inNE", "inSE", "inSW"] as const;
const FD_CORNERS = ["NW", "NE", "SW", "SE", "inNW", "inNE", "inSE", "inSW"] as const;
const fdFmix = (h: number): number => { h = (h ^ (h >>> 16)) >>> 0; h = Math.imul(h, 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const fdHash = (a: number, b: number, salt: number): number => fdFmix(((Math.imul(a, 0x9e3779b1) >>> 0) + (Math.imul(b, 0x85ebca77) >>> 0) + (Math.imul(salt, 0xc2b2ae3d) >>> 0)) >>> 0);
const fdSeq = new Map<string, number[]>();
function fdGreedy(n: number, salt: number, line: number, k: number): number {
  const key = `${n}/${salt}/${line}`; let g = fdSeq.get(key); if (!g) { g = []; fdSeq.set(key, g); }
  while (g.length <= k) {
    const i = g.length;
    for (let t = 0; ; t++) { const c = fdHash(i, line, salt + 1000 * t) % n; if (c !== g[i - 1] && c !== g[i - 2] && c !== g[i - 3]) { g.push(c); break; } }
  }
  return g[k]!;
}
function fdMaskRole(m: number): string {
  const N = m & 1, E = m & 2, S = m & 4, Wd = m & 8, NE = m & 16, SE = m & 32, SW = m & 64, NW = m & 128;
  if (!(N || E || S || Wd)) return "iso";
  if (N && E && S && Wd) return !NW ? "inNW" : !NE ? "inNE" : !SE ? "inSE" : !SW ? "inSW" : "body";
  if (!N && !Wd) return "NW"; if (!N && !E) return "NE"; if (!S && !Wd) return "SW"; if (!S && !E) return "SE";
  return !N ? "N" : !S ? "S" : !Wd ? "W" : "E";
}
/** flag_dirt_art.phase_role 의 TS 판 — 그룹 memberTileIds(ORDER 순: 몸통 8, 기본 13, 곧은 변 4×15, 모서리 8×7) 안 칸 번호. */
function fdTile(members: readonly number[], role: string, x: number, y: number): number | undefined {
  const base = FD_BASE_ROLES.indexOf(role as (typeof FD_BASE_ROLES)[number]);
  if (base < 0) return undefined;
  const d = ["N", "S", "W", "E"].indexOf(role);
  if (d >= 0) {
    const [along, other] = d < 2 ? [x, y] : [y, x];
    const v = fdGreedy(16, d + 1 + 100, other, along);
    return members[v === 0 ? 8 + base : 8 + 13 + d * 15 + (v - 1)];
  }
  const c = FD_CORNERS.indexOf(role as (typeof FD_CORNERS)[number]);
  if (c >= 0) {
    const northish = role === "NW" || role === "NE" || role === "inNW" || role === "inNE";
    const k = northish ? y : x, q = northish ? x : y;
    const v = fdGreedy(8, 11 + c, Math.floor(q / 32), k);
    return members[v === 0 ? 8 + base : 8 + 13 + 60 + c * 7 + (v - 1)];
  }
  return members[8 + base];
}
function layFlagIsland(draft: Project, map: GameMap, box: Box, dirt: YardGroup): YardGroup | null {
  const ts = draft.tilesets[map.tilesetId] as unknown as { autotileGroups?: YardGroup[] };
  const fd = ts.autotileGroups?.find((g) => g.id === "beodeul_yard_flag_dirt");
  if (!fd || fd.memberTileIds.length < 8 + 13 + 60 + 56) return null;
  const W = map.width, H = map.height, dirtSet = new Set(dirt.memberTileIds);
  let st = ((box.x * 2654435761) ^ (box.y * 2246822519) ^ (W * 3266489917)) >>> 0;
  const rnd = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
  // 바깥(풀)에서 잰 거리 — 4이웃 BFS
  const dist = new Map<number, number>(); const q: number[] = [];
  for (let y = box.y - 1; y <= box.y + box.h; y++) for (let x = box.x - 1; x <= box.x + box.w; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x;
    if (!dirtSet.has(map.lowerTiles[i]!)) { dist.set(i, 0); q.push(i); }
  }
  for (let h = 0; h < q.length; h++) { const i = q[h]!, x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < box.x || ny < box.y || nx >= box.x + box.w || ny >= box.y + box.h) continue; const j = ny * W + nx; if (dist.has(j) || !dirtSet.has(map.lowerTiles[j]!)) continue; dist.set(j, dist.get(i)! + 1); q.push(j); } }
  // 깎는 잡음: 칸 3~4 크기 덩이(값 잡음, 씨앗 = 상자)
  const cx = rnd() * 1000, cy = rnd() * 1000;
  const noise = (x: number, y: number) => { const fx = (x + cx) / 3.3, fy = (y + cy) / 3.3, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const v = (a: number, b: number) => fdHash(a & 0xffff, b & 0xffff, 77) / 4294967296; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy; };
  // r14: 거리 고리 2~4 만 잡음으로 깎았더니 섬이 늘 마당을 따라 줄인 네모였고(곧은 변 · 직각 귀, 두 seed 가 같은 꼴), 깨짐은 귀 몇 군데뿐이었다.
  // 섬 꼴을 맵마다 고른다 — 한 덩이(잎 둘~넷 달린 타원) · 땅콩(겹친 두 덩이) · 한쪽이 물린 덩이 — 그리고 윤곽 전체를 1~3칸 깊이로 흔든다(둘레 각도 잡음 + 칸 잡음).
  const bw = box.w, bh = box.h;
  const kind = Math.floor(rnd() * 3);
  const blob = (ox: number, oy: number, rx: number, ry: number) => {
    const lobes = 2 + Math.floor(rnd() * 3), ph = rnd() * Math.PI * 2, amp = 0.12 + rnd() * 0.12, ph2 = rnd() * Math.PI * 2;
    return (x: number, y: number) => { const dx = (x + 0.5 - ox) / rx, dy = (y + 0.5 - oy) / ry, a = Math.atan2(dy, dx);
      const r = 1 + amp * Math.sin(lobes * a + ph) + 0.08 * Math.sin((lobes + 3) * a + ph2); return Math.hypot(dx, dy) / r; };
  };
  const mx = box.x + bw / 2 + (rnd() - 0.5) * bw * 0.16, my = box.y + bh / 2 + (rnd() - 0.5) * bh * 0.14;
  const shapes: ((x: number, y: number) => number)[] = [];
  if (kind === 0) shapes.push(blob(mx, my, bw * (0.44 + rnd() * 0.06), bh * (0.43 + rnd() * 0.06)));
  else if (kind === 1) {
    const horiz = bw >= bh * 1.2 || rnd() < 0.5, s = rnd() < 0.5 ? 1 : -1;
    const off = horiz ? bw * 0.16 : bh * 0.15;
    shapes.push(blob(mx - (horiz ? off * s : 0), my - (horiz ? bh * 0.06 : off * s), bw * (horiz ? 0.3 : 0.42), bh * (horiz ? 0.42 : 0.3)));
    shapes.push(blob(mx + (horiz ? off * s : 0), my + (horiz ? bh * 0.06 : off * s), bw * (horiz ? 0.28 : 0.38), bh * (horiz ? 0.36 : 0.28)));
  } else shapes.push(blob(mx, my, bw * 0.5, bh * 0.48));
  // 물린 덩이: 마당 한 귀 쪽에서 흙이 깊게 파고든다.
  const bite = kind === 2 ? { x: box.x + (rnd() < 0.5 ? bw * 0.18 : bw * 0.82), y: box.y + (rnd() < 0.5 ? bh * 0.2 : bh * 0.8), r: Math.min(bw, bh) * (0.22 + rnd() * 0.06) } : null;
  const F = new Set<number>();
  for (const [i, d] of dist) { if (d < 2) continue; const x = i % W, y = Math.floor(i / W);
    // 칸 잡음 ±(0.5~1.5칸) — 윤곽 어디서나 판 단위로 들쭉날쭉(정규 반지름 1 ≈ 마당 폭 0.4, 한 칸 ≈ 0.12~0.2).
    const jit = (noise(x, y) - 0.5) * 0.5 + (fdHash(x, y, 919) / 4294967296 - 0.5) * 0.18;
    const r = Math.min(...shapes.map((f) => f(x, y)));
    if (r > 1 + jit) continue;
    if (bite && Math.hypot(x + 0.5 - bite.x, y + 0.5 - bite.y) < bite.r * (1 + jit)) continue;
    F.add(i); }
  // 섬 속 흙 구멍(판석이 빠진 자리) 1~3개: 섬 가장자리에서 세 칸 이상 안쪽, 3~5칸 덩이(네모가 아니게 한 칸씩 붙여 키운다).
  const deep = (i: number) => { const x = i % W; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { if (Math.abs(dx) + Math.abs(dy) > 4) continue; if (!F.has(i + dy * W + dx) || Math.abs(((i + dx) % W) - x) > 3) return false; } return true; };
  const holeSeeds = [...F].filter(deep), holes = new Set<number>();
  for (let n = 1 + Math.floor(rnd() * 3); n > 0 && holeSeeds.length; n--) {
    const s0 = holeSeeds.splice(Math.floor(rnd() * holeSeeds.length), 1)[0]!;
    const hole = [s0]; const want = 3 + Math.floor(rnd() * 3);
    for (let g = 0; g < 20 && hole.length < want; g++) { const c = hole[Math.floor(rnd() * hole.length)]!; const nb = [c - 1, c + 1, c - W, c + W][Math.floor(rnd() * 4)]!; if (!hole.includes(nb) && deep(nb)) hole.push(nb); }
    if (hole.length >= 3) for (const c of hole) { F.delete(c); holes.add(c); }
    for (let k = holeSeeds.length - 1; k >= 0; k--) { const h = holeSeeds[k]!; if (hole.some((c) => Math.abs((c % W) - (h % W)) + Math.abs(Math.floor(c / W) - Math.floor(h / W)) < 5)) holeSeeds.splice(k, 1); }
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const i of [...F]) { const n = [i - 1, i + 1, i - W, i + W].filter((j) => F.has(j)).length; if (n < 2) F.delete(i); }
    for (const [i, d] of dist) { if (d < 2 || F.has(i) || holes.has(i)) continue; const n = [i - 1, i + 1, i - W, i + W].filter((j) => F.has(j)).length; if (n >= 3) F.add(i); }
  }
  if (F.size < 12) return null;
  const inner = fd.interiorVariants?.flat() ?? [];
  const has = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && F.has(y * W + x);
  for (const i of F) {
    const x = i % W, y = Math.floor(i / W);
    const n = has(x, y - 1), e = has(x + 1, y), s = has(x, y + 1), w = has(x - 1, y);
    let m = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
    if (n && e && has(x + 1, y - 1)) m |= 16; if (s && e && has(x + 1, y + 1)) m |= 32; if (s && w && has(x - 1, y + 1)) m |= 64; if (n && w && has(x - 1, y - 1)) m |= 128;
    const role = fdMaskRole(m);
    let t: number | undefined;
    if (role === "body") { t = fd.variantMap["255"]; const h = ((x * 73856093) ^ (y * 19349663)) >>> 0; if (inner.length && h % 5 < 2) t = inner[h % inner.length]; }
    else t = fdTile(fd.memberTileIds, role, x, y) ?? fd.variantMap[String(m)];
    if (t !== undefined) map.lowerTiles[i] = t;
  }
  return fd;
}

function overgrowYard(draft: Project, mapId: string, box: Box, placed: readonly Box[], flag?: YardGroup): void {
  const map = draft.maps[mapId]!; const W = map.width, up = map.upperTiles;
  // 버들항 장소 덧그림(위층, 한 칸): 무너진 대리석·돌 부스러기, 작은 고사리, 낮은 헤더 덤불, 자갈 — 큰 덤불·나무 조각은 쓰지 않는다.
  const meta = (draft.tilesets[map.tilesetId] as unknown as { tileMeta?: readonly TileMetaRow[] }).tileMeta ?? [];
  const pool = [26956, 26956, 26666, 27542, 27542, 27511, 27512, 27513, 27598].filter((t) => meta[t]?.tags?.[2] === "decal");
  if (!pool.length) return;
  let st = ((box.x * 374761393) ^ (box.y * 668265263) ^ W) >>> 0;
  const rnd = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
  // 조각 칸과 그 앞줄(문·발밑)만 피한다 — 둘레 1칸까지 피했더니 덧그림이 거의 안 남았다.
  const inPiece = (x: number, y: number) => placed.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h + 1);
  // 풀은 마당 가장자리(연석 쪽)에 더 많이, 가운데엔 드물게 — 무너진 판석 사이로 풀이 밀고 들어온 모양.
  const seeds = Array.from({ length: 4 + Math.floor(rnd() * 3) }, () => ({ x: box.x + rnd() * box.w, y: box.y + rnd() * box.h }));
  // 가장자리 = 실제 마당 윤곽(깎인 홈 포함). 상자 기준으로 재면 홈 안쪽 연석은 «가운데»로 쳐져 맨살로 남았다(r8).
  const ts = draft.tilesets[map.tilesetId] as unknown as { autotileGroups?: YardGroup[] };
  const members = new Set([...(flag?.memberTileIds ?? []), ...(ts.autotileGroups?.find((g) => g.id === "beodeul_yard_dirt")?.memberTileIds ?? [])]);
  const inYard = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < map.height && members.has(map.lowerTiles[y * W + x]!);
  // 가장자리 = 판석이 끝나는 곳(흙으로 무너진 고리·바깥 풀밭과 맞닿은 판석 칸, 그리고 흙 고리 칸 자신).
  const flagSet = new Set(flag?.memberTileIds ?? []);
  const isFlagAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < map.height && flagSet.has(map.lowerTiles[y * W + x]!);
  const ring = (x: number, y: number, r: number) => { if (flagSet.size && !isFlagAt(x, y)) return true; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!(flagSet.size ? isFlagAt(x + dx, y + dy) : inYard(x + dx, y + dy))) return true; return false; };
  for (let y = box.y - 1; y <= box.y + box.h; y++) for (let x = box.x - 1; x <= box.x + box.w; x++) {
    if (inPiece(x, y) || (members.size && !inYard(x, y))) continue;
    const edge = !members.size ? Math.min(x - box.x, box.x + box.w - 1 - x, y - box.y, box.y + box.h - 1 - y) : ring(x, y, 1) ? 0 : ring(x, y, 2) ? 1 : 2;
    const near = seeds.some((c) => Math.hypot(c.x - x, c.y - y) < 2.2);
    // r8: 연석이 끊김 없이 또렷했다 — 가장자리 풀 덮기를 늘린다.
    // r11: 판석 섬(흙 마당 안)에서는 흙 칸이 모두 «가장자리»로 쳐져 흙 고리에 덧그림이 고르게 깔렸다 — 흙 칸은 드물게, 판석 끝 칸에 더.
    const onDirt = flagSet.size > 0 && !isFlagAt(x, y);
    const p = onDirt ? 0.16 + (near ? 0.2 : 0) : (edge <= 0 ? 0.7 : edge === 1 ? 0.3 : 0.08) + (near ? 0.35 : 0);
    if (rnd() > p) continue;
    const i = y * W + x; if ((up[i] ?? -1) >= 0 || (map.upperOverlayTiles?.[i] ?? -1) >= 0) continue;
    up[i] = pool[Math.floor(rnd() * pool.length)]!;
  }
}

type YardGroup = { id: string; memberTileIds: number[]; connectTileIds?: number[]; variantMap: Record<string, number>; interiorVariants?: number[][] };

/** 버들항 마당 그룹과 그 맵에서 개간할 땅(plaza 정의). 그룹이 없으면 null. */
function yardPlaza(draft: Project, map: GameMap, yard: NonNullable<QuarterDef["yard"]>): { plaza: NonNullable<QuarterDef["plaza"]>; group: YardGroup } | null {
  const ts = draft.tilesets[map.tilesetId] as unknown as { autotileGroups?: YardGroup[]; tileMeta?: readonly TileMetaRow[]; tileGrafts?: readonly { targetTile: number; sourceChipset: string }[] };
  const group = ts.autotileGroups?.find((g) => g.id === yard.group);
  if (!group) return null;
  const meta = ts.tileMeta ?? [];
  const grass = new Set<number>();
  for (const t of map.lowerTiles) if (t >= 0 && meta[t]?.tags?.[1] === "grass") grass.add(t);
  const body = group.variantMap["255"];
  const ground = [...new Set([...(group.interiorVariants?.flat() ?? []), ...(body !== undefined ? [body] : [])])];
  if (!grass.size || !ground.length) return null;
  // 버들항 자연 시트에서 이식한 칸(나무·꽃·풀 무늬)은 tileMeta 태그가 비어 있다 — 출처 시트로 «걷어도 되는 칸»을 가린다.
  const softTiles = (ts.tileGrafts ?? []).filter((g) => g.sourceChipset === "tex_beodeul_nature" || g.sourceChipset === "tex_beodeul_ground").map((g) => g.targetTile); // 땅 덧칠(tex_beodeul_ground)도 마당에선 걷는다
  // 귀 채우기가 아닌 마당(신전 폐허)은 맵마다 크기를 조금 달리한다 — 같은 크기면 같은 조각이 같은 자리에만 들어가 두 맵이 한 도장으로 읽혔다(r2).
  let hsh = 2166136261;
  for (let i = 0; i < map.lowerTiles.length; i += 7) hsh = Math.imul(hsh ^ (map.lowerTiles[i]! + 1), 16777619) >>> 0;
  // 흔들기는 author_beodeul_town({quarter}) 이 비워 둔 자리(w+3 × h+3, 둘레 1칸 포함) 안에서만: 가로 −2~+1, 세로 −1~0.
  const jw = yard.pack === "corner" ? 0 : (hsh % 4) - 2, jh = yard.pack === "corner" ? 0 : ((hsh >>> 8) % 2) - 1;
  return { group, plaza: { w: yard.w + jw, h: yard.h + jh, ground, grass: [...grass], soft: BEODEUL_YARD_SOFT, softTiles, roads: BEODEUL_YARD_ROADS, rough: yard.ruin ? "ruin" : yard.pack === "corner" ? "fray" : "notch" } };
}

/** 마당 칸(그룹 멤버)을 8방 이웃으로 다시 맞춘다 — 가장자리·바깥 모서리·안쪽 모서리. 꽉 찬 칸은 속 변형을 해시로 섞는다. */
function shapeYard(map: GameMap, group: YardGroup): void {
  const W = map.width, H = map.height;
  const members = new Set(group.memberTileIds), connect = new Set(group.connectTileIds ?? group.memberTileIds);
  const inner = group.interiorVariants?.flat() ?? [];
  const at = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || connect.has(map.lowerTiles[y * W + x]!);
  const before = map.lowerTiles.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!members.has(before[y * W + x]!)) continue;
    const c = (dx: number, dy: number) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx >= W || yy >= H || connect.has(before[yy * W + xx]!); };
    const n = c(0, -1), e = c(1, 0), s = c(0, 1), w = c(-1, 0);
    let m = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
    if (n && e && c(1, -1)) m |= 16; if (s && e && c(1, 1)) m |= 32; if (s && w && c(-1, 1)) m |= 64; if (n && w && c(-1, -1)) m |= 128;
    let t = group.variantMap[String(m)];
    if (m === 255 && inner.length) { const h = ((x * 73856093) ^ (y * 19349663)) >>> 0; if (h % 5 < 2) t = inner[h % inner.length]; }
    if (t !== undefined) map.lowerTiles[y * W + x] = t;
  }
  void at;
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
  let yardFreeAnchor = false;
  let yardGroup: YardGroup | null = null;
  let flagIsland: YardGroup | null = null;
  const preYard = map.lowerTiles.slice();
  if (quarter.yard) {
    const y = yardPlaza(draft, map, quarter.yard);
    if (y) {
      yardGroup = y.group;
      const p = y.plaza;
      plazaBox = openPlaza(draft, map, p, opts.near ?? null) ?? openPlaza(draft, map, { ...p, w: p.w - 3, h: p.h - 2 }, opts.near ?? null)
        ?? openPlaza(draft, map, { ...p, w: p.w - 6, h: p.h - 3 }, opts.near ?? null)
        ?? openPlaza(draft, map, { ...p, w: p.w - 8, h: p.h - 4 }, opts.near ?? null);
      if (!plazaBox) throw new ToolError(`「${quarter.ko}」 마당(${p.w}×${p.h}, 길에 맞닿은 풀밭·나무 자리)을 낼 곳이 없다 — 마을을 더 크게(width·height) 짓거나 near 를 준다.`, { code: "no-quarter-slot", mapId: map.id });
      shapeYard(map, yardGroup);
      if (quarter.yard.ruin) flagIsland = layFlagIsland(draft, map, plazaBox, yardGroup);
      if (quarter.yard.pack === "corner") opts = { ...opts, near: { x: plazaBox.x + 1, y: plazaBox.y } };
      else if (!opts.near) yardFreeAnchor = true;
    }
  }
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
  const yardMembers = yardGroup ? new Set([...yardGroup.memberTileIds, ...(flagIsland?.memberTileIds ?? [])]) : null;
  const ok = plazaBox ? grid.map((v, i) => { const x = i % W, y = Math.floor(i / W); return v && x > plazaBox!.x && x < plazaBox!.x + plazaBox!.w - 1 && y >= plazaBox!.y && y < plazaBox!.y + plazaBox!.h - 1 && (!yardMembers || yardMembers.has(map.lowerTiles[i]!)) ? 1 : 0; }) : grid;
  // 마당 밖 조각(밭·과수)은 마당 바닥을 피한 풀밭 격자에.
  const outsideOk = plazaBox ? grid.map((v, i) => { const x = i % W, y = Math.floor(i / W); return v && !(x >= plazaBox!.x - 1 && x <= plazaBox!.x + plazaBox!.w && y >= plazaBox!.y - 1 && y <= plazaBox!.y + plazaBox!.h) ? 1 : 0; }) : grid;
  // 같은 덩이가 맵마다 같은 배치로 찍히지 않게: 마당 자리(맵마다 다르다)로 섞는 순서와 채우는 귀(북서·북동)를 정한다. 첫 조각(덩이의 얼굴)은 그대로 맨 앞.
  // r11: 선형 합동 난수의 첫 몇 값이 씨앗(마당 자리)에 거의 따라 움직여 두 맵이 같은 집·같은 조각을 골랐다 — fmix32 로 씨앗을 섞고 mulberry32 로 뽑는다.
  let mix = plazaBox ? fdFmix(((plazaBox.x * 73856093) ^ (plazaBox.y * 19349663) ^ (W * 83492791) ^ (H * 2654435761)) >>> 0) : 0;
  const rnd = () => { mix = (mix + 0x6d2b79f5) >>> 0; let t = mix; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const fromRight = plazaBox ? rnd() < 0.5 : false;
  const oneOfDup = rnd() < 0.5;
  const fromBottom = plazaBox ? rnd() < 0.5 : false; // r3: 포도원 두 맵이 같은 귀·같은 배치였다 — 위·아래 채우기도 맵마다
  // 얼굴 조각은 맵마다 둘 중 하나(faces), 더하는 조각(extras)은 맵마다 2~4개 — r6: 두 맵이 같은 묶음·같은 얼굴로 읽혔다.
  const face = plazaBox && quarter.faces?.length && rnd() < 0.4 ? quarter.faces[Math.floor(rnd() * quarter.faces.length)]! : quarter.pieces[0]!;
  const extraPool = plazaBox ? [...(quarter.extras ?? [])] : [];
  const extras: string[] = []; for (let n = 2 + Math.floor(rnd() * 3); n > 0 && extraPool.length; n--) extras.push(extraPool.splice(Math.floor(rnd() * extraPool.length), 1)[0]!);
  let basePieces = [face, ...quarter.pieces.slice(1), ...extras];
  // r11: 광산 두 seed 가 같은 제련 오두막·둔덕·광석 더미 «거울 도장»이었다 — 집은 넷(제련 오두막·판자 광부집·돌 기초 창고·통나무 오두막) 중 하나,
  // 나머지 마당 조각은 맵마다 7~9개를 섞어 고른다(갱구는 늘; r12 전 점검: 4~6개면 20×12 마당이 빈 흙판으로 읽혔다).
  if (plazaBox && quarterId === "mining") {
    const homes = ["bd-pick-mining-valley-smelt", "bd-pick-mining-valley-d2", "bd-pick-mining-valley-s2", "bd-pick-mining-valley-d1"].filter((id) => kitSize(draft, quarter.tilesetId, id));
    const rest = [...new Set(basePieces.slice(1))].filter((id) => !homes.includes(id));
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j]!, rest[i]!]; }
    basePieces = [face, ...(homes.length ? [homes[Math.floor(rnd() * homes.length)]!] : []), ...rest.slice(0, 7 + Math.floor(rnd() * 3))];
  }
  const order = plazaBox
    ? [face, ...basePieces.slice(1).map((id) => { const z = kitSize(draft, quarter.tilesetId, id); return { id, r: (z ? z.w * z.h : 0) * (0.4 + 1.2 * rnd()) }; }).sort((a, b) => b.r - a.r).map((o) => o.id)]
    : [...quarter.pieces];
  // 되풀이 조각(포도밭 이랑 둘)은 맵마다 하나 또는 둘 — 같은 덩이가 늘 같은 구성으로 읽히지 않게(빈자리는 압착기·통 선반이 쓴다).
  if (plazaBox && quarter.yard?.pack === "corner" && oneOfDup) { const dup = order.findIndex((id, i) => order.indexOf(id) !== i); if (dup > 0) order.splice(dup, 1); }
  // 마당이 있는 다른 덩이(신전 폐허): 되풀이 조각 몇 개를 맵마다 다르게 뺀다 — r2 에서 두 맵이 같은 도장으로 읽혔다.
  // r12 전 점검: 광산은 위에서 이미 맵마다 골라 섞었다 — 여기서 또 빼면 집(제련 오두막 등)까지 빠져 마당이 빈 흙판이 됐다.
  if (plazaBox && quarter.yard?.pack !== "corner" && quarterId !== "mining") {
    for (let n = 0; n < 2; n++) if (rnd() < 0.6) { const dups = order.map((id, i) => (i > 0 && order.indexOf(id) !== i ? i : -1)).filter((i) => i > 0); if (dups.length) order.splice(dups[Math.floor(rnd() * dups.length)]!, 1); }
    // r5: 두 맵이 같은 조각 묶음이었다 — 얼굴(첫 조각) 말고 1~3개를 맵마다 다르게 더 뺀다.
    for (let n = 1 + Math.floor(rnd() * 3); n > 0 && order.length > 6; n--) order.splice(1 + Math.floor(rnd() * (order.length - 1)), 1);
  }
  const pieces = order.slice(0, Math.max(2, Math.min(order.length, opts.count ?? order.length)))
    .map((id: string) => ({ id, size: kitSize(draft, quarter.tilesetId, id) }))
    .filter((p): p is { id: string; size: { w: number; h: number } } => !!p.size);
  if (!pieces.length) throw new ToolError(`${quarter.tilesetId} 에 「${quarter.ko}」 조각이 없다.`, { code: "kit-missing", mapId: map.id });

  // 덩이 중심: near 가 있으면 그 자리, 없으면 앞 조각들이 가장 많이 들어가는 자리(격자 3칸마다 시험).
  let anchor = opts.near ?? null;
  // 마당(귀 채우기 아님)이 있으면 덩이 중심을 마당 안 아무 자리로 — 늘 같은 귀에서 자라지 않게.
  if (!anchor && plazaBox && yardFreeAnchor) {
    for (let t = 0; t < 12 && !anchor; t++) {
      const x = plazaBox.x + 1 + Math.floor(rnd() * Math.max(1, plazaBox.w - 2)), y = plazaBox.y + 1 + Math.floor(rnd() * Math.max(1, plazaBox.h - 3));
      if (ok[y * W + x]) anchor = { x, y };
    }
  }
  if (!anchor && plazaBox && yardFreeAnchor) anchor = { x: plazaBox.x + Math.floor(plazaBox.w / 2), y: plazaBox.y + Math.floor(plazaBox.h / 2) };
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
  // 광산: 갱구가 평지에 홀로 선 «지하실 문»으로 읽혔다(r5·r6) — 갱구 양옆·뒤에 광재 더미·광석·광재 돌을 붙여 파낸 흙더미(버력) 언덕으로 감싼다.
  // 조각 하나를 (x,y) 에 맞붙여 찍는다 — GAP 여백(taken) 대신 실제 조각 상자와 겹치는지만 보고, 통행이 끊기면 되돌린다(갱구 둘레 더미·포도원 작업 마당).
  const stampAt = (id: string, x: number, y: number, fallback: { x: number; y: number }): boolean => {
    const z = kitSize(draft, quarter.tilesetId, id); if (!z) return false;
    const bx = { x, y, w: z.w, h: z.h };
    if (x < 0 || y < 0 || x + z.w > W || y + z.h > H) return false;
    // 갱구 둘레 더미는 «맞붙임»이 목적이라 GAP 여백(taken) 대신 실제 조각 상자와 겹치는지만 본다. 통행은 아래에서 다시 잰다.
    const hit = (xx: number, yy: number) => placed.some((p) => xx >= p.x && xx < p.x + p.w && yy >= p.y && yy < p.y + p.h + 1);
    for (let yy = y; yy < y + z.h; yy++) for (let xx = x; xx < x + z.w; xx++) if (hit(xx, yy) || !ok[yy * W + xx]) return false;
    const objectId = `kit:${quarter.tilesetId}/${id}`;
    const snapshot = structuredClone(draft.maps[map.id]!);
    try { stampTool.run(draft, { objectId, mapId: map.id, x, y }); } catch { draft.maps[map.id] = snapshot; return false; }
    const all = [...placed, { objectId, ...bx }];
    const inPiece = (px: number, py: number) => all.some((p) => px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h);
    const current = draft.maps[map.id]!;
    let from = comp.seed; if (!isPassable(draft, current, from.x, from.y)) from = fallback;
    const after = reachable(draft, current, from);
    for (const i of comp.cells) { const cx = i % W, cy = Math.floor(i / W); if (!inPiece(cx, cy) && !after.has(i)) { draft.maps[map.id] = snapshot; return false; } }
    mark(taken, W, H, bx); placed.push({ objectId, ...bx }); return true;
  };
  const wrapAdit = (adit: Box): void => {
    const heap = (id: string, x: number, y: number): boolean => stampAt(id, x, y, { x: adit.x + 1, y: adit.y + adit.h });
    // r7: 같은 버력 더미 셋이 갱구 양옆·아래에 대칭으로 서서 «도장»으로 읽혔다 — 더미는 id 마다 한 번, 양옆은 서로 다른 것.
    const used = (id: string) => placed.some((p) => p.objectId.endsWith(`/${id}`));
    const z = (id: string) => kitSize(draft, quarter.tilesetId, id) ?? { w: 2, h: 2 };
    const bottom = adit.y + adit.h - 1;
    const leftSpots = (id: string): [number, number][] => [[adit.x - z(id).w, bottom - z(id).h + 1], [adit.x - z(id).w, bottom - z(id).h], [adit.x - z(id).w - 1, bottom - z(id).h + 1]];
    const rightSpots = (id: string): [number, number][] => [[adit.x + adit.w, bottom - z(id).h + 1], [adit.x + adit.w, bottom - z(id).h], [adit.x + adit.w + 1, bottom - z(id).h + 1]];
    const small = rnd() < 0.5 ? ["bd-pick-mining-valley-ore", "bd-pick-mountain-pass-boulder-m", "bd-pick-mining-valley-slagrock"] : ["bd-pick-mountain-pass-boulder-m", "bd-pick-mining-valley-slagrock", "bd-pick-mining-valley-ore"];
    if (mound) {
      // r9: 둔덕(풀 언덕)이 갱구 뒤와 양 어깨를 감싼다 — 발치 한쪽에만 작은 버력 하나(양옆 같은 자리 바위 둘은 대칭 도장으로 읽혔다).
      const mm = draft.maps[map.id]!;
      // 어깨 칸(갱구 옆 두 줄)은 지형 다듬기가 낮출 수 있어 풀로 덮지 않는다 — 풀 칸이 땅바닥에 남아 네모 풀 조각으로 보였다.
      // r10: 풀 윗면만으로는 얇은 테두리 친 «유리판»으로 읽혔다 — 뒤 칸 윗면에 고사리·헤더 덤불·자갈 덧칠을 흩어 언덕 결을 준다.
      const hillMeta = (draft.tilesets[map.tilesetId] as unknown as { tileMeta?: readonly TileMetaRow[] }).tileMeta ?? [];
      const hillPool = [27542, 27542, 27511, 27512, 27513, 27598].filter((t) => hillMeta[t]?.tags?.[2] === "decal");
      for (const i of mound.cells) {
        mm.relief!.levels[i] = mound.base + 2; taken[i] = 1; mm.upperTiles[i] = -1;
        if (Math.floor(i / W) >= mound.top) continue;
        if (mound.grass !== undefined) mm.lowerTiles[i] = mound.grass;
        if (hillPool.length && rnd() < 0.45) mm.upperTiles[i] = hillPool[Math.floor(rnd() * hillPool.length)]!;
      }
      // r10: 마당 가장자리 홈(풀 한 칸)이 둔덕 옆구리에 붙어 «흙 위에 뜬 풀 네모»로 읽혔다 — 둔덕·마당에 셋 이상 둘린 풀 칸은 마당 흙으로 메우고 마당 모양을 다시 맞춘다.
      if (yardGroup && yardMembers) {
        const md = mound; const body = yardGroup.variantMap["255"]; let filled = 0;
        for (let pass = 0; pass < 2 && body !== undefined; pass++) for (const i of [...md.cells]) for (const j of [i - 1, i + 1, i - W, i + W]) {
          if (j < 0 || j >= W * H || Math.abs((j % W) - (i % W)) > 1 || md.cells.has(j) || yardMembers.has(mm.lowerTiles[j]!) || (mm.relief!.levels[j] ?? 0) !== md.base) continue;
          const jx = j % W;
          const around = [j - 1, j + 1, j - W, j + W].filter((k) => k >= 0 && k < W * H && Math.abs((k % W) - jx) <= 1 && (yardMembers.has(mm.lowerTiles[k]!) || md.cells.has(k))).length;
          if (around < 3) continue;
          mm.lowerTiles[j] = body; mm.upperTiles[j] = -1; filled++;
        }
        shapeYard(mm, yardGroup); void filled;
      }
      const spots = rnd() < 0.5 ? leftSpots : rightSpots;
      for (const id of small) { if (used(id)) continue; if (spots(id).some(([x, y]) => heap(id, x, y))) break; }
    } else {
      // 둔덕을 올릴 수 없는 맵(relief 없음·자리 없음): 갱구에 맞붙인 서로 다른 바위 둘.
      const big = rnd() < 0.5 ? ["bd-pick-mining-valley-slagheap", "bd-pick-mountain-pass-boulder-l"] : ["bd-pick-mountain-pass-boulder-l", "bd-pick-mining-valley-slagheap"];
      for (const id of big) { if (used(id)) continue; if (leftSpots(id).some(([x, y]) => heap(id, x, y))) break; }
      for (const id of small) { if (used(id)) continue; if (rightSpots(id).some(([x, y]) => heap(id, x, y))) break; }
    }
    layAditTrack(adit);
    screeAround(adit);
  };
  // r14: 마당 가운데가 빈 흙판이었다(«선로·광차가 없다», r11·r13) — 갱구 문 앞에서 아래로 4~7칸 세로 선로(던전 광산 선로 덧그림 V, 걸음)를 깔고
  // 선로 위 한 자리에 세로 광차(1×2)를 세운다. 선로는 마당 흙 칸·빈 위층에만, 조각 앞줄과 겹치면 거기서 멈춘다. 광차가 통행을 끊으면 광차만 뺀다.
  const trackCells: number[] = [];
  const layAditTrack = (adit: Box): void => {
    const mm = draft.maps[map.id]!;
    const meta = (draft.tilesets[map.tilesetId] as unknown as { tileMeta?: readonly TileMetaRow[] }).tileMeta ?? [];
    const V = 32935;
    if (!meta[V]?.tags?.includes("rails-ew")) return;
    const x = adit.x + Math.floor(adit.w / 2);
    const inPlaced = (yy: number) => placed.some((p) => x >= p.x && x < p.x + p.w && yy >= p.y && yy < p.y + p.h + (p === placed.find((q) => q.x === adit.x && q.y === adit.y) ? 0 : 1));
    const want = 4 + Math.floor(rnd() * 4), ys: number[] = [];
    for (let y = adit.y + adit.h; y < H && ys.length < want; y++) {
      const i = y * W + x;
      if (!ok[i] || (mm.upperTiles[i] ?? -1) >= 0 || inPlaced(y) || mound?.cells.has(i)) break;
      ys.push(y);
    }
    if (ys.length < 3) return;
    for (const y of ys) { mm.upperTiles[y * W + x] = V; trackCells.push(y * W + x); taken[y * W + x] = 1; }
    // 광차: 선로 아래쪽 반에 — 문 앞 첫 칸은 비워 둔다(갱구로 들어가는 발판).
    // 광차는 선로 위(덧그림 칸을 광차 그림으로 바꾼다)라 stampAt 의 «마당 칸» 조건 대신 직접 찍고 통행만 잰다. 선로 끝 칸은 끝 막이(1×1)로 닫는다.
    const cy = ys[Math.min(ys.length - 2, 1 + Math.floor(rnd() * (ys.length - 2)))]!;
    const tryStamp = (id: string, sx: number, sy: number): boolean => {
      const z = kitSize(draft, quarter.tilesetId, id); if (!z) return false;
      const snap = structuredClone(draft.maps[map.id]!);
      for (let yy = sy; yy < sy + z.h; yy++) if (draft.maps[map.id]!.upperTiles[yy * W + sx] === V) draft.maps[map.id]!.upperTiles[yy * W + sx] = -1;
      try { stampTool.run(draft, { objectId: `kit:${quarter.tilesetId}/${id}`, mapId: map.id, x: sx, y: sy }); } catch { draft.maps[map.id] = snap; return false; }
      const all = [...placed, { x: sx, y: sy, w: z.w, h: z.h }];
      const cur = draft.maps[map.id]!; let from = comp.seed; if (!isPassable(draft, cur, from.x, from.y)) from = { x: sx + 1, y: sy };
      const after = reachable(draft, cur, from);
      for (const i of comp.cells) { const px = i % W, py = Math.floor(i / W); if (!all.some((p) => px >= p.x && px < p.x + p.w && py >= p.y && py < p.y + p.h) && !after.has(i)) { draft.maps[map.id] = snap; return false; } }
      placed.push({ objectId: `kit:${quarter.tilesetId}/${id}`, x: sx, y: sy, w: z.w, h: z.h }); return true;
    };
    tryStamp("bd-pick-mining-valley-cart", x, cy);
    const last = ys[ys.length - 1]!;
    if (last > cy + 1) tryStamp("bd-pick-mining-valley-buffer", x, last);
  };
  // 맵에서 가장 흔한 바닥(풀) — 둔덕 윗면을 풀로 덮어 «흙 받침대»가 아니라 «풀 언덕»으로 읽히게(r9: 오각형 흙 상자·받침대로 읽혔다).
  const grassTile = (() => { const c = new Map<number, number>(); for (const t of map.lowerTiles) if (t >= 0) c.set(t, (c.get(t) ?? 0) + 1); let best = -1, n = 0; for (const [t, k] of c) if (k > n) { best = t; n = k; } return best >= 0 ? best : undefined; })();
  /**
   * 갱구 둔덕 계획(적용하지 않는다): 갱구 뒤 2~depth 줄 + 갱구 위 두 줄 높이의 양 어깨(좌우 1~2칸)를 relief 2단으로 올릴 칸.
   * 둔덕 칸과 갱구 상자를 막힌 칸으로 친 BFS 로 원래 통행 칸이 하나도 끊기지 않을 때만 돌려준다.
   */
  const tsMeta = (draft.tilesets[map.tilesetId] as unknown as { tileMeta?: readonly TileMetaRow[] }).tileMeta ?? [];
  const roadAt = (i: number) => { const t = draft.maps[map.id]!.lowerTiles[i]!; if (t < 0 || yardMembers?.has(t)) return false; const g = tsMeta[t]?.tags ?? []; return (BEODEUL_YARD_ROADS as readonly string[]).some((r) => g[1] === r || g[2] === r); };
  const planMound = (adit: Box, depth: number): { cells: Set<number>; base: number; top: number; grass?: number } | null => {
    const m = draft.maps[map.id]!; const relief = m.relief;
    // r10: 갱구 킷 윗줄(3×4 의 첫 줄)은 빈 칸이다 — 둔덕을 상자 윗변에 맞추면 보이는 아치 위에 흙 한 줄이 비어 «둔덕 앞에 따로 선 돌집»으로 읽혔다. 보이는 윗변(top)에 맞춘다.
    const top = adit.y + 1;
    if (!relief || relief.width !== W || relief.height !== H) return null;
    const base = relief.levels[(adit.y + adit.h - 1) * W + adit.x] ?? 0;
    if (base + 2 > 14) return null;
    const inAdit = (x: number, y: number) => x >= adit.x && x < adit.x + adit.w && y >= top && y < adit.y + adit.h + 1;
    const hitPiece = (x: number, y: number) => inAdit(x, y) || placed.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h + 1);
    // r13: 둔덕이 마당 위 큰길을 덮어 길을 끊고, 통나무집 앞벽에 맞붙었다 — 마당 밖으로 솟는 칸은 풀밭만(길·흙길 칸 금지), 집 보호 칸과 그 둘레 1칸도 금지.
    const yardCell = (i: number) => !!ok[i];
    const nearHouse = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (houseCells.has((y + dy) * W + x + dx)) return true; return false; };
    const can = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      const i = y * W + x;
      if (!(ok[i] || grid[i]) || hitPiece(x, y) || (relief.levels[i] ?? 0) !== base || nearHouse(x, y)) return false;
      // r14: 둔덕 풀 윗면이 마당 위 길 바로 밑까지 솟아 길에 붙었다 — 길·흙길 칸(8이웃)과 맞닿는 칸은 둔덕에 넣지 않는다.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && roadAt(yy * W + xx)) return false; }
      return yardCell(i) || (grassTile !== undefined && m.lowerTiles[i] === grassTile);
    };
    const cells = new Set<number>();
    let l = adit.x - 2, r = adit.x + adit.w + 1;
    for (let y = top - 1, k = 0; y >= top - depth && y >= 0; y--, k++) {
      if (k > 0) { l += Math.floor(rnd() * 3) - 1; r += Math.floor(rnd() * 3) - 1; }
      let row = 0;
      for (let x = Math.max(0, l); x <= Math.min(W - 1, r); x++) if (can(x, y)) { cells.add(y * W + x); row++; }
      if (k === 0 && row < adit.w + 2) return null;
      if (!row) break;
    }
    // 어깨: 갱구 윗부분 두 줄 높이에서 좌우로 1~2칸 — 둔덕이 갱구를 앞으로 감싸 «언덕에 판 굴»로 읽히게.
    for (const y of [top, top + 1]) for (const [x, w] of [[adit.x - 1, 1], [adit.x - 2, 0.6], [adit.x + adit.w, 1], [adit.x + adit.w + 1, 0.6]] as const) {
      if (y === top + 1 && rnd() > 0.7) continue;
      if (rnd() < w && can(x, y)) cells.add(y * W + x);
    }
    // r10: 줄마다 흔든 끝이 한 줄만 삐져나오면 그 칸이 «흙 위에 뜬 풀 네모»로 그려졌다 — 위·아래 이웃 또는 좌·우 이웃이 없는 칸(갱구는 이웃으로 친다)은 두 번 깎는다.
    const solid = (k: number) => cells.has(k) || inAdit(k % W, Math.floor(k / W));
    for (let pass = 0; pass < 2; pass++) for (const c of [...cells]) {
      const cx = c % W;
      const vert = solid(c - W) || solid(c + W), horiz = (cx > 0 && solid(c - 1)) || (cx < W - 1 && solid(c + 1));
      if (!vert || !horiz) cells.delete(c);
    }
    if (cells.size < adit.w + 4) return null;
    // r13: 뒤 줄이 길에 막혀 둔덕이 갱구 옆 기둥으로만 섰다 — 갱구 바로 뒤 줄(보이는 윗변 위)과 그 위 한 줄은 갱구 폭 전부가 둔덕이어야 한다.
    for (const y of [top - 1, top - 2]) for (let x = adit.x; x < adit.x + adit.w; x++) if (!cells.has(y * W + x)) return null;
    const pass = (x: number, y: number) => !cells.has(y * W + x) && !(x >= adit.x && x < adit.x + adit.w && y >= top && y < adit.y + adit.h) && isPassable(draft, m, x, y);
    let from = comp.seed; if (!pass(from.x, from.y)) from = { x: adit.x + 1, y: adit.y + adit.h };
    if (!pass(from.x, from.y)) return null;
    const seen = new Set<number>([from.y * W + from.x]); const q = [from.y * W + from.x];
    while (q.length) { const i = q.pop()!; const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const ni = ny * W + nx; if (seen.has(ni) || !pass(nx, ny)) continue; seen.add(ni); q.push(ni); } }
    for (const i of comp.cells) { const x = i % W, y = Math.floor(i / W); if (!cells.has(i) && !hitPiece(x, y) && !seen.has(i)) return null; }
    return { cells, base, top, ...(grassTile !== undefined ? { grass: grassTile } : {}) };
  };
  let mound: { cells: Set<number>; base: number; top: number; grass?: number } | null = null;
  const houseCells = protectedSet(map);
  const kitRows = (id: string) => draft.tilesets[quarter.tilesetId]?.structureKits?.find((k) => k.id === id)?.rows ?? [];
  // 갱구 둘레 흙 칸에 산길 돌 부스러기 덧그림(위층) — 바위 땅을 깔았더니 회색 콘크리트 판으로 읽혀(r7 시험) 부스러기만 남겼다.
  const screeAround = (adit: Box): void => {
    const scree = ["bd-pick-mountain-pass-scree-a", "bd-pick-mountain-pass-scree-b"].flatMap((id) => kitRows(id).flatMap((r) => [...(r.upperTiles ?? []), ...(r.tiles ?? [])].filter((t): t is number => typeof t === "number" && t >= 0)));
    if (!scree.length) return;
    const m = draft.maps[map.id]!;
    const inPlaced = (x: number, y: number) => placed.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h + 1);
    // r11: 갱구 둘레 30% 로 흩은 같은 자갈 그림이 마당에 열다섯 번 고른 간격으로 찍혔다 — 갱구 발치 두세 무더기(맵당 여섯 칸까지)만.
    let left = 6;
    for (let c = 2 + Math.floor(rnd() * 2); c > 0 && left > 0; c--) {
      const cx = adit.x - 2 + Math.floor(rnd() * (adit.w + 4)), cy = adit.y + adit.h + Math.floor(rnd() * 2);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [1, 1]] as const) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= H || left <= 0) continue;
        const i = y * W + x; if (!ok[i] || mound?.cells.has(i) || inPlaced(x, y) || (m.upperTiles[i] ?? -1) >= 0 || rnd() > 0.55) continue;
        m.upperTiles[i] = scree[Math.floor(rnd() * scree.length)]!; left--;
      }
    }
  };
  const UNIQUE_SPOIL = new Set(["bd-pick-mining-valley-slagheap", "bd-pick-mining-valley-slagrock", "bd-pick-mining-valley-ore"]);
  // r9: 갱구가 마당 윗변(길 목) 바로 아래에 서면 뒤에 둔덕을 올릴 수 없어 평지에 홀로 섰다 — 갱구는 둔덕을 올릴 수 있는 자리부터 찾는다.
  const aditSlots = (w: number, h: number): Box[] => {
    const out: Box[] = [];
    for (let y = 0; y + h < H; y++) for (let x = 0; x + w <= W; x++) {
      let fit = true;
      for (let yy = y; yy < y + h + 1 && fit; yy++) for (let xx = x; xx < x + w && fit; xx++) { const i = yy * W + xx; if (!ok[i] || taken[i]) fit = false; }
      if (fit) out.push({ x, y, w, h });
    }
    return out.sort(() => rnd() - 0.5).slice(0, 60);
  };
  /**
   * 포도밭(r10): 8×4 이랑 키트 넷을 찍던 판은 «넓은 맨흙 마당에 떨군 모듈 격자»로 읽혔다(16px 되풀이·죽은 칸). 조각을 다 놓은 뒤 남은 마당을
   * 두 칸 높이 포도나무 줄(위 칸 = 잎 지붕 윗면 V0~V0+7 걸음(V0 = BEODEUL_YARD_BASE + 71), 아래 칸 = 앞면 +8 막힘, 둘 다 위층)로 채운다. 줄 사이 한 칸은 고랑 길(3칸 간격),
   * 줄 길이 4~10 · 사이 1~2칸, 가운데 칸은 같은 것 연달아 금지 · 기둥 칸은 2~3칸마다. 줄 하나가 통행을 끊으면 그 줄은 걷는다.
   */
  const fillVineRows = (box: Box): { vines: number[]; lane: number[] } => {
    const mm = draft.maps[map.id]!;
    const meta = (draft.tilesets[map.tilesetId] as unknown as { tileMeta?: readonly TileMetaRow[] }).tileMeta ?? [];
    const V0 = BEODEUL_YARD_BASE + 71;
    if (!meta[V0 + 15]?.tags?.includes("vine")) return { vines: [], lane: [] };
    const MID = [V0 + 1, V0 + 3, V0 + 4, V0 + 6], POST = [V0 + 2, V0 + 5];
    const near = (x: number, y: number) => placed.some((p) => x >= p.x - 1 && x < p.x + p.w + 1 && y >= p.y - 1 && y < p.y + p.h + 2);
    // r14: 작업 길 — 마당을 세로(또는 가로)로 꿰는 두 칸 고랑 길을 비워 두고, 그 길가에 압착기·술통·바구니 무더기를 붙인다(포도밭이 «빈틈 없는 줄 격자»로 읽혔다).
    const keep = new Set<number>();
    {
      const vertical = box.w >= box.h ? rnd() < 0.7 : rnd() < 0.3;
      // 창고는 마당 한 귀(fromRight·fromBottom)부터 채운다 — 작업 길은 반대쪽 포도밭 한가운데를 지나게.
      const at = vertical ? box.x + Math.floor(box.w * ((fromRight ? 0.22 : 0.52) + rnd() * 0.22)) : box.y + Math.floor(box.h * ((fromBottom ? 0.25 : 0.5) + rnd() * 0.2));
      if (vertical) { for (let y = box.y; y < box.y + box.h; y++) for (const x of [at, at + 1]) keep.add(y * W + x); }
      else { for (let x = box.x; x < box.x + box.w; x++) for (const y of [at, at + 1]) keep.add(y * W + x); }
      const big = ["bd-pick-vineyard-wine-press", "bd-pick-vineyard-barrels-standing", "bd-pick-vineyard-cask-rack"].filter((id) => !placed.some((p) => p.objectId.endsWith(`/${id}`)));
      const small = ["bd-pick-vineyard-grape-baskets", "bd-pick-mining-valley-barrel", "bd-pick-walled-market-sack-pile"].filter((id) => !placed.some((p) => p.objectId.endsWith(`/${id}`)));
      const main = big.length ? big[Math.floor(rnd() * big.length)]! : null;
      const zs = (id: string) => kitSize(draft, quarter.tilesetId, id) ?? { w: 2, h: 2 };
      const fb = { x: vertical ? at : box.x + 1, y: vertical ? box.y + box.h - 1 : at };
      let mainBox: Box | null = null;
      if (main) {
        const z = zs(main); const spots: [number, number][] = [];
        for (let t = 0; t < (vertical ? box.h : box.w); t++) {
          if (vertical) { const y = box.y + t; spots.push([at - z.w, y], [at + 2, y]); } else { const x = box.x + t; spots.push([x, at - z.h], [x, at + 2]); }
        }
        spots.sort(() => rnd() - 0.5);
        for (const [x, y] of spots) if (stampAt(main, x, y, fb)) { mainBox = { x, y, w: z.w, h: z.h }; break; }
      }
      // 작은 것 하나~둘은 큰 것 옆(같은 길가)에 붙인다.
      if (mainBox) for (const id of small.sort(() => rnd() - 0.5).slice(0, 1 + Math.floor(rnd() * 2))) {
        const z = zs(id), m: Box = mainBox;
        const spots: [number, number][] = vertical
          ? [[m.x, m.y + m.h + 1], [m.x + m.w - z.w, m.y - z.h - 1], [m.x, m.y + m.h], [m.x + m.w - z.w, m.y - z.h]]
          : [[m.x + m.w + 1, m.y + m.h - z.h], [m.x - z.w - 1, m.y + m.h - z.h], [m.x + m.w, m.y + m.h - z.h], [m.x - z.w, m.y + m.h - z.h]];
        for (const [x, y] of spots) if (stampAt(id, x, y, fb)) { mainBox = { x: Math.min(m.x, x), y: Math.min(m.y, y), w: Math.max(m.x + m.w, x + z.w) - Math.min(m.x, x), h: Math.max(m.y + m.h, y + z.h) - Math.min(m.y, y) }; break; }
      }
    }
    const free = (x: number, y: number) => x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h && !keep.has(y * W + x) && yardMembers!.has(mm.lowerTiles[y * W + x]!) && mm.upperTiles[y * W + x] === -1 && !near(x, y);
    const seed = comp.seed; const vineCells = new Set<number>();
    const isFront = (x: number, y: number) => vineCells.has(y * W + x) && (mm.upperTiles[y * W + x] ?? -1) >= V0 + 8;
    // r11: 3칸 고정 간격으로만 줄을 내자 조각 아래 띠가 맨흙으로 남았고(마당 40%), 길이를 4~10 으로 흔든 줄은 «울타리 미로»로 읽혔다 —
    // 줄마다 아래로 한 칸씩 훑어 놓을 수 있는 곳에 놓고(위 칸이 다른 줄 앞면이면 안 된다 = 고랑 길 한 칸), 빈 구간은 12칸 넘으면 고르게 나눠 나란한 줄로.
    // r14: 줄마다 아래로 훑어 아무 줄에서나 시작하게 했더니 옆 구간과 한 칸씩 어긋난 «벽돌 쌓기 미로»였다 — 줄은 마당 공통 3칸 간격(시작 줄 맵마다)에만 놓아 나란한 이랑으로 읽히게,
    // 대신 줄 길이·사이(빠진 그루)·머리 들이기를 줄마다 흔든다. 조각 아래 남는 띠는 shrinkYard 가 풀로 돌린다.
    const phase = Math.floor(rnd() * 3);
    for (let y = box.y; y + 1 < box.y + box.h - 1; y++) {
      if ((y - box.y - phase + 3) % 3 !== 0) continue;
      let x = box.x + 1;
      while (x < box.x + box.w - 1) {
        let run = 0;
        while (x + run < box.x + box.w - 1 && free(x + run, y) && free(x + run, y + 1) && !isFront(x + run, y - 1) && !vineCells.has((y - 1) * W + x + run)) run++;
        if (run < 4) { x += run + 1; continue; }
        // r14: 줄을 고르게 나눈 같은 길이 줄은 16px 되풀이 격자로 읽혔다 — 줄마다 길이 4~11·사이 1~3칸(빠진 그루 자리)을 따로 뽑고, 줄 머리를 한 칸 들이기도 한다.
        const segs: [number, number][] = [];
        for (let pos = x + (rnd() < 0.3 ? 1 : 0); pos + 4 <= x + run;) {
          const left = x + run - pos;
          let L = Math.min(left, 4 + Math.floor(rnd() * 8));
          if (left - L > 0 && left - L < 5) L = left - L >= 2 && rnd() < 0.5 ? L : left; // 끝에 못 쓰는 토막을 남기지 않는다
          segs.push([pos, L]); pos += L + 1 + (rnd() < 0.35 ? 1 + Math.floor(rnd() * 2) : 0);
        }
        for (const [sx, L] of segs) {
          const row: number[] = [V0]; let sincePost = 0, last = -1;
          for (let c = 1; c < L - 1; c++) {
            let t: number;
            if (sincePost >= 2 && (sincePost >= 3 || rnd() < 0.5) && c < L - 2) { t = POST[Math.floor(rnd() * 2)]!; sincePost = 0; }
            else { do { t = MID[Math.floor(rnd() * MID.length)]!; } while (t === last); sincePost++; }
            row.push(t); last = t;
          }
          row.push(V0 + 7);
          const cells: number[] = [];
          row.forEach((t, c) => { const i = y * W + sx + c; mm.upperTiles[i] = t; mm.upperTiles[i + W] = t + 8; cells.push(i, i + W); });
          const after = reachable(draft, mm, isPassable(draft, mm, seed.x, seed.y) ? seed : { x: box.x, y: box.y + box.h });
          let cut = false;
          for (const i of comp.cells) {
            if (after.has(i) || vineCells.has(i) || cells.includes(i)) continue;
            const cx = i % W, cy = Math.floor(i / W);
            if (placed.some((p) => cx >= p.x && cx < p.x + p.w && cy >= p.y && cy < p.y + p.h)) continue;
            cut = true; break;
          }
          if (cut) for (const i of cells) mm.upperTiles[i] = -1;
          else for (const i of cells) { taken[i] = 1; vineCells.add(i); }
        }
        x += run + 1;
      }
    }
    // 작업 길은 줄 사이를 실제로 지나는 구간만 닻으로 친다(줄이 없는 끝까지 늘이면 빈 흙 띠가 남는다).
    const laneUsed = [...keep].filter((i) => [i - 1, i + 1, i - 2, i + 2, i - W, i + W].some((j) => vineCells.has(j)));
    return { vines: [...vineCells], lane: laneUsed };
  };
  for (const piece of pieces) {
    if (UNIQUE_SPOIL.has(piece.id) && placed.some((p) => p.objectId.endsWith(`/${piece.id}`))) continue;
    const isAdit = quarterId === "mining" && piece.id === "bd-pick-mining-valley-adit";
    const aditQueue: Box[] = [];
    if (isAdit) {
      for (const cand of aditSlots(piece.size.w, piece.size.h)) {
        let pm: ReturnType<typeof planMound> = null;
        for (const d of [3, 2]) { pm = planMound(cand, d); if (pm) break; }
        if (pm) { aditQueue.push(cand); if (aditQueue.length >= 6) break; }
      }
    }
    // r14: 기둥이 판석 섬 경계선 위(반은 판석, 반은 흙)에 서서 떠 보였다 — 기둥은 판석 끝에서 한 칸 이상 안쪽이나 판석에서 한 칸 이상 떨어진 흙에만, 자리를 더 오래 찾는다.
    // r14: 바위·버력이 갱구와 떨어진 마당 한쪽에 몰려 있었다 — 광산의 버력(광재·광석·돌무더기·바위)은 갱구 둘레 6칸 안에만, 자리가 없으면 뺀다.
    const aditBox = quarterId === "mining" ? placed.find((p) => p.objectId.endsWith("/bd-pick-mining-valley-adit")) : undefined;
    const spoil = quarterId === "mining" && !isAdit && /-(slagheap|slagrock|ore|pile|boulder-[ml])$/.test(piece.id);
    const isColumn = !!flagIsland && /-column-temple(-tall|-broken)?$/.test(piece.id);
    for (let attempt = 0; attempt < 6 + aditQueue.length + (isColumn ? 40 : 0); attempt++) {
      const queued = isAdit && attempt < aditQueue.length ? aditQueue[attempt]! : null;
      const outside = quarter.yard?.outside?.includes(piece.id) ?? false;
      const b = queued ?? (!outside && plazaBox && quarter.yard?.pack === "corner"
        ? packSlot(ok, walk, taken, W, H, piece.size.w, piece.size.h, plazaBox, attempt, fromRight, fromBottom)
        : spoil ? (aditBox ? nearestSlot(ok, walk, taken, W, H, piece.size.w, piece.size.h, aditBox.x + 1, aditBox.y + aditBox.h, attempt, 6) : null)
        : nearestSlot(outside ? outsideOk : ok, walk, taken, W, H, piece.size.w, piece.size.h,
          outside && plazaBox ? plazaBox.x + Math.floor(plazaBox.w / 2) : anchor.x, outside && plazaBox ? plazaBox.y + Math.floor(plazaBox.h / 2) : anchor.y, attempt, outside && plazaBox ? 20 : CLUSTER)
          // 마당 안 아무 자리에서 자라게 했더니 귀퉁이 기준점이면 반경 밖 빈 마당을 못 썼다 — 마당 안 남은 자리를 훑어 채운다.
          ?? (!outside && plazaBox && yardFreeAnchor ? packSlot(ok, walk, taken, W, H, piece.size.w, piece.size.h, plazaBox, attempt, fromRight) : null));
      if (!b) break;
      // r13: 무너진 바닥 판(floor-ruin)이 맨흙 위에 칼각 네모로 찍혀 «붙여 넣은 타일»로 읽혔다 — 신전 판석 섬 칸 위에만 둔다(아니면 그 자리를 버리고 다음).
      if (flagIsland && piece.id.endsWith("-floor-ruin")) {
        const fm = new Set(flagIsland.memberTileIds); let onFlag = 0;
        const lm = draft.maps[map.id]!;
        for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) if (fm.has(lm.lowerTiles[yy * W + xx]!)) onFlag++;
        if (onFlag < b.w * b.h) { mark(taken, W, H, { ...b, w: 1, h: 1 }); continue; }
      }
      if (isColumn) {
        const fm = new Set(flagIsland!.memberTileIds), lm = draft.maps[map.id]!;
        // 발치 둘레 3×3(밑 칸 위·아래·양옆)이 다 판석(섬 안쪽 한 칸 이상) 또는 다 흙(섬에서 한 칸 이상 떨어진 흙 위 홀로 선 기둥) — 경계에 걸치면 다음 자리.
        let flagN = 0, n = 0;
        for (let yy = b.y + b.h - 2; yy <= b.y + b.h; yy++) for (let xx = b.x - 1; xx <= b.x + b.w; xx++) {
          n++; if (xx >= 0 && yy >= 0 && xx < W && yy < H && fm.has(lm.lowerTiles[yy * W + xx]!)) flagN++;
        }
        if (flagN !== 0 && flagN !== n) continue; // 다음 자리(skip = attempt)로 — 막지 않는다
      }
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
      if (isAdit) { mound = null; for (const d of [3, 2]) { mound = planMound(b, d); if (mound) break; } }
      mark(taken, W, H, b);
      placed.push({ objectId, ...b });
      if (isAdit) wrapAdit(b);
      break;
    }
  }
  // r14: 광산 마당 절반이 빈 맨흙이었다 — 마당을 쓰는 자리로 줄인다: 조각(앞줄 포함)·둔덕에서 2~3칸(2×2 덩이 잡음) 안 흙만 남기고 나머지는 원래 풀로.
  // 길로 나가는 샛길(상자 밖 흙)과, 남긴 흙에서 샛길까지 두 칸 폭 길은 남긴다. 한 칸 혀·외톨이 칸은 풀로 돌리고 오토타일을 다시 맞춘다.
  // r14 포도원: 줄·작업 길에서 먼 맨흙 띠(마당 30~40%)도 같은 방법으로 풀에 내준다(포도나무 칸·작업 길을 닻으로, 3~4칸).
  const shrinkYard = (extra: readonly { x0: number; y0: number; x1: number; y1: number }[], base: number): void => {
    if (!plazaBox || !yardGroup || !yardMembers || !placed.length) return;
    const mm = draft.maps[map.id]!, pb = plazaBox, salt = fdFmix((pb.x * 7919) ^ (pb.y * 104729) ^ W);
    const anchors = [...placed.map((p) => ({ x0: p.x, y0: p.y, x1: p.x + p.w - 1, y1: p.y + p.h })), ...extra];
    const dTo = (x: number, y: number) => Math.min(...anchors.map((a) => Math.max(a.x0 - x, x - a.x1, a.y0 - y, y - a.y1, 0)));
    const inPb = (x: number, y: number) => x >= pb.x && y >= pb.y && x < pb.x + pb.w && y < pb.y + pb.h;
    const isYard = (i: number) => yardMembers.has(mm.lowerTiles[i]!);
    const keep = new Set<number>(), cand: number[] = [];
    for (let y = Math.max(0, pb.y - 3); y < Math.min(H, pb.y + pb.h + 3); y++) for (let x = Math.max(0, pb.x - 3); x < Math.min(W, pb.x + pb.w + 3); x++) {
      const i = y * W + x; if (!isYard(i) && !mound?.cells.has(i)) continue;
      if (!inPb(x, y) || mound?.cells.has(i)) { keep.add(i); continue; }
      const lim = base + (fdHash(Math.floor((x - pb.x) / 2), Math.floor((y - pb.y) / 2), salt) % 2);
      if (dTo(x, y) <= lim) keep.add(i); else cand.push(i);
    }
    // 남긴 흙(상자 안)에서 샛길(상자 밖 흙)까지 잇는 길: 상자 안 흙 칸 위 BFS.
    const outer = [...keep].filter((i) => !inPb(i % W, Math.floor(i / W)) && !mound?.cells.has(i));
    if (outer.length) {
      const prev = new Map<number, number>(); let q: number[] = [];
      for (const i of keep) if (inPb(i % W, Math.floor(i / W)) && !mound?.cells.has(i)) { prev.set(i, -1); q.push(i); }
      let hit = -1;
      for (const i of q) if ([i - 1, i + 1, i - W, i + W].some((j) => outer.includes(j))) { hit = i; break; }
      while (hit < 0 && q.length) {
        const next: number[] = [];
        for (const i of q) for (const j of [i - 1, i + 1, i - W, i + W]) {
          if (j < 0 || j >= W * H || prev.has(j) || Math.abs((j % W) - (i % W)) > 1 || !inPb(j % W, Math.floor(j / W)) || !isYard(j)) continue;
          prev.set(j, i); next.push(j);
          if (hit < 0 && [j - 1, j + 1, j - W, j + W].some((k) => outer.includes(k))) hit = j;
        }
        q = next;
      }
      for (let c = hit; c >= 0; c = prev.get(c) ?? -1) { keep.add(c); for (const j of [c + 1, c + W]) if (j < W * H && isYard(j) && inPb(j % W, Math.floor(j / W))) keep.add(j); }
    }
    const grassBack = (i: number) => { mm.lowerTiles[i] = preYard[i]!; if ((mm.upperTiles[i] ?? -1) >= 0 && !placed.some((p) => i % W >= p.x && i % W < p.x + p.w && Math.floor(i / W) >= p.y && Math.floor(i / W) < p.y + p.h)) mm.upperTiles[i] = -1; };
    // 바깥 풀밭에 이어진 후보만 걷는다 — 마당 속에 떨어진 후보까지 걷으면 흙 안에 네모 풀 구멍이 생겼다(r14 시험).
    const candSet = new Set(cand.filter((i) => !keep.has(i))), peel = new Set<number>(), pq: number[] = [];
    for (const i of candSet) if ([i - 1, i + 1, i - W, i + W].some((j) => j >= 0 && j < W * H && Math.abs((j % W) - (i % W)) <= 1 && !isYard(j) && !mound?.cells.has(j))) { peel.add(i); pq.push(i); }
    for (let h = 0; h < pq.length; h++) for (const j of [pq[h]! - 1, pq[h]! + 1, pq[h]! - W, pq[h]! + W]) if (candSet.has(j) && !peel.has(j) && Math.abs((j % W) - (pq[h]! % W)) <= 1) { peel.add(j); pq.push(j); }
    for (const i of peel) grassBack(i);
    // 마당 속에 갇힌 풀 덩이(홈 깎기·이전 판이 남긴 네모 구멍)는 마당 흙으로 메운다 — 상자 밖 풀밭에 닿지 않는 풀 덩이만.
    const body = yardGroup.variantMap["255"];
    if (body !== undefined) {
      const seen = new Set<number>();
      for (let y = pb.y; y < pb.y + pb.h; y++) for (let x = pb.x; x < pb.x + pb.w; x++) {
        const i0 = y * W + x; if (seen.has(i0) || isYard(i0) || mound?.cells.has(i0) || (mm.upperTiles[i0] ?? -1) >= 0 || (mm.relief?.levels[i0] ?? 0) !== (mm.relief?.levels[pb.y * W + pb.x] ?? 0)) continue;
        const comp2 = [i0]; seen.add(i0); let open = false;
        for (let h = 0; h < comp2.length; h++) { const c = comp2[h]!, cx = c % W, cy = Math.floor(c / W);
          if (!inPb(cx, cy)) { open = true; continue; }
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) { open = true; continue; } const j = ny * W + nx; if (seen.has(j) || isYard(j) || mound?.cells.has(j)) continue; seen.add(j); comp2.push(j); } }
        if (!open && comp2.length <= 12) for (const c of comp2) if ((mm.upperTiles[c] ?? -1) < 0 && !houseCells.has(c)) { mm.lowerTiles[c] = body; if (mm.lowerOverlayTiles) mm.lowerOverlayTiles[c] = -1; }
      }
    }
    const dirtAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && (isYard(y * W + x) || !!mound?.cells.has(y * W + x));
    for (let pass = 0; pass < 3; pass++) for (const i of keep) {
      const x = i % W, y = Math.floor(i / W);
      if (!inPb(x, y) || mound?.cells.has(i) || !isYard(i) || dTo(x, y) === 0) continue;
      const n = dirtAt(x, y - 1), so = dirtAt(x, y + 1), e = dirtAt(x + 1, y), w = dirtAt(x - 1, y);
      if ((!e && !w) || (!n && !so) || [n, so, e, w].filter(Boolean).length <= 1) grassBack(i);
    }
    shapeYard(mm, yardGroup);
  };
  if (quarterId === "mining") shrinkYard(trackCells.map((i) => ({ x0: i % W, y0: Math.floor(i / W), x1: i % W, y1: Math.floor(i / W) })), 1);
  if (plazaBox && quarter.yard?.ruin) overgrowYard(draft, map.id, plazaBox, placed, flagIsland ?? undefined);
  if (quarterId === "vineyard" && plazaBox && yardMembers) {
    const { vines, lane } = fillVineRows(plazaBox);
    shrinkYard([...vines, ...lane].map((i) => ({ x0: i % W, y0: Math.floor(i / W), x1: i % W, y1: Math.floor(i / W) })), 1);
  }
  if (!placed.length) throw new ToolError(`「${quarter.ko}」 조각을 하나도 놓지 못했다 — 트인 땅이 모자라거나 놓으면 길이 끊긴다. 마을을 더 크게 짓거나 near 를 바꾼다.`, { code: "no-quarter-slot", mapId: map.id });
  const box = placed.reduce((a, p) => ({ x0: Math.min(a.x0, p.x), y0: Math.min(a.y0, p.y), x1: Math.max(a.x1, p.x + p.w), y1: Math.max(a.y1, p.y + p.h) }), { x0: W, y0: H, x1: 0, y1: 0 });
  const missing = Math.max(0, pieces.length - placed.length);
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
    + "quarter: mining 광산 갱구 마당(갱구·권양탑·제련소·광재 더미·광차 — 광산촌) · vineyard 포도원(포도주 창고·포도밭 이랑·압착기·올리브 — 포도원 마을) · temple-ruins 신전 폐허(소신전·기둥·무너진 벽 — 고대 유적 마을) · viking 북방 표지(룬석·방패 걸이·오로라 깃발 — 바이킹 마을, snow_north 맵) · "
    + "walled-market 장터 좌판·짐수레·통행세 초소(중세 장터) — 버들항(beodeul_city) 맵 · joseon-market 조선 장터 좌판 — 조선(joseon_baram) 맵. "
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
