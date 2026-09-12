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

const clay = (x: number, y: number, w: number, roof: number, material: Volume["material"] = "plaster"): Volume =>
  ({ x, y, w, roof, wall: 3, material, color: "clay" });
const slate = (x: number, y: number, w: number, roof: number, material: Volume["material"] = "stone"): Volume =>
  ({ x, y, w, roof, wall: 3, material, color: "slate" });

/** Every design starts from atlas roof and wall materials. Footprints and upper
 * positions vary together; none are recolors or mirrored completed house kits.
 */
const DESIGNS: Design[] = [
  { number: 21, slug: "open-court", name: "긴 날개의 중정 주택", family: "열린 중정 · 2층",
    description: "낮은 양쪽 날개가 앞마당을 깊게 감싸고, 뒤채 중앙의 2층에서 지붕이 이어지는 ㄷ자 주택.",
    width: 26, height: 20,
    tiers: [[clay(7, 0, 10, 4)],
      [clay(0, 3, 26, 7), clay(0, 3, 6, 13), clay(20, 3, 6, 13)]],
    doors: [{ x: 13, y: 13 }] },
  { number: 22, slug: "deep-west-wing", name: "서쪽 긴 날개 저택", family: "비대칭 ㄱ자 · 2층",
    description: "넓은 뒤채의 오른쪽에 윗층을 놓고, 왼쪽 날개만 앞으로 길게 내민 석조 저택.",
    width: 24, height: 21,
    tiers: [[slate(10, 0, 10, 4, "plaster")],
      [slate(0, 3, 24, 7), slate(0, 3, 8, 14)]],
    doors: [{ x: 16, y: 13 }, { x: 4, y: 20 }] },
  { number: 23, slug: "axial-hall", name: "삼층 중앙 현관집", family: "중앙 돌출 ㅗ자 · 3층",
    description: "짧은 맨윗층 아래로 넓은 가로채를 놓고 지상 중앙 현관채를 앞으로 내민 3층집.",
    width: 24, height: 24,
    tiers: [[clay(9, 0, 6, 3)], [clay(4, 2, 16, 7)],
      [clay(0, 8, 24, 7), clay(8, 8, 8, 12)]],
    doors: [{ x: 12, y: 23 }] },
  { number: 24, slug: "east-service-wing", name: "동쪽 별실을 이은 집", family: "깊은 본채와 낮은 옆채 · 2층",
    description: "깊은 왼쪽 본채 위로 윗층이 솟고 오른쪽의 낮은 별실 지붕이 넓게 이어지는 목조 주택.",
    width: 25, height: 20,
    tiers: [[clay(3, 0, 8, 5, "log")],
      [clay(0, 4, 15, 12, "log"), clay(11, 6, 14, 5, "log")]],
    doors: [{ x: 7, y: 19 }, { x: 20, y: 14 }] },
  { number: 25, slug: "shifted-manor", name: "엇갈린 삼층 저택", family: "편심 계단형 · 3층",
    description: "윗층은 왼쪽, 지상 정면은 오른쪽으로 늘어나며 층마다 처마 깊이가 다른 회벽 저택.",
    width: 24, height: 21,
    tiers: [[slate(4, 0, 7, 4, "plaster")],
      [slate(2, 3, 14, 7, "plaster")],
      [slate(0, 9, 20, 7, "plaster"), slate(18, 11, 6, 6, "plaster")]],
    doors: [{ x: 11, y: 19 }, { x: 21, y: 20 }] },
  { number: 26, slug: "four-storey-crown", name: "중앙 사층 대주택", family: "중앙 집중형 · 4층",
    description: "작은 최상층에서 네 단의 처마가 넓어지며 마지막 층의 넓은 정면으로 내려오는 대주택.",
    width: 24, height: 25,
    tiers: [[clay(9, 0, 6, 3)], [clay(7, 2, 10, 7)],
      [clay(4, 8, 16, 7)], [clay(0, 14, 24, 7, "stone")]],
    doors: [{ x: 12, y: 24 }] },
  { number: 27, slug: "broad-upper-house", name: "넓은 윗채 삼층집", family: "낮고 넓은 상층 · 3층",
    description: "가로로 넓은 맨윗채 아래의 두 층이 완만하게 벌어지고 한쪽 현관이 살짝 앞으로 나온 집.",
    width: 27, height: 23,
    tiers: [[clay(5, 0, 14, 4, "log")], [clay(2, 3, 20, 8, "log")],
      [clay(0, 10, 27, 7, "stone"), clay(4, 10, 7, 9, "stone")]],
    doors: [{ x: 7, y: 22 }, { x: 21, y: 20 }] },
  { number: 28, slug: "eastern-high-house", name: "동쪽 사층 저택", family: "편심 고층과 긴 서쪽 처마 · 4층",
    description: "최상층을 오른쪽에 두고 아래층을 서쪽으로 점차 넓힌 4층집. 지상 서쪽 끝은 더 깊다.",
    width: 28, height: 27,
    tiers: [[slate(16, 0, 6, 3, "plaster")], [slate(13, 2, 11, 7, "plaster")],
      [slate(8, 8, 18, 7, "plaster")],
      [slate(0, 14, 28, 7), slate(0, 14, 7, 9)]],
    doors: [{ x: 17, y: 24 }, { x: 3, y: 26 }] },
  { number: 29, slug: "deep-library-house", name: "깊은 지붕의 서재 주택", family: "깊은 본채 · 2층",
    description: "높이가 긴 상층 지붕과 넓은 아래 지붕 사이에 벽을 드러내고, 왼쪽 정면을 앞으로 내민 서재 주택.",
    width: 18, height: 22,
    tiers: [[slate(5, 0, 8, 7, "plaster")],
      [slate(0, 6, 18, 9, "plaster"), slate(0, 6, 8, 12, "plaster")]],
    doors: [{ x: 5, y: 21 }, { x: 13, y: 18 }] },
  { number: 30, slug: "three-storey-court", name: "삼층 안뜰 저택", family: "넓은 중정 · 3층",
    description: "작은 최상층과 넓은 중간층 아래로 길고 넓은 왼쪽 날개와 짧은 오른쪽 날개가 안뜰을 감싸는 저택.",
    width: 28, height: 27,
    tiers: [[slate(10, 0, 8, 4, "plaster")], [slate(6, 3, 16, 7, "plaster")],
      [slate(0, 9, 28, 7), slate(0, 9, 7, 14), slate(23, 9, 5, 11)]],
    doors: [{ x: 14, y: 19 }] },
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
  // Verify the three rows of every intended facade from actual wall cells,
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
