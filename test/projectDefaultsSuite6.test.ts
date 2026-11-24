import { beforeEach, describe, expect, it, afterEach, vi } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { getTool, TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject, createBlankMap, createStarterMap } from "@/project/defaults";
import { DEFAULT_TILESET_ID, TILE, DEFAULT_TROOP_ID } from "@/project/defaults/constants";
import { defaultOutdoorTilesetId } from "@/project/defaults/outdoorTileset";
import { isRetiredEasyRpgTileset } from "@/project/retiredEasyRpgTilesets";
import { retiredEasyRpgTileset, RETIRED_COMBINED_TOWN_TILESET_ID } from "./support/retiredEasyRpgTilesets";
import { bundledChipsetTileSize, bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { buildHandInteriorLayers, floorLayX, HAND_INTERIOR_SPECS, roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { compileRoomKit, installRoomKit, kitHandObjects, parseRoomKitDraft, roomKitAssetId, roomKitPicksProblem, rpgMakerAutotileSheet, rpgMakerBlockPicks, savedRoomKitPicks, type RoomKitPicks } from "@/project/roomKit";
import { createWizardingWorldTileset } from "@/project/defaults/wizardingWorld";
import type { TilesetDef, GameEvent, GameMap, MapConnection, Project, TileGraft, StructureKitDef } from "@/project/types";
import type Phaser from "phaser";
import { store } from "@/project/store";
import { tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { WORLD_COAST_GROUP_ID, withWorldCoastRenderPass, worldCoastAutotileGroup } from "@/project/defaults/worldCoastMapping";
import { setAutotileVariant } from "@/editor/tilesetActions";
import { committedEvents, mapWithCommittedEvents } from "@/project/eventDrafts";
import { ensureFogTexture } from "@/player/weather/fogTexture";
import { CLOUD_SHAPE_FRAMES, cloudShapeTextureKey, ensureCloudShapeTextures } from "@/player/weather/cloudShadowTexture";
import { AtmosphereAudio } from "@/player/audio/atmosphereAudio";
import { WeatherAudio } from "@/player/audio/weatherAudio";
import { lightingGradientParams } from "@/player/lighting";
import { M2_HISTORY_LIMIT, ensureM2Runtime, pushM2History } from "@/player/interpreter/m2RuntimeState";
import { executeModernCommand } from "@/player/interpreter/m2ModernRuntime";
import { parseLifeState } from "@/project/lifeStateReconciliation";
import { armTerrainComponents, terrainMayReach } from "@/project/tilePassabilityComponents";
import { findChasePath } from "@/player/chaseAi";
import { fitBattleEnemy } from "@/player/battleEnemyFit";
import { startSession } from "@/project/session";
import { createBlockingEventQuery, findBlockingEventOverlappingRect, initialRuntimeEventPositions, invalidateEventIdIndexPass, runtimeEventViewById, runtimeEventViewsForMap, withEventIdIndexPass } from "@/project/runtimeEventState";
import { footprintBounds, pointRect } from "@/project/footprint";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { applyChangeTileStep } from "@/player/playSceneMapCommands";
import { firstConnectionToward } from "@/player/npcLivingTravel";
import { updateParallelEvents } from "@/player/playSceneSchedulers";
import { SENGOKU_CONCEPT_HINT, SENGOKU_EXPOSED_TOOLS, SENGOKU_TILESET_ID, describesSengoku, formatSengokuNote, hasSengokuTileset, namesSengokuTileset, sengokuPromptLines, sengokuStyleFor, sengokuTargetFor } from "@/ai/sengokuEdoPolicy";
import { BUILDABLE_CONCEPT_TILESETS } from "@/concepts/format";
import { composeSengokuEdo, sengokuPaletteFromTileset, SENGOKU_DEFAULT_SIZE, SENGOKU_STYLES } from "@/project/sengokuEdoComposer";
import { createSengokuEdoTileset } from "@/project/defaults/sengokuEdo";
import { declaredIntent } from "./intentFixture";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { SKY_ISLAND_ID, createSkyIslandTileset } from "@/project/defaults/skyIsland";
import { existingMatches } from "@/editor/tools/objectGenTool";
import { isPassable } from "@/project/collision";
import spec from "../tiledata/sky-island/objects/spec.json";
import ask from "../tiledata/sky-island/objects/ask.json";
import { addStarterHouseDoor, createStarterHouseInteriorMap, STARTER_HOUSE_SLIME_EVENT_ID, STARTER_HOUSE_SLIME_POS } from "@/project/defaults/starterHouseTransfer";
import { applyGen1MajorStatus, applyGen1PostActionResidual, gen1ConfusionSelfDamage, gen1ConfusionTurns, gen1MajorStatusBlockedByType, gen1NextToxicCounter, readGen1MajorStatus, stepGen1Confusion } from "@/battle/gen1/status";
import { normalizeStateRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createBattleRuntime } from "@/battle/runtime";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { isolateTimers } from "./mergedTeardown";

// 폐기된 EasyRPG 계열 칩셋 차단(2026-10-06 사용자 결정 「대체품이 생기기 전까지 막고」 + 「등록 장소는 조수 추천 목록에」).
// 실행기(toolRunner.rejectRetiredEasyRpgMaps)는 조수 실행(ctx.assistantRun)에서만 새 맵·칩셋 변경을 막는다.
describe("retiredEasyRpgTilesets", () => {
  isolateTimers();
  const START = "map_blank_start";
  function assistant(project = createBlankProject()): ToolContext {
    return { project, currentMapId: START, assistantRun: true };
  }
  function createMap(ctx: ToolContext, tilesetId: string, id = "map_x") {
    return runTool(ctx, "create_map", { id, name: "새 맵", width: 20, height: 15, tilesetId }, { dryRun: false });
  }
  /**
   * 숲마을(forest_harmony) 정의를 아직 들고 있는 옛 저장본. 숲마을 그림·정의는 2026-10-07 저작권 정리로 지워 되살릴 원본이 없다 —
   * 숲마을은 합본 마을 재칠(family "easyrpg")이었으므로 합본 마을 정의를 그 id 로 들인다. 판정은 id 와 계보로만 한다.
   */
  function withOldForestVillage(project = createBlankProject()) {
    project.tilesets.forest_harmony = { ...retiredEasyRpgTileset(RETIRED_COMBINED_TOWN_TILESET_ID), id: "forest_harmony", name: "숲마을" };
    return project;
  }
  beforeEach(() => {
    resetMapEditHistory();
  });
  describe("폐기 판정", () => {
    it("EasyRPG 계보는 폐기, 손 도트 실내·버들항·월드맵은 아니다", () => {
      const project = createBlankProject();
      for (const id of ["forest_harmony", "forest_harmony_snow", "easyrpg_chipset_dungeon", "atlas_biome_dungeon", "tibo_interior_expanded", "oprn_dungeon_stone"]) {
        expect(isRetiredEasyRpgTileset(project, id), id).toBe(true);
      }
      for (const id of ["atlas_biome_interior", DEFAULT_TILESET_ID, "easyrpg_chipset_world", "atlas_biome_world", "joseon_baram"]) {
        expect(isRetiredEasyRpgTileset(project, id), id).toBe(false);
      }
    });
  });
  describe("조수 실행 차단", () => {
    it.each(["forest_harmony", "easyrpg_chipset_dungeon", "atlas_biome_dungeon"])("%s 로 새 맵 → 거부, 장소 가져오기 안내", (tilesetId) => {
      const ctx = assistant();
      const result = createMap(ctx, tilesetId);
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("retired-easyrpg-tileset");
      expect(result.issues?.[0]?.message).toContain("import_region_reference");
      expect(ctx.project.maps.map_x).toBeUndefined();
    });

    it("손 도트 실내·버들항 새 맵은 통과", () => {
      const ctx = assistant();
      expect(createMap(ctx, "atlas_biome_interior", "map_in").ok).toBe(true);
      expect(createMap(ctx, DEFAULT_TILESET_ID, "map_town").ok).toBe(true);
    });

    it("이미 숲마을 칩셋으로 깐 맵은 조수도 계속 고친다", () => {
      const human: ToolContext = { project: withOldForestVillage(), currentMapId: START };
      expect(createMap(human, "forest_harmony", "map_forest").ok).toBe(true);
      const ctx: ToolContext = { project: human.project, currentMapId: "map_forest", assistantRun: true };
      const result = runTool(ctx, "set_map_properties", { mapId: "map_forest", name: "옛 숲" }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.map_forest?.name).toBe("옛 숲");
    });

    it("조수 표시가 없는 실행(편집기 UI·스크립트)은 그대로", () => {
      const ctx: ToolContext = { project: withOldForestVillage(), currentMapId: START };
      expect(createMap(ctx, "forest_harmony").ok).toBe(true);
    });

    it("EasyRPG 생성기는 조수에게 숨기고 실행은 남긴다", () => {
      // run_dungeon_room_pipeline·start_dungeon_room_session 은 레지스트리에서 일부러 뺐다(#3641 이 그 호출 사례를 은퇴) — 남은 생성기만 본다.
      for (const name of ["generate_map"]) {
        const tool = getTool(name);
        expect(tool?.deprecated, name).toBe(true);
        expect(tool?.supersededBy, name).toBe("import_region_reference");
      }
    });
  });
  describe("기본 칩셋이 숲마을로 새지 않는다", () => {
    it("버들항 프로젝트에 실내 맵이 있어도 야외 기본은 버들항", () => {
      const ctx: ToolContext = { project: createBlankProject(), currentMapId: START };
      expect(createMap(ctx, "atlas_biome_interior", "map_in").ok).toBe(true);
      expect(defaultOutdoorTilesetId(ctx.project)).toBe(DEFAULT_TILESET_ID);
    });

    it("build_world 의 마을·던전·실내 자리는 모두 버들항", () => {
      const ctx = assistant();
      const result = runTool(ctx, "build_world", {
        plan: {
          nodes: [
            { mapId: "map_town", role: "town", label: "마을", width: 20, height: 16 },
            { mapId: "map_cave", role: "dungeon", label: "동굴", width: 20, height: 16 },
          ],
          edges: [{ from: { mapId: "map_town", exit: { side: "east" } }, to: { mapId: "map_cave", entry: { side: "west" } } }],
        },
      }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.map_town?.tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(ctx.project.maps.map_cave?.tilesetId).toBe(DEFAULT_TILESET_ID);
    });
  });
});

// 방 짓기 역할표 만들기(src/project/roomKit.ts) — 사용자가 고른 바닥·벽면·천장 칸으로 변형 칸과 사양을 만들고,
// 그 칩셋으로 ㄱ자 방이 지어지는가. 위키: openwiki/atlas-biome-interior.md 「역할표」.
describe("roomKit", () => {
  isolateTimers();
  const T = 16, COLS = 8, ROWS = 4;
  /** 칸마다 다른 단색 시트(칸 번호 = 빨강 값). */
  function sheet() {
    const data = new Uint8ClampedArray(COLS * T * ROWS * T * 4);
    for (let y = 0; y < ROWS * T; y++) for (let x = 0; x < COLS * T; x++) {
      const i = (y * COLS * T + x) * 4, id = Math.floor(y / T) * COLS + Math.floor(x / T);
      data[i] = id * 7; data[i + 1] = 120; data[i + 2] = 80; data[i + 3] = 255;
    }
    return { width: COLS * T, height: ROWS * T, data };
  }
  const picks: RoomKitPicks = { floor: [[0, 1], [8, 9]], wall: [[2, 3, 4], [10, 11, 12]], ceiling: 5 };
  const tileset = (): TilesetDef => ({
    id: "my_upload", name: "올린 칩셋", image: { type: "uploaded", id: "up_1" }, tileSize: T, tilesPerRow: COLS, count: COLS * ROWS,
    passability: Array.from({ length: COLS * ROWS }, () => ({ up: true, down: true, left: true, right: true })),
    priority: Array.from({ length: COLS * ROWS }, () => "lower" as const), terrain: Array.from({ length: COLS * ROWS }, () => 0),
  } as unknown as TilesetDef);
  describe("roomKit 역할표 만들기", () => {
    it("고른 칸 모양을 검사한다", () => {
      expect(roomKitPicksProblem(picks, 32)).toBeNull();
      expect(roomKitPicksProblem({ ...picks, wall: [[2, 3], [10]] }, 32)).toMatch(/같은 길이/);
      expect(roomKitPicksProblem({ ...picks, ceiling: 99 }, 32)).toMatch(/없는 칸/);
    });

    it("변형 칸 = 바닥 칸×그림자 4 + 벽면 칸×서쪽 2 + 천장 32 + 바깥 1", () => {
      const c = compileRoomKit(sheet(), T, picks);
      expect(c.roles.length).toBe(4 * 4 + 6 * 2 + 32 + 1);
      expect(c.sheet.width).toBe(16 * T);
      // 그림자 없는 바닥 칸은 고른 칸 그대로, 벽 밑 그늘 칸은 윗줄이 더 어둡다.
      expect(c.sheet.data[0]).toBe(0);
      const shaded = c.sheet.data.subarray(T * 4, T * 4 + 4); // 둘째 칸(그림자 1) 왼쪽 위 픽셀
      expect(shaded[1]).toBeLessThan(120);
    });

    it("설치하면 칩셋 끝 뒤 새 줄에 이식하고 사양이 그 칸을 가리킨다 — ㄱ자 방이 지어진다", () => {
      const c = compileRoomKit(sheet(), T, picks);
      const project = { tilesets: { my_upload: tileset() }, assets: { uploaded: {} as Record<string, unknown> } };
      const id = roomKitAssetId(T, "data:image/png;base64,AAAA");
      installRoomKit(project, "my_upload", c, { id, dataUrl: "data:image/png;base64,AAAA" }, picks);
      const ts = project.tilesets.my_upload;
      expect(project.assets.uploaded[id]).toBeTruthy();
      expect((project.assets.uploaded[id] as { generatedBy?: string }).generatedBy).toBeUndefined();
      expect(ts.tileGrafts![0]!.targetTile).toBe(32);
      expect(ts.count).toBe(32 + c.roles.length);
      expect(savedRoomKitPicks(ts)).toEqual(picks);
      const spec = roomSpecOf(ts) as HandInteriorSpec;
      const plan = ["##########", "#....#####", "#....#####", "#........#", "#........#", "####..####"];
      const layers = buildHandInteriorLayers({ plan, floor: "floor", wall: "wall" }, ts, spec);
      expect(layers.issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(layers.lowerTiles.every((t) => t >= 32 && t < ts.count)).toBe(true);
      expect(layers.unreachedFloor).toEqual([]);
    });

    it("변형 시트 id 로 칸 크기·줄 칸 수를 안다(스토어 사본 id 포함)", () => {
      expect(bundledChipsetTileSize("roomkit_32_abcd1234_x")).toBe(32);
      expect(bundledChipsetTilesPerRow("roomkit_32_abcd1234_x")).toBe(16);
      expect(bundledChipsetTileSize("store_my_pack__roomkit_48_abcd1234_x")).toBe(48);
    });

    it("픽셀 창 칸(RPG Maker 오토타일 가운데)도 읽는다", () => {
      const c = compileRoomKit(sheet(), T, { ...picks, ceiling: { px: 8, py: 8 } });
      // 천장 바깥 칸(마지막) = 칸 0·1·8·9 의 경계에 걸친 창 — 왼쪽 위 화소는 칸 0(빨강 0)
      const last = c.roles.length - 1, ox = (last % 16) * T, oy = Math.floor(last / 16) * T;
      expect(c.sheet.data[(oy * 16 * T + ox) * 4]).toBe(0);
      expect(c.sheet.data[(oy * 16 * T + ox + 15) * 4]).toBe(7);
      expect(roomKitPicksProblem({ ...picks, ceiling: { px: 120, py: 0 } }, 32, { width: 128, height: 64, tileSize: 16 })).toMatch(/없는 칸/);
    });

    it("RPG Maker A2·A4 시트를 칸 수로 알아보고 블록 가운데를 뗀다", () => {
      expect(rpgMakerAutotileSheet(16, 15)).toBe("A4");
      expect(rpgMakerAutotileSheet(16, 12)).toBe("A2");
      expect(rpgMakerAutotileSheet(8, 16)).toBeNull();
      expect(rpgMakerBlockPicks("A4", 3, 4, 48)).toEqual({ wallTop: { px: 2 * 48 + 24, py: 3 * 48 }, wallBottom: { px: 2 * 48 + 24, py: 4 * 48 } });
      expect(rpgMakerBlockPicks("A4", 5, 6, 48)).toEqual({ surface: { px: 4 * 48 + 24, py: 5 * 48 + 48 + 24 } });
      expect(rpgMakerBlockPicks("A2", 1, 2, 16)).toEqual({ surface: { px: 8, py: 16 + 8 } });
    });

    it("AI 초안 답(코드 울타리·뒷말 포함)을 고른 칸으로 바꾼다", () => {
      const text = '```json\n{"floor":{"col":1,"row":0,"w":2,"h":1},"wallTop":{"col":2,"row":1,"w":2},"wallBottom":{"col":2,"row":2,"w":2},"ceiling":{"col":5,"row":3},"reason":"a {brace} b"}\n``` 끝';
      const got = parseRoomKitDraft(text, COLS, ROWS);
      expect(typeof got).toBe("object");
      if (typeof got === "string") return;
      expect(got.picks).toEqual({ floor: [[1, 2]], wall: [[10, 11], [18, 19]], ceiling: 29 });
      expect(got.reason).toBe("a {brace} b");
      expect(parseRoomKitDraft('{"floor":{"col":99,"row":0}}', COLS, ROWS)).toMatch(/시트 밖|빠졌/);
    });

    it("조립 부품 → 방 짓기 가구(마법 학교: 벽난로 = 벽 가구, 침대 = 바닥 가구)", () => {
      const objs = kitHandObjects(createWizardingWorldTileset());
      expect(objs["wz-furn-fireplace"]).toMatchObject({ kind: "wall", w: 3, h: 2 });
      expect(objs["wz-dorm-bed-green"]).toMatchObject({ kind: "floor", w: 2, h: 3 });
      expect(objs["wz-castle-wall-n"]).toBeUndefined();
    });

    it("마법 학교 번들 역할표로 ㄱ자 방을 짓는다", () => {
      const ts = createWizardingWorldTileset();
      expect(ts.roomKit).toEqual({ builtin: "wizarding_world" });
      const spec = roomSpecOf(ts) as HandInteriorSpec;
      expect(spec).toBe(HAND_INTERIOR_SPECS.wizarding_world);
      const plan = ["##########", "#....#####", "#....#####", "#....#####", "#....#####", "#........#", "#........#", "#........#", "####..####"];
      const layers = buildHandInteriorLayers({ plan, floor: "castle-floor-flag", wall: "castle" }, ts, { ...spec, objects: kitHandObjects(ts) as never });
      expect(layers.issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(layers.lowerTiles.every((t) => t > 0 && t < ts.count)).toBe(true);
      expect(layers.unreachedFloor).toEqual([]);
    });

    it("줄 밀기 rowShift 는 jp ikit.lay_x 와 같은 값(murmur fmix32)", () => {
      const fd = { cols: 8, lay: "rowShift" };
      expect(Array.from({ length: 12 }, (_, y) => floorLayX(fd, 0, y))).toEqual([7, 6, 7, 5, 5, 0, 4, 3, 3, 0, 4, 3]);
      expect(floorLayX({ cols: 8 }, 5, 3)).toBe(5);
    });
  });
});

// 런타임 렉 수정 2차(2026-09-27)의 동등성 회귀. 기억(memo)은 입력이 바뀌면 반드시 무효가 되고,
// 나눠 굽기는 한 번에 굽기와 같은 결과를 내는지를 본다. 속도 자체는 단위 테스트로 증명하지 않는다.
describe("runtimeLagFixes2", () => {
  isolateTimers();
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  describe("이식 텍스처 suffix 기억", () => {
    const graft = (targetTile: number, sourceTile = 1): TileGraft => ({ sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile, targetTile });

    it("같은 배열이면 같은 답, push·새 배열이면 새 답", () => {
      const grafts = [graft(10)];
      const tileset: Pick<TilesetDef, "tileGrafts"> = { tileGrafts: grafts };
      const first = tileGraftsTextureSuffix(tileset);
      expect(first).not.toBe("");
      expect(tileGraftsTextureSuffix(tileset)).toBe(first);
      grafts.push(graft(11));
      const pushed = tileGraftsTextureSuffix(tileset);
      expect(pushed).not.toBe(first);
      expect(pushed).toBe(tileGraftsTextureSuffix({ tileGrafts: [graft(10), graft(11)] }));
      tileset.tileGrafts = [graft(10, 2)];
      expect(tileGraftsTextureSuffix(tileset)).toBe(tileGraftsTextureSuffix({ tileGrafts: [graft(10, 2)] }));
      expect(tileGraftsTextureSuffix(tileset)).not.toBe(first);
      tileset.tileGrafts = [];
      expect(tileGraftsTextureSuffix(tileset)).toBe("");
    });
  });
  describe("월드 해안 그룹 기억", () => {
    function worldTileset(): TilesetDef {
      store.replace(createBlankProject());
      const found = Object.values(store.getCurrent().tilesets).find((tileset) => worldCoastAutotileGroup(tileset));
      if (!found) throw new Error("월드 해안 그룹이 있는 번들 타일셋이 없습니다");
      return found;
    }

    it("편집기가 같은 그룹의 variantMap 을 제자리 대입하면 판정이 다시 계산된다", () => {
      const tileset = worldTileset();
      expect(worldCoastAutotileGroup(tileset)?.id).toBe(WORLD_COAST_GROUP_ID);
      setAutotileVariant(tileset.id, WORLD_COAST_GROUP_ID, 0, 999);
      expect(worldCoastAutotileGroup(store.getCurrent().tilesets[tileset.id]!)).toBeUndefined();
    });

    it("그룹 필드·이식을 제자리에서 바꾸면 판정이 다시 계산된다", () => {
      const tileset = structuredClone(worldTileset());
      const group = tileset.autotileGroups!.find((entry) => entry.id === WORLD_COAST_GROUP_ID)!;
      expect(worldCoastAutotileGroup(tileset)).toBe(group);
      const members = group.memberTileIds;
      group.memberTileIds = members.slice(1);
      expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
      group.memberTileIds = members;
      expect(worldCoastAutotileGroup(tileset)).toBe(group);
      group.neighborhood = 4;
      expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
      group.neighborhood = 8;
      expect(worldCoastAutotileGroup(tileset)).toBe(group);
      tileset.tileGrafts = [{ sourceChipset: "x", sourceTile: 0, targetTile: group.memberTileIds[0]! }];
      expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
    });

    it("그리기 한 번 안에서만 판정을 고정하고, 끝나면 다시 내용을 본다", () => {
      const tileset = structuredClone(worldTileset());
      const group = tileset.autotileGroups!.find((entry) => entry.id === WORLD_COAST_GROUP_ID)!;
      withWorldCoastRenderPass(() => {
        expect(worldCoastAutotileGroup(tileset)).toBe(group);
        expect(worldCoastAutotileGroup(tileset)).toBe(group);
      });
      group.variantMap["255"] = 3;
      expect(worldCoastAutotileGroup(tileset)).toBeUndefined();
      withWorldCoastRenderPass(() => expect(worldCoastAutotileGroup(tileset)).toBeUndefined());
    });
  });
  describe("mapWithCommittedEvents", () => {
    it("예전 구현(전체 복제 후 events 교체)과 같은 값·같은 키 순서를 낸다", () => {
      const project = createBlankProject();
      const map = createBlankMap("m", 12, 9, Object.keys(project.tilesets)[0]!);
      map.events = [
        { id: "a", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "showText", text: "hi" }], pages: [] },
        { id: "b", x: 2, y: 1, trigger: { kind: "action" }, commands: [], pages: [], draft: { kind: "new" } },
      ] as never;
      const legacy = structuredClone(map);
      legacy.events = committedEvents(map.events);
      const next = mapWithCommittedEvents(map);
      expect(JSON.stringify(next)).toBe(JSON.stringify(legacy));
      expect(next.lowerTiles).not.toBe(map.lowerTiles);
      expect(next.events[0]).not.toBe(map.events[0]);
    });
  });
  // ---- 캔버스·텍스처 가짜 ----
  class FakeImageData {
    readonly data: Uint8ClampedArray;
    constructor(readonly width: number, readonly height: number) { this.data = new Uint8ClampedArray(width * height * 4); }
  }
  class FakeCanvas {
    width = 0;
    height = 0;
    image: FakeImageData | null = null;
    getContext() {
      return {
        createImageData: (width: number, height: number) => new FakeImageData(width, height),
        putImageData: (image: FakeImageData) => { this.image = image; },
      };
    }
  }
  function fakeTextures() {
    const added = new Map<string, FakeCanvas>();
    const textures = {
      exists: (key: string) => added.has(key),
      addCanvas: (key: string, canvas: FakeCanvas) => { added.set(key, canvas); return { setFilter() {} }; },
    } as unknown as Phaser.Textures.TextureManager;
    return { textures, added };
  }
  function stubCanvas() {
    vi.stubGlobal("document", { createElement: () => new FakeCanvas() });
  }
  describe("안개 나눠 굽기", () => {
    it("줄 단위로 나눠 구워도 한 번에 구운 것과 같은 픽셀이다", () => {
      stubCanvas();
      const whole = fakeTextures();
      expect(ensureFogTexture(whole.textures, "fog")).toBe("fog");
      const split = fakeTextures();
      let pendingSteps = 0;
      while (ensureFogTexture(split.textures, "fog", 64) === null) pendingSteps += 1;
      expect(pendingSteps).toBe(3);
      expect(split.added.get("fog")!.image!.data).toEqual(whole.added.get("fog")!.image!.data);
    });
  });
  describe("구름 모양 나눠 굽기", () => {
    it("예산만큼만 굽고, 지금 보이는 장부터 굽고, 한 번에 구운 것과 같다", () => {
      stubCanvas();
      const { textures, added } = fakeTextures();
      expect(ensureCloudShapeTextures(textures, 2, { budget: 1, firstFrame: 5 })).toBe(false);
      expect([...added.keys()]).toEqual([cloudShapeTextureKey(5, 2)]);
      let calls = 1;
      for (;;) {
        calls += 1;
        if (ensureCloudShapeTextures(textures, 2, { budget: 1, firstFrame: 5 })) break;
      }
      expect(calls).toBe(CLOUD_SHAPE_FRAMES);
      expect(added.size).toBe(CLOUD_SHAPE_FRAMES);
      const whole = fakeTextures();
      expect(ensureCloudShapeTextures(whole.textures, 2)).toBe(true);
      for (let frame = 0; frame < CLOUD_SHAPE_FRAMES; frame += 1) {
        const key = cloudShapeTextureKey(frame, 2);
        expect(added.get(key)!.image!.data).toEqual(whole.added.get(key)!.image!.data);
      }
    });
  });
  // ---- 오디오 가짜 ----
  class FakeBuffer {
    readonly data: Float32Array[];
    constructor(channels: number, length: number, readonly sampleRate: number) {
      this.data = Array.from({ length: channels }, () => new Float32Array(length));
    }
    getChannelData(channel: number) { return this.data[channel]!; }
  }
  class FakeParam {
    value = 0;
    setTargetAtTime() {}
    cancelScheduledValues() {}
    setValueAtTime() {}
    linearRampToValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }
  class FakeNode { gain = new FakeParam(); frequency = new FakeParam(); type = ""; connect() {} disconnect() {} }
  class FakeSource extends FakeNode { buffer: unknown; loop = false; onended: unknown; start() {} stop() {} }
  function fakeAudioContext(rate: number, created: FakeBuffer[]) {
    return class {
      state = "running";
      currentTime = 0;
      destination = {};
      sampleRate = rate;
      createBuffer(channels: number, length: number, bufferRate: number) {
        const buffer = new FakeBuffer(channels, length, bufferRate);
        created.push(buffer);
        return buffer;
      }
      createGain() { return new FakeNode(); }
      createBiquadFilter() { return new FakeNode(); }
      createBufferSource() { return new FakeSource(); }
      resume() { return Promise.resolve(); }
      close() { return Promise.resolve(); }
    };
  }
  describe("분위기 소리 나눠 합성", () => {
    it("여러 update 에 나눠 합성한 버퍼가 예전 한 번 합성과 같은 표본이다", () => {
      const created: FakeBuffer[] = [];
      vi.stubGlobal("AudioContext", fakeAudioContext(44100, created));
      const audio = new AtmosphereAudio();
      const effects = [{ kind: "fireflies", amount: 1, volume: 0.5, sound: "fire" }] as never;
      const voices = () => (audio as unknown as { voices: Map<string, unknown> }).voices.size;
      let updates = 0;
      while (voices() === 0 && updates < 100) { audio.update(effects, true); updates += 1; }
      expect(voices()).toBe(1);
      expect(updates).toBeGreaterThan(1);
      const buffer = created[0]!;
      expect(buffer.data[0]!.length).toBe(22050 * 12);
      // 예전 구현(한 번에 합성)으로 뽑아 둔 표본 지문.
      let hash = 0;
      for (const channel of buffer.data) for (let i = 0; i < channel.length; i += 97) hash = (hash * 31 + Math.round(channel[i]! * 1e6)) | 0;
      expect(hash).toBe(375032406);
      audio.stop();
    });
  });
  describe("빗소리 잡음 버퍼 재사용", () => {
    it("비가 그쳤다 다시 와도 같은 표본율이면 잡음을 다시 합성하지 않는다", () => {
      const created: FakeBuffer[] = [];
      vi.stubGlobal("AudioContext", fakeAudioContext(12345, created));
      const weather = new WeatherAudio();
      weather.update({ kind: "rain", intensity: 0.6 }, 0, true);
      expect(created).toHaveLength(1);
      weather.update({ kind: "none", intensity: 0 }, 16, true);
      weather.update({ kind: "rain", intensity: 0.6 }, 32, true);
      expect(created).toHaveLength(1);
      weather.stop();
    });
  });
  describe("3차: 화면 밖 광원", () => {
    it("화면과 겹치지 않는 광원은 서명·그리기 대상에서 빠지고, 반경이 걸치면 남는다", () => {
      const params = lightingGradientParams(
        { ambient: 0.8, sources: [
          { id: "far", at: { x: 1000, y: 1000 }, radius: 3, intensity: 1, flicker: true },
          { id: "edge", at: { x: -2, y: 2 }, radius: 3, intensity: 1 },
          { id: "near", at: { x: 2, y: 2 }, radius: 1, intensity: 1 },
        ] },
        { viewportWidth: 320, viewportHeight: 240, tileSize: 16, cameraX: 0, cameraY: 0, zoom: 1, timeMs: 0,
          resolveAnchor: (anchor) => (anchor === "player" || "eventId" in anchor ? undefined : anchor) },
      );
      expect(params.gradients.map((entry) => entry.id)).toEqual(["edge", "near"]);
    });
  });
  describe("3차: 명령 이력 상한", () => {
    it("표현식 평가를 반복해도 이력은 상한에서 멈추고 가장 최근 것이 남는다", () => {
      const session = startSession(createBlankProject());
      const runtime = ensureM2Runtime(session);
      for (let index = 0; index < M2_HISTORY_LIMIT * 3; index += 1) {
        executeModernCommand(session, runtime, "Evaluate Expression", { expression: String(index), resultVariableId: "v" });
      }
      expect(runtime.expressions).toHaveLength(M2_HISTORY_LIMIT);
      expect(runtime.expressions.at(-1)?.expression).toBe(String(M2_HISTORY_LIMIT * 3 - 1));
      expect(session.variables.v).toBe(M2_HISTORY_LIMIT * 3 - 1);
    });

    it("상한 아래에서는 push 와 같다", () => {
      const list: number[] = [];
      for (let index = 0; index < 5; index += 1) pushM2History(list, index);
      expect(list).toEqual([0, 1, 2, 3, 4]);
    });
  });
  describe("3차: 생활 상태 파서", () => {
    it("항목을 제자리에 붙여도 예전 펼침과 같은 사전이고, __proto__ id 도 평범한 키다", () => {
      const shipping = JSON.parse('{"a":1,"__proto__":2,"b":0,"c":3}') as Record<string, number>;
      const parsed = parseLifeState({ shippingQueue: shipping });
      expect(Object.keys(parsed.shippingQueue!)).toEqual(["a", "__proto__", "c"]);
      expect(Object.getPrototypeOf(parsed.shippingQueue)).toBe(Object.prototype);
      expect(parsed.shippingQueue!["__proto__"]).toBe(2);
      expect(parsed.shippingQueue).not.toBe(shipping);
    });
  });
  describe("3차: 한 방향 턱과 성분 색인", () => {
    it("색인을 만든 뒤에도 턱을 정해진 방향으로 넘는 경로를 막지 않는다", () => {
      const project = createBlankProject();
      const tilesetId = Object.keys(project.tilesets)[0]!;
      const tileset = project.tilesets[tilesetId]!;
      const floor = TILE.GRASS;
      const ledge = floor === 1 ? 2 : 1;
      const wall = floor === 3 || ledge === 3 ? 4 : 3;
      const open = { up: true, down: true, left: true, right: true };
      tileset.passability[floor] = open;
      tileset.passability[ledge] = open;
      tileset.passability[wall] = { up: false, down: false, left: false, right: false };
      tileset.ledgeDirections = { [String(ledge)]: "left" };
      const map = createBlankMap("m", 4, 1, tilesetId);
      map.id = "m";
      map.lowerTiles = [floor, ledge, floor, wall];
      map.upperTiles = [-1, -1, -1, -1];
      project.maps[map.id] = map;
      expect(findChasePath(project, map, { x: 2, y: 0 }, { x: 0, y: 0 })).toHaveLength(2);
      armTerrainComponents(project, map);
      expect(terrainMayReach(project, map, 2, 0, 0, 0)).toBe(true);
      expect(findChasePath(project, map, { x: 2, y: 0 }, { x: 0, y: 0 })).toHaveLength(2);
      // 반대 방향은 정말 막혀 있다 — 탐색이 스스로 빈 경로를 낸다.
      expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(0);
      // 턱을 제자리에서 지우면 지문이 바뀌어 색인이 다시 만들어진다.
      tileset.ledgeDirections = {};
      expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(2);
    });
  });
  describe("3차: 막는 이벤트 판정기", () => {
    it("모든 칸에서 이벤트별 원본 질의와 같은 답을 낸다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      const pageOf = (id: string, priority: "same" | "below") => ({
        id, name: id, conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority,
        movement: { type: "fixed" as const, speed: 3, frequency: 3 }, commands: [],
      });
      map.events = [
        { id: "wall", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [pageOf("wall_p", "same")] },
        { id: "floor", x: 4, y: 3, trigger: { kind: "action" }, commands: [], pages: [pageOf("floor_p", "below")] },
        { id: "self", x: 5, y: 5, trigger: { kind: "action" }, commands: [], pages: [pageOf("self_p", "same")] },
        { id: "golem", x: 8, y: 8, trigger: { kind: "action" }, commands: [], pages: [{ ...pageOf("golem_p", "same"), footprint: { width: 3, height: 3 }, passRows: 1 }] },
      ] as never;
      const session = startSession(project);
      const positions = initialRuntimeEventPositions(map.events);
      const query = createBlockingEventQuery(project, map, session, positions, "self");
      for (let y = 0; y < 12; y += 1) {
        for (let x = 0; x < 12; x += 1) {
          const rect = footprintBounds(x, y, { width: 1, height: 1 });
          expect(query(rect), `${x},${y}`).toBe(!!findBlockingEventOverlappingRect(project, map, session, positions, rect, "self"));
        }
      }
    });
  });
  describe("3차: 전투 적 맞춤", () => {
    it("배율이 1 이하면 필드 크기를 읽지 않는다", () => {
      let reads = 0;
      const field = { get clientWidth() { reads += 1; return 320; }, get clientHeight() { reads += 1; return 160; } } as unknown as HTMLElement;
      const node = { dataset: { pixelEnemyCell: "96" }, style: { getPropertyValue: () => "1" } } as unknown as HTMLElement;
      expect(fitBattleEnemy(field, node, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
      expect(reads).toBe(0);
    });

    it("칸 128 이상 도트 시트는 배율 1 에서도 필드 크기를 잰다", () => {
      let reads = 0;
      const field = { get clientWidth() { reads += 1; return 0; }, get clientHeight() { reads += 1; return 0; } } as unknown as HTMLElement;
      const node = { dataset: { pixelEnemyCell: "128" }, style: { getPropertyValue: () => "1" } } as unknown as HTMLElement;
      expect(fitBattleEnemy(field, node, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
      expect(reads).toBeGreaterThan(0);
    });
  });
  describe("3차: 안개 프레임 예산", () => {
    it("같은 프레임의 두 번째 호출은 굽지 않는다", () => {
      stubCanvas();
      const shared = fakeTextures();
      const reference = fakeTextures();
      expect(ensureFogTexture(shared.textures, "fog", 64, 1)).toBeNull();
      expect(ensureFogTexture(shared.textures, "fog", 64, 1)).toBeNull();
      expect(ensureFogTexture(reference.textures, "fog", 64, 1)).toBeNull();
      // 둘 다 한 프레임에 64줄씩만 진행했으므로 같은 프레임 수에 끝난다.
      let frame = 2;
      while (ensureFogTexture(shared.textures, "fog", 64, frame) === null) {
        ensureFogTexture(shared.textures, "fog", 64, frame);
        expect(ensureFogTexture(reference.textures, "fog", 64, frame)).toBeNull();
        frame += 1;
      }
      expect(frame).toBe(4);
      expect(ensureFogTexture(reference.textures, "fog", 64, frame)).toBe("fog");
    });
  });
  describe("3차: 분위기 소리 합성 예산", () => {
    it("여러 소리가 한꺼번에 굽혀도 update 한 번의 합성 표본은 예산을 넘지 않는다", () => {
      const created: FakeBuffer[] = [];
      vi.stubGlobal("AudioContext", fakeAudioContext(44100, created));
      const audio = new AtmosphereAudio();
      const effects = [
        { kind: "fireflies", amount: 1, volume: 0.5, sound: "fire" },
        { kind: "fireflies", amount: 1, volume: 0.5, sound: "whisper" },
        { kind: "fireflies", amount: 1, volume: 0.5, sound: "breeze" },
      ] as never;
      const baking = () => (audio as unknown as { baking: Map<string, { channels: { index: number }[] }> }).baking;
      const progress = () => [...baking().values()].reduce((sum, bake) => sum + bake.channels.reduce((s, c) => s + c.index, 0), 0);
      audio.update(effects, true);
      expect(progress()).toBeLessThanOrEqual(100_000);
      expect(baking().size).toBe(1);
      audio.stop();
    });
  });
  describe("4차: 지형 성분 색인은 해시 충돌에 속지 않는다", () => {
    it("32비트 해시가 같던 두 통행 배열에서도 열린 길을 도달 불가로 막지 않는다", () => {
      // 무작위 퍼징 반례(시드 0xf1a62026). 예전 FNV 지문은 두 배열에 같은 값(1204537343)을 냈다.
      const before = [3, 14, 0, 3, 6, 11, 0, 1, 3];
      const after = [3, 3, 3, 15, 14, 7, 7, 8, 15];
      const flags = (n: number) => ({ up: !!(n & 1), down: !!(n & 2), left: !!(n & 4), right: !!(n & 8) });
      const tileset = { passability: before.map(flags), priority: Array(9).fill("lower") } as unknown as TilesetDef;
      const map = { id: "m", width: 3, height: 3, tilesetId: "t", lowerTiles: [0, 1, 2, 3, 4, 5, 6, 7, 8], upperTiles: Array(9).fill(-1) } as unknown as GameMap;
      const project = { maps: { m: map }, tilesets: { t: tileset } } as unknown as Project;
      armTerrainComponents(project, map);
      after.forEach((n, index) => Object.assign(tileset.passability[index]!, flags(n)));
      expect(terrainMayReach(project, map, 0, 0, 2, 2)).toBe(true);
      expect(findChasePath(project, map, { x: 0, y: 0 }, { x: 2, y: 2 }).length).toBeGreaterThan(0);
    });
  });
  describe("4차: 지형이 바뀌면 생활 NPC 는 남은 경로를 다시 짠다", () => {
    it("changeTile 로 길이 막히면 막힌 경로를 재사용하지 않고 우회한다", () => {
      const project = createBlankProject();
      const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
      project.tilesets.t = { ...base, id: "t", count: 2,
        passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
        priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
      const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
        movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 2, y: 0 }], repeat: false } } };
      const map = { ...createBlankMap("m", 3, 2, "t"), id: "m", lowerTiles: [0, 0, 0, 0, 0, 0], upperTiles: Array(6).fill(-1),
        events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
      project.maps = { m: map };
      project.startMapId = "m";
      store.replace(project);
      const live = store.getCurrent().maps.m!;
      const session = startSession(store.getCurrent());
      session.currentMapId = "m";
      const movers = new Map<string, { moves: unknown[]; step: number }>();
      const scene = {
        map: live, session, eventPositions: { npc: { x: 0, y: 0 } },
        pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
        autonomousNPCs: movers,
        getMapId: () => "m",
        registerAutonomousMover(id: string, moves: unknown[], repeat: boolean) {
          movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 } as never);
        },
      };
      registerPageMoveRoutes(scene as never);
      expect(movers.get("npc")?.moves).toEqual([{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }]);
      applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 1, y: 0, tile: 1 } as never);
      registerPageMoveRoutes(scene as never);
      expect(movers.get("npc")?.moves.map((move) => (move as { dir: string }).dir)).toEqual(["down", "right", "right", "up"]);
    });
  });
  describe("4차: 칸 격자 막힘 판정기", () => {
    it("무작위 몸 크기·위치에서 모든 질의 사각이 원본 질의와 같다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      let seed = 0x5eed4;
      const rand = () => { seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
      map.events = Array.from({ length: 40 }, (_, index) => ({
        id: "e" + index, x: Math.floor(rand() * 14) - 1, y: Math.floor(rand() * 14) - 1, trigger: { kind: "action" }, commands: [],
        pages: [{ id: "p" + index, name: "p", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: rand() < 0.7 ? "same" : "below",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
          footprint: { width: 1 + Math.floor(rand() * 4), height: 1 + Math.floor(rand() * 4) }, passRows: 1 + Math.floor(rand() * 3) }],
      })) as never;
      const session = startSession(project);
      const positions = initialRuntimeEventPositions(map.events);
      const query = createBlockingEventQuery(project, map, session, positions, "e3");
      for (let trial = 0; trial < 600; trial += 1) {
        const x = Math.floor(rand() * 16) - 2;
        const y = Math.floor(rand() * 16) - 2;
        const rect = footprintBounds(x, y, { width: 1 + Math.floor(rand() * 3), height: 1 + Math.floor(rand() * 3) });
        expect(query(rect), JSON.stringify(rect)).toBe(!!findBlockingEventOverlappingRect(project, map, session, positions, rect, "e3"));
      }
    });
  });
  describe("4차 리뷰 반례", () => {
    it("소수 좌표 이벤트도 칸 격자 판정기가 놓치지 않는다", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.events = [{ id: "half", x: 1.5, y: 1, trigger: { kind: "action" }, commands: [],
        pages: [{ id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [], footprint: { width: 2, height: 1 } }] }] as never;
      const session = startSession(project);
      const positions = initialRuntimeEventPositions(map.events);
      const query = createBlockingEventQuery(project, map, session, positions);
      for (const rect of [pointRect(2, 1), pointRect(1, 1), pointRect(3, 1), pointRect(2, 2)]) {
        expect(query(rect), JSON.stringify(rect)).toBe(!!findBlockingEventOverlappingRect(project, map, session, positions, rect));
      }
    });

    it("같은 길이의 우회로도 지형이 바뀐 뒤에는 새로 깐다", () => {
      const project = createBlankProject();
      const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
      project.tilesets.t = { ...base, id: "t", count: 2,
        passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
        priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
      const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
        movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 2, y: 2 }], repeat: false } } };
      const map = { ...createBlankMap("m", 3, 3, "t"), id: "m", lowerTiles: Array(9).fill(0), upperTiles: Array(9).fill(-1),
        events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
      project.maps = { m: map };
      project.startMapId = "m";
      store.replace(project);
      const session = startSession(store.getCurrent());
      session.currentMapId = "m";
      const movers = new Map<string, { moves: { dir: string }[] }>();
      const scene = {
        map: store.getCurrent().maps.m!, session, eventPositions: { npc: { x: 0, y: 0 } },
        pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
        autonomousNPCs: movers, getMapId: () => "m",
        registerAutonomousMover(id: string, moves: { dir: string }[], repeat: boolean) {
          movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 } as never);
        },
      };
      registerPageMoveRoutes(scene as never);
      const first = movers.get("npc")!.moves.map((move) => move.dir);
      expect(first).toEqual(["down", "down", "right", "right"]);
      applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 0, y: 1, tile: 1 } as never);
      registerPageMoveRoutes(scene as never);
      expect(movers.get("npc")!.moves.map((move) => move.dir)).toEqual(["right", "down", "down", "right"]);
    });

    it("맵 id 에 구분자가 있어도 연결 기억이 제자리 편집을 놓치지 않는다", () => {
      const connection = { id: "c", from: { mapId: "a|b", x: 1, y: 1 }, to: { mapId: "c", x: 0, y: 0, direction: "down" }, npcEnabled: true, playerEnabled: true };
      const connections = [connection] as never as MapConnection[];
      expect(firstConnectionToward(connections, "a|b", "c")?.first).toBe(connection);
      connection.from.mapId = "a";
      connection.to.mapId = "b|c";
      expect(firstConnectionToward(connections, "a", "b|c")?.first).toBe(connection);
      expect(firstConnectionToward(connections, "a|b", "c")).toBeNull();
    });
  });
  describe("4차 2차 리뷰 반례", () => {
    it("지형이 바뀌어 경로를 다시 짜도 진행 중인 걸음과 방향은 그대로다", () => {
      const project = createBlankProject();
      const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
      project.tilesets.t = { ...base, id: "t", count: 2,
        passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
        priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
      const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
        movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 4, y: 0 }], repeat: false } } };
      const map = { ...createBlankMap("m", 5, 2, "t"), id: "m", lowerTiles: Array(10).fill(0), upperTiles: Array(10).fill(-1),
        events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
      project.maps = { m: map };
      project.startMapId = "m";
      store.replace(project);
      const session = startSession(store.getCurrent());
      session.currentMapId = "m";
      const movers = new Map<string, Record<string, unknown>>();
      const scene = {
        map: store.getCurrent().maps.m!, session, eventPositions: { npc: { x: 0, y: 0 } },
        pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
        autonomousNPCs: movers, getMapId: () => "m",
        registerAutonomousMover(id: string, moves: unknown[], repeat: boolean) {
          movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 });
        },
      };
      registerPageMoveRoutes(scene as never);
      const mover = movers.get("npc")!;
      // 한 칸 걷는 중: 논리 위치는 이미 (1,0), 보간은 반쯤.
      const walking = { fromX: 0, fromY: 0, toX: 1, toY: 0, elapsedMs: 100, durationMs: 400 };
      mover.activeMove = walking;
      mover.facing = "right";
      mover.step = 1;
      mover.timer = 55;
      scene.eventPositions.npc = { x: 1, y: 0 };
      applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 3, y: 0, tile: 1 } as never);
      registerPageMoveRoutes(scene as never);
      const after = movers.get("npc")!;
      expect(after).toBe(mover);
      expect(after.activeMove).toBe(walking);
      expect(after.facing).toBe("right");
      expect(after.timer).toBe(55);
      expect(after.step).toBe(0);
      expect((after.moves as { dir: string }[]).map((move) => move.dir)).toEqual(["down", "right", "right", "right", "up"]);
    });
  });
  describe("5차: 단건 이벤트 조회 색인", () => {
    it("무작위 제자리 편집 뒤에도 패스 안팎에서 전체 순회의 첫 항목과 같고, 패스는 invalidate 뒤 새 배열을 본다", () => {
      const { project, map, session, positions } = (() => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const session = startSession(project);
        return { project, map, session, positions: {} as Record<string, { x: number; y: number }> };
      })();
      let seed = 0x5a5a;
      const rand = () => { seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; return seed / 4294967296; };
      const make = (id: string) => ({ id, x: Math.floor(rand() * 10), y: Math.floor(rand() * 10), trigger: { kind: "action" }, commands: [],
        pages: [{ id: id + "_p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }] }) as never as GameEvent;
      map.events = Array.from({ length: 12 }, (_, i) => make("e" + i));
      const ids = () => ["e0", "e3", "e7", "e11", "dup", "zz", "e5"];
      for (let step = 0; step < 400; step += 1) {
        const op = Math.floor(rand() * 5);
        if (op === 0) map.events.push(make(rand() < 0.3 ? "dup" : "e" + Math.floor(rand() * 14)));
        if (op === 1 && map.events.length > 1) map.events.splice(Math.floor(rand() * map.events.length), 1);
        if (op === 2 && map.events.length) map.events[Math.floor(rand() * map.events.length)] = make("e" + Math.floor(rand() * 14));
        if (op === 3 && map.events.length) (map.events[Math.floor(rand() * map.events.length)] as { id: string }).id = rand() < 0.5 ? "dup" : "e" + Math.floor(rand() * 14);
        for (const id of ids()) {
          const expected = runtimeEventViewsForMap(project, map, session, positions).find((view) => view.event.id === id);
          expect(runtimeEventViewById(project, map, session, positions, id)?.event, `step ${step} id ${id}`).toBe(expected?.event);
          // 패스 안에서도 같다(패스 동안에는 배열을 바꾸지 않는다).
          expect(withEventIdIndexPass(() => runtimeEventViewById(project, map, session, positions, id))?.event).toBe(expected?.event);
        }
      }
      withEventIdIndexPass(() => {
        const before = runtimeEventViewById(project, map, session, positions, "late");
        expect(before).toBeUndefined();
        map.events.unshift(make("late"));
        invalidateEventIdIndexPass();
        expect(runtimeEventViewById(project, map, session, positions, "late")?.event.id).toBe("late");
      });
    });
  });
  describe("5차: 병렬 이벤트 16단계 상한", () => {
    // dialogueHost 가 instanceof 로만 본다. 노드 환경에는 DOM 이 없다.
    afterEach(() => { vi.unstubAllGlobals(); });
    const parallelScene = (commands: unknown[]) => {
      vi.stubGlobal("HTMLElement", class {});
      const project = createBlankProject();
      project.commonEvents = [{ id: "burst", name: "Burst", trigger: "parallel", commands }] as never;
      store.replace(project);
      const session = startSession(store.getCurrent());
      session.commonEvents = store.getCurrent().commonEvents;
      const tiles: number[] = [];
      const scene = {
        map: store.getCurrent().maps[project.startMapId]!, session, eventPositions: {},
        parallelProcesses: new Map(), game: { registry: { get: () => undefined } },
        activeRuntimeEvents: () => [],
        applyChangeTileStep: (step: { x: number }) => { tiles.push(step.x); },
        refreshRuntimeSurfaces: () => undefined,
      };
      return { scene, tiles, session };
    };
    const tile = (x: number) => ({ kind: "changeTile", mapId: "", layer: "lower", x, y: 0, tile: 1 });

    it("한 프레임 상한에 걸린 17번째 명령을 다음 프레임에 실행한다", () => {
      const { scene, tiles, session } = parallelScene([...Array.from({ length: 17 }, (_, i) => tile(i)), { kind: "setSwitch", switchId: "sw_done", value: true }]);
      updateParallelEvents(scene as never, 16);
      expect(tiles).toHaveLength(16);
      updateParallelEvents(scene as never, 16);
      expect(tiles).toEqual(Array.from({ length: 17 }, (_, i) => i));
      expect(session.switches.sw_done).toBe(true);
    });

    it("상한 바로 뒤의 대기를 건너뛰지 않는다", () => {
      const { scene, tiles, session } = parallelScene([...Array.from({ length: 16 }, (_, i) => tile(i)), { kind: "wait", ms: 500 }, { kind: "setSwitch", switchId: "sw_done", value: true }]);
      updateParallelEvents(scene as never, 16);
      updateParallelEvents(scene as never, 16);
      expect(tiles).toHaveLength(16);
      expect(session.switches.sw_done).not.toBe(true);
      updateParallelEvents(scene as never, 600);
      expect(session.switches.sw_done).toBe(true);
    });
  });
  const blockedMidStep = () => {
    const project = createBlankProject();
    const base = project.tilesets[Object.keys(project.tilesets)[0]!]!;
    project.tilesets.t = { ...base, id: "t", count: 2,
      passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }],
      priority: ["lower", "lower"], ledgeDirections: undefined } as TilesetDef;
    const livingPage = { id: "p", name: "p", conditions: [], graphic: {}, trigger: { kind: "action" as const }, priority: "same" as const, commands: [],
      movement: { type: "living" as const, speed: 3, frequency: 3, living: { destinations: [{ mapId: "m", x: 2, y: 0 }], repeat: false } } };
    const map = { ...createBlankMap("m", 3, 1, "t"), id: "m", lowerTiles: Array(3).fill(0), upperTiles: Array(3).fill(-1),
      events: [{ id: "npc", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [livingPage] }] } as unknown as GameMap;
    project.maps = { m: map };
    project.startMapId = "m";
    store.replace(project);
    const session = startSession(store.getCurrent());
    session.currentMapId = "m";
    const movers = new Map<string, Record<string, unknown>>();
    const scene = {
      map: store.getCurrent().maps.m!, session, eventPositions: { npc: { x: 0, y: 0 } },
      pageMoveRouteKeys: new Set<string>(), pageMoveRouteEventIds: new Set<string>(), commandMoveRouteEventIds: new Set<string>(),
      autonomousNPCs: movers, getMapId: () => "m",
      registerAutonomousMover(id: string, moves: unknown[], repeat: boolean) {
        movers.set(id, { moves, repeat, step: 0, timer: 0, activeMove: null, facing: "down", animationEnabled: true, opacity: 255 });
      },
    };
    registerPageMoveRoutes(scene as never);
    const mover = movers.get("npc")!;
    const walking = { fromX: 0, fromY: 0, toX: 1, toY: 0, elapsedMs: 100, durationMs: 400 };
    mover.activeMove = walking;
    mover.step = 1;
    scene.eventPositions.npc = { x: 1, y: 0 };
    // 걷는 도중 목적지를 막고 표면을 다시 맞춘다.
    const block = () => {
      applyChangeTileStep(scene as never, { kind: "changeTile", mapId: "m", layer: "lower", x: 2, y: 0, tile: 1 } as never);
      registerPageMoveRoutes(scene as never);
    };
    return { scene, movers, mover, walking, block };
  };
  describe("5차: 걷는 중 길이 막힘", () => {
    it("걸음 도중 목적지가 막혀도 무버와 진행 중인 걸음을 지우지 않고 남은 걸음만 비운다", () => {
      const { scene, movers, mover, walking, block } = blockedMidStep();
      block();
      expect(movers.get("npc")).toBe(mover);
      expect(mover.activeMove).toBe(walking);
      expect(mover.moves).toEqual([]);
      expect(scene.pageMoveRouteEventIds.has("npc")).toBe(true);
      expect([...scene.pageMoveRouteKeys].some((key) => key.startsWith("living:npc:"))).toBe(true);
    });

    it("다른 페이지(추격 등)에서 넘어온 무버는 남기지 않는다", () => {
      // 추격 페이지의 키로 걷던 무버(페이지 전환 직후)를 흉내 낸다.
      const { scene, movers, mover, block } = blockedMidStep();
      scene.pageMoveRouteKeys.clear();
      scene.pageMoveRouteKeys.add("npc:p_chase");
      mover.strategy = "chase";
      block();
      expect(movers.has("npc")).toBe(false);
      expect(scene.pageMoveRouteEventIds.has("npc")).toBe(false);
    });
  });
  describe("5차: 조건 분기의 소셜 host 탐색", () => {
    it("호감도 조건은 중첩돼도 이벤트의 characterId 로 읽고, 다른 조건은 맵을 뒤지지 않는다", async () => {
      const { createInterpreter } = await import("@/player/interpreter");
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.events.push({ id: "npc", x: 1, y: 1, characterId: "char_mina", trigger: { kind: "action" }, commands: [], pages: [] } as never);
      const session = startSession(project);
      session.friendship = { char_mina: 5 };
      session.switches.gate = true;
      let mapScans = 0;
      const counted = { ...project, maps: new Proxy(project.maps, { ownKeys(target) { mapScans += 1; return Reflect.ownKeys(target); } }) };
      const fork = (condition: unknown) => ({ kind: "fork", condition, then: [{ kind: "setVariable", variableId: "hit", op: "+=", value: 1 }], else: [] });
      const run = (commands: unknown[]) => {
        session.variables.hit = 0;
        const interpreter = createInterpreter(commands as never, session, counted as never, { currentEventId: "npc" });
        let step = interpreter.start();
        for (let i = 0; i < 50 && step.kind !== "done"; i++) step = interpreter.resume(undefined);
        return session.variables.hit;
      };
      expect(run([fork({ kind: "not", condition: { kind: "all", conditions: [{ kind: "friendshipAtLeast", value: 5 }] } })])).toBe(0);
      expect(run([fork({ kind: "friendshipAtLeast", value: 5 })])).toBe(1);
      expect(run([fork({ kind: "friendshipAtLeast", value: 6 })])).toBe(0);
      const scansBefore = mapScans;
      expect(scansBefore).toBeGreaterThan(0);
      expect(run(Array.from({ length: 20 }, () => fork({ kind: "all", conditions: [{ kind: "switch", switchId: "gate", value: true }, { kind: "selfSwitch", key: "A", value: false }] })))).toBe(20);
      expect(mapScans).toBe(scansBefore);
    });
  });
});

