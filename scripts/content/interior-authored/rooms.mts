// 손으로 짠 방 견본 목록 — 형식은 lib.mts 머리 주석. 크기는 벽면 두 줄 포함 (폭 = plan 글자 수, 높이 = plan 줄 수 + 2).
// 문은 짓기가 남쪽 벽 가운데 근처에 낸다 — 맨 아래 줄 가운데 두 칸은 비워 둔다. 학생 자리는 책상 1×1 + 그 아래 북향 의자(학생 책상 그림은 의자가 책상 위쪽에 붙어 칠판을 등진다 — 1판 적대 검수).
// 문 칸: 폭 w 이면 남쪽 벽 x = floor((w-1)/2) 근처 — 맨 아래 줄 그 칸은 비운다. 건 것(hang)은 키 큰 벽 가구가 그려지는 칸 위에 두지 않는다(build 의 겹침 검사).
import type { AuthoredRoom } from "./lib.mts";

const SCHOOL = { b: "cabinet:book+bookb+bookg", W: "window", B: "blackboard", M: "wall map", C: "wall clock", S: "bookshelf 2w", s: "bookshelf 1w", h: "chair S", e: "desk 1x1", n: "chair N", T: "desk 3x1", g: "globe", P: "potted fern", m: "map rolls", k: "chest" };
const SHOP = { W: "window", L: "shelf:candle", R: "weapon rack", I: "item shop shelf", H: "helmet shelf", p: "cabinet:potion+potionb+potiong", j: "cabinet:jar+jarb+jarg", d: "cabinet:candle", C: "counter 3x1", c: "counter 4x1", D: "display 2x1", t: "table:potion+flask", A: "armor stand", b: "barrel", x: "crate", s: "sack", r: "arrow barrel", P: "potted fern", k: "chest" };
// L 은 작업대(work 2x1) — 원래 lab bench 였으나 그림의 빨강·흰 공이 몬스터 공을 닮아 견본에서 뺐다(2026-10-29, 칩셋 그림은 그대로).
const LAB = { x: "crate", W: "window", K: "shelf:skull+crystal", H: "hang:herb", V: "shelf:vial+flask", S: "bookshelf 2w", s: "bookshelf 1w", p: "specimen shelf", d: "apothecary drawers", c: "cauldron", A: "alembic", L: "work 2x1", Z: "alchemy table", w: "work 2x1", o: "stool", b: "barrel", k: "chest", g: "globe", m: "magic circle" };
const JAIL = { g: "dining 3x1", S: "shackles", T: "wall torch", Z: "straw bed", u: "slop bucket", q: "drip puddle", t: "dining 2x1", o: "stool", R: "weapon barrel", A: "armor stand", B: "brazier", b: "barrel", k: "chest", x: "crate" };
const CHAPEL = { W: "window", T: "tall stained window", L: "sanctuary lamp", A: "altar E", c: "candelabra", v: "votive stand", l: "lectern", p: "pew E2", f: "holy water font", P: "potted flowering", k: "chest" };
const STUDY = { W: "window", M: "wall map", p: "picture", b: "cabinet:book+bookb+bookg", S: "bookshelf 2w", s: "bookshelf 1w", c: "clock", T: "desk 3x1", t: "desk 2x1", n: "chair N", a: "armchair", r: "dining 1x1", g: "globe", e: "telescope", k: "chest", m: "map rolls" };
const BED = { W: "window", C: "curtained window", p: "picture", B: "bed red", D: "double bed red", n: "nightstand", w: "wardrobe", G: "gilded wardrobe", t: "desk 2x1", h: "chair N", a: "armchair", k: "chest", P: "potted flowering", c: "clock" };
const STORE = { L: "shelf pots", b: "barrel", x: "crate", s: "sack", g: "sack:grain", k: "chest", r: "broom and bucket", w: "weapon barrel" };

