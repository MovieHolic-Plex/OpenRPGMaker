import { bakeHouseStudy, type HouseStudy } from "./houseStudyDesigns.mts";
import { HOUSE30_TAG, type House30Entry } from "./house30Contract.mts";

/** New material recipes. The volumes describe one contour before any tile is drawn;
 * upper facades then occlude that plane while retaining a roof slope on both sides.
 * None of these entries loads or copies a saved house section.
 */
const DESIGNS: { number: number; family: string; study: HouseStudy }[] = [
  { number: 11, family: "central-core", study: {
    id: "central-ridge", name: "중앙 마루 이층집", note: "중앙 윗채와 양쪽으로 같은 폭 펼쳐진 낮은 어깨 지붕",
    width: 16, height: 13,
    volumes: [{ x: 4, y: 0, w: 8, roof: 9, wall: 3 }, { x: 0, y: 3, w: 16, roof: 6, wall: 3 }],
    upperStorey: { x: 4, y: 4, w: 8, h: 3 }, doors: [{ x: 8, y: 12 }],
  } },
  { number: 12, family: "staggered-upper", study: {
    id: "staggered-upper", name: "엇갈린 윗채 이층집", note: "왼쪽 높은 윗벽과 오른쪽 낮은 윗벽을 한 지붕의 꺾임으로 연결",
    width: 20, height: 15,
    volumes: [{ x: 2, y: 0, w: 7, roof: 11, wall: 3, color: "slate" },
      { x: 10, y: 2, w: 8, roof: 9, wall: 3, color: "slate" },
      { x: 0, y: 3, w: 20, roof: 8, wall: 3, color: "slate" }],
    upperStoreys: [{ x: 2, y: 4, w: 7, h: 3 }, { x: 11, y: 6, w: 7, h: 3, roofStart: 2 }],
    doors: [{ x: 11, y: 14 }],
  } },
  { number: 13, family: "short-upper-long-wing", study: {
    id: "long-kitchen", name: "긴 부엌채 이층집", note: "짧은 왼쪽 윗채에서 긴 부엌 지붕이 뻗고 전면은 한 줄로 이어짐",
    width: 22, height: 12,
    volumes: [{ x: 2, y: 0, w: 6, roof: 8, wall: 3, material: "log" },
      { x: 0, y: 3, w: 22, roof: 5, wall: 3, material: "log" }],
    upperStorey: { x: 2, y: 4, w: 6, h: 3 }, doors: [{ x: 11, y: 11 }],
  } },
  { number: 14, family: "shop-and-home", study: {
    id: "shop-home", name: "앞가게 윗살림집", note: "넓은 윗살림채 아래로 가게 전면이 돌출되고 옆에 별도 생활 현관을 둠",
    width: 18, height: 15,
    volumes: [{ x: 3, y: 0, w: 12, roof: 8, wall: 3, material: "stone", color: "slate" },
      { x: 0, y: 3, w: 18, roof: 5, wall: 3, material: "stone", color: "slate" },
      { x: 4, y: 7, w: 10, roof: 4, wall: 3, material: "stone", color: "slate" }],
    upperStorey: { x: 3, y: 4, w: 12, h: 3 }, doors: [{ x: 1, y: 11 }, { x: 9, y: 14 }],
  } },
  { number: 15, family: "stepped-lower-wings", study: {
    id: "stepped-wings", name: "세 폭 계단처마집", note: "하층의 왼쪽·중앙·오른쪽 벽선이 서로 다른 깊이로 전진하는 계단형 처마",
    width: 19, height: 15,
    volumes: [{ x: 5, y: 0, w: 8, roof: 10, wall: 3 },
      { x: 0, y: 3, w: 6, roof: 5, wall: 3 },
      { x: 6, y: 3, w: 7, roof: 7, wall: 3 },
      { x: 13, y: 4, w: 6, roof: 7, wall: 3 }],
    upperStorey: { x: 5, y: 4, w: 8, h: 3 }, doors: [{ x: 9, y: 13 }],
  } },
  { number: 16, family: "forward-central-hall", study: {
    id: "forward-hall", name: "두 단 앞채 이층집", note: "가로 어깨에서 중간 앞채와 좁은 현관채가 두 단계로 전진하는 외곽",
    width: 20, height: 17,
    volumes: [{ x: 6, y: 0, w: 8, roof: 8, wall: 3, material: "log" },
      { x: 0, y: 3, w: 20, roof: 4, wall: 3, material: "log" },
      { x: 5, y: 6, w: 10, roof: 4, wall: 3, material: "log" },
      { x: 7, y: 8, w: 6, roof: 5, wall: 3, material: "log" }],
    upperStorey: { x: 6, y: 4, w: 8, h: 3 }, doors: [{ x: 10, y: 16 }],
  } },
  { number: 17, family: "deep-l-wing", study: {
    id: "deep-side-wing", name: "깊은 옆채 이층집", note: "왼쪽 윗채와 좁은 가로 연결부에서 오른쪽 긴 날개가 내려오는 ㄱ자",
    width: 18, height: 17,
    volumes: [{ x: 2, y: 0, w: 7, roof: 8, wall: 3, material: "stone" },
      { x: 0, y: 3, w: 18, roof: 5, wall: 3, material: "stone" },
      { x: 12, y: 6, w: 6, roof: 7, wall: 3, material: "stone" }],
    upperStorey: { x: 2, y: 4, w: 7, h: 3 }, doors: [{ x: 6, y: 11 }],
  } },
  { number: 18, family: "recessed-front", study: {
    id: "recessed-entry", name: "오목현관 이층집", note: "두 짧은 앞날개 사이로 현관이 두 칸 들어가는 작은 입구 포켓",
    width: 18, height: 14,
    volumes: [{ x: 5, y: 0, w: 8, roof: 8, wall: 3, color: "slate" },
      { x: 0, y: 3, w: 18, roof: 5, wall: 3, color: "slate" },
      { x: 0, y: 8, w: 5, roof: 2, wall: 3, color: "slate" },
      { x: 13, y: 8, w: 5, roof: 2, wall: 3, color: "slate" }],
    upperStorey: { x: 5, y: 4, w: 8, h: 3 }, doors: [{ x: 9, y: 11 }],
  } },
  { number: 19, family: "shifted-broad-front", study: {
    id: "offset-front", name: "비껴난 넓은 앞채집", note: "앞채가 본채 오른쪽 바깥까지 뻗어 뒤·앞 외곽이 서로 다른 위치에서 꺾임",
    width: 21, height: 16,
    volumes: [{ x: 3, y: 0, w: 8, roof: 9, wall: 3 },
      { x: 0, y: 3, w: 18, roof: 6, wall: 3 },
      { x: 5, y: 7, w: 16, roof: 5, wall: 3 }],
    upperStorey: { x: 3, y: 4, w: 8, h: 3 }, doors: [{ x: 14, y: 15 }],
  } },
  { number: 20, family: "double-shoulder-ridge", study: {
    id: "double-shoulder-ridge", name: "겹어깨 마루 이층집", note: "용마루에서 두 번 꺾이며 넓어지는 좌우 어깨와 좁은 중앙 윗벽",
    width: 16, height: 14,
    volumes: [{ x: 5, y: 0, w: 6, roof: 10, wall: 3, material: "stone", color: "slate" },
      { x: 3, y: 2, w: 10, roof: 8, wall: 3, material: "stone", color: "slate" },
      { x: 0, y: 5, w: 16, roof: 5, wall: 3, material: "stone", color: "slate" }],
    upperStorey: { x: 5, y: 4, w: 6, h: 3 }, doors: [{ x: 8, y: 13 }],
  } },
];