// sengoku_edo 조수 연결(sengokuEdoPolicy) + 구성기 + 번들 배선 — 이 파일은 작성 시 실행하지 않았다(not run; 워크트리 에이전트는 vitest 금지).
describe("sengokuEdoPolicy", () => {
  isolateTimers();
  const create = declaredIntent({ mode: "create", space: "outdoor" });
  describe("낱말", () => {
    it.each(["전국시대 성하마을 만들어줘", "에도 시대 여관 거리", "사무라이 저택과 다실", "일본 전통 마을", "일본 신사 경내", "다이묘의 성", "feudal japan castle town"])("%s", (text) => {
      expect(describesSengoku(text)).toBe(true);
    });
    it.each(["여기에도 마을 만들어줘", "무사히 도착한 마을", "신사 숙녀 여러분", "일본 도시 번화가 거리", "조선 시대 한옥 마을", "편의점 있는 일본 주택가", "도쿄 지하철역", "무림 객잔"])("%s 는 아니다", (text) => {
      expect(describesSengoku(text)).toBe(false);
    });
    it("칩셋 이름", () => {
      expect(namesSengokuTileset("sengoku_edo 로 맵 만들어줘")).toBe(true);
      expect(namesSengokuTileset("성하마을 만들어줘")).toBe(false);
    });
    it("용도 고르기", () => {
      expect(sengokuStyleFor("전국시대 성하마을")).toBe("castle_town");
      expect(sengokuStyleFor("에도 시대 여관 거리")).toBe("inn_street");
      expect(sengokuStyleFor("사무라이 저택과 다실")).toBe("samurai");
      expect(sengokuStyleFor("일본 신사와 절")).toBe("temple");
      expect(sengokuStyleFor("에도 시대 농촌 논")).toBe("village");
      expect(sengokuStyleFor("천수각이 있는 성")).toBe("castle");
    });
  });
  describe("대상", () => {
    it("새 프로젝트는 칩셋을 가진다", () => {
      expect(hasSengokuTileset(createBlankProject())).toBe(true);
    });
    it("시대 낱말 + 생성 → 야외 대상(용도 포함)", () => {
      const p = createBlankProject();
      const t = sengokuTargetFor(p, create, "에도 시대 여관 거리", p.startMapId, false);
      expect(t?.style).toBe("inn_street");
      expect(formatSengokuNote(t!, null)).toContain("compose_sengoku_edo_map");
    });
    it("현대 일본 거리는 잡지 않는다", () => {
      const p = createBlankProject();
      expect(sengokuTargetFor(p, create, "일본 도시 번화가 거리 만들어 줘", p.startMapId, false)).toBeNull();
    });
    it("프롬프트 줄·노출 도구", () => {
      const p = createBlankProject();
      expect(sengokuPromptLines(p, [p.startMapId]).join("\n")).toContain("sengoku_edo");
      const names = new Set(TOOL_REGISTRY.map((t) => t.name));
      for (const n of SENGOKU_EXPOSED_TOOLS) expect(names.has(n), n).toBe(true);
      expect(Object.values(SENGOKU_CONCEPT_HINT)).toContain(SENGOKU_TILESET_ID);
      expect(BUILDABLE_CONCEPT_TILESETS).toContain(SENGOKU_TILESET_ID);
    });
  });
  describe("구성기", () => {
    const pal = sengokuPaletteFromTileset(createSengokuEdoTileset());
    it.each(SENGOKU_STYLES)("%s 기본 크기에서 건물·시작 칸을 낸다", (style) => {
      const { w, h } = SENGOKU_DEFAULT_SIZE[style];
      for (const seed of [0, 1, 2]) {
        const r = composeSengokuEdo({ width: w, height: h, style, seed }, pal);
        expect(r.buildings.length).toBeGreaterThan(0);
        expect(r.lower.length).toBe(w * h);
        expect(r.start.x).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// sky_island 이야기 기물 1종(si-seal-altar, 시트 691~694): 새 사본이 킷·참고문서를 갖고 칸 표가 선언(막힘·★)과 같은지,
// 시트 칸이 원본 그림과 한 화소도 다르지 않은지, 조수가 게임이 바란 낱말로 그 킷에 닿는지(낱말 목록이 아니라 킷 이름·태그로), 실제 놓기 도구로 놓이는지.
// 이식 칸이 있는 옛 사본은 test/themeBundleLocalTail.test.ts 가 본다.
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기 scripts/content/sky-island/bake_si.py, 목록 tiledata/sky-island/objects/spec.json).
describe("skyIslandStoryObjects", () => {
  isolateTimers();
  type Item = { id: string; src: string; w: number; h: number; place: string; block: number[][]; words: string[] };
  const ITEMS = spec.items as Item[];
  const kitId = (id: string) => `si-${id}`;
  const IDS = new Set(ITEMS.map((item) => kitId(item.id)));
  const own = (kits: readonly StructureKitDef[] | undefined) => (kits ?? []).filter((kit) => IDS.has(kit.id));
  const FIRST = 691;   // 이 묶음이 덧붙기 전 시트 끝

  describe("sky_island 이야기 기물", () => {
    it("새 사본은 킷과 참고문서를 갖고, 칸 표가 선언과 같다(막힌 칸·★ 칸)", () => {
      const ts = createSkyIslandTileset();
      const kits = own(ts.structureKits);
      expect(kits.map((kit) => kit.id)).toEqual(ITEMS.map((item) => kitId(item.id)));
      let next = FIRST;
      for (const item of ITEMS) {
        const kit = kits.find((k) => k.id === kitId(item.id))!;
        expect([kit.width, kit.height]).toEqual([item.w, item.h]);
        expect(kit.ai?.description).toContain("3/4 관문 미통과 — 오너 면제");
        expect(kit.ai?.tags).toEqual(expect.arrayContaining([...item.words, item.place]));
        kit.rows.forEach((row, y) => (row.upperTiles ?? []).forEach((tile, x) => {
          expect(tile).toBe(next++); // 덧붙이기 전용 — 목록 순서대로 691 부터
          const blocked = item.block.some(([bx, by]) => bx === x && by === y);
          expect(ts.passability[tile]!.up).toBe(!blocked);
          expect(ts.priority[tile]).toBe(item.place === "decal" ? "lower" : "upper");
        }));
      }
      expect(next).toBe(ts.count);
      expect((ts.referenceDocuments ?? []).some((category) => category.documents.some((doc) => doc.id === "si-objects"))).toBe(true);
    });

    it("시트 칸은 원본 그림과 한 화소도 다르지 않다(면제는 그림 화소에 묶인다)", () => {
      const read = (file: string) => PNG.sync.read(fs.readFileSync(path.resolve(__dirname, "..", file)));
      const sheet = read("public/assets/sky-island/sky-island-chipset.png");
      const ts = createSkyIslandTileset();
      for (const item of ITEMS) {
        const piece = read(`tiledata/sky-island/objects/pieces/${item.src}`);
        expect([piece.width, piece.height]).toEqual([item.w * 16, item.h * 16]);
        const kit = own(ts.structureKits).find((k) => k.id === kitId(item.id))!;
        kit.rows.forEach((row, cy) => (row.upperTiles ?? []).forEach((tile, cx) => {
          const sx = (tile % ts.tilesPerRow) * 16, sy = Math.floor(tile / ts.tilesPerRow) * 16;
          for (let y = 0; y < 16; y += 1) {
            const a = ((sy + y) * sheet.width + sx) * 4, b = ((cy * 16 + y) * piece.width + cx * 16) * 4;
            expect(Buffer.compare(sheet.data.subarray(a, a + 64), piece.data.subarray(b, b + 64))).toBe(0);
          }
        }));
      }
    });

    it("게임이 바란 낱말이 그 킷을 짚는다 — «제단» 은 같은 태그의 실내 신전 제단(si-altar) 다음", () => {
      const project = createBlankProject() as Project;
      const ts = project.tilesets[SKY_ISLAND_ID]!;
      for (const [id, words] of Object.entries(ask.items)) for (const word of words) {
        const found = existingMatches(project, ts, word).map((row) => row.id);
        if (word === "제단") expect(found.slice(0, 2)).toEqual(["si-altar", kitId(id)]);
        else expect([word, found[0]]).toEqual([word, kitId(id)]);
      }
    });

    it("실제 놓기 도구로 놓으면 아랫줄만 막힌다", () => {
      const ctx = { project: createBlankProject() as Project, currentMapId: "isle", assistantRun: true };
      expect(runTool(ctx, "create_map", { id: "isle", name: "섬 마당", width: 20, height: 15, tilesetId: SKY_ISLAND_ID }).ok).toBe(true);
      expect(runTool(ctx, "stamp_tileset_object", { mapId: "isle", objectId: kitId("seal-altar"), base: { x: 3, y: 6 } }).ok).toBe(true);
      const walk = (x: number, y: number) => isPassable(ctx.project, ctx.project.maps.isle!, x, y);
      // 봉인 제단 2×2: 아랫줄(앞면) 두 칸 막힘, 윗줄(윗판)은 사람 위에 그려지는 걸음 칸
      expect([walk(3, 6), walk(4, 6)]).toEqual([false, false]);
      expect([walk(3, 5), walk(4, 5), walk(3, 7), walk(2, 6), walk(5, 6)]).toEqual([true, true, true, true, true]);
    });
  });
});

describe("starterDoorTransfer", () => {
  isolateTimers();
  describe("starter door transfer defaults", () => {
    it("builds a starter house door and matching interior transfer", () => {
      // Given: a starter village and its paired interior map are built from the transfer helpers.
      const starter = createStarterMap();
      addStarterHouseDoor(starter);
      const interior = createStarterHouseInteriorMap(starter.id);

      // When: the generated transfer events are inspected.
      const door = starter.events.find((event) => event.id === "event_starter_house_door");
      const doorPage = door?.pages?.[0];
      const transfer = doorPage?.commands.find((command) => command.kind === "transfer");
      const exit = interior.events.find((event) => event.id === "event_starter_house_exit");
      const exitPage = exit?.pages?.[0];
      const exitTransfer = exitPage?.commands.find((command) => command.kind === "transfer");
      const slime = interior.events.find((event) => event.id === STARTER_HOUSE_SLIME_EVENT_ID);
      const slimePage = slime?.pages?.[0];
      const slimeBattle = slimePage?.commands.find((command) => command.kind === "battleProcessing");

      // Then: player-touch transfers connect the exterior door and interior exit.
      expect(interior.name).toBe("시작 집 내부");
      expect(interior.width).toBeGreaterThanOrEqual(20);
      expect(interior.height).toBeGreaterThanOrEqual(15);
      expect(door).toMatchObject({
        x: 7,
        y: 10,
        trigger: { kind: "playerTouch" },
      });
      expect(doorPage).toMatchObject({
        id: "event_starter_house_door_page",
        priority: "below",
        trigger: { kind: "playerTouch" },
      });
      expect(transfer).toEqual({ kind: "transfer", mapId: "map_starter_house_interior", x: 4, y: 6, fade: "black" });
      expect(exit).toMatchObject({
        x: 4,
        y: 7,
        trigger: { kind: "playerTouch" },
      });
      expect(exitTransfer).toEqual({ kind: "transfer", mapId: starter.id, x: 7, y: 11, fade: "black" });
      // And: an indoor yard slime is ready for quick battle tests.
      expect(slime).toMatchObject({
        x: STARTER_HOUSE_SLIME_POS.x,
        y: STARTER_HOUSE_SLIME_POS.y,
        trigger: { kind: "eventTouch" },
      });
      expect(slimePage?.graphic?.sprite).toEqual({ type: "bundled", id: "tex_easyrpg_charset_monster1" });
      expect(slimeBattle).toEqual({
        kind: "battleProcessing",
        troopId: DEFAULT_TROOP_ID,
        canEscape: true,
        canLose: true,
      });
    });
  });
});

// poke-depth PR2: 맹독(차례마다 커지는 독)·혼란(휘발 상태). 작성만 했고 실행하지 않았다(워크트리 규칙).
describe("statusConditions", () => {
  isolateTimers();
  const records = [
    { id: "state_toxic", gen1MajorStatus: "toxic" as const },
    { id: "state_poison", gen1MajorStatus: "poison" as const },
    { id: "state_confusion", volatileStatus: "confusion" as const },
  ];
  describe("toxic", () => {
    it("counter climbs by one each turn and stops at 15", () => {
      expect(gen1NextToxicCounter(undefined)).toBe(1);
      expect(gen1NextToxicCounter(0)).toBe(1);
      expect(gen1NextToxicCounter(7)).toBe(8);
      expect(gen1NextToxicCounter(15)).toBe(15);
    });
    it("residual damage is 1/16 times the counter, plain poison stays fixed", () => {
      expect(applyGen1PostActionResidual({ kind: "toxic", maxHp: 160, currentHp: 160, toxicCounter: 3 }).damage).toBe(30);
      expect(applyGen1PostActionResidual({ kind: "toxic", maxHp: 160, currentHp: 160 }).damage).toBe(10);
      expect(applyGen1PostActionResidual({ kind: "poison", maxHp: 160, currentHp: 160, toxicCounter: 9 }).damage).toBe(10);
    });
    it("is a major status: blocked by an existing one and by poison/steel types", () => {
      const applied = applyGen1MajorStatus({ stateIds: ["state_poison"], stateTurns: {}, stateRecords: records, incomingStateId: "state_toxic" }, () => 255);
      expect(applied.applied).toBe(false);
      expect(gen1MajorStatusBlockedByType("toxic", "normal", ["poison"], "status")).toBe(true);
      expect(gen1MajorStatusBlockedByType("toxic", "normal", ["steel"], "status")).toBe(true);
      expect(gen1MajorStatusBlockedByType("toxic", "normal", ["normal"], "status")).toBe(false);
    });
  });
  describe("confusion", () => {
    it("lasts 2-5 actions", () => {
      for (let byte = 0; byte < 256; byte++) {
        const turns = gen1ConfusionTurns(() => byte);
        expect(turns).toBeGreaterThanOrEqual(2);
        expect(turns).toBeLessThanOrEqual(5);
      }
    });
    it("snaps out when the counter reaches zero, otherwise half hit themselves", () => {
      expect(stepGen1Confusion(1, () => 0).outcome).toBe("snappedOut");
      expect(stepGen1Confusion(3, () => 10)).toMatchObject({ outcome: "selfHit", turnsLeft: 2 });
      expect(stepGen1Confusion(3, () => 200)).toMatchObject({ outcome: "acts", turnsLeft: 2 });
    });
    it("does not count as a major status", () => {
      expect(readGen1MajorStatus(["state_confusion"], {}, records)).toBeUndefined();
    });
    it("self damage is a typeless power-40 hit and at least 1", () => {
      expect(gen1ConfusionSelfDamage(50, 100, 100)).toBe(Math.floor(Math.floor(22 * 40 * 100 / 100) / 50) + 2);
      expect(gen1ConfusionSelfDamage(1, 1, 999)).toBeGreaterThanOrEqual(1);
    });
  });
  describe("state record normalization", () => {
    it("keeps the new enum fields and leaves records without them byte-identical", () => {
      expect(normalizeStateRecord({ id: "a", name: "a", volatileStatus: "confusion" }).volatileStatus).toBe("confusion");
      expect(normalizeStateRecord({ id: "a", name: "a", gen1MajorStatus: "toxic" }).gen1MajorStatus).toBe("toxic");
      expect("volatileStatus" in normalizeStateRecord({ id: "a", name: "a" })).toBe(false);
      expect("volatileStatus" in normalizeStateRecord({ id: "a", name: "a", volatileStatus: "bogus" as never })).toBe(false);
    });
  });
  describe("gen1 runtime", () => {
    const prng = (seed: number) => { let sd = seed >>> 0; return () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return ((sd >>> 8) & 0xffff) / 65536; }; };
    const SP = scarloxySpeciesId("sparchu");
    function build(seed: number) {
      const project: any = structuredClone(createScarloxyPokemonDemoProject());
      const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
      project.database.monsterSpecies.find((r: any) => r.id === enemy.speciesId).types = ["normal"];
      enemy.stats = { ...enemy.stats, maxHp: 400, attack: 40, defense: 40, mind: 40, agility: 1 };
      enemy.actions = [{ skillId: "skill_scarloxy_scratch", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
      const skill = (id: string, stateId: string, scope: "enemy" | "self" = "enemy") => normalizeSkillRecord({ id, name: id, scope, power: 0, animationId: "anim_magic", description: "x", type: "normal", mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100, effect: { kind: "support" }, maxPp: 30, stateEffects: stateId ? [{ stateId, chance: 100, operation: "add" }] : [] } as any);
      project.database.skills.push(skill("pd_toxic", "state_toxic"), skill("pd_wait", "", "self"));
      const mon = { instanceId: "m1", speciesId: SP, level: 50, exp: 0, skillIds: ["pd_toxic", "pd_wait"], skillPp: { pd_toxic: 30, pd_wait: 30 }, friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 } };
      return createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon], sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(seed) } as any) as any;
    }
    it("toxic damage grows by 1/16 each turn", () => {
      const rt = build(7);
      const ticks: number[] = [];
      const take = (entries: any[]) => entries.filter((e) => e.kind === "stateUpkeep" && e.side === "enemy").forEach((e) => ticks.push(e.amount));
      const cast = (id: string) => { const n = rt.snapshot().timeline.length; rt.performActorCommand({ kind: "skill", skillId: id, targetEnemyId: "enemy-1", ...(id === "pd_wait" ? { targetActorId: "m1" } : {}) }); return rt.snapshot().timeline.slice(n); };
      take(cast("pd_toxic"));
      for (let i = 0; i < 3; i++) take(cast("pd_wait"));
      const unit = Math.floor(rt.snapshot().enemies[0].maxHp / 16);
      expect(ticks.slice(0, 4)).toEqual([unit, unit * 2, unit * 3, unit * 4]);
    });
  });
});
