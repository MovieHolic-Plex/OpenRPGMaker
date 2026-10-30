// 손으로 짠 방 견본 — 가게(빵집·꽃집·옷가게·시골 잡화점). 4판에서 떨어진 견본을 다시 짰다(2026-10-29, 새 그림 없음).
// 형식은 lib.mts 머리 주석, 관례는 rooms.mts.
// 가게 줄 짜기: 0줄 벽 진열 → 1줄 주인 통로(맨바닥 한 줄) → 2줄 카운터 윗면(카운터는 발밑 위 줄에 윗면이 그려진다) → 3줄 카운터 앞면 →
//   4줄 손님 줄 → 5줄 문 옆 진열(문 칸만 비움). 2×2 맨바닥 덩이가 생기지 않게 카운터 옆도 윗면 있는 가구(카운터 2×1·케이크 진열장)로 잇는다.
// 4판 major 「계산대 탁상 물건이 서랍 앞면에 그려져 서랍장으로 읽힘」은 조립기 surfaceRowOf(카운터 윗면 dy −1)로 고쳤다.
import type { AuthoredRoom } from "./lib.mts";

const BAKERY = { W: "window", O: "bread oven", L: "bread shelf", G: "bread shelf baguette", Y: "bread shelf pie", R: "proofing rack", f: "sack:flour",
  C: "counter 3x1", c: "counter 4x1", E: "cake display case", T: "table:loaf+bun", K: "table:cake+pie", b: "basket:loaf", n: "basket:bun", g: "basket:baguette", x: "crate:loaf", P: "potted flowering", q: "counter 2x1" };
const FLOWER = { W: "window", H: "hang:flower", Q: "seedling shelf", P: "potted flowering", F: "potted fern", S: "potted sapling", K: "potted cactus",
  C: "counter 3x1", c: "counter 2x1", V: "tall vase red", B: "tall vase blue", Y: "tall vase yellow", b: "basket:flower", s: "seed sacks" };
const TAILOR = { W: "window", A: "fabric bolt rack", O: "cabinet:bolt+boltg+boltr", d: "dresser", m: "tailor mirror", k: "coat rack", M: "mannequin",
  C: "counter 3x1", c: "counter 2x1", T: "table:bolt+yarn", y: "basket:yarn+yarnb+yarny", w: "basket:wool", P: "potted fern" };
const STORE = { W: "window", I: "item shop shelf", j: "cabinet:jar+jarb+jarg", d: "cabinet:candle", p: "cabinet:potion+potionb+potiong", h: "cabinet:cheese", x: "crate",
  C: "counter 3x1", c: "counter 2x1", s: "sack:grain", a: "basket:apple", b: "barrel:apple", e: "basket:egg", k: "crate:potato", g: "seed sacks", P: "potted fern" };

export const ROOMS: AuthoredRoom[] = [
  // ── 빵집 작은 판 ── 화덕·빵 선반·발효 선반 앞 주인 통로, 계산대(돈통·빵 바구니·종)+케이크 진열장, 손님 줄, 문 옆 빵 탁자·바구니
  { id: "bakery-s", kind: "bakery_shop", style: "town", floor: "plank", wall: "plaster", legend: BAKERY,
    hang: "......W",
    plan: [
      "O.LGYRf",
      ".......",
      ".......",
      "C...E.b",
      ".......",
      "nT...K.",
    ],
    goods: [[0, 3, "cashbox"], [1, 3, "breadbasket"], [2, 3, "bell"]] },
  // ── 빵집 중간 판 ── 4칸 계산대(돈통·식빵 줄·빵 바구니·종)+케이크 진열장+작은 계산대(바게트·빵 접시), 주인 통로 끝 밀가루 자루(1판: 오른쪽 빈 덩이·바구니 복사 FAIL)
  { id: "bakery-m", kind: "bakery_shop", style: "town", floor: "plank", wall: "plaster", legend: BAKERY,
    hang: "........W",
    plan: [
      "O.LGYRRLf",
      "x........",
      ".........",
      "c....E.q.",
      ".........",
      "nT....K.P",
    ],
    goods: [[0, 3, "cashbox"], [1, 3, "loafrow"], [2, 3, "breadbasket"], [3, 3, "bell"], [7, 3, "baguettes"], [8, 3, "breadplate"]] },
  // ── 꽃집 ── 모종 선반·화분 앞 주인 통로, 계산대(돈통·꽃병·가위)+꽃 계산대(꽃·꽃병), 손님 줄, 문 옆 키큰 꽃병·화분·꽃 바구니
  { id: "flower-shop", kind: "flower_shop", style: "town", floor: "plank", wall: "plaster", legend: FLOWER,
    hang: "....WHW",
    plan: [
      "Q.Q.PFS",
      ".......",
      ".......",
      "C...c.b",
      ".......",
      "VPS..bY",
    ],
    goods: [[0, 3, "cashbox"], [1, 3, "vase"], [2, 3, "scissors"], [4, 3, "flower"], [5, 3, "vase"]] },
  // ── 옷가게 ── 옷걸이·마네킹·서랍장·전신 거울·옷감 진열장 앞 주인 통로(옷감 선반 둘은 책장으로 읽혀 1판 FAIL — 하나만), 계산대(돈통·갠 옷감·실패)+재단 계산대(가위·옷감), 마네킹, 문 옆 실타래·옷감 탁자
  { id: "tailor-s", kind: "tailor_shop", style: "town", floor: "plank", wall: "plaster", legend: TAILOR,
    hang: "........",
    plan: [
      "kMd.mMOk",
      "........",
      "........",
      "C..c..M.",
      "........",
      "yT...w.y",
    ],
    goods: [[0, 3, "cashbox"], [1, 3, "clothfold"], [2, 3, "spools"], [3, 3, "scissors"], [4, 3, "clothfold"]] },
  // ── 시골 잡화점 ── 잡화 선반·단지·초·물약 진열장 앞 주인 통로, 계산대(돈통·저울·초)+작은 계산대(달걀·치즈)·곡식 자루, 손님 줄, 문 옆 사과·감자·달걀
  { id: "village-store", kind: "general_store", style: "town", floor: "plank", wall: "plaster", legend: STORE,
    hang: ".......W",
    plan: [
      "I.jdpI.x",
      "........",
      "........",
      "C...c.s.",
      "........",
      "ab...keb",
    ],
    goods: [[0, 3, "cashbox"], [1, 3, "scale"], [2, 3, "candle"], [4, 3, "egg"], [5, 3, "cheese"]] },
];
