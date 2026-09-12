import assert from "node:assert/strict";
import { bakeHouseStudy, type HouseStudy } from "./houseStudyDesigns.mts";
import { HOUSE30_TAG, type House30Entry } from "./house30Contract.mts";

type Volume = HouseStudy["volumes"][number];
type Point = { x: number; y: number };
type Design = {
  number: number; slug: string; name: string; description: string; family: string;
  width: number; height: number;
  /** Roof/wall volumes in global cells, from the highest floor to the ground. */
  tiers: Volume[][];
  /** Ground-level door's bottom cell; the approach starts one row below. */
  doors: Point[];
};

/** Every design starts from atlas roof and wall materials. Footprints and upper
 * positions vary together; none are recolors or mirrored completed house kits.
 */
const DESIGNS: Design[] = [
  {
    number: 21,
    slug: "open-court",
    name: "작은 중정 이층집",
    family: "열린 중정",
    description: "열린 중정 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 13,
    height: 12,
    tiers: [
      [{x: 4, y: 0, w: 5, roof: 2, wall: 3, material: "plaster", color: "clay"}],
      [{x: 0, y: 2, w: 13, roof: 4, wall: 3, material: "plaster", color: "clay"}, {x: 0, y: 2, w: 3, roof: 6, wall: 3, material: "plaster", color: "clay"}, {x: 10, y: 2, w: 3, roof: 6, wall: 3, material: "plaster", color: "clay"}],
    ],
    doors: [
      {x: 6, y: 9},
    ],
  },
  {
    number: 22,
    slug: "deep-west-wing",
    name: "서쪽 날개 이층집",
    family: "비대칭 ㄱ자",
    description: "비대칭 ㄱ자 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 12,
    height: 12,
    tiers: [
      [{x: 5, y: 0, w: 4, roof: 2, wall: 3, material: "stone", color: "slate"}],
      [{x: 0, y: 2, w: 12, roof: 4, wall: 3, material: "stone", color: "slate"}, {x: 0, y: 2, w: 3, roof: 6, wall: 3, material: "stone", color: "slate"}],
    ],
    doors: [
      {x: 7, y: 9},
      {x: 1, y: 11},
    ],
  },
  {
    number: 23,
    slug: "axial-hall",
    name: "삼층 중앙 현관집",
    family: "중앙 돌출",
    description: "중앙 돌출 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 13,
    height: 13,
    tiers: [
      [{x: 5, y: 0, w: 3, roof: 2, wall: 2, material: "plaster", color: "clay"}],
      [{x: 3, y: 1, w: 7, roof: 4, wall: 2, material: "plaster", color: "clay"}],
      [{x: 0, y: 2, w: 13, roof: 6, wall: 3, material: "plaster", color: "clay"}, {x: 4, y: 3, w: 5, roof: 6, wall: 3, material: "plaster", color: "clay"}],
    ],
    doors: [
      {x: 6, y: 12},
    ],
  },
  {
    number: 24,
    slug: "east-service-wing",
    name: "동쪽 별실 이층집",
    family: "낮은 옆채",
    description: "낮은 옆채 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 13,
    height: 12,
    tiers: [
      [{x: 2, y: 0, w: 4, roof: 3, wall: 3, material: "stone", color: "clay"}],
      [{x: 0, y: 2, w: 9, roof: 6, wall: 3, material: "stone", color: "clay"}, {x: 8, y: 3, w: 5, roof: 3, wall: 3, material: "stone", color: "clay"}],
    ],
    doors: [
      {x: 4, y: 11},
      {x: 10, y: 9},
    ],
  },
  {
    number: 25,
    slug: "shifted-manor",
    name: "엇갈린 삼층집",
    family: "편심 계단형",
    description: "편심 계단형 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 14,
    height: 13,
    tiers: [
      [{x: 4, y: 0, w: 3, roof: 2, wall: 2, material: "plaster", color: "slate"}],
      [{x: 2, y: 1, w: 8, roof: 4, wall: 2, material: "plaster", color: "slate"}],
      [{x: 0, y: 2, w: 12, roof: 6, wall: 3, material: "plaster", color: "slate"}, {x: 10, y: 3, w: 4, roof: 6, wall: 3, material: "plaster", color: "slate"}],
    ],
    doors: [
      {x: 6, y: 11},
      {x: 12, y: 12},
    ],
  },
  {
    number: 26,
    slug: "four-storey-crown",
    name: "중앙 사층집",
    family: "중앙 집중형",
    description: "중앙 집중형 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 15,
    height: 15,
    tiers: [
      [{x: 6, y: 0, w: 3, roof: 1, wall: 2, material: "plaster", color: "clay"}],
      [{x: 4, y: 1, w: 7, roof: 3, wall: 2, material: "plaster", color: "clay"}],
      [{x: 2, y: 2, w: 11, roof: 5, wall: 2, material: "plaster", color: "clay"}],
      [{x: 0, y: 3, w: 15, roof: 8, wall: 3, material: "plaster", color: "clay"}],
    ],
    doors: [
      {x: 7, y: 14},
    ],
  },
  {
    number: 27,
    slug: "broad-upper-house",
    name: "넓은 윗채 삼층집",
    family: "넓은 상층",
    description: "넓은 상층 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 15,
    height: 13,
    tiers: [
      [{x: 4, y: 0, w: 6, roof: 2, wall: 2, material: "plaster", color: "clay"}],
      [{x: 2, y: 1, w: 11, roof: 4, wall: 2, material: "plaster", color: "clay"}],
      [{x: 0, y: 2, w: 15, roof: 6, wall: 3, material: "plaster", color: "clay"}, {x: 3, y: 3, w: 4, roof: 6, wall: 3, material: "plaster", color: "clay"}],
    ],
    doors: [
      {x: 5, y: 12},
      {x: 11, y: 11},
    ],
  },
  {
    number: 28,
    slug: "eastern-high-house",
    name: "동쪽 사층집",
    family: "편심 고층",
    description: "편심 고층 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 15,
    height: 15,
    tiers: [
      [{x: 6, y: 0, w: 3, roof: 1, wall: 2, material: "stone", color: "slate"}],
      [{x: 4, y: 1, w: 7, roof: 3, wall: 2, material: "stone", color: "slate"}],
      [{x: 2, y: 2, w: 11, roof: 5, wall: 2, material: "stone", color: "slate"}],
      [{x: 0, y: 3, w: 15, roof: 7, wall: 3, material: "stone", color: "slate"}, {x: 0, y: 3, w: 3, roof: 8, wall: 3, material: "stone", color: "slate"}],
    ],
    doors: [
      {x: 8, y: 13},
      {x: 1, y: 14},
    ],
  },
  {
    number: 29,
    slug: "deep-library-house",
    name: "깊은 지붕 서재집",
    family: "깊은 본채",
    description: "깊은 본채 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 11,
    height: 13,
    tiers: [
      [{x: 3, y: 0, w: 5, roof: 4, wall: 3, material: "plaster", color: "slate"}],
      [{x: 0, y: 3, w: 11, roof: 5, wall: 3, material: "plaster", color: "slate"}, {x: 0, y: 3, w: 3, roof: 6, wall: 3, material: "plaster", color: "slate"}],
    ],
    doors: [
      {x: 1, y: 12},
      {x: 7, y: 11},
    ],
  },
  {
    number: 30,
    slug: "three-storey-court",
    name: "삼층 안뜰집",
    family: "넓은 중정",
    description: "넓은 중정 윤곽과 층별 양옆 처마를 보존한 최대 15칸 외형.",
    width: 15,
    height: 14,
    tiers: [
      [{x: 6, y: 0, w: 3, roof: 2, wall: 2, material: "plaster", color: "slate"}],
      [{x: 4, y: 1, w: 7, roof: 4, wall: 2, material: "plaster", color: "slate"}],
      [{x: 0, y: 2, w: 15, roof: 6, wall: 3, material: "plaster", color: "slate"}, {x: 0, y: 3, w: 3, roof: 7, wall: 3, material: "plaster", color: "slate"}, {x: 12, y: 3, w: 3, roof: 6, wall: 3, material: "plaster", color: "slate"}],
    ],
    doors: [
      {x: 7, y: 11},
    ],
  },
];

