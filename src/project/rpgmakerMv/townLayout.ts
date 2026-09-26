// 팩 프리셋 타일셋으로 「자연스러운」 소도시 한 장을 짠다 — build_pack_town 도구의 본체.
//
// 조수가 칸을 하나씩 고르면 건물이 같은 간격의 네모로 떠 있고 맵 위가 빈 보도로 남았다(2026-09-25 Rasak 마을 시험).
// 도시 생성 문헌은 순서가 같다: 길 → 블록 → 필지 → 건물 → 거리 물체(Parish & Müller 2001, SimWorld 2025),
// LLM 은 땅 쓰임만 고르고 배치는 절차가 한다(CityCraft 2024, CityGenAgent 2026). 치수는 미국 소도시 실측을
// 48px ≈ 1.5m 로 옮겼다: 가게 폭 4~6칸(가끔 7~10)·벽 맞댐·0 후퇴, 뒤 골목 3칸+뒷주차, 주택 필지 10~12칸·
// 앞마당 3~5칸·진입로 2칸, 연석-잔디 띠 1칸-보도, 가로수 4~6칸·가로등 6~10칸, 횡단보도는 교차로에만.
// 근거 정리: openwiki/teaching-assistant-tilesets.md 「마을 짜임」.

import type { TilesetDef } from "../types";
import type { MvTownFacade, MvTownRecipe } from "./packPreset";
import { paintMaterial, stampKit, type PackPaintMap } from "./packPaint";

export interface TownLayoutOptions {
  readonly seed?: number;
  /** 세로 골목길 수. 생략하면 폭 70 이상은 2, 아니면 1. */
  readonly crossStreets?: number;
  /** 공원(랜드마크)을 둘지. 기본 true. */
  readonly park?: boolean;
}

export interface TownLot {
  readonly kind: "shop" | "office" | "house" | "park" | "rear-lot";
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly storeys?: number;
  /** 이동 이벤트를 놓을 문 칸(문 맨 아래 칸). */
  readonly door?: { readonly x: number; readonly y: number };
}

