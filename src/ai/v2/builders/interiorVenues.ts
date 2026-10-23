// 조수 v2 실내 «장소 견본» — 방 종류 견본(templates.ts)으로는 읽히지 않는 장소(천문대처럼 주인공 물건이 방 모양을 정하는 곳)를
// 검증된 제작자 구성으로 짓는다. 모델은 낱말(「천문대」)만 고르고, 평면·가구 자리는 여기 데이터가 정한다.
//
// 견본은 사람이 합격시킨 방에서 가져온다 — 천문대는 『폴른 스타』 별빛 천문대(src/project/flagship/fallenStarRooms.ts OBS_ROOM, 사용자가 고른 r28 판)의
// 둥근 지붕 관측 홀(평면 0~13줄)에 남쪽 출구 한 줄을 붙인 것이다. variant 홀수면 좌우를 뒤집는다(배치만 바뀌고 그림은 같다).
import type { HandInteriorSpec } from "@/editor/handInterior/builder";

export interface VenueStamp { readonly part: string; readonly x: number; readonly y: number }
export interface VenueBuild {
  readonly args: Record<string, unknown>;
  /** 짓기 뒤 stamp_object(kit:…/hand-interior:<part>)로 덧찍을 그림 — 둥근 지붕·관측 틈처럼 짓기 도구가 평면 안에 못 거는 것. */
  readonly stamps: readonly VenueStamp[];
  /** 견본에 든 올라가는 계단(위층을 지어 이을 때). */
  readonly stairs?: { readonly id: string; readonly x: number; readonly y: number; readonly w: number };
}
export interface InteriorVenue {
  readonly id: string;
  /** 장소 이름·구역 낱말이 이것에 맞으면 이 견본으로 짓는다. */
  readonly words: RegExp;
  /** 이 견본이 이미 갖춘 주인공 물건 낱말(요청 앵커가 여기 맞으면 따로 놓지 않는다). */
  readonly provides: readonly RegExp[];
  /** 견본이 올라가는 계단을 품을 수 있으면 그 자리(뒤집기 전). */
  readonly stairs?: { readonly id: string; readonly x: number; readonly y: number; readonly w: number };
  build(variant: number, withStairs: boolean): VenueBuild;
}

type Obj = { id: string; x: number; y: number };
type Rect = { x0: number; y0: number; x1: number; y1: number };

const OBS_PLAN = [
  "################################",
  "################################",
  "################################",
  "################################",
  "#############......#############",
  "##########............##########",
  "#######..................#######",
  "####........................####",
  "#..............................#",
  "#..............................#",
  "##............................##",
  "###..........................###",
  "######....................######",
  "##########............##########",
  "###############.################",
];
const OBS_OBJECTS: Obj[] = [
  { id: "great telescope", x: 10, y: 10 }, { id: "wall sconce", x: 13, y: 4 }, { id: "wall sconce", x: 18, y: 4 }, { id: "celestial chart", x: 20, y: 5 },
  { id: "bookshelf 2w", x: 5, y: 9 }, { id: "bookshelf 2w", x: 8, y: 8 }, { id: "cabinet:book+bookb+bookg", x: 11, y: 7 }, { id: "map rolls", x: 20, y: 7 },
  { id: "scroll rack", x: 22, y: 8 }, { id: "bookshelf 2w", x: 25, y: 9 }, { id: "wall sconce", x: 28, y: 8 }, { id: "wall sconce", x: 5, y: 7 }, { id: "wall sconce", x: 26, y: 7 },
  { id: "chart table", x: 6, y: 11 }, { id: "orrery", x: 9, y: 11 }, { id: "war map table", x: 17, y: 10 }, { id: "globe", x: 21, y: 10 }, { id: "stool", x: 9, y: 10 },
  { id: "orrery", x: 22, y: 10 }, { id: "desk 2x1", x: 24, y: 11 }, { id: "chair N", x: 25, y: 12 },
];
const OBS_LINES: { id: string; rect: Rect }[] = [
  { id: "rug blue", rect: { x0: 6, y0: 11, x1: 9, y1: 12 } }, { id: "rug brown", rect: { x0: 21, y0: 10, x1: 25, y1: 12 } },
  { id: "rug red", rect: { x0: 16, y0: 10, x1: 19, y1: 12 } }, { id: "rug blue", rect: { x0: 15, y0: 13, x1: 15, y1: 13 } },
];
const OBS_GOODS: Obj[] = [{ id: "papers", x: 24, y: 11 }, { id: "candlestick", x: 25, y: 11 }];

