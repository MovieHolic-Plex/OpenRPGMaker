// test/defaults.test.ts
// 빈 프로젝트 무결성 검증 — v2 스키마(3레이어/Database/Map Tree).

import { describe, it, expect } from "vitest";
import { createBlankProject, ensureSwitchVariableSlots, createBlankMap, createStarterMap, TILE, COMBINED_TOWN_TILESET_ID, DEFAULT_TILESET_ID, DEFAULT_TILESET_NAME, DEFAULT_TILESET_TEXTURE_KEY, DEFAULT_TILE_SIZE, DEFAULT_EASYRPG_CHARSET_ID, LEGACY_RM_TILESET_ID, LEGACY_RM_TILESET_TEXTURE_KEY, ensureBundledResourceProfiles, removeLegacyRmTileset } from "@/project/defaults";
import { TERRAIN_TAG, describeChipsetTile, tileLabelForIndex } from "@/project/defaults/chipsetMapping";
import { TILE_SIZE as RUNTIME_TILE_SIZE } from "@/assets/bundled";
import { TILE_SIZE as PREVIEW_TILE_SIZE } from "@/assets/tilePreview";
import { serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { SCHEMA_VERSION } from "@/project/types";
import sampleProject from "./fixtures/projects/oprn-sample-v3.json";
import { GENERATED_FACESET_FACE_IDS } from "@/assets/facesetFaceAssets";
import { retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";

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
    // 버들항의 민무늬 풀 칸(737). TILE.GRASS(240)는 합본 마을 번호라 버들항에서는 벽이다.
    expect(startMap.lowerTiles.every((tile) => tile === 737)).toBe(true);
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

    // 20 picker slots + 아이템이 켜는 기동석 스위치(#777 `ensureItemSwitchDefs`). 공용 아이템 목록이 늘며 기동석 수도
    // 11 → 15 로 늘었다 — 개수 대신 「빈 숫자 슬롯은 20칸뿐이고 나머지는 아이템이 실제로 켜는 스위치」를 본다.
    const itemSwitchIds = new Set(p.database.items.flatMap((item) => (item.switchId ? [item.switchId] : [])));
    expect(p.switches.filter((entry) => /^sw_\d{4}$/u.test(entry.id))).toHaveLength(20);
    expect(p.switches.filter((entry) => !/^sw_\d{4}$/u.test(entry.id)).every((entry) => itemSwitchIds.has(entry.id))).toBe(true);
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
    // 아이템이 있는 한 기동석 스위치도 함께 선언된다 — 여기서 보는 것은 "인공적인 빈
    // 슬롯(sw_NNNN)이 끼어들지 않는가" 이므로 그 축만 본다.
    expect(p.switches.filter((entry) => entry.id === "sw_legacy_gate")).toHaveLength(1);
    expect(p.switches.filter((entry) => /^sw_\d{4}$/u.test(entry.id))).toEqual([]);
    expect(p.variables).toEqual([{ id: "var_legacy_score", name: "" }]);
    expect(p.session.switches.sw_legacy_gate).toBe(true);
    // 아이템 기동석 세션 값은 함께 실린다 — 인공적인 빈 숫자 슬롯만 없으면 된다.
    expect(Object.keys(p.session.switches).filter((id) => /^sw_\d{4}$/u.test(id))).toEqual([]);
    expect(p.session.variables).toEqual({ var_legacy_score: 5 });
  });

  it("uses Beodeul City as the project-wide default chipset (Combined Town left with the 2026-10-07 purge)", () => {
    const p = createBlankProject();
    const defaultTileset = p.tilesets[DEFAULT_TILESET_ID];
    const chipsetProfiles = p.resourceProfiles.filter((profile) => profile.kind === "chipset");

    expect(DEFAULT_TILESET_ID).toBe("beodeul_city");
    // 합본 마을 시트는 2026-10-07 저작권 정리로 새 프로젝트에서 빠졌다(옛 저장본만 정의를 들고 있다).
    expect(p.tilesets["easyrpg_chipset_combined_town"]).toBeUndefined();
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
    expect(p.maps.map_town.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
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

  it("ensureBundledResourceProfiles 가 저장본의 생성 얼굴 프로필을 걷어낸다", () => {
    const p = createBlankProject();
    // 예전 저장본처럼 생성 시리즈 낱장 프로필이 남아 있는 상태를 만든다.
    // 생성 시리즈 id 는 GENERATED_FACESET_FACE_IDS 가 정본이다(hero-XX 시리즈는 정리로 빠지고 generated-faceset-missing-* 가 남았다).
    const generatedId = [...GENERATED_FACESET_FACE_IDS][0]!;
    p.resourceProfiles.push({
      kind: "faceset",
      name: "생성 얼굴",
      assetId: generatedId,
      imageWidth: 48,
      imageHeight: 48,
    });

    expect(ensureBundledResourceProfiles(p)).toBe(true);

    expect(p.resourceProfiles.some((profile) => profile.assetId === generatedId)).toBe(false);
    // 저작 목록에 다시 끼어들지도 않아야 한다.
    expect(p.resourceProfiles.some((profile) => profile.kind === "faceset" && GENERATED_FACESET_FACE_IDS.has(profile.assetId ?? ""))).toBe(false);
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
    // 지도 제작용 atlas_cartography 는 일부러 32px 시트다(섞인 칸 크기 배율 규칙 #1226) — 그 정의만 빼고 본다.
    const { atlas_cartography: _cartography, ...otherTilesets } = exported.tilesets as Record<string, unknown>;
    expect(tileSizesIn({ ...exported, tilesets: otherTilesets }).every((tileSize) => tileSize === 16)).toBe(true);
    expect(tileSizesIn(sampleProject).every((tileSize) => tileSize === 16)).toBe(true);
  });

  it("maps bundled chipset terrain, priority, and passability by atlas index", () => {
    // TILE.* 는 합본 마을 시트의 칸 번호다 — 기본 타일셋(버들항)이 아니라 합본 마을로 확인한다.
    // 정리(2026-10-07) 뒤 새 프로젝트에는 없으므로 옛 저장본의 정의를 만든다.
    const tileset = retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID);
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

describe("createBlankMap", () => {
  it("lowerTiles/upperTiles 길이 = width*height", () => {
    const m = createBlankMap("테스트", 5, 4);
    expect(m.lowerTiles.length).toBe(20);
    expect(m.upperTiles.length).toBe(20);
  });

  it("기본 lower는 전부 잔디, upper는 전부 빈 칸", () => {
    const m = createBlankMap("테스트", 3, 3);
    expect(m.lowerTiles.every((t: number) => t === 737)).toBe(true);
    // 합본 마을 정의를 넘기면(옛 저장본) 그 시트의 잔디(240)로 채운다.
    const town = createBlankMap("테스트", 3, 3, COMBINED_TOWN_TILESET_ID, DEFAULT_TILE_SIZE, retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID));
    expect(town.lowerTiles.every((t: number) => t === TILE.GRASS)).toBe(true);
    expect(m.upperTiles.every((t: number) => t === TILE.EMPTY)).toBe(true);
  });

  it("tilesetId가 기본 타일셋", () => {
    const m = createBlankMap("테스트", 3, 3);
    expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
  });
});

describe("createStarterMap", () => {
  // 시작 마을 장식(집 셋·흙길·주민 셋)은 2026-10-07 저작권 정리로 지웠다(defaultMaps.ts) — 집·길·NPC 세 시험을 이 하나로 바꾼다.
  it("builds the default 마을 as a plain 30x30 Beodeul grass field without the purged houses, roads, or NPCs", () => {
    const m = createStarterMap();
    expect(m.name).toBe("마을");
    expect(m.width).toBe(30);
    expect(m.height).toBe(30);
    expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(m.lowerTiles.every((tile) => tile === 737)).toBe(true);
    expect(m.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
    expect(m.events).toEqual([]);
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

});
