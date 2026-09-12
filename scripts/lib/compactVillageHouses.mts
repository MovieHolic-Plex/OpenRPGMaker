/** Compact village exteriors authored directly from wall/roof material volumes.
 * No house-30 recipe, saved object or scaled raster is used as an input.
 * Persistence belongs to the caller; this module only returns fresh section kits.
 */
import type { SectionStructureKitDef } from "../../src/project/types";
import { bakeHouseStudy, type HouseStudy } from "./houseStudyDesigns.mts";

export type CompactVillageHouse = {
  id: string;
  name: string;
  kind: "home" | "landmark";
  /** Coordinates of the bottom door tile (146); approach is y + 1. */
  doors: { x: number; y: number }[];
  kit: SectionStructureKitDef;
};

type Recipe = { kind: CompactVillageHouse["kind"]; study: HouseStudy; windows: { x: number; y: number }[] };

const RECIPES: Recipe[] = [
  { kind: "home", study: {
    id: "home-01-meadow", name: "들꽃 회벽집", note: "지붕 두 단과 가운데 문을 둔 다섯 칸 소형 주택", width: 5, height: 6,
    volumes: [{ x: 0, y: 0, w: 5, roof: 2, wall: 3 }], doors: [{ x: 2, y: 5 }],
  }, windows: [{ x: 1, y: 4 }, { x: 3, y: 4 }] },
  { kind: "home", study: {
    id: "home-02-shallow-bay", name: "낮은 문간 돌집", note: "왼쪽 문간만 한 칸 앞으로 나온 짧은 석조집", width: 7, height: 7,
    volumes: [{ x: 1, y: 0, w: 6, roof: 2, wall: 3, material: "stone" },
      { x: 0, y: 1, w: 3, roof: 2, wall: 3, material: "stone" }], doors: [{ x: 1, y: 6 }],
  }, windows: [{ x: 4, y: 4 }] },
  { kind: "home", study: {
    id: "home-03-front-room", name: "작은 앞현관집", note: "짧은 가로 본채에 세 칸 현관방을 내민 단층 회벽집", width: 7, height: 8,
    volumes: [{ x: 0, y: 0, w: 7, roof: 2, wall: 3 },
      { x: 2, y: 2, w: 3, roof: 2, wall: 3 }], doors: [{ x: 3, y: 7 }],
  }, windows: [{ x: 1, y: 4 }, { x: 5, y: 4 }] },
  { kind: "home", study: {
    id: "home-04-rounded-shoulders", name: "완만한 어깨 돌집", note: "두 번씩 낮아지는 좌우 어깨와 낮은 정면을 가진 석조집", width: 8, height: 7,
    volumes: [{ x: 0, y: 2, w: 8, roof: 1, wall: 3, material: "stone", color: "slate" },
      { x: 1, y: 1, w: 6, roof: 2, wall: 3, material: "stone", color: "slate" },
      { x: 2, y: 0, w: 4, roof: 3, wall: 3, material: "stone", color: "slate" }], doors: [{ x: 4, y: 6 }],
  }, windows: [{ x: 1, y: 5 }, { x: 6, y: 5 }] },
  { kind: "home", study: {
    id: "home-05-low-east-roof", name: "낮은 동쪽 지붕집", note: "동쪽으로 두 번 낮아지는 지붕 아래 정면은 한 줄로 이어지는 집", width: 7, height: 7,
    volumes: [{ x: 0, y: 0, w: 3, roof: 3, wall: 3 },
      { x: 3, y: 1, w: 2, roof: 2, wall: 3 }, { x: 5, y: 2, w: 2, roof: 1, wall: 3 }], doors: [{ x: 2, y: 6 }],
  }, windows: [{ x: 1, y: 5 }, { x: 5, y: 5 }] },
  { kind: "home", study: {
    id: "home-06-door-niche", name: "오목문간 회벽집", note: "짧은 양쪽 앞방 사이에 세 칸 폭의 열린 문간을 둔 집", width: 9, height: 8,
    volumes: [{ x: 1, y: 0, w: 7, roof: 2, wall: 3, color: "slate" },
      { x: 0, y: 1, w: 3, roof: 3, wall: 3, color: "slate" },
      { x: 6, y: 1, w: 3, roof: 3, wall: 3, color: "slate" }], doors: [{ x: 4, y: 5 }],
  }, windows: [{ x: 1, y: 6 }, { x: 7, y: 6 }] },
  { kind: "home", study: {
    id: "home-07-attic-room", name: "좁은 윗방 회벽집", note: "세 칸 윗방과 양옆 두 칸 지붕 경사를 갖춘 작은 이층집", width: 7, height: 9,
    volumes: [{ x: 0, y: 1, w: 7, roof: 4, wall: 3 }, { x: 2, y: 0, w: 3, roof: 5, wall: 3 }],
    upperStorey: { x: 2, y: 2, w: 3, h: 2 }, doors: [{ x: 3, y: 8 }],
  }, windows: [{ x: 3, y: 3 }, { x: 1, y: 7 }, { x: 5, y: 7 }] },
  { kind: "home", study: {
    id: "home-08-west-upstairs", name: "서쪽 윗방 돌집", note: "조금 왼쪽에 치우친 윗방과 한 줄 정면의 작은 이층 석조집", width: 9, height: 10,
    volumes: [{ x: 0, y: 2, w: 9, roof: 4, wall: 3, material: "stone", color: "slate" },
      { x: 2, y: 0, w: 4, roof: 6, wall: 3, material: "stone", color: "slate" }],
    upperStorey: { x: 2, y: 3, w: 4, h: 2 }, doors: [{ x: 6, y: 9 }],
  }, windows: [{ x: 3, y: 4 }, { x: 2, y: 8 }] },
  { kind: "home", study: {
    id: "home-09-east-upstairs", name: "오른윗방 돌집", note: "오른쪽 작은 윗방 아래 정면이 한 칸 내려가는 이층집", width: 9, height: 10,
    volumes: [{ x: 0, y: 2, w: 4, roof: 3, wall: 3, material: "stone" },
      { x: 4, y: 0, w: 3, roof: 6, wall: 3, material: "stone" },
      { x: 7, y: 2, w: 2, roof: 4, wall: 3, material: "stone" }],
    upperStorey: { x: 4, y: 3, w: 3, h: 2 }, doors: [{ x: 6, y: 9 }],
  }, windows: [{ x: 5, y: 4 }, { x: 1, y: 7 }, { x: 4, y: 8 }] },
  { kind: "home", study: {
    id: "home-10-short-porch", name: "낮은 현관 이층집", note: "중앙 윗방 아래 현관을 한 칸만 내민 여덟 칸 이층집", width: 8, height: 10,
    volumes: [{ x: 0, y: 1, w: 8, roof: 4, wall: 3 },
      { x: 2, y: 0, w: 4, roof: 5, wall: 3 }, { x: 3, y: 3, w: 3, roof: 3, wall: 3 }],
    upperStorey: { x: 2, y: 2, w: 4, h: 2 }, doors: [{ x: 4, y: 9 }],
  }, windows: [{ x: 3, y: 3 }, { x: 1, y: 7 }, { x: 6, y: 7 }] },
  { kind: "landmark", study: {
    id: "landmark-01-civic-house", name: "작은 마을회관", note: "두 단계 어깨 지붕과 짧은 앞현관을 갖춘 열두 칸 회관", width: 12, height: 12,
    volumes: [{ x: 0, y: 3, w: 12, roof: 3, wall: 3, material: "stone" },
      { x: 1, y: 1, w: 10, roof: 5, wall: 3, material: "stone" },
      { x: 3, y: 0, w: 6, roof: 6, wall: 3, material: "stone" },
      { x: 4, y: 6, w: 4, roof: 2, wall: 3, material: "stone" }],
    upperStorey: { x: 3, y: 3, w: 6, h: 2 }, doors: [{ x: 5, y: 11 }],
  }, windows: [{ x: 4, y: 4 }, { x: 7, y: 4 }, { x: 1, y: 8 }, { x: 10, y: 8 }] },
  { kind: "landmark", study: {
    id: "landmark-02-court-inn", name: "한쪽 뜰 여관", note: "서쪽 윗방과 깊이가 다른 짧은 두 날개 사이로 문간을 연 여관", width: 14, height: 13,
    volumes: [{ x: 0, y: 2, w: 14, roof: 5, wall: 3, material: "stone", color: "slate" },
      { x: 2, y: 0, w: 6, roof: 7, wall: 3, material: "stone", color: "slate" },
      { x: 0, y: 5, w: 4, roof: 4, wall: 3, material: "stone", color: "slate" },
      { x: 10, y: 4, w: 4, roof: 4, wall: 3, material: "stone", color: "slate" }],
    upperStorey: { x: 2, y: 3, w: 6, h: 2 }, doors: [{ x: 8, y: 10 }],
  }, windows: [{ x: 3, y: 4 }, { x: 6, y: 4 }, { x: 1, y: 11 }, { x: 5, y: 9 }, { x: 11, y: 10 }] },
];

