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
  const lots: TownLot[] = [];
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
  const paintHouseRoof = (name: string, x: number, top: number, w: number, rows: number) => {
    const pair = gablePair(name);
    if (!pair || rows < 2) { paint(name, x, top, w, rows); return; }
    paint(pair.back, x, top, w, 1);
    paint(pair.front, x, top + 1, w, rows - 1);
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

  // ── 1. 가로 띠(행) 나누기 — 가게 깊이·큰길 폭(= 큰길 줄)은 시드가 고른다 ──
  // 주택가 한 단위(북→남): 뒤 생울타리 2 · 건물 6(박공 3 + 벽 3) · 앞마당 3 · 보도 1 · 잔디 1 · 로컬 차도 5 = 18줄(작은 맵은 뒤 1·앞 2 = 16줄).
  // 작가 도시(p3·p5)는 화면의 절반이 건물이다 — 마당을 얕게, 남는 줄은 맵 밖으로 이어지는 건물 뒷면(옥상)으로 채운다(DEFECTS r1-1).
  let alley = H >= 48 ? 3 : 2;
  let bMax = H >= 48 ? int(rng, 7, 8) : 7;
  const mainH = rng() < 0.5 ? 5 : 7; // 큰길 차도 줄 수(작가 예시는 4~5줄, 7줄은 넓은 간선)
  const fixedTop = () => alley + bMax + 3 + mainH + 1 + 2; // 골목 + 가게 + 보도3 + 큰길 + 잔디1 + 보도2
  if (H - fixedTop() < 9) { alley = 2; bMax = 6; }
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
  const crossCount = Math.max(0, Math.min(2, options.crossStreets ?? (W >= 70 ? (rng() < 0.75 ? 2 : 1) : W >= 50 && rng() < 0.3 ? 2 : 1)));
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
  paint(recipe.alley, 0, 1, W, frontY - 1);
  roads.push({ kind: "alley", x: 0, y: 1, w: W, h: alley - 1 });
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
      const roof = Math.max(1, Math.min(3, room - (room > 1 && rng() < 0.3 ? 1 : 0)));
      const height: number = roof + (storeys - 1) + ground;
      const top = frontY - height;
      paint(style.roof, x, top, w, roof);
      // 위층 창 무늬: 벽돌 건물은 가끔 창 없는 짝 벽 + 세로창 두 칸씩(창 줄 벽과 무늬가 다르게).
      const plainUpper = !office && storeys > 2 && style.upper !== style.ground && /벽돌/.test(style.upper) && rng() < 0.4;
      if (storeys > 1) paint(plainUpper ? style.ground : style.upper, x, top + roof, w, storeys - 1);
      if (plainUpper) {
        const step = rng() < 0.5 ? 2 : 3;
        for (let r = top + roof + 1; r < frontY - ground; r += 2) for (let wx = x + 1; wx < x + w - 1; wx += step) place(recipe.objects.houseWindows[0]!, wx, r, { force: true });
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
      if (!office && glassId) {
        const pillar = w >= 7 && rng() < 0.5;
        const glass: number[] = [];
        for (let gx = x; gx < x + w; gx += 1) if (gx !== doorX && !(pillar && (gx === x || gx === x + w - 1))) glass.push(gx);
        glass.forEach((gx, i) => {
          const runStart = i === 0 || glass[i - 1] !== gx - 1;
          const runEnd = i === glass.length - 1 || glass[i + 1] !== gx + 1;
          const id = ends && runStart !== runEnd ? (runStart ? ends[0] : ends[1]) : glassId;
          if (place(id, gx, frontY - 1, { force: true })) busyFront.add(gx);
        });
      } else if (office) {
        // 사무실 1층: 문 양옆 유리창 두 칸씩(창고처럼 민벽이 되지 않게).
        for (const gx of [doorX - 2, doorX - 1, doorX + 1, doorX + 2]) if (gx >= x && gx < x + w && recipe.objects.shopfrontTall) place(recipe.objects.shopfrontTall, gx, frontY - 1, { force: true });
      }
      // 차양: 그늘 줄이 1층 맨 아랫줄(GUIDE·check_town_map 의 awning-off-ground), 문·쇼윈도는 그늘이 덮지 않는다(keepDoors).
      if (!office && style.awning && w >= 3) {
        const small = recipe.objects.awningSmall;
        if (rowMode && rng() < 0.8) {
          let ax = x;
          while (ax < x + w) {
            if (x + w - ax >= 3) { place(style.awning, ax, frontY - 1, { keepDoors: true, force: true }); ax += 3; }
            else { if (small) place(small, ax, frontY - 1, { keepDoors: true, force: true }); ax += 1; }
          }
        } else if (small && rng() < 0.7) place(small, doorX, frontY - 1, { keepDoors: true, force: true });
        for (let i = x; i < x + w; i += 1) busyFront.add(i);
      }
      if (roof >= 2 && w >= 4 && !prev?.dish && rng() < 0.25) dish = place(pick(rng, recipe.objects.roofProps), x + int(rng, 0, w - 2), top + 1);
      // 옥상 설비: 환기구·실외기를 건물마다 0~2개(위성 안테나와 겹치면 건너뛴다).
      const gear = recipe.objects.roofGear ?? [];
      if (gear.length && w >= 3) for (let i = 0, n = int(rng, 0, w >= 6 ? 2 : 1); i < n; i += 1) place(pick(rng, gear), x + int(rng, 0, w - 1), top + int(rng, 0, roof - 1));
      // 뒤: 건물 절반쯤만 뒷문 옆에 2~3개 무리(분리수거함·배전함·상자·실외기) — 나머지 뒷벽은 비운다(DEFECTS r1-5).
      if (top - 1 >= frontY - bMax - 2 && top - 1 >= 1 && rng() < 0.5) {
        const n = int(rng, 2, 3);
        const condensers = gear.filter((id) => kit(id)?.width === 1);
        const bin = pick(rng, recipe.objects.backProps.filter((id) => id.startsWith("recycle")).concat(recipe.objects.backProps[0]!));
        const pool = [bin, ...recipe.objects.backProps.filter((id) => !id.startsWith("recycle")), ...condensers];
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
    const bed = pick(rng, recipe.objects.flowerBeds);
    place(bed, mainDoor - 1, band.frontY);
    place(bed, mainDoor + 1, band.frontY);
    for (const d of doors.slice(1)) if (band.front > 0) paint(recipe.path, d, band.frontY, 1, 1);
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
      if (gear.length) for (let i = 0, n = int(rng, 1, 2); i < n; i += 1) place(pick(rng, gear), x + int(rng, 0, w - 1), lotTop + int(rng, 0, Math.max(0, roof - (lotTop - topY) - 1)));
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
        const hw = Math.max(4, Math.min(9, lotW - (drive ? 3 : W < 70 ? 1 : int(rng, 1, 2))));
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
        // 앞마당 경계: 필지 오른쪽 끝 칸에 나무 한 그루(같은 쪽) + 보도 쪽 생울타리 조각(진입로·현관길 피해).
        const cornerX = x + lotW - 1;
        if (band.front >= 2 && !drivewayCols.has(cornerX)) place(pick(rng, recipe.objects.yardTrees.filter((id) => (kit(id)?.width ?? 1) === 1)), cornerX, band.frontY + band.front - 1);
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
        const gear = recipe.objects.roofGear ?? [];
        if (gear.length && rows >= 1 && rng() < 0.7) place(pick(rng, gear), x + int(rng, 0, w - 1), y0 + int(rng, 0, rows - 1));
        x += w;
      }
    }
  };
  if (stripY >= 0) roofBacks(stripY + 1, H - stripY - 1);
  roofBacks(0, 1); // 맨 윗줄: 뒷골목 건너편 건물 뒷면(철망 울타리 띠 대신, DEFECTS r1-5·12)

  function buildPark(px: number, py: number, pw: number, ph: number): void {
    // 분수 광장을 가운데 조금 비켜, 십자 산책로가 네 변 보도로 이어진다. 나무는 홀수 무리로 가장자리에.
    const cx = px + Math.floor(pw / 2) + int(rng, -1, 1);
    const cy = py + Math.floor(ph / 2);
    paint(recipe.path, px, cy, pw, 1);
    // 세로 산책로는 보도가 있는 변으로만 잇는다 — 맵 끝(로컬 도로 없는 띠)으로 나가는 길은 만들지 않는다.
    paint(recipe.path, cx, py, 1, py + ph >= H ? cy + 3 - py : ph);
    paint(recipe.path, cx - 2, cy - 2, 5, 5);
    if (recipe.objects.fountain) place(recipe.objects.fountain, cx - 1, cy);
    const benchY = [cy - 1, cy + 1];
    for (const by of benchY) for (const bx of [cx - 5, cx + 4]) {
      if (bx > px && bx + 2 < px + pw) place(recipe.objects.benchLong ?? recipe.objects.bench, bx, by);
    }
    for (const [fx, fy] of [[cx - 2, cy - 2], [cx + 2, cy - 2], [cx - 2, cy + 2], [cx + 2, cy + 2]] as const) place(pick(rng, recipe.objects.flowerBeds), fx, fy);
    const quads = [
      { x0: px, x1: cx - 3, y0: py, y1: cy - 1 }, { x0: cx + 3, x1: px + pw - 1, y0: py, y1: cy - 1 },
      { x0: px, x1: cx - 3, y0: cy + 1, y1: py + ph - 1 }, { x0: cx + 3, x1: px + pw - 1, y0: cy + 1, y1: py + ph - 1 },
    ];
    for (const q of quads) {
      if (q.x1 - q.x0 < 1 || q.y1 - q.y0 < 1) continue;
      const count = pick(rng, [3, 3, 5]);
      for (let i = 0, tries = 0; i < count && tries < 30; tries += 1) {
        const id = pick(rng, recipe.objects.parkTrees ?? recipe.objects.yardTrees);
        const x1 = Math.min(q.x1, px + pw - (kit(id)?.width ?? 1));
        const tx = rng() < 0.6 ? pick(rng, [q.x0, x1]) : int(rng, q.x0, Math.max(q.x0, x1));
        const ty = int(rng, q.y0 + 1, q.y1);
        if (tx <= x1 && place(id, tx, ty)) i += 1;
      }
      for (let i = 0; i < 2; i += 1) { const id = pick(rng, recipe.objects.bushes); const bx = int(rng, q.x0, q.x1); if (bx + (kit(id)?.width ?? 1) <= px + pw) place(id, bx, int(rng, q.y0, q.y1)); }
    }
    place(recipe.objects.lamp, cx - 1, cy - 3);
    place(recipe.objects.lampAlt ?? recipe.objects.lamp, cx + 1, cy + 4 < py + ph ? cy + 4 : cy + 3);
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
    if ([...Array(pw).keys()].some((i) => doorCols.has(px + i) || lampCols.has(px + i) || inCorridorAt(px + i, frontY + 1))) continue;
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
  const streetTreeFor = () => pick(rng, recipe.objects.streetTrees ?? [recipe.objects.streetTree]);
  const southTree = streetTreeFor();
  for (let tx = int(rng, 2, 5); tx < W; tx += int(rng, 4, 6)) if (!inCorridor(tx)) place(southTree, tx, southLawnY);
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
    const t2 = streetTreeFor();
    for (const g of south2Segments) for (let tx = g.x + int(rng, 1, 3); tx < g.x + g.w; tx += int(rng, 4, 7)) {
      if (lots.some((l) => l.door && l.door.y === south2!.frontY - 1 && l.door.x === tx) || lampCols.has(tx)) continue;
      place(t2, tx, south2.frontY + 1);
    }
  }
  for (const band of bands) {
    if (band.roadY === null) continue;
    const bandTree = streetTreeFor();
    for (let tx = int(rng, 1, 4); tx < W; tx += int(rng, 4, 6)) {
      if (inCorridor(tx) || drivewayCols.has(tx)) continue;
      place(bandTree, tx, band.lawnY);
    }
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
      if (lot.kind !== "rear-lot" || lot.w < 2 || rng() < 0.2) continue;
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

  // ── 8. 빈 바닥 메우기: check_town_map 과 같은 셈(위층이 빈 같은 재료 칸의 4방향 덩어리)으로 큰 빈 잔디·빈 골목을 찾아,
  // 덩어리에서 가장 빈 칸(둘레에서 먼 칸)부터 물체로 끊는다. 잔디는 구역에 맞는 나무·덤불·화단·벤치, 골목은 분리수거함·상자·쓰레기통.
  // 물체가 덩어리 안에 통째로 들어갈 때만 둔다 — 산책로·현관길·진입로·울타리는 건드리지 않는다.
  // 물체 없이 이어지는 칸 상한: 잔디·마당 30(6×6 기준 아래), 뒷골목 12(2줄 골목이면 6칸마다 한 무더기).
  const fillMax = (material: string) => (material === recipe.alley ? 12 : material === recipe.lawn ? 30 : 28);
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
    if (material === recipe.alley) return [o.trash, "cardboard_box", ...(o.roofGear ?? []).filter((id) => kit(id)?.width === 1)].filter((id) => kit(id));
    if (material !== recipe.lawn) return [o.trash, o.bench, ...o.flowerBeds]; // 보도·산책로
    if (lots.some((l) => l.kind === "park" && x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h)) return [...o.flowerBeds, o.bench, ...o.bushes.slice(0, 1)];
    // 마당: 줄 맞춘 생울타리·화단(무작위 나무 흩뿌리기 대신, DEFECTS r1-2).
    return [...(o.hedge ? [o.hedge, o.hedge] : []), ...o.flowerBeds, o.bushes[0]!];
  };
  const doorFront = new Set(lots.flatMap((l) => (l.door ? [(l.door.y + 1) * W + l.door.x] : [])));
  for (const material of [recipe.lawn, recipe.alley, recipe.sidewalk, recipe.path]) {
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
}