/** 좌우 뒤집기 — 칸 폭(w)을 알아야 왼쪽 위 기준 x 를 옮긴다. */
function mirror(spec: HandInteriorSpec, width: number, o: Obj): Obj {
  const def = spec.objects[o.id.split(":")[0]!];
  const w = def?.w ?? 1;
  const flipId = o.id.replace(/ (E|W)$/u, (_, d: string) => (d === "E" ? " W" : " E"));
  return { id: flipId, x: width - o.x - w, y: o.y };
}

export function observatoryVenue(spec: HandInteriorSpec): InteriorVenue {
  return {
    id: "observatory",
    words: /천문|관측|observ|astronom|별지기|망원경/iu,
    provides: [/망원경|telescope/iu, /책장|서가|bookshel|서고/iu, /책상|desk|도표|별자리|성도|chart|지도/iu, /지구본|지구의|globe/iu, /천체|혼천|orrery/iu, /두루마리|scroll/iu],
    build(variant) {
      const W = OBS_PLAN[0]!.length;
      const flip = variant % 2 === 1;
      const plan = flip ? OBS_PLAN.map((row) => [...row].reverse().join("")) : OBS_PLAN;
      const objects = flip ? OBS_OBJECTS.map((o) => mirror(spec, W, o)) : OBS_OBJECTS;
      const goods = flip ? OBS_GOODS.map((o) => ({ ...o, x: W - 1 - o.x })) : OBS_GOODS;
      const lines = OBS_LINES.map((l) => (flip ? { id: l.id, rect: { x0: W - 1 - l.rect.x1, y0: l.rect.y0, x1: W - 1 - l.rect.x0, y1: l.rect.y1 } } : l));
      // 둥근 지붕(30×8)은 x=1, 관측 틈은 지붕 가운데 경선(x15~16) — 좌우 대칭이라 뒤집어도 같은 자리.
      return {
        args: { plan, floor: "plank", wall: "stone", ceiling: "dark", zones: [{ x0: 1, y0: 1, x1: W - 2, y1: 13, floor: "plank", wall: "stone" }], objects, lines, goods },
        stamps: [{ part: "dome slit tall", x: 15, y: 3 }, { part: "dome vault", x: 1, y: 0 }],
      };
    },
  };
}

/** 선술집 홀(16×14) — v2 첫 비교(2026-10-23)에서 방 종류 견본(tavern 예제 16×15)이 휑했고(맨바닥 54%) 다른 견본은 돌바닥이었다.
 * 통나무 벽·널마루, 북벽 = 술통 선반·술병 선반 뒤 바 카운터와 바 의자 넷(서), 가운데 올라가는 계단(앞에 붉은 깔개 길이 남쪽 문까지),
 * 피아노·다트판, 벽난로·장작·모피 깔개·안락의자 둘(동), 남쪽 양옆 식탁 네 벌, 통·상자·화분. 1배 확인 뒤 넣었다(qa-runs 프로브). */