export function buildCompactVillageHouses(): CompactVillageHouse[] {
  return RECIPES.map(({ kind, study, windows }) => {
    const kit = bakeHouseStudy(study), id = `compact-village-${study.id}`;
    const slate = study.volumes[0]!.color === "slate";
    kit.id = id;
    // Narrow upper facades need explicitly placed windows: the general baker's
    // default two-window rule lands on the outer columns of a three-cell room.
    for (const row of kit.rows) row.upperTiles = row.upperTiles!.map(tile => tile === 85 || tile === 87 ? -1 : tile);
    if (study.upperStorey) {
      const { x, y, w } = study.upperStorey;
      // Keep both ends of this upper eave. The shared baker deliberately leaves
      // its facade band square; these compact roofs expose the two corner trims.
      kit.rows[y - 1]!.upperTiles![x] = slate ? 386 : 384;
      kit.rows[y - 1]!.upperTiles![x + w - 1] = slate ? 387 : 385;
    }
    for (const window of windows) kit.rows[window.y]!.upperTiles![window.x] = slate ? 87 : 85;
    for (const row of kit.rows) for (let x = 0; x < kit.width; x++) {
      // Ridge caps have transparent outside pixels; preserve their cutout.
      if ([354, 355, 356, 357].includes(row.upperTiles![x]!)) row.tiles[x] = -1;
      if ([102, 103, 104, 132, 133, 134, 162, 163, 164, 196, 197, 226, 227, 256, 257].some(tile => row.tiles[x] === tile || row.upperTiles![x] === tile)) {
        throw new Error(`${id}: prohibited log wall or excluded material at column ${x}`);
      }
    }
    kit.ai = { ...kit.ai, description: study.note,
      tags: ["집", "compact-village-house", kind, study.upperStorey ? "2층 외형" : "1층 외형", "회벽·석벽"],
      placementRules: "일반 주택은 폭 5~9칸, 높이 6~10칸. 랜드마크는 마을에 1~2채만 배치한다. 문 아래 접근로를 비운다.",
      role: "structure", repeatability: "fixed", layerHome: "perCell" };
    return { id, name: study.name, kind, doors: study.doors.map(door => ({ ...door })), kit };
  });
}