function compose(design: Design): House30Entry {
  const { number, slug, name, description, family, width, height } = design;
  const tiers = design.tiers.map((volumes, i) => bakeHouseStudy({
    id: `house30-c-${number}-tier-${i}`, name, note: description, width, height, volumes, doors: [],
  }));
  const kit = structuredClone(tiers.at(-1)!);
  // Lower planes first. Completed upper walls occlude the roof behind them;
  // the lower plane's two-cell shoulders and outside eave corners remain visible.
  for (const tier of tiers.slice(0, -1).reverse()) tier.rows.forEach((row, y) => row.tiles.forEach((tile, x) => {
    if (tile >= 0) {
      kit.rows[y]!.tiles[x] = tile;
      kit.rows[y]!.upperTiles![x] = -1;
    }
    if ((row.upperTiles?.[x] ?? -1) >= 0) kit.rows[y]!.upperTiles![x] = row.upperTiles![x]!;
  }));
  // Verify every authored row of each intended facade from actual wall cells,
  // before ground doors are cut. Top floors must never disappear into roofs.
  const wallIds = new Set([12, 13, 14, 42, 43, 44, 72, 73, 74, 15, 16, 17, 45, 46, 47, 75, 76, 77, 102, 103, 104, 132, 133, 134, 162, 163, 164]);
  const roofIds = new Set([354, 355, 356, 357, 374, 376, 377, 384, 385, 386, 387, 404, 405, 406, 407, 467]);
  for (const tier of tiers) tier.rows.forEach((row, y) => row.tiles.forEach((tile, x) => {
    if (wallIds.has(tile)) assert.equal(kit.rows[y]!.tiles[x], tile, `${number}: facade hidden at ${x},${y}`);
    const upper = row.upperTiles?.[x] ?? -1;
    if ([384, 385, 386, 387].includes(upper)) assert.equal(kit.rows[y]!.upperTiles?.[x], upper, `${number}: lost eave corner ${x},${y}`);
  }));
  for (const tier of tiers.slice(0, -1)) for (const [y, row] of tier.rows.entries()) {
    const facade = row.tiles.flatMap((tile, x) => wallIds.has(tile) ? [x] : []);
    if (!facade.length) continue;
    const left = Math.min(...facade), right = Math.max(...facade);
    for (const x of [left - 2, left - 1, right + 1, right + 2]) {
      const actual = [kit.rows[y]?.tiles[x] ?? -1, kit.rows[y]?.upperTiles?.[x] ?? -1];
      assert.ok(actual.some(tile => roofIds.has(tile)), `${number}: upper facade lacks two-cell roof shoulder at ${x},${y}`);
    }
  }
  // Two-row upper facades still need readable windows at this compact scale.
  for (const volumes of design.tiers.slice(0, -1)) for (const volume of volumes) {
    if (volume.wall !== 2) continue;
    for (let x = volume.x + 1; x < volume.x + volume.w - 1; x += 3) {
      kit.rows[volume.y + volume.roof! + 2]!.upperTiles![x] = volume.color === "slate" ? 87 : 85;
    }
  }
  for (const p of design.doors) {
    kit.rows[p.y - 1]!.tiles[p.x] = 116;
    kit.rows[p.y]!.tiles[p.x] = 146;
    kit.rows[p.y - 1]!.upperTiles![p.x] = -1;
    kit.rows[p.y]!.upperTiles![p.x] = -1;
  }
  kit.id = `house-30-${number}-${slug}`;
  kit.name = name;
  kit.parts = design.doors.map((p, i) => ({ id: `door-${i + 1}`, kind: "entrance" as const, dx: p.x, dy: p.y - 1, w: 1, h: 2,
    note: "남향 지상 출입구. 바로 아래 타일부터 건물 밖까지 접근로를 비워 둔다." }));
  kit.ai = { ...kit.ai, description, tags: ["집", "house", "주택", HOUSE30_TAG, family, `${design.tiers.length}층`],
    placementRules: "건물 전체를 평지에 배치한다. 문 아래와 열린 안뜰에서 남쪽 바깥까지 통로를 확보한다.", role: "structure", repeatability: "fixed", layerHome: "perCell" };
  return { number, name, description, family, floors: design.tiers.length as 2 | 3 | 4,
    doors: structuredClone(design.doors), kit };
}

export function buildHouse30BatchC(): House30Entry[] {
  return DESIGNS.map(compose);
}
