import { bakeHouseStudy, type HouseStudy } from "./houseStudyDesigns.mts";
import { HOUSE30_TAG, type House30Entry } from "./house30Contract.mts";

/** New material recipes. The volumes describe one contour before any tile is drawn;
 * upper facades then occlude that plane while retaining a roof slope on both sides.
 * None of these entries loads or copies a saved house section.
 */
const DESIGNS: { number: number; family: string; study: HouseStudy }[] = [
  {
    number: 11,
    family: "central-core",
    study: {
      id: "central-ridge",
      name: "중앙 마루 이층집",
      note: "중앙 마루 이층집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 9,
      height: 10,
      volumes: [
        {x: 2, y: 0, w: 5, roof: 6, wall: 3, material: "plaster", color: "clay"},
        {x: 0, y: 1, w: 9, roof: 5, wall: 3, material: "plaster", color: "clay"},
      ],
      doors: [
        {x: 4, y: 9},
      ],
      upperStorey: {
        x: 2,
        y: 3,
        w: 5,
        h: 2,
      },
    },
  },
  {
    number: 12,
    family: "staggered-upper",
    study: {
      id: "staggered-upper",
      name: "엇갈린 윗채 이층집",
      note: "엇갈린 윗채 이층집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 12,
      height: 11,
      volumes: [
        {x: 1, y: 0, w: 4, roof: 7, wall: 3, material: "plaster", color: "slate"},
        {x: 7, y: 1, w: 4, roof: 6, wall: 3, material: "plaster", color: "slate"},
        {x: 0, y: 1, w: 12, roof: 6, wall: 3, material: "plaster", color: "slate"},
      ],
      doors: [
        {x: 6, y: 10},
      ],
      upperStoreys: [
        {x: 1, y: 3, w: 4, h: 2},
        {x: 7, y: 4, w: 4, h: 2, roofStart: 1},
      ],
    },
  },
  {
    number: 13,
    family: "short-upper-long-wing",
    study: {
      id: "long-kitchen",
      name: "긴 부엌채 이층집",
      note: "긴 부엌채 이층집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 10,
      height: 9,
      volumes: [
        {x: 1, y: 0, w: 4, roof: 5, wall: 3, material: "plaster", color: "clay"},
        {x: 0, y: 1, w: 10, roof: 4, wall: 3, material: "plaster", color: "clay"},
      ],
      doors: [
        {x: 6, y: 8},
      ],
      upperStorey: {
        x: 1,
        y: 2,
        w: 4,
        h: 2,
      },
    },
  },
  {
    number: 14,
    family: "shop-and-home",
    study: {
      id: "shop-home",
      name: "앞가게 윗살림집",
      note: "앞가게 윗살림집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 10,
      height: 11,
      volumes: [
        {x: 2, y: 0, w: 6, roof: 5, wall: 3, material: "stone", color: "slate"},
        {x: 0, y: 1, w: 10, roof: 4, wall: 3, material: "stone", color: "slate"},
        {x: 3, y: 5, w: 4, roof: 2, wall: 3, material: "stone", color: "slate"},
      ],
      doors: [
        {x: 1, y: 8},
        {x: 5, y: 10},
      ],
      upperStorey: {
        x: 2,
        y: 2,
        w: 6,
        h: 2,
      },
    },
  },
  {
    number: 15,
    family: "stepped-lower-wings",
    study: {
      id: "stepped-wings",
      name: "세 폭 계단처마집",
      note: "세 폭 계단처마집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 10,
      height: 11,
      volumes: [
        {x: 3, y: 0, w: 4, roof: 6, wall: 3, material: "plaster", color: "clay"},
        {x: 0, y: 1, w: 3, roof: 4, wall: 3, material: "plaster", color: "clay"},
        {x: 3, y: 2, w: 4, roof: 4, wall: 3, material: "plaster", color: "clay"},
        {x: 7, y: 3, w: 3, roof: 4, wall: 3, material: "plaster", color: "clay"},
      ],
      doors: [
        {x: 5, y: 9},
      ],
      upperStorey: {
        x: 3,
        y: 3,
        w: 4,
        h: 2,
      },
    },
  },
  {
    number: 16,
    family: "forward-central-hall",
    study: {
      id: "forward-hall",
      name: "두 단 앞채 이층집",
      note: "두 단 앞채 이층집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 10,
      height: 12,
      volumes: [
        {x: 3, y: 0, w: 4, roof: 5, wall: 3, material: "plaster", color: "clay"},
        {x: 0, y: 1, w: 10, roof: 4, wall: 3, material: "plaster", color: "clay"},
        {x: 2, y: 4, w: 6, roof: 3, wall: 3, material: "plaster", color: "clay"},
        {x: 4, y: 6, w: 3, roof: 2, wall: 3, material: "plaster", color: "clay"},
      ],
      doors: [
        {x: 5, y: 11},
      ],
      upperStorey: {
        x: 3,
        y: 2,
        w: 4,
        h: 2,
      },
    },
  },
  {
    number: 17,
    family: "deep-l-wing",
    study: {
      id: "deep-side-wing",
      name: "깊은 옆채 이층집",
      note: "깊은 옆채 이층집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 10,
      height: 12,
      volumes: [
        {x: 2, y: 0, w: 4, roof: 5, wall: 3, material: "stone", color: "clay"},
        {x: 0, y: 1, w: 10, roof: 4, wall: 3, material: "stone", color: "clay"},
        {x: 7, y: 4, w: 3, roof: 4, wall: 3, material: "stone", color: "clay"},
      ],
      doors: [
        {x: 4, y: 8},
      ],
      upperStorey: {
        x: 2,
        y: 2,
        w: 4,
        h: 2,
      },
    },
  },
  {
    number: 18,
    family: "recessed-front",
    study: {
      id: "recessed-entry",
      name: "오목현관 이층집",
      note: "오목현관 이층집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 10,
      height: 11,
      volumes: [
        {x: 3, y: 0, w: 4, roof: 5, wall: 3, material: "plaster", color: "slate"},
        {x: 0, y: 1, w: 10, roof: 4, wall: 3, material: "plaster", color: "slate"},
        {x: 0, y: 5, w: 3, roof: 2, wall: 3, material: "plaster", color: "slate"},
        {x: 7, y: 5, w: 3, roof: 2, wall: 3, material: "plaster", color: "slate"},
      ],
      doors: [
        {x: 5, y: 8},
      ],
      upperStorey: {
        x: 3,
        y: 2,
        w: 4,
        h: 2,
      },
    },
  },
  {
    number: 19,
    family: "shifted-broad-front",
    study: {
      id: "offset-front",
      name: "비껴난 넓은 앞채집",
      note: "비껴난 넓은 앞채집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 11,
      height: 11,
      volumes: [
        {x: 2, y: 0, w: 4, roof: 5, wall: 3, material: "plaster", color: "clay"},
        {x: 0, y: 1, w: 9, roof: 4, wall: 3, material: "plaster", color: "clay"},
        {x: 3, y: 4, w: 8, roof: 3, wall: 3, material: "plaster", color: "clay"},
      ],
      doors: [
        {x: 7, y: 10},
      ],
      upperStorey: {
        x: 2,
        y: 2,
        w: 4,
        h: 2,
      },
    },
  },
  {
    number: 20,
    family: "double-shoulder-ridge",
    study: {
      id: "double-shoulder-ridge",
      name: "겹어깨 마루 이층집",
      note: "겹어깨 마루 이층집의 기존 윤곽을 작은 타일 부지에 다시 조립. 양옆 지붕과 현관 접근로를 유지한다.",
      width: 10,
      height: 10,
      volumes: [
        {x: 3, y: 0, w: 4, roof: 6, wall: 3, material: "stone", color: "slate"},
        {x: 1, y: 1, w: 8, roof: 5, wall: 3, material: "stone", color: "slate"},
        {x: 0, y: 3, w: 10, roof: 3, wall: 3, material: "stone", color: "slate"},
      ],
      doors: [
        {x: 5, y: 9},
      ],
      upperStorey: {
        x: 3,
        y: 3,
        w: 4,
        h: 2,
      },
    },
  },
];

export function buildHouse30BatchB(): House30Entry[] {
  return DESIGNS.map(({ number, family, study }) => {
    const kit = bakeHouseStudy(study);
    kit.id = `house-30-${number}-${study.id}`;
    kit.ai = { ...kit.ai, tags: ["집", "house", HOUSE30_TAG, "2층", family],
      description: study.note,
      placementRules: "한 채의 연결된 지붕. 층수는 외관 기준이며 실내는 별도 설계한다. 문 아래 접근로를 비운다." };
    // Narrow upper facades get a centered window, never a window on a corner.
    for (const upper of study.upperStoreys ?? [study.upperStorey!]) {
      for (let x = upper.x; x < upper.x + upper.w; x++) kit.rows[upper.y + 1]!.upperTiles![x] = -1;
      kit.rows[upper.y + 1]!.upperTiles![upper.x + Math.floor(upper.w / 2)] = study.volumes[0]!.color === "slate" ? 87 : 85;
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
