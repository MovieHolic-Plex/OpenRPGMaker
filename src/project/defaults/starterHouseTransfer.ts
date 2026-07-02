import type { GameMap, MapId } from "../types";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "./constants";

export const STARTER_HOUSE_INTERIOR_MAP_ID = "map_starter_house_interior";

const STARTER_HOUSE_DOOR_EVENT_ID = "event_starter_house_door";
const STARTER_HOUSE_EXIT_EVENT_ID = "event_starter_house_exit";
export const STARTER_HOUSE_DOOR_APPROACH = { x: 7, y: 10 } as const;
export const STARTER_HOUSE_INTERIOR_ENTRY = { x: 4, y: 6 } as const;
export const STARTER_HOUSE_INTERIOR_EXIT = { x: 4, y: 7 } as const;
const STARTER_HOUSE_INTERIOR_SIZE = { width: 20, height: 15 } as const;

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
        graphic: {},
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
  const lowerTiles = new Array<number>(width * height).fill(TILE.FLOOR);
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
    tilesetId: DEFAULT_TILESET_ID,
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
            graphic: {},
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
    ],
  };
}
