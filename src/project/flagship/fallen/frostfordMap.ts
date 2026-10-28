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
import { canMove } from "@/project/collision";

type Cell = { x: number; y: number };
type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;

export const FROST_W = 40;
export const FROST_H = 56;
const TS = "beodeul_city";
const SNOW = (id: string) => `bd-pick-snowfield-${id}`;
export const FROST_ICE_GROUP = "beodeul_dungeon_ice";
export const FROST_WATER_GROUP = "beodeul_dungeon_water_C";
/** 밟힌 눈길·광장 — 던전 얼음굴 바닥(회색 다진 눈, 테두리가 부드러운 오토타일). 마을 길 키트(줄 단위 그림)는 옆 테두리가 없어 계단 모양 직선으로 끊겼다(감독 r3). */
const PATH_GROUP = "beodeul_dungeon_ice_ground";

export type FrostHouseRole = "harma" | "inn" | "warehouse" | "lamp" | "fisher" | "smoke" | "east";
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
  /** 금 간 얼음 그림(던전 얼음 「홀로 떨어진 조각」). */
  crackTiles: number[];
  /** 짓다가 겹친 자리(비어 있어야 정상). */
  problems: string[];
  /** B9 에서 미리 금으로 알리는 갈라짐(무너지는 초를 함께). */
  preCracks: { cells: Cell[]; atSecond: number }[];
  /** 사당 앞 → 계단까지 가장 짧은 얼음길(밤에 길을 밝히는 빛을 놓는다). */
  escapePath: Cell[];
  /** 다시 하기 줄(섬 바로 위 얼음 줄). */
  startRow: { x: number; y: number; width: number; height: number };
  /** 불빛 자리 — 광장 모닥불, 성문 양옆 횃불, 사당 양옆 등. */
  bonfire: Cell; gateLights: Cell[]; shrineLights: Cell[];
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

/**
 * 북쪽 절벽 — 고원(눈)·앞면·중간 눈 턱. 구간마다 높이가 다르고 몇 구간은 중간에 눈 턱이 한 줄 끼어 두 단이 된다
 * (감독 r3: 5~6줄짜리 한 면은 단조롭다). p = 앞면 첫 줄, ledge = 눈 턱 줄(-1 이면 없음), f = 앞면 마지막 줄.
 */
