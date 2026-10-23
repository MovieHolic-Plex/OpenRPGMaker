// dress_village_quarter — 지은 마을 맵의 트인 땅에 «쓰임 한 덩이»(광산 갱구 마당·포도원·신전 폐허·마법사의 탑 뜰·성벽 장터 좌판·조선 장터)를
// 번들 조각 그대로 한 번에 앉힌다(2026-10-22 마을 종류 표). 조각은 이미 있었다(버들항 bd-pick-mining-valley-* 50개, vineyard·temple-ruins·
// walled-market, 조선 jb-market_stall*). 마법사의 탑(11×16)은 지은 마을 안에 들어갈 땅이 없어 넣지 않았다. 빠져 있던 것은 «마을 종류 → 그 조각 덩이»를 길·문 앞을 막지 않고 모아 놓는 한 단계였다.
// 실조수 시험(r1): 모델이 조선 좌판을 손으로 찍다 7번 거절되고 남은 4개가 관아 마당·밭가에 흩어져 장터로 읽히지 않았다.
// 규칙: 조각 칸은 모두 비고(위층 그림·이벤트 없음)·걸을 수 있고 길(흔한 바닥이 아닌 칸)을 덮지 않는다 — 사방 7칸 넘게 트인 흙 마당은 예외.
// 조각 사이 1칸, 앞줄(아래 한 줄)은 걸을 수 있다. 찍을 때마다 통행을 다시 재서 원래 닿던 칸을 끊으면 되돌린다. 놓기 규칙·높이 단은 stamp_object 가 그대로 본다.
import { isPassable } from "@/project/collision";
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
  readonly plaza?: { readonly w: number; readonly h: number; readonly ground: readonly number[]; readonly grass: readonly number[]; readonly soft: readonly string[]; /** 풀밭 위 걷어도 되는 칸 번호(버들항 자연 이식 칸 — 꽃·풀 무늬·나무, tileMeta 태그 없음) */ readonly softTiles?: readonly number[]; /** 길로 치는 바닥 tileMeta tags[2](또는 tags[1])(밭·논은 길이 아니다) */ readonly roads?: readonly string[]; /** 마당 테두리를 맵마다 다르게 파고(notch), ruin 이면 판석 속에 풀 구멍(빠진 돌)도 낸다 */ readonly rough?: "notch" | "ruin" };
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
  vineyard: { tilesetId: "beodeul_city", ko: "포도원", yard: { group: "beodeul_yard_dirt", w: 26, h: 15, pack: "corner", outside: ["bd-pick-vineyard-olive-a", "bd-pick-vineyard-olive-b", "bd-pick-vineyard-olive-c"] }, pieces: ["bd-pick-vineyard-winery", "bd-pick-vineyard-vine-field", "bd-pick-vineyard-vine-field", "bd-pick-vineyard-vine-field", "bd-pick-vineyard-vine-field", "bd-pick-vineyard-wine-press", "bd-pick-vineyard-pergola", "bd-pick-vineyard-cask-rack", "bd-pick-vineyard-barrels-standing", "bd-pick-vineyard-grape-baskets", "bd-pick-vineyard-olive-a", "bd-pick-vineyard-olive-b", "bd-pick-vineyard-olive-c"] },
  "temple-ruins": { tilesetId: "beodeul_city", ko: "신전 폐허", yard: { group: "beodeul_yard_flag", w: 16, h: 11, ruin: true }, pieces: ["bd-pick-temple-ruins-roof-naiskos-pediment", "bd-pick-temple-ruins-roof-hip-shrine", "bd-pick-temple-ruins-column-temple-tall", "bd-pick-temple-ruins-column-temple-tall", "bd-pick-temple-ruins-column-temple", "bd-pick-temple-ruins-column-temple-broken", "bd-pick-temple-ruins-fallen-column-temple", "bd-pick-temple-ruins-ruined-wall-2", "bd-pick-temple-ruins-ruined-wall-2", "bd-pick-temple-ruins-cypress-ruin", "bd-pick-temple-ruins-rubble-temple", "bd-pick-temple-ruins-rubble-temple"], faces: ["bd-pick-temple-ruins-roof-baldachin", "bd-pick-temple-ruins-roof-hip-storehouse"], extras: ["bd-pick-temple-ruins-mosaic-medallion-5x5", "bd-pick-temple-ruins-floor-ruin", "bd-pick-temple-ruins-floor-ruin", "bd-pick-temple-ruins-floor-ruin", "bd-pick-temple-ruins-column-temple-broken", "bd-pick-temple-ruins-fallen-column-temple", "bd-pick-temple-ruins-rubble-temple", "bd-pick-temple-ruins-face-temple-2h", "bd-pick-temple-ruins-roof-hip-shrine"] },
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
  if (lane && softTiles.size) {
    const extra: number[] = [];
    for (const i of lane.cells) { const x = i % W; const vertical = lane.cells.includes(i - W) || lane.cells.includes(i + W);
      const ni = vertical ? (x + 1 < W ? i + 1 : -1) : i + W; if (ni >= 0 && ni < W * H && !lane.cells.includes(ni) && walkable(ni)) extra.push(ni); }
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
function roughenYard(map: GameMap, b: Box, origLower: readonly number[], lane: ReadonlySet<number>, mode: "notch" | "ruin"): void {
  const W = map.width;
  let st = ((b.x * 2654435761) ^ (b.y * 40503) ^ (W * 97) ^ (b.w * 7919)) >>> 0;
  const rnd = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
  const nearLane = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (lane.has((y + dy) * W + x + dx)) return true; return false; };
  const revert = (cells: [number, number][]) => { if (cells.some(([x, y]) => nearLane(x, y))) return; for (const [x, y] of cells) map.lowerTiles[y * W + x] = origLower[y * W + x]!; };
  const sides: { len: number; at: (t: number) => [number, number] }[] = [
    { len: b.w, at: (t) => [b.x + t, b.y] }, { len: b.w, at: (t) => [b.x + t, b.y + b.h - 1] },
    { len: b.h, at: (t) => [b.x, b.y + t] }, { len: b.h, at: (t) => [b.x + b.w - 1, b.y + t] },
  ];
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
 * 무너진 판석 마당: 돌 틈에 풀이 올라온 덩이 3~5곳 — 이 맵 풀밭에 이미 깔린 풀·꽃 덧그림(버들항 자연 이식 칸, 아래 덧층)만 옮겨 쓴다.
 * r5: 신전 마당이 «새로 깐 광장»으로 읽혔다. 조각 자리·위층이 있는 칸은 건드리지 않는다.
 */
/**
 * 무너진 판석(r7): 판석 마당이 «갓 깐 새 포장»으로 읽혔다(가장자리 연석이 끊김 없이 또렷하다). 판석 칸 일부를 같은 이웃 모양(마스크)의 다진 흙 마당 칸으로 바꾼다 —
 * 가장자리는 절반쯤 흙으로 무너지고, 안쪽은 판석 몇 장이 빠진 흙 자리 덩이. 같은 마스크 칸을 쓰니 풀밭 쪽 가장자리는 흙 마당 가장자리 그대로 이어지고 화단 같은 연석 구멍이 생기지 않는다.
 */
function crumbleFlag(draft: Project, map: GameMap, box: Box, placed: readonly Box[], flag: YardGroup, rnd: () => number): void {
  const ts = draft.tilesets[map.tilesetId] as unknown as { autotileGroups?: YardGroup[] };
  const dirt = ts.autotileGroups?.find((g) => g.id === "beodeul_yard_dirt");
  if (!dirt) return;
  const maskOf = new Map<number, string>();
  for (const [m, t] of Object.entries(flag.variantMap)) maskOf.set(t, m);
  for (const t of flag.interiorVariants?.flat() ?? []) maskOf.set(t, "255");
  const W = map.width;
  const inPiece = (x: number, y: number) => placed.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h + 1);
  // r8: 안쪽 «빠진 판석» 덩이가 네모 구멍·一자·ㄱ자로 읽혔다 — 안쪽 구멍은 뺐다. 가장자리만 흙으로 무너뜨리고, 연석은 풀 덮기가 가린다.
  for (let y = box.y - 1; y <= box.y + box.h; y++) for (let x = box.x - 1; x <= box.x + box.w; x++) {
    if (x < 0 || y < 0 || x >= W || y >= map.height || inPiece(x, y)) continue;
    const i = y * W + x; const mask = maskOf.get(map.lowerTiles[i]!); if (mask === undefined) continue;
    if (mask === "255") continue;
    const p = 0.4;
    if (rnd() > p) continue;
    const t = dirt.variantMap[mask] ?? (mask === "255" ? dirt.variantMap["255"] : undefined);
    if (t !== undefined) map.lowerTiles[i] = t;
  }
}