const TAVERN_OBJECTS: Obj[] = [{id: "keg rack", x: 1, y: 3}, {id: "keg rack", x: 3, y: 3}, {id: "shelf:bottle+bottler+bottley", x: 1, y: 1}, {id: "bottles", x: 2, y: 1}, {id: "shelf:bottle+bottler+bottley", x: 4, y: 1}, {id: "counter 4x1", x: 1, y: 5}, {id: "bar stool", x: 1, y: 6}, {id: "bar stool", x: 2, y: 6}, {id: "bar stool", x: 3, y: 6}, {id: "bar stool", x: 4, y: 6}, {id: "candelabra", x: 5, y: 3}, {id: "stairs up wood", x: 6, y: 3}, {id: "dart board", x: 9, y: 1}, {id: "piano", x: 9, y: 3}, {id: "lute", x: 11, y: 1}, {id: "fireplace", x: 11, y: 3}, {id: "firewood bundle", x: 13, y: 3}, {id: "potted fern", x: 14, y: 3}, {id: "armchair", x: 10, y: 5}, {id: "fur rug", x: 11, y: 5}, {id: "armchair", x: 13, y: 5}, {id: "chair S", x: 2, y: 8}, {id: "chair S", x: 3, y: 8}, {id: "dining 2x1", x: 2, y: 9}, {id: "chair N", x: 2, y: 10}, {id: "chair N", x: 3, y: 10}, {id: "chair S", x: 11, y: 8}, {id: "chair S", x: 12, y: 8}, {id: "dining 2x1", x: 11, y: 9}, {id: "chair N", x: 11, y: 10}, {id: "chair N", x: 12, y: 10}, {id: "chair S", x: 1, y: 11}, {id: "chair S", x: 2, y: 11}, {id: "chair S", x: 3, y: 11}, {id: "dining 3x1", x: 1, y: 12}, {id: "chair S", x: 12, y: 11}, {id: "chair S", x: 13, y: 11}, {id: "chair S", x: 14, y: 11}, {id: "dining 3x1", x: 12, y: 12}, {id: "barrel", x: 14, y: 8}, {id: "barrel", x: 14, y: 9}, {id: "crate", x: 5, y: 9}, {id: "potted fern", x: 5, y: 12}, {id: "potted fern", x: 9, y: 12}, {id: "chair S", x: 9, y: 8}, {id: "roundtable", x: 9, y: 9}, {id: "chair N", x: 9, y: 10}];
const TAVERN_GOODS: Obj[] = [{id: "mug", x: 2, y: 5}, {id: "beer", x: 3, y: 5}, {id: "bottle", x: 4, y: 5}, {id: "plate", x: 2, y: 9}, {id: "mug", x: 3, y: 9}, {id: "plate", x: 11, y: 9}, {id: "beer", x: 12, y: 9}, {id: "breadplate", x: 2, y: 12}, {id: "mug", x: 13, y: 12}, {id: "candle", x: 1, y: 12}, {id: "candle", x: 14, y: 12}];
const TAVERN_LINES: { id: string; rect: Rect }[] = [{id: "rug red", rect: {x0: 6, y0: 5, x1: 8, y1: 12}}];
const TAVERN_STAIRS: Obj = { id: "stairs up wood", x: 6, y: 3 };
/** 남쪽 손님 자리 다른 판(variant 둘째 비트) — 같은 요청이 늘 같은 홀이 되지 않게(2026-10-23 다양성). 긴 식탁 둘·둥근 탁자 하나 대신 둥근 탁자 네 벌, 맨 아래 긴 식탁·통·화분은 그대로. */
const TAVERN_SOUTH_ALT: Obj[] = [{id: "chair S", x: 2, y: 8}, {id: "roundtable", x: 2, y: 9}, {id: "chair N", x: 2, y: 10}, {id: "chair S", x: 4, y: 8}, {id: "roundtable", x: 4, y: 9}, {id: "chair N", x: 4, y: 10},
  {id: "chair S", x: 10, y: 8}, {id: "roundtable", x: 10, y: 9}, {id: "chair N", x: 10, y: 10}, {id: "chair S", x: 12, y: 8}, {id: "roundtable", x: 12, y: 9}, {id: "chair N", x: 12, y: 10}, {id: "barrel", x: 14, y: 8}, {id: "barrel", x: 14, y: 9},
  {id: "chair S", x: 1, y: 11}, {id: "chair S", x: 2, y: 11}, {id: "chair S", x: 3, y: 11}, {id: "dining 3x1", x: 1, y: 12}, {id: "chair S", x: 12, y: 11}, {id: "chair S", x: 13, y: 11}, {id: "chair S", x: 14, y: 11}, {id: "dining 3x1", x: 12, y: 12},
  {id: "potted fern", x: 5, y: 12}, {id: "potted fern", x: 9, y: 12}];
