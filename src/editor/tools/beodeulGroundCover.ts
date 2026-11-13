// 버들항 바닥 덧그림 — 숲 바닥(나무 덩이·숲 수관 둘레)과 풀밭 얼룩(열린 바닥의 재질 섞임 · 문 앞 닳은 땅 · 길가·물가 띠).
//
// 왜(2026-11-13 오너 «나무랑 땅 타일도 좀 다양하게 … 특히 숲쪽»): 한 맵의 바닥이 칸 하나(737)였다 — 숲은 «평평한 한 색 위의 같은 도장» 으로 읽혔다.
// 무엇을: 그 게임의 겉모습(tileset.look.stand · meadow — assets/tilesetStands.ts)이 고른 재질을 2층(lowerOverlayTiles) 투명 덧그림으로 깐다.
//   · 1층 바닥 칸·3층 물체·이벤트는 건드리지 않는다. 덧그림 칸은 ★(통행 + 상위)라 통행 판정에서 건너뛴다 — 걷는 칸은 한 칸도 달라지지 않는다.
//   · 2층이 이미 찬 칸(물가 둑·집 그림자·길 가장자리)은 건너뛴다. 숲 바닥만 나무·밑풀 그림자 칸을 «그 그림자를 얹은 바닥 칸» 으로 바꿔 덮는다.
//   · 덩이 가장자리는 꼭짓점 넷의 안팎 15꼴(그림판이 들쭉날쭉하게 깎아 둔 칸)이라 네모 판이 서지 않는다. 덩이는 높이 단을 넘지 않는다.
// 겉모습에 stand·meadow 가 없는 게임(옛 게임 포함)에서는 아무것도 하지 않는다. 난수는 칸 좌표·씨앗 해시뿐이다(시공기의 난수 줄을 쓰지 않는다).
import groundCatalog from "@/assets/beodeulGroundCatalog.json";
import forestComposer from "@/assets/beodeulForestComposer.json";
import { standOverlaySource, tilesetStandTableFor, type GroundOverlay } from "@/assets/tilesetStands";
import { tilesetLookGround } from "@/assets/tilesetLooks";
import { BEODEUL_NATURE, BEODEUL_NATURE_TEXTURE } from "@/project/defaults/beodeulNature";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { kitBaseTile } from "@/project/houseSetTiles";
import { translateTiles } from "@/project/objectStamp";
import type { GameMap, Project, TilesetLook } from "@/project/types";

const GRASS = 737;
/** 숲 도로·이야기 길의 «숲 장면 잔디»(기초 칩셋 칸) — 숲 도로는 맵의 풀을 이 칸으로 바꿔 둔다. 이 값을 못 읽으면 숲 도로에 숲 바닥이 한 칸도 깔리지 않는다(2026-11-13: 다른 표에서 읽어 -1 이었다). */
const WOODLAND_GRASS = (forestComposer as unknown as { ground: { woodlandGrass?: number } }).ground.woodlandGrass ?? -1;
/** 나무 밑 「짙은 풀」 — 속 칸(버들항 원본 칸 몇 가지)과 가장자리 칸(기초 칩셋의 bdg-dark-grass-*). 숲길의 숲 덩이 밑에 깔린다. */
const DARK_GRASS_CORE = new Set<number>((forestComposer as unknown as { ground: { darkGrass: { interior: number[] } } }).ground.darkGrass.interior);
const DARK_GRASS_EDGES = new Set((groundCatalog as unknown as { recipes: { id: string; rows: number[][] }[] }).recipes.filter((r) => r.id.startsWith("bdg-dark-grass-")).flatMap((r) => r.rows.flat()));

