// test/defaults.test.ts
// 빈 프로젝트 무결성 검증 — v2 스키마(3레이어/Database/Map Tree).

import { describe, it, expect } from "vitest";
import {
  createBlankProject,
  createSampleAdventureProject,
  ensureSwitchVariableSlots,
  createBlankMap,
  createStarterMap,
  TILE,
  DEFAULT_TILESET_ID,
  DEFAULT_TILESET_NAME,
  DEFAULT_TILESET_TEXTURE_KEY,
  DEFAULT_TILE_SIZE,
  DEFAULT_EASYRPG_CHARSET_ID,
  LEGACY_RM_TILESET_ID,
  LEGACY_RM_TILESET_TEXTURE_KEY,
  ensureBundledResourceProfiles,
  removeLegacyRmTileset,
} from "@/project/defaults";
import { TERRAIN_TAG, describeChipsetTile, dirtLikeTiles, tileLabelForIndex } from "@/project/defaults/chipsetMapping";
import { TILE_SIZE as RUNTIME_TILE_SIZE } from "@/assets/bundled";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { TILE_SIZE as PREVIEW_TILE_SIZE } from "@/assets/tilePreview";
import { serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { SCHEMA_VERSION } from "@/project/types";
import sampleProject from "./fixtures/projects/oprn-sample-v3.json";

const STARTER_VILLAGE_SMALL_HOUSE_PATTERN = [
  [374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404],
  [102, 103, 103, 103, 104],
  [132, 133, 329, 133, 134],
  [162, 163, 359, 163, 164],
] as const;

const STARTER_VILLAGE_HOUSE_DOOR_APPROACHES = [
  { x: 7, y: 10 },
  { x: 21, y: 10 },
  { x: 7, y: 22 },
] as const;
const STARTER_VILLAGE_FIRST_DOOR_APPROACH = STARTER_VILLAGE_HOUSE_DOOR_APPROACHES[0];
const STARTER_VILLAGE_NPCS = [
  {
    id: "event_starter_mina",
    x: 15,
    y: 14,
    spriteId: "tex_easyrpg_charset_people1",
    pattern: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }),
    faceResourceId: "easyrpg-faceset-people1-00",
    speaker: "미나",
    body: "어서 와요. 이 마을의 이벤트는 모두 이 에디터 안에서 만들어졌어요.",
  },
  {
    id: "event_starter_rowen",
    x: 13,
    y: 16,
    spriteId: "tex_easyrpg_charset_people2",
    pattern: charsetFrameIndex({ characterIndex: 1, direction: "down", pattern: 1 }),
    faceResourceId: "easyrpg-faceset-people2-01",
    speaker: "로웬",
    body: "트리거를 Action Button으로 두면 말을 걸 때만 대화가 시작됩니다.",
  },
  {
    id: "event_starter_sera",
    x: 15,
    y: 18,
    spriteId: "tex_easyrpg_charset_actor2",
    pattern: charsetFrameIndex({ characterIndex: 2, direction: "down", pattern: 1 }),
    faceResourceId: "easyrpg-faceset-actor2-02",
    speaker: "세라",
    body: "얼굴 그림도 함께 뜨니까 실제 게임에서 보일 대화창을 그대로 확인할 수 있어요.",
  },
] as const;

type PatternSubject = {
  readonly tiles: readonly number[];
  readonly mapWidth: number;
  readonly mapHeight: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tileSizesIn(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => tileSizesIn(entry));
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    if (key === "tileSize" && typeof entry === "number") return [entry];
    return tileSizesIn(entry);
  });
}

