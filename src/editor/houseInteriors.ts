import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { INTERIOR_HOUSE_TILE, INTERIOR_HOUSE_TILESET_ID } from "@/editor/interiorStructureStamp";
import { DEFAULT_TILE_SIZE, TILE } from "@/project/defaults/constants";
import type { Command, EventPageGraphic, GameEvent, GameMap, MapId } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import type { HouseKitId } from "./houseKit";

export const HOUSE_INTERIOR_SIZE = { width: 13, height: 10 } as const;
export const HOUSE_INTERIOR_ENTRY = { x: 6, y: 6 } as const;
export const HOUSE_INTERIOR_EXIT = { x: 6, y: 7 } as const;
export const HOUSE_DOOR_CHARSET_TEXTURE = "tex_easyrpg_charset_object1";
export const HOUSE_DOOR_FRAME_WAIT_MS = 100;
export const HOUSE_DOOR_OPEN_HOLD_MS = 180;

export type HouseDoorVariant = {
  readonly textureKey: typeof HOUSE_DOOR_CHARSET_TEXTURE;
  readonly characterIndex: number;
};

type TilePlacement = {
  readonly x: number;
  readonly y: number;
  readonly layer: "lower" | "upper";
  readonly tile: number;
};

export type InteriorMapResult = {
  readonly map: GameMap;
  readonly entry: typeof HOUSE_INTERIOR_ENTRY;
  readonly exit: typeof HOUSE_INTERIOR_EXIT;
};

export function houseDoorVariantForKit(kitId: HouseKitId): HouseDoorVariant {
  return {
    textureKey: HOUSE_DOOR_CHARSET_TEXTURE,
    // 파랑 석벽은 Object1 금속문 중 단일 철문을, 밝은 회벽은 갈색 패널 목문을 쓴다.
    characterIndex: kitId === "blue-stone" ? 4 : 0,
  };
}

export function houseDoorFrameIndex(kitId: HouseKitId, pattern: 0 | 1 | 2): number {
  return charsetFrameIndex({
    characterIndex: houseDoorVariantForKit(kitId).characterIndex,
    direction: "down",
    pattern,
  });
}

export function houseDoorGraphic(kitId: HouseKitId, pattern: 0 | 1 | 2 = 0): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: HOUSE_DOOR_CHARSET_TEXTURE },
    pattern: houseDoorFrameIndex(kitId, pattern),
  };
}

export function houseDoorOpenCommands(options: {
  readonly eventId: string;
  readonly interiorMapId: MapId;
  readonly kitId: HouseKitId;
}): Command[] {
  const commands: Command[] = [];
  for (const pattern of [0, 1, 2] as const) {
    commands.push({ kind: "setEventGraphicPattern", eventId: options.eventId, pattern: houseDoorFrameIndex(options.kitId, pattern) });
    // 완전 열림 프레임은 전환 페이드에 묻히지 않게 조금 더 길게 보여준다.
    commands.push({ kind: "wait", ms: pattern === 2 ? HOUSE_DOOR_OPEN_HOLD_MS : HOUSE_DOOR_FRAME_WAIT_MS });
  }
  commands.push({
    kind: "transfer",
    mapId: options.interiorMapId,
    x: HOUSE_INTERIOR_ENTRY.x,
    y: HOUSE_INTERIOR_ENTRY.y,
    fade: "black",
  });
  return commands;
}

export function createHouseDoorEvent(options: {
  readonly eventId: string;
  readonly x: number;
  readonly y: number;
  readonly interiorMapId: MapId;
  readonly kitId: HouseKitId;
  readonly name?: string;
}): GameEvent {
  return {
    id: options.eventId,
    x: options.x,
    y: options.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${options.eventId}_page`,
        name: options.name ?? "집 문",
        conditions: [],
        graphic: houseDoorGraphic(options.kitId),
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: houseDoorOpenCommands({
          eventId: options.eventId,
          interiorMapId: options.interiorMapId,
          kitId: options.kitId,
        }),
      },
    ],
  };
}

export function createHouseInteriorMap(options: {
  readonly id: MapId;
  readonly name: string;
  readonly returnMapId: MapId;
  readonly returnX: number;
  readonly returnY: number;
  readonly exitEventId: string;
  readonly seed: number;
}): InteriorMapResult {
  const width = HOUSE_INTERIOR_SIZE.width;
  const height = HOUSE_INTERIOR_SIZE.height;
  const lowerTiles = new Array<number>(width * height).fill(INTERIOR_HOUSE_TILE.FLOOR);
  const upperTiles = new Array<number>(width * height).fill(TILE.EMPTY);
  const map: GameMap = {
    id: options.id,
    name: options.name,
    width,
    height,
    tilesetId: INTERIOR_HOUSE_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles,
    upperTiles,
    events: [createHouseInteriorExitEvent({
      eventId: options.exitEventId,
      returnMapId: options.returnMapId,
      returnX: options.returnX,
      returnY: options.returnY,
    })],
  };
  frameInterior(map);
  placeSeededFurniture(map, options.seed);
  return { map, entry: HOUSE_INTERIOR_ENTRY, exit: HOUSE_INTERIOR_EXIT };
}

function createHouseInteriorExitEvent(options: {
  readonly eventId: string;
  readonly returnMapId: MapId;
  readonly returnX: number;
  readonly returnY: number;
}): GameEvent {
  return {
    id: options.eventId,
    x: HOUSE_INTERIOR_EXIT.x,
    y: HOUSE_INTERIOR_EXIT.y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${options.eventId}_page`,
        name: "집 출구",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{
          kind: "transfer",
          mapId: options.returnMapId,
          x: options.returnX,
          y: options.returnY,
          fade: "black",
        }],
      },
    ],
  };
}