export function buildHouse30BatchB(): House30Entry[] {
  return DESIGNS.map(({ number, family, study }) => {
    const kit = bakeHouseStudy(study);
    kit.id = `house-30-${number}-${study.id}`;
    kit.ai = { ...kit.ai, tags: ["집", "house", HOUSE30_TAG, "2층", family],
      description: study.note,
      placementRules: "한 채의 연결된 지붕. 층수는 외관 기준이며 실내는 별도 설계한다. 문 아래 접근로를 비운다." };
    // A shop's contiguous display pair and home door are visible on different facades.
    if (number === 14) {
      for (const x of [5, 6, 11, 12]) kit.rows[13]!.upperTiles![x] = 87;
    }
    // The baker's default pair converges on a six-cell facade; separate the windows.
    if (number === 13 || number === 20) {
      const upper = study.upperStorey!;
      for (const x of [upper.x + 2, upper.x + 3]) kit.rows[upper.y + 1]!.upperTiles![x] = -1;
      for (const x of [upper.x + 1, upper.x + 4]) kit.rows[upper.y + 1]!.upperTiles![x] = number === 20 ? 87 : 85;
    }
    // A raised roofStart may repaint beneath a transparent ridge cap. Preserve the
    // cut-out corner instead of backing it with an opaque roof tile (notably 12).
    for (const row of kit.rows) for (let x = 0; x < kit.width; x++) {
      if ([354,355,356,357].includes(row.upperTiles?.[x] ?? -1)) row.tiles[x] = -1;
    }
    return { number, family, name: study.name, description: study.note, floors: 2,
      doors: study.doors.map(door => ({ ...door })), kit };
  });
}