// 채택: 방마다 Opus 적대 검수 PASS(major 이상 0) + build 의 겹침·닿음 검사 + check.mts 의 짓기 도달(빠진 가구 0·닿지 못한 바닥 0).
// 5판 검수까지 휑한 바닥으로 FAIL 한 잡화점 큰 판(11×9)·작은 예배당(10×9)은 뺐다 — 큰 잡화점은 중간 판, 예배당은 13×9 판과 원본 31×13 이 맡는다.
export const ROOMS: AuthoredRoom[] = [
  // ── 교실(예제 맵에 없음) ── 칠판·교사 책상과 의자·학생 책상(1×1)+북향 의자 줄·책장·지구본, 칠판과 교사 책상은 가운데 축
  { id: "classroom-s", kind: "classroom", style: "town", floor: "plank", wall: "plaster", legend: SCHOOL,
    hang: ".W.B..W.",
    plan: [
      "s..h...g",
      "..T.....",
      "........",
      ".ee..ee.",
      ".nn..nn.",
    ],
    goods: [[2, 1, "openbook"], [4, 1, "inkwell"], [1, 3, "book"], [6, 3, "papers"]] },
  { id: "classroom-m", kind: "classroom", style: "town", floor: "plank", wall: "plaster", legend: SCHOOL,
    hang: ".W..B...W.",
    plan: [
      "s...h....g",
      "...T......",
      "..........",
      ".e.e..e.e.",
      ".n.n..n.n.",
      ".e.e..e.e.",
      "kn.n..n.nm",
    ],
    goods: [[3, 1, "openbook"], [5, 1, "inkwell"], [1, 3, "book"], [8, 3, "papers"], [3, 5, "bookb"], [6, 5, "inkwell"]] },
  { id: "classroom-l", kind: "classroom", style: "town", floor: "plank", wall: "plaster", legend: SCHOOL,
    hang: ".W...B..M..W.",
    plan: [
      "s..b..h...b.g",
      "..P..T...m...",
      ".............",
      ".ee.ee.ee.ee.",
      ".nn.nn.nn.nn.",
      ".ee.ee.ee.ee.",
      ".nn.nn.nn.nn.",
      ".............",
    ],
    goods: [[5, 1, "openbook"], [6, 1, "bookstack"], [7, 1, "inkwell"], [1, 3, "book"], [8, 3, "papers"], [4, 5, "bookg"], [10, 5, "inkwell"]] },
  // ── 잡화점(빵·약·옷 가게 견본만 있었다) ── 벽 진열(잡화 선반·투구 선반·약장) 앞 주인 통로, 그 앞 계산대, 무기 걸이·갑옷·화살 통·진열 탁자
  { id: "general-store-s", kind: "general_store", style: "town", floor: "plank", wall: "plaster", legend: SHOP,
    hang: "..W..W.",
    plan: [
      "I..H..p",
      ".......",
      ".......",
      "C.....b",
      "....A.x",
      "r.....s",
    ],
    goods: [[0, 3, "cashbox"], [1, 3, "scale"], [2, 3, "bell"]] },
  { id: "general-store-m", kind: "general_store", style: "town", floor: "plank", wall: "plaster", legend: SHOP,
    hang: "..W..R.W.",
    plan: [
      "I..H..p.d",
      ".........",
      "c.......b",
      "........x",
      "..D...A..",
      "r.......s",
    ],
    goods: [[0, 2, "cashbox"], [1, 2, "scale"], [3, 2, "bell"], [2, 4, "potion"], [3, 4, "candle"]] },
  // ── 연구실(연금 작은 방 둘뿐) ── 실험대·연금 탁자 위에 기구, 솥·표본장·약재 서랍·책장, 큰 방은 가운데 마법진
  // laboratory-m(9×7)은 lab bench(몬스터 공을 닮은 그림)를 빼고 다시 받은 Sonnet 검수에서 휑한 바닥·연금술 공방 인상으로 FAIL 해 뺐다(2026-10-29) — 연구실은 laboratory-s·l·xl2 가 맡는다.
  { id: "laboratory-l", kind: "laboratory", style: "fantasy", floor: "flag", wall: "stone", legend: LAB,
    hang: "...K.H..W.",
    plan: [
      "S.p.c..d..",
      ".........b",
      ".w....Z..x",
      ".o.m...o..",
      "..........",
      "b.......k.",
    ],
    goods: [[1, 2, "smallflask"], [2, 2, "openbook"], [6, 2, "mortar"], [7, 2, "potiong"]] },
  // ── 감옥(감방 한 칸 견본뿐) ── 같은 폭 감방, 창살 칸막이(틈 한 칸 — 잠긴 문을 끼우면 감방 바닥이 닫혀 짓기가 창살을 통째로 뺀다), 간수 탁자·무기 통·화로
  { id: "jail-m", kind: "jail", style: "fantasy", floor: "dungeon", wall: "dungeonw", legend: JAIL, lines: { "~": "bars" },
    hang: ".S.T.S.",
    plan: [
      "Z..~Z..",
      "..u~..u",
      "~.~~~.~",
      "..t.o.R",
      ".......",
      "x.....B",
    ],
    goods: [[2, 3, "dice"], [3, 3, "mug"]] },
  { id: "jail-l", kind: "jail", style: "fantasy", floor: "dungeon", wall: "dungeonw", legend: JAIL, lines: { "~": "bars" },
    hang: ".S.T.S.T.S.",
    plan: [
      "Z..~Z..~Z..",
      "..u~..u~..u",
      "~.~~~.~~~.~",
      "...........",
      "...og..o...",
      "A........R.",
      "x.k.......B",
    ],
    goods: [[4, 4, "dice"], [5, 4, "mug"], [6, 4, "keys"]] },
  // ── 작은 예배당(예제는 31×13 큰 성당 하나) ── 원본 성당처럼 동쪽 제단(옆에서 본 독립 제단)을 보는 회중석 두 덩이, 가운데 통로 깔개
  { id: "chapel-m", kind: "chapel", style: "noble", floor: "flag", wall: "stone", legend: CHAPEL, lines: { "~": "rug red" },
    hang: ".T..T..T..L..",
    plan: [
      ".............",
      ".p.p.p.p....c",
      ".........A...",
      "~~~~~~~~~....",
      ".p.p.p.p....c",
      "..........l..",
      "f..........vP",
    ],
    goods: [] },
  // ── 작은 서재(방탈출 6×7·8×8) ──
  { id: "study-s", kind: "study", style: "noble", floor: "dplank", wall: "plaster", legend: STUDY,
    hang: "..W.p.",
    plan: [
      "S..s.c",
      "......",
      ".t..a.",
      ".n...g",
      "k.....",
    ],
    goods: [[1, 2, "openbook"], [2, 2, "candlestick"]] },
  { id: "study-m", kind: "study", style: "noble", floor: "dplank", wall: "plaster", legend: STUDY, lines: { "~": "rug red" },
    hang: "...M...W",
    plan: [
      "S.b...c.",
      "........",
      ".T....ar",
      "..n.~~~.",
      "g...~~~e",
      "k.......",
    ],
    goods: [[1, 2, "openbook"], [2, 2, "inkwell"], [3, 2, "candlestick"], [7, 2, "teapot"]] },
  // ── 작은 침실(방탈출) ──
  { id: "bedroom-s", kind: "bedroom", style: "town", floor: "dplank", wall: "plaster", legend: BED, lines: { "~": "rug red" },
    hang: "..W.p.",
    plan: [
      "Bn.w..",
      ".~~...",
      ".~~.t.",
      "....h.",
      "k.....",
    ],
    goods: [[1, 0, "candle"], [4, 2, "papers"]] },
  { id: "bedroom-m", kind: "bedroom", style: "town", floor: "dplank", wall: "plaster", legend: BED, lines: { "~": "rug red" },
    hang: "...p..C.",
    plan: [
      "D.n..w.P",
      "........",
      ".~~~..t.",
      ".~~~..h.",
      "........",
      "k......P",
    ],
    goods: [[2, 0, "candle"], [6, 2, "papers"]] },
  // ── 작은 창고(방탈출) ──
  { id: "storeroom-s", kind: "storeroom", style: "town", floor: "plank", wall: "plaster", legend: STORE,
    hang: "..L...",
    plan: [
      "bx.wsg",
      "......",
      "...xb.",
      "x....s",
      "s....r",
    ] },
];
