import { isDeepStrictEqual } from "node:util";
import type { Project, SectionStructureKitDef } from "../../src/project/types";
import {
  spatialId as id,
  checkedDocument,
} from "../../src/project/spatial/domain";
import {
  INTERIOR_OBJECT_CATALOG,
  interiorTableCells,
} from "../../src/project/defaults/interiorObjectCatalog";
import { houseObjectForGraphic } from "./houseSpatialCatalog.mts";
const atlas = "easyrpg_chipset_interior";
type Cell = { dx: number; dy: number; layer: "upper" | "lower"; tile: number };
const at = (key: string, x: number, y: number): Cell[] =>
  INTERIOR_OBJECT_CATALOG.find((o) => o.id === key)!.cells.map((c) => ({
    ...c,
    dx: c.dx + x,
    dy: c.dy + y,
  }));
const rows = (r: number[][], layer: "upper" | "lower", x = 0, y = 0): Cell[] =>
  r.flatMap((a, dy) =>
    a.flatMap((tile, dx) =>
      tile < 0 ? [] : [{ dx: x + dx, dy: y + dy, layer, tile }],
    ),
  );
const floor = (w: number, h: number, tile = 72) =>
  rows(
    Array.from({ length: h }, () => Array(w).fill(tile)),
    "lower",
  );
