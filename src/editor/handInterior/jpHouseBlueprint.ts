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

/** 씨앗 → 바깥선 치수(1층·2층 공용). a = 서쪽 띠 폭(부엌·거실 / 아이방·침실), e = 동쪽 띠 폭(탈의실 / 화실·서재). */
export interface JpHouseGeometry { readonly a: number; readonly e: number; readonly flip: boolean; readonly palette: number; readonly variant: number }
export function jpHouseGeometry(seed: number): JpHouseGeometry {
  if (Math.floor(seed) <= 1) return { a: 8, e: 7, flip: false, palette: 0, variant: 0 };
  const r = rng(seed * 2654435761);
  return { a: 7 + Math.floor(r() * 3), e: 7 + Math.floor(r() * 2), flip: r() < 0.5, palette: Math.floor(r() * 3), variant: Math.floor(r() * 2) };
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

/**
 * 1층. 좌표(뒤집기 전, a=8·e=7 이면 22×21):
 *   화장실 x a+3..a+4, y1..4 (북쪽 복도 위로 튀어나옴) / 북쪽 띠 y6..10: 부엌 x1..a · 북쪽 복도 x a+2..a+4 · 탈의실 x a+6..a+5+e
 *   남쪽 띠 y12..19: 거실 x1..a · 가운데 복도 x a+2..a+6(계단 = 북쪽 복도와 탈의실 사이 칸막이 열 아래) · 욕실 x a+8..a+5+e, y12..16
 */
export function composeJpHouse1F(S: HandInteriorSpec, seed: number): JpHouseBlueprint {
  const G = jpHouseGeometry(seed);
  const P = PALETTES[G.palette]!;
  const { a, e } = G;
  const W = a + e + 7, H = 21;
  const hn0 = a + 2, hn1 = a + 4;              // 북쪽 복도
  const col = a + 5;                           // 북쪽 복도 | 탈의실 칸막이 열 = 계단 열(그 위가 끝까지 막혀 계단이 칸막이에 박히지 않는다)
  const w0 = a + 6, w1 = a + 5 + e;            // 탈의실
  const hc0 = a + 2, hc1 = a + 6;              // 가운데 복도
  const b0 = a + 8, b1 = w1;                   // 욕실
  const rooms: HandInteriorRoom[] = [
    { id: "toilet", x0: hn0 + 1, y0: 1, x1: hn1, y1: 4, floor: P.wash, wall: P.washWall },
    { id: "kitchen", x0: 1, y0: 6, x1: a, y1: 10, floor: P.kitchen, wall: P.kitchenWall },
    { id: "hall-north", x0: hn0, y0: 6, x1: hn1, y1: 10, floor: P.hall, wall: P.livingWall },
    { id: "dressing", x0: w0, y0: 6, x1: w1, y1: 10, floor: P.wash, wall: P.washWall },
    { id: "ldk", x0: 1, y0: 12, x1: a, y1: 19, floor: P.living, wall: P.livingWall },
    { id: "hall", x0: hc0, y0: 12, x1: hc1, y1: 19, floor: P.hall, wall: P.livingWall },
    { id: "bath", x0: b0, y0: 12, x1: b1, y1: 16, floor: "bathtile", wall: "bathwall" },
  ];
  const kOpen = Math.max(2, a - 3);            // 부엌↔거실 트임 왼쪽 끝(2칸)
  const bathDoor = b1 - 1;
  const connect: HandInteriorConnect[] = [
    { a: "hall", b: "hall-north", at: hn0 + 1, door: "door-open-western" },
    { a: "hall-north", b: "toilet", at: hn1, door: "door-open-toilet" },
    { a: "kitchen", b: "hall-north", open: true },
    { a: "hall", b: "dressing", at: w0, door: "door-open-western" },
    { a: "dressing", b: "bath", at: bathDoor, door: S.objects["kr-shower-door"] ? "kr-shower-door" : "door-open-western" },
    { a: "kitchen", b: "ldk", open: true, at: kOpen, span: 2 },
  ];
  const genkanX = hc0 + 3;                      // 현관 출구(가운데 복도 남쪽, 계단 아래쪽 줄)
  const d: Draft = { objects: [], tables: [], goods: [] };
  // ── 화장실(1칸 폭 변기 + 문 칸) ──
  o(d, "toilet", hn0 + 1, 3); o(d, "window-sash-small", hn0 + 1, 1); o(d, "toilet-handwash", hn1, 1);   // 북벽이 바깥 — 작은 창
  o(d, "toilet-mat", hn0 + 1, 4); o(d, "toilet-slippers", hn1, 4);
  // ── 부엌: 북쪽 벽 한 줄(냉장고·조리대·싱크·가스대) + 창·달력, 쓰레기통 ──
  o(d, "fridge", 1, 8);
  // 북쪽 복도로 트인 동쪽 끝 열(x=a)은 비운다 — 부엌↔복도가 한 줄 목이 되지 않게.
  const run = ["kitchen-worktop", "kitchen-sink", "kitchen-worktop", "kitchen-stove", "kitchen-worktop"];
  run.forEach((id, i) => { if (2 + i <= a - 2) o(d, id, 2 + i, 8); });
  o(d, "microwave-rack", a - 1, 8);
  o(d, "window-sash", 3, 6); o(d, "calendar", a, 6);
  g(d, "rice-cooker", 2, 8); g(d, "kettle", 4, 8);
  o(d, "trash-bins", 1, 10);
  d.tables.push({ style: "kcounter", x: 3, y: 10, w: 2, h: 1 });   // 작업대(한 줄) — 분리수거함 곁(2,10)과 트임 앞 칸은 비운다
  // ── 북쪽 복도: 높은 창·스위치 ──
  o(d, "window-sash-small", hn0, 6); o(d, "light-switch", hn0 + 1, 6);
  // ── 탈의실: 세면대(거울)·세탁기·빨래 바구니·수건걸이·높은 창, 욕실 문 앞 매트 ──
  o(d, "washbasin", w0 + 1, 8); g(d, "toothbrush-cup", w0 + 1, 8);
  o(d, "washing-machine", w0 + 2, 8); o(d, "laundry-basket", w0 + 3, 8);
  o(d, "towel-rack", w0 + 3, 6); o(d, "window-sash-small", w1 - 1, 6);
  o(d, "bath-mat", bathDoor, 10); o(d, "laundry-rack", w0 + 4, 9);
  // ── 욕실(유닛 배스): 욕조·샤워·거울·작은 창·의자·바가지 ──
  o(d, "bathtub", b0, 14); o(d, "shower-faucet", b0 + 2, 12); o(d, "bath-mirror", b0 + 1, 12);   // 욕실 북벽은 탈의실과의 칸막이 — 창을 달지 않는다
  o(d, "bath-stool", b0 + 2, 15); o(d, "bath-bucket", b0 + 1, 15);
  // ── 거실 겸 식당: 북쪽 벽 TV보드·에어컨·식기장, 러그 위 식탁+의자 넷, 구석 화분 ──
  o(d, "ac-unit", 1, 12); o(d, "tv-board", 1, 14); g(d, "remote", 2, 14);
  o(d, "cupboard", a, 14);
  // 서쪽 = 거실(TV — 깔개 — TV 를 보는 소파가 한 열), 동쪽 = 식당(부엌 트임 아래 식탁 2×2 + 의자 넷).
  const tx = a - 2;
  d.tables.push({ style: "dining", x: tx, y: 16, w: 2, h: 2 });
  o(d, "chair-dining-e", tx - 1, 16); o(d, "chair-dining-e", tx - 1, 17);
  o(d, "chair-dining-w", tx + 2, 16); o(d, "chair-dining-w", tx + 2, 17);
  g(d, "plates", tx, 16); g(d, "fruit-bowl", tx + 1, 17);
  o(d, "rug", 1, 16); o(d, "sofa-n", 1, 19); o(d, "houseplant", a, 19);
  if (G.variant === 1) o(d, "floor-lamp", 3, 19);
  // ── 가운데 복도·현관 ──
  o(d, "stairs-up-wood", col, 14);
  o(d, "wall-clock", hc0, 12); o(d, "intercom", hc0 + 2, 12); o(d, "houseplant", hc0, 14);
  o(d, "getabako", hc0, 19); g(d, "sh-bouquet", hc0, 19);
  o(d, "umbrella-stand", hc1, 19);
  for (let x = hc0; x <= hc1; x++) o(d, "agarikamachi", x, 17);   // 현관 단·타타키는 복도 폭 전부(마루가 타타키 옆으로 흘러내리지 않게)
  o(d, "slippers", hc0 + 2, 16); o(d, "genkan-mat", hc0 + 3, 16);
  o(d, "shoes-pair", hc0 + 2, 18);
  o(d, "genkan-door", genkanX, 20);
  const zones: HandInteriorZone[] = [{ x0: hc0, y0: 18, x1: hc1, y1: 19, floor: "tataki" }];
  const D = G.flip ? mirror(W, S, d) : d;
  const fx = (x: number, w = 1) => (G.flip ? W - w - x : x);
  const exit: HandInteriorExit = { room: "hall", x: fx(genkanX) };
  const roomsOut = G.flip ? rooms.map((r) => mirrorRoom(W, r)) : rooms;
  const connectOut = connect.map((c) => (c.at === undefined || (c.open && !c.span) ? c : { ...c, at: fx(c.at, c.span ?? 1) }));
  const zonesOut = zones.map((z) => (G.flip ? { ...z, x0: W - 1 - z.x1, x1: W - 1 - z.x0 } : z));
  // 문·트임이 실제로 맞는지 여기서 한 번 계산해 본다(겹침·칸막이 오류는 조립 전에 드러난다).
  composeHandInteriorRooms(roomsOut, connectOut, exit, S);
  // 계단(벽 가구, 위로 솟음)은 바로 아래 칸이 탈 자리다 — 이동(links)은 그 칸에, 2층에서 내려오면 그 서쪽(뒤집으면 동쪽) 칸.
  const stairsCell = { x: fx(col), y: 15 };
  const arrive = { x: fx(col - 1), y: 15 };
  return {
    tileset: "jp_city", floor: P.hall, wall: P.livingWall,
    rooms: roomsOut, connect: connectOut, exit, zones: zonesOut,
    objects: D.objects, tables: D.tables, lines: [], goods: D.goods, daises: [],
    areas: roomsOut.map((r) => ({ name: AREA_NAME[r.id] ?? r.id, x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 })),
    decisions: [
      `일본 집 1층 구조(씨앗 ${seed}): 북쪽 띠 부엌·북쪽 복도·탈의실, 화장실은 북쪽 복도 뒤 작은 방, 욕실은 탈의실 바로 아래, 남서 거실 겸 식당(부엌과 트임), 가운데 복도 북쪽 벽 계단·남쪽 현관`,
      `${W}×${H}${G.flip ? " · 동서 뒤집음" : ""} · 서쪽 띠 ${a}칸 · 동쪽 띠 ${e}칸`,
      `계단 (${fx(col)},14) 앞 탈 자리 (${stairsCell.x},${stairsCell.y}) — 같은 씨앗의 jp-house-2f 계단통 앞 칸으로 잇는다(links). 2층에서 내려오면 (${arrive.x},${arrive.y})`,
    ],
    stairs: { from: [stairsCell], to: arrive },
    layoutRooms: roomsOut,
  };
}

const AREA_NAME: Record<string, string> = {
  toilet: "화장실", kitchen: "부엌", "hall-north": "북쪽 복도", dressing: "탈의실·세면실", ldk: "거실 겸 식당", hall: "복도·현관", bath: "욕실",
  kids: "아이방", bedroom: "부부 침실", washitsu: "화실", study: "서재", "hall-2f": "2층 복도",
};

/**
 * 2층(1층과 같은 씨앗이면 같은 바깥선, 1층 y-5). 위 띠 y1..5: 아이방 x1..a · 가운데 세로 복도 x a+2..a+5(y1..10) · 화실 x a+7..a+6+e-1
 * 아래 띠 y7..15: 부부 침실 x1..a · 서재 x a+7.. · 복도 남쪽 끝 화장실 x a+2..a+5, y12..15. 계단통 2×2 = 1층 계단 열 위.
 */
export function composeJpHouse2F(S: HandInteriorSpec, seed: number): JpHouseBlueprint {
  const G = jpHouseGeometry(seed);
  const P = PALETTES[G.palette]!;
  const { a, e } = G;
  const W = a + e + 7, H = 17;
  const s0 = a + 2, s1 = a + 5;                // 가운데 세로 복도(1층 북쪽 복도 + 계단 열)
  const r0 = a + 7, r1 = W - 2;                // 동쪽 방
  const rooms: HandInteriorRoom[] = [
    { id: "kids", x0: 1, y0: 1, x1: a, y1: 6, floor: P.upper, wall: P.upperWall },
    { id: "hall-2f", x0: s0, y0: 1, x1: s1, y1: 10, floor: P.hall, wall: P.upperWall },
    { id: "washitsu", x0: r0, y0: 1, x1: r1, y1: 6, floor: "tatami", wall: "juraku" },
    { id: "bedroom", x0: 1, y0: 8, x1: a, y1: 15, floor: P.bed, wall: P.upperWall },
    { id: "study", x0: r0, y0: 8, x1: r1, y1: 15, floor: P.upper, wall: P.upperWall },
    { id: "toilet", x0: s0, y0: 12, x1: s1, y1: 15, floor: P.wash, wall: P.washWall },   // 벽면 두 줄 + 바닥 두 줄(변기 앞에 설 자리)
  ];
  const connect: HandInteriorConnect[] = [
    { a: "hall-2f", b: "kids", at: 6, door: "door-side-western" },
    { a: "hall-2f", b: "washitsu", at: 6, door: "door-side-sliding" },
    { a: "hall-2f", b: "bedroom", at: 10, door: "door-side-western" },
    { a: "hall-2f", b: "study", at: 10, door: "door-side-western" },
    { a: "hall-2f", b: "toilet", at: s0, door: "door-open-toilet" },
  ];
  const d: Draft = { objects: [], tables: [], goods: [] };
  // ── 가운데 복도: 계단통(1층 계단 열 위), 북쪽 창·책장, 실내 건조대 ──
  const sw = a + 4;                            // 계단통 왼쪽 열(오른쪽 열 = 1층 계단 열 a+5)
  o(d, "stairwell-down-wood", sw, 7);
  o(d, "window-sash", s0 + 1, 1); o(d, "bookshelf", s0, 3); o(d, "houseplant", s1, 3);   // 북쪽 끝 가운데 두 칸은 비운다
  // ── 아이방: 이층 침대·공부 책상·의자·책장·창 ──
  o(d, "bunk-bed", 1, 3); o(d, "desk-study", 3, 3); o(d, "desk-chair-n", 3, 4); g(d, "desk-lamp", 4, 3);
  o(d, "window-sash", 3, 1); o(d, "closet-doors", Math.min(a - 1, 6), 1);
  o(d, "bookshelf", 5, 3);
  o(d, "rug", a - 3, 5);
  if (G.variant === 0) { o(d, "cushion-floor", a - 1, 4); o(d, "cushion-floor", a - 2, 4); } else o(d, "floor-lamp", a, 3);
  // ── 화실: 도코노마·오시이레·장롱·좌탁+방석 ──
  o(d, "tokonoma", r0, 3); o(d, "oshiire", r0 + 2, 1); o(d, "shoji-window", r0 + 4, 1);
  if (r1 >= r0 + 6) o(d, "tansu", r1, 3);              // 장롱은 쇼지 창 옆 칸이 남을 때만(창 밑을 가리지 않게)
  o(d, "zataku", r0 + 2, 4); o(d, "zabuton", r0 + 1, 4); o(d, "zabuton", r0 + 4, 4); o(d, "zabuton", r0 + 3, 5); o(d, "zabuton", r0 + 2, 5);
  g(d, "tea-set", r0 + 2, 4);
  // ── 부부 침실: 2인 침대+협탁·옷장·화장대·창·에어컨, 러그 ──
  o(d, "bed-double", 1, 10); o(d, "bed-side-table", 3, 10); g(d, "alarm-clock", 3, 10);
  o(d, "ac-unit", 4, 8);                       // 북벽은 아이방과의 칸막이 — 창 없음
  o(d, "wardrobe", a - 2, 10); if (a >= 8) o(d, "dresser-low", 4, 10);   // 옆문 앞 (a,10) 은 비운다
  o(d, "zataku", 3, 13); o(d, "zabuton", 2, 13); o(d, "zabuton", 5, 13); o(d, "zabuton", 3, 14); o(d, "rug", 5, 14); o(d, "mirror-stand", a, 15);   // 좌탁 + 방석 셋
  if (G.variant === 1) o(d, "houseplant", 1, 15); else o(d, "floor-lamp", 1, 15);
  // ── 서재: 책상·의자·책장 둘·창·소파 ──
  o(d, "desk-study", r0 + 1, 10); o(d, "desk-chair-n", r0 + 1, 11); g(d, "laptop", r0 + 2, 10);
  o(d, "bookshelf", r0 + 3, 10); o(d, "cupboard", r0 + 4, 10); o(d, "houseplant", r1, 10);
  o(d, "wall-clock", r1, 8);                   // 북벽은 화실과의 칸막이 — 창 없음
  o(d, "low-table", r1 - 2, 14); o(d, "sofa-w", r1, 13); o(d, "chair-dining-e", r1 - 3, 14); o(d, "houseplant", r0, 15); o(d, "floor-lamp", r1, 15);   // 탁자를 소파(동)·의자(서)가 마주 본다
  // ── 화장실 ──
  o(d, "toilet", s1, 14); o(d, "toilet-paper", s1, 12); o(d, "toilet-handwash", s1 - 1, 12); o(d, "toilet-mat", s1, 15); o(d, "toilet-slippers", s1 - 1, 15);
  const D = G.flip ? mirror(W, S, d) : d;
  const fx = (x: number, w = 1) => (G.flip ? W - w - x : x);
  const roomsOut = G.flip ? rooms.map((r) => mirrorRoom(W, r)) : rooms;
  const connectOut = connect.map((c) => (c.at === undefined || /^door-side/u.test(c.door ?? "") ? c : { ...c, at: fx(c.at) }));
  // 위층은 바깥으로 나가는 출구가 없다 — rooms 로 칸막이·문을 계산한 뒤 맨 아래 줄 출구 틈을 막아 plan 으로 넘긴다.
  const composed = composeHandInteriorRooms(roomsOut, connectOut, { room: "toilet" }, S);
  const plan = composed.plan.map((row, y) => (y === H - 1 ? "#".repeat(row.length) : row));
  // 계단통 2×2(윗줄 난간 막힘·아랫줄 밟음) — 이동(links)은 바로 남쪽 두 칸(탈 자리), 1층에서 올라오면 그 아래 줄.
  const well = { x: fx(sw, 2), y: 7 };
  const landing = { x: well.x + (G.flip ? 1 : 0), y: 10 };
  return {
    tileset: "jp_city", floor: P.upper, wall: P.upperWall,
    plan, start: [landing], zones: composed.zones,
    objects: [...composed.doors, ...D.objects], tables: D.tables, lines: [], goods: D.goods, daises: [],
    areas: roomsOut.map((r) => ({ name: AREA_NAME[r.id] ?? r.id, x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 })),
    decisions: [
      `일본 집 2층 구조(씨앗 ${seed}): 가운데 세로 복도(계단통) — 서쪽 위 아이방·서쪽 아래 부부 침실·동쪽 위 화실·동쪽 아래 서재, 복도 남쪽 끝 화장실. 바깥 출구 없음(계단으로만)`,
      `${W}×${H}${G.flip ? " · 동서 뒤집음" : ""}`,
      `계단통 (${well.x},7) 2×2 앞 탈 자리 (${well.x},9)(${well.x + 1},9) — 같은 씨앗 jp-house-1f 의 계단 앞 칸 근처 (${fx(a + 4)},15) 로 잇는다. 1층에서 올라오면 (${landing.x},${landing.y})`,
    ],
    stairs: { from: [{ x: well.x, y: 9 }, { x: well.x + 1, y: 9 }], to: landing },
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