export interface TownLayoutResult {
  readonly lots: TownLot[];
  readonly roads: { readonly kind: "main" | "local" | "cross" | "alley"; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  readonly seed: number;
}

type Rng = () => number;
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

/** 한 단위 주택가(북→남): 뒷마당 · 집(지붕 2~3 + 벽 2) · 앞마당 · 보도 1 · 잔디 띠 1 · 골목 차도 5. */
interface HouseBand { readonly backY: number; readonly back: number; readonly houseY: number; readonly frontY: number; readonly front: number; readonly walkY: number; readonly lawnY: number; readonly roadY: number | null }

export function layOutPackTown(tileset: TilesetDef, recipe: MvTownRecipe, map: PackPaintMap, options: TownLayoutOptions = {}): TownLayoutResult {
  const W = map.width;
  const H = map.height;
  if (W < 40 || H < 30) throw new Error(`마을 짜임은 40×30 이상 맵에서만 됩니다(지금 ${W}×${H}).`);
  const seed = Number.isInteger(options.seed) ? (options.seed as number) : Math.floor(Math.random() * 1e9);
  const rng = mulberry32(seed);
  // 녹지(공원·나무·관목·화단)는 따로 뽑는다 — 건물 배치 난수 흐름이 나무 수에 따라 흔들리지 않게(같은 시드 = 같은 건물).
  const grng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  // 꾸밈(간판·카페·신호등·옥상·놀이터)도 따로 뽑는다 — 꾸밈이 늘어도 건물·길 배치는 같다.
  const drng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const decor = recipe.decor;
  const lots: TownLot[] = [];
  /** 문 앞 통로(문 x±1, 문 아래 1~2줄) — 노점·키오스크·ATM·카페 탁자가 서면 안 된다(DEFECTS r4-3). */
  const nearDoor = (x: number, y: number) => lots.some((l) => l.door && Math.abs(l.door.x - x) <= 1 && y > l.door.y && y <= l.door.y + 2);
  const roads: TownLayoutResult["roads"][number][] = [];
  const kit = (id: string) => tileset.structureKits?.find((entry) => entry.id === id);
  const used = new Set<number>(map.upperTiles.flatMap((tile, i) => (tile >= 0 ? [i] : [])));
  const paint = (name: string, x: number, y: number, w: number, h: number) => paintMaterial(tileset, map, name, x, y, w, h);
  /** A3 지붕은 종류 n(0~7)과 n+16 이 한 쌍 — 위칸이 뒷면, 아랫칸이 앞면이라 겹쳐 칠해야 용마루가 있는 박공으로 읽힌다. */
  const gablePair = (name: string): { back: string; front: string } | null => {
    const group = tileset.autotileGroups?.find((entry) => entry.name === name);
    const match = group?.id.match(/^(.*-A3-[^-]+-)(\d+)$/);
    if (!match) return null;
    const kind = Number(match[2]);
    const row = Math.floor(kind / 8);
    if (row !== 0 && row !== 2) return null;
    const other = tileset.autotileGroups?.find((entry) => entry.id === `${match[1]}${row === 0 ? kind + 16 : kind - 16}`);
    if (!other) return null;
    return row === 0 ? { back: name, front: other.name } : { back: other.name, front: name };
  };
  /** 위층이 비어 있고 맵 안이면 찍는다. 겹치면 건너뛴다(자리를 못 잡은 소품은 버린다). */
  const place = (id: string, x: number, baseY: number, opts: { keepDoors?: boolean; force?: boolean } = {}): boolean => {
    const k = kit(id);
    if (!k) return false;
    const y = baseY - k.height + 1;
    if (x < 0 || y < 0 || x + k.width > W || baseY >= H) return false;
    const cells: number[] = [];
    k.rows.forEach((row, dy) => row.upperTiles?.forEach((tile, dx) => { if (tile >= 0) cells.push((y + dy) * W + x + dx); }));
    if (!opts.force && cells.some((cell) => used.has(cell))) return false;
    stampKit(tileset, map, id, x, y, opts.keepDoors ? { keepDoors: true } : {});
    cells.forEach((cell) => used.add(cell));
    return true;
  };
  // 나무 수종 셈 — 맵 전체에서 한 수종이 45% 를 넘지 않게 고른다(DEFECTS r2-3).
  const treeCount = new Map<string, number>();
  let treeTotal = 0;
  const capOk = (id: string) => treeTotal < 6 || ((treeCount.get(id) ?? 0) + 1) / (treeTotal + 1) <= 0.45;
  const pickTree = (pool: readonly string[], fits: (id: string) => boolean = () => true, prefer?: string): string | null => {
    const ok = pool.filter((id) => kit(id) && fits(id));
    if (prefer && ok.includes(prefer) && capOk(prefer)) return prefer;
    const under = ok.filter(capOk);
    return under.length ? pick(grng, under) : ok.length ? pick(grng, ok) : null;
  };
  const plantTree = (id: string, x: number, baseY: number): boolean => {
    if (!place(id, x, baseY)) return false;
    treeCount.set(id, (treeCount.get(id) ?? 0) + 1);
    treeTotal += 1;
    return true;
  };
  const parkLawn = recipe.parkLawn ?? recipe.lawn;
  /** 나무 물체가 쓰는 위층 칸 번호(기둥 검사용). */
  const treeCells = new Set<number>([...new Set([...recipe.objects.yardTrees, ...(recipe.objects.parkTrees ?? []), ...(recipe.objects.streetTrees ?? [])])].flatMap((id) => kit(id)?.rows.flatMap((r) => r.upperTiles ?? []) ?? []).filter((t) => t >= 0));
  /** 낮은 관목 줄(위층 오토타일 1줄) 한 칸 — 칠한 칸은 물체가 못 올라오게 used 에 넣는다. */
  const shrub = (x: number, y: number): boolean => {
    if (!recipe.tallGrass || x < 0 || y < 0 || x >= W || y >= H || used.has(y * W + x)) return false;
    paint(recipe.tallGrass, x, y, 1, 1);
    used.add(y * W + x);
    return true;
  };

  // ── 1. 가로 띠(행) 나누기 — 가게 깊이·큰길 폭(= 큰길 줄)은 시드가 고른다 ──
  // 주택가 한 단위(북→남): 뒤 생울타리 2 · 건물 6(박공 3 + 벽 3) · 앞마당 3 · 보도 1 · 잔디 1 · 로컬 차도 5 = 18줄(작은 맵은 뒤 1·앞 2 = 16줄).
  // 작가 도시(p3·p5)는 화면의 절반이 건물이다 — 마당을 얕게, 남는 줄은 맵 밖으로 이어지는 건물 뒷면(옥상)으로 채운다(DEFECTS r1-1).
  let alley = H >= 48 ? 6 : 5; // 맨 위 3줄 = 골목 건너편 건물(옥상 1 + 뒷벽 2, 철문·설비), 상하차 마당 1줄, 그 아래 골목
  let bMax = H >= 48 ? int(rng, 7, 8) : 7;
  // 큰길 차도 줄 수(작가 예시는 4~5줄, 7줄은 넓은 간선). 난수는 그대로 쓰고 7줄은 큰 맵에만 — 50×40 은 차도가 건물 자리를 먹는다(라운드 4 밀도).
  const mainH = rng() < 0.5 || W < 70 ? 5 : 7;
  const fixedTop = () => alley + bMax + 3 + mainH + 1 + 2; // 골목 + 가게 + 보도3 + 큰길 + 잔디1 + 보도2
  if (H - fixedTop() < 9) { alley = 2; bMax = 6; }
  /** 골목 건너편 뒷벽 띠(0~1줄)를 두나 — 골목이 차만 서 있는 빈 아스팔트가 되지 않게(라운드 4). */
  const backWall = alley >= 5;
  const alleyTop = backWall ? 3 : 1;
  const frontY = alley + bMax; // 가게 앞 보도 첫 줄
  const mainY = frontY + 3;
  const southLawnY = mainY + mainH;
  const southWalkY = southLawnY + 1;
  const bands: HouseBand[] = [];
  let y = southWalkY + 2;
  // 큰 맵: 큰길 남쪽 보도 뒤에 큰길을 보는 둘째 상가 줄(깊이 6, 문이 보도 쪽 = 북쪽을 볼 수 없는 팩이라
  // 건물 뒷면이 큰길에 붙지 않게 보도 1줄 → 골목 1줄 → 상가(남쪽을 보는 파사드) → 보도 2줄로 띠를 만든다).
  let south2: { alleyY: number; top: number; frontY: number } | null = null;
  if (H >= 48 && H - y >= 18 * 2 + 2 - 4) {
    south2 = { alleyY: y, top: y + 1, frontY: y + 7 };
    y = y + 7 + 2;
  }
  const rest = H - y;
  const UNIT = H < 48 ? 16 : 18; // 뒷마당 1·2 + 건물 6 + 앞마당 2·3 + 보도 1 + 잔디 1 + 차도 5
  const units = rest >= UNIT * 2 + 2 ? 2 : rest >= UNIT ? 1 : 0;
  let extra = rest - (units >= 1 ? UNIT : 0) - (units >= 2 ? UNIT + 2 : 0);
  let roofRows = 0; // 마지막 로컬 도로 건너편: 보도 1줄 아래로 맵 밖 건물들의 옥상
  if (units > 0 && extra >= 2) { roofRows = extra - 1; extra = 0; }
  for (let u = 0; u < units; u += 1) {
    if (u > 0) { paint(recipe.lawn, 0, y, W, 1); paint(recipe.sidewalk, 0, y + 1, W, 1); y += 2; }
    const last = u === units - 1;
    const back = (H < 48 ? 1 : 2) + (last && extra >= 2 ? 1 : 0);
    const front = (H < 48 ? 2 : 3) + (last ? Math.min(1, extra) : 0);
    const houseY = y + back;
    const fy = houseY + 6;
    const walkY = fy + front;
    bands.push({ backY: y, back, houseY, frontY: fy, front, walkY, lawnY: walkY + 1, roadY: walkY + 2 });
    y = walkY + 7;
  }
  if (units === 0 && H - y >= 6) {
    // 로컬 도로가 들어갈 자리가 없다 — 앞마당이 맵 끝까지인 주택 띠(골목길은 맵 밖으로 이어진다고 본다).
    const avail = H - y;
    const front = Math.min(3, avail - 6);
    const back = avail - 6 - front;
    bands.push({ backY: y, back, houseY: y + back, frontY: y + back + 6, front, walkY: H, lawnY: H, roadY: null });
  }
  const stripY = roofRows > 0 ? H - roofRows - 1 : -1; // 마지막 로컬 도로 건너편 보도 줄
  // ── 2. 세로 골목길: 하나는 맵을 꿰뚫고(+ 교차로), 둘째는 큰길에서 T 로 갈라진다 — 같은 크기 블록 격자를 피한다 ──
  // 복도마다 모양도 시드가 고른다: 꿰뚫는 길(+), 큰길 남쪽으로만(ㅜ), 큰길 북쪽 가게 줄로만(ㅗ).
  // 50×40 같은 작은 맵은 세로 길 하나 — 복도 하나가 9칸을 먹어 건물 커버가 27~29%로 떨어졌다(라운드 4). 난수는 예전처럼 한 번 쓴다.
  const crossCount = Math.max(0, Math.min(2, options.crossStreets ?? (W >= 70 ? (rng() < 0.75 ? 2 : 1) : W >= 50 && rng() < 0.3 && W >= 60 ? 2 : 1)));
  /** x = 복도 왼쪽 끝(보도·잔디 2 + 차도 5 + 2 = 9칸), 차도는 행 y0 부터 y1 앞까지. */
  const corridors: { x: number; y0: number; y1: number }[] = [];
  type Shape = "through" | "south" | "north";
  const span = (shape: Shape) => (shape === "through" ? { y0: 0, y1: H } : shape === "south" ? { y0: mainY, y1: H } : { y0: 0, y1: southLawnY });
  const x1Lo = Math.round(W * 0.15);
  const x1 = int(rng, x1Lo, Math.max(x1Lo, Math.min(Math.round(W * 0.36), W - 38)));
  if (crossCount === 2 && x1 + 21 <= W - 17) {
    const x2 = int(rng, x1 + 21, W - 17);
    const through = rng() < 0.5 ? 0 : 1;
    const other: Shape = rng() < 0.6 ? "south" : "north";
    corridors.push({ x: x1, ...span(through === 0 ? "through" : other) }, { x: x2, ...span(through === 1 ? "through" : other) });
  } else if (crossCount >= 1) {
    const r = rng();
    corridors.push({ x: int(rng, Math.round(W * 0.2), Math.round(W * 0.7) - 9), ...span(r < 0.5 ? "through" : r < 0.75 ? "south" : "north") });
  }
  const inCorridorAt = (x: number, row: number) => corridors.some((c) => x >= c.x && x < c.x + 9 && row >= c.y0 && row < c.y1);
  const through = (c: { y0: number; y1: number }) => c.y0 === 0 && c.y1 === H;
  const inCorridor = (x: number) => inCorridorAt(x, H - 1);
  const splitSegments = (cuts: readonly { x: number }[]) => {
    const out: { x: number; w: number }[] = [];
    let sx = 0;
    for (const c of [...cuts, { x: W }]) { if (c.x - sx > 0) out.push({ x: sx, w: c.x - sx }); sx = c.x + 9; }
    return out;
  };
  const shopSegments = splitSegments(corridors.filter((c) => c.y0 === 0));
  const segments = splitSegments(corridors.filter((c) => c.y1 === H));

  // ── 3. 바닥: 잔디 → 골목 → 보도·잔디 띠 → 복도 옆 → 세로 차도 → 가로 차도 → 교차로 ──
  paint(recipe.lawn, 0, 0, W, H);
  // 맨 윗줄 = 골목 건너편 건물의 뒷면(5절 끝에서 옥상을 깐다), 그 아래 골목, 건물 뒤는 뒷주차.
  paint(recipe.alley, 0, alleyTop, W, frontY - alleyTop);
  roads.push({ kind: "alley", x: 0, y: alleyTop, w: W, h: alley - alleyTop });
  paint(recipe.sidewalk, 0, frontY, W, 3);
  paint(recipe.sidewalk, 0, southWalkY, W, 2);
  for (const band of bands) if (band.roadY !== null) paint(recipe.sidewalk, 0, band.walkY, W, 1);
  if (stripY >= 0) paint(recipe.sidewalk, 0, stripY, W, 1);
  const roadRows = new Set<number>();
  for (let r = mainY; r < mainY + mainH; r += 1) roadRows.add(r);
  for (const band of bands) if (band.roadY !== null) for (let r = band.roadY; r < band.roadY + 5 && r < H; r += 1) roadRows.add(r);
  for (const { x: c, y0, y1 } of corridors) {
    for (let r = Math.max(frontY, y0); r < y1; r += 1) {
      if (roadRows.has(r)) continue;
      const commercial = r < southLawnY;
      paint(recipe.sidewalk, c, r, commercial ? 2 : 1, 1);
      paint(recipe.sidewalk, c + (commercial ? 7 : 8), r, commercial ? 2 : 1, 1);
      if (!commercial) { paint(recipe.lawn, c + 1, r, 1, 1); paint(recipe.lawn, c + 7, r, 1, 1); }
    }
    paint(recipe.road, c + 2, y0, 5, y1 - y0);
    roads.push({ kind: "cross", x: c + 2, y: y0, w: 5, h: y1 - y0 });
  }
  paint(recipe.road, 0, mainY, W, mainH);
  roads.push({ kind: "main", x: 0, y: mainY, w: W, h: mainH });
  for (const band of bands) if (band.roadY !== null) {
    paint(recipe.road, 0, band.roadY, W, 5);
    roads.push({ kind: "local", x: 0, y: band.roadY, w: W, h: Math.min(5, H - band.roadY) });
  }
  for (const corridor of corridors) {
    const { x: c, y1 } = corridor;
    // 꿰뚫는 길만 큰길과 네거리(가장자리 횡단보도가 저절로 그려지는 재료). T 는 큰길로 들어가는 입구에 횡단보도 한 줄.
    if (through(corridor)) paint(recipe.intersection, c + 2, mainY, 5, mainH);
    else {
      const rows = corridor.y0 === 0 ? [mainY - 2, mainY - 1] : [southLawnY, southWalkY];
      for (let cx = c + 2; cx < c + 7; cx += 1) for (const r of rows) place(recipe.objects.crosswalkVertical, cx, r, { force: true });
    }
    if (y1 === H) for (const band of bands) if (band.roadY !== null) paint(recipe.intersection, c + 2, band.roadY, 5, Math.min(5, H - band.roadY));
  }

  // 큰 맵 둘째 상가 줄 바닥: 뒤 골목 1줄, 앞 보도 2줄(가게 → 보도 → 첫 주택 띠 뒤).
  const south2Segments = south2 ? splitSegments(corridors.filter((c) => c.y0 <= south2!.alleyY && c.y1 >= south2!.frontY + 2)) : [];
  if (south2) {
    for (const seg of south2Segments) {
      paint(recipe.alley, seg.x, south2.alleyY, seg.w, 1);
      paint(recipe.sidewalk, seg.x, south2.frontY, seg.w, 1);
      paint(recipe.lawn, seg.x, south2.frontY + 1, seg.w, 1);
    }
  }
  // ── 4. 가게 줄: 벽 맞댐, 폭·높이·재료가 이웃과 다르게, 모퉁이가 가장 높게, 통로는 한 곳 ──
  /** 옥상 윗면 자리(꾸밈 단계에서 헬기장 먼저, 그다음 설비). */
  const roofAreas: { x: number; y: number; w: number; rows: number; office: boolean; h: number; n: number }[] = [];
  /** 간판 덱 — 한 줄 안에서 다 쓰기 전엔 같은 간판이 나오지 않는다. */
  let signDeck: string[] = [];
  const signDeal = (): string => {
    if (!signDeck.length) signDeck = [...(decor?.signs ?? [])].filter((id) => kit(id)).sort(() => drng() - 0.5);
    return signDeck.pop() ?? "";
  };
  /** 옥상 윗면(x..x+w-1, y..y+rows-1)에 서로 다른 설비 n 가지 — 들어가는 크기만. */
  const roofRole = (cx: number, cy: number) => (cx < 0 || cy < 0 || cx >= W || cy >= H ? "" : tileset.tileMeta?.[map.lowerTiles[cy * W + cx] ?? -1]?.role ?? "");
  // 모든 칸이 옥상 재료이고 옆 테두리에서 1칸 안, 최소 2종(DEFECTS r4-2·6).
  const onRoof = (id: string, x: number, baseY: number) => {
    const k = kit(id);
    if (!k) return false;
    for (let dy = 0; dy < k.height; dy += 1) for (let dx = 0; dx < k.width; dx += 1) if (roofRole(x + dx, baseY - k.height + 1 + dy) !== "roof") return false;
    return roofRole(x - 1, baseY) === "roof" && roofRole(x + k.width, baseY) === "roof";
  };
  const roofKit = (pool: readonly string[], x: number, y: number, w: number, rows: number, n: number) => {
    const fit = pool.filter((id) => { const k = kit(id); return !!k && k.width <= w - 2 && k.height <= rows; });
    const chosen = [...fit].sort(() => drng() - 0.5).slice(0, Math.max(n, Math.min(2, fit.length)));
    for (const id of chosen) {
      const k = kit(id)!;
      for (let tries = 0; tries < 8; tries += 1) {
        const px = x + 1 + int(drng, 0, Math.max(0, w - 2 - k.width)), base = y + int(drng, 0, rows - k.height) + k.height - 1;
        if (onRoof(id, px, base) && place(id, px, base)) break;
      }
    }
  };
  const doorCols = new Set<number>(); // 가게 앞 보도에서 비워 둘 열
  const busyFront = new Set<number>(); // 자판기 금지 열(문·차양·쇼윈도)
  let passageLeft = 1;
  const buildShopRow = (frontY: number, bMax: number, rowSegments: readonly { x: number; w: number }[], curbRow: number) => {
  let prev: { w: number; h: number; storeys: number; style: MvTownFacade; dish?: boolean } | null = null;
  for (const seg of rowSegments) {
    let x = seg.x;
    const end = seg.x + seg.w;
    while (end - x >= 4) {
      if (passageLeft > 0 && x > seg.x + 6 && end - x > 12 && rng() < 0.35) {
        const gap = int(rng, 2, 3);
        lots.push({ kind: "rear-lot", x, y: frontY - bMax, w: gap, h: bMax });
        x += gap; passageLeft -= 1; prev = null;
        continue;
      }
      let w = rng() < 0.2 ? int(rng, 7, 9) : int(rng, 4, 6);
      if (end - x - w < 4) w = end - x; // 남은 조각이 4칸 미만이면 이 건물이 끝까지 먹는다
      if (w > 10) w = int(rng, 5, 6);
      const corner = x === seg.x || x + w >= end;
      const office = rng() < 0.22;
      // 층수: 작가 예시엔 1층 가게가 없다(가장 낮아도 창 벽 여러 줄). 사무실은 3층 이상, 4층은 모퉁이 위주.
      const pickStoreys = () => (office || corner ? int(rng, 3, 4) : pick(rng, [2, 2, 3, 3, 3, 4]));
      let style = pick(rng, office ? recipe.offices : recipe.shops);
      let storeys = pickStoreys();
      for (let tries = 0; prev && tries < 8 && (style === prev.style || (w === prev.w && storeys === prev.storeys)); tries += 1) {
        style = pick(rng, office ? recipe.offices : recipe.shops);
        storeys = pickStoreys();
      }
      // 층 문법: 1층 띠는 언제나 2줄(문·쇼윈도 높이), 그 위 창 줄 하나 = 한 층, 옥상은 1~3줄.
      // 옥상은 남는 깊이를 채운다 — 건물 뒤에 빈 아스팔트 주차장이 넓게 남지 않게(가끔 1줄은 뒷마당으로 남긴다).
      const ground = 2;
      while (1 + (storeys - 1) + ground > bMax && storeys > 2) storeys -= 1;
      const room = bMax - (storeys - 1) - ground;
      const roof = Math.max(1, Math.min(3, room - (room > 1 && rng() < 0.3 && W >= 70 ? 1 : 0)));
      const height: number = roof + (storeys - 1) + ground;
      const top = frontY - height;
      paint(style.roof, x, top, w, roof);
      // 위층 창 무늬: 벽돌 건물은 가끔 창 없는 짝 벽 + 세로창 두 칸씩(창 줄 벽과 무늬가 다르게).
      const plainUpper = !office && storeys > 2 && style.upper !== style.ground && /벽돌/.test(style.upper) && rng() < 0.4;
      if (storeys > 1) paint(plainUpper ? style.ground : style.upper, x, top + roof, w, storeys - 1);
      if (plainUpper) {
        const step = rng() < 0.5 ? 2 : 3;
        // 위층 창: 세로창 또는 넓은 창(불 켜진 창·어두운 창 섞어) — 건물마다 창 무늬가 다르다.
        const wide = decor?.upperWindows.length && w >= 5 && drng() < 0.45;
        for (let r = top + roof + 1; r < frontY - ground; r += 2) {
          if (wide) for (let wx = x + 1; wx + 3 <= x + w - 1; wx += 4) place(pick(drng, decor!.upperWindows), wx, r, { force: true });
          else for (let wx = x + 1; wx < x + w - 1; wx += step) place(recipe.objects.houseWindows[0]!, wx, r, { force: true });
        }
      }
      paint(style.ground, x, frontY - ground, w, ground);
      let dish = false;
      // 1층: 사무실은 유리 상가 띠 + 문, 가게는 문 옆으로 폭 거의 전부를 쇼윈도로 잇는다(작가 city-intersection).
      //  - 1줄 방식: 맨 아랫줄에 1줄 문 + 1줄 쇼윈도(양끝 조각), 윗줄에 차양이 폭 전체로 이어진다.
      //  - 2줄 방식: 2줄 유리문 + 2줄 통유리, 문 위에만 작은 차양.
      const rowKit = (id: string | undefined) => (id ? kit(id)?.height === 1 : false);
      const rowMode = !office && (rowKit(style.shopfront) || (!!recipe.objects.shopfrontRow && rng() < 0.5));
      const glassId = rowMode ? (rowKit(style.shopfront) ? style.shopfront! : recipe.objects.shopfrontRow!) : style.shopfront ?? recipe.objects.shopfrontTall;
      const ends = rowMode ? (style.shopfrontEnds ?? recipe.objects.shopfrontRowEnds) : undefined;
      const doorId = rowMode ? (rowKit(style.door) ? style.door : recipe.objects.doorRow ?? style.door) : rowKit(style.door) ? recipe.objects.doorTall ?? style.door : style.door;
      const doorX = x + (w <= 4 ? 1 : int(rng, 1, w - 2));
      place(doorId, doorX, frontY - 1, { force: true });
      doorCols.add(doorX);
      busyFront.add(doorX);
      // 닫힌 가게: 모통이가 아닌 가게 몇 곳은 쇼윈도 대신 셔터(문은 남는다).
      const shut = !office && !corner && !!decor?.shutter && drng() < 0.16;
      if (shut) {
        for (let gx = x; gx < x + w; gx += 1) if (gx !== doorX) { paint(decor!.shutter!, gx, frontY - ground, 1, ground); busyFront.add(gx); }
      } else if (!office && glassId) {
        const pillar = w >= 7 && rng() < 0.5;
        const glass: number[] = [];
        for (let gx = x; gx < x + w; gx += 1) if (gx !== doorX && !(pillar && (gx === x || gx === x + w - 1))) glass.push(gx);
        glass.forEach((gx, i) => {
          const runStart = i === 0 || glass[i - 1] !== gx - 1;
          const runEnd = i === glass.length - 1 || glass[i + 1] !== gx + 1;
          const id = ends && runStart !== runEnd ? (runStart ? ends[0] : ends[1]) : glassId;
          if (place(id, gx, frontY - 1, { force: true })) busyFront.add(gx);
        });
        // 2줄 쇼윈도 가게 일부는 큰 유리 쇼윈도(3칸 진열창)로.
        const big = decor?.shopWindowLarge;
        if (big && !rowMode && drng() < 0.45) {
          const run = glass.findIndex((gx, i) => glass[i + 2] === gx + 2);
          if (run >= 0) place(big, glass[run]!, frontY - 1, { force: true });
        }
      } else if (office) {
        // 사무실 1층: 문 양옆 유리창 두 칸씩(창고처럼 민벽이 되지 않게).
        for (const gx of [doorX - 2, doorX - 1, doorX + 1, doorX + 2]) if (gx >= x && gx < x + w && recipe.objects.shopfrontTall) place(recipe.objects.shopfrontTall, gx, frontY - 1, { force: true });
      }
      // 차양: 그늘 줄이 1층 맨 아랫줄(GUIDE·check_town_map 의 awning-off-ground), 문·쇼윈도는 그늘이 덮지 않는다(keepDoors).
      if (!office && style.awning && w >= 3) {
        const small = recipe.objects.awningSmall;
        if (rowMode && rng() < 0.8) {
          // 가게 폭 안에서만 — 3칸 차양은 통째로, 남는 1~2칸은 1칸 차양으로 닫는다. 문 칸은 피해 잘린 조각이 없게(DEFECTS r4-4).
          let ax = x;
          while (ax < x + w) {
            const clear3 = x + w - ax >= 3 && ![ax, ax + 1, ax + 2].includes(doorX);
            if (clear3) { place(style.awning, ax, frontY - 1, { keepDoors: true, force: true }); ax += 3; }
            else { if (small && ax !== doorX) place(small, ax, frontY - 1, { keepDoors: true, force: true }); ax += 1; }
          }
        } else if (small && rng() < 0.7) place(small, doorX, frontY - 1, { keepDoors: true, force: true });
        for (let i = x; i < x + w; i += 1) busyFront.add(i);
      }
      if (roof >= 2 && w >= 4 && !prev?.dish && rng() < 0.25) { const id = pick(rng, recipe.objects.roofProps), dx = x + int(rng, 0, w - 2); dish = onRoof(id, dx, top + 1) && place(id, dx, top + 1); }
      const gear = recipe.objects.roofGear ?? [];
      if (!office && decor) {
        // 간판: 가게마다 하나, 1층 띠 바로 위 위층 벽 맨 아랫줄(문 위 또는 쇼윈도 위). 이웃과 같은 간판은 안 쓴다.
        const sign = signDeal();
        const sw = kit(sign)?.width ?? 1;
        const cols = [doorX, doorX - 1, doorX + 1, x + 1, x + w - 1 - sw].filter((c) => c >= x && c + sw <= x + w);
        for (const c of cols) if (place(sign, c, frontY - ground - 1)) break;
        // 세로 깃발: 3층 이상 가게 삼분의 일, 벽 한쪽 끝.
        if (decor.banners.length && storeys >= 3 && drng() < 0.35) place(pick(drng, decor.banners), drng() < 0.5 ? x : x + w - 1, frontY - ground - 2);
      }
      // 비상계단·벽 사다리: 줄 끝(옆벽이 보이는) 4층 건물. 비상계단(3×5)은 땅까지 내려오고(문 없는 끝 3칸), 사다리(1×3)는 위층 벽에만.
      if (decor && corner && storeys >= 4 && w >= 5) {
        const left = x === seg.x;
        const fx = left ? x : x + w - 3;
        const clearOfDoor = Math.abs(doorX - (fx + 1)) >= 2;
        if (decor.fireEscape && office && w >= 6 && clearOfDoor && drng() < 0.6) {
          place(decor.fireEscape, fx, frontY - 1, { force: true });
          for (let i = fx; i < fx + 3; i += 1) busyFront.add(i);
        } else if (decor.wallLadder && Math.abs(doorX - (left ? x : x + w - 1)) >= 1) place(decor.wallLadder, left ? x : x + w - 1, frontY - ground - 1, { force: true });
      }
      // 옥상: 사무실은 앞 가장자리 유리 난간, 건물마다 설비 1~3가지(태양광·물탱크·안테나·공조기·환기구).
      if (decor?.roofRailing && office && roof >= 2) {
        paint(decor.roofRailing, x, top + roof - 1, w, 1);
        for (let i = x; i < x + w; i += 1) used.add((top + roof - 1) * W + i);
      }
      roofAreas.push({ x, y: top, w, rows: office && roof >= 2 ? roof - 1 : roof, office, h: height, n: int(drng, 1, 3) });
      // 예전 옥상 설비가 쓰던 난수는 그대로 소비한다(같은 시드 = 같은 건물 배치).
      if (gear.length && w >= 3) for (let i = 0, n = int(rng, 0, w >= 6 ? 2 : 1); i < n; i += 1) { rng(); rng(); rng(); }
      // 뒤: 건물 절반쯤만 뒷문 옆에 2~3개 무리(분리수거함·배전함·상자·실외기) — 나머지 뒷벽은 비운다(DEFECTS r1-5).
      if (top - 1 >= frontY - bMax - 2 && top - 1 >= 1 && rng() < 0.5) {
        const n = int(rng, 2, 3);
        const condensers: string[] = []; // 실외기는 옥상 설비 — 골목 아스팔트 위에 두지 않는다(DEFECTS r3-12)
        void gear;
        const bin = pick(rng, recipe.objects.backProps.filter((id) => id.startsWith("recycle")).concat(recipe.objects.backProps[0]!));
        const pool = [bin, ...recipe.objects.backProps.filter((id) => !id.startsWith("recycle")), ...condensers, ...(decor?.service ?? []).filter((id) => (kit(id)?.width ?? 9) === 1)];
        let bx = x + int(rng, 0, Math.max(0, w - n));
        for (let i = 0; i < n; i += 1, bx += 1) place(i === 0 ? bin : pick(rng, pool), bx, top - 1);
      }
      lots.push({ kind: office ? "office" : "shop", x, y: top, w, h: height, storeys, door: { x: doorX, y: frontY - 1 } });
      prev = { w, h: height, storeys, style, dish };
      x += w;
    }
    prev = null;
  }
  void curbRow;
  };
  buildShopRow(frontY, bMax, shopSegments, frontY + 2);
  if (south2) buildShopRow(south2.frontY, south2.frontY - south2.top, south2Segments, south2.frontY + 1);

  // 낮은 건물 뒤 넓은 뒷마당: 주차 칸 선을 긋는다(주차는 가게 뒤, 큰길 쪽이 아니다).
  if (recipe.parkingLine) {
    for (const lot of lots) {
      if (lot.kind !== "shop" && lot.kind !== "office") continue;
      if (!lot.door || lot.door.y !== frontY - 1) continue; // 둘째 상가 줄 뒤는 골목 1줄 — 그 앞에 선을 긋으면 큰길 보도가 주차선 띠가 된다(DEFECTS r3-5)
      const depth = lot.y - alley; // 골목과 건물 사이 뒷마당 줄 수
      if (depth < 2) continue;
      const lineH = Math.min(3, depth - (depth > 2 ? 1 : 0));
      // 칸 선은 맵 전체 짝수 열에만 — 이웃 필지 선이 붙으면 오토타일이 이어져 「8」 모양이 된다.
      for (let px = lot.x + (lot.x % 2); px < lot.x + lot.w; px += 2) {
        if ([...Array(lineH).keys()].some((dy) => used.has((lot.y - lineH + dy) * W + px))) continue;
        paint(recipe.parkingLine, px, lot.y - lineH, 1, lineH);
      }
    }
  }

  // ── 5. 주택가·공원 ──
  // 필지를 벽 가까이 붙여(틈 1칸) 줄마다 지붕·벽 짝이 겹치지 않게, 집은 박공(용마루 1 + 앞면 2) + 벽 3,
  // 절반은 앞 날개(용마루가 한 줄 낮은 3칸 박공)를 내민 ㄱ자 집. 문은 현관문(철문 아님), 날개와 본채에 하나씩.
  // 두 번째 주택 띠(큰 맵)와 일부 블록은 벽을 맞댄 중층 주거 줄 — 뒷마당 줄까지 옥상이 덮는다(DEFECTS r1-1·6).
  const parkBand = bands.length ? pick(rng, bands) : null; // 공원이 설 주택 띠도 시드가 고른다
  const parkSegIndex = options.park === false || (W < 70 && rng() < 0.4) ? -1 : (() => {
    // 작은 맵은 블록 하나를 통째로 공원에 주지 않는다 — 공원 옆에 집이 설 16칸 이상 블록에만 쌈지 공원(DEFECTS r1-1).
    const wide = segments.map((seg, i) => ({ seg, i })).filter(({ seg }) => seg.w >= (W < 70 ? 16 : 12));
    return wide.length ? pick(rng, wide).i : -1;
  })();
  const drivewayCols = new Set<number>();
  const houseDoors = recipe.objects.houseDoors?.length ? recipe.objects.houseDoors : [recipe.objects.houseDoor];
  const apartments = recipe.apartments?.length ? recipe.apartments : recipe.shops;
  /** 한 줄 안에서 짝이 다 쓰일 때까지 겹치지 않게 뽑는다. */
  const dealer = <T>(list: readonly T[]) => {
    let deck: T[] = [];
    let last: T | null = null;
    return (): T => {
      if (!deck.length) deck = [...list].sort(() => rng() - 0.5);
      let i = deck.findIndex((item) => item !== last);
      if (i < 0) i = 0;
      last = deck.splice(i, 1)[0]!;
      return last;
    };
  };
  /** 뒤 경계: 맨 윗줄 울타리(3줄이면) + 생울타리 줄(3칸 조각, 필지 경계에서 1칸 끊김). */
  const backHedge = (x0: number, x1: number, band: HouseBand) => {
    const base = band.backY + band.back - 1;
    if (band.back >= 3) paint(recipe.fence, x0, band.backY, x1 - x0, 1);
    // 낮은 관목 줄 1줄(불규칙한 틈) — 2줄 생울타리 판이 위 보도를 덮던 것(DEFECTS r2-10).
    if (recipe.tallGrass) {
      let gap = x0 + int(grng, 4, 8);
      for (let hx = x0; hx < x1; hx += 1) {
        if (hx === gap) { gap += int(grng, 5, 9); continue; }
        shrub(hx, base);
      }
      return;
    }
    const hedge = recipe.objects.hedge;
    let hx = x0;
    while (hx < x1) {
      if (hedge && hx + 3 <= x1 && place(hedge, hx, base)) { hx += 3; continue; }
      place(recipe.objects.bushes[0]!, hx, base);
      hx += 1;
    }
  };
  const buildHouse = (hx: number, hw: number, band: HouseBand, style: (typeof recipe.houses)[number], wingOk = true) => {
    const top = band.houseY;
    const wallBottom = top + 5;
    const pair = gablePair(style.roof);
    const ridge = pair?.back ?? style.roof;
    const face = pair?.front ?? style.roof;
    paint(ridge, hx, top, hw, 1);
    paint(face, hx, top + 1, hw, 2);
    paint(style.wall, hx, top + 3, hw, 3);
    const wingW = hw >= 7 ? 3 : 2;
    const wing = wingOk && hw >= 6 && rng() < 0.55 ? (rng() < 0.5 ? "left" : "right") : null;
    const doors: number[] = [];
    const deal = dealer(houseDoors);
    if (wing) {
      const wx = wing === "left" ? hx : hx + hw - wingW;
      paint(ridge, wx, top + 1, wingW, 1);
      paint(face, wx, top + 2, wingW, 2);
      paint(style.wall, wx, top + 4, wingW, 2);
      const wd = wx + Math.floor(wingW / 2);
      place(deal(), wd, wallBottom, { force: true });
      doors.push(wd);
      // 본채 쪽 문(날개 옆 옆문) — 날개와 본채는 파사드 두 덩어리라 각자 문이 있어야 한다.
      const mainX0 = wing === "left" ? wx + wingW : hx;
      const mainX1 = wing === "left" ? hx + hw : wx;
      const md = wing === "left" ? mainX0 + 1 : mainX1 - 2;
      if (md >= mainX0 && md < mainX1) { place(deal(), md, wallBottom, { force: true }); doors.push(md); }
    } else {
      const d = hx + int(rng, 1, hw - 2);
      place(deal(), d, wallBottom, { force: true });
      doors.push(d);
    }
    for (let wx = hx; wx < hx + hw; wx += 1) {
      if (doors.some((d) => Math.abs(d - wx) <= 1)) continue;
      if ((wx - hx) % 2 === 0) place(pick(rng, recipe.objects.houseWindows), wx, wallBottom, { force: true });
    }
    // 앞마당: 현관길(문 → 보도) + 길 양옆 화단 한 쌍, 필지 모서리에 나무 한 그루(모든 필지 같은 쪽).
    const mainDoor = doors[0]!;
    if (band.front > 0) paint(recipe.path, mainDoor, band.frontY, 1, Math.min(band.front, H - band.frontY));
    // 현관길 화단: 집마다 다르게(한 쌍·한쪽·없음) — 모든 필지가 같은 모양이던 것(DEFECTS r2-4).
    const bed = pick(rng, recipe.objects.flowerBeds);
    const beds = grng();
    if (beds < 0.45) { place(bed, mainDoor - 1, band.frontY); place(bed, mainDoor + 1, band.frontY); }
    else if (beds < 0.75) place(bed, mainDoor + (rng() < 0.5 ? -1 : 1), band.frontY);
    for (const d of doors.slice(1)) if (band.front > 0) paint(recipe.path, d, band.frontY, 1, 1);
    // 지붕: 용마루 줄에 안테나·위성 안테나 하나(집 절반쯤) — 맨 지붕만 늘어서지 않게.
    if (decor && drng() < 0.6) {
      const id = pick(drng, ["roof_antenna", "satellite_dish", "roof_antenna"].filter((k) => kit(k)));
      const k = id ? kit(id) : undefined;
      if (k && k.width <= hw) place(id, hx + int(drng, 0, hw - k.width), top + k.height - 1);
    }
    lots.push({ kind: "house", x: hx, y: top, w: hw, h: 6, door: { x: mainDoor, y: wallBottom } });
    return doors;
  };
  const buildApartmentRow = (x0: number, x1: number, band: HouseBand) => {
    const deal = dealer(apartments);
    const bottom = band.frontY - 1;
    const topY = band.backY;
    let x = x0;
    let prevStoreys = 0;
    while (x1 - x >= 4) {
      let w = int(rng, 5, 8);
      if (x1 - x - w < 4) w = x1 - x;
      if (w > 10) w = int(rng, 5, 6);
      const style = deal();
      const height = bottom - topY + 1;
      let storeys = int(rng, 2, Math.min(4, height - 3));
      if (storeys === prevStoreys && height - 3 > 2) storeys = storeys === 2 ? 3 : storeys - 1;
      prevStoreys = storeys;
      const ground = 2;
      const roof = height - storeys - ground;
      const lotTop = topY + (rng() < 0.3 && roof > 2 ? 1 : 0);
      if (lotTop > topY) paint(recipe.alley, x, topY, w, 1);
      paint(style.roof, x, lotTop, w, roof - (lotTop - topY));
      paint(style.upper, x, topY + roof, w, storeys);
      paint(style.ground, x, bottom - 1, w, ground);
      const door = x + int(rng, 1, w - 2);
      place(style.door, door, bottom, { force: true });
      for (let wx = x; wx < x + w; wx += 1) if (Math.abs(wx - door) >= 2 && (wx - x) % 2 === 1) place(pick(rng, recipe.objects.houseWindows), wx, bottom, { force: true });
      const gear = recipe.objects.roofGear ?? [];
      if (gear.length) for (let i = 0, n = int(rng, 1, 2); i < n; i += 1) { const id = pick(rng, gear), gx = x + int(rng, 0, w - 1), gy = lotTop + int(rng, 0, Math.max(0, roof - (lotTop - topY) - 1)); if (onRoof(id, gx, gy)) place(id, gx, gy); }
      if (decor) roofAreas.push({ x, y: lotTop, w, rows: roof - (lotTop - topY), office: false, h: bottom - lotTop + 1, n: int(drng, 1, 2) });
      if (band.front > 0) paint(recipe.path, door, band.frontY, 1, Math.min(band.front, H - band.frontY));
      // 앞 화단: 문 양옆 화분 나무 한 쌍 — 앞마당 잔디를 줄로 끊는다.
      const hedge = recipe.objects.hedge;
      if (band.front >= 2 && hedge) {
        for (const hx of [door - 4, door + 2]) if (hx >= x && hx + 3 <= x + w) place(hedge, hx, band.frontY + 1);
      } else place(pick(rng, recipe.objects.flowerBeds), door + 1, band.frontY);
      lots.push({ kind: "house", x, y: lotTop, w, h: bottom - lotTop + 1, storeys: storeys + 1, door: { x: door, y: bottom } });
      x += w;
    }
    return x;
  };
  bands.forEach((band, bandIndex) => {
    segments.forEach((seg, si) => {
      let x = seg.x;
      let end = seg.x + seg.w;
      const bandTop = band.backY;
      const bandBottom = band.roadY === null ? H : band.walkY;
      if (si === parkSegIndex && band === parkBand) {
        const want = W >= 70 ? int(rng, 12, 16) : int(rng, 8, 9); // 작은 맵은 쌈지 공원
        const pw = seg.w - want < 5 ? Math.min(seg.w, want + 4) : want;
        const atRight = seg.x + seg.w < W && (seg.x === 0 || rng() < 0.5);
        const parkX = atRight ? seg.x + seg.w - pw : seg.x;
        buildPark(parkX, bandTop, pw, bandBottom - bandTop);
        if (pw === seg.w) return;
        if (atRight) end = parkX; else x = parkX + pw;
      }
      const flats = band.roadY !== null && end - x >= 8 && rng() < (bandIndex > 0 ? 0.75 : W < 70 ? 0.75 : 0.45);
      if (flats) {
        const stop = buildApartmentRow(x, end, band);
        if (stop < end) paint(recipe.lawn, stop, bandTop, end - stop, band.frontY - bandTop);
        return;
      }
      // 넓은 블록은 한쪽 끝을 중층 주거 몇 채로(벽 맞댐), 나머지를 단독주택으로 — 한 줄에 크기가 섞인다.
      if (band.roadY !== null && end - x >= 18 && rng() < 0.65) {
        const fw = int(rng, 8, Math.min(16, end - x - 9));
        if (rng() < 0.5) { buildApartmentRow(x, x + fw, band); x += fw; }
        else { buildApartmentRow(end - fw, end, band); end -= fw; }
      }
      backHedge(x, end, band);
      const deal = dealer(recipe.houses);
      // 블록 하나에 줄집(벽 맞댐 4~5칸 3~4채)을 한 번 섞는다 — 단독주택만 같은 간격으로 늘어서지 않게.
      let terrace = end - x >= 20 && rng() < 0.5;
      while (end - x >= 5) {
        if (terrace && end - x >= 16 && rng() < 0.5) {
          terrace = false;
          const count = Math.min(4, Math.floor((end - x - 2) / 4));
          let tx = x + 1;
          for (let i = 0; i < count; i += 1) {
            const tw = int(rng, 4, 5);
            if (tx + tw > end - 1) break;
            buildHouse(tx, tw, band, deal(), false);
            tx += tw;
          }
          // 줄집 앞: 생울타리 한 줄(보도 쪽), 현관길 자리는 비운다.
          x = tx + 1;
          continue;
        }
        let lotW = W < 70 ? int(rng, 6, 8) : int(rng, 6, 12);
        if (end - x - lotW < 5) lotW = end - x;
        if (lotW > 13) lotW = int(rng, 7, 10);
        const drive = band.roadY !== null && lotW >= 10 && rng() < 0.5;
        // 작은 맵은 이웃 틈 0~1칸(밀도 30% 이상, 라운드 4). 난수 소비는 예전과 같다.
        const hw = Math.max(4, Math.min(9, lotW - (drive ? 3 : W < 70 ? (x + lotW >= end ? 0 : 1) : int(rng, 1, 2))));
        const room = lotW - hw - (drive ? 3 : 0);
        const hx = x + (drive ? 0 : int(rng, 0, Math.max(0, room)));
        buildHouse(hx, hw, band, deal());
        if (drive) {
          const dx = hx + hw + 1;
          paint(recipe.driveway, dx, band.houseY + 3, 2, band.walkY - band.houseY - 3);
          paint(recipe.driveway, dx, band.lawnY, 2, 1);
          drivewayCols.add(dx); drivewayCols.add(dx + 1);
          // 진입로에 세운 세로 차(가끔).
          const carsV = recipe.objects.carsVertical ?? [];
          if (carsV.length && rng() < 0.5) place(pick(rng, carsV)[1], dx, band.frontY + band.front - 1);
        }
        // 예전 모서리 나무가 쓰던 난수 한 번은 그대로 소비한다(뒤 필지의 폭·집 모양이 r1 과 같게).
        if (band.front >= 2 && !drivewayCols.has(x + lotW - 1)) rng();
        // 앞마당: 필지마다 다른 조경 — 나무(자리도 제각각)·덤불·꽃 무리·맨 잔디(DEFECTS r2-4). 나무는 마당 깊이 안에만 서서 보도·벽을 덮지 않는다.
        if (band.front >= 2) {
          const doorsHere = new Set(lots.flatMap((l) => (l.kind === "house" && l.door && l.x >= x && l.x < x + lotW ? [l.door.x] : [])));
          const free = (cx: number, w: number) => [...Array(w).keys()].every((i) => cx + i >= x && cx + i < x + lotW && !drivewayCols.has(cx + i) && ![...doorsHere].some((d) => Math.abs(d - cx - i) <= 1));
          const baseY = band.frontY + band.front - 1;
          const r = grng();
          if (r < 0.5) {
            const id = pickTree(recipe.objects.yardTrees, (t) => (kit(t)?.height ?? 9) <= band.front);
            const w = id ? kit(id)!.width : 1;
            for (let tries = 0; id && tries < 6; tries += 1) { const tx = int(grng, x, x + lotW - w); if (free(tx, w) && plantTree(id, tx, baseY)) break; }
          } else if (r < 0.68) {
            const id = pick(grng, recipe.objects.bushes.filter((b) => (kit(b)?.height ?? 9) <= band.front));
            const w = kit(id)?.width ?? 1;
            for (let tries = 0; tries < 6; tries += 1) { const tx = int(grng, x, x + lotW - w); if (free(tx, w) && place(id, tx, baseY)) break; }
          } else if (r < 0.82) {
            const id = pick(grng, recipe.objects.flowerBeds);
            const n = int(grng, 2, 3);
            const tx = int(grng, x, Math.max(x, x + lotW - n));
            if (free(tx, n)) for (let i = 0; i < n; i += 1) place(id, tx + i, baseY);
          }
        }
        const hedge = recipe.objects.hedge;
        if (hedge && band.front >= 3 && rng() < 0.6) {
          for (let gx = x; gx + 3 <= x + lotW - 1; gx += 3) {
            if ([0, 1, 2].some((i) => drivewayCols.has(gx + i) || lots.some((l) => l.door && l.door.x === gx + i && l.x >= x && l.x < x + lotW))) continue;
            place(hedge, gx, band.frontY + band.front - 1);
          }
        }
        x += lotW;
      }
    });
  });
  // 마지막 로컬 도로 건너편: 보도 한 줄 아래로 맵 밖으로 이어지는 건물들의 뒷면(옥상) — 빈 뒷마당 띠 대신(DEFECTS r1-1).
  const backRoofs = [...new Set([...recipe.shops, ...recipe.offices].map((s) => s.roof))];
  const roofBacks = (y0: number, rows: number) => {
    for (const seg of splitSegments(corridors.filter((c) => c.y0 <= y0 && c.y1 >= y0 + rows))) {
      let x = seg.x;
      let last = "";
      while (x < seg.x + seg.w) {
        let w = Math.min(int(rng, 5, 9), seg.x + seg.w - x);
        if (seg.x + seg.w - x - w < 3) w = seg.x + seg.w - x;
        let roof = pick(rng, backRoofs);
        for (let k = 0; k < 4 && roof === last; k += 1) roof = pick(rng, backRoofs);
        last = roof;
        paint(roof, x, y0, w, rows);
        roofAreas.push({ x, y: y0, w, rows, office: false, h: 0, n: 1 });
        const gear = recipe.objects.roofGear ?? [];
        if (gear.length && rows >= 1 && rng() < 0.7) { const id = pick(rng, gear), gx = x + int(rng, 0, w - 1), gy = y0 + int(rng, 0, rows - 1); if (onRoof(id, gx, gy)) place(id, gx, gy); }
        x += w;
      }
    }
  };
  if (stripY >= 0) roofBacks(stripY + 1, H - stripY - 1);
  if (backWall) backWalls(); else roofBacks(0, 1); // 맨 윗줄: 뒷골목 건너편 건물(철망 울타리 띠 대신, DEFECTS r1-5·12)

  /**
   * 골목 건너편 건물의 뒷벽(0~1줄, 옆 건물과 재료가 다르게 5~9칸씩) — 벽마다 검은 철문 하나,
   * 문 옆에 대형 쓰레기통·바퀴 쓰레기통·봉투·설비함 무리, 벽에 벽걸이 실외기. 무리 사이는 빈 포장으로 둔다.
   */
  function backWalls(): void {
    const walls = [...new Set([...recipe.shops, ...recipe.offices, ...(recipe.apartments ?? [])].map((s) => s.ground))];
    const door = decor?.backDoor && kit(decor.backDoor) ? decor.backDoor : null;
    const service = (decor?.service ?? []).filter((id) => kit(id));
    for (const seg of splitSegments(corridors.filter((c) => c.y0 === 0))) {
      let x = seg.x;
      let last = "";
      while (x < seg.x + seg.w) {
        let w = Math.min(int(drng, 5, 8), seg.x + seg.w - x);
        if (seg.x + seg.w - x - w < 3) w = seg.x + seg.w - x;
        if (w > 10) w = Math.ceil(w / 2); // 폭 10칸 상한(check_town_map facade-too-wide)
        const mat = pick(drng, walls.filter((m) => m !== last));
        last = mat;
        const roofOf = [...recipe.shops, ...recipe.offices, ...(recipe.apartments ?? [])].find((s) => s.ground === mat)?.roof;
        if (roofOf) paint(roofOf, x, 0, w, 1);
        paint(mat, x, roofOf ? 1 : 0, w, roofOf ? 2 : 3);
        // 뒷벽 앞 1줄 = 콘크리트 상하차 마당(설비·쓰레기통 자리). 아스팔트가 벽에 바로 붙으면 가게 앞 주차장으로 읽힌다.
        paint(recipe.driveway, x, alleyTop, w, 1);
        if (w >= 2 && door) {
          const dx = x + (w <= 3 ? Math.floor(w / 2) : int(drng, 1, w - 2));
          place(door, dx, 2, { force: true });
          lots.push({ kind: "rear-lot", x, y: 0, w, h: 3, door: { x: dx, y: 2 } });
          if (decor?.acWall && kit(decor.acWall) && drng() < 0.6) {
            const ax = pick(drng, [...Array(w).keys()].map((i) => x + i).filter((cx) => Math.abs(cx - dx) >= 2));
            if (ax !== undefined) place(decor.acWall, ax, 1, { force: true });
          }
          // 문 옆 무리: 문 앞 칸은 비우고 한쪽으로 2~3개(대형 쓰레기통은 가끔). 뒷벽 세에 하나는 무리 없이 비운다.
          if (service.length && drng() < 0.72) {
            const side = drng() < 0.5 ? -1 : 1;
            let cx = dx + side * 2;
            const deck = [...service].sort(() => drng() - 0.5);
            for (let n = 0, want = int(drng, 2, 3), i = 0; n < want && i < deck.length; i += 1) {
              const id = deck[i]!;
              const kw = kit(id)!.width;
              const at = side < 0 ? cx - kw + 1 : cx;
              if (at < x - 1 || at + kw > x + w + 1 || [...Array(kw).keys()].some((j) => Math.abs(at + j - dx) <= 1)) continue;
              if (place(id, at, alleyTop)) { n += 1; cx += side * kw; }
            }
          }
        }
        x += w;
      }
    }
  }

  function buildPark(px: number, py: number, pw: number, ph: number): void {
    const rng = grng;
    // 작가 p4: 입구(보도)에서 들어와 다른 입구로 나가는 산책로, 넓은 빈 잔디, 2~3그루 나무 무리, 길을 보는 벤치,
    // 관목 테두리. 모양(사선·ㄱ·ㄹ자)·입구·광장 유무를 시드와 크기가 고른다(DEFECTS r2-1·2·5·6·7·8).
    const X1 = px + pw - 1, Y1 = py + ph - 1;
    const lab = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? "" : tileset.tileMeta?.[map.lowerTiles[y * W + x] ?? -1]?.label ?? "");
    const walk = (x: number, y: number) => lab(x, y) === recipe.sidewalk;
    const key = (x: number, y: number) => y * W + x;
    const big = pw >= 12 && ph >= 10;
    const bw = big ? 2 : 1; // 산책로 폭
    paint(parkLawn, px, py, pw, ph);
    // 꽃밭 덩어리: 넓은 잔디 한두 곳(나무·벤치는 그 위에 서도 된다).
    if (recipe.meadow) for (let i = 0, n = big ? int(rng, 2, 3) : int(rng, 0, 1); i < n; i += 1) {
      const mw = int(rng, 2, big ? 4 : 3), mh = int(rng, 2, 3);
      paint(recipe.meadow, int(rng, px + 1, Math.max(px + 1, X1 - mw)), int(rng, py + 1, Math.max(py + 1, Y1 - mh)), mw, mh);
    }
    // 입구: 보도에 닿은 변에서만. 북쪽은 잔디 1줄 너머 보도여도 된다(그 줄까지 길을 잇는다).
    type Gate = { side: "n" | "s" | "w" | "e"; x: number; y: number; lead: number };
    const gates: Gate[] = [];
    const along = (lo: number, hi: number) => int(rng, lo, Math.max(lo, hi));
    const cols = (x: number) => [...Array(bw).keys()].map((i) => x + i);
    { const x = along(px + 2, X1 - 1 - bw); const lead = cols(x).every((c) => walk(c, py - 1)) ? 0 : cols(x).every((c) => walk(c, py - 2)) ? 1 : -1; if (lead >= 0) gates.push({ side: "n", x, y: py, lead }); }
    { const x = along(px + 2, X1 - 1 - bw); if (cols(x).every((c) => walk(c, py + ph))) gates.push({ side: "s", x, y: Y1, lead: 0 }); }
    { const y = along(py + 2, Y1 - 1 - bw); if (cols(y).every((r) => walk(px - 1, r))) gates.push({ side: "w", x: px, y, lead: 0 }); }
    { const y = along(py + 2, Y1 - 1 - bw); if (cols(y).every((r) => walk(X1 + 1, r))) gates.push({ side: "e", x: X1, y, lead: 0 }); }
    gates.sort(() => rng() - 0.5);
    // 마주 보는 두 변이 있으면 절반은 그 짝(길이 공원을 가로지른다).
    const opp = (a: Gate, b: Gate) => (a.side === "n" && b.side === "s") || (a.side === "s" && b.side === "n") || (a.side === "w" && b.side === "e") || (a.side === "e" && b.side === "w");
    const oi = gates.findIndex((g, i) => i > 0 && opp(gates[0]!, g));
    if (oi > 1 && rng() < 0.5) [gates[1], gates[oi]] = [gates[oi]!, gates[1]!];
    const use = gates.slice(0, big && gates.length >= 3 && rng() < 0.35 ? 3 : 2);
    // 이웃한 두 변이면 입구를 공유 모서리에서 먼 쪽 절반으로 — 길이 테두리를 따라 붙지 않게.
    if (use.length >= 2 && !opp(use[0]!, use[1]!)) {
      for (const [g, o] of [[use[0]!, use[1]!], [use[1]!, use[0]!]] as const) {
        const vertSide = g.side === "n" || g.side === "s";
        const lo = vertSide ? px + 2 : py + 2, hi = vertSide ? X1 - 1 - bw : Y1 - 1 - bw;
        const mid = Math.floor((lo + hi) / 2);
        const farLow = vertSide ? o.side === "e" : o.side === "s";
        for (let tries = 0; tries < 8; tries += 1) {
          const v = farLow ? int(rng, lo, Math.max(lo, mid - 1)) : int(rng, Math.min(hi, mid + 1), hi);
          const okCells = cols(v).every((c) => (vertSide ? walk(c, g.side === "n" ? py - 1 - g.lead : py + ph) : walk(g.side === "w" ? px - 1 : X1 + 1, c)));
          if (okCells) { if (vertSide) g.x = v; else g.y = v; break; }
        }
      }
    }
    const pathCells = new Set<number>();
    const brush = (x: number, y: number) => { for (let dy = 0; dy < bw; dy += 1) for (let dx = 0; dx < bw; dx += 1) if (x + dx >= px && x + dx <= X1 && y + dy >= py && y + dy <= Y1) pathCells.add(key(x + dx, y + dy)); };
    const line = (x0: number, y0: number, x1: number, y1: number) => { // 곧은 줄
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) brush(x, y);
    };
    const diag = (x0: number, y0: number, x1: number, y1: number) => { // 계단 사선(4방향으로 이어지게)
      let x = x0, y = y0;
      brush(x, y);
      while (x !== x1 || y !== y1) {
        const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
        if (dx && (!dy || Math.abs(x1 - x) >= Math.abs(y1 - y) || rng() < 0.5)) x += dx; else y += dy;
        brush(x, y);
      }
    };
    const inner = (g: Gate) => ({ x: g.side === "w" ? px : g.side === "e" ? X1 - bw + 1 : g.x, y: g.side === "n" ? py : g.side === "s" ? Y1 - bw + 1 : g.y });
    const route = (a: { x: number; y: number }, b: { x: number; y: number }, vertical: boolean) => {
      const shape = rng();
      if (shape < 0.45) {
        // 입구에서 1~2칸 곧게 들어온 뒤 사선.
        const k = int(rng, 1, 2);
        const a2 = vertical ? { x: a.x, y: Math.min(Y1, a.y + Math.sign(b.y - a.y) * k) } : { x: Math.min(X1, a.x + Math.sign(b.x - a.x) * k), y: a.y };
        const b2 = vertical ? { x: b.x, y: b.y - Math.sign(b.y - a.y) * k } : { x: b.x - Math.sign(b.x - a.x) * k, y: b.y };
        line(a.x, a.y, a2.x, a2.y); diag(a2.x, a2.y, b2.x, b2.y); line(b2.x, b2.y, b.x, b.y);
      } else if (vertical) {
        const t = int(rng, Math.min(a.y, b.y) + 2, Math.max(Math.min(a.y, b.y) + 2, Math.max(a.y, b.y) - 2));
        line(a.x, a.y, a.x, t); line(a.x, t, b.x, t); line(b.x, t, b.x, b.y);
      } else {
        const t = int(rng, Math.min(a.x, b.x) + 2, Math.max(Math.min(a.x, b.x) + 2, Math.max(a.x, b.x) - 2));
        line(a.x, a.y, t, a.y); line(t, a.y, t, b.y); line(t, b.y, b.x, b.y);
      }
    };
    const cx = px + Math.floor(pw / 2), cy = py + Math.floor(ph / 2);
    if (use.length >= 2) {
      const [ga, gb] = use as [Gate, Gate];
      const a = inner(ga), b = inner(gb);
      if (opp(ga, gb)) route(a, b, ga.side === "n" || ga.side === "s");
      else {
        // 이웃한 두 변: ㄱ자(모퉁이 칸에서 꺾는다) 또는 사선.
        const corner = ga.side === "n" || ga.side === "s" ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
        if (rng() < 0.5) { line(a.x, a.y, corner.x, corner.y); line(corner.x, corner.y, b.x, b.y); } else diag(a.x, a.y, b.x, b.y);
      }
      for (const g of use.slice(2)) {
        // 셋째 입구: 가장 가까운 산책로 칸으로 곧게 잇는다.
        const p = inner(g);
        let best = -1, bd = 1e9;
        for (const c of pathCells) { const d = Math.abs((c % W) - p.x) + Math.abs(Math.floor(c / W) - p.y); if (d < bd) { bd = d; best = c; } }
        const t = { x: best % W, y: Math.floor(best / W) };
        if (g.side === "n" || g.side === "s") { line(p.x, p.y, p.x, t.y); line(p.x, t.y, t.x, t.y); } else { line(p.x, p.y, t.x, p.y); line(t.x, p.y, t.x, t.y); }
      }
    } else if (use.length === 1) {
      // 입구가 하나뿐: 공원 가운데 쉼터까지 들어가 끝난다.
      const a = inner(use[0]!);
      if (use[0]!.side === "n" || use[0]!.side === "s") line(a.x, a.y, a.x, cy); else line(a.x, a.y, cx, a.y);
    }
    // 큰 공원만, 그것도 가끔: 산책로 한 칸을 중심으로 광장 + 분수. 아니면 쉼터 없이 길만.
    let plaza: { x: number; y: number; w: number; h: number } | null = null;
    if (big && pathCells.size && rng() < 0.55) {
      let best = -1, bd = 1e9;
      for (const c of pathCells) { const d = Math.abs((c % W) - cx) + Math.abs(Math.floor(c / W) - cy); if (d < bd) { bd = d; best = c; } }
      const w = 4, h = 4;
      const x = Math.max(px + 2, Math.min(X1 - 1 - w, (best % W) - 1)), y = Math.max(py + 2, Math.min(Y1 - 1 - h, Math.floor(best / W) - 1));
      plaza = { x, y, w, h };
      for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) pathCells.add(key(xx, yy));
    }
    // 산책로 끝은 보도까지: 북쪽 입구가 잔디 1줄 너머면 그 줄도 길.
    for (const g of use) if (g.side === "n" && g.lead === 1) for (const c of cols(g.x)) paint(recipe.path, c, py - 1, 1, 1);
    for (const c of pathCells) paint(recipe.path, c % W, Math.floor(c / W), 1, 1);
    if (plaza) {
      paint(recipe.plaza ?? recipe.path, plaza.x, plaza.y, plaza.w, plaza.h);
      if (recipe.objects.fountain) place(recipe.objects.fountain, plaza.x + 1, plaza.y + 2);
    }
    const isPath = (x: number, y: number) => pathCells.has(key(x, y));
    // 연못(수련잎) — 산책로에서 1칸 떨어진 빈 잔디에. 큰 공원은 4×3~5×4, 쌀지 공원은 3×2(자리가 있을 때만).
    const clearRect = (x0: number, y0: number, w: number, h: number, pad: number) => {
      if (x0 - pad <= px || y0 - pad <= py || x0 + w + pad > X1 || y0 + h + pad > Y1) return false;
      for (let y = y0 - pad; y < y0 + h + pad; y += 1) for (let x = x0 - pad; x < x0 + w + pad; x += 1) if (isPath(x, y) || used.has(key(x, y))) return false;
      return true;
    };
    if (decor?.pond) {
      for (const [w, h] of big ? [[5, 4], [4, 3], [3, 2]] : [[3, 2], [2, 2]]) {
        const spots: { x: number; y: number }[] = [];
        for (let y = py + 1; y + h < Y1; y += 1) for (let x = px + 1; x + w < X1; x += 1) if (clearRect(x, y, w, h, 1)) spots.push({ x, y });
        if (!spots.length) continue;
        const s = pick(drng, spots);
        paint(decor.pond, s.x, s.y, w, h);
        for (let y = s.y; y < s.y + h; y += 1) for (let x = s.x; x < s.x + w; x += 1) used.add(key(x, y));
        if (decor.lily) for (let i = 0, n = w >= 4 ? 2 : 1; i < n; i += 1) paint(decor.lily, s.x + int(drng, 0, w - 1), s.y + int(drng, 0, h - 1), 1, 1);
        break;
      }
    }
    // 놀이 구역: 공원 한 모통이에 시소·그네·골대 1~3개(모래흙 바닥). 산책로를 막지 않게.
    if (decor?.play.length) {
      const corners = [[px + 1, py + 1], [X1 - 5, py + 1], [px + 1, Y1 - 4], [X1 - 5, Y1 - 4]].sort(() => drng() - 0.5);
      const pool = decor.play.filter((id) => kit(id)).sort(() => drng() - 0.5).slice(0, big ? 3 : 2);
      for (const [cx, cy] of corners) {
        let n = 0;
        for (const id of pool) {
          const k = kit(id)!;
          for (let tries = 0; tries < 10; tries += 1) {
            const x = cx! + int(drng, 0, 4 - k.width), base = cy! + int(drng, k.height - 1, 3);
            if (x <= px || x + k.width > X1 || base >= Y1 || base - k.height < py) continue;
            if ([...Array(k.width).keys()].some((i) => isPath(x + i, base) || isPath(x + i, base + 1))) continue;
            if (place(id, x, base)) { n += 1; if (decor.dirt && drng() < 0.5) for (let i = 0; i < k.width; i += 1) if (!isPath(x + i, base + 1) && base + 1 < Y1 && !used.has(key(x + i, base + 1))) paint(recipe.worn ?? decor.dirt, x + i, base + 1, 1, 1); break; }
          }
        }
        if (n) break;
      }
    }
    // 테두리: 낮은 관목 줄 1줄, 입구 자리만 끊는다(DEFECTS r2-6).
    for (let x = px; x <= X1; x += 1) for (const y of [py, Y1]) if (!isPath(x, y)) shrub(x, y);
    for (let y = py + 1; y < Y1; y += 1) for (const x of [px, X1]) if (!isPath(x, y)) shrub(x, y);
    // 벤치: 가로 산책로 바로 위 칸(길을 본다)·세로 산책로 옆 칸. 작은 공원도 1~2개, 큰 공원 3~5개, 서로 3칸 이상 떨어뜨린다.
    const benches: { x: number; y: number }[] = [];
    const want = big ? int(rng, 3, 5) : int(rng, 1, 2);
    // 긴 벤치 먼저 — 산책로를 따라 긴 벤치가 선다(DEFECTS r3-7).
    const longFirst = (s: { id: string }) => ((kit(s.id)?.width ?? 1) >= 3 ? -1 : 0);
    const inside = (x: number, y: number) => x > px && x < X1 && y > py && y < Y1;
    const spots: { x: number; y: number; id: string }[] = [];
    for (const c of pathCells) {
      const x = c % W, y = Math.floor(c / W);
      if (inside(x, y - 1) && !isPath(x, y - 1)) {
        if (recipe.objects.benchLong && [0, 1, 2].every((i) => isPath(x + i, y) && inside(x + i, y - 1) && !isPath(x + i, y - 1))) spots.push({ x, y: y - 1, id: decor?.longBenches.length ? pick(drng, decor.longBenches.filter((k) => kit(k))) : recipe.objects.benchLong }, { x, y: y - 1, id: recipe.objects.benchLong });
        spots.push({ x, y: y - 1, id: recipe.objects.bench });
      }
      for (const sx of [x - 1, x + 1]) if (inside(sx, y) && !isPath(sx, y) && isPath(x, y - 1) && isPath(x, y + 1)) spots.push({ x: sx, y, id: recipe.objects.bench });
    }
    spots.sort(() => rng() - 0.5);
    spots.sort((a, b) => longFirst(a) - longFirst(b));
    for (const s of spots) {
      if (benches.length >= want) break;
      if (benches.some((b) => Math.abs(b.x - s.x) + Math.abs(b.y - s.y) < (big ? 3 : 4))) continue;
      const w = kit(s.id)?.width ?? 1;
      if (recipe.worn && big && rng() < 0.6) for (let i = 0; i < w; i += 1) if (!used.has(key(s.x + i, s.y))) paint(recipe.worn, s.x + i, s.y, 1, 1);
      if (place(s.id, s.x, s.y)) benches.push(s);
    }
    // 가로등: 산책로 옆 칸, 불규칙하게 몇 개(큰 공원 1~3, 작은 공원 0~1).
    const lamps: { x: number; y: number }[] = [];
    const lampSpots = spots.filter((s) => s.id === recipe.objects.bench && s.y - 2 > py).sort(() => rng() - 0.5);
    for (let n = 0, want2 = big ? int(rng, 1, 3) : int(rng, 0, 1), i = 0; n < want2 && i < lampSpots.length; i += 1) {
      const s = lampSpots[i]!;
      if (benches.some((b) => Math.abs(b.x - s.x) <= 2 && Math.abs(b.y - s.y) <= 1) || lamps.some((l) => Math.abs(l.x - s.x) + Math.abs(l.y - s.y) < 5)) continue;
      if (place(n % 2 ? recipe.objects.lampAlt ?? recipe.objects.lamp : decor?.tallLamps.length ? pick(drng, decor.tallLamps) : recipe.objects.lamp, s.x, s.y)) { n += 1; lamps.push(s); }
    }
    // 나무: 2~3그루 무리. 밑동은 산책로에서 1칸 떼고, 무리끼리·그루끼리 밑동 간격 2칸 이상, 같은 열에 위아래로 쌓지 않는다(DEFECTS r2-2).
    const pool = recipe.objects.parkTrees ?? recipe.objects.yardTrees;
    const trees: { x0: number; x1: number; top: number; base: number }[] = [];
    const fits = (id: string, x: number, base: number) => {
      const k = kit(id);
      if (!k) return false;
      const top = base - k.height + 1, x1 = x + k.width - 1;
      if (x <= px || x1 >= X1 || top <= py || base >= Y1) return false;
      // 밑동 줄과 그 바로 아래는 길이 아니어야 한다(캐노피가 길 위로 드리우는 건 괜찮다).
      for (let i = x; i <= x1; i += 1) if (isPath(i, base) || isPath(i, base + 1) || isPath(i - 1, base) || isPath(i + 1, base)) return false;
      return trees.every((t) => {
        const colOverlap = x <= t.x1 + 1 && x1 >= t.x0 - 1;
        return !colOverlap || top > t.base + 3 || base < t.top - 3;
      }) && trees.every((t) => x > t.x1 + 1 || x1 < t.x0 - 1 || top > t.base || base < t.top);
    };
    const free: { x: number; y: number }[] = [];
    for (let y = py + 3; y < Y1 - 1; y += 1) for (let x = px + 2; x < X1 - 1; x += 1) if (!isPath(x, y) && !used.has(key(x, y))) free.push({ x, y });
    const clusters = Math.max(2, Math.round(free.length / (big ? 22 : 14)));
    const centers: { x: number; y: number }[] = [];
    for (let tries = 0; centers.length < clusters && tries < 60 && free.length; tries += 1) {
      const c = pick(rng, free);
      if (centers.every((o) => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) >= (big ? 6 : 4))) centers.push(c);
    }
    // 큰 둥근 나무 한 그루는 꼭(넓은 캐노피가 공원을 공원답게 한다) — 들어갈 자리를 전부 훑어 하나 고르고 첫 무리의 중심으로 삼는다.
    const bigTree = pool.find((id) => (kit(id)?.width ?? 1) >= 2 && (kit(id)?.height ?? 1) >= 4);
    if (bigTree && capOk(bigTree)) {
      const k = kit(bigTree)!;
      const spots2: { x: number; y: number }[] = [];
      for (let base = py + k.height; base < Y1; base += 1) for (let x = px + 1; x + k.width - 1 < X1; x += 1) if (fits(bigTree, x, base)) spots2.push({ x, y: base });
      const s0 = spots2.length ? pick(rng, spots2) : null;
      if (s0 && plantTree(bigTree, s0.x, s0.y)) {
        trees.push({ x0: s0.x, x1: s0.x + k.width - 1, top: s0.y - k.height + 1, base: s0.y });
        const near = centers.reduce((bi, c, i) => (Math.abs(c.x - s0.x) + Math.abs(c.y - s0.y) < Math.abs(centers[bi]!.x - s0.x) + Math.abs(centers[bi]!.y - s0.y) ? i : bi), 0);
        if (centers.length) centers[near] = { x: s0.x, y: s0.y };
      }
    }
    centers.forEach((c) => {
      const lead = pickTree(pool, (id) => kit(id)!.width <= pw - 2);
      if (!lead) return;
      const members = int(rng, 2, 3);
      let planted = 0;
      for (let tries = 0; planted < members && tries < 60; tries += 1) {
        // 큰 나무가 안 들어가면 작은 수종으로 — 좁은 쌈지 공원에도 무리가 선다.
        const id = tries > 30 ? pickTree(pool, (t) => (kit(t)?.height ?? 9) <= 2) ?? lead : planted === 0 || rng() < 0.55 ? lead : pickTree(pool) ?? lead;
        const x = c.x + int(rng, -3, 3), base = c.y + int(rng, -2, 2);
        if (!fits(id, x, base) || !plantTree(id, x, base)) continue;
        const k = kit(id)!;
        trees.push({ x0: x, x1: x + k.width - 1, top: base - k.height + 1, base });
        planted += 1;
        // 하층: 밑동 옆에 덤불·꽃·긴 풀 한두 개(DEFECTS r2-7).
        for (let u = 0, un = rng() < 0.5 ? 1 : 0; u < un; u += 1) {
          const ux = rng() < 0.5 ? x - 1 : x + k.width, uy = base + int(rng, 0, 1);
          if (ux <= px || ux >= X1 || uy >= Y1 || isPath(ux, uy)) continue;
          const r = rng();
          if (r < 0.4) place(recipe.objects.bushes[0]!, ux, uy); else if (r < 0.7) place(pick(rng, recipe.objects.flowerBeds), ux, uy); else shrub(ux, uy);
        }
      }
    });
    // 큰 공원: 벤치 없는 산책로 한 곳에 화단 줄 3~5칸.
    if (big) {
      const runs = [...pathCells].map((c) => ({ x: c % W, y: Math.floor(c / W) })).filter((p) => inside(p.x, p.y + 1) && !isPath(p.x, p.y + 1)).sort(() => rng() - 0.5);
      const r0 = runs[0];
      if (r0) { const bed = pick(rng, recipe.objects.flowerBeds); for (let i = 0, n = int(rng, 3, 5); i < n; i += 1) if (isPath(r0.x + i, r0.y) && inside(r0.x + i, r0.y + 1)) place(bed, r0.x + i, r0.y + 1); }
    }
    // 큰 공원: 빈 잔디에 피크닉 탁자 하나.
    if (big && decor?.picnic && kit(decor.picnic)) {
      for (let tries = 0; tries < 80; tries += 1) {
        const x = int(drng, px + 2, X1 - 3), base = int(drng, py + 3, Y1 - 2);
        if (clearRect(x, base - 1, 2, 2, 0) && ![0, 1].some((i) => isPath(x + i, base + 1)) && place(decor.picnic, x, base)) break;
      }
    }
    lots.push({ kind: "park", x: px, y: py, w: pw, h: ph });
  }

  // ── 6. 거리 물체: 가로등은 모퉁이 가까이 + 불규칙 간격(7~12, ±지터), 가게 앞 소품은 문 옆 무리 ──
  // 가로등 팔은 차도 쪽: 가로 거리 북쪽 보도는 한 종류(lamp), 남쪽 보도는 거울(lampAlt) — 한 거리 안에서 섞지 않는다.
  // 세로 골목길은 서쪽 보도 lamp(팔 오른쪽 = 차도), 동쪽 보도 lampAlt(팔 왼쪽 = 차도)(DEFECTS r1-4).
  const curb = frontY + 2;
  const northLamp = recipe.objects.lamp;
  const southLamp = recipe.objects.lampAlt ?? recipe.objects.lamp;
  const blocked = (x: number) => inCorridorAt(x, curb) || doorCols.has(x) || doorCols.has(x - 1) || doorCols.has(x + 1);
  const lampCols = new Set<number>();
  const lampRow = (row: number, id: string, avoid: (x: number) => boolean) => {
    const cols: number[] = [];
    // 모퉁이(세로 길 복도 양옆)에 먼저 하나씩, 그다음 사이를 불규칙 간격으로.
    for (const c of corridors) if (inCorridorAt(c.x, row) || c.y0 <= row && c.y1 > row) cols.push(c.x - 1 - int(rng, 0, 1), c.x + 9 + int(rng, 0, 1));
    const sorted = [0, ...cols.filter((cx) => cx >= 0 && cx < W).sort((p, q) => p - q), W];
    for (let i = 0; i + 1 < sorted.length; i += 1) {
      const gap = sorted[i + 1]! - sorted[i]!;
      if (gap < 14) continue;
      const n = Math.floor(gap / int(rng, 8, 12));
      for (let k = 1; k <= n; k += 1) cols.push(sorted[i]! + Math.round((gap * k) / (n + 1)) + int(rng, -2, 2));
    }
    for (let lx of cols) {
      let tries = 0;
      while (tries < 3 && (lx < 0 || lx >= W || avoid(lx))) { lx += 1; tries += 1; }
      if (lx >= 0 && lx < W && !avoid(lx) && place(id, lx, row)) lampCols.add(lx);
    }
  };
  lampRow(curb, northLamp, blocked);
  if (south2) lampRow(south2.frontY, northLamp, (x) => !south2Segments.some((g) => x >= g.x && x < g.x + g.w) || lots.some((l) => l.door && l.door.y === south2!.frontY - 1 && Math.abs(l.door.x - x) <= 1));
  // 가게 앞: 문 옆(문 칸 제외 ±1~2)에 1~3개 무리 — 벤치·쓰레기통·화단·화분 나무·광고탑·자판기. 가게 절반쯤은 비운다.
  const o = recipe.objects;
  const clusterPool = [o.trash, o.bench, ...o.flowerBeds.slice(0, 2), o.planterTree, ...(o.streetProps ?? []).slice(0, 1), ...o.vending.slice(0, 2)];
  for (const lot of lots) {
    if ((lot.kind !== "shop" && lot.kind !== "office") || !lot.door || rng() < 0.4) continue;
    const side = rng() < 0.5 ? -1 : 1;
    let cx = lot.door.x + side * int(rng, 2, 3);
    const n = int(rng, 1, 3);
    for (let i = 0; i < n; i += 1, cx += side) {
      if (cx < lot.x - 1 || cx > lot.x + lot.w || doorCols.has(cx) || lampCols.has(cx) || lots.some((l) => l.door && l.door.x === cx && l.door.y === lot.door!.y)) continue;
      const id = pick(rng, clusterPool);
      const vend = o.vending.includes(id);
      // 자판기·쓰레기통은 벽에 붙이고(보도 첫 줄), 화단·화분 나무·광고탑은 연석 쪽(보도 셋째 줄).
      const wallRow = lot.door.y + 1;
      const curbRow = lot.door.y === frontY - 1 ? curb : wallRow; // 둘째 상가 줄은 보도 1줄
      place(id, cx, vend || id === o.trash || id === o.bench ? wallRow : curbRow);
    }
  }
  // 노점·키오스크: 길 전체에 한두 곳만, 모퉁이 가까이.
  const carts = (o.streetProps ?? []).slice(1);
  if (carts.length) for (let n = 0, tries = 0; n < (W >= 70 ? 2 : 1) && tries < 20; tries += 1) {
    const c = corridors.length ? pick(rng, corridors) : null;
    const id = pick(rng, carts);
    const pw = kit(id)?.width ?? 2;
    const px = c ? (rng() < 0.5 ? c.x - pw - int(rng, 1, 3) : c.x + 10 + int(rng, 0, 2)) : int(rng, 2, W - pw - 2);
    if ([...Array(pw).keys()].some((i) => doorCols.has(px + i) || lampCols.has(px + i) || inCorridorAt(px + i, frontY + 1) || nearDoor(px + i, frontY) || nearDoor(px + i, frontY + 1))) continue;
    if (place(id, px, frontY + 1)) n += 1;
  }
  for (const c of corridors) {
    const hx = c.x - 2 - int(rng, 0, 1);
    if (c.y0 === 0 && !doorCols.has(hx)) place(o.hydrant, hx, frontY);
    if (c.y1 === H) place(o.hydrant, c.x + 10 + int(rng, 0, 1), southWalkY + 1);
    // 세로 골목길 보도 가로등: 서쪽은 팔이 오른쪽(lamp), 동쪽은 팔이 왼쪽(lampAlt). 가로 차도 줄은 비운다.
    for (const [lx, id] of [[c.x, northLamp], [c.x + (c.y0 < southLawnY && c.y1 <= southLawnY ? 8 : 8), southLamp]] as const) {
      let r = Math.max(c.y0, frontY + 4) + int(rng, 2, 4);
      while (r < c.y1) {
        const clear = [r - 2, r - 1, r, r + 1].every((rr) => !roadRows.has(rr) && rr !== southLawnY && rr !== southWalkY + 1);
        if (clear && place(id, lx, r)) r += int(rng, 7, 11); else r += 1;
      }
    }
  }
  // 큰길 남쪽: 잔디 띠에 가로수, 보도 바깥 줄에 가로등(북쪽과 엇갈리게).
  // 가로수는 거리마다 한 수종(실제 가로수 식재처럼) — 거리끼리는 다르게 고른다.
  // 가로수: 블록(세로 길 사이 구간)마다 가장 덜 쓴 수종, 간격 3~7칸 지터, 모퉁이·진입로·입구 앞에서 끊고 가끔 한 그루 거른다(DEFECTS r2-3·4).
  const streetPool = [...new Set([...(recipe.objects.streetTrees ?? [recipe.objects.streetTree]), ...recipe.objects.yardTrees.filter((id) => (kit(id)?.height ?? 9) <= 2)])];
  const leastUsed = (list: readonly string[]) => {
    const ok = list.filter((id) => kit(id));
    const min = Math.min(...ok.map((id) => treeCount.get(id) ?? 0));
    return pick(grng, ok.filter((id) => (treeCount.get(id) ?? 0) === min));
  };
  const streetRow = (row: number, list: readonly string[], skip: (x: number) => boolean) => {
    const pool = list.filter((id) => kit(id));
    for (const seg of splitSegments(corridors.filter((c) => c.y0 <= row && c.y1 > row))) {
      const species = leastUsed(pool);
      for (let tx = seg.x + int(grng, 1, 4); tx < seg.x + seg.w; ) {
        const blockedAt = (x: number, w: number) => x + w > seg.x + seg.w - 1 || [...Array(w + 2).keys()].some((i) => skip(x - 1 + i));
        // 막힌 자리(입구·진입로 앞)는 한두 칸 밀어 본다 — 그래도 막히면 그 자리는 비운다.
        const at = [tx, tx + 1, tx + 2].find((x) => !blockedAt(x, 1));
        let w = 1;
        if (at !== undefined && grng() > 0.1) {
          // 이 거리 수종 먼저, 45% 상한에 걸리면 다른 수종, 캐노피가 마당 물체·벽에 걸리면 키 낮은 수종으로.
          const share = (t: string) => (treeCount.get(t) ?? 0) / Math.max(1, treeTotal);
          const order = [species, ...pool.filter((t) => t !== species).sort((p, q) => share(p) - share(q))];
          const ranked = [...order.filter(capOk), ...order.filter((t) => !capOk(t))];
          const hit = ranked.find((t) => !blockedAt(at, kit(t)!.width) && plantTree(t, at, row));
          if (hit) w = kit(hit)!.width;
        }
        tx = (at ?? tx) + w + int(grng, 2, 6);
      }
    }
  };
  streetRow(southLawnY, streetPool, () => false);
  // 버스 정류장: 큰길 남쪽 보도 한 곳, 교차로에서 조금 떨어진 곳.
  if (recipe.objects.busStop) {
    const bw = kit(recipe.objects.busStop)?.width ?? 3;
    for (let tries = 0; tries < 12; tries += 1) {
      const bx = int(rng, 1, Math.max(1, W - bw - 1));
      if ([...Array(bw).keys()].some((i) => inCorridor(bx + i) || inCorridor(bx + i - 2) || inCorridor(bx + i + 2))) continue;
      if (place(recipe.objects.busStop, bx, southWalkY + 1)) break;
    }
  }
  lampRow(southWalkY + 1, southLamp, (x) => inCorridor(x));
  if (south2) {
    streetRow(south2.frontY + 1, streetPool, (tx) => lots.some((l) => l.door && l.door.y === south2!.frontY - 1 && l.door.x === tx) || lampCols.has(tx));
  }
  for (const band of bands) {
    if (band.roadY === null) continue;
    // 주택가 잔디 띠: 공원 입구·현관길 앞은 비운다.
    const gateCols = new Set<number>();
    for (let x = 0; x < W; x += 1) if (tileset.tileMeta?.[map.lowerTiles[(band.walkY - 1) * W + x] ?? -1]?.label === recipe.path) gateCols.add(x);
    // 캐노피가 앞마당 안에서 끝나는 키만(보도 1줄 + 마당 front 줄) — 얕은 마당엔 미루나무 대신 원뿔·작은 둥근 나무.
    const tall = streetPool.filter((id) => (kit(id)?.height ?? 9) <= band.front + 2);
    // 앞마당 나무 바로 아래 열은 비운다 — 마당 나무와 가로수가 위아래로 붙어 기둥이 되지 않게(DEFECTS r2-2).
    const yardTreeCol = (tx: number) => { const u = map.upperTiles[(band.walkY - 1) * W + tx] ?? -1; return u >= 0 && treeCells.has(u); };
    streetRow(band.lawnY, tall.length ? tall : streetPool, (tx) => drivewayCols.has(tx) || gateCols.has(tx) || yardTreeCol(tx));
  }
  // 로컬 도로 양쪽 연석에 빗물받이(8~12칸마다, 교차로 제외).
  const drain = kit("drain_horizontal") ? "drain_horizontal" : null;
  if (drain) for (const band of bands) {
    if (band.roadY === null) continue;
    for (const [ry, off] of [[band.roadY, int(rng, 2, 6)], [Math.min(H - 1, band.roadY + 4), int(rng, 6, 10)]] as const) {
      for (let dx = off; dx < W; dx += int(rng, 8, 12)) if (!inCorridor(dx)) place(drain, dx, ry);
    }
  }

  // ── 7. 차선: 큰길 가운데 점선(교차로 제외), 교차로로 들어가는 차로에 화살표(우측통행) ──
  const nearCross = (x: number) => corridors.some((c) => through(c) && x >= c.x + 1 && x <= c.x + 7);
  const laneY = mainY + Math.floor(mainH / 2);
  for (let lx = 0; lx < W; lx += 2) if (!nearCross(lx)) place(recipe.objects.laneHorizontal, lx, laneY, { force: true });
  for (const c of corridors) {
    if (!through(c)) continue;
    place(recipe.objects.arrowRight, c.x - 3, mainY + mainH - 2, { force: true });
    place(recipe.objects.arrowLeft, c.x + 11, mainY + 1, { force: true });
  }

  // ── 7b. 자동차: 가게 뒤 주차 칸(세로 차), 주택가 로컬 도로 연석 쪽 길가 주차·큰길 차선(가로 차, 오른쪽 통행) ──
  // 차는 차도·주차장 안에만 둔다 — 세 줄 모두 같은 차도 띠 안, 교차로·횡단보도·진입로 앞 열에서 1칸 떼고,
  // 차선·화살표·빗물받이 같은 기존 물체와 겹치면 place 가 건너뛴다.
  const carsV = recipe.objects.carsVertical ?? [];
  const carsH = recipe.objects.carsHorizontal ?? [];
  /** x..x+w-1 열이 row 행에서 세로 골목길 복도(교차로·옆 보도)에서 1칸 이상 떨어졌나. */
  const clearOfCross = (x: number, w: number, row: number) => [...Array(w + 2).keys()].every((i) => !inCorridorAt(x - 1 + i, row));
  if (carsV.length) {
    // 가게 사이 통로(rear-lot, 폭 2~3, 골목 포장): 세로 차 한 대를 앞코가 보도에 닿게 세운다(작가 맵의 건물 사이 주차).
    // 뒷마당은 옥상이 깊이를 채워 0~2줄뿐이라 3칸 길이 차가 들어가지 않는다.
    for (const lot of lots) {
      if (lot.kind !== "rear-lot" || lot.y === 0 || lot.w < 2 || rng() < 0.2) continue;
      const [down, up] = pick(rng, carsV);
      place(rng() < 0.6 ? up : down, lot.x + (lot.w > 2 ? int(rng, 0, lot.w - 2) : 0), frontY - 1);
    }
    // 세로 골목길(차도 5칸 c+2~c+6) 연석 쪽 길가 주차: 오른쪽 통행 — 서쪽 차선(c+2) 은 남쪽으로(_down), 동쪽 차선(c+5) 은 북쪽으로(_up).
    // 가로 차도·교차로 줄과 그 위아래 1줄(횡단보도 자리)은 비운다.
    const nearCrossRow = (r: number) => roadRows.has(r) || roadRows.has(r - 1) || roadRows.has(r + 1);
    for (const c of corridors) {
      for (const [lane, dirIndex] of [[c.x + 2, 0], [c.x + 5, 1]] as const) {
        for (let top = Math.max(c.y0, frontY) + int(rng, 1, 3); top + 3 <= c.y1; top += 1) {
          if ([0, 1, 2].some((dy) => nearCrossRow(top + dy))) continue;
          if (rng() < 0.5) { top += 2; continue; }
          if (place(pick(rng, carsV)[dirIndex], lane, top + 2)) top += 2 + int(rng, 3, 8);
        }
      }
    }
  }
  if (carsH.length) {
    // 로컬 도로 5줄: 북쪽 차선(서쪽으로, _left)은 roadY~+2, 남쪽 차선(동쪽으로, _right)은 +2~+4 — 연석에 붙여 세운다.
    // 북쪽 연석은 진입로 앞 열을 피한다. 같은 열에 양쪽이 겹치지 않게 한 열에는 한 쪽만.
    for (const band of bands) {
      if (band.roadY === null || band.roadY + 5 > H) continue;
      const taken = new Set<number>();
      for (let cx = int(rng, 2, 8); cx + 4 <= W; cx += int(rng, 6, 12)) {
        const north = rng() < 0.4;
        const baseY = north ? band.roadY + 2 : band.roadY + 4;
        if (!clearOfCross(cx, 4, band.roadY)) continue;
        if (north && [...Array(6).keys()].some((i) => drivewayCols.has(cx - 1 + i))) continue;
        if ([...Array(4).keys()].some((i) => taken.has(cx + i))) continue;
        const [left, right] = pick(rng, carsH);
        if (place(north ? left : right, cx, baseY)) for (let i = 0; i < 4; i += 1) taken.add(cx + i);
      }
    }
    // 큰길 7줄일 때만 1~2대: 북쪽 차로(mainY~+2, _left) · 남쪽 차로(+4~+6, _right). 5줄 큰길은 차가 중앙선을 덮는다.
    if (mainH === 7) {
      const want = int(rng, 1, 2);
      for (let n = 0, tries = 0; n < want && tries < 20; tries += 1) {
        const cx = int(rng, 1, W - 5);
        const north = n === 0 ? rng() < 0.5 : rng() < 0.5;
        if (!clearOfCross(cx - 1, 6, mainY)) continue;
        const [left, right] = pick(rng, carsH);
        if (place(north ? left : right, cx, north ? mainY + 2 : mainY + 6)) n += 1;
      }
    } else if (mainH === 5) {
      // 5줄 큰길: 남쪽 차로(_right) 한 대만. 맨 윗줄(지붕 끝 조각)이 중앙선 줄에 걸려 점선을 덮는다 — 나머지 두 줄은 비어 있어야 한다.
      for (let tries = 0; tries < 20; tries += 1) {
        const cx = int(rng, 1, W - 5);
        if (!clearOfCross(cx - 1, 6, mainY)) continue;
        const id = pick(rng, carsH)[1];
        const k = kit(id);
        if (!k) break;
        const body = [...Array(4).keys()].flatMap((dx) => [(laneY + 1) * W + cx + dx, (laneY + 2) * W + cx + dx]);
        if (body.some((cell) => used.has(cell))) continue;
        if (place(id, cx, laneY + 2, { force: true })) break;
      }
    }
  }

  if (decor) decorate(decor);

  // ── 8. 빈 바닥 메우기: check_town_map 과 같은 셈(위층이 빈 같은 재료 칸의 4방향 덩어리)으로 큰 빈 잔디·빈 골목을 찾아,
  // 덩어리에서 가장 빈 칸(둘레에서 먼 칸)부터 물체로 끊는다. 잔디는 구역에 맞는 나무·덤불·화단·벤치, 골목은 분리수거함·상자·쓰레기통.
  // 물체가 덩어리 안에 통째로 들어갈 때만 둔다 — 산책로·현관길·진입로·울타리는 건드리지 않는다.
  // 물체 없이 이어지는 칸 상한: 잔디·마당 30(6×6 기준 아래), 뒷골목 12(2줄 골목이면 6칸마다 한 무더기).
  const greens = new Set([recipe.lawn, parkLawn, recipe.meadow, recipe.worn].filter((m): m is string => !!m));
  const fillMax = (material: string) => (material === recipe.alley ? 12 : greens.has(material) ? 30 : 28);
  const labelAt = (i: number) => tileset.tileMeta?.[map.lowerTiles[i] ?? -1]?.label ?? "";
  const footprint = (id: string, x: number, baseY: number): number[] | null => {
    const k = kit(id);
    if (!k) return null;
    const top = baseY - k.height + 1;
    if (x < 0 || top < 0 || x + k.width > W || baseY >= H) return null;
    const cells: number[] = [];
    k.rows.forEach((row, dy) => row.upperTiles?.forEach((tile, dx) => { if (tile >= 0) cells.push((top + dy) * W + x + dx); }));
    return cells;
  };
  const fillPool = (material: string, x: number, y: number): string[] => {
    const o = recipe.objects;
    // 골목: 상자·가득 찬 쓰레기통 한 개 — 분리수거함 줄이 되지 않게(DEFECTS r1-5).
    if (material === recipe.alley) return [o.trash, "cardboard_box", ...o.backProps.filter((id) => !id.startsWith("recycle")), ...(decor?.service ?? []).filter((id) => (kit(id)?.width ?? 9) === 1)].filter((id) => kit(id));
    if (!greens.has(material)) return [o.trash, o.bench, ...o.flowerBeds]; // 보도·산책로
    if (lots.some((l) => l.kind === "park" && x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h)) return [...o.flowerBeds, o.bench, ...o.bushes.slice(0, 1)];
    // 마당: 줄 맞춘 생울타리·화단(무작위 나무 흩뿌리기 대신, DEFECTS r1-2).
    return [...(o.hedge ? [o.hedge, o.hedge] : []), ...o.flowerBeds, o.bushes[0]!];
  };
  const doorFront = new Set(lots.flatMap((l) => (l.door ? [(l.door.y + 1) * W + l.door.x] : [])));
  for (const material of [...greens, recipe.alley, recipe.sidewalk, recipe.path]) {
    const stuck = new Set<number>(); // 문 앞 칸은 덩어리 셈에 넣고(check_town_map 과 같게) 물체만 두지 않는다
    for (let iter = 0; iter < 400; iter += 1) {
      const plain = (i: number) => (map.upperTiles[i] ?? -1) < 0 && !stuck.has(i) && labelAt(i) === material;
      const seen = new Uint8Array(W * H);
      let blob: number[] = [];
      for (let start = 0; start < W * H; start += 1) {
        if (seen[start] || !plain(start)) continue;
        const cells = [start];
        seen[start] = 1;
        for (let k = 0; k < cells.length; k += 1) {
          const i = cells[k]!;
          const cx = i % W, cy = Math.floor(i / W);
          for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = ny * W + nx;
            if (!seen[j] && plain(j)) { seen[j] = 1; cells.push(j); }
          }
        }
        if (cells.length > blob.length) blob = cells;
      }
      if (blob.length <= fillMax(material)) break;
      const inBlob = new Set(blob);
      const alleyPass = material === recipe.alley;
      // 잔디: 둘레(덩어리 밖 칸과 맞닿은 칸)에서 먼 칸 = 마당 한가운데.
      // 골목: 좌우로 끝나는 곳·이미 둔 물체에서 먼 칸 = 빈 구간 한가운데(좌우 2줄 골목은 위아래 둘레가 늘 맞닿는다).
      const dist = new Map<number, number>();
      const queue: number[] = [];
      const outside = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < W && ny < H && !inBlob.has(ny * W + nx);
      const occupied = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < W && ny < H && (map.upperTiles[ny * W + nx] ?? -1) >= 0;
      for (const i of blob) {
        const cx = i % W, cy = Math.floor(i / W);
        const around = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const;
        const edge = alleyPass
          ? outside(cx + 1, cy) || outside(cx - 1, cy) || around.some(([nx, ny]) => occupied(nx, ny))
          : around.some(([nx, ny]) => outside(nx, ny));
        if (edge) { dist.set(i, 0); queue.push(i); }
      }
      if (!queue.length) { dist.set(blob[0]!, 0); queue.push(blob[0]!); }
      for (let k = 0; k < queue.length; k += 1) {
        const i = queue[k]!;
        const cx = i % W, cy = Math.floor(i / W);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
          const j = ny * W + nx;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || !inBlob.has(j) || dist.has(j)) continue;
          dist.set(j, dist.get(i)! + 1);
          queue.push(j);
        }
      }
      // 골목 물건은 차가 지나는 가운데가 아니라 건물 뒷면·울타리에 붙인다(위아래가 골목이 아닌 칸 우선).
      const against = (i: number) => { const cx = i % W, cy = Math.floor(i / W); return outside(cx, cy - 1) || outside(cx, cy + 1) ? 0.5 : 0; };
      const ranked = blob.map((i) => ({ i, key: (dist.get(i) ?? 0) + (alleyPass ? against(i) : 0) + rng() * 0.4 })).sort((a, b) => b.key - a.key).slice(0, 24);
      let placed = false;
      for (const { i } of ranked) {
        const cx = i % W, cy = Math.floor(i / W);
        const pool = fillPool(material, cx, cy);
        for (let tries = 0; tries < 6 && !placed; tries += 1) {
          const id = pick(rng, pool);
          const px = cx - Math.floor(((kit(id)?.width ?? 1) - 1) / 2);
          const cells = footprint(id, px, cy);
          if (cells?.length && cells.every((cell) => inBlob.has(cell) && !doorFront.has(cell))) placed = place(id, px, cy);
        }
        if (placed) break;
      }
      if (!placed) blob.forEach((i) => stuck.add(i)); // 넣을 물체가 없는 덩어리 — 건너뛴다
    }
  }
  return { lots, roads, seed };

  // ── 7c. 꾸밈: 실제 거리 규칙대로 — 가게 앞 카페·자판기·ATM·노점, 교차로 신호등·정지 표지·점자블록·맨홀,
  // 옥상 설비·헬기장, 앞마당 변주, 가로수 공백, 차도 표시, 뒷골목 얼룩(DEFECTS r3). 모두 place() 로 빈 칸에만 선다.
  function decorate(dc: NonNullable<MvTownRecipe["decor"]>): void {
    const has = (id: string | undefined): id is string => !!id && !!kit(id);
    const lowerLabel = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? "" : tileset.tileMeta?.[map.lowerTiles[y * W + x] ?? -1]?.label ?? "");
    const freeCell = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !used.has(y * W + x) && (map.upperTiles[y * W + x] ?? -1) < 0;
    const doorFrontCells = new Set(lots.flatMap((l) => (l.door ? [(l.door.y + 1) * W + l.door.x] : [])));
    const walkable = (x: number, y: number) => { const l = lowerLabel(x, y); return l === recipe.sidewalk || dc.walkways.includes(l) || dc.cobbles.includes(l) || !!dc.terraces?.includes(l); };
    const overlay = (name: string | undefined, x: number, y: number) => {
      if (!name || !freeCell(x, y) || doorFrontCells.has(y * W + x)) return false;
      paint(name, x, y, 1, 1);
      used.add(y * W + x);
      return true;
    };
    /** 물체 밑칸이 모두 보도이고 문 앞·가로등 열이 아닌가. */
    const onWalk = (id: string, x: number, base: number) => {
      const k = kit(id);
      if (!k) return false;
      for (let dy = 0; dy < k.height; dy += 1) for (let dx = 0; dx < k.width; dx += 1) {
        const cx = x + dx, cy = base - k.height + 1 + dy;
        if (!walkable(cx, cy) || doorFrontCells.has(cy * W + cx) || nearDoor(cx, cy) || doorCols.has(cx) && cy === frontY) return false;
      }
      return true;
    };
    const putWalk = (id: string, x: number, base: number) => onWalk(id, x, base) && place(id, x, base);

    // H2 가게 앞 보도(frontY 줄 = 벽 쪽, +1 가운데, +2 연석). 카페는 가게의 20~30%, 문 옆 한 칸 떼고 벽에 붙여 2×2.
    const shopsFront = lots.filter((l) => (l.kind === "shop" || l.kind === "office") && l.door && l.door.y === frontY - 1);
    const cafes = shopsFront.filter((l) => l.kind === "shop" && l.w >= 4).sort(() => drng() - 0.5).slice(0, Math.max(2, Math.round(shopsFront.length * 0.3)));
    // 가게 앞 보도 재료: 가게 몇 곳 앞 벽 쪽 두 줄을 벽돌·타일 포장으로(연석 줄은 회색 콘크리트 그대로).
    // 카페 앞은 타일·조약돌 테라스(붉은·베이지 타일, 조약돌) — 테라스 영역이 바닥에서 읽힌다.
    const terrace = [...dc.cobbles, ...(dc.terraces ?? [])];
    for (const lot of shopsFront) {
      const cafe = cafes.includes(lot);
      if (!cafe && (drng() > 0.4 || !dc.walkways.length)) continue;
      const mat = cafe && terrace.length ? pick(drng, terrace) : pick(drng, dc.walkways);
      for (let x = lot.x; x < lot.x + lot.w; x += 1) for (const y of [frontY, frontY + 1]) if (lowerLabel(x, y) === recipe.sidewalk) paint(mat, x, y, 1, 1);
    }
    for (const lot of cafes) {
      const tables = dc.cafeTables.filter(has).sort(() => drng() - 0.5);
      if (!tables.length) break;
      // 테라스 하나에 탁자 1~2개(넓은 가게), 문 옆 한 칸 떼고.
      let n = 0;
      for (const tx of [lot.door!.x + 2, lot.door!.x - 3, lot.door!.x + 4, lot.door!.x - 5, lot.x, lot.x + lot.w - 2]) if (n < (lot.w >= 6 ? 2 : 1) && putWalk(tables[n % tables.length]!, tx, frontY + 1)) n += 1;
    }
    // 자판기 세 종류는 꼭 한 번씩(벽에 붙여), ATM 은 사무실(은행) 문 옆.
    const vends = dc.vending.filter(has);
    const wallSpots = shopsFront.flatMap((l) => [l.door!.x - 2, l.door!.x + 2, l.x, l.x + l.w - 1].map((x) => ({ x, lot: l }))).sort(() => drng() - 0.5);
    for (const id of vends) for (const s of wallSpots) if (putWalk(id, s.x, frontY + 1)) break;
    // ATM: 사무실 벽 여러 자리 중 하나(문 앞 통로 밖, DEFECTS r4-3·12).
    if (has(dc.atm)) for (const lot of shopsFront.filter((l) => l.kind === "office")) for (const ax of [lot.door!.x - 2, lot.door!.x + 2, lot.x, lot.x + lot.w - 1].sort(() => drng() - 0.5)) if (putWalk(dc.atm, ax, frontY + 1)) break;
    // 노점·키오스크: 세로 길 모통이 가까이(모통이 보도에서 1~4칸).
    const carts = dc.carts.filter(has);
    for (const c of corridors.filter((cc) => cc.y0 === 0)) {
      const id = pick(drng, carts);
      if (!id) break;
      const k = kit(id)!;
      for (const cx of [c.x - k.width - 1, c.x + 9 + 1, c.x - k.width - 3, c.x + 9 + 3]) if (putWalk(id, cx, frontY + 2)) break;
    }
    // 빈 보도 구간 끊기: 보도 각 줄에서 물체 없는 8칸 이상은 가운데에 물체 하나(벽 줄 = 자판기·쓰레기통·화분, 연석 줄 = 화분 나무·벤치·화단).
    const wallPool = [...vends, o.trash, ...dc.planterTrees, ...o.flowerBeds.slice(0, 2)].filter(has);
    const curbPool = [...dc.planterTrees, o.bench, ...o.flowerBeds, "bollard", o.trash].filter(has);
    const walkRows = [frontY, frontY + 1, frontY + 2, southWalkY, southWalkY + 1, ...(south2 ? [south2.frontY] : [])];
    for (let pass = 0; pass < 3; pass += 1) for (const row of walkRows) {
      let run = 0;
      for (let x = 0; x <= W; x += 1) {
        const empty = x < W && walkable(x, row) && (map.upperTiles[row * W + x] ?? -1) < 0 && [row - 1, row + 1].every((r) => r < 0 || r >= H || !walkable(x, r) || (map.upperTiles[r * W + x] ?? -1) < 0);
        if (empty) { run += 1; continue; }
        if (run >= 8) {
          const mid = x - Math.ceil(run / 2);
          const pool = row === frontY || row === southWalkY + 1 ? wallPool : curbPool;
          for (let tries = 0; tries < 8; tries += 1) {
            const id = pick(drng, pool);
            const k = kit(id)!;
            const bx = mid + int(drng, -2, 2);
            const base = k.height >= 2 && row === frontY ? frontY + 1 : row;
            if (putWalk(id, bx, base)) break;
          }
        }
        run = 0;
      }
    }

    // H3 교차로: 네거리는 네 모통이 신호등, T·주택가 교차로는 부도로 진입 쪽 정지 표지(우측통행: 운전자 오른쪽).
    // 모통이 옆 보도 두 칸에 점자 블록, 교차로 가운데 맨홀.
    const lights = dc.trafficLights.filter(has);
    const corner = (id: string | undefined, x: number, y: number, dx: number, dy: number) => {
      // (x,y) = 대각 모통이 칸. 못 쓰면 보도 쪽으로 한두 칸 밀어 본다. 남쪽 모통이는 머리(윗칸)가 차도에 걸리지 않게 한 줄 더 남쪽에 세운다.
      const headClear = (cx: number, cy: number) => { const k = id ? kit(id) : undefined; if (!k) return false; for (let r = cy - k.height + 1; r <= cy; r += 1) if (r < 1 || [recipe.road, recipe.intersection].includes(lowerLabel(cx, r))) return false; return true; };
      // 밑칸은 보도여야 한다 — 큰길 남쪽 잔디 띠 위에 선 신호등·정지 표지(DEFECTS r4-1·11).
      if (id) for (const [ox, oy] of [[0, 0], [0, dy], [dx, 0], [dx, dy], [dx * 2, 0], [0, dy * 2], [dx, dy * 2]] as const) { const cx = x + ox, cy = y + oy; if (cx >= 0 && cx < W && cy >= 1 && cy < H && walkable(cx, cy) && !doorFrontCells.has(cy * W + cx) && headClear(cx, cy) && place(id, cx, cy)) break; }
      for (const [tx, ty] of [[x + dx, y], [x, y + dy]] as const) if (walkable(tx, ty)) overlay(dc.tactile, tx, ty);
    };
    const cross = (ix: number, iy: number, h: number, kind: "light" | "stopN" | "stopS" | "stopBoth") => {
      type Corner = readonly [number, number, number, number];
      const NW: Corner = [ix - 1, iy - 1, -1, -1], NE: Corner = [ix + 5, iy - 1, 1, -1], SW: Corner = [ix - 1, iy + h, -1, 1], SE: Corner = [ix + 5, iy + h, 1, 1];
      if (kind === "light") {
        // 축마다 색 짝: 마주 보는 모통이(NW–SE, NE–SW)가 같은 색, 다른 축은 반대 색. 위상은 시드마다(DEFECTS r4-1).
        const [green, red, yellow] = [dc.trafficLights[0], dc.trafficLights[1], dc.trafficLights[2]].map((id) => (has(id) ? id : lights[0]));
        const phases = [[green, red], [red, green], [yellow, red], [red, yellow]] as const;
        const [a, b] = phases[Math.floor(drng() * phases.length)]!;
        corner(a, ...NW); corner(a, ...SE); corner(b, ...NE); corner(b, ...SW);
      }
      else {
        if (kind !== "stopS") corner(dc.stopSign, ...NW);
        if (kind !== "stopN") corner(dc.stopSign, ...SE);
        const rest: Corner[] = kind === "stopN" ? [NE] : kind === "stopS" ? [SW] : [NE, SW];
        for (const c of rest) corner(undefined, ...c);
      }
      const mh = dc.manholes.filter(has);
      if (mh.length) place(pick(drng, mh), ix + int(drng, 1, 3), iy + int(drng, 1, h - 2));
    };
    for (const c of corridors) {
      if (through(c)) cross(c.x + 2, mainY, mainH, "light");
      else if (c.y0 === mainY) cross(c.x + 2, mainY, mainH, "stopS");
      else cross(c.x + 2, mainY, mainH, "stopN");
      if (c.y1 === H) for (const band of bands) if (band.roadY !== null && band.roadY + 5 <= H) cross(c.x + 2, band.roadY, 5, "stopBoth");
    }

    // M8 차도 표시: 로컬 도로·세로 길에 맨홀(12~18칸마다), 세로 길 교차로 앞 화살표(우측통행), 로컬 도로 교차로 앞 화살표.
    const mh = dc.manholes.filter(has);
    for (const band of bands) if (band.roadY !== null && band.roadY + 5 <= H && mh.length) for (let x = int(drng, 3, 9); x < W; x += int(drng, 12, 18)) if (!inCorridor(x)) place(pick(drng, mh), x, band.roadY + int(drng, 1, 3));
    for (let x = int(drng, 4, 10); x < W && mh.length; x += int(drng, 14, 20)) if (!nearCross(x)) place(pick(drng, mh), x, mainY + (drng() < 0.5 ? 1 : mainH - 2));
    for (const c of corridors) {
      if (has(o.arrowDown) && c.y0 === 0) place(o.arrowDown, c.x + 3, mainY - 3);
      if (has(o.arrowUp) && c.y1 > southWalkY + 4) place(o.arrowUp, c.x + 5, southWalkY + 2);
    }
    for (const band of bands) if (band.roadY !== null && band.roadY + 5 <= H) for (const c of corridors.filter((cc) => cc.y1 === H)) {
      place(o.arrowRight, c.x - 3, band.roadY + 3);
      place(o.arrowLeft, c.x + 11, band.roadY + 1);
    }

    // H4 옥상: 가장 높은 사무실에 헬기장(들어갈 때), 그다음 건물마다 다른 설비 1~3가지.
    const pad = dc.helipad && kit(dc.helipad);
    if (pad) {
      const tallest = roofAreas.filter((a) => a.office && a.w >= pad.width).sort((a, b) => b.h - a.h || b.w - a.w)[0];
      if (tallest) {
        const hx = tallest.x + Math.floor((tallest.w - pad.width) / 2), hb = tallest.y + pad.height - 1;
        if (onRoof(dc.helipad!, hx, hb)) place(dc.helipad!, hx, hb, { force: true });
      }
    }
    for (const a of roofAreas) roofKit(dc.roofTop, a.x, a.y, a.w, a.rows, a.n);

    // H6 앞마당: 집마다 마당 장식이 2가지 미만이면 더한다 — 넓은·큰 덤불, 콘크리트 틀 화단, 텃밭(갈아 놓은 밭).
    for (const band of bands) {
      if (band.front < 2) continue;
      for (const lot of lots.filter((l) => l.kind === "house" && l.door && l.door.y === band.frontY - 1)) {
        const y0 = band.frontY, y1 = band.frontY + band.front - 1;
        const x0 = Math.max(0, lot.x - 1), x1 = Math.min(W - 1, lot.x + lot.w);
        const count = () => { let n = 0; for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) if ((map.upperTiles[y * W + x] ?? -1) >= 0) n += 1; return n; };
        const yard = (x: number, y: number) => lowerLabel(x, y) === recipe.lawn && !doorFrontCells.has(y * W + x);
        const r = drng();
        if (dc.plowed && r < 0.3 && lot.w >= 5) {
          // 텃밭: 현관길에서 떨어진 마당 한쪽 3×2(잔디만 있는 칸).
          const door = lot.door!.x;
          const gx = door - lot.x > lot.w / 2 ? lot.x : lot.x + lot.w - 3;
          const cells: [number, number][] = [];
          for (let y = y1 - 1; y <= y1; y += 1) for (let x = gx; x < gx + 3; x += 1) cells.push([x, y]);
          if (cells.every(([x, y]) => yard(x, y) && freeCell(x, y) && Math.abs(x - door) >= 1)) {
            paint(dc.plowed, gx, y1 - 1, 3, 2);
            cells.forEach(([x, y]) => used.add(y * W + x));
          }
        }
        const shrubs = dc.yardShrubs.filter((id) => has(id) && kit(id)!.height <= band.front);
        // 집마다 새 조경 하나(넓은·큰·작은 덤불 또는 틀 화단) — 텃밭이 있는 집도 하나 더.
        let added = 0;
        for (let tries = 0; added < 1 + (count() < 2 ? 1 : 0) && tries < 16; tries += 1) {
          const t = drng();
          if (t < 0.6 && shrubs.length) {
            const id = pick(drng, shrubs), k = kit(id)!;
            const x = int(drng, x0, Math.max(x0, x1 - k.width + 1));
            if ([...Array(k.width).keys()].every((i) => yard(x + i, y1) && Math.abs(x + i - lot.door!.x) >= 1) && place(id, x, y1)) added += 1;
          } else if (dc.planterBed) {
            const x = int(drng, x0, Math.max(x0, x1 - 1));
            if ([x, x + 1].every((cx) => yard(cx, y1) && freeCell(cx, y1) && Math.abs(cx - lot.door!.x) >= 1)) {
              paint(dc.planterBed, x, y1, 2, 1);
              const bed = pick(drng, o.flowerBeds);
              place(bed, x, y1); place(bed, x + 1, y1);
              added += 1;
            }
          }
        }
      }
    }

    // H5 가로수 공백: 잔디 띠에서 나무 없는 8칸 이상은 가운데에 한 그루(진입로·현관길 앞 제외).
    const trees = new Set([...(o.streetTrees ?? [o.streetTree]), ...o.yardTrees, ...(o.parkTrees ?? [])]);
    const treeCol = (x: number, row: number) => { for (let dy = 0; dy < 4; dy += 1) { const u = map.upperTiles[(row - dy) * W + x] ?? -1; if (u >= 0 && treeCells.has(u)) return true; } return false; };
    for (const row of [southLawnY, ...bands.flatMap((b) => (b.roadY !== null ? [b.lawnY] : []))]) {
      let run = 0;
      for (let x = 0; x <= W; x += 1) {
        const open = x < W && lowerLabel(x, row) === recipe.lawn && !treeCol(x, row);
        if (open) { run += 1; continue; }
        if (run >= 8) {
          const pool = [...trees].filter((id) => has(id) && kit(id)!.width === 1 && kit(id)!.height <= 2);
          for (let tries = 0; tries < 6; tries += 1) {
            const tx = x - Math.ceil(run / 2) + int(drng, -2, 2);
            const id = pickTree(pool);
            if (id && !drivewayCols.has(tx) && lowerLabel(tx, row - 1) !== recipe.path && plantTree(id, tx, row)) break;
          }
          if (run >= 14) { const bx = x - Math.ceil(run / 4); if (lowerLabel(bx, row - 1) !== recipe.path) place(o.bushes[0]!, bx, row); }
        }
        run = 0;
      }
    }
    // H5 뒷주차: 주차 칸 줄에 세로 차 몇 대 + 칸 줄 끝에 화분 나무 섬.
    const carsV = o.carsVertical ?? [];
    for (const lot of lots.filter((l) => (l.kind === "shop" || l.kind === "office") && l.door?.y === frontY - 1 && l.y - alley >= 3)) {
      if (carsV.length && drng() < 0.6) place(pick(drng, carsV)[0], lot.x + 1 - (lot.x % 2) + 1, lot.y - 1);
      if (drng() < 0.4) place(pick(drng, dc.planterTrees.filter(has)), lot.x + lot.w - 1, lot.y - 1);
    }

    // 뒷골목 바닥 얼룩·균열 조각(2~3칸) 몇 개.
    for (let i = 0, n = Math.round(W / 12); i < n && dc.stains.length; i += 1) {
      const name = pick(drng, dc.stains);
      const x = int(drng, 0, W - 3), y = int(drng, alleyTop, alley);
      for (let dx = 0; dx < int(drng, 2, 3); dx += 1) if (lowerLabel(x + dx, y) === recipe.alley) overlay(name, x + dx, y);
    }

    // 불 켜진 가로등: 큰길 남쪽 보도는 가로등 대신 불 켜진 2칸 가로등 모델을 한두 개(다른 모델 섞기).
    const lit = (dc.litLamps ?? []).filter(has);
    if (lit.length) for (let n = 0, tries = 0; n < (W >= 70 ? 3 : 2) && tries < 30; tries += 1) {
      const id = pick(drng, lit), k = kit(id)!;
      const x = int(drng, 1, W - k.width - 1);
      if ([...Array(k.width).keys()].every((i) => walkable(x + i, southWalkY + 1) && !inCorridor(x + i) && !doorFrontCells.has((southWalkY + 1) * W + x + i)) && place(id, x, southWalkY + 1)) n += 1;
    }
    // 세로 골목길: 가운데 차선(세로)·연석 쪽 세로 배수구 — 교차로·횡단보도 줄은 비운다.
    for (const c of corridors) {
      for (let r = c.y0; r < c.y1; r += 1) {
        if ([r - 1, r, r + 1].some((rr) => roadRows.has(rr))) continue;
        if (has(dc.laneVertical) && r % 2 === 0) place(dc.laneVertical, c.x + 4, r, { force: false });
        if (has(dc.drainVertical) && r % 9 === 4) place(dc.drainVertical, drng() < 0.5 ? c.x + 2 : c.x + 6, r);
      }
    }
    // 공사 구간 한 곳: 로컬 도로 연석 쪽에 콘 두세 개 + 뒷주차 입구 가드레일.
    const cones = dc.cones.filter(has);
    const band0 = bands.find((b) => b.roadY !== null && b.roadY + 5 <= H);
    if (cones.length && band0) for (let tries = 0; tries < 20; tries += 1) {
      const x = int(drng, 2, W - 5);
      if ([0, 1, 2, 3].some((i) => inCorridor(x + i))) continue;
      if ([0, 1, 2].every((i) => freeCell(x + i * 2, band0.roadY! + 4))) { for (let i = 0; i < 3; i += 1) place(cones[i % cones.length]!, x + i * 2, band0.roadY! + 4); break; }
    }
    if (has(dc.guardrail)) {
      // 골목 끝(맵 왼·오른 가장자리) 짙은 아스팔트 위 가드레일 — 막다른 뒷골목 같은 인상.
      for (const x of [0, W - 2]) if (lowerLabel(x, alley) === recipe.alley && lowerLabel(x + 1, alley) === recipe.alley) place(dc.guardrail, x, alley);
    }
    // 원형 키오스크(3×3)는 폭 4줄 이상 걷는 바닥에만 — 3줄 가게 앞 보도는 통째로 막힌다(DEFECTS r4-3).
    if (has(dc.kiosk)) {
      const k = kit(dc.kiosk)!;
      const wide = (x: number, base: number) => [...Array(k.width).keys()].every((i) => walkable(x + i, base + 1) || walkable(x + i, base - k.height));
      for (const c of corridors) for (const cx of [c.x - 4, c.x + 10, c.x - 6, c.x + 12]) if (wide(cx, frontY + 2) && putWalk(dc.kiosk, cx, frontY + 2)) break;
    }
  }
}
