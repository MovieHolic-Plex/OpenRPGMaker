// editor/handInterior/jpHouseBlueprint.ts
// 일본 2층 단독주택(jp_city) 1층·2층 청사진 — build_hand_interior_room 의 layout.program 이 "jp-house-1f"·"jp-house-2f"
// (옛 이름 "house-1f"·"house-2f" 도) 이면 이 구조로 짓는다.
//
// 왜 (2026-10-20 사용자 참고 그림 — RPG Maker MV 풍 일본 집 1층, 구조만 참고): 견본 방을 무작위로 쪼개 붙이면 물 쓰는 곳이 흩어지고
// (욕실이 남서, 화장실이 북쪽 가운데, 부엌이 북동) 현관·계단·복도가 집의 등뼈가 되지 못했다. 그림에서 읽은 구조 규칙만 고정한다.
//   1층: 북쪽 띠 = 부엌 | 짧은 북쪽 복도 | 탈의실(세면대·세탁기). 화장실은 북쪽 복도 뒤로 튀어나온 작은 방(문 하나).
//        욕실은 탈의실 바로 아래(문은 욕실 북쪽 벽) — 부엌·탈의실·욕실·화장실이 북쪽·동쪽에 모인다(물 쓰는 곳 묶음).
//        남서 = 거실 겸 식당(TV보드·에어컨·식기장·러그 위 식탁+의자 넷·구석 화분) — 부엌과는 북쪽 벽의 좁은 트임으로만 잇는다.
//        가운데 = 복도(북쪽 벽에 계단, 북쪽 복도로 가는 문, 탈의실 문) · 남쪽 가운데 아래 끝 = 현관(타타키·아가리카마치·신발장 위 꽃).
//   2층: 같은 바깥선. 가운데 세로 복도(계단통) — 서쪽 위 아이방·서쪽 아래 부부 침실·동쪽 위 화실·동쪽 아래 서재, 복도 남쪽 끝 화장실.
// 씨앗이 바꾸는 것: 동↔서 뒤집기, 서쪽·동쪽 띠 폭, 바닥·벽면 묶음, 거실·아이방 곁가구. 구조(이웃·문·물 쓰는 곳 묶음)는 바꾸지 않는다.
// 1층과 2층을 같은 씨앗으로 지으면 바깥선·계단 자리가 맞는다(1층 계단 칸 ↔ 2층 계단통 아랫줄).
import type { HandInteriorGoods, HandInteriorObject, HandInteriorSpec, HandInteriorTable, HandInteriorZone } from "./builder";
import type { HandInteriorConnect, HandInteriorExit, HandInteriorRoom } from "./rooms";
import { composeHandInteriorRooms } from "./rooms";