export interface BeodeulGroundCoverOptions {
  readonly seed: number;
  /** 닳은 땅 씨앗 칸(문 앞·우물 곁). */
  readonly worn?: Iterable<number>;
  /** 길·광장 칸 — 곁에 길가 띠를 드문드문 둔다. */
  readonly road?: (cell: number) => boolean;
  /** 물 칸 — 곁에 물가 띠를 둔다. */
  readonly water?: (cell: number) => boolean;
  /**
   * 숲 바닥으로 덮을 씨앗 칸을 더한다 — 숲길의 숲 덩이 칸(나무 composer 가 선 자리). 이 값을 준 호출에서는 나무 밑 「짙은 풀」 칸도 숲 바닥을 받는다
   * (짙은 풀이 그 숲의 바닥이다). 주지 않은 호출(마을·도로)에서는 짙은 풀을 건드리지 않는다 — 도로의 짙은 풀은 조우 풀숲이다.
   */
  readonly grove?: Iterable<number>;
  /** 풀밭으로 칠 1층 칸을 더한다 — 숲 던전의 잔잔한 잔디(공용 잔디와 같은 빛의 3×3 무늬). 주지 않으면 공용 잔디와 숲 도로의 숲 잔디만 풀밭이다. */
  readonly ground?: ReadonlySet<number>;
}

export interface BeodeulGroundCoverReport { floorCells: number; patchCells: number; textures: string[] }

const hash = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ seed * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
/** 격자 값 잡음(0~1) — grid 칸마다 값을 두고 부드럽게 잇는다. */
const noise = (x: number, y: number, grid: number, seed: number): number => {
  const fx = x / grid, fy = y / grid, x0 = Math.floor(fx), y0 = Math.floor(fy);
  let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  return hash(x0, y0, seed) * (1 - tx) * (1 - ty) + hash(x0 + 1, y0, seed) * tx * (1 - ty) + hash(x0, y0 + 1, seed) * (1 - tx) * ty + hash(x0 + 1, y0 + 1, seed) * tx * ty;
};

/**
 * 버들항 맵에 그 게임의 숲 바닥·풀밭 얼룩을 깐다. 겉모습에 stand·meadow 가 없으면 아무것도 하지 않는다.
 * 다 지은 맵에 마지막으로 부른다(나무·그림자·숲 수관이 놓인 뒤).
 */