function frameInterior(map: GameMap): void {
  const right = map.width - 1;
  const bottom = map.height - 1;
  for (let x = 0; x < map.width; x += 1) {
    setTile(map, { layer: "lower", x, y: 0, tile: x === 0 ? INTERIOR_HOUSE_TILE.WALL_TOP_LEFT : x === right ? INTERIOR_HOUSE_TILE.WALL_TOP_RIGHT : INTERIOR_HOUSE_TILE.WALL_TOP_MID });
    setTile(map, { layer: "lower", x, y: 1, tile: x === 0 ? INTERIOR_HOUSE_TILE.WALL_BODY_LEFT : x === right ? INTERIOR_HOUSE_TILE.WALL_BODY_RIGHT : INTERIOR_HOUSE_TILE.WALL_BODY_MID });
    setTile(map, { layer: "lower", x, y: bottom, tile: x === 0 ? INTERIOR_HOUSE_TILE.WALL_BODY_LEFT : x === right ? INTERIOR_HOUSE_TILE.WALL_BODY_RIGHT : INTERIOR_HOUSE_TILE.WALL_BODY_MID });
  }
  for (let y = 2; y < bottom; y += 1) {
    setTile(map, { layer: "lower", x: 0, y, tile: INTERIOR_HOUSE_TILE.WALL_BODY_LEFT });
    setTile(map, { layer: "lower", x: right, y, tile: INTERIOR_HOUSE_TILE.WALL_BODY_RIGHT });
  }
  // 남벽 문 — interiorRoomPipeline 하우스 셸 문법: 서 플랭크 398 | 개구부 바닥 72 | 동 플랭크 396.
  setTile(map, { layer: "lower", x: HOUSE_INTERIOR_ENTRY.x - 1, y: bottom, tile: INTERIOR_HOUSE_TILE.DOOR_WEST });
  setTile(map, { layer: "lower", x: HOUSE_INTERIOR_ENTRY.x, y: bottom, tile: INTERIOR_HOUSE_TILE.FLOOR });
  setTile(map, { layer: "lower", x: HOUSE_INTERIOR_ENTRY.x + 1, y: bottom, tile: INTERIOR_HOUSE_TILE.DOOR_EAST });
}

function placeSeededFurniture(map: GameMap, seed: number): void {
  const rng = mulberry32(seed >>> 0);
  const props = shuffled([
    bookshelf,
    bed,
    table,
  ], rng);
  const count = 2 + Math.floor(rng() * 2);
  for (const place of props.slice(0, count)) place(map);
}

function bookshelf(map: GameMap): void {
  placePattern(map, "upper", { x: 1, y: 2 }, [[
    INTERIOR_HOUSE_TILE.BOOKSHELF_LEFT,
    INTERIOR_HOUSE_TILE.BOOKSHELF_MID,
    INTERIOR_HOUSE_TILE.BOOKSHELF_RIGHT,
  ]]);
}

function bed(map: GameMap): void {
  // 가로 침대는 355|356 hard 좌우쌍(1×2) — 북벽에 붙여 배치.
  placePattern(map, "upper", { x: 9, y: 2 }, [
    [INTERIOR_HOUSE_TILE.BED_LEFT, INTERIOR_HOUSE_TILE.BED_RIGHT],
  ]);
}

function table(map: GameMap): void {
  // 긴 탁자는 좌 325 · 몸통 326(가로 반복) · 우 327의 1×3 세트.
  placePattern(map, "upper", { x: 4, y: 4 }, [
    [INTERIOR_HOUSE_TILE.TABLE_LEFT, INTERIOR_HOUSE_TILE.TABLE_MID, INTERIOR_HOUSE_TILE.TABLE_RIGHT],
  ]);
}

function placePattern(
  map: GameMap,
  layer: "lower" | "upper",
  origin: { readonly x: number; readonly y: number },
  rows: readonly (readonly number[])[]
): void {
  rows.forEach((row, dy) => {
    row.forEach((tile, dx) => setTile(map, { layer, x: origin.x + dx, y: origin.y + dy, tile }));
  });
}

function setTile(map: GameMap, placement: TilePlacement): void {
  if (placement.x < 0 || placement.y < 0 || placement.x >= map.width || placement.y >= map.height) return;
  const index = placement.y * map.width + placement.x;
  if (placement.layer === "lower") map.lowerTiles[index] = placement.tile;
  else map.upperTiles[index] = placement.tile;
}

function shuffled<T>(values: readonly T[], rng: () => number): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const value = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = value;
  }
  return copy;
}
