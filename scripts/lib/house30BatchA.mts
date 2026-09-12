/** Ten new, single-storey silhouettes assembled from primitive atlas materials.
 * Volumes describe one building: bakeHouseStudy unions them before contouring.
 * No existing study, house stamp or finished-house template is copied here.
 */
import { bakeHouseStudy, type HouseStudy } from "./houseStudyDesigns.mts";
import { HOUSE30_TAG, type House30Entry } from "./house30Contract.mts";

type Design = {
  number: number;
  family: string;
  study: HouseStudy;
  windows: { x: number; y: number }[];
};

const DESIGNS: Design[] = [
  {
    number: 1, family: "한쪽 뒤지붕 소형집",
    study: { id: "offset-entry", name: "비껴 선 현관집", note: "짧은 정면과 한쪽이 물러난 뒤지붕 · 오른쪽 현관", width: 6, height: 7,
      volumes: [{ x: 0, y: 1, w: 6, roof: 2, wall: 3 }, { x: 0, y: 0, w: 4, roof: 3, wall: 3 }],
      doors: [{ x: 4, y: 6 }] },
    windows: [{ x: 1, y: 5 }],
  },
  {
    number: 2, family: "왼쪽 돌출 ㄱ자",
    study: { id: "left-elbow", name: "왼팔 ㄱ자집", note: "왼쪽 앞채가 길게 나오고 오른쪽 앞마당이 열린 작은 ㄱ자", width: 8, height: 9,
      volumes: [{ x: 0, y: 0, w: 8, roof: 2, wall: 3 }, { x: 0, y: 1, w: 4, roof: 4, wall: 3 }],
      doors: [{ x: 2, y: 8 }] },
    windows: [{ x: 1, y: 7 }, { x: 6, y: 4 }],
  },
  {
    number: 3, family: "중앙 앞뒤 돌출 십자",
    study: { id: "cross-porch", name: "가운데 현관 통나무집", note: "낮은 양어깨 사이로 뒤지붕과 작은 현관이 이어지는 십자 윤곽", width: 9, height: 9,
      volumes: [{ x: 0, y: 1, w: 3, roof: 1, wall: 3, material: "log" },
        { x: 3, y: 0, w: 3, roof: 5, wall: 3, material: "log" },
        { x: 6, y: 1, w: 3, roof: 1, wall: 3, material: "log" }],
      doors: [{ x: 4, y: 8 }] },
    windows: [{ x: 1, y: 4 }, { x: 7, y: 4 }],
  },
  {
    number: 4, family: "중앙 뒤채 넓은 어깨",
    study: { id: "rear-shoulder", name: "뒷채 어깨집", note: "중앙 뒤채가 솟고 낮은 양어깨가 정면 하나로 모이는 석조집", width: 9, height: 8,
      volumes: [{ x: 2, y: 0, w: 5, roof: 2, wall: 3, material: "stone", color: "slate" },
        { x: 0, y: 2, w: 9, roof: 2, wall: 3, material: "stone", color: "slate" }],
      doors: [{ x: 4, y: 7 }] },
    windows: [{ x: 1, y: 6 }, { x: 7, y: 6 }],
  },
  {
    number: 5, family: "오른쪽 넓은 비대칭 날개",
    study: { id: "broad-right-wing", name: "넓은 오른날개집", note: "짧은 왼채에서 넓고 깊은 오른채로 한 번 꺾이는 지붕", width: 10, height: 8,
      volumes: [{ x: 0, y: 0, w: 5, roof: 2, wall: 3, material: "stone" },
        { x: 4, y: 1, w: 6, roof: 3, wall: 3, material: "stone" }],
      doors: [{ x: 7, y: 7 }] },
    windows: [{ x: 1, y: 4 }, { x: 5, y: 6 }],
  },
  {
    number: 6, family: "긴 농가와 두 깊이의 돌출부",
    study: { id: "farm-recess", name: "안쪽 현관 긴 농가", note: "길게 이어진 뒤지붕 아래 큰 왼앞채와 얕은 오른 돌출부가 현관을 감싼다", width: 13, height: 8,
      volumes: [{ x: 0, y: 0, w: 13, roof: 2, wall: 3, material: "log" },
        { x: 0, y: 1, w: 4, roof: 3, wall: 3, material: "log" },
        { x: 8, y: 1, w: 3, roof: 2, wall: 3, material: "log" }],
      doors: [{ x: 5, y: 5 }] },
    windows: [{ x: 1, y: 6 }, { x: 6, y: 4 }, { x: 9, y: 5 }],
  },
  {
    number: 7, family: "세 단 사선 진행",
    study: { id: "three-step-eaves", name: "세 굽이 처마집", note: "작은 앞채 셋이 오른쪽 아래로 어긋나되 지붕면은 끊기지 않는 단층집", width: 9, height: 10,
      volumes: [{ x: 0, y: 0, w: 4, roof: 2, wall: 3 },
        { x: 3, y: 1, w: 4, roof: 3, wall: 3 },
        { x: 6, y: 2, w: 3, roof: 4, wall: 3 }],
      doors: [{ x: 7, y: 9 }] },
    windows: [{ x: 1, y: 4 }, { x: 4, y: 6 }],
  },
  {
    number: 8, family: "깊이 다른 양날개 안마당",
    study: { id: "uneven-court", name: "작은 안마당집", note: "낮은 뒤채 현관 앞을 비우고 좌우 깊이가 다른 두 날개로 마당을 감싼다", width: 11, height: 10,
      volumes: [{ x: 0, y: 0, w: 11, roof: 2, wall: 3, material: "stone", color: "slate" },
        { x: 0, y: 1, w: 3, roof: 4, wall: 3, material: "stone", color: "slate" },
        { x: 7, y: 2, w: 4, roof: 4, wall: 3, material: "stone", color: "slate" }],
      doors: [{ x: 5, y: 5 }] },
    windows: [{ x: 1, y: 7 }, { x: 8, y: 8 }],
  },
  {
    number: 9, family: "뒤쪽 오른어깨와 낮은 앞왼채",
    study: { id: "opposite-end-bays", name: "대각선 두 끝집", note: "오른쪽 뒷지붕과 왼쪽 낮은 앞채가 서로 반대쪽으로 튀어나온 집", width: 10, height: 10,
      volumes: [{ x: 0, y: 2, w: 10, roof: 2, wall: 3 },
        { x: 6, y: 0, w: 4, roof: 4, wall: 3 },
        { x: 0, y: 4, w: 4, roof: 2, wall: 3 }],
      doors: [{ x: 2, y: 9 }] },
    windows: [{ x: 1, y: 8 }, { x: 5, y: 6 }, { x: 8, y: 6 }],
  },
  {
    number: 10, family: "엇갈린 양어깨와 좁은 현관 홈",
    study: { id: "offset-twin-shoulders", name: "엇갈린 양날개집", note: "중앙 뒤지붕 양쪽으로 높이와 폭이 다른 어깨를 내고 안쪽 현관을 남긴 집", width: 11, height: 8,
      volumes: [{ x: 2, y: 0, w: 7, roof: 2, wall: 3, material: "log", color: "slate" },
        { x: 0, y: 2, w: 5, roof: 2, wall: 3, material: "log", color: "slate" },
        { x: 7, y: 1, w: 4, roof: 2, wall: 3, material: "log", color: "slate" }],
      doors: [{ x: 5, y: 5 }] },
    windows: [{ x: 1, y: 6 }, { x: 3, y: 6 }, { x: 8, y: 5 }],
  },
];

export function buildHouse30BatchA(): House30Entry[] {
  return DESIGNS.map(({ number, family, study, windows }) => {
    const kit = bakeHouseStudy(study);
    kit.id = `house-30-${String(number).padStart(2, "0")}-${study.id}`;
    // Window placement is authored on the final visible facade, not inferred from
    // the rectangles that contributed to the connected roof.
    for (const row of kit.rows) row.upperTiles = row.upperTiles!.map(tile => tile === 85 || tile === 87 ? -1 : tile);
    for (const { x, y } of windows) {
      if (study.doors.some(door => door.x === x && y >= door.y - 1 && y <= door.y)) throw new Error(`${kit.id}: window overlaps door`);
      kit.rows[y]!.upperTiles![x] = study.volumes[0]!.color === "slate" ? 87 : 85;
    }
    kit.ai!.tags = ["집", "house", "단층", HOUSE30_TAG, family];
    kit.ai!.description = study.note;
    return { number, name: study.name, description: study.note, family, floors: 1, doors: structuredClone(study.doors), kit };
  });
}
