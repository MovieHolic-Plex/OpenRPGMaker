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

  // ── 1. 가로 띠(행) 나누기 — 가게 깊이·큰길 폭(= 큰길 줄), 로컬 도로 띠 수, 맨 아래 끝 처리를 시드가 고른다 ──
  let alley = 3;
  let bMax = H >= 48 ? int(rng, 7, 8) : int(rng, 6, 7);
  const mainH = rng() < 0.5 ? 5 : 7; // 큰길 차도 줄 수(작가 예시는 4~5줄, 7줄은 넓은 간선)
  const fixedTop = () => alley + bMax + 3 + mainH + 1 + 2; // 골목 + 가게 + 보도3 + 큰길 + 잔디1 + 보도2
  if (H - fixedTop() < 9) { alley = 2; bMax = 6; }
  const frontY = alley + bMax; // 가게 앞 보도 첫 줄
  const mainY = frontY + 3;
  const southLawnY = mainY + mainH;
  const southWalkY = southLawnY + 1;
  const bands: HouseBand[] = [];
  let y = southWalkY + 2;
  const rest = H - y;
  // 로컬 도로가 있는 주택 띠(17줄, 둘째부터 +2) — 들어가는 만큼에서 시드가 하나 덜 고르기도 한다.
  const maxUnits = rest >= 36 ? 2 : rest >= 17 ? 1 : 0;
  let units = maxUnits;
  if (maxUnits === 2 && rng() < 0.4) units = 1;
  else if (maxUnits === 1 && rest <= 22 && rng() < 0.35) units = 0;
  let extra = rest - (units >= 1 ? 17 : 0) - (units >= 2 ? 19 : 0);
  // 남는 줄: 도로 없는 주택 띠(앞마당이 맵 끝까지 — 골목길은 맵 밖으로 이어진다고 본다),
  // 또는 마지막 로컬 도로 건너편 보도·잔디 띠 + 맵 밖 집들의 뒷마당, 아니면 띠 안 마당에 나눠 준다(도로가 맵 끝에 붙는다).
  let tailRows = 0;
  let stripRows = 0;
  if (units === 0) tailRows = rest;
  else if (extra >= 12 && rng() < 0.6) { tailRows = extra; extra = 0; }
  else if (extra >= 2) { stripRows = extra; extra = 0; } // 로컬 도로가 맵 끝에 붙지 않게(DEFECTS B-12). 1줄은 앞마당에 더한다.
  {
    for (let u = 0; u < units; u += 1) {
      if (u > 0) { paint(recipe.lawn, 0, y, W, 1); paint(recipe.sidewalk, 0, y + 1, W, 1); y += 2; }
      const addBack = Math.min(2, extra); extra -= addBack;
      const addFront = Math.min(2, extra); extra -= addFront;
      const back = 2 + addBack;
      const front = 3 + addFront + (u === units - 1 ? extra : 0);
      if (u === units - 1) extra = 0;
      const houseY = y + back;
      const fy = houseY + 5;
      const walkY = fy + front;
      bands.push({ backY: y, back, houseY, frontY: fy, front, walkY, lawnY: walkY + 1, roadY: walkY + 2 });
      y = walkY + 2 + 5;
    }
    if (tailRows > 0) {
      if (units > 0) { paint(recipe.lawn, 0, y, W, 1); paint(recipe.sidewalk, 0, y + 1, W, 1); y += 2; }
      const avail = H - y; // 뒷마당 + 집 5 + 앞마당
      const front = Math.max(1, Math.min(6, avail - 7));
      const back = avail - 5 - front;
      bands.push({ backY: y, back, houseY: y + back, frontY: y + back + 5, front, walkY: H, lawnY: H, roadY: null });
    }
  }
  const stripY = stripRows > 0 ? H - stripRows : -1; // 마지막 로컬 도로 건너편 보도 줄

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
  // 맨 윗줄 = 골목 건너편 집의 뒷마당 울타리(맵 끝에 빈 띠를 남기지 않는다), 그 아래 골목, 건물 뒤는 뒷주차.
  paint(recipe.alley, 0, 1, W, frontY - 1);
  for (const seg of shopSegments) paint(recipe.fence, seg.x, 0, seg.w, 1);
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

  // ── 4. 가게 줄: 벽 맞댐, 폭·높이·재료가 이웃과 다르게, 모퉁이가 가장 높게, 통로는 한 곳 ──
  const doorCols = new Set<number>(); // 가게 앞 보도에서 비워 둘 열
  const busyFront = new Set<number>(); // 자판기 금지 열(문·차양·쇼윈도)
  let passageLeft = 1;
  let prev: { w: number; h: number; storeys: number; style: MvTownFacade; dish?: boolean } | null = null;
  for (const seg of shopSegments) {
    let x = seg.x;
    const end = seg.x + seg.w;
    while (end - x >= 4) {
      if (passageLeft > 0 && x > seg.x + 6 && end - x > 12 && rng() < 0.35) {
        const gap = int(rng, 2, 3);
        lots.push({ kind: "rear-lot", x, y: 0, w: gap, h: frontY });
        x += gap; passageLeft -= 1; prev = null;
        continue;
      }
      let w = rng() < 0.2 ? int(rng, 7, 9) : int(rng, 4, 6);
      if (end - x - w < 4) w = end - x; // 남은 조각이 4칸 미만이면 이 건물이 끝까지 먹는다
      if (w > 11) w = int(rng, 5, 6);
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
      let ground: number = storeys === 1 || (!office && style.shopfront && rng() < 0.6) ? 2 : 1;
      // 층 문법: 1층 띠는 언제나 2줄(문·쇼윈도 높이), 그 위 창 줄 하나 = 한 층, 옥상은 1~3줄.
      // 옥상은 남는 깊이를 채운다 — 건물 뒤에 빈 아스팔트 주차장이 넓게 남지 않게(가끔 1줄은 뒷마당으로 남긴다).
      ground = 2;
      while (1 + (storeys - 1) + ground > bMax && storeys > 2) storeys -= 1;
      const room = bMax - (storeys - 1) - ground;
      const roof = Math.max(1, Math.min(3, room - (room > 1 && rng() < 0.3 ? 1 : 0)));
      const height: number = roof + (storeys - 1) + ground;
      const top = frontY - height;
      paint(style.roof, x, top, w, roof);
      if (storeys > 1) paint(style.upper, x, top + roof, w, storeys - 1);
      paint(style.ground, x, frontY - ground, w, ground);
      let dish = false;
      const doorX = x + (w <= 4 ? 1 : int(rng, 1, w - 2));
      place(style.door, doorX, frontY - 1, { force: true });
      doorCols.add(doorX);
      busyFront.add(doorX);
      // 1층 띠: 문 옆으로 쇼윈도를 잇는다(넓은 가게는 양 끝 기둥 한 칸씩 남긴다).
      // shopfrontEnds 가 있으면 이어진 쇼윈도 덩어리의 첫·끝 칸을 테두리 조각으로 바꾼다.
      if (!office && style.shopfront) {
        const glass: number[] = [];
        for (let gx = x; gx < x + w; gx += 1) if (!busyFront.has(gx) && !(w >= 6 && (gx === x || gx === x + w - 1))) glass.push(gx);
        const ends = style.shopfrontEnds;
        glass.forEach((gx, i) => {
          const runStart = i === 0 || glass[i - 1] !== gx - 1;
          const runEnd = i === glass.length - 1 || glass[i + 1] !== gx + 1;
          const id = ends && runStart !== runEnd ? (runStart ? ends[0] : ends[1]) : style.shopfront!;
          if (place(id, gx, frontY - 1)) busyFront.add(gx);
        });
      }
      // 차양: 그늘 줄이 문 아랫칸과 같은 1층 맨 아랫줄(GUIDE·check_town_map 의 awning-off-ground), 문은 그늘이 덮지 않는다.
      if (!office && style.awning && w >= 3 && rng() < 0.65) {
        const ax = Math.min(Math.max(doorX - 1, x), x + w - 3);
        place(style.awning, ax, frontY - 1, { keepDoors: true, force: true });
        for (let i = ax; i < ax + 3; i += 1) busyFront.add(i);
      }
      if (roof >= 2 && w >= 4 && !prev?.dish && rng() < 0.25) dish = place(pick(rng, recipe.objects.roofProps), x + int(rng, 0, w - 2), top + 1);
      // 옥상 설비: 환기구·실외기를 건물마다 0~2개(위성 안테나와 겹치면 건너뛴다).
      const gear = recipe.objects.roofGear ?? [];
      if (gear.length && w >= 3) for (let i = 0, n = int(rng, 0, w >= 6 ? 2 : 1); i < n; i += 1) place(pick(rng, gear), x + int(rng, 0, w - 1), top + int(rng, 0, roof - 1));
      // 뒤: 건물 바로 위 골목에 분리수거함·배전함을 1~3개 모아 둔다.
      if (top >= 2 && rng() < 0.6) {
        const n = int(rng, 1, 3);
        let bx = x + int(rng, 0, Math.max(0, w - n));
        for (let i = 0; i < n; i += 1, bx += 1) place(pick(rng, recipe.objects.backProps), bx, top - 1);
      }
      // 뒷벽에 붙인 에어컨 실외기(1칸 설비) — 뒤가 빈 땅이 아니라 건물 뒷면으로 읽히게.
      const condensers = gear.filter((id) => kit(id)?.width === 1);
      if (condensers.length && top - 1 >= alley && rng() < 0.6) place(pick(rng, condensers), x + int(rng, 0, w - 1), top - 1);
      lots.push({ kind: office ? "office" : "shop", x, y: top, w, h: height, storeys, door: { x: doorX, y: frontY - 1 } });
      prev = { w, h: height, storeys, style, dish };
      x += w;
    }
    prev = null;
  }
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
  for (let bx = int(rng, 2, 6); bx < W; bx += int(rng, 5, 11)) if (!inCorridorAt(bx, 0)) place(pick(rng, recipe.objects.bushes.filter((id) => (kit(id)?.height ?? 2) === 1)), bx, 0);

  // ── 5. 주택가·공원 ──
  const parkBand = bands.length ? pick(rng, bands) : null; // 공원이 설 주택 띠도 시드가 고른다
  const parkSegIndex = options.park === false ? -1 : (() => {
    const wide = segments.map((seg, i) => ({ seg, i })).filter(({ seg }) => seg.w >= 12);
    return wide.length ? pick(rng, wide).i : -1;
  })();
  const drivewayCols = new Set<number>();
  let terraceDone = false;
  for (const band of bands) {
    segments.forEach((seg, si) => {
      const bandTop = band.backY;
      const bandBottom = band.roadY === null ? H : band.walkY; // 앞마당 끝(보도 전)
      let x = seg.x;
      let end = seg.x + seg.w;
      if (si === parkSegIndex && band === parkBand) {
        // 공원은 한 블록 전부가 아니라 14~20칸 — 나머지는 집이 선다. 큰길 쪽 모퉁이(골목길 옆)에 둔다.
        const pw = seg.w - Math.min(seg.w, int(rng, 14, 20)) < 8 ? seg.w : int(rng, 14, 20);
        const atRight = seg.x + seg.w < W && (seg.x === 0 || rng() < 0.5);
        const parkX = atRight ? seg.x + seg.w - pw : seg.x;
        buildPark(parkX, bandTop, pw, bandBottom - bandTop);
        if (pw === seg.w) return;
        if (atRight) end = parkX; else x = parkX + pw;
      }
      let prevGap = -1;
      let prevHouse: (typeof recipe.houses)[number] | null = null;
      // 독일식 줄집: 한 블록만, 벽을 맞댄 좁은 집 3~4채(색은 집마다 다르게). 진입로 없이 현관길만.
      if (!terraceDone && band !== bands[0] && end - x >= 14 && rng() < 0.6) {
        terraceDone = true;
        let tx = x + 1;
        const count = Math.min(4, Math.floor((end - x - 2) / 4));
        let last: (typeof recipe.houses)[number] | null = null;
        for (let i = 0; i < count; i += 1) {
          const tw = i === count - 1 ? Math.min(5, end - 1 - tx) : int(rng, 4, 5);
          if (tw < 4) break;
          let style = pick(rng, recipe.houses);
          for (let k = 0; k < 4 && style === last; k += 1) style = pick(rng, recipe.houses);
          last = style;
          const wallY = band.houseY + 3;
          paintHouseRoof(style.roof, tx, band.houseY + 1, tw, 2);
          paint(style.wall, tx, wallY, tw, 2);
          const doorX = tx + int(rng, 1, tw - 2);
          place(recipe.objects.houseDoor, doorX, wallY + 1, { force: true });
          const wx = doorX + (doorX - tx >= 2 ? -2 : 2);
          if (wx >= tx && wx < tx + tw) place(pick(rng, recipe.objects.houseWindows), wx, wallY + 1, { force: true });
          if (band.front > 0) paint(recipe.path, doorX, band.frontY, 1, Math.min(band.front, H - band.frontY));
          place(pick(rng, recipe.objects.flowerBeds), doorX + 1, band.frontY);
          lots.push({ kind: "house", x: tx, y: band.houseY + 1, w: tw, h: 4, door: { x: doorX, y: wallY + 1 } });
          tx += tw;
        }
        paint(recipe.fence, x, band.backY, tx + 1 - x, 1);
        for (let i = 0; i < 3; i += 1) place(pick(rng, recipe.objects.yardTrees), x + int(rng, 1, tx - x - 1), band.backY + band.back - 1);
        x = tx + 1;
      }
      while (end - x >= 8) {
        let lotW = int(rng, 8, 11);
        if (end - x - lotW < 8) lotW = end - x;
        const hw = Math.min(int(rng, 5, 7), lotW - 3);
        let gap = int(rng, 1, Math.max(1, lotW - hw - 2));
        if (gap === prevGap && lotW - hw - 2 > 1) gap = gap === 1 ? 2 : gap - 1;
        prevGap = gap;
        const hx = x + gap;
        let style = pick(rng, recipe.houses);
        for (let k = 0; k < 4 && style === prevHouse; k += 1) style = pick(rng, recipe.houses);
        prevHouse = style;
        const roofRows = rng() < 0.5 ? 3 : 2;
        const hTop = band.houseY + (3 - roofRows);
        const wallY = band.houseY + 3;
        paintHouseRoof(style.roof, hx, hTop, hw, roofRows);
        paint(style.wall, hx, wallY, hw, 2);
        const doorX = hx + int(rng, 1, hw - 2);
        place(recipe.objects.houseDoor, doorX, wallY + 1, { force: true });
        for (const wx of [doorX - 2, doorX + 2]) {
          if (wx >= hx && wx < hx + hw && rng() < 0.85) place(pick(rng, recipe.objects.houseWindows), wx, wallY + 1, { force: true });
        }
        // 현관길: 문 → 보도(1칸). 진입로: 집 옆 틈 2칸, 잔디 띠까지(연석 끊김).
        if (band.front > 0) paint(recipe.path, doorX, band.frontY, 1, Math.min(band.front, H - band.frontY));
        const sideRight = x + lotW - (hx + hw);
        if (band.roadY !== null && rng() < 0.65) {
          const dx = sideRight >= 3 ? hx + hw + 1 : gap >= 3 ? hx - 3 : -1;
          if (dx >= 0) {
            paint(recipe.driveway, dx, wallY, 2, band.walkY - wallY);
            paint(recipe.driveway, dx, band.lawnY, 2, 1);
            drivewayCols.add(dx); drivewayCols.add(dx + 1);
          }
        }
        // 앞마당: 현관 옆 화단 + 나무/덤불 — 빈 잔디 네모로 두지 않는다.
        place(pick(rng, recipe.objects.flowerBeds), doorX + (rng() < 0.5 ? 1 : -1), band.frontY);
        const treeBase = band.frontY + Math.min(band.front - 1, 2);
        const treeX = rng() < 0.5 ? x + int(rng, 0, 1) : x + lotW - 1 - int(rng, 0, 1);
        if (!drivewayCols.has(treeX) && treeX !== doorX) place(pick(rng, recipe.objects.yardTrees), treeX, treeBase);
        if (rng() < 0.6) place(pick(rng, recipe.objects.bushes), hx + (rng() < 0.5 ? 0 : hw - 1), band.frontY + 1);
        // 뒷마당: 울타리(맨 윗줄 + 이웃 경계) + 텃밭 + 나무 한 무리 — 빈 잔디 네모로 두지 않는다.
        paint(recipe.fence, x, band.backY, lotW, 1);
        paint(recipe.fence, x + lotW - 1, band.backY, 1, band.back);
        if (recipe.garden && band.back >= 3 && rng() < 0.45) {
          const gw = int(rng, 2, 3);
          paint(recipe.garden, x + int(rng, 1, Math.max(1, lotW - gw - 2)), band.backY + 1, gw, band.back - 2 >= 2 ? 2 : 1);
        }
        const cluster = int(rng, 1, 3);
        for (let i = 0; i < cluster; i += 1) {
          const tx = x + int(rng, 1, lotW - 2);
          place(pick(rng, recipe.objects.yardTrees), tx, band.backY + band.back - 1);
        }
        lots.push({ kind: "house", x: hx, y: hTop, w: hw, h: roofRows + 2, door: { x: doorX, y: wallY + 1 } });
        x += lotW;
      }
    });
  }
  // 마지막 로컬 도로 건너편: 잔디 띠(가로수는 6절) 아래로 맵 밖 집들의 뒷마당 — 울타리·나무.
  if (stripY >= 0 && stripRows >= 3) {
    for (const seg of segments) {
      paint(recipe.fence, seg.x, stripY + 2, seg.w, 1);
      for (let fx = seg.x + int(rng, 7, 11); fx < seg.x + seg.w - 3; fx += int(rng, 8, 11)) {
        paint(recipe.fence, fx, stripY + 2, 1, H - stripY - 2);
        place(pick(rng, recipe.objects.yardTrees), fx - int(rng, 1, 3), H - 1);
      }
    }
  }

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
        const tx = rng() < 0.6 ? pick(rng, [q.x0, q.x1]) : int(rng, q.x0, q.x1);
        const ty = int(rng, q.y0 + 1, q.y1);
        if (place(pick(rng, recipe.objects.parkTrees ?? recipe.objects.yardTrees), tx, ty)) i += 1;
      }
      for (let i = 0; i < 2; i += 1) place(pick(rng, recipe.objects.bushes), int(rng, q.x0, q.x1), int(rng, q.y0, q.y1));
    }
    place(recipe.objects.lamp, cx - 1, cy - 3);
    place(recipe.objects.lampAlt ?? recipe.objects.lamp, cx + 1, cy + 4 < py + ph ? cy + 4 : cy + 3);
    lots.push({ kind: "park", x: px, y: py, w: pw, h: ph });
  }

  // ── 6. 거리 물체: 가로등 6~10·가로수 4~6, 문 앞은 비운다. 소화전은 모퉁이 가까이 ──
  const curb = frontY + 2;
  const blocked = (x: number) => inCorridorAt(x, curb) || doorCols.has(x) || doorCols.has(x - 1) || doorCols.has(x + 1);
  let lampX = int(rng, 2, 5);
  const lampCols = new Set<number>();
  while (lampX < W) {
    let lx = lampX;
    while (lx < W && blocked(lx)) lx += 1;
    if (lx < W && place(recipe.objects.lamp, lx, curb)) lampCols.add(lx);
    lampX = lx + int(rng, 6, 10);
  }
  for (let tx = int(rng, 1, 3); tx < W; tx += int(rng, 4, 6)) {
    let t = tx;
    while (t < W && (inCorridorAt(t, curb) || doorCols.has(t) || lampCols.has(t) || lampCols.has(t - 1) || lampCols.has(t + 1))) t += 1;
    if (t < W) place(recipe.objects.planterTree, t, curb);
    tx = t;
  }
  for (const lot of lots) {
    if (lot.kind !== "shop" || !lot.door) continue;
    if (rng() < 0.45) place(recipe.objects.trash, lot.door.x + (rng() < 0.5 ? 2 : -2), frontY);
    if (rng() < 0.3) {
      for (let vx = lot.x; vx < lot.x + lot.w; vx += 1) {
        if (busyFront.has(vx) || busyFront.has(vx + 1)) continue;
        if (place(pick(rng, recipe.objects.vending), vx, frontY)) break;
      }
    }
    // 가게 앞 보도 가운데 줄에 노점·광고탑을 가끔 하나(문 앞·차양 밑 열은 피한다).
    const props = recipe.objects.streetProps ?? [];
    if (props.length && rng() < 0.35) {
      const id = pick(rng, props);
      const pw = kit(id)?.width ?? 1;
      for (let px = lot.x; px + pw <= lot.x + lot.w; px += 1) {
        if ([...Array(pw).keys()].some((i) => doorCols.has(px + i) || inCorridorAt(px + i, frontY + 1))) continue;
        if (place(id, px, frontY + 1)) break;
      }
    }
  }
  for (const c of corridors) {
    if (c.y0 === 0) place(recipe.objects.hydrant, c.x - 2, curb);
    if (c.y1 === H) place(recipe.objects.hydrant, c.x + 10, southWalkY + 1);
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
  for (let lx = int(rng, 5, 9); lx < W; lx += int(rng, 7, 10)) if (!inCorridor(lx)) place(recipe.objects.lampAlt ?? recipe.objects.lamp, lx, southWalkY + 1);
  for (const band of bands) {
    if (band.roadY === null) continue;
    const bandTree = streetTreeFor();
    for (let tx = int(rng, 1, 4); tx < W; tx += int(rng, 4, 6)) {
      if (inCorridor(tx) || drivewayCols.has(tx)) continue;
      place(bandTree, tx, band.lawnY);
    }
  }
  if (stripY >= 0 && stripRows >= 2) {
    const stripTree = streetTreeFor();
    for (let tx = int(rng, 1, 4); tx < W; tx += int(rng, 4, 6)) if (!inCorridor(tx)) place(stripTree, tx, stripY + 1);
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

  // ── 8. 빈 바닥 메우기: check_town_map 과 같은 셈(위층이 빈 같은 재료 칸의 4방향 덩어리)으로 큰 빈 잔디·빈 골목을 찾아,
  // 덩어리에서 가장 빈 칸(둘레에서 먼 칸)부터 물체로 끊는다. 잔디는 구역에 맞는 나무·덤불·화단·벤치, 골목은 분리수거함·상자·쓰레기통.
  // 물체가 덩어리 안에 통째로 들어갈 때만 둔다 — 산책로·현관길·진입로·울타리는 건드리지 않는다.
  // 물체 없이 이어지는 칸 상한: 잔디·마당 30(6×6 기준 아래), 뒷골목 12(2줄 골목이면 6칸마다 한 무더기).
  const fillMax = (material: string) => (material === recipe.alley ? 12 : material === recipe.lawn ? 30 : 36);
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
    if (material === recipe.alley) return [...o.backProps, o.trash];
    if (material !== recipe.lawn) return [o.trash, o.bench, o.planterTree, ...o.flowerBeds]; // 보도·산책로
    if (lots.some((l) => l.kind === "park" && x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h)) return [...(o.parkTrees ?? o.yardTrees), ...o.bushes, ...o.flowerBeds, o.bench];
    if (bands.some((b) => y >= b.backY && y < b.houseY) || (stripY >= 0 && y > stripY + 1)) return [...o.yardTrees, ...o.yardTrees, ...o.bushes]; // 뒷마당
    return [...o.bushes, ...o.flowerBeds, ...o.yardTrees]; // 앞마당·잔디 띠
  };
  const doorFront = new Set(lots.flatMap((l) => (l.door ? [(l.door.y + 1) * W + l.door.x] : [])));
  for (const material of [recipe.lawn, recipe.alley, recipe.sidewalk, recipe.path]) {
    const stuck = new Set<number>(doorFront);
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
          if (cells?.length && cells.every((cell) => inBlob.has(cell))) placed = place(id, px, cy);
        }
        if (placed) break;
      }
      if (!placed) blob.forEach((i) => stuck.add(i)); // 넣을 물체가 없는 덩어리 — 건너뛴다
    }
  }
  return { lots, roads, seed };
}