function overgrowYard(draft: Project, mapId: string, box: Box, placed: readonly Box[], flag?: YardGroup): void {
  const map = draft.maps[mapId]!; const W = map.width, up = map.upperTiles;
  // 버들항 장소 덧그림(위층, 한 칸): 무너진 대리석·돌 부스러기, 작은 고사리, 낮은 헤더 덤불, 자갈 — 큰 덤불·나무 조각은 쓰지 않는다.
  const meta = (draft.tilesets[map.tilesetId] as unknown as { tileMeta?: readonly TileMetaRow[] }).tileMeta ?? [];
  const pool = [26956, 26956, 26666, 27542, 27542, 27511, 27512, 27513, 27598].filter((t) => meta[t]?.tags?.[2] === "decal");
  if (!pool.length) return;
  let st = ((box.x * 374761393) ^ (box.y * 668265263) ^ W) >>> 0;
  const rnd = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
  if (flag) crumbleFlag(draft, map, box, placed, flag, rnd);
  // 조각 칸과 그 앞줄(문·발밑)만 피한다 — 둘레 1칸까지 피했더니 덧그림이 거의 안 남았다.
  const inPiece = (x: number, y: number) => placed.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h + 1);
  // 풀은 마당 가장자리(연석 쪽)에 더 많이, 가운데엔 드물게 — 무너진 판석 사이로 풀이 밀고 들어온 모양.
  const seeds = Array.from({ length: 4 + Math.floor(rnd() * 3) }, () => ({ x: box.x + rnd() * box.w, y: box.y + rnd() * box.h }));
  // 가장자리 = 실제 마당 윤곽(깎인 홈 포함). 상자 기준으로 재면 홈 안쪽 연석은 «가운데»로 쳐져 맨살로 남았다(r8).
  const ts = draft.tilesets[map.tilesetId] as unknown as { autotileGroups?: YardGroup[] };
  const members = new Set([...(flag?.memberTileIds ?? []), ...(ts.autotileGroups?.find((g) => g.id === "beodeul_yard_dirt")?.memberTileIds ?? [])]);
  const inYard = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < map.height && members.has(map.lowerTiles[y * W + x]!);
  const ring = (x: number, y: number, r: number) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!inYard(x + dx, y + dy)) return true; return false; };
  for (let y = box.y - 1; y <= box.y + box.h; y++) for (let x = box.x - 1; x <= box.x + box.w; x++) {
    if (inPiece(x, y) || (members.size && !inYard(x, y))) continue;
    const edge = !members.size ? Math.min(x - box.x, box.x + box.w - 1 - x, y - box.y, box.y + box.h - 1 - y) : ring(x, y, 1) ? 0 : ring(x, y, 2) ? 1 : 2;
    const near = seeds.some((c) => Math.hypot(c.x - x, c.y - y) < 2.2);
    // r8: 연석이 끊김 없이 또렷했다 — 가장자리 풀 덮기를 늘린다.
    const p = (edge <= 0 ? 0.7 : edge === 1 ? 0.3 : 0.08) + (near ? 0.35 : 0);
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
  return { group, plaza: { w: yard.w + jw, h: yard.h + jh, ground, grass: [...grass], soft: BEODEUL_YARD_SOFT, softTiles, roads: BEODEUL_YARD_ROADS, rough: yard.ruin ? "ruin" : "notch" } };
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
  const yardMembers = yardGroup ? new Set(yardGroup.memberTileIds) : null;
  const ok = plazaBox ? grid.map((v, i) => { const x = i % W, y = Math.floor(i / W); return v && x > plazaBox!.x && x < plazaBox!.x + plazaBox!.w - 1 && y >= plazaBox!.y && y < plazaBox!.y + plazaBox!.h - 1 && (!yardMembers || yardMembers.has(map.lowerTiles[i]!)) ? 1 : 0; }) : grid;
  // 마당 밖 조각(밭·과수)은 마당 바닥을 피한 풀밭 격자에.
  const outsideOk = plazaBox ? grid.map((v, i) => { const x = i % W, y = Math.floor(i / W); return v && !(x >= plazaBox!.x - 1 && x <= plazaBox!.x + plazaBox!.w && y >= plazaBox!.y - 1 && y <= plazaBox!.y + plazaBox!.h) ? 1 : 0; }) : grid;
  // 같은 덩이가 맵마다 같은 배치로 찍히지 않게: 마당 자리(맵마다 다르다)로 섞는 순서와 채우는 귀(북서·북동)를 정한다. 첫 조각(덩이의 얼굴)은 그대로 맨 앞.
  let mix = plazaBox ? ((plazaBox.x * 73856093) ^ (plazaBox.y * 19349663) ^ (W * 83492791)) >>> 0 : 0;
  const rnd = () => { mix = (Math.imul(mix, 1664525) + 1013904223) >>> 0; return mix / 4294967296; };
  const fromRight = plazaBox ? rnd() < 0.5 : false;
  const oneOfDup = rnd() < 0.5;
  const fromBottom = plazaBox ? rnd() < 0.5 : false; // r3: 포도원 두 맵이 같은 귀·같은 배치였다 — 위·아래 채우기도 맵마다
  // 얼굴 조각은 맵마다 둘 중 하나(faces), 더하는 조각(extras)은 맵마다 2~4개 — r6: 두 맵이 같은 묶음·같은 얼굴로 읽혔다.
  const face = plazaBox && quarter.faces?.length && rnd() < 0.4 ? quarter.faces[Math.floor(rnd() * quarter.faces.length)]! : quarter.pieces[0]!;
  const extraPool = plazaBox ? [...(quarter.extras ?? [])] : [];
  const extras: string[] = []; for (let n = 2 + Math.floor(rnd() * 3); n > 0 && extraPool.length; n--) extras.push(extraPool.splice(Math.floor(rnd() * extraPool.length), 1)[0]!);
  const basePieces = [face, ...quarter.pieces.slice(1), ...extras];
  const order = plazaBox
    ? [face, ...basePieces.slice(1).map((id) => { const z = kitSize(draft, quarter.tilesetId, id); return { id, r: (z ? z.w * z.h : 0) * (0.4 + 1.2 * rnd()) }; }).sort((a, b) => b.r - a.r).map((o) => o.id)]
    : [...quarter.pieces];
  // 되풀이 조각(포도밭 이랑 둘)은 맵마다 하나 또는 둘 — 같은 덩이가 늘 같은 구성으로 읽히지 않게(빈자리는 압착기·통 선반이 쓴다).
  if (plazaBox && quarter.yard?.pack === "corner" && oneOfDup) { const dup = order.findIndex((id, i) => order.indexOf(id) !== i); if (dup > 0) order.splice(dup, 1); }
  // 마당이 있는 다른 덩이(신전 폐허): 되풀이 조각 몇 개를 맵마다 다르게 뺀다 — r2 에서 두 맵이 같은 도장으로 읽혔다.
  if (plazaBox && quarter.yard?.pack !== "corner") {
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
  const wrapAdit = (adit: Box): void => {
    const heap = (id: string, x: number, y: number): boolean => {
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
      let from = comp.seed; if (!isPassable(draft, current, from.x, from.y)) from = { x: adit.x + 1, y: adit.y + adit.h };
      const after = reachable(draft, current, from);
      for (const i of comp.cells) { const cx = i % W, cy = Math.floor(i / W); if (!inPiece(cx, cy) && !after.has(i)) { draft.maps[map.id] = snapshot; return false; } }
      mark(taken, W, H, bx); placed.push({ objectId, ...bx }); return true;
    };
    // r7: 같은 버력 더미 셋이 갱구 양옆·아래에 대칭으로 서서 «도장»으로 읽혔다 — 더미는 id 마다 한 번, 양옆은 서로 다른 것.
    const used = (id: string) => placed.some((p) => p.objectId.endsWith(`/${id}`));
    const big = rnd() < 0.5 ? ["bd-pick-mining-valley-slagheap", "bd-pick-mountain-pass-boulder-l"] : ["bd-pick-mountain-pass-boulder-l", "bd-pick-mining-valley-slagheap"];
    const small = rnd() < 0.5 ? ["bd-pick-mining-valley-ore", "bd-pick-mountain-pass-boulder-m", "bd-pick-mining-valley-slagrock"] : ["bd-pick-mountain-pass-boulder-m", "bd-pick-mining-valley-slagrock", "bd-pick-mining-valley-ore"];
    const back = ["bd-pick-mountain-pass-boulder-m", "bd-pick-mining-valley-slagrock", "bd-pick-mining-valley-ore"];
    // 갱구에 맞붙여(틈 없이) 양옆·뒤를 서로 다른 바위로 감싼다 — 한 칸 띄운 더미는 «갱구 옆에 따로 놓인 돌»로 읽혔다(r7). 맞붙일 수 없으면 한 칸 띄운다.
    const z = (id: string) => kitSize(draft, quarter.tilesetId, id) ?? { w: 2, h: 2 };
    const bottom = adit.y + adit.h - 1;
    const leftSpots = (id: string): [number, number][] => [[adit.x - z(id).w, bottom - z(id).h], [adit.x - z(id).w, bottom - z(id).h + 1], [adit.x - z(id).w - 1, bottom - z(id).h]];
    const rightSpots = (id: string): [number, number][] => [[adit.x + adit.w, bottom - z(id).h], [adit.x + adit.w, bottom - z(id).h + 1], [adit.x + adit.w + 1, bottom - z(id).h]];
    for (const id of big) { if (used(id)) continue; if (leftSpots(id).some(([x, y]) => heap(id, x, y))) break; }
    for (const id of small) { if (used(id)) continue; if (rightSpots(id).some(([x, y]) => heap(id, x, y))) break; }
    // r8: 양옆 바위만으로는 여전히 «평지에 선 돌 상자»였다 — 갱구 뒤 마당 안쪽을 높이 지형(relief) 2단 둔덕으로 올려, 지형 렌더러가 그리는 절벽 면 앞에 갱구가 서게 한다.
    if (!raiseAditHill(adit)) for (const id of back) { if (used(id)) continue; if ([[adit.x + Math.floor(rnd() * 2), adit.y - z(id).h], [adit.x - 1, adit.y - z(id).h + 1]].some(([x, y]) => heap(id, x, y))) break; }
    screeAround(adit);
  };
  const raiseAditHillDepth = (adit: Box, depth: number): boolean => {
    const m = draft.maps[map.id]!; const relief = m.relief;
    if (!relief || relief.width !== W || relief.height !== H) return false;
    const base = relief.levels[(adit.y + adit.h - 1) * W + adit.x] ?? 0;
    if (base + 2 > 14) return false;
    const hitPiece = (x: number, y: number) => placed.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h + 1);
    const mound = new Set<number>();
    // 갱구 바로 뒤 줄은 갱구 폭+양옆 1칸, 뒤로 갈수록 좌우를 0~1칸씩 넓히거나 좁혀 울퉁불퉁하게(최대 4줄).
    let l = adit.x - 1, r = adit.x + adit.w;
    for (let y = adit.y - 1, k = 0; y >= adit.y - depth && y >= 0; y--, k++) {
      if (k > 0) { l += Math.floor(rnd() * 3) - 1; r += Math.floor(rnd() * 3) - 1; }
      let row = 0;
      for (let x = Math.max(0, l); x <= Math.min(W - 1, r); x++) {
        const i = y * W + x;
        // 마당 안(ok) 또는 마당 밖 빈 풀밭(grid — 길·집·나무 칸 제외). 갱구가 마당 윗변에 붙으면 뒤 둔덕은 풀 언덕이 된다.
        if (!(ok[i] || grid[i]) || hitPiece(x, y) || (relief.levels[i] ?? 0) !== base) continue;
        mound.add(i); row++;
      }
      if (k === 0 && row < adit.w) return false;   // 갱구 바로 뒤가 마당 밖이면(길·마당 끝) 둔덕을 올리지 않는다
      if (!row) break;
    }
    if (mound.size < adit.w + 2) return false;
    // 둔덕은 걸어 오를 수 없다 — 둔덕 칸을 막힌 칸으로 치고, 둔덕 밖 원래 통행 칸이 하나라도 끊기면 올리지 않는다.
    const pass = (x: number, y: number) => !mound.has(y * W + x) && isPassable(draft, m, x, y);
    let from = comp.seed; if (!pass(from.x, from.y)) from = { x: adit.x + 1, y: adit.y + adit.h };
    const seen = new Set<number>([from.y * W + from.x]); const q = [from.y * W + from.x];
    while (q.length) { const i = q.pop()!; const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const ni = ny * W + nx; if (seen.has(ni) || !pass(nx, ny)) continue; seen.add(ni); q.push(ni); } }
    for (const i of comp.cells) { const x = i % W, y = Math.floor(i / W); if (!mound.has(i) && !hitPiece(x, y) && !seen.has(i)) return false; }
    for (const i of mound) { relief.levels[i] = base + 2; taken[i] = 1; }
    return true;
  };
  // 둔덕이 길을 끊으면 뒤 줄부터 덜어 가며 세 번까지 다시 본다.
  const raiseAditHill = (adit: Box): boolean => {
    for (const depth of [4, 3, 2]) if (raiseAditHillDepth(adit, depth)) return true;
    return false;
  };
  const kitRows = (id: string) => draft.tilesets[quarter.tilesetId]?.structureKits?.find((k) => k.id === id)?.rows ?? [];
  // 갱구 둘레 흙 칸에 산길 돌 부스러기 덧그림(위층) — 바위 땅을 깔았더니 회색 콘크리트 판으로 읽혀(r7 시험) 부스러기만 남겼다.
  const screeAround = (adit: Box): void => {
    const scree = ["bd-pick-mountain-pass-scree-a", "bd-pick-mountain-pass-scree-b"].flatMap((id) => kitRows(id).flatMap((r) => [...(r.upperTiles ?? []), ...(r.tiles ?? [])].filter((t): t is number => typeof t === "number" && t >= 0)));
    if (!scree.length) return;
    const m = draft.maps[map.id]!;
    const inPlaced = (x: number, y: number) => placed.some((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h + 1);
    for (let y = adit.y - 3; y <= adit.y + adit.h + 1; y++) for (let x = adit.x - 5; x <= adit.x + adit.w + 4; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x; if (!ok[i] || inPlaced(x, y) || (m.upperTiles[i] ?? -1) >= 0) continue;
      if (rnd() > 0.3) continue;
      m.upperTiles[i] = scree[Math.floor(rnd() * scree.length)]!;
    }
  };
  const UNIQUE_SPOIL = new Set(["bd-pick-mining-valley-slagheap", "bd-pick-mining-valley-slagrock", "bd-pick-mining-valley-ore"]);
  for (const piece of pieces) {
    if (UNIQUE_SPOIL.has(piece.id) && placed.some((p) => p.objectId.endsWith(`/${piece.id}`))) continue;
    for (let attempt = 0; attempt < 6; attempt++) {
      const outside = quarter.yard?.outside?.includes(piece.id) ?? false;
      const b = !outside && plazaBox && quarter.yard?.pack === "corner"
        ? packSlot(ok, walk, taken, W, H, piece.size.w, piece.size.h, plazaBox, attempt, fromRight, fromBottom)
        : nearestSlot(outside ? outsideOk : ok, walk, taken, W, H, piece.size.w, piece.size.h,
          outside && plazaBox ? plazaBox.x + Math.floor(plazaBox.w / 2) : anchor.x, outside && plazaBox ? plazaBox.y + Math.floor(plazaBox.h / 2) : anchor.y, attempt, outside && plazaBox ? 20 : CLUSTER)
          // 마당 안 아무 자리에서 자라게 했더니 귀퉁이 기준점이면 반경 밖 빈 마당을 못 썼다 — 마당 안 남은 자리를 훑어 채운다.
          ?? (!outside && plazaBox && yardFreeAnchor ? packSlot(ok, walk, taken, W, H, piece.size.w, piece.size.h, plazaBox, attempt, fromRight) : null);
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
      if (quarterId === "mining" && piece.id === "bd-pick-mining-valley-adit") wrapAdit(b);
      break;
    }
  }
  if (plazaBox && quarter.yard?.ruin) overgrowYard(draft, map.id, plazaBox, placed, yardGroup ?? undefined);
  if (quarterId === "vineyard") reshapeVineFields(draft.maps[map.id]!, placed.filter((p) => p.objectId.endsWith("/bd-pick-vineyard-vine-field")), yardGroup?.variantMap["255"]);
  if (!placed.length) throw new ToolError(`「${quarter.ko}」 조각을 하나도 놓지 못했다 — 트인 땅이 모자라거나 놓으면 길이 끊긴다. 마을을 더 크게 짓거나 near 를 바꾼다.`, { code: "no-quarter-slot", mapId: map.id });
  const box = placed.reduce((a, p) => ({ x0: Math.min(a.x0, p.x), y0: Math.min(a.y0, p.y), x1: Math.max(a.x1, p.x + p.w), y1: Math.max(a.y1, p.y + p.h) }), { x0: W, y0: H, x1: 0, y1: 0 });
  const missing = pieces.length - placed.length;
  return {
    summary: `${plazaBox ? `큰길가 (${plazaBox.x},${plazaBox.y}) ${plazaBox.w}×${plazaBox.h} 에 마당 흙을 깔고(그 자리 나무는 걷었다) ` : ""}「${quarter.ko}」 ${placed.length}조각을 (${box.x0},${box.y0})~(${box.x1 - 1},${box.y1 - 1}) 에 한 덩이로 앉혔다${missing ? ` (${pieces.length}개 중 — ${missing}개는 자리 부족·놓기 규칙으로 뺐다)` : ""}. 길·문 앞 통행은 그대로다.`,
    data: { mapId: map.id, quarter: quarterId, ...(plazaBox ? { plaza: plazaBox } : {}), pieces: placed, rejected, rect: { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 } },
    ...(missing ? { warnings: [`${missing}개 조각은 놓지 못했다 — 더 넣으려면 마을을 키워 다시 짓거나 near 를 다른 트인 땅으로 준다. 조각을 손으로 흩어 찍지 않는다.`] } : {}),
  };
}