export interface JpHouseBlueprint {
  readonly tileset: "jp_city";
  readonly floor: string;
  readonly wall: string;
  /** 1층: rooms·connect·exit(도구가 칸막이·문·출구를 계산). 2층: 출구가 없는 위층이라 plan·start 로 준다. */
  readonly rooms?: readonly HandInteriorRoom[];
  readonly connect?: readonly HandInteriorConnect[];
  readonly exit?: HandInteriorExit;
  readonly plan?: readonly string[];
  readonly start?: readonly { readonly x: number; readonly y: number }[];
  readonly zones: readonly HandInteriorZone[];
  readonly objects: readonly HandInteriorObject[];
  readonly tables: readonly HandInteriorTable[];
  readonly lines: readonly never[];
  readonly goods: readonly HandInteriorGoods[];
  readonly daises: readonly never[];
  readonly areas: readonly { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  readonly decisions: readonly string[];
  /** 층 이동 칸(같은 씨앗의 다른 층과 잇는 links 자리). from = 이 맵에서 밟는 칸, to = 다른 층에서 내릴 칸. */
  readonly stairs: { readonly from: readonly { readonly x: number; readonly y: number }[]; readonly to: { readonly x: number; readonly y: number } };
  /** 방 사각형(뒤집은 뒤) — 예제 굽기(gen_house_examples.mts)가 방 종류로 쓴다. 도구 인자가 아니다. */
  readonly layoutRooms: readonly HandInteriorRoom[];
}

function rng(seed: number): () => number {
  let a = (Math.floor(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 씨앗 → 바깥선·변형. a = 서쪽 띠 폭(부엌·거실 / 아이방·침실) — 방마다 빈 바닥 ≤30% 를 맞춘 가구 배열이 이 폭에 맞춰져 있어 고정한다. */
export interface JpHouseGeometry { readonly a: number; readonly flip: boolean; readonly palette: number; readonly variant: number }
export function jpHouseGeometry(seed: number): JpHouseGeometry {
  if (Math.floor(seed) <= 1) return { a: 8, flip: false, palette: 0, variant: 0 };
  const r = rng(seed * 2654435761);
  return { a: 8, flip: r() < 0.5, palette: Math.floor(r() * 3), variant: Math.floor(r() * 2) };
}

const PALETTES = [
  { hall: "flooring", living: "flooring", livingWall: "cloth", kitchen: "cushion", kitchenWall: "kitchen-panel", wash: "cushion", washWall: "cloth", upper: "flooring", upperWall: "cloth-beige", bed: "flooring-dark" },
  { hall: "flooring-dark", living: "flooring-dark", livingWall: "cloth-beige", kitchen: "cushion", kitchenWall: "kitchen-panel", wash: "bathtile", washWall: "bathwall", upper: "flooring-dark", upperWall: "cloth", bed: "carpet" },
  { hall: "flooring", living: "flooring-dark", livingWall: "cloth-beige", kitchen: "flooring", kitchenWall: "kitchen-panel", wash: "cushion", washWall: "cloth", upper: "flooring", upperWall: "cloth", bed: "carpet" },
] as const;

type Pt = { x: number; y: number };
interface Draft {
  objects: HandInteriorObject[]; tables: HandInteriorTable[]; goods: HandInteriorGoods[];
}
const o = (d: Draft, id: string, x: number, y: number) => { d.objects.push({ id, x, y }); };
/** 집 보강 8종(object-gen, 2026-10-21 — interior_house3 블록)은 3/4 관문을 통과해 사양에 굽힌 것만 쓴다. 없으면 옛 대역을 쓴다. */
const has = (S: HandInteriorSpec, id: string) => Boolean(S.objects[id]);
const hasGood = (S: HandInteriorSpec, id: string) => S.goods[id] !== undefined;
const hasWall = (S: HandInteriorSpec, id: string) => Boolean(S.walls[id]);
const g = (d: Draft, id: string, x: number, y: number) => { d.goods.push({ id, x, y }); };

/** 동↔서 거울: 칸 x → W-1-x, 폭 w 인 것은 W-w-x. */
function mirror(W: number, S: HandInteriorSpec, d: Draft): Draft {
  const wOf = (id: string) => Math.max(1, S.objects[id]?.w ?? 1);
  return {
    objects: d.objects.map((it) => ({ ...it, x: W - wOf(it.id) - it.x })),
    tables: d.tables.map((t) => ({ ...t, x: W - t.w - t.x })),
    goods: d.goods.map((it) => ({ ...it, x: W - 1 - it.x })),
  };
}
const mirrorRoom = (W: number, r: HandInteriorRoom): HandInteriorRoom => ({ ...r, x0: W - 1 - r.x1, x1: W - 1 - r.x0 });
/** 가로 칸막이 문(at = x)만 뒤집는다 — 세로 칸막이 옆문(at = 줄 y)과 통째로 트인 곳은 그대로. */
const mirrorConnect = (W: number, flip: boolean, side: ReadonlySet<HandInteriorConnect>) => (c: HandInteriorConnect): HandInteriorConnect =>
  !flip || c.at === undefined || side.has(c) || (c.open && !c.span) ? c : { ...c, at: W - (c.span ?? 1) - c.at };

/**
 * 1층 18×20 (뒤집기 전, a=8). 세 띠 × 두 줄의 격자 + 북쪽으로 튀어나온 화장실, 남쪽으로 튀어나온 현관:
 *   열: 0 벽 | 1..8 서쪽(부엌 / 거실·식당) | 9 칸막이(부엌↔북쪽 복도는 통째로 트임) | 10..12 가운데(북쪽 복도 / 복도·현관) | 13 칸막이 | 14..16 동쪽(탈의·세면 / 욕실) | 17 벽
 *   줄: 화장실 y1..4 (11..12열) · 북쪽 띠 y6..10 · 남쪽 띠 y12..16 · 현관(가운데 띠만) y17..18 + 문 y19
 * 계단은 북쪽 복도 북서 귀퉁이(위가 화장실 옆 바깥벽이라 칸막이에 박히지 않는다) — 현관에서 복도 문으로 곧장 보인다.
 * 탈의·세면실은 북쪽 복도에서 옆문(미닫이)으로 들어가고, 욕실은 탈의실 바로 아래(같은 열 문).
 */
export function composeJpHouse1F(S: HandInteriorSpec, seed: number): JpHouseBlueprint {
  const G = jpHouseGeometry(seed);
  const P = PALETTES[G.palette]!;
  const { a } = G;
  const W = a + 10, H = 20;
  const c0 = a + 2, c1 = a + 4;                // 가운데 띠
  const e0 = a + 6, e1 = a + 8;                // 동쪽 띠
  const livingWall = hasWall(S, "cloth-wainscot") ? "cloth-wainscot" : P.livingWall;   // 거실·현관 복도 = 허리벽(腰壁) 벽지
  const rooms: HandInteriorRoom[] = [
    { id: "toilet", x0: c0 + 1, y0: 1, x1: c1, y1: 4, floor: P.wash, wall: P.washWall },
    { id: "kitchen", x0: 1, y0: 6, x1: a, y1: 10, floor: P.kitchen, wall: P.kitchenWall },
    { id: "hall-north", x0: c0, y0: 6, x1: c1, y1: 10, floor: P.hall, wall: P.livingWall },
    { id: "dressing", x0: e0, y0: 6, x1: e1, y1: 10, floor: P.wash, wall: P.washWall },
    { id: "ldk", x0: 1, y0: 12, x1: a, y1: 16, floor: P.living, wall: livingWall },
    { id: "hall", x0: c0, y0: 12, x1: c1, y1: 18, floor: P.hall, wall: livingWall },
    { id: "bath", x0: e0, y0: 12, x1: e1, y1: 16, floor: "bathtile", wall: "bathwall" },
  ];
  const kOpen = a - 1;                          // 부엌↔거실 트임 2칸(부엌 동쪽 끝 — 북쪽 복도에서 들어온 길이 곧장 거실로)
  // 배식 창(serving-hatch, 벽 2칸)이 있으면 트임을 동쪽 1칸(a)으로 줄이고, 막힌 트임 서쪽 칸과 그 옆 칸(a-2..a-1) 벽면에 창을 건다 — 거실은 여전히 부엌 트임으로 들어간다.
  const hatch = has(S, "serving-hatch");
  const dressDoor: HandInteriorConnect = { a: "hall-north", b: "dressing", at: 10, door: "door-side-sliding" };
  const connect: HandInteriorConnect[] = [
    { a: "hall", b: "hall-north", at: c0 + 1, door: "door-open-western" },
    { a: "hall-north", b: "toilet", at: c1, door: "door-open-toilet" },
    { a: "kitchen", b: "hall-north", open: true },
    dressDoor,
    { a: "dressing", b: "bath", at: e0, door: S.objects["kr-shower-door"] ? "kr-shower-door" : "door-open-western" },
    hatch ? { a: "kitchen", b: "ldk", open: true, at: a, span: 1 } : { a: "kitchen", b: "ldk", open: true, at: kOpen, span: 2 },
  ];
  const genkanX = c0 + 1;
  const d: Draft = { objects: [], tables: [], goods: [] };
  // ── 화장실(2×2 바닥): 변기 / 매트·슬리퍼, 문 안쪽 칸은 비움 — 북벽이 바깥이라 작은 창 ──
  o(d, "toilet", c0 + 1, 3);
  o(d, "window-sash-small", c0 + 1, 1); o(d, "toilet-handwash", c1, 1);
  o(d, "toilet-mat", c0 + 1, 4); o(d, "toilet-slippers", c1, 4);
  // ── 부엌(대면식): 북쪽 벽 냉장고·조리대·싱크·가스대·레인지 선반·식기장, 싱크 앞 키친 매트, 남쪽 아일랜드 작업대 ──
  o(d, "fridge", 1, 8);
  ["kitchen-worktop", "kitchen-sink", "kitchen-worktop", "kitchen-stove", "kitchen-worktop"].forEach((id, i) => o(d, id, 2 + i, 8));
  o(d, "microwave-rack", a - 1, 8); o(d, has(S, "glass-cupboard") ? "glass-cupboard" : "cupboard", a, 8);   // 식기장(유리문이 있으면 그것)
  o(d, "window-sash", 3, 6); o(d, "calendar", a - 2, 6);
  g(d, "rice-cooker", 2, 8); g(d, "kettle", 4, 8);
  o(d, "genkan-mat", 3, 9);                     // 싱크 앞 키친 매트(2칸 깔개)
  d.tables.push({ style: "kcounter", x: 1, y: 10, w: a - 3, h: 1 });   // 아일랜드 — 동쪽 끝 세 칸(a-2..a)은 북쪽 복도·거실 트임으로 가는 길
  // ── 북쪽 복도: 북서 계단, 벽시계, 부엌 쪽 트인 열 책장·화분 ──
  o(d, "stairs-up-wood", c0, 8);
  o(d, "wall-clock", c0 + 1, 6); o(d, "houseplant", c0 + 1, 8);
  o(d, "bookshelf", a + 1, 8);
  // ── 탈의·세면실(3×3): 세면대·수건 서랍장 / 동쪽 벽 세탁기 / 문 앞 발매트·빨래 장대 — 세면대 앞 두 칸만 걷는 자리 ──
  // 세면화장대(2칸, 큰 거울)가 있으면 세면대·서랍장 대신 동쪽 두 칸에 — 세탁기는 서쪽 벽 첫 칸(그 앞이 문에서 들어온 걷는 칸), 빨래 바구니는 세탁기 자리였던 동쪽 칸.
  // 세 가구 모두 걷는 두 칸((e0,9)·(e0+1,9))에 닿고, 문 앞 칸(e0,10)·욕실 문 열은 비어 있다.
  const vanity = has(S, "vanity-mirror");
  if (vanity) {
    o(d, "washing-machine", e0, 8); o(d, "vanity-mirror", e0 + 1, 8); o(d, "laundry-basket", e1, 9);
  } else {
    o(d, "washbasin", e0, 8); g(d, "toothbrush-cup", e0, 8);
    o(d, "dresser-low", e0 + 1, 8); o(d, "washing-machine", e1, 9);
  }
  o(d, "towel-rack", vanity ? e0 : e0 + 1, 6); o(d, "window-sash-small", e1, 6);
  o(d, "bath-mat", e0, 10); o(d, "h2-laundry-pole", e0 + 1, 10);
  // ── 욕실(3×3): 욕조·샤워·거울, 씻는 자리 의자·대야, 바닥 발판(すのこ) ──
  // 유닛 배스(3칸 한 덩어리)는 북벽 첫 줄에 서는데, 욕실 문(e0 열)이 그 줄로 들어온다 — 문 열을 비우고도 3칸이 남을 때(욕실 폭 ≥ 4)만 쓴다.
  // 지금 욕실은 폭 3(e0..e1)이라 늘 옛 욕조·샤워·거울로 짓는다.
  const unitBath = has(S, "unit-bath") && e1 - e0 + 1 >= Math.max(1, S.objects["unit-bath"]?.w ?? 3) + 1;
  if (unitBath) {
    o(d, "unit-bath", e0 + 1, 14);
    o(d, "sc-sunoko", e0, 14); o(d, "sc-sunoko", e0, 15); o(d, "bath-stool", e0 + 1, 15); o(d, "bath-bucket", e0 + 2, 15);
    for (let x = e0; x <= e1; x++) o(d, "sc-sunoko", x, 16);
  } else {
    o(d, "bathtub", e0 + 1, 14); o(d, "shower-faucet", e0 + 1, 12); o(d, "bath-mirror", e1, 12);   // 북벽은 탈의실과의 칸막이 — 창 없음
    o(d, "sc-sunoko", e0, 14); o(d, "sc-sunoko", e0, 15); o(d, "bath-stool", e0 + 1, 15); o(d, "bath-bucket", e1, 15);
    o(d, "sc-sunoko", e0, 16); o(d, "sc-sunoko", e0 + 1, 16); o(d, "sc-sunoko", e1, 16);
  }
  // ── 거실 겸 식당: 서쪽 거실(TV — 좌탁 — 소파가 한 열), 가운데 깔개(동선), 동쪽 식탁(부엌 트임 아래) ──
  o(d, "ac-unit", 1, 12); o(d, "tv-board", 1, 14); g(d, "remote", 2, 14);
  if (hatch) {   // 북쪽 벽면(부엌과의 칸막이): 줄인 트임 바로 서쪽에 배식 창 2칸, 그 서쪽에 나무 기둥
    o(d, "serving-hatch", a - 2, 12);
    if (has(S, "wood-post")) o(d, "wood-post", a - 3, 12);
  }
  o(d, "low-table", 1, 15); o(d, "sofa-n", 1, 16);
  o(d, G.variant === 1 ? "floor-lamp" : "houseplant", 4, 14);
  o(d, "rug", 3, 15);
  d.tables.push({ style: "dining", x: a - 1, y: 15, w: 2, h: 2 });
  o(d, "chair-dining-e", a - 2, 15); o(d, "chair-dining-e", a - 2, 16);
  g(d, "plates", a - 1, 15); g(d, "fruit-bowl", a, 16);
  // ── 현관 복도·현관: 북쪽 벽 시계·인터폰, 화분·슬리퍼 걸이, 현관 단, 타타키(신발장·우산꽂이·신발) ──
  o(d, "intercom", c1, 12); o(d, "houseplant", c0, 14); o(d, "ht-slipper-rack", c1, 14);
  o(d, "slippers", c0, 15); o(d, "genkan-mat", c0 + 1, 15);
  for (let x = c0; x <= c1; x++) o(d, "agarikamachi", x, 16);   // 현관 단·타타키는 복도 폭 전부
  o(d, "getabako-narrow", c0, 17); g(d, hasGood(S, "genkan-vase") ? "genkan-vase" : "sh-bouquet", c0, 17);
  o(d, "umbrella-stand", c1, 17);
  o(d, "shoes-pair", c0, 18); o(d, "shoes-pair", c1, 18);
  o(d, "genkan-door", genkanX, 19);
  const zones: HandInteriorZone[] = [{ x0: c0, y0: 17, x1: c1, y1: 18, floor: "tataki" }, { x0: a + 1, y0: 8, x1: a + 1, y1: 10, floor: P.hall }];
  const D = G.flip ? mirror(W, S, d) : d;
  const fx = (x: number, w = 1) => (G.flip ? W - w - x : x);
  const exit: HandInteriorExit = { room: "hall", x: fx(genkanX) };
  const roomsOut = G.flip ? rooms.map((r) => mirrorRoom(W, r)) : rooms;
  const connectOut = connect.map(mirrorConnect(W, G.flip, new Set([dressDoor])));
  const zonesOut = zones.map((z) => (G.flip ? { ...z, x0: W - 1 - z.x1, x1: W - 1 - z.x0 } : z));
  composeHandInteriorRooms(roomsOut, connectOut, exit, S);
  // 계단(벽 가구)은 바로 아래 칸이 탈 자리 — 2층에서 내려오면 그 동쪽(뒤집으면 서쪽) 칸.
  const stairsCell = { x: fx(c0), y: 9 };
  const arrive = { x: fx(c0 + 1), y: 9 };
  return {
    tileset: "jp_city", floor: P.hall, wall: P.livingWall,
    rooms: roomsOut, connect: connectOut, exit, zones: zonesOut,
    objects: D.objects, tables: D.tables, lines: [], goods: D.goods, daises: [],
    areas: roomsOut.map((r) => ({ name: AREA_NAME[r.id] ?? r.id, x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 })),
    decisions: [
      `일본 집 1층 구조(씨앗 ${seed}): 북쪽 띠 부엌(북쪽 복도와 트임)·북쪽 복도(북서 계단)·탈의실(복도 옆문), 화장실은 북쪽 복도 뒤 작은 방, 욕실은 탈의실 바로 아래, 남서 거실 겸 식당(부엌과 트임), 가운데 복도 남쪽 끝 현관`,
      `${W}×${H}${G.flip ? " · 동서 뒤집음" : ""} · 방마다 빈 바닥 ≤30%(통로 포함)`,
      `계단 (${fx(c0)},8) 앞 탈 자리 (${stairsCell.x},${stairsCell.y}) — 같은 씨앗의 jp-house-2f 계단통 앞 칸으로 잇는다(links). 2층에서 내려오면 (${arrive.x},${arrive.y})`,
    ],
    stairs: { from: [stairsCell], to: arrive },
    layoutRooms: roomsOut,
  };
}

const AREA_NAME: Record<string, string> = {
  toilet: "화장실", kitchen: "부엌", "hall-north": "북쪽 복도", dressing: "탈의·세면실", ldk: "거실 겸 식당", hall: "복도·현관", bath: "욕실",
  kids: "아이방", bedroom: "부부 침실", washitsu: "화실", study: "서재", "hall-2f": "2층 복도",
};

/**
 * 2층 18×18 — 1층과 같은 격자를 한 줄 위까지 그대로 쌓는다(같은 씨앗이면 1층 바깥선 안: 화장실 위 화장실, 부엌 위 아이방, 탈의실 위 화실,
 * 거실 위 부부 침실, 욕실 위 서재, 가운데 복도 위 2층 복도 — 1층 현관 돌출 두 줄은 지붕). 계단통은 1층 계단과 같은 서쪽 열.
 */
export function composeJpHouse2F(S: HandInteriorSpec, seed: number): JpHouseBlueprint {
  const G = jpHouseGeometry(seed);
  const P = PALETTES[G.palette]!;
  const { a } = G;
  const W = a + 10, H = 18;
  const c0 = a + 2, c1 = a + 4;
  const e0 = a + 6, e1 = a + 8;
  const rooms: HandInteriorRoom[] = [
    { id: "toilet", x0: c0 + 1, y0: 1, x1: c1, y1: 4, floor: P.wash, wall: P.washWall },
    { id: "kids", x0: 1, y0: 6, x1: a, y1: 10, floor: P.upper, wall: P.upperWall },
    { id: "hall-2f", x0: c0, y0: 6, x1: c1, y1: 16, floor: P.hall, wall: P.upperWall },
    { id: "washitsu", x0: e0, y0: 6, x1: e1, y1: 10, floor: "tatami", wall: "juraku" },
    { id: "bedroom", x0: 1, y0: 12, x1: a, y1: 16, floor: P.bed, wall: P.upperWall },
    { id: "study", x0: e0, y0: 12, x1: e1, y1: 16, floor: P.upper, wall: P.upperWall },
  ];
  const side: HandInteriorConnect[] = [
    { a: "hall-2f", b: "kids", at: 10, door: "door-side-western" },
    { a: "hall-2f", b: "washitsu", at: 10, door: "door-side-sliding" },
    { a: "hall-2f", b: "bedroom", at: 16, door: "door-side-western" },
    { a: "hall-2f", b: "study", at: 16, door: "door-side-western" },
  ];
  const connect: HandInteriorConnect[] = [...side, { a: "hall-2f", b: "toilet", at: c1, door: "door-open-toilet" }];
  const d: Draft = { objects: [], tables: [], goods: [] };
  // ── 화장실(1층 화장실 바로 위) ──
  o(d, "toilet", c0 + 1, 3);
  // 북벽 윗줄 두 칸뿐(문은 남쪽 c1 열) — 화장실 선반(여분 휴지·방향제)이 있으면 변기 위 작은 창 자리에, 휴지걸이는 문 열 그대로.
  o(d, has(S, "toilet-shelf") ? "toilet-shelf" : "window-sash-small", c0 + 1, 1); o(d, "toilet-paper", c1, 1);
  o(d, "toilet-mat", c0 + 1, 4); o(d, "toilet-slippers", c1, 4);
  // ── 2층 복도: 북쪽 끝 계단통(1층 계단 바로 위 — 같은 열·같은 줄), 가운데 화분, 남쪽 화분 ──
  o(d, "stairwell-down-wood", c0, 8);
  o(d, "houseplant", c0, 12);
  o(d, "houseplant", c0, 15);
  // ── 아이방: 이층 침대·공부 책상+의자·책장·장난감 선반·옷장, 놀이 매트, 방석 ──
  o(d, "bunk-bed", 1, 8); o(d, "desk-study", 2, 8); g(d, "desk-lamp", 3, 8); o(d, "desk-chair-n", 2, 9);
  o(d, "bookshelf", 4, 8); o(d, "hs-toy-shelf", 5, 8); o(d, "wardrobe", a - 1, 8);
  o(d, "window-sash", 2, 6); o(d, G.variant === 1 ? "curtain-window" : "window-sash", 5, 6);
  o(d, "hs-kids-mat", 5, 9); o(d, "floor-lamp", a, 9);
  o(d, "cushion-floor", 1, 10); o(d, "cushion-floor", 2, 10);
  // ── 화실(3×3, 4.5첩): 장롱·도코노마 / 방석 셋 / 좌탁 — 북벽이 바깥이라 쇼지 창 ──
  o(d, "tansu", e0, 8); o(d, "tokonoma", e0 + 1, 8);
  o(d, "zabuton", e0, 9); o(d, "zabuton", e0 + 1, 9); o(d, "zabuton", e1, 9);
  o(d, "zataku", e0 + 1, 10); g(d, "tea-set", e0 + 1, 10);
  // ── 부부 침실: 옷장 | 협탁 — 2인 침대(가운데) — 협탁 | 낮은 서랍장, 침대 발치 슬리퍼, 서쪽 깔개, 동쪽 스탠드 ──
  o(d, "wardrobe", 1, 14); o(d, "bed-side-table", 3, 14); g(d, "alarm-clock", 3, 14);
  o(d, "bed-double", 4, 14); o(d, "bed-side-table", 6, 14); o(d, "dresser-low", a - 1, 14);
  o(d, "ac-unit", 4, 12);                      // 북벽은 아이방과의 칸막이 — 창 없음
  o(d, "rug", 1, 15); o(d, "slippers", 4, 16);
  o(d, G.variant === 1 ? "mirror-stand" : "floor-lamp", a, 15);
  // ── 서재(3×3): 책상·책장 / 의자 / 방석·화분 ──
  o(d, "desk-study", e0, 14); g(d, "laptop", e0 + 1, 14); o(d, "bookshelf", e1, 14); o(d, "desk-chair-n", e0 + 1, 15);
  o(d, "wall-clock", e1, 12);                  // 북벽은 화실과의 칸막이 — 창 없음
  o(d, "cushion-floor", e0 + 1, 16); o(d, "houseplant", e1, 16);
  const D = G.flip ? mirror(W, S, d) : d;
  const fx = (x: number, w = 1) => (G.flip ? W - w - x : x);
  const roomsOut = G.flip ? rooms.map((r) => mirrorRoom(W, r)) : rooms;
  const connectOut = connect.map(mirrorConnect(W, G.flip, new Set(side)));
  // 위층은 바깥으로 나가는 출구가 없다 — rooms 로 칸막이·문을 계산한 뒤 맨 아래 줄 출구 틈을 막아 plan 으로 넘긴다.
  const composed = composeHandInteriorRooms(roomsOut, connectOut, { room: "hall-2f", x: fx(c0 + 1) }, S);
  const plan = composed.plan.map((row, y) => (y === H - 1 ? "#".repeat(row.length) : row));
  // 계단통 2×2(윗줄 난간 막힘·아랫줄 밟음) — 이동(links)은 바로 남쪽 두 칸(탈 자리), 1층에서 올라오면 그 아래 줄.
  const well = { x: fx(c0, 2), y: 8 };
  const landing = { x: fx(c0 + 1), y: 11 };
  return {
    tileset: "jp_city", floor: P.upper, wall: P.upperWall,
    plan, start: [landing], zones: composed.zones,
    objects: [...composed.doors, ...D.objects], tables: D.tables, lines: [], goods: D.goods, daises: [],
    areas: roomsOut.map((r) => ({ name: AREA_NAME[r.id] ?? r.id, x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 })),
    decisions: [
      `일본 집 2층 구조(씨앗 ${seed}): 1층 격자를 그대로 쌓음 — 가운데 세로 복도(계단통)·북쪽 화장실(1층 화장실 위), 서쪽 위 아이방·서쪽 아래 부부 침실·동쪽 위 화실·동쪽 아래 서재. 바깥 출구 없음(계단으로만)`,
      `${W}×${H}${G.flip ? " · 동서 뒤집음" : ""} · 1층 바깥선 안(현관 돌출 두 줄은 지붕)`,
      `계단통 (${well.x},${well.y}) 2×2(1층 계단 바로 위) 앞 탈 자리 (${well.x},${well.y + 2})(${well.x + 1},${well.y + 2}) — 같은 씨앗 jp-house-1f 의 계단 앞 칸으로 잇는다. 1층에서 올라오면 (${landing.x},${landing.y})`,
    ],
    stairs: { from: [{ x: well.x, y: well.y + 2 }, { x: well.x + 1, y: well.y + 2 }], to: landing },
    layoutRooms: roomsOut,
  };
}

/** program 이름 → 층(일본 집 청사진이 아니면 undefined). 옛 예제 이름 house-1f·house-2f·건물 id jp_house 도 받는다. */
export function jpHouseFloorOf(program: string): 1 | 2 | undefined {
  const p = program.trim().toLowerCase();
  if (p === "jp-house-1f" || p === "house-1f" || p === "jp_house" || p === "jp-house") return 1;
  if (p === "jp-house-2f" || p === "house-2f") return 2;
  return undefined;
}

export function composeJpHouseBlueprint(program: string, S: HandInteriorSpec, seed: number): JpHouseBlueprint | undefined {
  const floor = jpHouseFloorOf(program);
  if (!floor) return undefined;
  return floor === 1 ? composeJpHouse1F(S, seed) : composeJpHouse2F(S, seed);
}

export type { Pt };
