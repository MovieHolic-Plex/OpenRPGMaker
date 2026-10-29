// 다시 짠 방 견본 — 앞 판(rooms-inn.mts·rooms-village.mts)에서 4판 안에 Sonnet 검수를 넘지 못한 크기를 검수 지적을 반영해 다시 짰다.
// 형식·관례는 lib.mts 머리 주석과 rooms.mts. 화풍: tavern·living 은 town, laboratory 는 fantasy(laboratory-s 와 같다).
// 채택(Sonnet 적대 검수 PASS + build 겹침·닿음 + check 짓기 빠짐 0·닿지 못함 0): tavern-s2 9×8 3판, tavern-l2 13×8 4판, house-l2 11×8 2판, laboratory-xl2 12×8 2판.
// 앞 판 지적과 고친 것: 계산대 뒤 주인 자리가 반 칸뿐 → 계산대를 한 줄 내려(술통 받침 앞 두 줄) 주인 통로를 뚜렷이. 2×2 넘는 맨바닥 덩이 → 문 열 밖에는 2×2 빈 덩이를
// 하나 이하로(높이를 한 줄 줄였다). 난롯가 의자가 식탁에 붙어 기둥이 됨 → 난롯가는 북향 의자 둘만 두고 그 아래 한 줄을 비운다. 연구소가 연금술 방으로 읽힘 →
// 부화기 둘을 나란히 모으고 몬스터 우리·새장·횃대·먹이 구유·잠든 몬스터·물통으로 「몬스터를 돌보는 곳」을 세웠다(lab bench 는 몬스터 공을 닮아 안 쓴다).
// 검수에서 「피아노 연주」를 용도에 적었더니 의자 없는 피아노가 major 였다 — 용도 설명에 없는 가구는 넣지 않는다.
import type { AuthoredRoom } from "./lib.mts";

const TAVERN = { y: "dice barrel", K: "piano", o: "stool", A: "keg rack", B: "cabinet:bottle+bottler+bottley", F: "fireplace", J: "firewood bundle", u: "fur rug", C: "counter 3x1", Q: "counter 4x1", s: "bar stool", h: "chair S", n: "chair N", e: "chair E", w: "chair W", d: "dining 1x1", D: "dining 2x1", T: "dining 3x1", G: "dining 2x2", b: "barrel", x: "crate", S: "sideboard 2x1", R: "bench 2", P: "potted fern",
  M: "menu board", W: "window", N: "notice board", L: "lute", H: "hanging lantern" };
const HOUSE = { K: "stove", Z: "kitchen sink", u: "cupboard", F: "fireplace", r: "firewood bundle", f: "firewood rack", w: "wardrobe", n: "nightstand", B: "bed red", D: "double bed red", k: "chest", Y: "work 2x1", o: "stool", T: "dining 2x1", E: "chair E", V: "chair W", S: "chair S", a: "armchair", t: "tea 1x1", v: "spinning wheel", A: "cradle", j: "water jar", b: "barrel", g: "sack:grain", x: "crate", q: "potted fern", P: "potted flowering", c: "basket:potato",
  W: "window", C: "curtained window", p: "picture", m: "hanging pans", O: "hang:onion", h: "hang:herb", l: "wall clock" };
const MLAB = { S: "bookshelf 2w", s: "bookshelf 1w", d: "apothecary drawers", p: "specimen shelf", i: "egg incubator", C: "beast cage", c: "hanging cage", O: "owl perch", D: "desk 3x1", R: "work 2x2", w: "work 2x1", o: "stool", g: "globe", e: "basket:egg", P: "potted fern", B: "book pile", M: "map rolls", h: "hay bale", F: "feed trough", z: "sleeping cat", q: "sack:grain", u: "water bucket",
  W: "window", X: "celestial chart", K: "shelf:skull+crystal", V: "shelf:vial+flask", T: "monster trophy", H: "hang:herb" };

export const ROOMS: AuthoredRoom[] = [
  // ── 여관 1층 홀(작은 판) ── 술통 받침·술병장 앞 주인 통로 두 줄, 계산대 3칸+바 의자 셋, 가운데 4인 식탁(2×2)·문 옆 2인 식탁, 벽난로 없음
  { id: "tavern-s2", kind: "tavern", style: "town", floor: "plank", wall: "log", legend: TAVERN,
    hang: "M.HW...W.",
    plan: [
      "A.B.PS..y",
      ".........",
      "....eG.w.",
      "C...e..w.",
      "sssb.....",
      "......edw",
    ],
    goods: [[0, 3, "mug"], [1, 3, "beer"], [2, 3, "cashbox"], [5, 2, "soup"], [6, 2, "mug"], [5, 3, "pie"], [6, 3, "beer"], [5, 0, "plates"], [7, 5, "mug"]] },
  // ── 여관 1층 홀(큰 판) ── 계산대 3칸+바 의자(주인 통로 두 줄), 가운데 4인 식탁(2×2), 벽난로 앞 북향 의자 둘(아래 한 줄 비움), 동쪽 2인 식탁·문 옆 1인 식탁
  { id: "tavern-l2", kind: "tavern", style: "town", floor: "plank", wall: "log", legend: TAVERN,
    hang: "M..WH..W....W",
    plan: [
      "A.B.S..P.F..J",
      ".........nn..",
      "....eG.w....b",
      "C...e..w.eD.w",
      "sss..........",
      "....b...edw.P",
    ],
    goods: [[0, 3, "mug"], [1, 3, "beer"], [2, 3, "cashbox"], [5, 2, "mug"], [6, 2, "bottle"], [5, 3, "steak"], [6, 3, "mug"], [10, 3, "soup"], [11, 3, "beer"], [9, 5, "mug"], [4, 0, "plates"]] },
  // ── 마을 민가(큰 판) ── 서쪽 부엌(화덕·개수대·찬장·작업대·자루·통·항아리), 가운데 벽난로와 식탁(의자 넷), 동쪽 침대 구석(옷장·협탁·두 사람 침대·궤짝·안락의자·요람·깔개)
  { id: "house-l2", kind: "living", style: "town", floor: "plank", wall: "log", legend: HOUSE, lines: { "~": "rug red" },
    hang: "m.OW....C..",
    plan: [
      "KZu.F.rwnD.",
      "...........",
      "Y...SS.aA.k",
      "g..ET.V.~~~",
      "b.j.....~~~",
      "c...q..v..P",
    ],
    goods: [[0, 2, "board"], [1, 2, "bowl"], [4, 3, "breadplate"], [5, 3, "cup"]] },
  // ── 몬스터 박사 연구소(큰 판) ── 서쪽 책장·약재 서랍·표본 선반·나란한 알 부화기 둘과 책상, 가운데 검사대, 동쪽 몬스터 우리·새장·횃대·건초·먹이 구유·잠든 몬스터
  { id: "laboratory-xl2", kind: "laboratory", style: "fantasy", floor: "flag", wall: "stone", legend: MLAB,
    hang: "..H.H.W...W.",
    plan: [
      "S.dpii.C.c..",
      "............",
      ".D...oR..hO.",
      "g.o......F.z",
      "e.w.o..o.u..",
      "B..........q",
    ],
    goods: [[1, 2, "openbook"], [3, 2, "inkwell"], [6, 2, "smallflask"], [7, 3, "papers"], [7, 2, "herbbundle"], [2, 4, "mortar"], [3, 4, "skull"]] },
];
