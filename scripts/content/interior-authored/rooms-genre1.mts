// 장르 방 견본 1 — 채택: 방마다 Sonnet 적대 검수 PASS + build 겹침·닿음 검사 + check.mts 짓기(빠진 가구 0·닿지 못한 바닥 0).
// 공포 「폐병원」(병실·진료실·간호사실·지하 영안실)과 회상 「할머니 집」 다락(형식은 lib.mts 머리 주석, 관례는 rooms.mts).
// 칩셋(atlas_biome_interior)에는 현대 병원 기물이 없다 — 흰 시트 쇠 침대(patient bed)·접이 칸막이·세면대·약장·약재 서랍처럼
// 옛 치료소·수도원 병실 그림으로 짠다. 철제 병원 침대·링거 걸이·휠체어·들것·냉장 서랍장·부검대·의료 카트·커튼 레일 칸막이는 없다.
import type { AuthoredRoom } from "./lib.mts";

const CLINIC = { W: "window", C: "wall clock", V: "shelf:vial+flask", H: "shelf:herb", B: "patient bed", S: "folding screen", w: "washbasin", v: "cabinet:vial+flask", d: "apothecary drawers", s: "bookshelf 1w", t: "desk 2x1", e: "chair E", n: "chair N", o: "stool", k: "chest", x: "crate", b: "barrel", q: "table:potion+flask", P: "potted fern" };
const NURSE = { W: "window", C: "wall clock", V: "shelf:vial+flask", v: "cabinet:vial+flask", d: "apothecary drawers", j: "cabinet:jar+jarb+jarg", c: "catalog drawers", K: "counter 3x1", h: "chair S", o: "stool", k: "chest", w: "washbasin", P: "potted fern", x: "crate", B: "bench 2", D: "desk 2x1", n: "chair N" };
const MORGUE = { T: "wall torch", K: "shelf:skull+crystal", Y: "cobweb", X: "cracked wall", c: "coffin", O: "coffin open", L: "candelabra", s: "candle stubs", p: "skull pile", k: "chest", b: "barrel", d: "dining 2x1", o: "stool", x: "crate" };
const ATTIC = { W: "round window", Y: "cobweb", p: "picture", x: "crate", X: "crate stack", k: "chest", u: "luggage trunk", t: "toy box", r: "rocking horse", l: "old doll", m: "music box", s: "sack", b: "barrel", F: "covered furniture", f: "photo frames", c: "child bed", w: "wardrobe", a: "armchair" };

export const ROOMS: AuthoredRoom[] = [
  // 병실(ward) 9×7·6×7 은 4판 검수까지 FAIL 이라 뺐다 — 침대(patient bed)가 벽 기물이라 북벽 한 줄에만 놓여 아래 절반이 휑하고,
  // 칸막이·세면대·약장이 침대 줄에 붙어 남는 기물이 상자·통뿐이었다. 침대 둘째 줄(가운데 놓는 철제 병원 침대)·링거 걸이·의료 카트가 있어야 짠다.
  // ── 진료실 ── 약장·약재 서랍·세면대, 진찰 침대와 그 옆 칸막이, 책상과 옆향 의사 의자·환자 걸상
  { id: "clinic-exam-m", kind: "clinic_exam", style: "town", floor: "grey", wall: "plaster", legend: CLINIC,
    hang: "...C...",
    plan: [
      "vdw.S.B",
      ".......",
      "et.o...",
      ".....q.",
      "xb....P",
    ],
    goods: [[1, 2, "papers"], [2, 2, "inkwell"]] },
  // ── 간호사실 ── 약장·목록 서랍·세면대 벽, 간호사 의자 앞 접수 계산대, 환자 걸상·대기 의자
  { id: "nurse-station-m", kind: "nurse_station", style: "town", floor: "grey", wall: "plaster", legend: NURSE,
    hang: "..W.C..",
    plan: [
      "vd.c.jw",
      ".......",
      "....D..",
      "K...n.P",
      "o......",
    ],
    goods: [[0, 3, "papers"], [1, 3, "bell"], [4, 2, "inkwell"], [5, 2, "papers"]] },
  // ── 지하 영안실 ── 돌 바닥·돌 벽, 관 줄(하나는 열림), 가운데 염습 탁자와 걸상, 촛대·해골 선반·횃불
  { id: "morgue-m", kind: "morgue", style: "fantasy", floor: "dungeon", wall: "dungeonw", legend: MORGUE,
    hang: ".TK..KT.",
    plan: [
      "Lb...x.L",
      ".c.O.c.c",
      "....o...",
      "....d..x",
      "ps.....b",
    ],
    goods: [[5, 3, "candle"]] },
  // ── 다락방 ── 낡은 상자 더미·트렁크, 장난감 상자 곁 흔들 목마·낡은 인형, 천 덮은 가구, 거미줄
  { id: "attic-s", kind: "attic", style: "town", floor: "boards", wall: "log", legend: ATTIC,
    hang: "..W..Y",
    plan: [
      "X.turx",
      "......",
      "bl.f..",
      "....F.",
    ] },
  { id: "attic-m", kind: "attic", style: "town", floor: "boards", wall: "log", legend: ATTIC,
    hang: "..YW..p.",
    plan: [
      "X.s.F..w",
      "x......b",
      "u.rt...x",
      "..l..f..",
      "s....bX.",
    ] },
];
