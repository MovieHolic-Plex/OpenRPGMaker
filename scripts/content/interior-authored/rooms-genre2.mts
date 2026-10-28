// 손으로 짠 방 견본 — 회상 「할머니 집」(거실 living·장롱 방 bedroom). 같은 판에서 짠 힐링 「시골 마을」 잡화점·택배 「동네 가게」 빵집·꽃집·옷가게는 4판 FAIL 로 뺐다(아래).
// 형식은 lib.mts 머리 주석, 관례는 rooms.mts. 화풍은 town(그 종류 견본의 다수 화풍).
// 채택(Sonnet 적대 검수 PASS + build 겹침·닿음 + check 짓기 빠짐 0·닿지 못함 0): grandma-bedroom 1판, grandma-living-s 4판.
// 뺌(4판 FAIL): grandma-living-m 9×8 — 북쪽 가운데 3×2 맨바닥·벽난로 깔개와 고양이 어긋남이 끝까지 남았다.
//   village-store 8×8·bakery-s 7×8·bakery-m 9×8·flower-shop 7×8(새 kind flower_shop)·tailor-s 8×8 — 계산대 뒤 주인 통로 두 줄을 비우면 가운데가 휑하고(맨바닥 2×2 덩이),
//   한 줄만 비우면 「선반에 붙어 주인 설 자리 없음」으로 걸렸다. 계산대 탁상 물건이 앞면 서랍에 그려져 「서랍장으로 읽힘」 지적도 매 판 나왔다(4판 major: 잡화점·빵집 작은 판·옷가게).
import type { AuthoredRoom } from "./lib.mts";

const GRANNY = { W: "window", C: "curtained window", w: "wall clock", p: "picture", L: "hang:flower", H: "hang:herb", F: "fireplace", c: "clock", u: "cupboard", D: "dresser", o: "wardrobe", B: "bed red", n: "nightstand", S: "sideboard 2x1", s: "bookshelf 1w",
  a: "armchair", O: "sofa", t: "tea 1x1", T: "tea 2x1", f: "photo frames", d: "old doll", m: "music box", z: "sleeping cat", v: "spinning wheel", y: "basket:yarn+yarnb+yarny", r: "firewood bundle", P: "potted flowering", q: "potted fern", k: "chest", e: "chair E", V: "chair W", E: "dining 1x1", x: "stool" };

export const ROOMS: AuthoredRoom[] = [
  // ── 할머니 집 거실 ── 벽난로 앞 깔개, 소파와 그 앞 찻상(동쪽 나무 의자 — 안락의자는 남향 그림이라 불·찻상을 등져 1판 major), 괘종시계·찬장, 걸상 딸린 물레, 털실 바구니·사진 액자 협탁·낡은 인형, 고양이
  { id: "grandma-living-s", kind: "living", style: "town", floor: "dplank", wall: "plaster", legend: GRANNY, lines: { "~": "rug red" },
    hang: "..Wp..L",
    plan: [
      "cu...F.",
      "....~~~",
      "xv..O..",
      "y.f.T.V",
      "d.....z",
    ],
    goods: [[4, 3, "teapot"], [5, 3, "cup"]] },
  // ── 장롱 있는 방 ── 침대+협탁, 북벽 장롱·서랍장, 발치 깔개, 안락의자와 사진 액자, 궤짝
  { id: "grandma-bedroom", kind: "bedroom", style: "town", floor: "dplank", wall: "plaster", legend: GRANNY, lines: { "~": "rug red" },
    hang: "..C...p",
    plan: [
      "Bn.oD..",
      ".......",
      "~~~..a.",
      "~~~...f",
      "P.....k",
    ],
    goods: [[1, 0, "candle"]] },
];
