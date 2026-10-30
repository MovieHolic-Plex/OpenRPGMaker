// 방탈출·추리 게임 방 견본 — 서재 5×6·7×7·9×8, 창고 7×6·8×7, 침실 6×6·7×8(형식은 lib.mts 머리 주석, 관례는 rooms.mts).
// 실제 게임 판에서 서재가 5×6 으로 빽빽하거나 10×9 로 휑했고, 뒷방 창고 7×6 한 줄이 비었고, 2층 객실 7×8 아래 절반이 휑했다(2026-10-29).
// 채택: 방마다 Sonnet 적대 검수 PASS(major 이상 0) + build 겹침·닿음 검사 + check.mts 짓기(빠진 가구 0·닿지 못한 바닥 0). 서재 큰 판은 10×9 가 두 판 휑해서 9×8 로 줄였다.
import type { AuthoredRoom } from "./lib.mts";

const STUDY = { W: "window", M: "wall map", p: "picture", b: "cabinet:book+bookb+bookg", B: "bookshelf 3w", S: "bookshelf 2w", s: "bookshelf 1w", c: "clock", T: "desk 3x1", t: "desk 2x1", n: "chair N", a: "armchair", r: "dining 1x1", g: "globe", e: "telescope", k: "chest", m: "map rolls", C: "chart table", o: "stool", Z: "safe", P: "potted fern", u: "luggage trunk", R: "table:book+scroll" };
const BED = { W: "window", C: "curtained window", p: "picture", B: "bed red", D: "double bed red", n: "nightstand", w: "wardrobe", V: "vanity mirror", t: "desk 2x1", h: "chair N", a: "armchair", k: "chest", P: "potted flowering", u: "luggage trunk", r: "coat rack", T: "dining 1x1" };
const STORE = { L: "shelf pots", b: "barrel", x: "crate", s: "sack", g: "sack:grain", k: "chest", r: "broom and bucket", w: "weapon barrel", X: "crate stack", Y: "barrel stack", Q: "sack pile", W: "wide cabinet", J: "cabinet:jar+jarb+jarg" };

export const ROOMS: AuthoredRoom[] = [
  // ── 방탈출 서재 ── 책장·책상과 북향 의자, 지구본·지도·상자·금고처럼 조사할 물건
  { id: "study-xs", kind: "study", style: "noble", floor: "dplank", wall: "plaster", legend: STUDY,
    hang: "..W.p",
    plan: [
      "S.t..",
      "...n.",
      "gr...",
      "a...k",
    ],
    goods: [[2, 0, "openbook"], [3, 0, "candlestick"], [1, 2, "teapot"]] },
  { id: "study-sq", kind: "study", style: "noble", floor: "dplank", wall: "plaster", legend: STUDY, lines: { "~": "rug red" },
    hang: "...W.M.",
    plan: [
      "S.b.T..",
      "..~~~n.",
      "g.~~~..",
      "ra....e",
      "......k",
    ],
    goods: [[4, 0, "openbook"], [5, 0, "inkwell"], [6, 0, "candlestick"], [0, 3, "teapot"]] },
  { id: "study-l", kind: "study", style: "noble", floor: "dplank", wall: "plaster", legend: STUDY, lines: { "~": "rug red" },
    hang: "....W.p..",
    plan: [
      "B..cT..S.",
      ".....ne..",
      "a~~~....g",
      "r~~~.oC..",
      "k........",
      "P.m...u.Z",
    ],
    goods: [[4, 0, "openbook"], [5, 0, "inkwell"], [6, 0, "candlestick"], [0, 3, "teapot"]] },
  // ── 뒷방·창고 ── 벽 따라 넓은 장·단지 장·통·상자, 가운데 통로, 아래에 쌓은 상자·통 더미
  { id: "storeroom-m", kind: "storeroom", style: "town", floor: "plank", wall: "plaster", legend: STORE,
    hang: ".......",
    plan: [
      "W.b.xJs",
      "g......",
      "....r..",
      "X.s..Y.",
    ] },
  { id: "storeroom-l", kind: "storeroom", style: "town", floor: "plank", wall: "plaster", legend: STORE,
    hang: "...L..L.",
    plan: [
      "W.b.xJ.s",
      "........",
      "..wk....",
      "X....Y..",
      "g.....rs",
    ] },
  // ── 침실(추리 여관 객실·방탈출) ──
  { id: "bedroom-sq", kind: "bedroom", style: "town", floor: "dplank", wall: "plaster", legend: BED, lines: { "~": "rug red" },
    hang: "..W.p.",
    plan: [
      "Bn.w.V",
      "...~~~",
      "t..~~~",
      "h...Pk",
    ],
    goods: [[1, 0, "candle"], [0, 2, "papers"]] },
  { id: "bedroom-t", kind: "bedroom", style: "town", floor: "dplank", wall: "plaster", legend: BED, lines: { "~": "rug red" },
    hang: "..W.p..",
    plan: [
      "D.n..wP",
      ".......",
      ".~~~.t.",
      "a~~~.h.",
      "T...u..",
      "P.k...r",
    ],
    goods: [[2, 0, "candle"], [5, 2, "papers"], [0, 4, "teapot"]] },
];
