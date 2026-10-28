// 여관 묶음 손 견본 — 여관 1층 홀(tavern)·객실(inn_room)·주방(kitchen). 형식·관례는 lib.mts 머리 주석과 rooms.mts 를 따른다.
// 원래 작가 견본은 홀 16×15·17×10, 객실 3×4, 주방 5×5~8×5 뿐이라 추리 여관 판에서 같은 홀만 되풀이되고 2층 객실이 휑했다.
// 채택: 방마다 Sonnet 적대 검수 PASS + build 의 겹침·닿음 검사 + check.mts 짓기(빠진 가구 0·닿지 못한 바닥 0). 홀 11×8 은 4판, 객실 5×6 3판·6×7 2판·7×7 2판, 주방 7×7 3판·9×7 4판.
// 뺀 것: 홀 9×7(4판까지 「식탁 한 벌뿐·가운데 통로 맨바닥」 FAIL — 이 폭은 계산대·바 의자·벽난로 뒤에 식탁 한 벌밖에 안 들어간다), 홀 13×9(4판 「난롯가 의자가 식탁 등에 붙어 의자 기둥」 FAIL).
// 키 큰 벽 가구(keg rack·fireplace·range·sink·wardrobe·bed 등은 벽면 아랫줄까지 그린다) 위에는 한 칸짜리 걸이(메뉴판·류트·랜턴·냄비·양파)만 건다.
import type { AuthoredRoom } from "./lib.mts";

const TAVERN = { A: "keg rack", B: "cabinet:bottle+bottler+bottley", F: "fireplace", J: "firewood bundle", u: "fur rug", C: "counter 4x1", s: "bar stool", h: "chair S", n: "chair N", e: "chair E", w: "chair W", d: "dining 1x1", D: "dining 2x1", T: "dining 3x1", b: "barrel", x: "crate", S: "sideboard 2x1", R: "bench 2", P: "potted fern",
  M: "menu board", W: "window", N: "notice board", L: "lute", K: "dart board", H: "hanging lantern" };
const INN = { B: "bed red", G: "bed green", n: "nightstand", o: "wardrobe", v: "washbasin", r: "dresser", k: "chest", d: "dining 1x1", e: "chair E", w: "chair W", t: "coat rack", P: "potted flowering", R: "round rug",
  W: "window", p: "picture", H: "hanging lantern" };
const KITCHEN = { R: "kitchen range", K: "kcounter 2x1", Q: "kcounter 3x1", S: "kitchen sink", f: "firewood rack", u: "cupboard", X: "work 3x1", Y: "work 3x2", j: "water jar", b: "barrel", g: "sack:grain", l: "sack:flour", x: "crate", c: "basket:cabbage", p: "basket:potato", a: "basket:onion", k: "basket:egg", o: "stool", e: "chair E", w: "chair W", d: "dining 1x1",
  W: "window", P: "hanging pans", O: "hang:onion", m: "hang:ham" };

export const ROOMS: AuthoredRoom[] = [
  // ── 여관 1층 홀 ── 북벽 술통 받침·술병장, 그 앞 한 줄이 주인 통로(계산대 그림의 윗면이 그 줄 위로 솟는다), 계산대+바 의자,
  //    북벽 가운데 찬장, 벽난로를 보는 북향 의자 둘(안락의자 그림은 정면이라 불을 등진다), 식탁(의자 셋 — 한쪽을 비워 둬야 식탁에 닿는다), 구석 술통·궤짝
  { id: "tavern-m", kind: "tavern", style: "town", floor: "plank", wall: "log", legend: TAVERN,
    hang: "M..WH..W.L.",
    plan: [
      "A.B.S.P.F.J",
      "........nn.",
      "C...eD.....",
      "ssss.nn.hh.",
      "........D.w",
      "b.edw.....x",
    ],
    goods: [[0, 2, "mug"], [1, 2, "beer"], [3, 2, "cashbox"], [5, 2, "soup"], [6, 2, "mug"], [8, 4, "pie"], [9, 4, "mug"], [3, 5, "beer"]] },
  // ── 여관 객실 ── 침대+협탁, 옷장·세면대(작은 방은 서랍장), 발치 상자, 작은 탁자와 마주 보는 의자(chair E 는 탁자 서쪽, chair W 는 동쪽)
  { id: "inn-room-s", kind: "inn_room", style: "town", floor: "dplank", wall: "log", legend: INN,
    hang: "..W..",
    plan: [
      "Bn.ov",
      ".....",
      "k..ed",
      ".....",
    ],
    goods: [[1, 0, "candle"], [4, 2, "papers"]] },
  { id: "inn-room-m", kind: "inn_room", style: "town", floor: "dplank", wall: "log", legend: INN,
    hang: ".W.H..",
    plan: [
      "Bnr.ov",
      "......",
      "kR.edw",
      "......",
      "P....t",
    ],
    goods: [[1, 0, "candle"], [4, 2, "papers"]] },
  { id: "inn-room-l", kind: "inn_room", style: "town", floor: "dplank", wall: "log", legend: INN,
    hang: ".W.p...",
    plan: [
      "BnG.r.v",
      ".......",
      "k.k.edw",
      ".R.....",
      "P.....t",
    ],
    goods: [[1, 0, "candle"], [5, 2, "papers"]] },
  // ── 여관 주방 ── 화덕·조리대·개수대·장작 받침 줄, 그 앞 통로, 가운데 작업대와 걸상, 한 구석에 모은 자루·통
  { id: "inn-kitchen-s", kind: "kitchen", style: "town", floor: "ktile", wall: "ktile", legend: KITCHEN,
    hang: "..PO..W",
    plan: [
      "R.K.Sfj",
      ".......",
      "c.X...b",
      "p.o...g",
      "j.....l",
    ],
    goods: [[0, 0, "stewpot"], [1, 0, "kettle_steam"], [2, 0, "board"], [3, 0, "bowl"], [2, 2, "breadplate"], [3, 2, "steak"], [4, 2, "flourbowl"]] },
  { id: "inn-kitchen-m", kind: "kitchen", style: "town", floor: "ktile", wall: "ktile", legend: KITCHEN,
    hang: "..P.O.m.W",
    plan: [
      "R.Q..Sfuj",
      ".........",
      "bg.X..oxc",
      "l.......a",
      "p.k...j.x",
    ],
    goods: [[0, 0, "stewpot"], [1, 0, "kettle_steam"], [2, 0, "board"], [3, 0, "steak"], [4, 0, "plates"], [3, 2, "board"], [4, 2, "ham"], [5, 2, "flourbowl"]] },
];
