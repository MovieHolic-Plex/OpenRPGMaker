/**
 * 『폴른 스타』 제2막 B8 서리나루 — 마을 바닥·건물·소품을 직접 짓는 코드(2026-10-28 재시공).
 *
 * 기준 그림은 버들항 설원 마을 「서리목」(tiledata/beodeul-variants/snowfield/render-1x.png): 북쪽 절벽, 소나무 숲 둘레, 얼어붙은 항구, 광장.
 * author_beodeul_town theme snow 결과(빈 눈밭·바둑판 길·네모 웅덩이)는 쓰지 않는다 — 세로형 나루 마을을 목적대로 깐다:
 *   북쪽 절벽과 탑 문(성문루) → 기슭 돌계단 → 언 호수(바위섬 사당, 장대 얼음길, 동쪽 얼음 낚시터, 미리 갈라진 큰 균열 둘)
 *   → 휘어진 남쪽 기슭(하르마 집·부두 둘) → 광장(모닥불·우물·징발 게시판) → 동 여관 · 서 징발 창고 · 등 공방 · 어부 집 → 남쪽 어귀.
 * 그림은 전부 버들항 원본 키트(설원 마을 통나무 집·소품, 어촌 포구·늪 마을 소품, 성문루)와 오토타일(던전 얼음·어두운 물),
 * 눈 덮인 침엽 수관(beodeul_nature forestCanopy.snow). 새 그림 없음.
 */
import type { AutotileGroup, GameMap, Project, TilesetDef } from "@/project/types";
import { autotileVariantForMask } from "@/project/defaults/autotileEngine";
import { planBeodeulCanopy, shapeBeodeulCanopyMask, writeBeodeulCanopy } from "@/editor/tools/beodeulForest";
import { layerTileAt } from "@/project/mapLayers";
import { canMove } from "@/project/collision";

type Cell = { x: number; y: number };
type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;

export const FROST_W = 44;
export const FROST_H = 64;
const TS = "beodeul_city";
const SNOW = (id: string) => `bd-pick-snowfield-${id}`;
export const FROST_ICE_GROUP = "beodeul_dungeon_ice";
export const FROST_WATER_GROUP = "beodeul_dungeon_water_C";

export type FrostHouseRole = "harma" | "inn" | "warehouse" | "lamp" | "fisher" | "smoke" | "east" | "west";
export interface FrostHouse { role: FrostHouseRole; kit: string; at: Cell; door: Cell; front: Cell }
export interface FrostLayout {
  width: number; height: number;
  /** 남쪽 어귀(설원 길에서 들어오는 칸, 맵 아래 끝). */
  entry: Cell;
  /** 성문루 닫힌 문 두 칸과 그 앞 칸. */
  gateDoor: Cell[]; gateFront: Cell[];
  /** 기슭 돌계단의 걷는 칸(위·아래 줄). 아래 줄에 닿으면 얼음에서 벗어난 것. */
  stairsTop: Cell[]; stairsBottom: Cell[];
  /** 호수 얼음(걷는 칸)·미리 갈라진 균열(물)·바위섬. 칸 번호 = y*W+x. */
  ice: Set<number>; cracks: Set<number>; island: Set<number>;
  /** 사당 키트 왼쪽 위·사당 앞(발렌이 서는 칸)·그 앞 칸(주인공이 말을 거는 칸). */
  shrine: Cell; valen: Cell; shrineFront: Cell;
  houses: FrostHouse[];
  /** 얼음 구멍(키트 왼쪽 칸)·대답의 등(등불 키트 맨 아래 칸)·부두 끝(하르마)·썰매·징발 병사 자리. */
  holes: Cell[]; lamps: Cell[]; pierHead: Cell; sled: Cell; soldier: Cell;
  /** 사람 자리(1막 광장 칩) — 이름 → 칸. */
  people: Record<string, Cell>;
  /** 장대 얼음길 칸(부두 끝 → 섬). */
  iceRoad: Cell[];
  /** 금 간 얼음 그림(설원 키트 「얼음」 칸 — 굵은 금). */
  crackTiles: number[];
  /** 짓다가 겹친 자리(비어 있어야 정상). */
  problems: string[];
  /** B9 에서 미리 금으로 알리는 갈라짐(무너지는 초를 함께). */
  preCracks: { cells: Cell[]; atSecond: number }[];
}

const hash01 = (x: number, y: number, s: number): number => {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ s * 83492791, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

function kitOf(tileset: TilesetDef, id: string) {
  const kit = (tileset.structureKits ?? []).find((k) => k.id === id);
  if (!kit) throw new Error(`[fallen-star frostford] 버들항 키트가 없다: ${id}`);
  return kit;
}
function kitCells(tileset: TilesetDef, id: string): number[][] {
  return kitOf(tileset, id).rows.map((r) => (r.tiles ?? []).filter((t) => t >= 0));
}

/** 오토타일 칸 — 8이웃 비트 N1 E2 S4 W8 NE16 SE32 SW64 NW128, 속 칸은 속 변형을 섞는다. */
function autoCell(g: AutotileGroup, m: number, x: number, y: number): number {
  const inner = g.interiorVariants?.[0];
  if (m === 255 && inner?.length) return inner[Math.floor(hash01(x, y, 5) * inner.length)]!;
  return autotileVariantForMask(g, m, x, y) ?? g.variantMap[String(m)] ?? g.variantMap["255"]!;
}
const BITS: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];

