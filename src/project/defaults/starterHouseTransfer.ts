import type { EventPageGraphic, GameMap, MapId } from "../types";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { WOOD_FLOOR_PASSABILITY } from "./chipsetMapping";
import { DEFAULT_TILE_SIZE, COMBINED_TOWN_TILESET_ID, DEFAULT_TROOP_ID, TILE } from "./constants";

export const STARTER_HOUSE_INTERIOR_MAP_ID = "map_starter_house_interior";

const STARTER_HOUSE_DOOR_EVENT_ID = "event_starter_house_door";
const STARTER_HOUSE_EXIT_EVENT_ID = "event_starter_house_exit";
/** 실내 공터 테스트용 슬라임. 접촉 시 troop_slime 전투. */
export const STARTER_HOUSE_SLIME_EVENT_ID = "event_starter_house_slime";
export const STARTER_HOUSE_DOOR_APPROACH = { x: 7, y: 10 } as const;
export const STARTER_HOUSE_INTERIOR_ENTRY = { x: 4, y: 6 } as const;
export const STARTER_HOUSE_INTERIOR_EXIT = { x: 4, y: 7 } as const;
/** 문 옆 공터 중앙 — 입구 (4,6)/(4,7) 와 겹치지 않음. */
export const STARTER_HOUSE_SLIME_POS = { x: 10, y: 5 } as const;
const STARTER_HOUSE_INTERIOR_SIZE = { width: 20, height: 15 } as const;
const SLIME_CHARSET_ID = "tex_easyrpg_charset_monster1";

export function addStarterHouseDoor(map: GameMap): void {
  map.events.push({
    id: STARTER_HOUSE_DOOR_EVENT_ID,
    x: STARTER_HOUSE_DOOR_APPROACH.x,
    y: STARTER_HOUSE_DOOR_APPROACH.y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${STARTER_HOUSE_DOOR_EVENT_ID}_page`,
        name: "시작 집 문",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          {
            kind: "transfer",
            mapId: STARTER_HOUSE_INTERIOR_MAP_ID,
            x: STARTER_HOUSE_INTERIOR_ENTRY.x,
            y: STARTER_HOUSE_INTERIOR_ENTRY.y,
            fade: "black",
          },
        ],
      },
    ],
  });
}

export function createStarterHouseInteriorMap(returnMapId: MapId): GameMap {
  const width = STARTER_HOUSE_INTERIOR_SIZE.width;
  const height = STARTER_HOUSE_INTERIOR_SIZE.height;
  // 바닥은 **통행 가능한** 나무 마루(222 = WOOD_FLOOR_PASSABILITY.body)다.
  // 원래 TILE.FLOOR(342)로 채워져 있었는데, 342 는 combined_town 에서 전방향 통행 불가라
  // 실내 300칸 중 밟을 수 있는 칸이 입구/출구 2칸뿐이었다(2026-07-27 도달성 실측).
  // (10,5)에 놓인 슬라임은 영원히 만날 수 없는 죽은 콘텐츠였다.
  // 이 저장소는 342 가 함정인 걸 이미 알고 있었다 — combinedTownGroups 의 그룹 이름이
  // 그대로 "stone-floor-trap"("통행 가능해 보이지만 막히는 돌바닥")이다.
  const lowerTiles = new Array<number>(width * height).fill(WOOD_FLOOR_PASSABILITY.body);
  const upperTiles = new Array<number>(width * height).fill(TILE.EMPTY);
  for (let x = 0; x < width; x += 1) {
    lowerTiles[x] = TILE.WALL;
    lowerTiles[(height - 1) * width + x] = TILE.WALL;
  }
  for (let y = 0; y < height; y += 1) {
    lowerTiles[y * width] = TILE.WALL;
    lowerTiles[y * width + width - 1] = TILE.WALL;
  }
  lowerTiles[STARTER_HOUSE_INTERIOR_ENTRY.y * width + STARTER_HOUSE_INTERIOR_ENTRY.x] = TILE.PATH;
  lowerTiles[STARTER_HOUSE_INTERIOR_EXIT.y * width + STARTER_HOUSE_INTERIOR_EXIT.x] = TILE.PATH;
  return {
    id: STARTER_HOUSE_INTERIOR_MAP_ID,
    name: "시작 집 내부",
    width,
    height,
    tilesetId: COMBINED_TOWN_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles,
    upperTiles,
    events: [
      {
        id: STARTER_HOUSE_EXIT_EVENT_ID,
        x: STARTER_HOUSE_INTERIOR_EXIT.x,
        y: STARTER_HOUSE_INTERIOR_EXIT.y,
        trigger: { kind: "playerTouch" },
        commands: [],
        pages: [
          {
            id: `${STARTER_HOUSE_EXIT_EVENT_ID}_page`,
            name: "시작 집 출구",
            conditions: [],
            graphic: { transparent: true },
            trigger: { kind: "playerTouch" },
            priority: "below",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [
              {
                kind: "transfer",
                mapId: returnMapId,
                x: STARTER_HOUSE_DOOR_APPROACH.x,
                y: STARTER_HOUSE_DOOR_APPROACH.y + 1,
                fade: "black",
              },
            ],
          },
        ],
      },
      starterHouseSlimeEvent(),
    ],
  };
}

function starterHouseSlimeEvent(): GameMap["events"][number] {
  const graphic = slimeCharsetGraphic();
  return {
    id: STARTER_HOUSE_SLIME_EVENT_ID,
    x: STARTER_HOUSE_SLIME_POS.x,
    y: STARTER_HOUSE_SLIME_POS.y,
    trigger: { kind: "eventTouch" },
    commands: [],
    pages: [
      {
        id: `${STARTER_HOUSE_SLIME_EVENT_ID}_page`,
        name: "공터 슬라임",
        conditions: [],
        graphic,
        trigger: { kind: "eventTouch" },
        priority: "same",
        overlapForbidden: true,
        animationType: "normal",
        // 공터에서 천천히 돌아다니며 접촉 시 전투 — 전투 테스트용.
        movement: { type: "random", speed: 2, frequency: 3 },
        commands: [
          { kind: "text", speaker: "슬라임", body: "푸르르… (실내 공터 테스트 몬스터)" },
          { kind: "battleProcessing", troopId: DEFAULT_TROOP_ID, canEscape: true, canLose: true },
        ],
      },
    ],
  };
}

function slimeCharsetGraphic(): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: SLIME_CHARSET_ID },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }),
  };
}