/**
 * 포도밭 이랑 키트(bd-pick-vineyard-vine-field, 8×4 틀에 6×4 그림)는 한 장뿐이라 여러 번 찍으면 «복사 도장»으로 읽혔다(r4·r5 검수: 같은 윤곽·같은 기둥 자리).
 * 찍은 자리(틀) 안에서 밭마다 이랑 길이(속 2~6칸)·줄 수(1~2)·틀 안 위치를 다르게 다시 깐다 — 원본 칸(윗줄·속·아랫줄·양 끝·모서리)만 쓰고 새 그림은 없다.
 */
const VINE = { tl: 24269, top: [24270, 24271, 24272], tr: 24273, left: [24274, 24280], right: [24279, 24285],
  inner: [...Array(4).fill([24275, 24276, 24278, 24281, 24282, 24284]).flat(), 24277], bl: 24286, bottom: [24287, 24288, 24289], br: 24290 };
// br: 원본 아랫줄 오른 끝 칸(24291)은 노란 표지 칸이라 모든 밭 같은 자리에 «외톨이 금빛 칸»으로 읽혔다(r5~r7) — 바로 옆 아랫줄 칸 24290 이 오른 기둥까지 그려져 있어 그걸 귀로 쓴다.
// 속 칸 24283(비어 있는 흙 칸)은 «죽은 칸»으로 읽혀 뺐다(r7).
function reshapeVineFields(map: GameMap, fields: readonly { x: number; y: number; w: number; h: number }[], body?: number): void {
  const W = map.width;
  const layers = [map.lowerTiles, map.lowerOverlayTiles, map.upperTiles, map.upperOverlayTiles].filter((a): a is number[] => Array.isArray(a));
  const isVine = (t: number) => t >= 24269 && t <= 24291;
  for (const f of fields) {
    let st = ((f.x * 2246822519) ^ (f.y * 3266489917) ^ (W * 668265263)) >>> 0;
    const rnd = () => { st = (Math.imul(st, 1664525) + 1013904223) >>> 0; return st / 4294967296; };
    const pick = (a: readonly number[]) => a[Math.floor(rnd() * a.length)]!;
    const at = (x: number, y: number) => y * W + x;
    const edgeLayer = layers.find((a) => a[at(f.x, f.y)] === VINE.tl), innerLayer = layers.find((a) => isVine(a[at(f.x + 1, f.y + 1)] ?? -1));
    if (!edgeLayer || !innerLayer) continue;
    // 지운 칸은 마당 몸 칸으로(r6: 원래 칸을 베껴 오면 가장자리 조각이 마당 한가운데 떠 보였다)
    const ground = body ?? map.lowerTiles[at(f.x, f.y + 1)]!;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) for (const a of layers) if (isVine(a[at(x, y)] ?? -1)) a[at(x, y)] = a === map.lowerTiles ? ground : -1;
    const n = 3 + Math.floor(rnd() * Math.min(4, f.w - 2 - 2)), m = rnd() < 0.3 ? 1 : 2;
    const x0 = f.x + Math.floor(rnd() * (f.w - (n + 2) + 1)), y0 = f.y + (m === 1 && rnd() < 0.5 ? 1 : 0);
    const put = (a: number[], x: number, y: number, t: number) => { a[at(x, y)] = t; };
    // 윗줄도 오른 끝 기둥 열까지 — 원본 키트의 «윗줄 한 칸 짧은 계단 귀»가 모든 밭에서 같은 윤곽으로 읽혔다(r5·r6).
    put(edgeLayer, x0, y0, VINE.tl); for (let c = 1; c <= n; c++) put(edgeLayer, x0 + c, y0, pick(VINE.top)); put(edgeLayer, x0 + n + 1, y0, VINE.tr);
    for (let r = 1; r <= m; r++) {
      put(edgeLayer, x0, y0 + r, VINE.left[(r - 1) % 2]!); put(edgeLayer, x0 + n + 1, y0 + r, VINE.right[(r - 1) % 2]!);
      for (let c = 1; c <= n; c++) put(innerLayer, x0 + c, y0 + r, pick(VINE.inner));
    }
    const yb = y0 + m + 1;
    put(edgeLayer, x0, yb, VINE.bl); for (let c = 1; c <= n; c++) put(edgeLayer, x0 + c, yb, pick(VINE.bottom)); put(edgeLayer, x0 + n + 1, yb, VINE.br);
  }
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
