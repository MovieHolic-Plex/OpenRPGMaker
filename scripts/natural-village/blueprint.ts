import type { FootprintWing, HouseKitId } from "../../src/editor/houseKit";

export const REFERENCE_PROJECT_ID = "rpg-zzu-natural-village-reference";
export const MAP_WIDTH = 64;
export const MAP_HEIGHT = 56;

export const STAGE_MAP_IDS = [
  "map_natural_village_01_terrain",
  "map_natural_village_02_houses",
  "map_natural_village_03_roads",
  "map_natural_village_04_lived_in",
  "map_natural_village_05_final",
] as const;

export const FINAL_MAP_ID = "map_natural_village_05_final";

export type Point = { readonly x: number; readonly y: number };

export type FacadeBeam = {
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
};

export type HouseBlueprint = {
  readonly id: string;
  readonly label: string;
  readonly kitId: HouseKitId;
  readonly shape: string;
  readonly stories: 1 | 2 | 3;
  readonly yardTheme: string;
  readonly wings: readonly FootprintWing[];
  readonly door: Point;
  readonly windows: readonly Point[];
  readonly facadeBeams: readonly FacadeBeam[];
  readonly hasFence: boolean;
};

export const HOUSES = [
  {
    id: "house_northwest_blue",
    label: "북서쪽 파란 지붕 농가",
    kitId: "blue-stone",
    shape: "rect-wide",
    stories: 1,
    yardTheme: "herb-garden",
    wings: [{ x: 11, y: 5, w: 8, h: 7 }],
    door: { x: 14, y: 11 },
    windows: [{ x: 12, y: 10 }, { x: 17, y: 10 }],
    facadeBeams: [],
    hasFence: true,
  },
  {
    id: "house_north_ell",
    label: "북쪽 ㄱ자 도예가 집",
    kitId: "amber-wood",
    shape: "ell-cottage",
    stories: 1,
    yardTheme: "pottery",
    wings: [{ x: 23, y: 4, w: 8, h: 5 }, { x: 23, y: 7, w: 5, h: 4 }],
    door: { x: 25, y: 10 },
    windows: [{ x: 24, y: 9 }, { x: 27, y: 9 }, { x: 29, y: 7 }],
    facadeBeams: [],
    hasFence: false,
  },
  {
    id: "house_northeast_inn",
    label: "북동쪽 2층 여관",
    kitId: "bright-plaster",
    shape: "two-storey-inn",
    stories: 2,
    yardTheme: "guest-porch",
    wings: [{ x: 39, y: 4, w: 7, h: 9 }],
    door: { x: 42, y: 12 },
    windows: [{ x: 40, y: 9 }, { x: 44, y: 9 }, { x: 40, y: 11 }, { x: 44, y: 11 }],
    facadeBeams: [{ x0: 40, x1: 44, y: 10 }],
    hasFence: false,
  },
  {
    id: "house_far_northeast_jay",
    label: "북동 외곽 J자 목공소",
    kitId: "slate-wood",
    shape: "jay-workshop",
    stories: 1,
    yardTheme: "woodshop",
    wings: [{ x: 51, y: 7, w: 8, h: 5 }, { x: 54, y: 10, w: 5, h: 3 }],
    door: { x: 56, y: 12 },
    windows: [{ x: 52, y: 10 }, { x: 55, y: 11 }, { x: 58, y: 11 }],
    facadeBeams: [],
    hasFence: false,
  },
  {
    id: "house_west_compact",
    label: "서쪽 작은 정원집",
    kitId: "bright-plaster",
    shape: "compact-cottage",
    stories: 1,
    yardTheme: "flower-garden",
    wings: [{ x: 12, y: 20, w: 6, h: 6 }],
    door: { x: 14, y: 25 },
    windows: [{ x: 12, y: 24 }, { x: 17, y: 24 }],
    facadeBeams: [],
    hasFence: true,
  },
  {
    id: "house_southwest_u",
    label: "남서쪽 안마당 농가",
    kitId: "amber-wood",
    shape: "courtyard-u",
    stories: 1,
    yardTheme: "orchard",
    wings: [{ x: 11, y: 34, w: 3, h: 7 }, { x: 17, y: 34, w: 3, h: 7 }, { x: 11, y: 34, w: 9, h: 5 }],
    door: { x: 12, y: 40 },
    windows: [{ x: 18, y: 39 }, { x: 14, y: 37 }, { x: 16, y: 37 }],
    facadeBeams: [],
    hasFence: true,
  },
  {
    id: "house_south_long",
    label: "남쪽 긴 공동주택",
    kitId: "blue-stone",
    shape: "longhouse",
    stories: 1,
    yardTheme: "laundry",
    wings: [{ x: 25, y: 40, w: 10, h: 7 }],
    door: { x: 29, y: 46 },
    windows: [{ x: 26, y: 45 }, { x: 32, y: 45 }],
    facadeBeams: [],
    hasFence: false,
  },
  {
    id: "house_southeast_reverse_ell",
    label: "남동쪽 역ㄱ자 대장간",
    kitId: "slate-wood",
    shape: "reverse-ell",
    stories: 1,
    yardTheme: "forge",
    wings: [{ x: 40, y: 36, w: 8, h: 5 }, { x: 43, y: 40, w: 5, h: 3 }],
    door: { x: 45, y: 42 },
    windows: [{ x: 41, y: 39 }, { x: 44, y: 41 }, { x: 47, y: 41 }],
    facadeBeams: [],
    hasFence: false,
  },
  {
    id: "house_east_tower",
    label: "동쪽 3층 시계집",
    kitId: "bright-plaster",
    shape: "three-storey-tower",
    stories: 3,
    yardTheme: "clockmaker",
    wings: [{ x: 52, y: 20, w: 8, h: 11 }],
    door: { x: 55, y: 30 },
    windows: [{ x: 53, y: 25 }, { x: 57, y: 25 }, { x: 53, y: 27 }, { x: 57, y: 27 }, { x: 53, y: 29 }, { x: 57, y: 29 }],
    facadeBeams: [{ x0: 53, x1: 58, y: 26 }, { x0: 53, x1: 58, y: 28 }],
    hasFence: false,
  },
  {
    id: "house_far_southeast_tall",
    label: "남동 외곽 높은 목조집",
    kitId: "amber-wood",
    shape: "tall-cottage",
    stories: 1,
    yardTheme: "beekeeping",
    wings: [{ x: 52, y: 41, w: 7, h: 7 }],
    door: { x: 55, y: 47 },
    windows: [{ x: 53, y: 46 }, { x: 57, y: 46 }],
    facadeBeams: [],
    hasFence: true,
  },
] as const satisfies readonly HouseBlueprint[];

export function houseBounds(house: HouseBlueprint): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  const left = Math.min(...house.wings.map((wing) => wing.x));
  const top = Math.min(...house.wings.map((wing) => wing.y));
  const right = Math.max(...house.wings.map((wing) => wing.x + wing.w));
  const bottom = Math.max(...house.wings.map((wing) => wing.y + wing.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}