export const SPECIAL_PLACES = [
  "special-interior:place:inn",
  "special-interior:place:shop",
];
export const SPECIAL_ROOTS = [
  "special-interior:example:inn",
  "special-interior:example:shop",
];
export function registerSpecialInteriors(input: Project): Project {
  const p = structuredClone(input),
    lib = p.spatialAuthoring!.library;
  const put = (records: any, next: any) => {
    const old = records[next.id];
    records[next.id] =
      old &&
      isDeepStrictEqual({ ...old, revision: 1 }, { ...next, revision: 1 })
        ? old
        : { ...next, revision: old ? old.revision + 1 : 1 };
    return records[next.id];
  };
  const base = (key: string, name: string, tags: string[] = []) => ({
    id: id(`special-interior:${key}`),
    name,
    revision: 1,
    tags: ["시설별 실내 기준 20260914", ...tags],
    provenance: {
      origin: "ai" as const,
      sourceId: "special-interiors-20260914",
    },
  });
  // Curtain use is authored per use, not inserted into every dwelling.
  for (const s of Object.values(lib.spaces).filter((s) =>
    s.tags.includes("생활 구역 구성 20260914"),
  )) {
    if (
      ["house-catalog:room:top", "reviewed-interior:inn-suite"].includes(s.id)
    )
      continue;
    put(lib.spaces, {
      ...s,
      objectSlots: s.objectSlots.filter(
        (slot) =>
          lib.objects[slot.objectDesignId]?.graphic.kitId !==
          "interior-life:curtain",
      ),
      tags: s.tags.map((t) =>
        t === "난롯가·식탁·침상·세면·커튼" ? "난롯가·식탁·침상·세면" : t,
      ),
    });
  }
  const kit = (
    key: string,
    name: string,
    w: number,
    h: number,
    cells: Cell[],
    rule: string,
  ) => {
    const kitId = `special-interior:${key}`,
      map = new Map(cells.map((c) => [`${c.dx},${c.dy},${c.layer}`, c.tile]));
    const k: SectionStructureKitDef = {
      id: kitId,
      kind: "section",
      name,
      width: w,
      height: h,
      learnedFrom: "db-authored",
      rows: Array.from({ length: h }, (_, y) => ({
        tiles: Array.from(
          { length: w },
          (_, x) => map.get(`${x},${y},lower`) ?? -1,
        ),
        upperTiles: Array.from(
          { length: w },
          (_, x) => map.get(`${x},${y},upper`) ?? -1,
        ),
      })),
      ai: {
        description: name,
        placementRules: rule,
        snap: "floor",
        interiorRole: "decoration",
      },
    };
    const ks = p.tilesets[atlas].structureKits ?? [];
    p.tilesets[atlas].structureKits = [...ks.filter((x) => x.id !== kitId), k];
    return put(lib.objects, {
      ...base(`object:${key}`, name, [rule]),
      graphic: { tilesetId: atlas, kitId },
      anchors: [],
      chips: [],
    }).id;
  };
  const reception = kit(
    "reception",
    "여관 접수 구역 · 장부·열쇠 보관장·접수대",
    5,
    4,
    [
      ...floor(5, 3).map((c) => ({ ...c, dy: c.dy + 1 })),
      ...rows([[148], [178]], "upper", 4, 0),
      ...interiorTableCells(3, 1).map((c) => ({ ...c, dy: c.dy + 2 })),
      { dx: 1, dy: 2, layer: "upper", tile: 145 },
    ],
    "접수대 뒤 한 줄은 직원 통로, 앞은 손님 대기 자리. 장부는 상판에 둔다.",
  );
  const checkout = kit(
    "checkout",
    "잡화점 계산대 · 장부·금전함·포장 자리",
    5,
    4,
    [
      ...floor(5, 4, 102),
      ...at("box", 4, 0),
      ...interiorTableCells(3, 1).map((c) => ({
        ...c,
        dx: c.dx + 1,
        dy: c.dy + 2,
      })),
      { dx: 2, dy: 2, layer: "upper", tile: 145 },
    ],
    "계산대 뒤 직원 영역과 앞 손님 통로를 구분한다. 왼쪽 한 칸은 직원 출입구로 비운다.",
  );
  const luggage = kit(
    "luggage",
    "여행 짐 보관 · 상자와 술통",
    3,
    2,
    [...floor(3, 2), ...at("box", 0, 0), ...at("barrel", 2, 0)],
    "입구 가까운 벽에 모아 두고 앞 한 줄은 짐을 꺼내는 공간으로 비운다.",
  );
  const stocks = kit(
    "stock",
    "재고 구역 · 상자·자루·술통",
    4,
    3,
    [
      ...floor(4, 3, 102),
      ...at("box", 0, 0),
      ...at("grain", 1, 0),
      ...at("barrel", 3, 0),
      ...at("box", 0, 1),
    ],
    "후방 창고의 벽을 따라 재고를 모으고 중앙 반출 통로를 비운다.",
  );
  const beds = kit(
    "dormitory",
    "다인실 · 세 침대와 여행 가방",
    7,
    3,
    [
      ...floor(7, 3, 102),
      ...at("bed_v", 0, 0),
      ...at("bed_v", 3, 0),
      ...at("bed_v", 6, 0),
      ...at("box", 1, 0),
      ...at("box", 4, 0),
    ],
    "세 침대 앞 한 줄과 침대 사이를 통로로 남긴다. 다인실에는 대형 커튼을 반복하지 않는다.",
  );
  const goods = kit(
    "goods",
    "잡화 진열대 · 약병·꽃병·술병과 잔",
    5,
    3,
    [
      ...floor(5, 3, 102),
      ...interiorTableCells(3, 1).map((c) => ({ ...c, dx: c.dx + 1 })),
      ...rows([[350, 296, 237]], "upper", 1, 0),
    ],
    "상품은 진열대 상판 위에 둔다. 두 옆과 앞은 손님이 둘러보는 통로다.",
  );
  const provisions = kit(
    "provisions",
    "식료품 진열 · 과일·곡물·항아리",
    4,
    3,
    [
      ...floor(4, 3, 102),
      ...interiorTableCells(3, 1),
      ...at("fruit_shelf", 0, 0),
      ...at("grain", 3, 0),
      ...at("kettle", 2, 0),
    ],
    "식료품은 상품군끼리 모으고 앞 두 행은 접근과 이동에 쓴다.",
  );
  const shelf = kit(
    "shelf",
    "서적 진열 · 벽에 붙은 큰 서가",
    3,
    3,
    [
      ...rows(
        [
          [18, 19, 20],
          [48, 49, 50],
          [78, 79, 80],
        ],
        "upper",
      ),
    ],
    "윗행을 북벽에 겹쳐 놓고 서가 앞 접근로를 남긴다.",
  );
  const prep = kit(
    "prep",
    "주방 조리 작업대 · 항아리와 식기",
    3,
    2,
    [
      ...interiorTableCells(3, 1),
      ...at("kettle", 0, 0),
      { dx: 2, dy: 0, layer: "upper", tile: 204 },
    ],
    "화덕 가까이에 놓고 작업대 앞 한 줄을 비운다.",
  );
  const object = (key: string) => {
    const o = lib.objects[key] ?? houseObjectForGraphic(p, atlas, key);
    if (!o) throw Error(`Missing ${key}`);
    return o.id;
  };
  const slot = (
    key: string,
    o: string,
    x: number,
    y: number,
    wallOverlap?: 1 | 2,
  ) => ({
    id: id(key),
    objectDesignId: object(o),
    quantity: 1,
    required: true,
    placement: {
      mode: "fixed" as const,
      x,
      y,
      ...(wallOverlap ? { wallOverlap } : {}),
    },
  });
  const port = (key: string, name: string, x: number, y: number) => ({
    id: id(key),
    name,
    x,
    y,
  });
  const R = (
    key: string,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    floor: string,
  ) => ({ id: id(key), name, x, y, width, height, floor });
  const space = (
    key: string,
    name: string,
    width: number,
    height: number,
    rooms: any[],
    doorways: any[],
    ports: any[],
    slots: any[],
    tags: string[],
  ) =>
    put(lib.spaces, {
      ...base(`space:${key}`, name, tags),
      environment: "interior",
      role: "entrance",
      tilesetId: atlas,
      shape: "rect",
      width,
      height,
      floor: "wood",
      wall: "cream",
      interiorLayout: { rooms, doorways },
      ports,
      objectSlots: slots,
    });
  const lobby = space(
    "inn-lobby",
    "길손 여관 · 접수와 공용 식당",
    17,
    12,
    [
      R("hall", "접수·대기·공용 식사", 0, 0, 11, 12, "wood"),
      R("kitchen", "주방", 12, 0, 5, 5, "gravel"),
      R("store", "주인 창고", 12, 8, 5, 4, "plank"),
    ],
    [
      { x: 11, y: 3 },
      { x: 11, y: 10 },
    ],
    [
      port("entry", "여관 현관", 5, 11),
      port("up", "객실로 올라가는 계단", 9, 5),
    ],
    [
      slot("reception", reception, 0, 0, 1),
      slot("luggage", luggage, 7, 0),
      slot("tea", "interior-life:tea", 5, 2),
      slot("common-meal", "interior-life:meal", 0, 6),
      slot("cook", "interior-life:kitchen", 12, 0, 1),
      slot("prep", prep, 13, 2),
      slot("pantry", stocks, 13, 8),
      slot("stairs-up", "stairs_small", 9, 5),
    ],
    ["여관", "접수", "공용 식당", "주방", "수하물", "커튼 없음"],
  );
  const guest = space(
    "inn-guests",
    "길손 여관 · 다인실과 개인실",
    17,
    12,
    [
      R("dorm", "저렴한 다인실 · 세 침대", 0, 0, 8, 5, "plank"),
      R("suite", "개인실 · 침대와 차탁", 9, 0, 8, 5, "wood"),
      R("corridor", "객실 복도", 0, 8, 17, 4, "wood"),
    ],
    [
      { x: 3, y: 5 },
      { x: 13, y: 5 },
    ],
    [port("down", "아래층 계단", 8, 11)],
    [
      slot("beds", beds, 0, 0),
      slot("private-bed", "interior-life:sleep", 9, 0, 1),
      slot("private-curtain", "interior-life:curtain", 15, 0, 2),
      slot("private-tea", "interior-life:tea", 9, 2),
      slot("luggage", luggage, 0, 8),
      slot("stairs-down", "stairs_down", 8, 11),
    ],
    ["여관", "객실", "다인실", "개인실", "커튼은 개인실 한 곳만"],
  );
  const shop = space(
    "shop",
    "모퉁이 잡화점 · 진열과 계산",
    15,
    10,
    [
      R("sales", "상품 진열과 계산", 0, 0, 9, 10, "plank"),
      R("stock", "후방 재고실", 10, 0, 5, 4, "wood"),
      R("packing", "포장과 반출", 10, 7, 5, 3, "wood"),
    ],
    [
      { x: 9, y: 2 },
      { x: 9, y: 8 },
    ],
    [port("entry", "상점 출입구", 4, 9)],
    [
      slot("checkout", checkout, 0, 0),
      slot("wall-shelf", shelf, 6, 0, 1),
      slot("goods-island", goods, 0, 5),
      slot("food-island", provisions, 5, 5),
      slot("stock", stocks, 10, 0),
      slot("packing", luggage, 11, 7),
    ],
    ["잡화점", "계산대", "상품별 진열", "후방 창고", "직원 통로", "커튼 없음"],
  );
  for (const [key, yardKey, floors] of [
    ["inn", "inn", [lobby, guest]],
    ["shop", "shop", [shop]],
  ] as const) {
    const yard = lib.spaces[`house-catalog:yard:${yardKey}`],
      street = yard.ports.find((q) => q.id === "street")!;
    put(lib.places, {
      ...base(
        `place:${key}`,
        key === "inn"
          ? "길손 여관 · 접수·식당·객실"
          : "모퉁이 잡화점 · 진열·계산·재고",
        [key === "inn" ? "여관" : "잡화점", "시설별 실내 기준", "출입 연결"],
      ),
      kind: "facility",
      layout: "manual",
      ports: [port("entrance", "마당 입구", street.x, street.y)],
      children: [
        {
          id: id("yard"),
          source: { kind: "space", id: yard.id },
          x: 0,
          y: 0,
          level: 0,
        },
        ...floors.map((s, i) => ({
          id: id(`floor-${i + 1}`),
          source: { kind: "space", id: s.id },
          x: 0,
          y: 0,
          level: i + 1,
        })),
      ],
      connections: [
        {
          id: id("front-door"),
          from: { childId: id("yard"), portId: id("door") },
          to: { childId: id("floor-1"), portId: id("entry") },
          bidirectional: true,
        },
        ...(floors.length === 2
          ? [
              {
                id: id("stairs"),
                from: { childId: id("floor-1"), portId: id("up") },
                to: { childId: id("floor-2"), portId: id("down") },
                bidirectional: true,
              },
            ]
          : []),
      ],
    });
  }
  checkedDocument(p.spatialAuthoring, p);
  return p;
}