export function paintFrostford(project: Project, exec: Exec, mapId: string, name: string): FrostLayout {
  const W = FROST_W, H = FROST_H;
  exec(project, "create_map", { id: mapId, name, width: W, height: H, tilesetId: TS });
  const map = project.maps[mapId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const cellOf = (c: number): Cell => ({ x: c % W, y: Math.floor(c / W) });
  map.lowerTiles = new Array<number>(W * H).fill(-1);
  map.upperTiles = new Array<number>(W * H).fill(-1);
  delete map.lowerTileStacks; delete map.upperTileStacks;
  map.lowerOverlayTiles = new Array<number>(W * H).fill(-1);
  map.upperOverlayTiles = new Array<number>(W * H).fill(-1);

  // ── 1. 땅 모양 ────────────────────────────────────────────────────────
  // 절벽: 윗단(고원 눈) 0..2, 앞면 3..바닥. 성문루 둘레(x19..24)만 7 에서 끝나 계단참이 생기고, 나머지는 8~9 까지 내려와
  // 호수 북쪽 기슭에 바로 닿는다(눈 띠가 남으면 얼음을 안 밟고 계단까지 돌아가는 샛길이 된다).
  const GATE_X = 20;
  /** 고원 눈 줄 수(0..PLAT_ROWS-1) — 그 아래가 절벽 앞면. 성문루 둘레는 성문루 그림이 앞면이다. */
  const PLAT_ROWS = 5;
  const faceBottom = (x: number): number => {
    if (x >= 19 && x <= 24) return 7;
    if (x <= 6) return 8;
    if (x <= 12) return 9;
    if (x <= 16) return 8;
    if (x <= 18) return 9;
    if (x <= 33) return 9 - (x >= 28 && x <= 30 ? 1 : 0);
    return 8;
  };
  // 호수: 둥근 초타원(가운데 21,21) + 각도 물결 + 동쪽 낚시 만. 북쪽은 절벽 밑에서 바로 시작한다.
  const lakeBlob = (x: number, y: number): boolean => {
    const ex = (x - 21) / 17.6, ey = (y - 21.2) / 12.6, a = Math.atan2(ey, ex);
    const lim = 1 + 0.06 * Math.sin(a * 3 + 0.9) + 0.045 * Math.sin(a * 5 + 2.2) + 0.03 * Math.sin(a * 8 + 0.4);
    // 남쪽 기슭은 휘어진 선 — 가운데(큰 부두)가 남쪽으로 불룩, 서쪽은 북쪽으로 물러난다. 동쪽은 낚시 만이 따로 내려온다.
    const shoreBottom = 31.4 + 2.3 * Math.sin((x - 14) * 0.26) + 0.8 * Math.sin(x * 0.7 + 1);
    const main = Math.abs(ex) ** 3.1 + Math.abs(ey) ** 3.1 <= lim ** 3.1 && y <= shoreBottom;
    const bx = (x - 32.5) / 6.4, by = (y - 27.6) / 4.6, b = Math.atan2(by, bx);
    const bay = bx * bx + by * by <= (1 + 0.1 * Math.sin(b * 3 + 0.5)) ** 2;
    const cape = ((x - 6.5) / 4.2) ** 2 + ((y - 30.5) / 3.6) ** 2 <= 1;   // 남서쪽 눈 곶(비대칭)
    return (main || bay) && !cape;
  };
  const lake = new Set<number>();
  for (let y = 8; y < 38; y += 1) for (let x = 1; x < W - 1; x += 1) {
    if (y > faceBottom(x) && lakeBlob(x, y)) lake.add(idx(x, y));
  }
  for (let x = 19; x <= 24; x += 1) for (let y = 10; y <= 12; y += 1) lake.add(idx(x, y));   // 계단 아래는 반드시 얼음
  const smoothSet = (set: Set<number>, keep: Set<number>, passes = 2) => {
    for (let p = 0; p < passes; p += 1) {
      for (const c of [...set]) {
        if (keep.has(c)) continue;
        const { x, y } = cellOf(c);
        let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (set.has(idx(x + dx, y + dy))) n += 1;
        if (n <= 1) set.delete(c);
      }
      const add: number[] = [];
      for (const c of set) {
        const { x, y } = cellOf(c);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy;
          if (!inMap(nx, ny) || set.has(idx(nx, ny))) continue;
          let n = 0;
          for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (set.has(idx(nx + ex, ny + ey))) n += 1;
          if (n >= 3) add.push(idx(nx, ny));
        }
      }
      for (const c of add) set.add(c);
    }
  };
  smoothSet(lake, new Set(), 2);
  for (const c of [...lake]) { const { x, y } = cellOf(c); if (y <= faceBottom(x)) lake.delete(c); }
  // 바위섬(사당): 가운데 (21.2,24.8), 비대칭 타원 — 22..27 줄.
  const island = new Set<number>();
  for (let y = 22; y <= 27; y += 1) for (let x = 13; x <= 29; x += 1) {
    const ex = (x - 21.4) / 5.3, ey = (y - 24.8) / 3.0;
    const a = Math.atan2(ey, ex);
    const lim = 1 + 0.12 * Math.sin(a * 3 + 1.3) + 0.07 * Math.sin(a * 5);
    if (ex * ex + ey * ey <= lim * lim) island.add(idx(x, y));
  }
  smoothSet(island, new Set(), 1);
  for (const c of island) lake.delete(c);
  // 미리 난 큰 균열(검은 물) 둘 — 섬에서 북쪽 기슭으로 가려면 서→북→동→북→서로 꺾는다.
  //   C1(18~19줄, 군데군데 17~18): x10 → 동쪽 기슭. 서쪽 끝만 지나갈 수 있다.
  //   C2(12~13줄, 군데군데 13~14): 서쪽 기슭 → x30. 동쪽 끝만 지나갈 수 있다.
  const cracks = new Set<number>();
  const crackRun = (x0: number, x1: number, rowAt: (x: number) => number) => {
    for (let x = x0; x <= x1; x += 1) for (const y of [rowAt(x), rowAt(x) + 1]) if (lake.has(idx(x, y))) cracks.add(idx(x, y));
  };
  // 한 칸씩 어긋나는 지그재그(두 줄 폭, 군데군데 세 줄) — 곧은 띠는 운하처럼 읽힌다.
  const zig = (x: number, seed: number, lo: number, hi: number) => {
    const ph = Math.floor((x + seed) / 3), r = hash01(ph, seed, 61);
    return r < 0.36 ? lo : r < 0.72 ? hi : (ph % 2 ? lo : hi);
  };
  crackRun(10, W - 1, (x) => zig(x, 3, 17, 18));
  crackRun(0, 30, (x) => zig(x, 7, 12, 13));
  // 계단(지나는 칸)·섬 둘레 한 칸은 균열이 아니다.
  for (const c of [...cracks]) { const { x, y } = cellOf(c); if (island.has(idx(x, y + 1)) || island.has(idx(x, y - 1))) cracks.delete(c); }
  const ice = new Set([...lake].filter((c) => !cracks.has(c)));

  // ── 2. 길·광장·부두 ───────────────────────────────────────────────────
  const road = new Set<number>(), plaza = new Set<number>(), deck = new Set<number>();
  const disc = (cx: number, cy: number, r: number, into: Set<number>) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
      if (inMap(x, y) && Math.hypot(x - cx, y - cy) <= r) into.add(idx(x, y));
    }
  };
  /** Catmull-Rom 곡선 길 — 폭이 굽이마다 r0~r1 로 숨 쉰다(설원 길 도구와 같은 결). */
  const curve = (pts: { x: number; y: number }[], r0: number, r1: number, seed: number) => {
    const P = [pts[0]!, ...pts, pts[pts.length - 1]!];
    let s = 0;
    for (let i = 1; i + 2 < P.length; i += 1) {
      const p0 = P[i - 1]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[i + 2]!;
      const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 4));
      for (let k = 0; k <= n; k += 1) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        s += 0.25;
        disc(x, y, r0 + (r1 - r0) * (0.5 + 0.5 * Math.sin(s * 0.45 + seed)), road);
      }
    }
  };
  // 광장 — 둥근 모서리 판(x16..27, y44..51).
  for (let y = 43; y <= 52; y += 1) for (let x = 14; x <= 29; x += 1) {
    const ex = (x - 21.5) / 5.8, ey = (y - 47.5) / 3.7;
    if (Math.abs(ex) ** 2.6 + Math.abs(ey) ** 2.6 <= 1 + 0.06 * Math.sin(x * 1.3 + y)) plaza.add(idx(x, y));
  }
  smoothSet(plaza, new Set(), 2);
  // 큰길: 남쪽 어귀 → 광장 → 기슭 길. 기슭 길은 물가를 따라 동서로 휜다.
  curve([{ x: 21.5, y: 64 }, { x: 21.2, y: 59 }, { x: 22.2, y: 55 }, { x: 21.6, y: 51 }], 1.15, 1.2, 3);
  curve([{ x: 21.6, y: 44 }, { x: 21.0, y: 40.5 }, { x: 20.6, y: 37 }], 1.15, 1.2, 4);
  curve([{ x: 7.5, y: 37.4 }, { x: 12, y: 36.6 }, { x: 17, y: 37.2 }, { x: 22, y: 36.5 }, { x: 27.5, y: 37.0 }, { x: 33, y: 36.0 }, { x: 37, y: 36.6 }], 1.1, 1.15, 5);
  // 집 앞 골목 — 문 앞 칸에서 큰길·광장으로.
  curve([{ x: 16, y: 43.4 }, { x: 17, y: 44.6 }, { x: 18, y: 45.5 }], 0.85, 0.9, 10);                       // 하르마
  curve([{ x: 32, y: 43.4 }, { x: 30, y: 44.4 }, { x: 27, y: 46 }], 0.85, 0.9, 11);                       // 동쪽 집
  curve([{ x: 31.2, y: 50.4 }, { x: 29, y: 49.4 }, { x: 26.5, y: 48.6 }], 0.85, 0.9, 6);                   // 여관
  curve([{ x: 8.2, y: 49.4 }, { x: 11.5, y: 48.8 }, { x: 14.5, y: 47.8 }, { x: 16.5, y: 47.6 }], 0.85, 0.9, 7);   // 징발 창고
  curve([{ x: 11.2, y: 58.4 }, { x: 15, y: 57.6 }, { x: 18.5, y: 56.6 }, { x: 21, y: 56 }], 0.85, 0.9, 8);      // 등 공방
  curve([{ x: 31.2, y: 58.4 }, { x: 27.5, y: 57.8 }, { x: 24.5, y: 56.6 }, { x: 22.5, y: 56 }], 0.85, 0.9, 9);  // 어부 집
  curve([{ x: 35.2, y: 57.4 }, { x: 33.5, y: 58.2 }, { x: 31.5, y: 58.4 }], 0.85, 0.9, 12);                // 훈제막
  curve([{ x: 4.2, y: 55.4 }, { x: 5.5, y: 53.2 }, { x: 7, y: 51 }, { x: 8.4, y: 49.6 }], 0.85, 0.9, 13);  // 서쪽 끝 집
  for (const c of [...road]) if (lake.has(c) || island.has(c) || plaza.has(c)) road.delete(c);
  smoothSet(road, new Set(), 1);
  for (const c of [...road]) if (lake.has(c) || island.has(c) || plaza.has(c)) road.delete(c);
  // 부두 둘(하르마 나루): 큰 부두 x20..21 은 장대 얼음길로 섬까지 이어지고, 작은 부두 x11..12 곁엔 얼어붙은 배.
  const pierCells = (x0: number, y1: number, len: number) => { for (let y = y1; y > y1 - len; y -= 1) for (const x of [x0, x0 + 1]) { deck.add(idx(x, y)); ice.delete(idx(x, y)); } };
  const shoreY = (x: number) => { let y = 42; while (y > 20 && !lake.has(idx(x, y))) y -= 1; return y; };
  const bigPierX = 20, smallPierX = 12;
  const bigEnd = Math.max(shoreY(bigPierX), shoreY(bigPierX + 1));
  pierCells(bigPierX, bigEnd, 4);
  const smallEnd = Math.max(shoreY(smallPierX), shoreY(smallPierX + 1));
  pierCells(smallPierX, smallEnd, 3);
  const pierHead: Cell = { x: bigPierX, y: bigEnd - 3 };
  // 부두 끝 → 섬: 장대 얼음길(그림은 얼음 그대로, 양옆에 장대).
  const iceRoad: Cell[] = [];
  for (let y = pierHead.y - 1; y >= 20 && !island.has(idx(bigPierX, y)) && !island.has(idx(bigPierX + 1, y)); y -= 1) iceRoad.push({ x: bigPierX, y }, { x: bigPierX + 1, y });

  // ── 3. 바닥 칠하기 ────────────────────────────────────────────────────
  const snow = kitCells(tileset, SNOW("ground-snow")).flat();
  const plat = kitCells(tileset, SNOW("ground-plat")).flat();
  const cliffRows = kitCells(tileset, SNOW("ground-cliff"));
  const roadRows = kitCells(tileset, SNOW("ground-road"));
  const plazaRows = kitCells(tileset, SNOW("ground-plaza"));
  const deckRows = kitCells(tileset, SNOW("ground-deck"));
  const groups = tileset.autotileGroups ?? [];
  const iceG = groups.find((g) => g.id === FROST_ICE_GROUP), waterG = groups.find((g) => g.id === FROST_WATER_GROUP);
  if (!iceG || !waterG) throw new Error("[fallen-star frostford] 던전 얼음·물 오토타일이 칩셋에 없다");
  // 금 간 얼음(경고) = 얼음 오토타일의 「홀로 떨어진 조각」 칸 — 칸마다 테두리가 둘린 얼음 조각 사이로 검은 틈이 보인다(떨어져 나가는 얼음장).
  // 설원 키트 「얼음」 칸은 던전 얼음보다 오히려 밝아 경고로 안 읽혔고(r1 원 해상도), 진청록 살얼음(온천 물) 칸은 막힘이라 쓸 수 없다.
  const crackTiles = [iceG.variantMap["0"]!];
  const face = new Set<number>(), plateau = new Set<number>();
  for (let x = 0; x < W; x += 1) {
    const fb = faceBottom(x);
    for (let y = 0; y <= fb; y += 1) (y < PLAT_ROWS ? plateau : face).add(idx(x, y));
  }
  for (let c = 0; c < W * H; c += 1) map.lowerTiles[c] = snow[Math.floor(hash01(c % W, Math.floor(c / W), 11) * snow.length)]!;
  for (const c of plateau) { const { x, y } = cellOf(c); map.lowerTiles[c] = plat[Math.floor(hash01(x, y, 12) * plat.length)]!; }
  for (const c of face) {
    const { x, y } = cellOf(c);
    const row = y === PLAT_ROWS ? cliffRows[0]! : y === faceBottom(x) ? cliffRows[2]! : cliffRows[1]!;
    map.lowerTiles[c] = row[(x + (y === PLAT_ROWS ? 0 : Math.floor(hash01(x, y, 13) * 3))) % row.length]!;
  }
  // 얼음(물·부두와 이어진 것으로 본다 — 균열 쪽 테두리는 물이 그린다), 물(균열).
  const iceLike = (c: number) => ice.has(c) || cracks.has(c) || deck.has(c);
  for (const c of ice) {
    const { x, y } = cellOf(c);
    let m = 0;
    for (const [dx, dy, bit] of BITS) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && iceLike(idx(nx, ny))) m |= bit; }
    map.lowerTiles[c] = autoCell(iceG, m, x, y);
  }
  for (const c of cracks) {
    const { x, y } = cellOf(c);
    let m = 0;
    for (const [dx, dy, bit] of BITS) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && cracks.has(idx(nx, ny))) m |= bit; }
    map.lowerTiles[c] = autoCell(waterG, m, x, y);
  }
  for (const c of road) {
    const { x, y } = cellOf(c);
    const n = road.has(c - W) || plaza.has(c - W), s = road.has(c + W) || plaza.has(c + W) || y === H - 1;
    const row = !n ? roadRows[0]! : !s ? roadRows[2]! : roadRows[1]!;
    map.lowerTiles[c] = row[x % row.length]!;
  }
  for (const c of plaza) { const { x, y } = cellOf(c); const row = plazaRows[y % plazaRows.length]!; map.lowerTiles[c] = row[x % row.length]!; }
  for (const c of deck) { const { x, y } = cellOf(c); const row = deckRows[y % deckRows.length]!; map.lowerTiles[c] = row[x % row.length]!; }

  // ── 4. 키트 찍기 ─────────────────────────────────────────────────────
  const taken = new Set<number>();          // 키트 그림이 앉은 칸
  const keepClear = new Set<number>();      // 길·문 앞처럼 비워 둘 칸
  for (const c of road) keepClear.add(c);
  for (const c of plaza) keepClear.add(c);
  for (const c of deck) keepClear.add(c);
  const stamp = (id: string, x0: number, y0: number, opt: { force?: boolean; overlay?: boolean } = {}): boolean => {
    const kit = kitOf(tileset, id);
    const cells: { c: number; lower: number; upper: number }[] = [];
    for (let j = 0; j < kit.rows.length; j += 1) for (let i = 0; i < kit.width; i += 1) {
      const lower = kit.rows[j]!.tiles?.[i] ?? -1, upper = kit.rows[j]!.upperTiles?.[i] ?? -1;
      if (lower < 0 && upper < 0) continue;
      const x = x0 + i, y = y0 + j;
      if (!inMap(x, y)) { if (opt.force) continue; return false; }
      const c = idx(x, y);
      if (!opt.force && (taken.has(c) || keepClear.has(c))) return false;
      cells.push({ c, lower, upper });
    }
    for (const { c, lower, upper } of cells) {
      if (lower >= 0) map.lowerTiles[c] = lower;
      if (upper >= 0) { if (opt.overlay && map.upperTiles[c]! >= 0) map.upperOverlayTiles![c] = upper; else map.upperTiles[c] = upper; }
      taken.add(c);
    }
    return true;
  };
  const problems: string[] = [];
  const must = (id: string, x: number, y: number, opt: { force?: boolean } = {}) => {
    if (stamp(id, x, y, opt)) return;
    problems.push(`${id} @(${x},${y}) 겹침 — 억지로 찍음`);
    stamp(id, x, y, { force: true });
  };

  // 성문루(닫힌 문) — 탑으로 가는 문. 0..2 윗면, 3..6 앞면, 7 받침 줄(막힘). 문 앞 = 계단 맨 윗줄.
  must("bd-wall-gatehouse-closed", GATE_X, 0, { force: true });
  const gateDoor = [{ x: GATE_X + 1, y: 7 }, { x: GATE_X + 2, y: 7 }];
  // 기슭 돌계단(5×2, 가운데 셋이 걷는 칸): 성문 받침 바로 아래 → 얼음 윗변.
  must("bd-mpart-stairs", GATE_X - 1, 8, { force: true });
  const stairsTop = [GATE_X, GATE_X + 1, GATE_X + 2].map((x) => ({ x, y: 8 }));
  const stairsBottom = [GATE_X, GATE_X + 1, GATE_X + 2].map((x) => ({ x, y: 9 }));
  const gateFront = [{ x: GATE_X + 1, y: 8 }, { x: GATE_X + 2, y: 8 }];
  for (const c of [...stairsTop, ...stairsBottom]) keepClear.add(idx(c.x, c.y));
  // 계단참 동쪽 칸(x24, 8..9)은 등불, 성문 양옆은 절벽 앞면이라 비운다.
  stamp(SNOW("lamp"), 24, 7, { force: true });

  // 사당 — 섬 북쪽 가운데. 발렌은 사당 앞, 주인공은 그 앞에서 말을 건다.
  const shrine = { x: 20, y: 23 };
  must("bd-pick-coast-cliff-road-shrine", shrine.x, shrine.y);
  const valen = { x: 21, y: 26 }, shrineFront = { x: 21, y: 27 };
  for (const [x, y] of [[20, 26], [21, 26], [22, 26], [20, 27], [21, 27], [22, 27], [19, 26], [23, 26]] as const) keepClear.add(idx(x, y));
  stamp("bd-pick-swamp-stilt-lantern", 23, 23);
  stamp("bd-pick-swamp-stilt-lantern", 18, 23);
  stamp(SNOW("pine"), 15, 21);
  stamp(SNOW("rock"), 25, 25);
  stamp(SNOW("rock"), 16, 25);
  stamp(SNOW("mound"), 26, 24);
  stamp(SNOW("mound"), 18, 22);
  stamp(SNOW("pile"), 24, 22);
  // 장대 얼음길 — 두 칸 폭 양옆에 장대(1×2)를 두 칸 걸러.
  for (let k = 0; k < iceRoad.length / 2; k += 2) {
    const y = iceRoad[k * 2]!.y;
    stamp("bd-pick-swamp-stilt-pilings", bigPierX - 1, y - 1);
    stamp("bd-pick-swamp-stilt-pilings", bigPierX + 2, y - 1);
  }
  for (const c of iceRoad) keepClear.add(idx(c.x, c.y));
  // 부두 끝 말뚝·작은 배.
  stamp(SNOW("bollard"), bigPierX - 1, pierHead.y + 1);
  stamp(SNOW("bollard"), bigPierX + 2, pierHead.y + 2);
  stamp(SNOW("bollard"), smallPierX + 2, smallEnd - 2);
  stamp("bd-pick-swamp-stilt-rowboat", smallPierX - 2, smallEnd - 1);
  stamp(SNOW("ice-boat"), 8, 25);
  stamp(SNOW("ice-row"), 14, 30);
  stamp(SNOW("ice-row"), 27, 33);

  // 얼음 낚시터 — 동쪽 만에 구멍 셋, 걸상·생선 상자.
  const holes: Cell[] = [];
  for (const [x, y] of [[30, 29], [34, 27], [35, 31]] as const) if (stamp(SNOW("ice-hole"), x, y)) holes.push({ x, y });
  stamp(SNOW("stool"), 32, 28); stamp(SNOW("stool"), 37, 29);
  stamp(SNOW("fishcrates"), 31, 32);
  stamp("bd-pick-fishing-port-upturned-boat", 37, 33);

  // 집 — 북방 통나무 한 양식(설원 통나무 집·헛간·목욕집, 늪 마을 통나무 훈제막).
  const houses: FrostHouse[] = [];
  const house = (role: FrostHouseRole, kitId: string, x: number, y: number) => {
    const kit = kitOf(tileset, kitId);
    const ent = (kit as unknown as { parts?: { kind?: string; dx: number; dy: number }[] }).parts?.find((p) => p.kind === "entrance");
    if (!ent) throw new Error(`[fallen-star frostford] ${kitId} 문이 없다`);
    // 길은 집 밑으로 들어가도 된다(문 앞 길이 지붕 그림 밑에 닿는다) — 다른 키트·사람 자리와만 겹치면 안 된다.
    const kit2 = kitOf(tileset, kitId);
    let clash = false;
    for (let j = 0; j < kit2.rows.length; j += 1) for (let i = 0; i < kit2.width; i += 1) if (taken.has(idx(x + i, y + j))) clash = true;
    if (clash) problems.push(`${kitId} @(${x},${y}) 다른 키트와 겹침`);
    for (let j = 0; j < kit2.rows.length; j += 1) for (let i = 0; i < kit2.width; i += 1) { const c = idx(x + i, y + j); if (road.has(c)) { road.delete(c); keepClear.delete(c); } }
    stamp(kitId, x, y, { force: true });
    const door = { x: x + ent.dx, y: y + ent.dy }, front = { x: door.x, y: door.y + 1 };
    keepClear.add(idx(front.x, front.y));
    houses.push({ role, kit: kitId, at: { x, y }, door, front });
  };
  house("harma", SNOW("w3"), 14, 38);          // 문 (16,42)
  house("east", SNOW("s2"), 30, 38);           // 동쪽 기슭 집 — 문 (32,42)
  house("inn", SNOW("shed"), 30, 44);          // 여관 — 문 (31,49)
  house("warehouse", SNOW("bath"), 7, 43);     // 징발 창고 — 문 (8,48)
  house("lamp", SNOW("hut"), 10, 53);          // 등 공방 — 문 (11,57)
  house("fisher", SNOW("s2"), 29, 53);         // 어부 도윤 — 문 (31,57)
  house("smoke", "bd-pick-swamp-stilt-pierhut", 34, 52);   // 훈제막(잠김) — 문 (35,56)
  house("west", SNOW("hut"), 3, 50);           // 서쪽 끝 집(잠김) — 문 (4,54)

  // 광장 — 모닥불·우물·징발 게시판·벤치.
  must(SNOW("bonfire"), 21, 47, { force: true });
  must(SNOW("well"), 24, 43, { force: true });
  must(SNOW("board"), 17, 44, { force: true });
  stamp(SNOW("bench"), 17, 50, { force: true }); stamp(SNOW("bench"), 25, 50, { force: true });
  // 대답의 등 — 남쪽 기슭 길가(물가 쪽)에 셋, 큰 부두 양옆과 작은 부두 곁.
  const lamps: Cell[] = [];
  for (const [x, y] of [[18, 33], [23, 33], [14, 34], [27, 34]] as const) if (stamp(SNOW("lamp"), x, y)) lamps.push({ x, y: y + 2 });
  // 징발 창고 앞 썰매·장작, 병사는 썰매 앞.
  const sled = { x: 11, y: 50 };
  must(SNOW("sled"), sled.x, sled.y);
  stamp(SNOW("pile"), 12, 44); stamp(SNOW("firewood"), 5, 49);
  const soldier = { x: 12, y: 51 };
  keepClear.add(idx(soldier.x, soldier.y));
  // 어부 집 곁 그물 걸이·생선 덕장, 하르마 집 곁 그물 말림대·통발, 여관 곁 통·상자.
  stamp("bd-pick-fishing-port-drying-rack-b", 25, 53);
  stamp("bd-pick-swamp-stilt-fish-rack", 38, 53);
  stamp(SNOW("netrack"), 18, 39);
  stamp("bd-pick-fishing-port-lobster-pots", 12, 40);
  stamp("bd-prop-fish_barrel", 36, 47);
  stamp("bd-pick-mining-valley-crates", 36, 44);
  stamp(SNOW("snowman"), 26, 40);
  stamp(SNOW("firewood"), 14, 54);
  stamp(SNOW("fishcrates"), 33, 40);
  stamp(SNOW("stool"), 28, 41);
  // 남쪽 어귀 — 장대 등 한 쌍과 울타리(마을 어귀 표).
  stamp("bd-pick-swamp-stilt-lantern", 19, 59);
  stamp("bd-pick-swamp-stilt-lantern", 24, 59);
  stamp(SNOW("fence"), 15, 60); stamp(SNOW("fence"), 26, 60);
  stamp("bd-pick-coast-cliff-road-milestone", 18, 61);

  // ── 5. 숲 둘레(눈 덮인 침엽 수관) ──────────────────────────────────────
  // 호수 둘레는 숲이 물가에 바로 붙는다(눈 띠가 남으면 얼음을 안 밟고 북쪽 계단으로 돌아가는 샛길이 된다).
  const forest = new Set<number>();
  for (let y = 8; y <= 34; y += 1) for (let x = 0; x < W; x += 1) {
    const c = idx(x, y);
    if (lake.has(c) || island.has(c) || y <= faceBottom(x)) continue;
    if (x < 21 && !road.has(c)) {
      // 호수 서쪽(같은 줄 동쪽에 호수가 있으면 숲)
      let lakeEast = false; for (let i = x + 1; i < W; i += 1) if (lake.has(idx(i, y))) { lakeEast = true; break; }
      if (lakeEast && y < 33) forest.add(c);
    }
    if (x > 21 && !road.has(c)) {
      let lakeWest = false; for (let i = x - 1; i >= 0; i -= 1) if (lake.has(idx(i, y))) { lakeWest = true; break; }
      if (lakeWest && y < 33) forest.add(c);
    }
  }
  const edgeW = (y: number, side: number) => 2 + Math.round(1.6 + 1.4 * Math.sin(y * 0.23 + side * 2.1) + 0.8 * Math.sin(y * 0.61 + side));
  for (let y = 33; y < H; y += 1) {
    for (let x = 0; x < edgeW(y, 0); x += 1) forest.add(idx(x, y));
    for (let x = W - edgeW(y, 1); x < W; x += 1) forest.add(idx(x, y));
  }
  // 남쪽 둘레: 어귀 길 양옆 숲.
  for (let y = 58; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const gap = Math.abs(x - 21.5) <= 3.5 + (y - 58) * 0.3;
    if (!gap && (y >= 61 - Math.round(1.5 * Math.sin(x * 0.4)) || x < 9 || x > 34)) forest.add(idx(x, y));
  }
  // 마을 안 숲 덩이(빈 눈밭을 메운다).
  const grove = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y += 1) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
      if (!inMap(x, y)) continue;
      const ex = (x - cx) / rx, ey = (y - cy) / ry, a = Math.atan2(ey, ex);
      if (ex * ex + ey * ey <= (1 + 0.15 * Math.sin(a * 3 + cx)) ** 2) forest.add(idx(x, y));
    }
  };
  grove(4, 40, 3.4, 3.2);
  grove(39, 41, 3.2, 3.4);
  grove(39, 48, 3.0, 2.6);
  grove(15, 51, 2.0, 1.6);
  grove(27, 58, 2.0, 1.4);
  const clear = (c: number) => keepClear.has(c) || taken.has(c) || lake.has(c) || island.has(c) || face.has(c) || plateau.has(c);
  for (const c of [...forest]) if (clear(c)) forest.delete(c);
  // 집·소품 둘레 한 칸과 길 옆 한 칸은 비운다(수관이 지붕·문을 덮지 않게).
  for (const c of [...forest]) {
    const { x, y } = cellOf(c);
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && (taken.has(idx(nx, ny)) || keepClear.has(idx(nx, ny)))) { near = true; break; } }
    if (near) forest.delete(c);
  }
  shapeBeodeulCanopyMask(W, H, forest, { minComponent: 10, minExtent: 3, minInterior: 0.1, block: 2 });
  for (const c of [...forest]) if (clear(c)) forest.delete(c);
  const canopy = planBeodeulCanopy(W, H, "snow", forest, (s) => !forest.has(s) && !clear(s));
  writeBeodeulCanopy(project, map, tileset, canopy);
  for (const c of forest) taken.add(c);
  for (const c of canopy.shade.keys()) taken.add(c);

  // ── 6. 고원 위 소나무, 빈 눈밭에 소나무·바위·눈더미(일렬 금지) ──────────
  for (let x = 0; x < W - 1; x += 1) {
    if (x >= GATE_X - 2 && x <= GATE_X + 5) continue;
    const r = hash01(x, 1, 21);
    if (r < 0.45) continue;
    const y = Math.floor(hash01(x, 2, 22) * 2);
    stamp(SNOW("pine"), x, y, { force: false });
  }
  const people: Record<string, Cell> = {
    well: { x: 23, y: 48 }, child: { x: 26, y: 42 }, net: { x: 19, y: 41 }, wood: { x: 15, y: 55 },
    icefisher: { x: 33, y: 29 }, knightA: gateFront[0]!, knightB: gateFront[1]!,
  };
  for (const p of Object.values(people)) keepClear.add(idx(p.x, p.y));
  const emptyAt = (c: number) => !taken.has(c) && !keepClear.has(c) && !clear(c) && map.upperTiles[c]! < 0 && layerTileAt(map, 2, c) < 0;
  const order = [...Array(W * H).keys()].filter((c) => { const { y } = cellOf(c); return y > 7; }).sort((a, b) => hash01(a, 3, 31) - hash01(b, 3, 31));
  const nearBusy = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && (keepClear.has(idx(nx, ny)))) return true; }
    return false;
  };
  for (const c of order) {
    const { x, y } = cellOf(c);
    if (!emptyAt(c) || nearBusy(x, y, 1)) continue;
    // 빈 눈밭 비율을 보고 채운다 — 주변 5×5 에 빈칸이 많을 때만.
    let empty = 0;
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (inMap(x + dx, y + dy) && emptyAt(idx(x + dx, y + dy))) empty += 1;
    if (empty < 13) continue;
    const r = hash01(x, y, 41);
    if (r < 0.62) { if (!stamp(SNOW("pine"), x, y - 3) && hash01(x, y, 42) < 0.4) stamp(SNOW("rock"), x, y - 1); }
    else if (r < 0.85) stamp(SNOW("rock"), x, y - 1);
    else stamp(SNOW("mound"), x, y);
  }

  map.mapRole ??= "town";
  const entry = { x: 21, y: H - 1 };
  // 앞쪽에 금으로 예고된 갈라짐 셋 — 주인공이 닿기 조금 전에 꺼져 비켜 가게 한다(그 갈래가 통째로 막히지 않게 두 줄은 남긴다).
  const iceAt = (x: number, y: number) => ice.has(idx(x, y));
  const preCracks: { cells: Cell[]; atSecond: number }[] = [];
  if (iceAt(13, 20) && iceAt(14, 20) && iceAt(13, 21) && iceAt(14, 21)) preCracks.push({ cells: [{ x: 13, y: 20 }, { x: 14, y: 20 }], atSecond: 2 });
  for (let x = 17; x <= 25; x += 1) {
    const rows = [14, 15, 16, 17].filter((y) => iceAt(x, y) && iceAt(x + 1, y));
    if (rows.length === 4) { preCracks.push({ cells: [{ x, y: 14 }, { x: x + 1, y: 14 }, { x, y: 15 }, { x: x + 1, y: 15 }], atSecond: 4 }); break; }
  }
  for (let x = 26; x <= 29; x += 1) {
    if ([x, x + 1].every((c) => iceAt(c, 10) && iceAt(c, 11))) { preCracks.push({ cells: [{ x, y: 10 }, { x: x + 1, y: 10 }], atSecond: 7 }); break; }
  }
  return {
    width: W, height: H, entry, gateDoor, gateFront, stairsTop, stairsBottom, ice, cracks, island, shrine, valen, shrineFront,
    houses, holes, lamps, pierHead, sled, soldier, people, iceRoad, crackTiles, problems,
    preCracks,
  };
}

/** 칸이 실제로 걸어 닿는가(BFS) — 맵 짓기 검사용. */
export function frostReach(project: Project, map: GameMap, from: Cell): Set<number> {
  const W = map.width, H = map.height;
  const seen = new Set<number>([from.y * W + from.x]); const q = [from];
  while (q.length) {
    const c = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (seen.has(n) || !canMove(project, map, c.x, c.y, nx, ny)) continue;
      seen.add(n); q.push({ x: nx, y: ny });
    }
  }
  return seen;
}
