// 손으로 짠 방 견본 — JRPG 마을의 집(living)·무기점(weapon_shop)·몬스터 박사 연구소(laboratory). 형식은 lib.mts 머리 주석, 관례는 rooms.mts.
// 화풍: living·weapon_shop 은 town(작가 견본 hobbit·inn·narshe·smithy), laboratory 는 fantasy(기존 손 견본과 같다).
import type { AuthoredRoom } from "./lib.mts";

const HOUSE = { A: "cradle", L: "loom", O: "basket:wool", Z: "kitchen sink", m: "hanging pans", v: "spinning wheel", Y: "work 2x1", W: "window", C: "curtained window", p: "picture", c: "wall clock", h: "hang:herb", o: "hang:onion", s: "bookshelf 1w", F: "fireplace", f: "firewood rack", K: "stove", u: "cupboard", B: "bed red", D: "double bed red", n: "nightstand", w: "wardrobe", a: "armchair", t: "tea 1x1", T: "dining 2x1", G: "dining 3x1", E: "chair E", V: "chair W", N: "chair N", S: "chair S", b: "barrel", x: "crate", P: "potted flowering", q: "potted fern", k: "chest", j: "water jar", r: "firewood bundle", g: "sack:grain" };
const ARMS = { G: "gladiator rack", c: "counter 4x1", D: "display 2x1", W: "window", R: "weapon rack", Q: "shield", X: "axe mace wall", Y: "shield wall", O: "bow rack", H: "helmet shelf", s: "sword rack", p: "spear rack", C: "counter 3x1", A: "armor stand", L: "leather armor stand", K: "knight armor", w: "weapon barrel", r: "arrow barrel", x: "weapon crate", k: "chest", b: "barrel", g: "grindstone", P: "potted fern" };
const MLAB = { B: "book pile", M: "map rolls", R: "work 3x2", D: "desk 3x1", w: "work 2x1", u: "cauldron", W: "window", K: "shelf:skull+crystal", V: "shelf:vial+flask", H: "hang:herb", c: "celestial chart", S: "bookshelf 2w", s: "bookshelf 1w", p: "specimen shelf", d: "apothecary drawers", i: "egg incubator", Z: "alchemy table", n: "chair N", o: "stool", g: "globe", m: "magic circle", x: "crate", k: "chest", b: "barrel", P: "potted fern" };

// 채택(Sonnet 적대 검수 PASS + build 겹침·닿음 + check 짓기 빠짐 0·닿지 못함 0): house-s 2판, house-m 4판(9×7), weapon-shop-m 2판, weapon-shop-l 3판, laboratory-s 2판.
// 뺌: house-l(11×9) 4판 FAIL — 휑한 2×2 맨바닥·좌우 쏠림이 끝까지 남았다. laboratory-xl(12×9) 4판 FAIL — 휑한 바닥·같은 부화기·선반 반복, 「연금술 방」으로 읽힘.
export const ROOMS: AuthoredRoom[] = [
  // ── 마을 민가 한 칸 집 ── 벽난로·장작, 식탁+의자, 찬장, 구석 침대, 통·화분
  { id: "house-s", kind: "living", style: "town", floor: "plank", wall: "log", legend: HOUSE,
    hang: ".W..m.W",
    plan: [
      "B.u.KZj",
      ".......",
      ".EG..V.",
      ".......",
      "qrx..bg",
    ],
    goods: [[2, 2, "bowl"], [3, 2, "breadplate"], [4, 2, "cup"]] },
  { id: "house-m", kind: "living", style: "town", floor: "plank", wall: "log", legend: HOUSE, lines: { "~": "rug red" },
    hang: ".W..cm..W",
    plan: [
      "uaF..KZBn",
      ".~~~.....",
      "x.EG..V..",
      "x.....v.j",
      "b.q.....k",
    ],
    goods: [[3, 2, "bowl"], [4, 2, "breadplate"], [5, 2, "cup"]] },
  // ── 무기점 ── 벽 진열(무기 걸이·방패·투구 선반·검 진열대·창꽂이) 앞 주인 통로, 그 앞 계산대, 갑옷 받침·무기 통·화살 통
  { id: "weapon-shop-m", kind: "weapon_shop", style: "town", floor: "boards", wall: "log", legend: ARMS,
    hang: "..X..Q.R",
    plan: [
      "H...p.sw",
      "........",
      "........",
      "A.c...LK",
      "........",
      "rx....gb",
    ],
    goods: [[2, 3, "cashbox"], [3, 3, "dagger"], [5, 3, "bell"]] },
  { id: "weapon-shop-l", kind: "weapon_shop", style: "town", floor: "boards", wall: "log", legend: ARMS,
    hang: "..Q.R.Y...",
    plan: [
      "H..s.p..G.",
      "..........",
      "..........",
      "A..C...L.K",
      "..D.......",
      "rw.....xgb",
    ],
    goods: [[3, 3, "cashbox"], [4, 3, "dagger"], [5, 3, "bell"], [2, 4, "dagger"], [3, 4, "hammer"]] },
  // ── 몬스터 박사 연구소 ── 표본 선반·약재 서랍·책장, 실험대·알 부화기, 책상+의자, 지구본, 큰 방은 마법진
  { id: "laboratory-s", kind: "laboratory", style: "fantasy", floor: "flag", wall: "stone", legend: MLAB,
    hang: "...K.W.",
    plan: [
      "S.p.i.d",
      ".......",
      ".w..Z..",
      ".o...o.",
      "g....xb",
    ],
    goods: [[1, 2, "openbook"], [2, 2, "smallflask"]] },
];