const TAVERN_GOODS_ALT: Obj[] = [{id: "mug", x: 2, y: 5}, {id: "beer", x: 3, y: 5}, {id: "bottle", x: 4, y: 5}, {id: "mug", x: 2, y: 9}, {id: "beer", x: 4, y: 9}, {id: "plate", x: 10, y: 9}, {id: "mug", x: 12, y: 9}, {id: "breadplate", x: 2, y: 12}, {id: "mug", x: 13, y: 12}, {id: "candle", x: 1, y: 12}, {id: "candle", x: 14, y: 12}];

export function tavernVenue(spec: HandInteriorSpec): InteriorVenue {
  return {
    id: "tavern",
    words: /선술집|주점|술집|주막|tavern|\bpub\b|\binn\b|여관/iu,
    provides: [/바|카운터|counter|bar/iu, /식탁|탁자|테이블|table/iu, /벽난로|화로|fireplace/iu, /의자|chair|stool/iu, /술통|keg|barrel|통/iu, /피아노|piano/iu, /다트|dart/iu, /계단|stair/iu, /깔개|러그|rug/iu],
    stairs: { id: TAVERN_STAIRS.id, x: TAVERN_STAIRS.x, y: TAVERN_STAIRS.y, w: 3 },
    build(variant, withStairs) {
      const W = 16;
      const flip = variant % 2 === 1;
      const alt = Math.floor(variant / 2) % 2 === 1;
      const all = alt ? [...TAVERN_OBJECTS.filter((o) => o.y < 8), ...TAVERN_SOUTH_ALT] : TAVERN_OBJECTS;
      const base = withStairs ? all : [...all.filter((o) => o.id !== "stairs up wood"), { id: "quest board", x: 6, y: 1 }, { id: "bench 3", x: 6, y: 3 }];
      const objects = flip ? base.map((o) => mirror(spec, W, o)) : base;
      const g = alt ? TAVERN_GOODS_ALT : TAVERN_GOODS;
      const goods = flip ? g.map((o) => ({ ...o, x: W - 1 - o.x })) : g;
      const lines = TAVERN_LINES.map((l) => (flip ? { id: l.id, rect: { x0: W - 1 - l.rect.x1, y0: l.rect.y0, x1: W - 1 - l.rect.x0, y1: l.rect.y1 } } : l));
      return {
        args: { floor: "boards", wall: "log", rooms: [{ id: "hall", x0: 1, y0: 1, x1: 14, y1: 12 }], exit: { room: "hall", x: flip ? W - 1 - 7 : 7 }, objects, lines, goods },
        stamps: [],
        stairs: withStairs ? (flip ? { id: TAVERN_STAIRS.id, x: W - TAVERN_STAIRS.x - 3, y: TAVERN_STAIRS.y, w: 3 } : { id: TAVERN_STAIRS.id, x: TAVERN_STAIRS.x, y: TAVERN_STAIRS.y, w: 3 }) : undefined,
      };
    },
  };
}

export function interiorVenues(spec: HandInteriorSpec): InteriorVenue[] {
  return [
    ...(spec.objects["great telescope"] && spec.objects["dome vault"] ? [observatoryVenue(spec)] : []),
    ...(spec.objects["keg rack"] && spec.objects["counter 4x1"] && spec.objects["stairs up wood"] ? [tavernVenue(spec)] : []),
  ];
}