const CLIFF: { x0: number; x1: number; p: number; ledge: number; f: number }[] = [
  { x0: 0, x1: 3, p: 4, ledge: -1, f: 8 },
  { x0: 4, x1: 8, p: 2, ledge: 5, f: 9 },
  { x0: 9, x1: 11, p: 4, ledge: -1, f: 9 },
  { x0: 12, x1: 16, p: 3, ledge: 6, f: 9 },
  { x0: 17, x1: 22, p: 5, ledge: -1, f: 7 },
  { x0: 23, x1: 27, p: 3, ledge: 6, f: 8 },
  { x0: 28, x1: 33, p: 5, ledge: -1, f: 8 },
  { x0: 34, x1: 39, p: 2, ledge: 5, f: 8 },
];
const cliffAt = (x: number) => CLIFF.find((s) => x >= s.x0 && x <= s.x1)!;

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
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

  // ── 1. 땅 모양 ────────────────────────────────────────────────────────
  const GATE_X = 18;
  const faceBottom = (x: number): number => cliffAt(x).f;
  // 호수: 둥근 초타원(가운데 19,21) + 각도 물결 + 동쪽 낚시 만. 북쪽은 절벽 밑에서 바로 시작한다.
  const lakeBlob = (x: number, y: number): boolean => {
    const ex = (x - 19) / 16.0, ey = (y - 21.2) / 12.4, a = Math.atan2(ey, ex);
    const lim = 1 + 0.06 * Math.sin(a * 3 + 0.9) + 0.045 * Math.sin(a * 5 + 2.2) + 0.03 * Math.sin(a * 8 + 0.4);
    // 남쪽 기슭은 휘어진 선 — 가운데(큰 부두)가 남쪽으로 불룩, 서쪽은 북쪽으로 물러난다.
    const shoreBottom = 31.2 + 2.0 * Math.sin((x - 12) * 0.26) + 0.7 * Math.sin(x * 0.7 + 1);
    const main = Math.abs(ex) ** 3.1 + Math.abs(ey) ** 3.1 <= lim ** 3.1 && y <= shoreBottom;
    const bx = (x - 30) / 5.6, by = (y - 27.6) / 4.4, b = Math.atan2(by, bx);
    const bay = bx * bx + by * by <= (1 + 0.1 * Math.sin(b * 3 + 0.5)) ** 2;
    const cape = ((x - 5) / 3.8) ** 2 + ((y - 30.5) / 3.4) ** 2 <= 1;   // 남서쪽 눈 곶(비대칭)
    return (main || bay) && !cape;
  };
  const lake = new Set<number>();
  for (let y = 8; y < 38; y += 1) for (let x = 1; x < W - 1; x += 1) {
    if (y > faceBottom(x) && lakeBlob(x, y)) lake.add(idx(x, y));
  }
  for (let x = GATE_X - 1; x <= GATE_X + 4; x += 1) for (let y = 10; y <= 12; y += 1) lake.add(idx(x, y));   // 계단 아래는 반드시 얼음
  const smoothSet = (set: Set<number>, passes = 2) => {
    for (let p = 0; p < passes; p += 1) {
      for (const c of [...set]) {
        const { x, y } = cellOf(c);
        let n = 0;
        for (const [dx, dy] of N4) if (set.has(idx(x + dx, y + dy))) n += 1;
        if (n <= 1) set.delete(c);
      }
      const add: number[] = [];
      for (const c of set) {
        const { x, y } = cellOf(c);
        for (const [dx, dy] of N4) {
          const nx = x + dx, ny = y + dy;
          if (!inMap(nx, ny) || set.has(idx(nx, ny))) continue;
          let n = 0;
          for (const [ex, ey] of N4) if (set.has(idx(nx + ex, ny + ey))) n += 1;
          if (n >= 3) add.push(idx(nx, ny));
        }
      }
      for (const c of add) set.add(c);
    }
  };
  smoothSet(lake, 2);
  for (const c of [...lake]) { const { x, y } = cellOf(c); if (y <= faceBottom(x)) lake.delete(c); }
  // 바위섬(사당): 가운데 (19.4,24.8), 비대칭 타원 — 22..27 줄.
  const island = new Set<number>();
  for (let y = 22; y <= 27; y += 1) for (let x = 11; x <= 27; x += 1) {
    const ex = (x - 19.4) / 5.1, ey = (y - 24.8) / 3.0;
    const a = Math.atan2(ey, ex);
    const lim = 1 + 0.12 * Math.sin(a * 3 + 1.3) + 0.07 * Math.sin(a * 5);
    if (ex * ex + ey * ey <= lim * lim) island.add(idx(x, y));
  }
  smoothSet(island, 1);
  for (const c of island) lake.delete(c);
  // 미리 난 큰 균열(검은 물) 둘 — 굽이치는 한 칸(군데군데 두 칸) 금. 네 방향으로 이어져 있어 대각선으로 빠져나갈 틈이 없다.
  //   C1(17~19줄): x8 → 동쪽 기슭. 서쪽 끝만 지나갈 수 있다.
  //   C2(12~14줄): 서쪽 기슭 → x25. 동쪽 끝만 지나갈 수 있다.
  // r3 까지는 두 줄 폭 띠가 세 칸마다 한 줄씩 어긋나 운하처럼 읽혔다(감독 r3).
  const cracks = new Set<number>();
  const nearIsland = (x: number, y: number) => island.has(idx(x, y + 1)) || island.has(idx(x, y - 1)) || island.has(idx(x + 1, y)) || island.has(idx(x - 1, y));
  const addCrack = (x: number, y: number) => { if (lake.has(idx(x, y)) && !nearIsland(x, y)) cracks.add(idx(x, y)); };
  /**
   * 갈라진 금 — 한 칸 폭 금이 두~다섯 칸마다 한 줄씩 오르내리며 띠 안을 떠돈다(군데군데 두 칸으로 벌어짐).
   * 얼음 쪽이 깨진 가장자리를 그리고 물은 칸을 꽉 채운다 — 물 오토타일 테두리(갈색 돌 둑)로 그리면 운하처럼 읽혔다(감독 r3).
   */
  const crackLine = (x0: number, x1: number, lo: number, hi: number, seed: number) => {
    const step = x1 > x0 ? 1 : -1;
    let y = lo + 1, run = 0, want = 2;
    for (let x = x0; x !== x1 + step; x += step) {
      if (run >= want) {
        const r = hash01(x, seed, 73);
        const ny = y === lo ? lo + 1 + (r < 0.4 ? 1 : 0) : y === hi ? hi - 1 - (r < 0.4 ? 1 : 0) : y + (r < 0.5 ? -1 : 1);
        for (let k = Math.min(y, ny); k <= Math.max(y, ny); k += 1) addCrack(x, k);
        y = ny; run = 0; want = 1 + Math.floor(hash01(x, seed, 74) * 4);
      }
      addCrack(x, y);
      run += 1;
      if (Math.abs(x - x0) > 2 && hash01(x, seed, 75) < 0.14) addCrack(x, y < hi ? y + 1 : y - 1);
    }
  };
  crackLine(8, W - 1, 17, 19, 3);
  crackLine(25, 0, 12, 14, 7);
  const ice = new Set([...lake].filter((c) => !cracks.has(c)));

  // ── 2. 길·광장·부두 ───────────────────────────────────────────────────
  const path = new Set<number>(), deck = new Set<number>();
  const disc = (cx: number, cy: number, r: number, into: Set<number>) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
      if (inMap(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) into.add(idx(x, y));
    }
  };
  /** Catmull-Rom 곡선 길 — 폭이 굽이마다 r0~r1 로 숨 쉰다. */
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
        disc(x, y, r0 + (r1 - r0) * (0.5 + 0.5 * Math.sin(s * 0.45 + seed)), path);
      }
    }
  };
  /** 그 세로줄 호수 맨 아래 줄(남쪽 기슭). */
  const lakeBottom = (x: number) => { for (let y = 37; y > 20; y -= 1) if (lake.has(idx(x, y))) return y; return -1; };
  // 광장 — 다진 눈 마당(작고 테두리가 고르지 않다). 모닥불 둘레.
  const PLAZA = { x: 19.5, y: 45.6 };
  for (let y = 41; y <= 50; y += 1) for (let x = 13; x <= 27; x += 1) {
    const ex = (x - PLAZA.x) / 3.4, ey = (y - PLAZA.y) / 2.2, a = Math.atan2(ey, ex);
    if (ex * ex + ey * ey <= (1 + 0.16 * Math.sin(a * 3 + 0.7) + 0.08 * Math.sin(a * 5 + 2)) ** 2) path.add(idx(x, y));
  }
  // 기슭 길 — 남쪽 기슭을 따라 휜다(물가에서 네 칸: 그 사이에 대답의 등이 선다).
  const shorePts: { x: number; y: number }[] = [];
  for (let x = 8; x <= 34; x += 4) { const b = lakeBottom(x); shorePts.push({ x, y: (b < 0 ? 33 : b) + 5.0 + 0.4 * Math.sin(x * 0.9) }); }
  curve(shorePts, 0.74, 0.92, 5);
  // 큰길: 남쪽 어귀 → 광장 → 기슭 길(큰 부두).
  curve([{ x: 19.4, y: 56 }, { x: 19.0, y: 53 }, { x: 19.9, y: 50.5 }, { x: 19.5, y: 48 }], 0.76, 0.95, 3);
  curve([{ x: 19.4, y: 43.5 }, { x: 18.9, y: 40.5 }, { x: 19.1, y: 37 }], 0.76, 0.95, 4);
  const pathAdd = (pts: { x: number; y: number }[], seed: number) => curve(pts, 0.72, 0.8, seed);

  // ── 3. 바닥 칠하기 ────────────────────────────────────────────────────
  const snow = kitCells(tileset, SNOW("ground-snow")).flat();
  const plat = kitCells(tileset, SNOW("ground-plat")).flat();
  const cliffRows = kitCells(tileset, SNOW("ground-cliff"));
  const cliffRows2 = kitCells(tileset, "bd-pick-mining-valley-ground-cliff");
  const deckRows = kitCells(tileset, SNOW("ground-deck"));
  const groups = tileset.autotileGroups ?? [];
  const iceG = groups.find((g) => g.id === FROST_ICE_GROUP), waterG = groups.find((g) => g.id === FROST_WATER_GROUP), pathG = groups.find((g) => g.id === PATH_GROUP);
  if (!iceG || !waterG || !pathG) throw new Error("[fallen-star frostford] 던전 얼음·물·얼음굴 바닥 오토타일이 칩셋에 없다");
  // 금 간 얼음(경고) = 얼음 오토타일의 「홀로 떨어진 조각」 칸 — 칸마다 테두리가 둘린 얼음 조각 사이로 검은 틈이 보인다.
  const crackTiles = [iceG.variantMap["0"]!];
  const face = new Set<number>(), plateau = new Set<number>(), ledge = new Set<number>();
  for (let x = 0; x < W; x += 1) {
    const s = cliffAt(x);
    for (let y = 0; y <= s.f; y += 1) (y < s.p ? plateau : y === s.ledge ? ledge : face).add(idx(x, y));
  }
  for (let c = 0; c < W * H; c += 1) map.lowerTiles[c] = snow[Math.floor(hash01(c % W, Math.floor(c / W), 11) * snow.length)]!;
  for (const c of [...plateau, ...ledge]) { const { x, y } = cellOf(c); map.lowerTiles[c] = plat[Math.floor(hash01(x, y, 12) * plat.length)]!; }
  for (const c of face) {
    const { x, y } = cellOf(c);
    const s = cliffAt(x);
    const top = s.ledge >= 0 && y > s.ledge ? s.ledge + 1 : s.p, bottom = s.ledge >= 0 && y < s.ledge ? s.ledge - 1 : s.f;
    // 앞면 결 — 세 칸×두 줄 덩이마다 어두운 바위(광산 골짜기 절벽)를 섞어 한 장짜리 벽처럼 안 보이게.
    const dark = hash01(Math.floor((x + (y % 2)) / 3), Math.floor(y / 2), 14) < 0.38;
    const rows = dark ? cliffRows2 : cliffRows;
    const row = y === top ? cliffRows[0]! : y === bottom ? rows[2]! : rows[1]!;
    map.lowerTiles[c] = row[(x + (y === top ? 0 : Math.floor(hash01(x, y, 13) * 3))) % row.length]!;
  }
  // 얼음(부두와 이어진 것으로 본다 — 균열 쪽은 얼음이 깨진 가장자리를 그린다), 물(균열 — 얼음 쪽으로 꽉 찬다).
  const pierCells = (x0: number, y1: number, len: number) => { for (let y = y1; y > y1 - len; y -= 1) for (const x of [x0, x0 + 1]) { deck.add(idx(x, y)); ice.delete(idx(x, y)); } };
  const shoreY = (x: number) => { let y = 42; while (y > 20 && !lake.has(idx(x, y))) y -= 1; return y; };
  // 부두 둘(하르마 나루): 큰 부두 x18..19 는 장대 얼음길로 섬까지 이어지고, 작은 부두 x9..10 곁엔 징발 창고와 썰매.
  const bigPierX = 18, smallPierX = 9;
  const bigEnd = Math.max(shoreY(bigPierX), shoreY(bigPierX + 1));
  pierCells(bigPierX, bigEnd, 4);
  const smallEnd = Math.max(shoreY(smallPierX), shoreY(smallPierX + 1));
  pierCells(smallPierX, smallEnd, 3);
  const pierHead: Cell = { x: bigPierX, y: bigEnd - 3 };
  const iceRoad: Cell[] = [];
  for (let y = pierHead.y - 1; y >= 20 && !island.has(idx(bigPierX, y)) && !island.has(idx(bigPierX + 1, y)); y -= 1) iceRoad.push({ x: bigPierX, y }, { x: bigPierX + 1, y });
  const iceLike = (c: number) => ice.has(c) || deck.has(c);
  for (const c of ice) {
    const { x, y } = cellOf(c);
    let m = 0;
    for (const [dx, dy, bit] of BITS) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && iceLike(idx(nx, ny))) m |= bit; }
    map.lowerTiles[c] = autoCell(iceG, m, x, y);
  }
  for (const c of cracks) {
    const { x, y } = cellOf(c);
    let m = 0;
    for (const [dx, dy, bit] of BITS) { const nx = x + dx, ny = y + dy; if (inMap(nx, ny) && (cracks.has(idx(nx, ny)) || ice.has(idx(nx, ny)) || deck.has(idx(nx, ny)))) m |= bit; }
    map.lowerTiles[c] = autoCell(waterG, m, x, y);
  }
  for (const c of deck) { const { x, y } = cellOf(c); const row = deckRows[y % deckRows.length]!; map.lowerTiles[c] = row[x % row.length]!; }

  // ── 4. 키트 찍기 ─────────────────────────────────────────────────────
  const taken = new Set<number>();          // 키트 그림이 앉은 칸
  const keepClear = new Set<number>();      // 길·문 앞처럼 비워 둘 칸
  for (const c of deck) keepClear.add(c);
  const stamp = (id: string, x0: number, y0: number, opt: { force?: boolean; overlay?: boolean; onPath?: boolean } = {}): boolean => {
    const kit = kitOf(tileset, id);
    const cells: { c: number; lower: number; upper: number }[] = [];
    for (let j = 0; j < kit.rows.length; j += 1) for (let i = 0; i < kit.width; i += 1) {
      const lower = kit.rows[j]!.tiles?.[i] ?? -1, upper = kit.rows[j]!.upperTiles?.[i] ?? -1;
      if (lower < 0 && upper < 0) continue;
      const x = x0 + i, y = y0 + j;
      if (!inMap(x, y)) { if (opt.force) continue; return false; }
      const c = idx(x, y);
      if (!opt.force && (taken.has(c) || keepClear.has(c) || (!opt.onPath && path.has(c)))) return false;
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
  const must = (id: string, x: number, y: number, opt: { force?: boolean; onPath?: boolean } = {}) => {
    if (stamp(id, x, y, opt)) return;
    problems.push(`${id} @(${x},${y}) 겹침 — 억지로 찍음`);
    stamp(id, x, y, { force: true });
  };

  // 성문루(닫힌 문) — 탑으로 가는 문. 0..2 윗면, 3..6 앞면, 7 받침 줄(막힘). 문 앞 = 계단 맨 윗줄.
  must("bd-wall-gatehouse-closed", GATE_X, 0, { force: true });
  const gateDoor = [{ x: GATE_X + 1, y: 7 }, { x: GATE_X + 2, y: 7 }];
  must("bd-mpart-stairs", GATE_X - 1, 8, { force: true });
  const stairsTop = [GATE_X, GATE_X + 1, GATE_X + 2].map((x) => ({ x, y: 8 }));
  const stairsBottom = [GATE_X, GATE_X + 1, GATE_X + 2].map((x) => ({ x, y: 9 }));
  const gateFront = [{ x: GATE_X + 1, y: 8 }, { x: GATE_X + 2, y: 8 }];
  for (const c of [...stairsTop, ...stairsBottom]) keepClear.add(idx(c.x, c.y));
  stamp(SNOW("lamp"), GATE_X + 4, 7, { force: true });
  // 절벽 결 — 눈 턱 위 눈더미, 턱 밑 고드름(군데군데).
  for (const s of CLIFF) {
    for (let x = s.x0; x <= s.x1; x += 1) {
      if (x >= GATE_X - 1 && x <= GATE_X + 4) continue;
      if (s.ledge >= 0 && hash01(x, s.ledge, 15) < 0.22) stamp(SNOW("mound"), x, s.ledge);
      const lowerTop = s.ledge >= 0 ? s.ledge + 1 : s.p;
      if (hash01(x, lowerTop, 16) < 0.3) stamp("bd-pick-dungeon-theme-icicles", x, lowerTop + 1, { overlay: true });
    }
  }
  // 고원 위 소나무(앞면에 안 걸리는 자리만, 일렬 금지).
  for (let x = 0; x < W - 1; x += 1) {
    if (x >= GATE_X - 2 && x <= GATE_X + 5) continue;
    const top = Math.min(cliffAt(x).p, cliffAt(x + 1).p);
    const y = top - 4 - (hash01(x, 2, 22) < 0.5 ? 0 : 1);
    if (y < -1 || hash01(x, 1, 21) < 0.42) continue;
    stamp(SNOW("pine"), x, y, { force: true });
    x += 1;
  }

  // 사당 — 섬 북쪽 가운데. 발렌은 사당 앞, 주인공은 그 앞에서 말을 건다.
  const shrine = { x: 18, y: 23 };
  must("bd-pick-coast-cliff-road-shrine", shrine.x, shrine.y);
  const valen = { x: 19, y: 26 }, shrineFront = { x: 19, y: 27 };
  for (const [x, y] of [[18, 26], [19, 26], [20, 26], [18, 27], [19, 27], [20, 27], [17, 26], [21, 26]] as const) keepClear.add(idx(x, y));
  const shrineLights = [{ x: 16, y: 22 }, { x: 21, y: 22 }];
  stamp("bd-pick-swamp-stilt-lantern", 21, 23);
  stamp("bd-pick-swamp-stilt-lantern", 16, 23);
  stamp(SNOW("pine"), 14, 21);
  stamp(SNOW("rock"), 22, 25);
  stamp(SNOW("mound"), 23, 24);
  // 장대 얼음길 — 두 칸 폭 양옆에 장대(1×2)를 두 칸 걸러.
  for (let k = 0; k < iceRoad.length / 2; k += 2) {
    const y = iceRoad[k * 2]!.y;
    stamp("bd-pick-swamp-stilt-pilings", bigPierX - 1, y - 1);
    stamp("bd-pick-swamp-stilt-pilings", bigPierX + 2, y - 1);
  }
  for (const c of iceRoad) keepClear.add(idx(c.x, c.y));
  // 부두 끝 말뚝, 작은 부두 곁 매어 둔 배.
  stamp(SNOW("bollard"), bigPierX - 1, pierHead.y + 1);
  stamp(SNOW("bollard"), bigPierX + 2, pierHead.y + 2);
  stamp(SNOW("bollard"), smallPierX + 2, smallEnd - 1);
  stamp("bd-pick-swamp-stilt-rowboat", smallPierX - 2, smallEnd - 1);
  stamp(SNOW("ice-boat"), 6, 24);

  // 얼음 낚시터 — 동쪽 만에 구멍 셋, 걸상·생선 상자.
  const holes: Cell[] = [];
  for (const [x, y] of [[27, 29], [31, 27], [32, 31]] as const) if (stamp(SNOW("ice-hole"), x, y)) holes.push({ x, y });
  stamp(SNOW("stool"), 29, 28); stamp(SNOW("stool"), 34, 30);
  stamp(SNOW("fishcrates"), 29, 32);

  // 집 — 북방 통나무 한 양식. 기슭 길 아래 두 집, 광장 양옆 창고·여관, 남쪽 두 집, 동쪽 만 훈제막.
  const houses: FrostHouse[] = [];
  const house = (role: FrostHouseRole, kitId: string, x: number, y: number, lane: { x: number; y: number }[]) => {
    const kit = kitOf(tileset, kitId);
    const ent = (kit as unknown as { parts?: { kind?: string; dx: number; dy: number }[] }).parts?.find((p) => p.kind === "entrance");
    if (!ent) throw new Error(`[fallen-star frostford] ${kitId} 문이 없다`);
    let clash = false;
    for (let j = 0; j < kit.rows.length; j += 1) for (let i = 0; i < kit.width; i += 1) if (taken.has(idx(x + i, y + j))) clash = true;
    if (clash) problems.push(`${kitId} @(${x},${y}) 다른 키트와 겹침`);
    const door = { x: x + ent.dx, y: y + ent.dy }, front = { x: door.x, y: door.y + 1 };
    // 문 앞 골목: 문 앞 칸에서 큰 길로(길은 집 그림 밑으로 들어가지 않는다).
    pathAdd([{ x: front.x, y: front.y + 0.2 }, ...lane], houses.length + 20);
    for (let j = 0; j < kit.rows.length; j += 1) for (let i = 0; i < kit.width; i += 1) path.delete(idx(x + i, y + j));
    stamp(kitId, x, y, { force: true });
    keepClear.add(idx(front.x, front.y));
    houses.push({ role, kit: kitId, at: { x, y }, door, front });
  };
  house("harma", SNOW("w3"), 11, 38, [{ x: 14.5, y: 44.5 }, { x: 16.2, y: 45.6 }]);           // 문 (13,42)
  house("east", SNOW("s2"), 24, 37, [{ x: 25.4, y: 43.4 }, { x: 23.6, y: 45 }]);             // 동쪽 기슭 집 — 문 (26,41)
  house("inn", SNOW("shed"), 28, 41, [{ x: 27.3, y: 47.6 }, { x: 24.2, y: 46.6 }]);          // 여관 — 문 (29,46)
  house("warehouse", SNOW("bath"), 3, 37, [{ x: 4.6, y: 45 }, { x: 8, y: 45.6 }, { x: 12, y: 45.8 }, { x: 15.2, y: 45.8 }]);   // 징발 창고 — 문 (4,42)
  house("lamp", SNOW("hut"), 9, 47, [{ x: 12.5, y: 52.6 }, { x: 17.6, y: 52.4 }]);          // 등 공방 — 문 (10,51)
  house("fisher", SNOW("s2"), 25, 48, [{ x: 24.5, y: 53.2 }, { x: 20.6, y: 52.8 }]);        // 어부 도윤 — 문 (27,52)
  house("smoke", "bd-pick-swamp-stilt-pierhut", 33, 36, [{ x: 33.4, y: 42.6 }, { x: 32, y: 40.4 }]);   // 훈제막(잠김) — 문 (34,40)
  for (const c of [...path]) if (lake.has(c) || island.has(c) || deck.has(c) || face.has(c) || plateau.has(c)) path.delete(c);
  for (const c of [...path]) if (lake.has(c) || island.has(c) || deck.has(c) || face.has(c) || plateau.has(c) || taken.has(c)) path.delete(c);
  for (const h of houses) path.add(idx(h.front.x, h.front.y));
  for (const c of path) keepClear.add(c);
  // 밟힌 눈길·광장 칠하기(오토타일 — 집·부두 쪽은 이어진 것으로 본다).
  const pathLike = (c: number) => path.has(c) || deck.has(c);
  for (const c of path) {
    const { x, y } = cellOf(c);
    let m = 0;
    for (const [dx, dy, bit] of BITS) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || pathLike(idx(nx, ny))) m |= bit; }
    map.lowerTiles[c] = autoCell(pathG, m, x, y);
  }

  // 광장 — 모닥불·우물·징발 게시판·벤치.
  const bonfire = { x: 19, y: 45 };
  must(SNOW("bonfire"), bonfire.x, bonfire.y - 1, { force: true });
  must(SNOW("well"), 22, 41, { force: true });
  must(SNOW("board"), 15, 42, { force: true });
  stamp(SNOW("bench"), 16, 48, { onPath: true }); stamp(SNOW("bench"), 22, 48, { onPath: true });
  // 대답의 등 — 남쪽 기슭(물가와 길 사이)에 넷: 큰 부두 양옆, 서·동쪽.
  const lamps: Cell[] = [];
  for (const x of [16, 21, 12, 25]) {
    const b = lakeBottom(x);
    if (b < 0) continue;
    for (let y0 = b + 1; y0 <= b + 2; y0 += 1) if (stamp(SNOW("lamp"), x, y0)) { lamps.push({ x, y: y0 + 2 }); break; }
  }
  // 길가 등 — 광장 서쪽 골목·동쪽 골목.
  stamp(SNOW("lamp"), 10, 42); stamp(SNOW("lamp"), 27, 42);
  // 징발 창고(작은 부두 곁) 앞 썰매·장작 상자, 병사는 썰매 곁.
  const sled = { x: 6, y: 43 };
  must(SNOW("sled"), sled.x, sled.y);
  stamp("bd-pick-mining-valley-crates", 8, 40);
  const soldier = { x: 8, y: 43 };
  keepClear.add(idx(soldier.x, soldier.y));
  // 부두 — 큰 부두 곁 그물 걸이·통발, 작은 부두 곁 엎어 둔 배.
  stamp(SNOW("netrack"), 21, 35);
  stamp("bd-pick-fishing-port-lobster-pots", 14, 35);
  stamp("bd-pick-fishing-port-upturned-boat", 6, 33);
  // 집 곁 장작 — 하르마 집 동쪽, 등 공방 서쪽, 어부 집 곁 생선 덕장.
  stamp(SNOW("firewood"), 15, 40);
  stamp(SNOW("pile"), 7, 49);
  stamp(SNOW("firewood"), 13, 49);
  stamp("bd-pick-fishing-port-drying-rack-b", 29, 50);
  stamp("bd-prop-fish_barrel", 24, 51);
  // 훈제막 곁 생선 걸이, 여관 곁 통·상자.
  stamp("bd-pick-swamp-stilt-fish-rack", 30, 35);
  stamp("bd-prop-fish_barrel", 34, 44);
  stamp("bd-pick-mining-valley-crates", 34, 45);
  stamp(SNOW("snowman"), 29, 38);
  // 남쪽 어귀 — 장대 등 한 쌍과 울타리, 이정표.
  stamp("bd-pick-swamp-stilt-lantern", 17, 52);
  stamp("bd-pick-swamp-stilt-lantern", 22, 52);
  stamp(SNOW("fence"), 14, 54); stamp(SNOW("fence"), 23, 54);
  stamp("bd-pick-coast-cliff-road-milestone", 21, 53);

  const people: Record<string, Cell> = {
    well: { x: 21, y: 44 }, child: { x: 31, y: 39 }, net: { x: 23, y: 36 }, wood: { x: 13, y: 50 },
    icefisher: { x: 30, y: 29 }, knightA: gateFront[0]!, knightB: gateFront[1]!,
  };
  for (const p of Object.values(people)) keepClear.add(idx(p.x, p.y));

  // ── 5. 숲 둘레(눈 덮인 침엽 수관) ──────────────────────────────────────
  // 호수 둘레는 숲이 물가에 바로 붙는다(눈 띠가 남으면 얼음을 안 밟고 북쪽 계단으로 돌아가는 샛길이 된다).
  const forest = new Set<number>();
  for (let y = 8; y <= 34; y += 1) for (let x = 0; x < W; x += 1) {
    const c = idx(x, y);
    if (lake.has(c) || island.has(c) || y <= faceBottom(x)) continue;
    let lakeEast = false; for (let i = x + 1; i < W; i += 1) if (lake.has(idx(i, y))) { lakeEast = true; break; }
    let lakeWest = false; for (let i = x - 1; i >= 0; i -= 1) if (lake.has(idx(i, y))) { lakeWest = true; break; }
    if ((x < 19 && lakeEast || x > 19 && lakeWest) && y < 32) forest.add(c);
  }
  // 마을 양옆·남쪽 둘레 — 마을은 이 안에 모인다(빈 눈밭을 바위로 메우지 않는다).
  const edgeW = (y: number, side: number) => 1 + Math.round(1.2 + 1.0 * Math.sin(y * 0.23 + side * 2.1) + 0.6 * Math.sin(y * 0.61 + side));
  for (let y = 30; y < H; y += 1) {
    for (let x = 0; x < edgeW(y, 0); x += 1) forest.add(idx(x, y));
    for (let x = W - edgeW(y, 1); x < W; x += 1) forest.add(idx(x, y));
  }
  for (let y = 52; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const gap = Math.abs(x - 19.5) <= 3.0 + (y - 52) * 0.4;
    if (!gap && (y >= 55 - Math.round(1.2 * Math.sin(x * 0.4)) || x < 7 || x > 32)) forest.add(idx(x, y));
  }
  const clear = (c: number) => keepClear.has(c) || taken.has(c) || lake.has(c) || island.has(c) || face.has(c) || plateau.has(c) || ledge.has(c);
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
  // 숲 가장자리 — 몇 그루만 따로 선 소나무(숲 앞 한 칸 띄워서, 길·집과 떨어진 자리).
  for (const [x, y] of [[4, 47], [35, 47], [31, 35], [11, 34]] as const) stamp(SNOW("pine"), x, y - 3);

  map.mapRole ??= "town";
  const entry = { x: 19, y: H - 1 };

  // ── 6. 탈출 길·미리 갈라짐 ────────────────────────────────────────────
  const walk = (c: number) => (ice.has(c) || island.has(c)) && !(taken.has(c) && map.upperTiles[c]! >= 0 && !keepClear.has(c));
  const bfs = (from: Cell, blocked: Set<number>) => {
    const prev = new Map<number, number>([[idx(from.x, from.y), -1]]); const q: Cell[] = [from];
    for (let h = 0; h < q.length; h += 1) {
      const c = q[h]!;
      for (const [dx, dy] of N4) {
        const nx = c.x + dx, ny = c.y + dy, n = idx(nx, ny);
        if (!inMap(nx, ny) || prev.has(n) || blocked.has(n)) continue;
        if (!walk(n) && !stairsBottom.some((s) => s.x === nx && s.y === ny)) continue;
        prev.set(n, idx(c.x, c.y)); q.push({ x: nx, y: ny });
      }
    }
    let best = -1;
    for (const s of stairsBottom) if (prev.has(idx(s.x, s.y))) { best = idx(s.x, s.y); break; }
    const out: Cell[] = [];
    for (let k = best; k >= 0; k = prev.get(k)!) out.unshift(cellOf(k));
    return out;
  };
  const escapePath = bfs(shrineFront, new Set());
  if (escapePath.length < 40) problems.push(`탈출길이 너무 짧다(${escapePath.length}) — 균열이 길을 막지 못한다`);
  // 앞쪽에 금으로 예고된 갈라짐 셋 — 길 위 두 칸이 주인공이 닿기 조금 전에 꺼진다. 옆으로 비켜 갈 수 있는 자리만(돌아가는 길이 +4 칸 이내).
  const preCracks: { cells: Cell[]; atSecond: number }[] = [];
  for (const frac of [0.2, 0.47, 0.76]) {
    for (let i = Math.floor(escapePath.length * frac); i + 2 < escapePath.length; i += 1) {
      const a = escapePath[i]!, b = escapePath[i + 1]!;
      if (a.y !== b.y || !ice.has(idx(a.x, a.y)) || !ice.has(idx(b.x, b.y))) continue;
      const blocked = new Set([idx(a.x, a.y), idx(b.x, b.y)]);
      const detour = bfs(shrineFront, blocked);
      if (!detour.length || detour.length > escapePath.length + 4) continue;
      preCracks.push({ cells: [a, b], atSecond: Math.max(2, Math.round(i / 6)) });
      break;
    }
  }
  const islandTop = Math.min(...[...island].map((c) => Math.floor(c / W)));
  const isX = [...island].map((c) => c % W);
  const rowCells = [...ice].filter((c) => Math.floor(c / W) === islandTop - 1 && c % W >= Math.min(...isX) - 2 && c % W <= Math.max(...isX) + 2).map((c) => c % W);
  const startRow = { x: Math.min(...rowCells), y: islandTop - 1, width: Math.max(...rowCells) - Math.min(...rowCells) + 1, height: 1 };
  return {
    width: W, height: H, entry, gateDoor, gateFront, stairsTop, stairsBottom, ice, cracks, island, shrine, valen, shrineFront,
    houses, holes, lamps, pierHead, sled, soldier, people, iceRoad, crackTiles, problems,
    preCracks, escapePath, startRow, bonfire, gateLights: [{ x: GATE_X - 1, y: 5 }, { x: GATE_X + 4, y: 5 }], shrineLights,
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