export function layBeodeulGroundCover(project: Project, map: GameMap, look: TilesetLook | undefined, options: BeodeulGroundCoverOptions): BeodeulGroundCoverReport {
  const report: BeodeulGroundCoverReport = { floorCells: 0, patchCells: 0, textures: [] };
  const ts = project.tilesets[map.tilesetId];
  const table = ts ? tilesetStandTableFor(ts.id) : undefined;
  if (!ts || !table || !look || ts.image.type !== "bundled" || ts.image.id !== table.image) return report;
  const stand = table.stands[look.stand ?? ""], meadow = table.meadows[look.meadow ?? ""];
  if (!stand && !meadow) return report;
  const W = map.width, H = map.height, n = W * H, seed = options.seed | 0;
  const grafts = new Map((ts.tileGrafts ?? []).map((g) => [g.targetTile, g] as const));
  const natureOf = (tile: number): number => { const g = tile >= 0 ? grafts.get(tile) : undefined; return g && g.sourceChipset === BEODEUL_NATURE_TEXTURE ? g.sourceTile : -1; };
  const woodland = (tile: number): boolean => { const g = grafts.get(tile); return !!g && g.sourceChipset === "tex_beodeul_ground" && g.sourceTile === WOODLAND_GRASS; };
  const groundMemo = new Map<number, boolean>();
  const darkToo = options.grove !== undefined;
  const darkGrass = (tile: number): boolean => { if (DARK_GRASS_CORE.has(tile)) return true; const g = grafts.get(tile); return !!g && g.sourceChipset === "tex_beodeul_ground" && DARK_GRASS_EDGES.has(g.sourceTile); };
  const isGround = (tile: number): boolean => { let v = groundMemo.get(tile); if (v === undefined) { v = tile === GRASS || woodland(tile) || (darkToo && darkGrass(tile)) || !!options.ground?.has(tile); groundMemo.set(tile, v); } return v; };
  const canopyTiles = new Set<number>(), shadeTiles = new Set<number>(BEODEUL_NATURE.forestShade.leaf);
  for (const row of BEODEUL_NATURE.forestCanopy.leaf) for (const t of row) if (t >= 0) canopyTiles.add(t);
  const meta = (ts.tileMeta ?? []) as unknown as ({ tags?: string[] } | undefined)[];
  const tagMemo = new Map<number, number>(); // 0 없음 · 1 나무 · 2 건물·벽 같은 큰 물체 · 3 작은 물체
  const kindOf = (tile: number): number => {
    if (tile < 0) return 0;
    let v = tagMemo.get(tile);
    if (v === undefined) { const tags = meta[tile]?.tags ?? []; v = tags.includes("tree") ? 1 : tags.some((t) => t === "building" || t === "wall" || t === "town_wall" || t === "bridge" || t === "cliff") ? 2 : 3; tagMemo.set(tile, v); }
    return v;
  };
  // 큰 나무(킷 한 변이 세 칸 넘는 나무)의 칸 — 숲 바닥은 큰 나무와 숲 수관 둘레에만 깐다(두 칸 덤불 하나하나 밑에 깔면 풀밭이 얼룩덜룩해진다)
  const bigTree = new Set<number>();
  for (const kit of ts.structureKits ?? []) {
    if (kit.width < 3 && kit.height < 3) continue;
    const tiles = kit.rows.flatMap((row) => [...row.tiles, ...(row.upperTiles ?? [])]).filter((t) => t >= 0);
    if (tiles.length && tiles.every((t) => kindOf(t) === 1)) for (const t of tiles) bigTree.add(t);
  }
  const baseTile = kitBaseTile(ts);   // 숲 구성의 «다른 개체» 나무 칸은 원본 나무 킷의 칸으로 읽는다
  const levels = map.relief?.levels;
  const lv = (c: number): number => levels?.[c] ?? 0;
  const ramps = map.relief?.ramps;
  const eventAt = new Set(map.events.map((e) => e.y * W + e.x));
  // 칸 분류
  const L2 = new Int32Array(n), nat2 = new Int32Array(n);
  const base = new Uint8Array(n);    // 덧그림을 깔 수 있는 바닥 칸(풀 · 큰 물체 아님 · 경사로 아님)
  const forest = new Uint8Array(n);  // 1 숲 수관·숲 그늘 칸(2·3층)
  const tree = new Uint8Array(n);
  for (let c = 0; c < n; c += 1) {
    L2[c] = layerTileAt(map, 2, c); nat2[c] = natureOf(L2[c]!);
    const up = layerTileAt(map, 3, c), k3 = kindOf(up);
    const upNat = natureOf(up);
    if ((nat2[c]! >= 0 && (canopyTiles.has(nat2[c]!) || shadeTiles.has(nat2[c]!))) || (upNat >= 0 && canopyTiles.has(upNat))) forest[c] = 1;
    if (k3 === 1 && bigTree.has(baseTile(up))) tree[c] = 1;
    base[c] = isGround(layerTileAt(map, 1, c)) && k3 !== 2 && !(ramps?.[c]) && kindOf(layerTileAt(map, 4, c)) !== 2 ? 1 : 0;
  }
  const used = new Map<number, number>(); // 그림판 칸 → (나중에) 맵 타일셋 칸
  const writes: [number, number][] = []; // [칸, 그림판 칸]
  const lifts: number[] = [];            // 2층의 수관 끝 칸을 3층으로 올릴 칸
  const inMap = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  /** 덩이 R 의 칸마다 꼭짓점 비트(북서1·북동2·남서4·남동8). 꼭짓점은 둘레 네 칸이 모두 R 이고 같은 단일 때만 안. 맵 밖은 가장 가까운 안쪽 칸을 따른다. */
  const cornerMask = (R: Uint8Array, c: number): number => {
    const x = c % W, y = (c - x) / W;
    const corner = (cx: number, cy: number): boolean => {
      let level = -1;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
        const px = Math.min(W - 1, Math.max(0, cx + dx)), py = Math.min(H - 1, Math.max(0, cy + dy)), p = py * W + px;
        if (!R[p]) return false;
        if (level < 0) level = lv(p); else if (lv(p) !== level) return false;
      }
      return true;
    };
    return (corner(x, y) ? 1 : 0) | (corner(x + 1, y) ? 2 : 0) | (corner(x, y + 1) ? 4 : 0) | (corner(x + 1, y + 1) ? 8 : 0);
  };
  const put = (overlay: GroundOverlay, R: Uint8Array, c: number, shadow?: ReadonlyMap<number, number>): boolean => {
    const mask = cornerMask(R, c);
    if (!mask) return false;
    let lift = false;
    if (L2[c]! >= 0) {
      const composite = mask === 15 ? shadow?.get(nat2[c]!) : undefined;
      if (composite !== undefined) { writes.push([c, composite]); used.set(composite, -1); return true; }
      // 숲 수관의 남쪽 끝 줄 칸(2층 — 줄기·뿌리 그림, 비치는 곳으로 바닥이 보인다)은 얹어 구운 그림이 없다. 3층이 비어 있으면 그 수관 칸을 3층으로 올리고
      // 그 밑(2층)에 숲 바닥을 깐다 — 안 그러면 숲 바닥 한가운데 줄기 밑이 풀빛 네모로 남는다. 수관 칸은 어느 층에 있어도 막힌 칸이다.
      if (!shadow || !forest[c] || !canopyTiles.has(nat2[c]!) || layerTileAt(map, 3, c) >= 0) return false;
      lift = true;
    }
    const cell = (hash(c % W, Math.floor(c / W), seed + 31) < 0.5 ? overlay.cells : overlay.alt)[mask]!;
    if (cell <= 0) return false;
    if (lift) lifts.push(c);
    writes.push([c, cell]); used.set(cell, -1);
    return true;
  };

  // ── 숲 바닥 ──
  const floorR = new Uint8Array(n);
  const floor = stand ? table.overlays[stand.floor] : undefined;
  if (floor) {
    const shadow = new Map<number, number>();
    for (let i = 0; i + 1 < (floor.shadow ?? []).length; i += 2) shadow.set(floor.shadow![i]!, floor.shadow![i + 1]!);
    // 숲 그늘 칸(숲 남쪽 아래 줄)도 «둘레가 모두 숲 바닥» 일 때만 숲 바닥에 얹은 그림으로 바꾼다 — 늘 얹어 구웠더니 숲 바닥이 없는 자리에 네모 판이 남았다
    for (let i = 0; i + 1 < (stand!.shade ?? []).length; i += 2) shadow.set(stand!.shade![i]!, stand!.shade![i + 1]!);
    // 맵 끝 줄의 풀밭 칸에는 번져 깔지 않는다(숲 칸·시공기가 숲 덩이로 준 칸은 깐다) — 맵 끝은 꼭짓점이 안쪽 칸을 따라가 숲 바닥이 맵 끝을 따라
    // 곧은 띠로 섰다(숲 도로 표본 맨 윗줄)
    const groveSet = new Set(options.grove ?? []);
    const border = (c: number): boolean => { const x = c % W, y = (c - x) / W; return x === 0 || y === 0 || x === W - 1 || y === H - 1; };
    // 맵 맨 윗줄의 숲 수관 칸에도 깔지 않는다 — 수관의 북쪽 끝 칸은 위 절반이 비쳐, 숲이 맵 위 끝까지 닿은 맵에서 숲 바닥이 맨 윗줄을 따라 곧은 띠로 보였다
    const ok = (c: number): boolean => base[c] === 1 && !eventAt.has(c) && !(border(c) && !forest[c] && !groveSet.has(c)) && !(c < W && forest[c] === 1) && (L2[c]! < 0 || forest[c] === 1 || shadow.has(nat2[c]!));
    // 씨앗: 숲 수관·그늘 칸, 나무 덩이(7×7 창에 큰 나무 칸이 열여섯 넘게 — 큰 나무 두 그루가 붙어 선 곳), 시공기가 더한 칸.
    // 홀로 선 나무 밑에는 깔지 않는다 — 나무마다 흙빛 판이 붙으면 풀밭이 얼룩덜룩해진다(나무는 제 그림자가 있다).
    const seedCell = new Uint8Array(n);
    for (let c = 0; c < n; c += 1) {
      if (forest[c]) { seedCell[c] = 1; continue; }
      if (!tree[c]) continue;
      const x = c % W, y = (c - x) / W; let k = 0;
      for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) if (inMap(x + dx, y + dy) && tree[(y + dy) * W + x + dx]) k += 1;
      if (k >= 16) seedCell[c] = 1;
    }
    for (const c of groveSet) if (c >= 0 && c < n) seedCell[c] = 1;
    for (let c = 0; c < n; c += 1) {
      if (!seedCell[c]) continue;
      const x = c % W, y = (c - x) / W;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
        if (!inMap(x + dx, y + dy)) continue;
        const p = (y + dy) * W + x + dx;
        if (floorR[p] || !ok(p) || lv(p) !== lv(c)) continue;
        // 한 칸 띠는 늘, 두 칸째는 잡음이 높은 곳만 — 덩이 테두리가 물결친다
        if (Math.max(Math.abs(dx), Math.abs(dy)) === 2 && noise(x + dx, y + dy, 3, seed + 7) < 0.45) continue;
        floorR[p] = 1;
      }
      // 큰 물결: 잡음이 높은 곳은 세 칸째까지 번진다(숲 가장자리가 한 폭 띠로 읽히지 않게)
      if (noise(x, y, 7, seed + 17) > 0.62) for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 3 || !inMap(x + dx, y + dy)) continue;
        const p = (y + dy) * W + x + dx;
        if (!floorR[p] && ok(p) && lv(p) === lv(c) && noise(x + dx, y + dy, 2, seed + 23) > 0.5) floorR[p] = 1;
      }
    }
    // 그림자 칸은 통째로 덮여야 한다 — 그 둘레 칸도 덩이에 넣는다
    for (let c = 0; c < n; c += 1) {
      if (!floorR[c] || L2[c]! < 0 || forest[c]) continue;
      const x = c % W, y = (c - x) / W;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const p = (y + dy) * W + x + dx; if (inMap(x + dx, y + dy) && ok(p) && lv(p) === lv(c)) floorR[p] = 1; }
    }
    // 메우기: 네 이웃 가운데 셋 넘게 덩이인 빈 칸
    for (let pass = 0; pass < 2; pass += 1) for (let c = 0; c < n; c += 1) {
      if (floorR[c] || !ok(c)) continue;
      const x = c % W, y = (c - x) / W; let k = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (inMap(x + dx, y + dy) && floorR[(y + dy) * W + x + dx]) k += 1;
      if (k >= 3) floorR[c] = 1;
    }
    // 모서리 깎기: 덩이의 볼록한 모서리 칸(여덟 이웃 가운데 덩이 칸이 넷 이하)은 두 번에 걸쳐 대부분 비운다 — 나무 덩이가 네모나게 심긴 자리에서
    // 숲 바닥이 네모 판으로 읽혔다(가장자리만 들쭉날쭉하고 윤곽은 사각형). 숲 수관·그늘 칸과 그림자를 덮어야 하는 칸은 그대로 둔다.
    for (let pass = 0; pass < 2; pass += 1) {
      const drop: number[] = [];
      for (let c = 0; c < n; c += 1) {
        if (floorR[c] !== 1 || forest[c] || L2[c]! >= 0) continue;
        const x = c % W, y = (c - x) / W; let k = 0;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((dx || dy) && inMap(x + dx, y + dy) && floorR[(y + dy) * W + x + dx]) k += 1;
        if (k <= 4 && hash(x, y, seed + 733 + pass) < 0.8) drop.push(c);
      }
      for (const c of drop) floorR[c] = 0;
    }
    // 곧은 선 풀기: 길·절벽·물·건물처럼 덧그림을 못 까는 칸(또는 다른 단)에 바로 붙은 가장자리 칸은 자리 해시로 반쯤 비운다 —
    // 숲 바닥이 길·절벽을 따라 자로 그은 선으로 끝나지 않고 풀이 드문드문 끼어든다. 숲 수관·그늘 칸과 그림자를 덮어야 하는 칸은 그대로 둔다.
    for (let c = 0; c < n; c += 1) {
      if (!floorR[c] || forest[c] || L2[c]! >= 0) continue;
      const x = c % W, y = (c - x) / W; let hard = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (!inMap(x + dx, y + dy)) continue;
        const p = (y + dy) * W + x + dx;
        if (!base[p] || lv(p) !== lv(c)) { hard = true; break; }
      }
      if (hard && hash(x, y, seed + 911) < 0.5) floorR[c] = 2;
    }
    for (let c = 0; c < n; c += 1) if (floorR[c] === 2) floorR[c] = 0;
    // 숲 수관 칸: 속 칸(수관이 3층)은 2층이 비어 있어 덧그림을 깐다. 숲 그늘 칸(2층, 숲 남쪽 끝 바로 아래 줄)은 둘레가 모두 숲 바닥일 때 그림판이 숲 바닥 위에 얹어
    // 구운 그림으로 바꾼다 — 전에는 «숲 칸의 2층 그림» 을 통째로 건너뛰어 그늘 칸이 숲 바닥 한가운데 풀빛 네모로 남았다(숲 던전·마을 숲 가장자리).
    // 수관의 남쪽 끝 줄(2층, 줄기·뿌리 그림)은 얹어 구운 그림이 없다 — 3층이 비어 있으면 3층으로 올리고 밑에 덧그림을 깐다(put).
    for (let c = 0; c < n; c += 1) if (floorR[c] && put(floor, floorR, c, shadow)) report.floorCells += 1;
    report.textures.push(stand!.floor);
  }

  // ── 풀밭 얼룩 · 닳은 땅 · 길가·물가 띠 ──
  if (meadow) {
    const lookGround = tilesetLookGround(ts.id, look);
    const usable = (id: string | undefined): GroundOverlay | undefined => { const o = id ? table.overlays[id] : undefined; return o && o.ground !== lookGround && !(lookGround && o.avoid?.includes(lookGround)) ? o : undefined; };
    const kinds: GroundOverlay[] = []; const names: string[] = [];
    const kindIndex = (id: string | undefined): number => {
      const o = usable(id); if (!o) return -1;
      let i = kinds.indexOf(o); if (i < 0) { i = kinds.length; kinds.push(o); names.push(id!); }
      return i;
    };
    const nearFloor = new Uint8Array(n);
    for (let c = 0; c < n; c += 1) if (floorR[c] || forest[c]) { const x = c % W, y = (c - x) / W; for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (inMap(x + dx, y + dy)) nearFloor[(y + dy) * W + x + dx] = 1; }
    const ok = (c: number): boolean => base[c] === 1 && L2[c]! < 0 && !nearFloor[c];
    const pick = new Int8Array(n).fill(-1);
    // 1) 얼룩: 재질마다 다른 잡음 — 9칸 물결 위에 4칸 잔물결. 덩이는 드물고 크게(여섯 칸 물결·문턱 0.6 일 때는 맵마다 비슷한 크기의 얼룩이 잡음처럼 흩어졌다)
    const patchKinds = meadow.patches.map((id) => kindIndex(id)).filter((i) => i >= 0);
    for (let c = 0; c < n; c += 1) {
      if (!ok(c)) continue;
      const x = c % W, y = (c - x) / W;
      for (let k = 0; k < patchKinds.length; k += 1) {
        const v = noise(x, y, 9, seed + 101 + k * 37) * 0.78 + noise(x, y, 4, seed + 211 + k * 53) * 0.22;
        if (v > (kinds[patchKinds[k]!]!.small ? 0.72 : 0.63)) { pick[c] = patchKinds[k]!; break; }
      }
    }
    // 2) 길가·물가 띠 · 닳은 땅(얼룩을 덮어쓴다)
    const near = (c: number, test: (p: number) => boolean, d: number): boolean => {
      const x = c % W, y = (c - x) / W;
      for (let dy = -d; dy <= d; dy += 1) for (let dx = -d; dx <= d; dx += 1) if (inMap(x + dx, y + dy) && test((y + dy) * W + x + dx)) return true;
      return false;
    };
    const waterKind = kindIndex(table.verge.water), roadKind = kindIndex(table.verge.road), wornKind = kindIndex(table.worn);
    if (options.water && waterKind >= 0) for (let c = 0; c < n; c += 1) if (ok(c) && near(c, options.water, noise(c % W, Math.floor(c / W), 4, seed + 401) > 0.45 ? 2 : 1)) pick[c] = waterKind;
    if (options.road && roadKind >= 0) for (let c = 0; c < n; c += 1) if (ok(c) && noise(c % W, Math.floor(c / W), 5, seed + 503) > 0.56 && near(c, options.road, 2)) pick[c] = roadKind;
    if (wornKind >= 0) for (const s of options.worn ?? []) {
      if (s < 0 || s >= n) continue;
      const x = s % W, y = (s - x) / W;
      for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
        if (!inMap(x + dx, y + dy)) continue;
        const p = (y + dy) * W + x + dx;
        if (ok(p) && (Math.max(Math.abs(dx), Math.abs(dy)) < 2 || noise(x + dx, y + dy, 2, seed + 601) > 0.5)) pick[p] = wornKind;
      }
    }
    // 3) 다른 재질과 맞닿은 칸은 비운다(가장자리 둘이 한 칸에서 겹치지 않게 — 뒤 순서 재질이 물러선다)
    const drop: number[] = [];
    for (let c = 0; c < n; c += 1) {
      const k = pick[c]!; if (k < 0) continue;
      const x = c % W, y = (c - x) / W;
      let clash = false;
      for (let dy = -1; dy <= 1 && !clash; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { if (!inMap(x + dx, y + dy)) continue; const q = pick[(y + dy) * W + x + dx]!; if (q >= 0 && q < k) { clash = true; break; } }
      if (clash) drop.push(c);
    }
    for (const c of drop) pick[c] = -1;
    // 4) 쓰기
    for (let k = 0; k < kinds.length; k += 1) {
      const R = new Uint8Array(n); let any = false;
      for (let c = 0; c < n; c += 1) if (pick[c] === k) { R[c] = 1; any = true; }
      if (!any) continue;
      let wrote = 0;
      for (let c = 0; c < n; c += 1) if (R[c] && put(kinds[k]!, R, c)) wrote += 1;
      if (wrote) { report.patchCells += wrote; report.textures.push(names[k]!); }
    }
  }

  if (!writes.length) return report;
  const tr = translateTiles(standOverlaySource(table), ts, used.keys());
  for (const c of lifts) setLayerTileAt(map, 3, c, L2[c]!);
  for (const [c, cell] of writes) { const to = tr.map.get(cell); if (to !== undefined && to >= 0) setLayerTileAt(map, 2, c, to); }
  return report;
}