describe("createBlankProject", () => {
  it("진짜 빈 프로젝트 shape를 만든다", () => {
    const p = createBlankProject();
    const maps = Object.values(p.maps);
    const startMap = p.maps[p.startMapId];

    expect(maps).toHaveLength(1);
    expect(startMap).toBeDefined();
    if (!startMap) throw new Error("missing blank start map");
    expect(startMap.name).toBe("빈 맵");
    expect(startMap.width).toBe(20);
    expect(startMap.height).toBe(15);
    expect(startMap.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(startMap.events).toHaveLength(0);
    expect(startMap.lowerTiles).toHaveLength(20 * 15);
    expect(startMap.upperTiles).toHaveLength(20 * 15);
    expect(startMap.lowerTiles.every((tile) => tile === TILE.GRASS)).toBe(true);
    expect(startMap.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
    expect(p.mapTree).toEqual({ mapId: p.startMapId, children: [] });
    expect(p.villageInfoDocuments).toEqual([]);
    expect(p.system.startActorIds).toEqual(["actor_hero"]);
    expect(p.session.partyActorIds).toEqual(["actor_hero"]);
  });

  it("스키마 버전 3을 가진다", () => {
    const p = createBlankProject();
    expect(p.version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(4);
  });

  it("startMapId가 maps에 존재한다", () => {
    const p = createBlankProject();
    expect(p.maps[p.startMapId]).toBeDefined();
  });

  it("startPos가 시작 맵 경계 안에 있다", () => {
    const p = createBlankProject();
    const m = p.maps[p.startMapId];
    expect(p.startPos.x).toBeGreaterThanOrEqual(0);
    expect(p.startPos.x).toBeLessThan(m.width);
    expect(p.startPos.y).toBeGreaterThanOrEqual(0);
    expect(p.startPos.y).toBeLessThan(m.height);
  });

  it("빈 프로젝트로 헤드리스 런타임 세션을 시작할 수 있다", () => {
    const p = createBlankProject();
    const session = startSession(p);

    expect(session.currentMapId).toBe(p.startMapId);
    expect(session.x).toBe(p.startPos.x);
    expect(session.y).toBe(p.startPos.y);
    expect(p.maps[session.currentMapId]).toBeDefined();
  });

  it("Database 구조가 있다(switches/variables/commonEvents/tilesets)", () => {
    const p = createBlankProject();
    expect(Array.isArray(p.switches)).toBe(true);
    expect(Array.isArray(p.variables)).toBe(true);
    expect(Array.isArray(p.commonEvents)).toBe(true);
    expect(p.tilesets[DEFAULT_TILESET_ID]).toBeDefined();
  });

  // Break caught: reintroducing the fixed 1,000-slot seed makes a new project
  // look capped and bloats every project/session beyond the first-use picker block.
  it("starts with one small picker block instead of 1000 preallocated slots", () => {
    const p = createBlankProject();

    expect(p.switches).toHaveLength(20);
    expect(p.variables).toHaveLength(20);
    expect(p.switches[0]).toEqual({ id: "sw_0001", name: "" });
    expect(p.variables[0]).toEqual({ id: "var_0001", name: "" });
    expect(p.switches.some((entry) => entry.id === "sw_1000")).toBe(false);
    expect(p.variables.some((entry) => entry.id === "var_1000")).toBe(false);
    expect(p.session.switches.sw_0020).toBe(false);
    expect(p.session.variables.var_0020).toBe(0);
  });

  // Break caught: removing fixed-slot allocation must not discard legacy/authored
  // start-state ids that still need editable definitions.
  it("keeps start-state switch and variable ids without filling artificial blank slots", () => {
    const p = createBlankProject();
    p.switches = [];
    p.variables = [];
    p.session.switches = { sw_legacy_gate: true };
    p.session.variables = { var_legacy_score: 5 };

    const changed = ensureSwitchVariableSlots(p);

    expect(changed).toBe(true);
    expect(p.switches).toEqual([{ id: "sw_legacy_gate", name: "" }]);
    expect(p.variables).toEqual([{ id: "var_legacy_score", name: "" }]);
    expect(p.session.switches).toEqual({ sw_legacy_gate: true });
    expect(p.session.variables).toEqual({ var_legacy_score: 5 });
  });

  it("uses EasyRPG RTP Combined Town as the project-wide default chipset", () => {
    const p = createBlankProject();
    const defaultTileset = p.tilesets[DEFAULT_TILESET_ID];
    const chipsetProfiles = p.resourceProfiles.filter((profile) => profile.kind === "chipset");

    expect(DEFAULT_TILESET_ID).toBe("easyrpg_chipset_combined_town");
    expect(defaultTileset?.name).toBe(DEFAULT_TILESET_NAME);
    expect(defaultTileset?.image).toEqual({ type: "bundled", id: DEFAULT_TILESET_TEXTURE_KEY });
    expect(p.maps[p.startMapId].tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(chipsetProfiles[0]?.assetId).toBe(DEFAULT_TILESET_TEXTURE_KEY);
    expect(chipsetProfiles.filter((profile) => profile.assetId === DEFAULT_TILESET_TEXTURE_KEY)).toHaveLength(1);
    expect(chipsetProfiles.some((profile) => profile.assetId === LEGACY_RM_TILESET_TEXTURE_KEY)).toBe(false);
    expect(p.tilesets[LEGACY_RM_TILESET_ID]).toBeUndefined();
  });

  it("removes legacy RM sample tilesets and rewires old maps to bundled EasyRPG chipsets", () => {
    const p = createBlankProject();
    p.tilesets[LEGACY_RM_TILESET_ID] = {
      ...p.tilesets[DEFAULT_TILESET_ID],
      id: LEGACY_RM_TILESET_ID,
      name: "기본 타일셋",
      image: { type: "bundled", id: LEGACY_RM_TILESET_TEXTURE_KEY },
    };
    p.maps.map_town = { ...p.maps[p.startMapId], id: "map_town", name: "샘플 마을", tilesetId: LEGACY_RM_TILESET_ID };
    p.maps.map_dungeon = { ...p.maps[p.startMapId], id: "map_dungeon", name: "샘플 던전", tilesetId: LEGACY_RM_TILESET_ID };
    p.maps.map_interior = { ...p.maps[p.startMapId], id: "map_interior", name: "샘플 실내", tilesetId: LEGACY_RM_TILESET_ID };

    expect(removeLegacyRmTileset(p)).toBe(true);

    expect(p.tilesets[LEGACY_RM_TILESET_ID]).toBeUndefined();
    expect(p.maps.map_town.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(p.maps.map_dungeon.tilesetId).toBe("easyrpg_chipset_dungeon");
    expect(p.maps.map_interior.tilesetId).toBe("easyrpg_chipset_interior");
  });

  it("removes the legacy RM sample chipset resource profile", () => {
    const p = createBlankProject();
    p.resourceProfiles.push({
      kind: "chipset",
      name: "기본 타일셋",
      tileWidth: 16,
      tileHeight: 16,
      imageWidth: 480,
      imageHeight: 256,
      assetId: LEGACY_RM_TILESET_TEXTURE_KEY,
    });

    expect(ensureBundledResourceProfiles(p)).toBe(true);

    expect(p.resourceProfiles.some((profile) => profile.assetId === LEGACY_RM_TILESET_TEXTURE_KEY)).toBe(false);
  });

  it("Map Tree가 있고 루트가 startMapId", () => {
    const p = createBlankProject();
    expect(p.mapTree.mapId).toBe(p.startMapId);
    expect(Array.isArray(p.mapTree.children)).toBe(true);
  });

  it("does not ship a legacy default NPC sprite in assets.sprites", () => {
    const p = createBlankProject();
    expect(p.assets.sprites.hero).toBeUndefined();
    expect(p.assets.sprites).toEqual({});
    expect(p.assets.uploaded).toBeDefined();
  });

  it("keeps removed legacy character tokens out of the default project export", () => {
    const p = createBlankProject();
    const exported = serialize(p);
    const forbiddenTokens = [
      ["npc", "villager"].join("_"),
      ["tex", "npc", "villager"].join("_"),
      ["DEFAULT", "SPRITE", "NPC"].join("_"),
      ["TEX", "NPC"].join("_"),
    ];
    const charsetProfiles = p.resourceProfiles.filter((profile) => profile.kind === "charset");

    for (const token of forbiddenTokens) {
      expect(exported.includes(token)).toBe(false);
    }
    expect(DEFAULT_EASYRPG_CHARSET_ID).toBe("tex_easyrpg_charset_people1");
    expect(charsetProfiles.some((profile) => profile.assetId === DEFAULT_EASYRPG_CHARSET_ID)).toBe(true);
  });

  it("meta.terms가 있다", () => {
    const p = createBlankProject();
    expect(typeof p.meta.terms.gold).toBe("string");
  });

  it("uses RM2K3 16x16 tiles for runtime, defaults, export, and sample fixtures", () => {
    const p = createBlankProject();
    const exported = JSON.parse(serialize(p));

    expect(DEFAULT_TILE_SIZE).toBe(16);
    expect(RUNTIME_TILE_SIZE).toBe(16);
    expect(PREVIEW_TILE_SIZE).toBe(16);
    expect(p.tilesets[DEFAULT_TILESET_ID].tileSize).toBe(16);
    expect(p.maps[p.startMapId].tileSize).toBe(16);
    expect(tileSizesIn(exported).every((tileSize) => tileSize === 16)).toBe(true);
    expect(tileSizesIn(sampleProject).every((tileSize) => tileSize === 16)).toBe(true);
  });

  it("maps bundled chipset terrain, priority, and passability by atlas index", () => {
    const p = createBlankProject();
    const tileset = p.tilesets[DEFAULT_TILESET_ID];
    const passable = { up: true, down: true, left: true, right: true };
    const solid = { up: false, down: false, left: false, right: false };

    expect(tileset.terrain[TILE.WATER]).toBe(TERRAIN_TAG.WATER);
    expect(tileset.terrain[TILE.PATH]).toBe(TERRAIN_TAG.NORMAL);
    expect(tileset.passability[TILE.WATER]).toEqual(solid);
    expect(tileset.passability[TILE.PATH]).toEqual(passable);
    // Tree bases occupy lower; the renderer composites ground beneath their transparency.
    // Canopies and other transparent props remain upper-layer tiles.
    expect(tileset.priority[TILE.TREE]).toBe("lower");
    expect(tileset.passability[TILE.TREE]).toEqual(solid);
    expect(tileset.priority[TILE.FLOWERS]).toBe("upper");
    expect(tileset.passability[TILE.FLOWERS]).toEqual(passable);
    expect(tileset.priority[85]).toBe("upper");
    expect(tileset.priority[378]).toBe("upper");
    expect(tileset.priority[374]).toBe("lower");
    const passableRoofTiles = [374, 375, 376, 377, 384, 385, 386, 387, 404, 405, 406, 407, 436, 437].filter((tile) => !(
      tileset.passability[tile]?.up === false &&
      tileset.passability[tile]?.down === false &&
      tileset.passability[tile]?.left === false &&
      tileset.passability[tile]?.right === false
    ));
    expect(passableRoofTiles).toEqual([]);
    expect(tileLabelForIndex(TILE.PATH)).toBe("Dirt road");
  });

  it("describes one chipset cell as the smallest mapping unit", () => {
    expect(describeChipsetTile(TILE.PATH)).toMatchObject({
      index: TILE.PATH,
      column: 0,
      row: 12,
      label: "Dirt road",
      layer: "lower",
      passage: "passable",
      terrainTag: TERRAIN_TAG.NORMAL,
      repeatRole: "body",
      confirmed: true,
    });
    expect(describeChipsetTile(TILE.TREE)).toMatchObject({
      label: "Tree",
      layer: "upper",
      passage: "solid",
      repeatRole: "object",
      confirmed: true,
    });
    expect(describeChipsetTile(390)).toMatchObject({
      label: "Dirt corner",
      repeatRole: "edge",
      confirmed: true,
    });
  });

});

describe("createSampleAdventureProject", () => {
  it("명시 예제 프로젝트로 이슬 장터 데모를 제공한다", () => {
    const p = createSampleAdventureProject();

    expect(Object.keys(p.maps)).toHaveLength(16);
    expect(p.meta.title).toBe("이슬 장터 — 30분");
    expect(Object.values(p.maps).some((map) => map.name === "이슬 장터 마을" && map.events.length > 0)).toBe(true);
  });
});

describe("createBlankMap", () => {
  it("lowerTiles/upperTiles 길이 = width*height", () => {
    const m = createBlankMap("테스트", 5, 4);
    expect(m.lowerTiles.length).toBe(20);
    expect(m.upperTiles.length).toBe(20);
  });

  it("기본 lower는 전부 잔디, upper는 전부 빈 칸", () => {
    const m = createBlankMap("테스트", 3, 3);
    expect(m.lowerTiles.every((t: number) => t === TILE.GRASS)).toBe(true);
    expect(m.upperTiles.every((t: number) => t === TILE.EMPTY)).toBe(true);
  });

  it("tilesetId가 기본 타일셋", () => {
    const m = createBlankMap("테스트", 3, 3);
    expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
  });
});

describe("createStarterMap", () => {
  it("builds the default 마을 as a 30x30 village with exactly three small houses and connected roads", () => {
    // Given: the starter map factory creates the first user-visible map.
    // When: the default starter map is generated.
    const m = createStarterMap();

    // Then: the map has the requested compact village shape.
    expect(m.name).toBe("마을");
    expect(m.width).toBe(30);
    expect(m.height).toBe(30);
    expect(m.lowerTiles.length).toBe(30 * 30);
    expect(m.upperTiles.length).toBe(30 * 30);
    expect(countPatternOccurrences({ tiles: m.lowerTiles, mapWidth: m.width, mapHeight: m.height }, STARTER_VILLAGE_SMALL_HOUSE_PATTERN)).toBe(3);
    expect(roadComponentSize(m, STARTER_VILLAGE_FIRST_DOOR_APPROACH)).toBe(roadTileCount(m));
    for (const approach of STARTER_VILLAGE_HOUSE_DOOR_APPROACHES) {
      expect(isDirtRoadTile(m.lowerTiles[approach.y * m.width + approach.x] ?? TILE.EMPTY)).toBe(true);
      expect(roadComponentContains(m, STARTER_VILLAGE_FIRST_DOOR_APPROACH, approach)).toBe(true);
      expect(m.upperTiles[approach.y * m.width + approach.x]).toBe(TILE.EMPTY);
    }
  });

  it("keeps the compact village boundary open grass (no wall frame)", () => {
    const m = createStarterMap();
    for (let x = 0; x < m.width; x++) {
      expect(m.lowerTiles[0 * m.width + x]).not.toBe(TILE.WALL);
      expect(m.lowerTiles[(m.height - 1) * m.width + x]).not.toBe(TILE.WALL);
    }
    for (let y = 0; y < m.height; y++) {
      expect(m.lowerTiles[y * m.width + 0]).not.toBe(TILE.WALL);
      expect(m.lowerTiles[y * m.width + (m.width - 1)]).not.toBe(TILE.WALL);
    }
  });

  it("uses chipset-aligned dirt tiles for the connected village road", () => {
    const m = createStarterMap();
    const roadTiles = new Set<number>(dirtLikeTiles());
    const roadSamples = [
      { x: 4, y: 10 },
      { x: 14, y: 11 },
      { x: 23, y: 12 },
      { x: 7, y: 22 },
      { x: 15, y: 24 },
    ];
    expect(roadTiles.has(TILE.PATH)).toBe(true);
    for (const point of roadSamples) {
      const tile = m.lowerTiles[point.y * m.width + point.x];
      expect(tile).toBeDefined();
      expect(roadTiles.has(tile ?? TILE.EMPTY)).toBe(true);
      expect(m.upperTiles[point.y * m.width + point.x]).toBe(TILE.EMPTY);
    }
  });

  it("ships three playable NPC events with EasyRPG charsets, face chips, and dialogue", () => {
    const m = createStarterMap();
    for (const expected of STARTER_VILLAGE_NPCS) {
      const event = m.events.find((entry) => entry.id === expected.id);
      expect(event).toBeDefined();
      if (!event) throw new Error(`missing starter NPC ${expected.id}`);
      expect(event.x).toBe(expected.x);
      expect(event.y).toBe(expected.y);
      expect(event.trigger.kind).toBe("action");
      expect(m.upperTiles[event.y * m.width + event.x]).toBe(TILE.EMPTY);

      const page = event.pages?.[0];
      expect(page).toBeDefined();
      if (!page) throw new Error(`missing starter NPC page ${expected.id}`);
      expect(page.name).toBe(expected.speaker);
      expect(page.graphic.sprite?.id).toBe(expected.spriteId);
      expect(page.graphic.pattern).toBe(expected.pattern);
      expect(page.trigger.kind).toBe("action");
      expect(page.priority).toBe("same");
      expect(page.overlapForbidden).toBe(true);

      const faceCommand = page.commands.find((command) => command.kind === "changeFace");
      if (!faceCommand || faceCommand.kind !== "changeFace") {
        throw new Error(`missing face command for ${expected.id}`);
      }
      // 얼굴 한 칸 = 파일 한 장 — 명령은 낱장 얼굴 id 하나만 들고 있다.
      expect(faceCommand.resourceId).toBe(expected.faceResourceId);
      expect(faceCommand.position).toBe("left");

      const textCommand = page.commands.find((command) => command.kind === "text");
      if (!textCommand || textCommand.kind !== "text") {
        throw new Error(`missing text command for ${expected.id}`);
      }
      expect(textCommand.speaker).toBe(expected.speaker);
      expect(textCommand.body).toBe(expected.body);
    }
  });
});

function countPatternOccurrences(
  subject: PatternSubject,
  pattern: readonly (readonly number[])[]
): number {
  let count = 0;
  const patternHeight = pattern.length;
  const patternWidth = pattern[0]?.length ?? 0;
  for (let y = 0; y <= subject.mapHeight - patternHeight; y += 1) {
    for (let x = 0; x <= subject.mapWidth - patternWidth; x += 1) {
      if (matchesPatternAt(subject, pattern, { x, y })) count += 1;
    }
  }
  return count;
}

function matchesPatternAt(
  subject: PatternSubject,
  pattern: readonly (readonly number[])[],
  origin: { readonly x: number; readonly y: number }
): boolean {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) return false;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0 && subject.tiles[(origin.y + y) * subject.mapWidth + origin.x + x] !== tile) return false;
    }
  }
  return true;
}

function roadTileCount(map: ReturnType<typeof createStarterMap>): number {
  return map.lowerTiles.filter(isDirtRoadTile).length;
}

function roadComponentSize(map: ReturnType<typeof createStarterMap>, start: { readonly x: number; readonly y: number }): number {
  return collectRoadComponent(map, start).size;
}

function roadComponentContains(
  map: ReturnType<typeof createStarterMap>,
  start: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number }
): boolean {
  return collectRoadComponent(map, start).has(pointKey(target));
}

function collectRoadComponent(map: ReturnType<typeof createStarterMap>, start: { readonly x: number; readonly y: number }): Set<string> {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const point = queue.shift();
    if (!point) continue;
    const key = pointKey(point);
    if (visited.has(key)) continue;
    const tile = map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
    if (!isDirtRoadTile(tile)) continue;
    visited.add(key);
    queue.push(
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 }
    );
  }
  return visited;
}

function pointKey(point: { readonly x: number; readonly y: number }): string {
  return `${point.x},${point.y}`;
}

function isDirtRoadTile(tile: number): boolean {
  return dirtLikeTiles().includes(tile);
}
