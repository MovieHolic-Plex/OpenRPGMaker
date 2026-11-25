import { afterEach, describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { createBlankMap, createBlankProject, COMBINED_TOWN_TILESET_ID } from "@/project/defaults";
import { store } from "@/project/store";
import { tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { WORLD_COAST_GROUP_ID, withWorldCoastRenderPass, worldCoastAutotileGroup, createWorldCoastAutotileGroup, hasWorldCoastMapping, isWorldAnimatedTile, seedWorldCoastMapping, WORLD_SEA_TILES, WORLD_SNOW_SHORE_TILES, WORLD_WATER_TILES } from "@/project/defaults/worldCoastMapping";
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
import { startSession, evalCondition } from "@/project/session";
import { createBlockingEventQuery, findBlockingEventOverlappingRect, initialRuntimeEventPositions, invalidateEventIdIndexPass, runtimeEventViewById, runtimeEventViewsForMap, withEventIdIndexPass } from "@/project/runtimeEventState";
import { footprintBounds, pointRect } from "@/project/footprint";
import { TILE } from "@/project/defaults/constants";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { applyChangeTileStep } from "@/player/playSceneMapCommands";
import { firstConnectionToward } from "@/player/npcLivingTravel";
import type { GameEvent, GameMap, MapConnection, Project, TileGraft, TilesetDef, MonsterInstance, ActorParameterKey, Condition, AutotileGroup } from "@/project/types";
import { updateParallelEvents } from "@/player/playSceneSchedulers";
import { SENGOKU_CONCEPT_HINT, SENGOKU_EXPOSED_TOOLS, SENGOKU_TILESET_ID, describesSengoku, formatSengokuNote, hasSengokuTileset, namesSengokuTileset, sengokuPromptLines, sengokuStyleFor, sengokuTargetFor } from "@/ai/sengokuEdoPolicy";
import { BUILDABLE_CONCEPT_TILESETS } from "@/concepts/format";
import { composeSengokuEdo, sengokuPaletteFromTileset, SENGOKU_DEFAULT_SIZE, SENGOKU_STYLES } from "@/project/sengokuEdoComposer";
import { createSengokuEdoTileset } from "@/project/defaults/sengokuEdo";
import { TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
import { declaredIntent } from "./intentFixture";
import { createBattleRuntime } from "@/battle/runtime";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { resolveGen1DamagingMove } from "@/battle/gen1/damage";
import { gen1CaptureProbability } from "@/battle/gen1/capture";
import { gen1TypeModifiersForTypes } from "@/battle/typeChart";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { giveMonster, monsterMaxHp } from "@/project/monsterCollection";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { badgeContext, currentObedienceCap, defaultObedienceCaps, earnedBadgeCount, linearObedienceCaps, obedienceLevelCapFor, obedienceRefusalLine } from "@/project/badgeProgress";
import { partySkillContext } from "@/project/partySkills";
import { deserialize, serialize } from "@/project/io";
import { validateMonsterCampaign } from "@/project/io/shapeMonsterCampaign";
import { resolveEventPage } from "@/project/io/pageResolution";
import type { MonsterCampaignConfig } from "@/project/types/database";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { applyStatStage, compactStatStages, shiftStatStage, statStageMessage, statStageMultiplier } from "@/battle/statStages";
import { applyGen1MajorStatus, applyGen1PostActionResidual, gen1ConfusionSelfDamage, gen1ConfusionTurns, gen1MajorStatusBlockedByType, gen1NextToxicCounter, readGen1MajorStatus, stepGen1Confusion } from "@/battle/gen1/status";
import { supportsChipsetQuarterComposition } from "@/editor/tilesetImage";
import { dungeonTerrainQuarterKits } from "@/project/defaults/dungeonTerrainQuarter";
import { chipsetQuarterComposition, isTerrainQuarterTile, terrainQuarterSources, type TerrainQuarter } from "@/project/defaults/terrainQuarterAutotile";
import { withRetiredEasyRpgTilesets, retiredEasyRpgTileset } from "./support/retiredEasyRpgTilesets";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { createInteriorWallFrameAutotileGroup, ensureTilesetHarnesses, INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID, applyCombinedTownHarness, COMBINED_TOWN_HARNESS_GROUPS, DUNGEON_HARNESS_PREFIX, harnessLayerForTile, INTERIOR_HARNESS_PREFIX, isHarnessStackableTile } from "@/project/tilesetHarness";
import { runInteriorRoomPipeline } from "@/editor/interiorRoomPipeline";
import { DARK_WALL_QUARTER_SOURCE, DARK_WALL_TILE } from "@/project/defaults/darkWallAutotile";
import { DIRT_ROAD_TILE, SAND_TILE, CHIPSET_TILE_GROUPS } from "@/project/defaults/chipsetMapping";
import { defaultTilesets, ensureBundledTilesets, combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness/themePacks";
import { isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { createWorldTerrainAutotileGroups, seedWorldTerrainAutotiles, worldTerrainQuarterKit } from "@/project/defaults/worldTerrainAutotiles";
import { isPassable } from "@/project/collision";
import { backgroundlessLowerReviews, DEFAULT_TRUNK_BACKING_TILE, tileBackingTile, tileLayerPolicy } from "@/editor/tileLayerPolicy";
import { setTileBackingOverride, setTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { summarizeTileUsage, summarizeTilesetGenerationReadiness } from "@/project/tilesetSemanticChecker";
import { roleCapabilities } from "@/project/tileRoles";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { isolateTimers } from "./mergedTeardown";

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

describe("statStages", () => {
  isolateTimers();
  describe("gen1RuntimeExactIntegration", () => {
    isolateTimers();
    const BYTE_255 = 255 / 256;
    function sequence(values: readonly number[], fallback = BYTE_255): () => number {
      let index = 0;
      return () => values[index++] ?? fallback;
    }
    function monster(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
      return {
        instanceId: "monster-runtime-exact",
        speciesId: scarloxySpeciesId("sparchu"),
        level: 50,
        exp: 0,
        skillIds: ["skill_scarloxy_quick"],
        skillPp: { skill_scarloxy_quick: 1 },
        friendship: 70,
        caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 },
        ...overrides,
      };
    }
    function exactBattle(options: {
      readonly partyMonster?: MonsterInstance;
      readonly partyMonsters?: readonly MonsterInstance[];
      readonly rng?: () => number;
      readonly inventory?: Readonly<Record<string, number>>;
      readonly configure?: (project: ReturnType<typeof createScarloxyPokemonDemoProject>) => void;
    } = {}) {
      const project = createScarloxyPokemonDemoProject();
      const enemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea");
      if (!enemy) throw new Error("missing exact-runtime enemy");
      enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, defense: 100, mind: 100, agility: 1 };
      enemy.actions = [{
        skillId: "skill_scarloxy_scratch",
        priority: 5,
        condition: { kind: "always" },
        switchOnAfterAction: { enabled: false },
        switchOffAfterAction: { enabled: false },
      }];
      options.configure?.(project);
      const partyMonster = options.partyMonster ?? monster();
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        partyMonsters: options.partyMonsters ?? [partyMonster],
        sessionState: { switches: {}, variables: {}, inventory: options.inventory ?? {} },
        rng: options.rng ?? sequence([BYTE_255, BYTE_255, 0]),
      });
      return { project, runtime, partyMonster };
    }
    describe("Gen1 exact engines are wired into the battle runtime", () => {
      it("uses cartridge damage order and consumes exactly one PP", () => {
        const { project, runtime } = exactBattle();
        const before = runtime.snapshot();
        const actor = before.actors[0]!;
        const enemy = before.enemies[0]!;
        const species = project.database.monsterSpecies?.find((record) => record.id === actor.speciesId)!;
        const modifiers = project.system.typeChart!;
        const normalRow = modifiers.multipliers.normal ?? {};
        const targetTypes = project.database.monsterSpecies?.find((record) => record.id === enemy.speciesId)?.types ?? [];
        const expected = resolveGen1DamagingMove({
          level: actor.level ?? 1,
          power: project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!.power,
          damageClass: "physical",
          baseSpeed: species.baseStats.agility,
          criticalRate: "normal",
          offense: { unmodified: actor.effectiveStats!.attack, modified: actor.effectiveStats!.attack },
          defense: { unmodified: enemy.effectiveStats!.defense, modified: enemy.effectiveStats!.defense },
          burned: false,
          stab: species.types?.includes("normal") ?? false,
          typeFactors: targetTypes.map((type) => Math.round((normalRow[type] ?? 1) * 10)),
          baseAccuracyByte: 255,
        }, sequence([255, 255, 0]));

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        const after = runtime.snapshot();
        const actorHit = after.timeline.find((entry) => entry.side === "actor" && entry.kind === "damage");

        expect(actorHit).toMatchObject({ hit: true, amount: expected.damage, critical: expected.critical });
        expect(after.actors[0]?.skillPp?.skill_scarloxy_quick).toBe(0);
      });

      it("keeps the cartridge 1/256 miss on an authored 100% move", () => {
        const { runtime } = exactBattle({ rng: sequence([BYTE_255, BYTE_255, BYTE_255]) });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        const miss = runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "miss");

        expect(miss).toMatchObject({ hit: false, amount: 0 });
        expect(runtime.snapshot().actors[0]?.skillPp?.skill_scarloxy_quick).toBe(0);
      });

      it("uses the element damage class even when the authored statistic says attack", () => {
        const { project, runtime } = exactBattle({
          rng: sequence([BYTE_255, BYTE_255, 0]),
          configure: (configured) => {
            const skill = configured.database.skills.find((record) => record.id === "skill_scarloxy_quick")!;
            skill.elementId = "psychic";
            skill.effect = { kind: "damage", statistic: "attack", affects: "hp" };
            const enemy = configured.database.enemies.find((record) => record.id === "enemy_pkmn_larvea")!;
            enemy.stats = { ...enemy.stats, defense: 1, mind: 100 };
          },
        });
        const before = runtime.snapshot();
        const actor = before.actors[0]!;
        const enemy = before.enemies[0]!;
        const modifiers = gen1TypeModifiersForTypes(
          project,
          "psychic",
          project.database.monsterSpecies?.find((record) => record.id === actor.speciesId)?.types ?? [],
          project.database.monsterSpecies?.find((record) => record.id === enemy.speciesId)?.types ?? [],
        );
        const expected = resolveGen1DamagingMove({
          level: actor.level ?? 1,
          power: project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!.power,
          damageClass: "special",
          baseSpeed: project.database.monsterSpecies?.find((record) => record.id === actor.speciesId)!.baseStats.agility ?? actor.effectiveStats!.agility,
          criticalRate: "normal",
          offense: { unmodified: actor.effectiveStats!.mind, modified: actor.effectiveStats!.mind },
          defense: { unmodified: enemy.effectiveStats!.mind, modified: enemy.effectiveStats!.mind },
          burned: false,
          stab: modifiers.stab,
          typeFactors: modifiers.typeFactors,
          baseAccuracyByte: 255,
        }, sequence([255, 255, 0]));

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        const hit = runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "damage");

        expect(hit?.amount).toBe(expected.damage);
      });

      it("lets a sleeping battler choose a move, loses the wake-up turn, and keeps its PP", () => {
        const { runtime } = exactBattle({
          partyMonster: monster({ stateIds: ["state_sleep"], stateTurns: { state_sleep: 1 } }),
          rng: sequence([]),
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();

        expect(snapshot.actors[0]?.stateIds).not.toContain("state_sleep");
        expect(snapshot.actors[0]?.skillPp?.skill_scarloxy_quick).toBe(1);
        expect(snapshot.timeline.some((entry) => entry.kind === "incapacitated" && entry.side === "actor")).toBe(true);
      });

      it("applies poison residual after the attempted move and allows it to faint the user", () => {
        const { runtime } = exactBattle({
          partyMonster: monster({ currentHp: 1, stateIds: ["state_poison"] }),
          rng: sequence([BYTE_255, BYTE_255, 0]),
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();

        expect(snapshot.timeline.some((entry) => entry.kind === "stateUpkeep" && entry.side === "actor" && entry.amount === 4)).toBe(true);
        expect(snapshot.actors[0]?.hp).toBe(0);
        expect(snapshot.result).toBe("defeat");
      });

      it("still applies poison residual after defend, a failed escape, or a potion", () => {
        const poisoned = monster({ currentHp: 1, stateIds: ["state_poison"] });
        const defend = exactBattle({ partyMonster: poisoned, rng: sequence([BYTE_255]) });
        defend.runtime.performActorCommand({ kind: "defend" });
        const defended = defend.runtime.snapshot();
        expect(defended.timeline.some((entry) => entry.kind === "stateUpkeep" && entry.side === "actor" && entry.amount === 4)).toBe(true);
        expect(defended.actors[0]?.hp).toBe(0);
        expect(defended.result).toBe("defeat");

        const escaped = exactBattle({ partyMonster: poisoned, rng: sequence([BYTE_255]) });
        escaped.runtime.performActorCommand({ kind: "escape" });
        const failedEscape = escaped.runtime.snapshot();
        expect(failedEscape.timeline.some((entry) => entry.kind === "action" && entry.commandKind === "escape" && entry.success === false)).toBe(true);
        expect(failedEscape.timeline.some((entry) => entry.kind === "stateUpkeep" && entry.side === "actor" && entry.amount === 4)).toBe(true);
        expect(failedEscape.result).toBe("defeat");

        const fled = exactBattle({ partyMonster: poisoned, rng: sequence([0]) });
        fled.runtime.performActorCommand({ kind: "escape" });
        const fledSnapshot = fled.runtime.snapshot();
        expect(fledSnapshot.result).toBe("escape");
        expect(fledSnapshot.actors[0]?.hp).toBe(1);
        expect(fledSnapshot.timeline.some((entry) => entry.kind === "stateUpkeep")).toBe(false);

        const healed = exactBattle({
          partyMonster: poisoned,
          inventory: { item_potion: 1 },
          rng: sequence([BYTE_255]),
        });
        const before = healed.runtime.snapshot().actors[0]!;
        healed.runtime.performActorCommand({
          kind: "item",
          itemId: "item_potion",
          targetEnemyId: "enemy-1",
          targetActorId: before.id,
        });
        const after = healed.runtime.snapshot();
        const healing = after.timeline.find((entry) => entry.kind === "healing" && entry.side === "actor");
        const healedHp = Math.min(before.maxHp, before.hp + (healing?.amount ?? 0));
        expect(healing?.amount).toBeGreaterThan(0);
        expect(after.timeline.some((entry) => entry.kind === "stateUpkeep" && entry.side === "actor" && entry.amount === 4)).toBe(true);
        expect(after.actors[0]?.hp).toBeGreaterThan(0);
        expect(after.actors[0]?.hp).toBeLessThan(healedHp);
        expect(after.eventState.inventory.item_potion ?? 0).toBe(0);
      });

      it("uses the exact two-stage capture rate and preserves the captured battle state", () => {
        const { project, runtime } = exactBattle({
          inventory: { item_capture_orb: 1 },
          rng: sequence([45 / 256, 85 / 256, 0, 0, 0, 0]),
        });
        const before = runtime.snapshot().enemies[0]!;
        const species = project.database.monsterSpecies?.find((record) => record.id === before.speciesId)!;
        const expected = gen1CaptureProbability({
          ballClass: "poke",
          maxHp: before.maxHp,
          currentHp: before.hp,
          catchRate: Math.round(species.captureRate * 255),
        });

        runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();

        expect(snapshot.lastCaptureResult).toMatchObject({ success: true, rate: expected.value, shakes: 3 });
        expect(snapshot.capturedMonsters[0]).toMatchObject({
          currentHp: before.hp,
          stateIds: before.stateIds,
          stateTurns: before.stateTurns,
        });
      });

      it("keeps persistent status but drops battle-only buffs from a captured monster", () => {
        const { runtime } = exactBattle({
          inventory: { item_capture_orb: 1 },
          rng: sequence([0, BYTE_255, BYTE_255, 123 / 256, 0, 0, 0, 0]),
          configure: (project) => {
            const quick = project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!;
            quick.power = 0;
            quick.effect = { kind: "support" };
            quick.stateEffects = [
              { stateId: "state_attack_up", chance: 100, operation: "add" },
              { stateId: "state_paralysis", chance: 100, operation: "add" },
            ];
            const orb = project.database.items.find((record) => record.id === "item_capture_orb")!;
            orb.captureProfile = { ...orb.captureProfile!, ballClass: "master" };
          },
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        expect(runtime.snapshot().enemies[0]?.stateIds).toEqual(["state_attack_up", "state_paralysis"]);
        runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
        const capture = runtime.snapshot().capturedMonsters[0]!;

        expect(capture.stateIds).toEqual(["state_paralysis"]);
        expect(capture.stateTurns).not.toHaveProperty("state_attack_up");
      });

      it("falls back to Struggle with half-damage recoil when every move is exhausted", () => {
        const { runtime } = exactBattle({
          partyMonster: monster({ skillPp: { skill_scarloxy_quick: 0 } }),
          rng: sequence([BYTE_255, BYTE_255, 0]),
        });
        const beforeHp = runtime.snapshot().actors[0]!.hp;

        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();
        const hit = snapshot.timeline.find((entry) => entry.side === "actor" && entry.skillName === "Struggle" && entry.targetId === "enemy-1")!;
        const recoil = snapshot.timeline.find((entry) => entry.side === "actor" && entry.skillName === "Struggle recoil")!;

        expect(hit.amount).toBeGreaterThan(0);
        expect(recoil.amount).toBe(Math.max(1, Math.floor(hit.amount! / 2)));
        expect(snapshot.actors[0]!.hp).toBeLessThanOrEqual(beforeHp - recoil.amount!);
      });

      it("resolves a final Struggle recoil double knockout as defeat without rewards", () => {
        const { runtime } = exactBattle({
          partyMonster: monster({ currentHp: 1, skillPp: { skill_scarloxy_quick: 0 } }),
          rng: sequence([BYTE_255, BYTE_255, 0]),
          configure(project) {
            project.database.enemies.find((enemy) => enemy.id === "enemy_pkmn_larvea")!.stats.maxHp = 1;
          },
        });
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();
        expect(snapshot.actors.every((actor) => actor.hp === 0)).toBe(true);
        expect(snapshot.enemies.every((enemy) => enemy.hp === 0)).toBe(true);
        expect(snapshot.result).toBe("defeat");
        expect(snapshot.rewards).toMatchObject({ exp: 0, gold: 0, items: [] });
      });

      it("rejects a direct Struggle command while the actor still has a usable move", () => {
        const { runtime } = exactBattle();
        const before = runtime.snapshot();

        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        const after = runtime.snapshot();

        expect(after.actors[0]?.skillPp?.skill_scarloxy_quick).toBe(1);
        expect(after.timeline).toEqual(before.timeline);
        expect(after.strictPendingActorIds).toEqual(before.strictPendingActorIds);
        expect(after.timeline.some((entry) => entry.skillName === "Struggle")).toBe(false);
      });

      it("uses a learned move when no enemy action condition matches instead of Struggle", () => {
        const { runtime } = exactBattle({
          configure: (project) => {
            const enemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea")!;
            enemy.actions = [{
              skillId: "skill_scarloxy_scratch",
              priority: 5,
              condition: { kind: "turn", start: 99, interval: 1 },
              switchOnAfterAction: { enabled: false },
              switchOffAfterAction: { enabled: false },
            }];
          },
          rng: sequence([BYTE_255, BYTE_255, 0, BYTE_255, BYTE_255, 0]),
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();

        expect(snapshot.timeline.some((entry) => entry.side === "enemy" && entry.skillName === "할퀴기")).toBe(true);
        expect(snapshot.timeline.some((entry) => entry.side === "enemy" && entry.skillName === "Struggle")).toBe(false);
      });

      it("auto-battle spends a usable support move instead of submitting a rejected Struggle", () => {
        const { project, runtime } = exactBattle({
          configure: (configured) => {
            const quick = configured.database.skills.find((record) => record.id === "skill_scarloxy_quick")!;
            quick.power = 0;
            quick.effect = { kind: "support" };
          },
        });

        expect(chooseAutoBattleCommand(project, runtime.snapshot(), () => 0)).toMatchObject({
          kind: "skill",
          skillId: "skill_scarloxy_quick",
        });
      });

      it("defaults a Gen1 monster party to one active battler when activeSlots is omitted", () => {
        const first = monster({ instanceId: "monster-active-1" });
        const second = monster({ instanceId: "monster-reserve-2" });
        const { runtime } = exactBattle({
          partyMonsters: [first, second],
          configure: (project) => {
            project.system.activeSlots = undefined;
            const troop = project.database.troops.find((record) => record.id === "troop_pkmn_grass_a")!;
            troop.activeSlots = undefined;
          },
        });

        expect(runtime.snapshot().actors).toHaveLength(1);
        expect(runtime.snapshot().reserveActors).toHaveLength(1);
      });

      it("keeps non-link Gen1 enemy PP unlimited instead of forcing Struggle", () => {
        const { runtime } = exactBattle({
          partyMonster: monster({ skillPp: { skill_scarloxy_quick: 2 } }),
          configure: (project) => {
            project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!.power = 1;
            project.database.skills.find((record) => record.id === "skill_scarloxy_scratch")!.maxPp = 1;
          },
          rng: sequence([
            BYTE_255, BYTE_255, 0,
            BYTE_255, BYTE_255, 0,
            BYTE_255, BYTE_255, 0,
            BYTE_255, BYTE_255, 0,
          ]),
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();

        expect(snapshot.enemies[0]?.skillPp).toBeUndefined();
        expect(snapshot.timeline.filter((entry) => entry.side === "enemy" && entry.skillName === "할퀴기")).toHaveLength(2);
        expect(snapshot.timeline.some((entry) => entry.side === "enemy" && entry.skillName === "Struggle")).toBe(false);
      });

      it("blocks an Electric status move against a Ground target before its effect roll", () => {
        const { runtime } = exactBattle({
          rng: sequence([0]),
          configure: (project) => {
            const quick = project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!;
            quick.power = 0;
            quick.elementId = "electric";
            quick.effect = { kind: "support" };
            quick.stateEffects = [{ stateId: "state_paralysis", chance: 100, operation: "add" }];
            const targetSpecies = project.database.monsterSpecies?.find((record) => record.id === scarloxySpeciesId("larvea"))!;
            targetSpecies.types = ["ground"];
          },
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });

        expect(runtime.snapshot().enemies[0]?.stateIds).not.toContain("state_paralysis");
      });

      it("lets a burn-capable Fire move defrost a frozen target without burning it", () => {
        const { runtime } = exactBattle({
          partyMonster: monster({ stateIds: ["state_freeze"] }),
          rng: sequence([BYTE_255, BYTE_255, 0]),
          configure: (project) => {
            const scratch = project.database.skills.find((record) => record.id === "skill_scarloxy_scratch")!;
            scratch.power = 1;
            scratch.elementId = "fire";
            scratch.stateEffects = [{ stateId: "state_burn", chance: 10, operation: "add" }];
          },
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        const actor = runtime.snapshot().actors[0]!;

        expect(actor.stateIds).not.toContain("state_freeze");
        expect(actor.stateIds).not.toContain("state_burn");
      });

      it("rejects a second major status through the live skill-effect path", () => {
        const { runtime } = exactBattle({
          partyMonster: monster({ stateIds: ["state_poison"] }),
          rng: sequence([
            BYTE_255, BYTE_255, 0,
            BYTE_255, BYTE_255, 0, 0,
          ]),
          configure: (project) => {
            const scratch = project.database.skills.find((record) => record.id === "skill_scarloxy_scratch")!;
            scratch.stateEffects = [{ stateId: "state_burn", chance: 100, operation: "add" }];
          },
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });

        expect(runtime.snapshot().actors[0]?.stateIds).toEqual(["state_poison"]);
      });

      it("clamps a captured monster's persisted HP to its species maximum", () => {
        const project = createScarloxyPokemonDemoProject();
        const session = startSession(project, 123);
        const given = giveMonster(project, session, {
          speciesId: scarloxySpeciesId("larvea"),
          level: 3,
          currentHp: 40,
        });

        expect(given.ok).toBe(true);
        if (!given.ok) return;
        expect(given.instance.currentHp).toBe(monsterMaxHp(project, given.instance));
      });

      it("writes non-monster Gen1 actor PP back to the session and restores it in the next battle", () => {
        const project = createScarloxyPokemonDemoProject();
        const session = startSession(project, 44);
        const actorId = project.system.startActorIds[0]!;
        const party = {
          levels: session.actorLevels,
          experience: session.actorExperience,
          partyActorIds: [actorId],
          skillPp: session.actorSkillPp,
        };
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_pkmn_grass_a",
          canEscape: true,
          canLose: true,
          battleFlow: "strict",
          party,
          rng: sequence([BYTE_255, BYTE_255, 0, BYTE_255, BYTE_255, 0]),
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_attack", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();
        const remaining = snapshot.actors[0]?.skillPp?.skill_attack;
        applyBattleRewardsToSession(session, {
          result: "escape",
          rewards: snapshot.rewards,
          actors: [...snapshot.actors, ...snapshot.reserveActors],
        }, project);

        expect(remaining).toBe(34);
        expect(session.actorSkillPp?.[actorId]?.skill_attack).toBe(34);
        const restored = createBattleRuntime({
          project,
          troopId: "troop_pkmn_grass_a",
          canEscape: true,
          canLose: true,
          battleFlow: "strict",
          party: { ...party, skillPp: session.actorSkillPp },
        });
        expect(restored.snapshot().actors[0]?.skillPp?.skill_attack).toBe(34);
      });
    });
  });
  describe("gen1RuntimeRegressions", () => {
    isolateTimers();
    function setActorParam(project: ReturnType<typeof createScarloxyPokemonDemoProject>, key: ActorParameterKey, value: number): void {
      const actor = project.database.actors.find((record) => record.id === project.system.startActorIds[0]);
      if (!actor) throw new Error("missing start actor");
      actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
    }
    function makeWildEnemiesFragile(project: ReturnType<typeof createScarloxyPokemonDemoProject>): void {
      for (const enemy of project.database.enemies.filter((record) => record.id.startsWith("enemy_pkmn_"))) {
        enemy.stats = { ...enemy.stats, maxHp: 1, defense: 1, agility: 1, attack: 1 };
      }
    }
    describe("Gen1 runtime regressions", () => {
      it("blocks trainer-battle capture before consuming the ball or capture RNG", () => {
        const project = createScarloxyPokemonDemoProject();
        const troop = project.database.troops.find((record) => record.id === "troop_pkmn_grass_a");
        if (!troop) throw new Error("missing grass troop");
        troop.trainerBattle = true;
        troop.uncapturable = false;
        const rng = vi.fn(() => 0);
        const runtime = createBattleRuntime({
          project,
          troopId: troop.id,
          canEscape: true,
          canLose: true,
          battleFlow: "gauge",
          sessionState: { switches: {}, variables: {}, inventory: { item_capture_orb: 2 } },
          rng,
        });

        runtime.tick(10_000);
        rng.mockClear();
        runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });

        const snapshot = runtime.snapshot();
        expect(snapshot.lastCaptureResult).toMatchObject({ success: false, blockedReason: "trainerBattle" });
        expect(snapshot.eventState.inventory.item_capture_orb).toBe(2);
        expect(rng).not.toHaveBeenCalled();
      });

      it("fields multi-member wild troops one enemy at a time", () => {
        const project = createScarloxyPokemonDemoProject();
        const troop = project.database.troops.find((record) => record.id === "troop_pkmn_grass_b");
        if (!troop?.members[0]) throw new Error("missing grass troop member");
        troop.members.push({ ...troop.members[0], x: troop.members[0].x + 32 });
        makeWildEnemiesFragile(project);
        // Staying at or below 255 avoids Gen1's paired quarter-scaling producing
        // a zero defense divisor against this intentionally 1-DEF fixture.
        setActorParam(project, "attack", 200);
        setActorParam(project, "agility", 999);
        const actorId = project.system.startActorIds[0]!;
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_pkmn_grass_b",
          canEscape: true,
          canLose: true,
          battleFlow: "strict",
          party: { levels: { [actorId]: 50 }, experience: {}, partyActorIds: [actorId] },
          rng: () => 0,
        });

        expect(runtime.snapshot().enemies.map((enemy) => enemy.id)).toEqual(["enemy-1"]);
        runtime.performActorCommand({ kind: "skill", skillId: "skill_attack", targetEnemyId: "enemy-1" });
        expect(runtime.snapshot().result).toBeUndefined();
        expect(runtime.snapshot().enemies.map((enemy) => enemy.id)).toEqual(["enemy-2"]);

        runtime.performActorCommand({ kind: "skill", skillId: "skill_attack", targetEnemyId: "enemy-2" });
        expect(runtime.snapshot().result).toBe("victory");
      });

      it("does not emit actor level-up previews for a monster-party victory", () => {
        const project = createScarloxyPokemonDemoProject();
        makeWildEnemiesFragile(project);
        const defeatedEnemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea");
        if (!defeatedEnemy) throw new Error("missing reward enemy");
        defeatedEnemy.rewards = { ...defeatedEnemy.rewards, exp: 999_999 };
        const actorId = project.system.startActorIds[0]!;
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_pkmn_grass_a",
          canEscape: true,
          canLose: true,
          battleFlow: "strict",
          party: { levels: { [actorId]: 1 }, experience: {}, partyActorIds: [actorId] },
          partyMonsters: [{
            instanceId: "monster-starter",
            speciesId: scarloxySpeciesId("sparchu"),
            level: 50,
            exp: 0,
            skillIds: ["skill_scarloxy_quick"],
            friendship: 70,
            caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
          }],
          rng: () => 0,
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        const snapshot = runtime.snapshot();
        expect(snapshot.result).toBe("victory");
        expect(snapshot.rewards.levelUps).toEqual([]);
        expect(snapshot.rewards.monsterLevelUps).not.toEqual([]);
      });

      it("does not preview level-ups for reserve monsters that never participated", () => {
        const project = createScarloxyPokemonDemoProject();
        makeWildEnemiesFragile(project);
        const defeatedEnemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea");
        if (!defeatedEnemy) throw new Error("missing reward enemy");
        defeatedEnemy.rewards = { ...defeatedEnemy.rewards, exp: 999_999 };
        const caughtAt = { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y };
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_pkmn_grass_a",
          canEscape: true,
          canLose: true,
          battleFlow: "strict",
          activeSlots: 1,
          partyMonsters: [
            {
              instanceId: "monster-active",
              speciesId: scarloxySpeciesId("sparchu"),
              level: 1,
              exp: 0,
              skillIds: ["skill_scarloxy_quick"],
              friendship: 70,
              caughtAt,
            },
            {
              instanceId: "monster-reserve",
              speciesId: scarloxySpeciesId("larvea"),
              level: 1,
              exp: 0,
              skillIds: ["skill_scarloxy_quick"],
              friendship: 70,
              caughtAt,
            },
          ],
          rng: () => 0,
        });

        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });

        expect(runtime.snapshot().rewards.monsterLevelUps.map((preview) => preview.instanceId)).toEqual(["monster-active"]);
      });

      it("keeps full live-monster-party previews when regular actors fought", () => {
        const project = createScarloxyPokemonDemoProject();
        project.system.battleParty = undefined;
        project.system.monsterBattleParty = false;
        project.system.battleModel = "rm2k3";
        makeWildEnemiesFragile(project);
        const defeatedEnemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea");
        if (!defeatedEnemy) throw new Error("missing reward enemy");
        defeatedEnemy.rewards = { ...defeatedEnemy.rewards, exp: 999_999 };
        setActorParam(project, "attack", 999);
        const actorId = project.system.startActorIds[0]!;
        const caughtAt = { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y };
        const partyMonsters = ["monster-companion-a", "monster-companion-b"].map((instanceId) => ({
          instanceId,
          speciesId: scarloxySpeciesId("sparchu"),
          level: 1,
          exp: 0,
          skillIds: ["skill_scarloxy_quick"],
          friendship: 70,
          caughtAt,
        }));
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_pkmn_grass_a",
          canEscape: true,
          canLose: true,
          battleFlow: "strict",
          party: { levels: { [actorId]: 50 }, experience: {}, partyActorIds: [actorId] },
          partyMonsters,
          rng: () => 0,
        });

        expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual([actorId]);
        expect(runtime.snapshot().phase).toBe("actorCommand");
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

        const snapshot = runtime.snapshot();
        expect(snapshot.result).toBe("victory");
        expect(snapshot.rewards.exp).toBeGreaterThan(0);
        expect(snapshot.rewards.monsterLevelUps.map((preview) => preview.instanceId)).toEqual([
          "monster-companion-a",
          "monster-companion-b",
        ]);
      });
    });
  });
  // 배지 수 조건(badgeCount)·배지 게이트 도구·원작식 복종 레벨 상한(2026-10-16). 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
  describe("monsterBadgeGating", () => {
    isolateTimers();
    const CAMPAIGN: MonsterCampaignConfig = {
      id: "c", name: "원정", speciesIds: [], speciesNotes: {}, locations: [], objectives: [],
      badges: [1, 2, 3].map((n) => ({ id: `badge_${n}`, name: `배지${n}`, switchId: `mx_badge_${n}`, cityMapId: "map" })),
    };
    /**
     * CAMPAIGN's badges point at a placeholder city map ("map"); load validation (io/references.ts) and
     * configure_monster_campaign require each badge's city map and switch to exist in the project.
     */
    function campaignIn(project: Project): MonsterCampaignConfig {
      const campaign = structuredClone(CAMPAIGN);
      for (const badge of campaign.badges) {
        badge.cityMapId = project.startMapId;
        if (!project.switches.some((entry) => entry.id === badge.switchId)) project.switches.push({ id: badge.switchId, name: badge.name });
      }
      return campaign;
    }
    const session = (switches: Record<string, boolean>) => ({ switches, variables: {}, partyActorIds: [], flags: {}, actorVitals: {}, x: 0, y: 0, currentMapId: "m" });
    describe("badgeCount 조건", () => {
      const atLeast = (value: number): Condition => ({ kind: "badgeCount", op: ">=", value });

      it("캠페인 정의가 있으면 그 배지 스위치가 켜진 개수를 센다(다른 스위치는 세지 않는다)", () => {
        const ctx = { partySkillIds: undefined, badgeSwitchIds: () => CAMPAIGN.badges.map((b) => b.switchId) };
        expect(evalCondition(session({ mx_badge_1: true, mx_badge_2: true, sw_other: true }), atLeast(2), undefined, ctx)).toBe(true);
        expect(evalCondition(session({ mx_badge_1: true, sw_other: true }), atLeast(2), undefined, ctx)).toBe(false);
      });

      it("정의가 없으면 mx_badge_N 규약 스위치를 센다", () => {
        expect(evalCondition(session({ mx_badge_1: true, mx_badge_2: true }), atLeast(2))).toBe(true);
        expect(evalCondition(session({ mx_badge_1: true, mx_story: true }), atLeast(2))).toBe(false);
        expect(evalCondition(session({}), { kind: "badgeCount", op: "==", value: 0 })).toBe(true);
      });

      it("페이지 해석기가 같은 결과를 낸다(partySkillContext 가 캠페인 배지 목록을 싣는다)", () => {
        const project = createScarloxyPokemonDemoProject();
        project.system.monsterCampaign = structuredClone(CAMPAIGN);
        const event = { id: "ev", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [
          { id: "closed", name: "닫힘", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
          { id: "open", name: "열림", conditions: [atLeast(3)], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
        ] } as unknown as GameEvent;
        const at = (n: number) => {
          const switches = Object.fromEntries(CAMPAIGN.badges.slice(0, n).map((b) => [b.switchId, true]));
          const s = session(switches) as never;
          return resolveEventPage(event, s, partySkillContext(project, s))?.id;
        };
        expect(at(2)).toBe("closed");
        expect(at(3)).toBe("open");
        expect(badgeContext(project).badgeSwitchIds?.()).toEqual(["mx_badge_1", "mx_badge_2", "mx_badge_3"]);
      });

      it("earnedBadgeCount 는 스위치가 없거나 목록이 비어도 0", () => {
        expect(earnedBadgeCount(undefined)).toBe(0);
        expect(earnedBadgeCount({ mx_badge_1: true }, [])).toBe(0);
        expect(earnedBadgeCount({ a: true, b: false, c: true }, ["a", "b", "c", "a"])).toBe(2);
      });
    });
    describe("복종 레벨 상한 — 규칙", () => {
      const rule = { enabled: true, caps: [{ badges: 0, maxLevel: 20 }, { badges: 2, maxLevel: 30 }, { badges: 5, maxLevel: 50 }] };

      it("배지 수 이하인 마지막 항목이 상한이고, 모자라면 첫 항목", () => {
        expect([0, 1, 2, 4, 5, 8].map((n) => obedienceLevelCapFor(rule, n))).toEqual([20, 20, 30, 30, 50, 50]);
        expect(obedienceLevelCapFor({ enabled: true, caps: [{ badges: 3, maxLevel: 40 }] }, 0)).toBe(40);
      });

      it("꺼짐·없음·빈 caps 는 제한 없음(undefined)", () => {
        expect(obedienceLevelCapFor(undefined, 3)).toBeUndefined();
        expect(obedienceLevelCapFor({ ...rule, enabled: false }, 3)).toBeUndefined();
        expect(obedienceLevelCapFor({ enabled: true, caps: [] }, 3)).toBeUndefined();
      });

      it("프로젝트·세션 스위치로 현재 상한을 읽는다", () => {
        const project = { system: { monsterCampaign: { ...structuredClone(CAMPAIGN), obedienceLevelCaps: rule } } } as unknown as Project;
        expect(currentObedienceCap(project, { mx_badge_1: true, mx_badge_2: true })).toBe(30);
        expect(currentObedienceCap({ system: { monsterCampaign: structuredClone(CAMPAIGN) } } as unknown as Project, { mx_badge_1: true })).toBeUndefined();
      });

      it("기본 사다리와 거부 문장", () => {
        expect(defaultObedienceCaps(3)).toEqual([{ badges: 0, maxLevel: 20 }, { badges: 1, maxLevel: 25 }, { badges: 2, maxLevel: 30 }, { badges: 3, maxLevel: 35 }]);
        expect(linearObedienceCaps(1, 10, 3)).toEqual([{ badges: 0, maxLevel: 10 }, { badges: 1, maxLevel: 13 }]);
        expect(obedienceRefusalLine(undefined, "새싹이", 0)).toBe("새싹이는 말을 듣지 않는다!");
        expect(obedienceRefusalLine({ enabled: true, caps: [], refuseLine: "{name}이(가) 고개를 돌렸다." }, "불꽃", 3)).toBe("불꽃이(가) 고개를 돌렸다.");
        const lines = new Set([0, 1, 2, 3].map((turn) => obedienceRefusalLine(undefined, "물결", turn)));
        expect(lines.size).toBe(4);
      });

      it("검증 — 잘못된 caps 는 거부하고 필드 없음은 통과(기본 꺼짐)", () => {
        const base = structuredClone(CAMPAIGN);
        expect(() => validateMonsterCampaign(base)).not.toThrow();
        expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 20 }] } })).not.toThrow();
        expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [] } })).toThrow(/caps/);
        expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [{ badges: 2, maxLevel: 20 }, { badges: 1, maxLevel: 30 }] } })).toThrow(/오름차순/);
        expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 0 }] } })).toThrow(/maxLevel/);
        expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: "yes", caps: [] } })).toThrow(/enabled/);
      });

      it("기본값에서는 직렬화에 나타나지 않는다", () => {
        const project = createScarloxyPokemonDemoProject();
        project.system.monsterCampaign = campaignIn(project);
        expect(serialize(project)).not.toContain("obedienceLevelCaps");
        project.system.monsterCampaign.obedienceLevelCaps = { enabled: true, caps: [{ badges: 0, maxLevel: 20 }] };
        expect(deserialize(serialize(project)).system.monsterCampaign?.obedienceLevelCaps).toEqual({ enabled: true, caps: [{ badges: 0, maxLevel: 20 }] });
      });
    });
    describe("복종 레벨 상한 — 전투 런타임", () => {
      const caughtAt = (project: Project) => ({ mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y });
      function start(level: number, rule: MonsterCampaignConfig["obedienceLevelCaps"], switches: Record<string, boolean> = {}) {
        const project = createScarloxyPokemonDemoProject();
        project.system.battleModel = "gen1";
        project.system.monsterCampaign = { ...structuredClone(CAMPAIGN), ...(rule ? { obedienceLevelCaps: rule } : {}) };
        return createBattleRuntime({
          project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict",
          sessionState: { switches, variables: {}, inventory: {} },
          partyMonsters: [{ instanceId: "monster-obey", speciesId: scarloxySpeciesId("sparchu"), level, exp: 0, skillIds: ["skill_scarloxy_quick"], friendship: 70, caughtAt: caughtAt(project) }],
          rng: () => 0,
        });
      }
      const rule = { enabled: true, caps: [{ badges: 0, maxLevel: 20 }, { badges: 1, maxLevel: 40 }] };
      const refusals = (runtime: ReturnType<typeof start>) => runtime.snapshot().timeline.filter((entry) => entry.kind === "special" && /말을 듣지|제멋대로|딴청|지시를 따르지/.test(entry.message ?? ""));

      it("상한을 넘은 몬스터는 기술 명령을 거부하고 상대는 맞지 않는다", () => {
        const runtime = start(30, rule);
        const enemyHpBefore = runtime.snapshot().enemies[0]!.hp;
        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        expect(refusals(runtime)).toHaveLength(1);
        expect(runtime.snapshot().enemies[0]!.hp).toBe(enemyHpBefore);
      });

      it("상한 이하이거나 배지가 늘어 상한이 오르면 말을 듣는다", () => {
        for (const runtime of [start(20, rule), start(30, rule, { mx_badge_1: true })]) {
          runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
          expect(refusals(runtime)).toHaveLength(0);
        }
      });

      it("규칙이 없거나 꺼져 있으면 아무것도 바뀌지 않는다", () => {
        for (const runtime of [start(60, undefined), start(60, { ...rule, enabled: false })]) {
          runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
          expect(refusals(runtime)).toHaveLength(0);
        }
      });

      it("거부 중에도 아이템·도망은 명령할 수 있다(거부는 기술 명령만)", () => {
        const runtime = start(30, rule);
        runtime.performActorCommand({ kind: "escape" });
        expect(refusals(runtime)).toHaveLength(0);
      });
    });
    describe("도구 — place_badge_gate / configure_monster_campaign {obedienceLevelCaps}", () => {
      const ctxOf = (project: Project): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: true });
      const prepared = (): Project => {
        const project = createScarloxyPokemonDemoProject();
        project.system.battleModel = "gen1";
        return project;
      };

      it("place_badge_gate: 세 페이지(막힘 → 확인 → 열림)와 badgeCount 조건을 만든다", () => {
        const project = prepared();
        const map = project.maps[project.startMapId]!;
        const spot = { x: Math.min(map.width - 2, project.startPos.x + 2), y: project.startPos.y };
        const ctx = ctxOf(project);
        const result = runTool(ctx, "place_badge_gate", { mapId: map.id, x: spot.x, y: spot.y, badges: 3, name: "문지기" }, { dryRun: false });
        expect(result.ok, result.summary).toBe(true);
        const event = ctx.project.maps[map.id]!.events.find((e) => e.id === (result.data as { eventIds: string[] }).eventIds[0])!;
        expect(event.pages!.map((page) => page.id.replace(/^.*_/, ""))).toEqual(["locked", "check", "open"]);
        expect(event.pages![1]!.conditions).toContainEqual({ kind: "badgeCount", op: ">=", value: 3 });
        expect(event.pages![0]!.priority).toBe("same");
        expect(event.pages![2]!.priority).toBe("below");
      });

      it("place_badge_gate: 캠페인 배지 수보다 큰 N·모르는 칸은 거부한다", () => {
        const project = prepared();
        project.system.monsterCampaign = structuredClone(CAMPAIGN);
        const ctx = ctxOf(project);
        const map = project.maps[project.startMapId]!;
        const tooMany = runTool(ctx, "place_badge_gate", { mapId: map.id, x: 3, y: 3, badges: 4 }, { dryRun: false });
        expect(tooMany.ok).toBe(false);
        const unknown = runTool(ctx, "place_badge_gate", { mapId: map.id, x: 3, y: 3, badges: 2, count: 2 }, { dryRun: false });
        expect(unknown.ok).toBe(false);
      });

      it("configure_monster_campaign: 켜기(caps 생략=기본 사다리)·끄기(필드 제거)", () => {
        const project = prepared();
        project.system.monsterCampaign = campaignIn(project);
        const ctx = ctxOf(project);
        const on = runTool(ctx, "configure_monster_campaign", { obedienceLevelCaps: { enabled: true } }, { dryRun: false });
        expect(on.ok, on.summary).toBe(true);
        expect(ctx.project.system.monsterCampaign!.obedienceLevelCaps).toEqual({ enabled: true, caps: defaultObedienceCaps(3) });
        const custom = runTool(ctx, "configure_monster_campaign", { obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 12 }, { badges: 3, maxLevel: 50 }], refuseLine: "{name}은 코를 판다." } }, { dryRun: false });
        expect(custom.ok, custom.summary).toBe(true);
        expect(ctx.project.system.monsterCampaign!.obedienceLevelCaps).toMatchObject({ caps: [{ badges: 0, maxLevel: 12 }, { badges: 3, maxLevel: 50 }], refuseLine: "{name}은 코를 판다." });
        const off = runTool(ctx, "configure_monster_campaign", { obedienceLevelCaps: { enabled: false } }, { dryRun: false });
        expect(off.ok, off.summary).toBe(true);
        expect(ctx.project.system.monsterCampaign!.obedienceLevelCaps).toBeUndefined();
      });
    });
  });
  describe("statStages", () => {
    isolateTimers();
    const skillBase = {
      animationId: "anim_magic",
      description: "x",
      type: "normal" as const,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      variance: 0,
      hitRate: 100,
      effect: { kind: "support" as const },
      maxPp: 30,
      power: 0,
    };
    function battle(skills: readonly Record<string, unknown>[], moveIds: readonly string[], model: "gen1" | "rm2k3" = "gen1") {
      const project: any = createScarloxyPokemonDemoProject();
      if (model === "rm2k3") delete project.system.battleModel;
      for (const skill of skills) project.database.skills.push(normalizeSkillRecord({ ...skillBase, ...skill } as any));
      const monster = {
        instanceId: "m1", speciesId: scarloxySpeciesId("sparchu"), level: 50, exp: 0, skillIds: [...moveIds],
        skillPp: Object.fromEntries(moveIds.map((id) => [id, 30])), friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 },
      };
      let seed = 7;
      const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return ((seed >>> 8) & 0xffff) / 65536; };
      return createBattleRuntime({
        project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict",
        partyMonsters: [monster], sessionState: { switches: {}, variables: {}, inventory: {} }, rng,
      } as any) as any;
    }
    describe("능력치 단계 배율", () => {
      it("카트리지 표: −6 은 25%, 0 은 그대로, +6 은 400%", () => {
        expect(applyStatStage(100, { attack: -6 }, "attack")).toBe(25);
        expect(applyStatStage(100, { attack: 0 }, "attack")).toBe(100);
        expect(applyStatStage(100, { attack: 6 }, "attack")).toBe(400);
        expect(statStageMultiplier(undefined, "speed")).toBe(1);
      });

      it("한계(±6)에서 멈추고 실제로 바뀐 폭을 돌려준다", () => {
        const up = shiftStatStage({ attack: 5 }, "attack", 3);
        expect(up.stages).toEqual({ attack: 6 });
        expect(up.change).toMatchObject({ before: 5, after: 6, applied: 1, requested: 3 });
        const capped = shiftStatStage({ attack: 6 }, "attack", 1);
        expect(capped.change.applied).toBe(0);
        expect(statStageMessage("스파르츄", capped.change)).toBe("스파르츄의 공격은 더 이상 오르지 않는다!");
        expect(compactStatStages({ attack: 0, speed: 0 })).toBeUndefined();
      });

      it("문장은 변화 폭으로 올랐다/크게 올랐다/대폭 올랐다", () => {
        const line = (delta: number) => statStageMessage("가", shiftStatStage(undefined, "defense", delta).change);
        expect(line(1)).toBe("가의 방어가 올랐다!");
        expect(line(2)).toBe("가의 방어가 크게 올랐다!");
        expect(line(3)).toBe("가의 방어가 대폭 올랐다!");
        expect(line(-1)).toBe("가의 방어가 내려갔다!");
      });
    });
    describe("skill.statStageEffects 정규화", () => {
      it("모르는 stat·0 단계는 버리고 범위를 자른다, 없으면 필드 자체가 없다", () => {
        const plain = normalizeSkillRecord({ ...skillBase, id: "a", name: "a", scope: "enemy" } as any);
        expect("statStageEffects" in plain).toBe(false);
        const record = normalizeSkillRecord({
          ...skillBase, id: "b", name: "b", scope: "enemy",
          statStageEffects: [{ stat: "attack", stages: 9 }, { stat: "bogus", stages: 1 }, { stat: "speed", stages: 0 }, { stat: "evasion", stages: -2, chance: 30, target: "self" }],
        } as any);
        expect(record.statStageEffects).toEqual([{ stat: "attack", stages: 6 }, { stat: "evasion", stages: -2, chance: 30, target: "self" }]);
      });
    });
    describe("전투 런타임의 능력치 단계", () => {
      const growl = { id: "t_growl", name: "울음", scope: "enemy", statStageEffects: [{ stat: "attack", stages: -1 }] };
      const swords = { id: "t_swords", name: "칼춤", scope: "self", statStageEffects: [{ stat: "attack", stages: 2 }] };
      const cast = (rt: any, skillId: string, self = false) => {
        const before = rt.snapshot().timeline.length;
        rt.performActorCommand({ kind: "skill", skillId, targetEnemyId: "enemy-1", ...(self ? { targetActorId: "m1" } : {}) });
        return rt.snapshot().timeline.slice(before);
      };

      for (const model of ["gen1", "rm2k3"] as const) {
        it(`${model}: 칼춤은 시전자에게 +2, 울음은 대상에게 −1 이 걸리고 스냅샷에 실린다`, () => {
          const rt = battle([growl, swords], ["t_growl", "t_swords"], model);
          const own = cast(rt, "t_swords", true);
          expect(own.find((entry: any) => entry.statStage)?.statStage).toMatchObject({ stat: "attack", before: 0, after: 2 });
          expect(rt.snapshot().actors[0].statStages).toEqual({ attack: 2 });
          cast(rt, "t_growl");
          expect(rt.snapshot().enemies[0].statStages).toEqual({ attack: -1 });
        });
      }

      it("gen1: 공격 +2 가 물리 피해를 키운다(단계 없는 같은 전투 대비)", () => {
        const quick = "skill_scarloxy_quick";
        const base = battle([swords], [quick, "t_swords"]);
        const first = cast(base, quick).find((entry: any) => entry.kind === "damage" && entry.side === "actor")?.amount ?? 0;
        const boosted = battle([swords], [quick, "t_swords"]);
        cast(boosted, "t_swords", true);
        const second = cast(boosted, quick).find((entry: any) => entry.kind === "damage" && entry.side === "actor")?.amount ?? 0;
        expect(second).toBeGreaterThan(first);
      });

      it("+6 한계 뒤에는 한 줄 문장만 남기고 단계는 그대로", () => {
        const rt = battle([{ id: "t_harden", name: "단단", scope: "self", statStageEffects: [{ stat: "defense", stages: 6 }] }], ["t_harden"]);
        cast(rt, "t_harden", true);
        const again = cast(rt, "t_harden", true);
        expect(again.find((entry: any) => entry.statStage)?.message).toBe("스파르츄의 방어는 더 이상 오르지 않는다!");
        expect(rt.snapshot().actors[0].statStages).toEqual({ defense: 6 });
      });

      it("단계가 없는 전투의 스냅샷에는 statStages 필드가 없다(저장·표시 바이트 불변)", () => {
        const rt = battle([], ["skill_scarloxy_quick"]);
        expect("statStages" in rt.snapshot().actors[0]).toBe(false);
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
});

describe("terrainQuarterAutotile", () => {
  isolateTimers();
  describe("dungeonTerrainQuarter", () => {
    isolateTimers();
    type MapView = { width: number; height: number; lowerTiles: number[] };
    function mapFromRows(rows: readonly (readonly number[])[]): MapView {
      return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
    }
    function quarterTile(sources: readonly { quarter: string; tile: number }[] | undefined, quarter: string): number | undefined {
      return sources?.find((entry) => entry.quarter === quarter)?.tile;
    }
    const dungeonTileset = () => withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
    describe("dungeon terrain quarter composition (RM2k3 8×8 미니타일)", () => {
      it("던전 타일셋이 프로덕션 쿼터 렌더 게이트를 통과한다", () => {
        expect(supportsChipsetQuarterComposition(dungeonTileset())).toBe(true);
        expect(dungeonTerrainQuarterKits(dungeonTileset())).toHaveLength(12);
        // 다른 칩셋에서는 던전 킷이 잡히면 안 된다 (combined-town 흙길과 id 충돌).
        expect(dungeonTerrainQuarterKits(withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_interior)).toBeNull();
      });

      it("심연 링 코너(저장 368): 대각 하나만 열림 → 해당 쿼터만 오목 소스, 나머지는 몸통", () => {
        // 링 안쪽 코너 — S/E는 변 타일, 대각(SE)만 바닥(187).
        const map = mapFromRows([
          [427, 427, 427],
          [427, 368, 457],
          [427, 428, 187],
        ]);
        const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
        expect(composition).not.toBeNull();
        expect(quarterTile(composition?.sources, "nw")).toBe(427); // 몸통 쿼터
        expect(quarterTile(composition?.sources, "ne")).toBe(427);
        expect(quarterTile(composition?.sources, "sw")).toBe(427);
        expect(quarterTile(composition?.sources, "se")).toBe(368); // 노치 1개만
      });

      it("용암 구멍 대각 셀(저장 245): 구멍 방향 쿼터만 오목, 나머지 몸통", () => {
        // 3×3 용암 가운데가 적암(244)으로 뚫린 상황의 NW 대각 셀.
        const map = mapFromRows([
          [304, 304, 304],
          [304, 245, 274],
          [304, 303, 244],
        ]);
        const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
        expect(quarterTile(composition?.sources, "se")).toBe(245);
        expect(quarterTile(composition?.sources, "nw")).toBe(304);
      });

      it("1칸 폭 심연 기둥: 좌우 쿼터가 서/동 변으로 갈라진다", () => {
        const F = 187;
        const map = mapFromRows([
          [F, 427, F],
          [F, 427, F],
          [F, 427, F],
        ]);
        const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
        expect(quarterTile(composition?.sources, "nw")).toBe(426); // 서변
        expect(quarterTile(composition?.sources, "ne")).toBe(428); // 동변
        expect(quarterTile(composition?.sources, "sw")).toBe(426);
        expect(quarterTile(composition?.sources, "se")).toBe(428);
      });

      it("connectsTo: 이끼 옆 흙 몸통은 합성 불필요(null) — 이끼를 연결로 본다", () => {
        const D = 421;
        const map = mapFromRows([
          [D, D, D],
          [D, D, 424],
          [D, D, D],
        ]);
        // 던전 킷이 우선 매칭돼 combined-town 흙길 킷(이끼=모래를 비연결로 봄)을 덮는다.
        expect(chipsetQuarterComposition(map, dungeonTileset(), 1, 1)).toBeNull();
      });

      it("이끼 쪽은 흙 옆에서 자기 테두리를 그린다(비연결) — 역방향 아님", () => {
        const M = 424;
        const map = mapFromRows([
          [421, 421, 421],
          [421, M, M],
          [421, M, M],
        ]);
        const composition = chipsetQuarterComposition(map, dungeonTileset(), 1, 1);
        expect(composition).not.toBeNull();
        expect(quarterTile(composition?.sources, "nw")).toBe(393); // 이끼 NW 볼록 코너 쿼터
      });
    });
  });
  describe("interiorAutotile", () => {
    isolateTimers();
    // 이 하네스(어두운 벽 366·공허 430·크림 회벽 104~106)는 EasyRPG 실내·던전 칩셋의 것이다 — 2026-10-07 정리 뒤 새 프로젝트에는 없으니
    // 옛 저장본처럼 정의를 되살린다. 현재 실내 v5(atlas_biome_interior)는 이 번호 체계를 쓰지 않는다.
    const blankWithRetiredSheets = () => withRetiredEasyRpgTilesets(createBlankProject());
    function wallFrameGroup(tileset: TilesetDef | undefined): AutotileGroup | undefined {
      return tileset?.autotileGroups?.find((group) => group.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
    }
    describe("interior wall-frame autotile harness (Option B: no house wall-frame store group)", () => {
      it("does not seed house wall-frame autotile; seeds dark 366 only", () => {
        const project = blankWithRetiredSheets();
        const interior = project.tilesets.easyrpg_chipset_interior;
        expect(wallFrameGroup(interior)).toBeUndefined();
        const dark = interior.autotileGroups?.find((g) => g.id.includes("dark-wall"));
        expect(dark).toBeDefined();
        expect(dark?.memberTileIds).toEqual([366]);
        // user groups preserved
        const custom = { id: "user_custom_autotile", name: "user", memberTileIds: [1], variantMap: { "0": 1 } };
        interior.autotileGroups = [custom as any, ...(interior.autotileGroups ?? [])];
        ensureTilesetHarnesses(project);
        expect(wallFrameGroup(interior)).toBeUndefined();
        expect(interior.autotileGroups?.some((group) => group.id === "user_custom_autotile")).toBe(true);
      });

      it("does not seed interior-specific autotiles on dungeon tilesets (but does seed dungeon's own)", () => {
        const dungeon = blankWithRetiredSheets().tilesets.easyrpg_chipset_dungeon;
        // 실내 전용 그룹(벽 프레임)은 던전에 새지 않는다.
        expect(wallFrameGroup(dungeon)).toBeUndefined();
        const ids = autotileGroupsForTileset(dungeon).map((group) => group.id);
        expect(ids).not.toContain(INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
        expect(ids.every((id) => !id.startsWith("harness-interior-house-v1-"))).toBe(true);
        // 대신 던전 자체 지형 오토타일 13종은 시드된다(2026-07-13 추가).
        expect(ids.filter((id) => id.startsWith("harness-dungeon-v1-terrain-"))).toHaveLength(13);
      });

      it("keeps wall-frame group absent after ensureTilesetHarnesses", () => {
        const project = blankWithRetiredSheets();
        const interior = project.tilesets.easyrpg_chipset_interior;
        interior.autotileGroups = [];
        expect(wallFrameGroup(interior)).toBeUndefined();

        expect(ensureTilesetHarnesses(project)).toBe(true);
        expect(wallFrameGroup(interior)).toBeUndefined();
        expect(autotileGroupsForTileset(interior).length).toBeGreaterThanOrEqual(1);
      });

      // 회귀: 서벽(dark-mass 428) 자리에 크림 회벽을 놓으면 뒤쪽 공허가 벽 조각을 흘리면 안 된다.
      // 옛 버그: (1,6)에 크림 104/106 → 인접 공허 (0,5)(0,6)(0,7)(1,7)에 428/368 조각 누출("매우 많이 망가짐").
      // 크림 면은 dark-mass 렌더 대상은 아니지만 이웃 판정(isMass)에서는 벽으로 쳐야 누출이 없다.
      it("cream wall placed on a dark-mass wall cell does not bleed onto exterior void (오두막 (1,6) 회귀)", () => {
        const tileset = blankWithRetiredSheets().tilesets.easyrpg_chipset_interior;
        // 천장 오토타일(harness-interior-house-v1-ceiling)은 공허 테두리를 일부러 다시 그린다 — 이 회귀는 어두운 벽 덩이(428/368)
        // 누출만 보므로 천장 문법을 뺀다.
        tileset.autotileGroups = (tileset.autotileGroups ?? []).filter((group) => group.id !== "harness-interior-house-v1-ceiling");
        const { map } = runInteriorRoomPipeline({
          mapId: "map_rp_hut_v1", name: "연습 · 오두막 (10×9)",
          width: 10, height: 9, wings: [{ x: 2, y: 4, w: 5, h: 3 }],
          door: { x: 4, y: 6 }, theme: "storage", floorTile: 139, seed: 11,
        });
        const w = map.width;
        // 공허(430) 셀의 렌더 서명을 배치 전에 수집.
        const voidSig = (): Map<number, string> => {
          const sig = new Map<number, string>();
          for (let y = 0; y < map.height; y += 1) {
            for (let x = 0; x < w; x += 1) {
              if (map.lowerTiles[y * w + x] !== 430) continue;
              const c = chipsetQuarterComposition(map, tileset, x, y);
              sig.set(y * w + x, c ? c.sources.map((s) => `${s.quarter}@${s.tile}`).join(",") : "plain");
            }
          }
          return sig;
        };
        const before = voidSig();

        for (const cream of [104, 105, 106]) {
          const snapshot = [...map.lowerTiles];
          map.lowerTiles[6 * w + 1] = cream; // (1,6) 서벽 자리에 크림 회벽
          shapeAutotileGroupAround(map, createInteriorWallFrameAutotileGroup(), [{ x: 1, y: 6 }]);
          const after = voidSig();
          for (const [idx, sig] of after) {
            // 어떤 공허 셀도 배치 때문에 벽 조각(비-plain)을 새로 얻으면 안 된다.
            expect(`${idx}:${sig}`).toBe(`${idx}:${before.get(idx)}`);
          }
          map.lowerTiles.splice(0, map.lowerTiles.length, ...snapshot); // 원복 후 다음 타일 검사
        }
      });
    });
  });
  describe("interiorWallFrameQuarterComposition", () => {
    isolateTimers();
    // 어두운 벽(366) 4분할 합성은 EasyRPG 실내 칩셋 전용이다 — 2026-10-07 정리 뒤 새 프로젝트에는 없으니 옛 저장본의 정의를 되살린다.
    const retiredInterior = () => retiredEasyRpgTileset("easyrpg_chipset_interior");
    /**
     * 로드 정규화는 이 시트에 천장 오토타일(harness-interior-house-v1-ceiling, interiorCeilingAutotile.ts)도 심는다. 그 문법은 공허·천장 칸을
     * 일부러 4분할로 그린다 — 아래 「통 타일은 4분할하지 않는다」 사례는 어두운 벽·벽틀 경로만 보므로 천장 문법을 뺀 시트로 잰다.
     */
    const retiredInteriorWithoutCeiling = () => {
      const tileset = retiredInterior();
      tileset.autotileGroups = (tileset.autotileGroups ?? []).filter((group) => group.id !== "harness-interior-house-v1-ceiling");
      return tileset;
    };
    type MapView = {
      readonly width: number;
      readonly height: number;
      readonly lowerTiles: number[];
    };
    type InteriorCornerFixture = {
      readonly center: number;
      readonly east?: number;
      readonly north?: number;
      readonly south?: number;
      readonly west?: number;
      readonly northEast?: number;
      readonly northWest?: number;
      readonly southEast?: number;
      readonly southWest?: number;
    };
    function mapWithInteriorCorner(fixture: InteriorCornerFixture): MapView {
      return {
        width: 3,
        height: 3,
        lowerTiles: [
          fixture.northWest ?? 72, fixture.north ?? 72, fixture.northEast ?? 72,
          fixture.west ?? 72, fixture.center, fixture.east ?? 72,
          fixture.southWest ?? 72, fixture.south ?? 72, fixture.southEast ?? 72,
        ],
      };
    }
    const B = DARK_WALL_TILE.BODY;
    const Q = DARK_WALL_QUARTER_SOURCE;
    const F = 72;
    describe("interior dark-wall quarter composition (Option B: store 366 only)", () => {
      it("allows the Interior tileset through production quarter-render gates", () => {
        const tileset = retiredInterior();
        expect(supportsChipsetQuarterComposition(tileset)).toBe(true);
      });

      it("isolated 366 → four convex corner quarters", () => {
        const tileset = retiredInterior();
        const composition = chipsetQuarterComposition(
          mapWithInteriorCorner({ center: B }),
          tileset,
          1,
          1,
        );
        expect(composition).toEqual({
          underlayTile: Q.center,
          sources: [
            { quarter: "nw", tile: Q.cornerNW, offsetX: 0, offsetY: 0 },
            { quarter: "ne", tile: Q.cornerNE, offsetX: 8, offsetY: 0 },
            { quarter: "sw", tile: Q.cornerSW, offsetX: 0, offsetY: 8 },
            { quarter: "se", tile: Q.cornerSE, offsetX: 8, offsetY: 8 },
          ],
        });
      });

      it("1-row band of 366 → N/S edge quarters", () => {
        const tileset = retiredInterior();
        const composition = chipsetQuarterComposition(
          mapWithInteriorCorner({ center: B, west: B, east: B }),
          tileset,
          1,
          1,
        );
        expect(composition).toEqual({
          underlayTile: Q.center,
          sources: [
            { quarter: "nw", tile: Q.edgeN, offsetX: 0, offsetY: 0 },
            { quarter: "ne", tile: Q.edgeN, offsetX: 8, offsetY: 0 },
            { quarter: "sw", tile: Q.edgeS, offsetX: 0, offsetY: 8 },
            { quarter: "se", tile: Q.edgeS, offsetX: 8, offsetY: 8 },
          ],
        });
      });

      it("1-col band of 366 → W/E edge quarters", () => {
        const tileset = retiredInterior();
        const composition = chipsetQuarterComposition(
          mapWithInteriorCorner({ center: B, north: B, south: B }),
          tileset,
          1,
          1,
        );
        expect(composition).toEqual({
          underlayTile: Q.center,
          sources: [
            { quarter: "nw", tile: Q.edgeW, offsetX: 0, offsetY: 0 },
            { quarter: "ne", tile: Q.edgeE, offsetX: 8, offsetY: 0 },
            { quarter: "sw", tile: Q.edgeW, offsetX: 0, offsetY: 8 },
            { quarter: "se", tile: Q.edgeE, offsetX: 8, offsetY: 8 },
          ],
        });
      });

      it("cross junction of 366 (diagonals open) → concave 368 ×4", () => {
        const tileset = retiredInterior();
        const composition = chipsetQuarterComposition(
          mapWithInteriorCorner({
            center: B,
            north: B,
            south: B,
            west: B,
            east: B,
            northWest: F,
            northEast: F,
            southWest: F,
            southEast: F,
          }),
          tileset,
          1,
          1,
        );
        expect(composition).toEqual({
          underlayTile: Q.center,
          sources: [
            { quarter: "nw", tile: Q.concave, offsetX: 0, offsetY: 0 },
            { quarter: "ne", tile: Q.concave, offsetX: 8, offsetY: 0 },
            { quarter: "sw", tile: Q.concave, offsetX: 0, offsetY: 8 },
            { quarter: "se", tile: Q.concave, offsetX: 8, offsetY: 8 },
          ],
        });
      });

      it("solid 3×3 of 366 → center body quarters", () => {
        const tileset = retiredInterior();
        const composition = chipsetQuarterComposition(
          {
            width: 3,
            height: 3,
            lowerTiles: [B, B, B, B, B, B, B, B, B],
          },
          tileset,
          1,
          1,
        );
        expect(composition).toEqual({
          underlayTile: Q.center,
          sources: [
            { quarter: "nw", tile: Q.center, offsetX: 0, offsetY: 0 },
            { quarter: "ne", tile: Q.center, offsetX: 8, offsetY: 0 },
            { quarter: "sw", tile: Q.center, offsetX: 0, offsetY: 8 },
            { quarter: "se", tile: Q.center, offsetX: 8, offsetY: 8 },
          ],
        });
      });

      it("house whole tiles (428/397/105/430/233/257) are never quarter-composed", () => {
        const tileset = retiredInteriorWithoutCeiling();
        for (const center of [428, 397, 105, 430, 233, 257, 258, 456, 457, 458, 396, 398, 426]) {
          expect(
            chipsetQuarterComposition(
              mapWithInteriorCorner({ center, north: center, south: center, west: F, east: F }),
              tileset,
              1,
              1,
            ),
          ).toBeNull();
        }
      });

      it("does not invent quarters on deep void", () => {
        const tileset = retiredInteriorWithoutCeiling();
        expect(
          chipsetQuarterComposition(
            mapWithInteriorCorner({ center: 430, west: 426, south: 457, southWest: 456 }),
            tileset,
            1,
            1,
          ),
        ).toBeNull();
      });
    });
  });
  describe("terrainQuarterAutotile", () => {
    isolateTimers();
    type MapView = { width: number; height: number; lowerTiles: number[] };
    function mapFromRows(rows: readonly (readonly number[])[]): MapView {
      return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
    }
    function quarterTile(sources: readonly { quarter: string; tile: number }[] | null, quarter: string): number | undefined {
      return sources?.find((entry) => entry.quarter === quarter)?.tile;
    }
    function expectQuarterTiles(
      sources: readonly { quarter: TerrainQuarter; tile: number }[] | null,
      expected: Record<TerrainQuarter, number>
    ): void {
      expect(sources).not.toBeNull();
      for (const quarter of ["nw", "ne", "sw", "se"] as const) {
        expect(quarterTile(sources, quarter), quarter).toBe(expected[quarter]);
      }
    }
    describe("terrain quarter rendering (모래/흙길 8x8 합성)", () => {
      it("9-슬라이스와 오목 코너, 흙길 BODY_ALT만 쿼터 대상으로 판정한다", () => {
        expect(isTerrainQuarterTile(SAND_TILE.BODY)).toBe(true);
        expect(isTerrainQuarterTile(SAND_TILE.EDGE_NORTH)).toBe(true);
        expect(isTerrainQuarterTile(SAND_TILE.CORNER_SOUTH_EAST)).toBe(true);
        expect(isTerrainQuarterTile(SAND_TILE.INNER_CORNER)).toBe(true);
        expect(isTerrainQuarterTile(DIRT_ROAD_TILE.INNER_CORNER)).toBe(true);
        expect(isTerrainQuarterTile(DIRT_ROAD_TILE.BODY_ALT)).toBe(true);
        expect(isTerrainQuarterTile(SAND_TILE.ISOLATED)).toBe(false);
        expect(isTerrainQuarterTile(364)).toBe(false);
        expect(isTerrainQuarterTile(TILE.GRASS)).toBe(false);
      });

      it("가로 3x1 길 가운데 칸은 위쪽 북변, 아래쪽 남변 쿼터를 합성한다", () => {
        const S = SAND_TILE.BODY, G = TILE.GRASS;
        const map = mapFromRows([
          [G, G, G],
          [S, SAND_TILE.EDGE_NORTH, S],
          [G, G, G],
        ]);
        const sources = terrainQuarterSources(map, 1, 1);
        expectQuarterTiles(sources, {
          nw: SAND_TILE.EDGE_NORTH,
          ne: SAND_TILE.EDGE_NORTH,
          sw: SAND_TILE.EDGE_SOUTH,
          se: SAND_TILE.EDGE_SOUTH,
        });
      });

      it("세로 1x3 길 가운데 칸은 왼쪽 서변, 오른쪽 동변 쿼터를 합성한다", () => {
        const R = DIRT_ROAD_TILE.BODY, G = TILE.GRASS;
        const map = mapFromRows([
          [G, R, G],
          [G, DIRT_ROAD_TILE.EDGE_WEST, G],
          [G, R, G],
        ]);
        const sources = terrainQuarterSources(map, 1, 1);
        expectQuarterTiles(sources, {
          nw: DIRT_ROAD_TILE.EDGE_WEST,
          ne: DIRT_ROAD_TILE.EDGE_EAST,
          sw: DIRT_ROAD_TILE.EDGE_WEST,
          se: DIRT_ROAD_TILE.EDGE_EAST,
        });
      });

      it("가로 3x1 서쪽 끝 칸은 서쪽 볼록 모서리와 동쪽 변 쿼터를 합성한다", () => {
        const S = SAND_TILE.BODY, G = TILE.GRASS;
        const map = mapFromRows([
          [G, G, G],
          [SAND_TILE.CORNER_NORTH_WEST, S, S],
          [G, G, G],
        ]);
        const sources = terrainQuarterSources(map, 0, 1);
        expectQuarterTiles(sources, {
          nw: SAND_TILE.CORNER_NORTH_WEST,
          ne: SAND_TILE.EDGE_NORTH,
          sw: SAND_TILE.CORNER_SOUTH_WEST,
          se: SAND_TILE.EDGE_SOUTH,
        });
      });

      it("잔디 대각 귀퉁이만 오목 쿼터, 나머지는 몸통 쿼터", () => {
        // 십자 교차로의 좌상 오목 칸: NW 대각만 잔디, 나머지 대각·4방은 모래.
        const S = SAND_TILE.BODY;
        const map = mapFromRows([
          [TILE.GRASS, S, S],
          [S, SAND_TILE.INNER_CORNER, S],
          [S, S, S],
        ]);
        const sources = terrainQuarterSources(map, 1, 1);
        expectQuarterTiles(sources, {
          nw: SAND_TILE.INNER_CORNER,
          ne: SAND_TILE.BODY,
          sw: SAND_TILE.BODY,
          se: SAND_TILE.BODY,
        });
        // 쿼터 오프셋 기하: nw(0,0)/ne(8,0)/sw(0,8)/se(8,8).
        expect(sources?.map((entry) => [entry.quarter, entry.offsetX, entry.offsetY])).toEqual([
          ["nw", 0, 0],
          ["ne", 8, 0],
          ["sw", 0, 8],
          ["se", 8, 8],
        ]);
      });

      it("십자 중심에서 대각 4곳 전부 잔디면 네 쿼터 모두 오목이다", () => {
        const S = SAND_TILE.BODY, G = TILE.GRASS;
        const map = mapFromRows([
          [G, S, G],
          [S, SAND_TILE.BODY, S],
          [G, S, G],
        ]);
        expectQuarterTiles(terrainQuarterSources(map, 1, 1), {
          nw: SAND_TILE.INNER_CORNER,
          ne: SAND_TILE.INNER_CORNER,
          sw: SAND_TILE.INNER_CORNER,
          se: SAND_TILE.INNER_CORNER,
        });
      });

      it("대각까지 전부 연결된 몸통 칸은 null로 통짜 렌더에 맡긴다", () => {
        const S = SAND_TILE.BODY;
        const map = mapFromRows([
          [S, S, S],
          [S, S, S],
          [S, S, S],
        ]);
        expect(terrainQuarterSources(map, 1, 1)).toBeNull();
      });

      it("모래는 물 대각을 연결로 취급한다(해변 접합) — 흙길은 아니다", () => {
        const S = SAND_TILE.BODY;
        const sandMap = mapFromRows([
          [TILE.WATER, S, S],
          [S, SAND_TILE.INNER_CORNER, S],
          [S, S, S],
        ]);
        expect(quarterTile(terrainQuarterSources(sandMap, 1, 1), "nw")).toBe(SAND_TILE.BODY);
        const R = DIRT_ROAD_TILE.BODY;
        const roadMap = mapFromRows([
          [TILE.WATER, R, R],
          [R, DIRT_ROAD_TILE.INNER_CORNER, R],
          [R, R, R],
        ]);
        expect(quarterTile(terrainQuarterSources(roadMap, 1, 1), "nw")).toBe(DIRT_ROAD_TILE.INNER_CORNER);
      });

      it("ISOLATED 363 저장 칸은 null로 통짜 렌더를 유지한다", () => {
        const map = mapFromRows([[SAND_TILE.ISOLATED]]);
        expect(terrainQuarterSources(map, 0, 0)).toBeNull();
      });

      it("흙길 ISOLATED 360 단독 저장 칸은 null로 통짜 렌더를 유지한다", () => {
        const map = mapFromRows([[DIRT_ROAD_TILE.ISOLATED]]);
        expect(terrainQuarterSources(map, 0, 0)).toBeNull();
      });

      it("흙길 BODY_ALT 저장 칸도 쿼터 합성 대상이다", () => {
        const R = DIRT_ROAD_TILE.BODY, G = TILE.GRASS;
        const map = mapFromRows([
          [G, G, G],
          [R, DIRT_ROAD_TILE.BODY_ALT, R],
          [G, G, G],
        ]);
        expectQuarterTiles(terrainQuarterSources(map, 1, 1), {
          nw: DIRT_ROAD_TILE.EDGE_NORTH,
          ne: DIRT_ROAD_TILE.EDGE_NORTH,
          sw: DIRT_ROAD_TILE.EDGE_SOUTH,
          se: DIRT_ROAD_TILE.EDGE_SOUTH,
        });
      });

      it("쿼터 대상이 아니거나 맵 밖이면 null", () => {
        const map = mapFromRows([[TILE.GRASS]]);
        expect(terrainQuarterSources(map, 0, 0)).toBeNull();
        expect(terrainQuarterSources(map, 5, 5)).toBeNull();
      });
    });
  });
  describe("worldCoastMapping", () => {
    isolateTimers();
    const tileset = () => retiredEasyRpgTileset("easyrpg_chipset_world");
    const map = (rows: number[][]) => ({ width: rows[0]!.length, height: rows.length, lowerTiles: rows.flat() });
    describe("World coast mapping", () => {
      it("seeds existing projects idempotently, keeping terrain and runtime passage aligned", () => {
        const ts = tileset();
        ts.autotileGroups = []; ts.tileGroups = [];
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
        expect(ts.autotileGroups?.map(g => g.id)).toEqual([WORLD_COAST_GROUP_ID, ...createWorldTerrainAutotileGroups().map(g => g.id)]);
        expect(WORLD_WATER_TILES).toHaveLength(36);
        for (const tile of WORLD_WATER_TILES) {
          expect(ts.priority[tile]).toBe("lower");
          expect(Object.values(ts.passability[tile]!)).toEqual([false, false, false, false]);
        }
        expect(Object.values(ts.passability[240]!)).toEqual([true, true, true, true]);
      });

      it("preserves authored groups, locked metadata, and other tilesets", () => {
        const ts = tileset();
        ts.autotileGroups = [{ ...createWorldCoastAutotileGroup(), id: "my-sea", name: "내 바다" }];
        const original = JSON.stringify(ts.autotileGroups);
        seedWorldCoastMapping(ts);
        expect(JSON.stringify(ts.autotileGroups)).toBe(original);
        expect(isLakeAutotileTile(120, ts)).toBe(false);
        ts.tileMeta![120] = { label: "내 타일", source: "user", userLocked: true, defaultLayer: "upper", passage: "passable" };
        ts.priority[120] = "upper";
        applyEasyRpgThemeMetadataPacks(ts);
        expect(ts.tileMeta![120]!.label).toBe("내 타일");
        expect(ts.priority[120]).toBe("upper");
        const retro = retiredEasyRpgTileset("easyrpg_chipset_retro_world");
        const before = JSON.stringify(retro);
        expect(seedWorldCoastMapping(retro)).toBe(false);
        expect(JSON.stringify(retro)).toBe(before);
      });

      it("includes snow shores but excludes waterfalls, plain variants, and source props", () => {
        const ts = tileset();
        for (const tile of [123, 125, 240, 301, 322]) {
          expect(isLakeAutotileTile(tile, ts)).toBe(false);
          expect(chipsetQuarterComposition(map([[tile]]), ts, 0, 0)).toBeNull();
        }
        for (const tile of WORLD_SNOW_SHORE_TILES) expect(isLakeAutotileTile(tile, ts)).toBe(true);
        expect(chipsetQuarterComposition(map([[421]]), ts, 0, 0)).not.toBeNull();
        expect(isLakeAutotileTile(3)).toBe(true); // Existing village canal remains supported.
      });

      it("migrates the exact old 24-slot group and its bundled metadata without replacing authored snow", () => {
        const ts = tileset();
        const legacy = { ...createWorldCoastAutotileGroup(), memberTileIds: [...WORLD_SEA_TILES], connectTileIds: [...WORLD_SEA_TILES] };
        ts.autotileGroups = [legacy];
        const coastMetadata = ts.tileGroups!.find(g => g.id === WORLD_COAST_GROUP_ID)!;
        coastMetadata.tileIds = [...WORLD_SEA_TILES];
        expect(seedWorldCoastMapping(ts)).toBe(true);
        expect(hasWorldCoastMapping(ts)).toBe(true);
        expect(ts.tileGroups!.find(g => g.id === WORLD_COAST_GROUP_ID)!.tileIds).toEqual(WORLD_WATER_TILES);
        expect(seedWorldCoastMapping(ts)).toBe(false);

        const snow = { ...createWorldCoastAutotileGroup(), id: "my-snow", memberTileIds: [...WORLD_SNOW_SHORE_TILES], connectTileIds: [...WORLD_SNOW_SHORE_TILES] };
        ts.autotileGroups = [legacy, snow];
        const before = structuredClone(ts.autotileGroups);
        expect(seedWorldCoastMapping(ts)).toBe(false);
        expect(ts.autotileGroups).toEqual(before);
      });

      it("opts out immediately after in-place grammar edits and does not silently restore them", () => {
        const ts = tileset();
        const group = ts.autotileGroups!.find(g => g.id === WORLD_COAST_GROUP_ID)!;
        expect(isLakeAutotileTile(120, ts)).toBe(true);
        group.variantMap["255"] = 3;
        expect(isLakeAutotileTile(120, ts)).toBe(false);
        expect(seedWorldCoastMapping(ts)).toBe(false);
        expect(group.variantMap["255"]).toBe(3);
      });

      it("retains v1 grass coast rendering and connection scope beside authored snow", () => {
        const ts = tileset();
        const legacy = { ...createWorldCoastAutotileGroup(), memberTileIds:[...WORLD_SEA_TILES], connectTileIds:[...WORLD_SEA_TILES] };
        const snow = { ...createWorldCoastAutotileGroup(), id:"my-snow", memberTileIds:[...WORLD_SNOW_SHORE_TILES], connectTileIds:[...WORLD_SNOW_SHORE_TILES] };
        ts.autotileGroups = [legacy,snow];
        ts.tileGroups!.find(g=>g.id===WORLD_COAST_GROUP_ID)!.tileIds = [...WORLD_SEA_TILES];
        const before = structuredClone(ts.autotileGroups);
        expect(seedWorldCoastMapping(ts)).toBe(false);
        expect(ts.autotileGroups).toEqual(before);
        expect(hasWorldCoastMapping(ts)).toBe(true);
        expect(isLakeAutotileTile(120,ts)).toBe(true);
        expect(isLakeAutotileTile(3,ts)).toBe(false);
        expect(chipsetQuarterComposition(map([[3]]),ts,0,0)).toBeNull();
        // The user's snow tiles are not members or connections of the grass coast.
        const strip = map([[3,120,3],[3,120,3],[3,120,3]]);
        expect(lakeAutotileQuarterSources(strip,1,1,ts).map(p=>p.tile)).toEqual([30,30,30,30]);
        const snowyLand = map([[190,120,190],[120,120,120],[190,120,190]]);
        expect(lakeAutotileQuarterSources(snowyLand,1,1,ts).map(p=>p.tile)).toEqual([90,90,90,90]);
        expect(ts.tileGroups!.find(g=>g.id===WORLD_COAST_GROUP_ID)!.tileIds).toEqual(WORLD_SEA_TILES);
        const project = withRetiredEasyRpgTilesets(createBlankProject()); project.tilesets[ts.id] = ts;
        const loaded = deserialize(serialize(project)).tilesets[ts.id]!;
        expect(loaded.autotileGroups!.find(g=>g.id==="my-snow")).toEqual(snow);
        expect(isLakeAutotileTile(120,loaded)).toBe(true);
        expect(isLakeAutotileTile(3,loaded)).toBe(false);
      });

      it("expands only v1 slot sets while preserving authored name and trigger scope", () => {
        const ts = tileset();
        const legacy = { ...createWorldCoastAutotileGroup(), name:"내 초원바다", triggerTileIds:[120],
          memberTileIds:[...WORLD_SEA_TILES], connectTileIds:[...WORLD_SEA_TILES] };
        ts.autotileGroups = [legacy];
        expect(seedWorldCoastMapping(ts)).toBe(true);
        const migrated = ts.autotileGroups[0]!;
        expect(migrated).toEqual({...legacy,memberTileIds:WORLD_WATER_TILES,connectTileIds:WORLD_WATER_TILES});
        expect(seedWorldCoastMapping(ts)).toBe(false);
        const project = withRetiredEasyRpgTilesets(createBlankProject()); project.tilesets[ts.id] = ts;
        const loaded = deserialize(serialize(project)).tilesets[ts.id]!;
        expect(loaded.autotileGroups!.find(g=>g.id===WORLD_COAST_GROUP_ID)).toEqual(migrated);
      });

      it("opts out of fixed coast art when a source or animation frame is grafted", () => {
        const ts = tileset();
        const original = structuredClone(ts.autotileGroups);
        for (const targetTile of [120,0,31,35]) {
          ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
          expect(hasWorldCoastMapping(ts)).toBe(false);
          expect(isLakeAutotileTile(120,ts)).toBe(false);
          expect(chipsetQuarterComposition(map([[120]]),ts,0,0)).toBeNull();
          expect(seedWorldCoastMapping(ts)).toBe(false);
          expect(ts.autotileGroups).toEqual(original);
        }
        ts.tileGrafts = [{targetTile:262,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:292}];
        expect(hasWorldCoastMapping(ts)).toBe(true);
        delete ts.tileGrafts;
        expect(hasWorldCoastMapping(ts)).toBe(true);
      });

      it("does not seed or expand a coast group over grafted source slots", () => {
        const ts = tileset();
        ts.autotileGroups = [];
        ts.tileGrafts = [{targetTile:120,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
        expect(seedWorldCoastMapping(ts)).toBe(false);
        expect(ts.autotileGroups).toEqual([]);
        const legacy = { ...createWorldCoastAutotileGroup(), memberTileIds:[...WORLD_SEA_TILES], connectTileIds:[...WORLD_SEA_TILES] };
        ts.autotileGroups = [legacy];
        ts.tileGrafts[0]!.targetTile = 3;
        expect(seedWorldCoastMapping(ts)).toBe(false);
        expect(ts.autotileGroups).toEqual([legacy]);
        expect(isLakeAutotileTile(120,ts)).toBe(true);
        expect(isLakeAutotileTile(3,ts)).toBe(false);
        expect(lakeAutotileQuarterSources(map([[190,120,190],[120,120,120],[190,120,190]]),1,1,ts).map(p=>p.tile)).toEqual([90,90,90,90]);
        delete ts.tileGrafts;
        expect(seedWorldCoastMapping(ts)).toBe(true);
        expect(ts.autotileGroups[0]!.memberTileIds).toEqual(WORLD_WATER_TILES);
      });

      it("stops only the affected three-frame water strip when any frame is grafted", () => {
        const ts = tileset();
        for (const targetTile of [120,121,122]) {
          ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
          for (const tile of [120,121,122]) expect(isWorldAnimatedTile(tile,ts)).toBe(false);
          for (const tile of [0,1,2,150,151,152,123,153,183,213]) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
        }
        delete ts.tileGrafts;
        for (const tile of [120,121,122]) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
        expect(isWorldAnimatedTile(120)).toBe(true);
        expect(isWorldAnimatedTile(262,ts)).toBe(false);
      });

      it("stops only the affected vertical four-frame effect when any frame is grafted", () => {
        const ts = tileset();
        for (const frames of [[123,153,183,213],[124,154,184,214],[125,155,185,215]]) {
          for (const targetTile of frames) {
            ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
            for (const tile of frames) expect(isWorldAnimatedTile(tile,ts)).toBe(false);
            const unrelated = [120,121,122,123,124,125,153,154,155,183,184,185,213,214,215].filter(t=>!frames.includes(t));
            for (const tile of unrelated) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
          }
        }
        ts.tileGrafts = [{targetTile:262,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:292}];
        for (const tile of [123,153,183,213]) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
      });

      it("uses all four independent quarters for every 8-neighbor topology", () => {
        const ts = tileset();
        const offsets = [[1,0,1],[2,1,2],[1,2,4],[0,1,8],[2,0,16],[2,2,32],[0,2,64],[0,0,128]];
        const expectedDirections = [[1,8,128],[1,2,16],[4,8,64],[4,2,32]];
        for (let mask = 0; mask < 256; mask++) {
          const m = map([[240,240,240],[240,120,240],[240,240,240]]);
          for (const [x,y,bit] of offsets) if (mask & bit!) m.lowerTiles[y! * 3 + x!] = 120;
          const parts = lakeAutotileQuarterSources(m, 1, 1, ts);
          for (let q = 0; q < 4; q++) {
            const [v,h,d] = expectedDirections[q]!;
            const expected = !(mask & v!) && !(mask & h!) ? 0 : !(mask & v!) ? 60 : !(mask & h!) ? 30 : !(mask & d!) ? 90 : 120;
            expect(parts[q]!.tile, `mask=${mask}, quarter=${q}`).toBe(expected);
          }
        }
      });

      it("keeps open sea at the canvas edge and reshapes after land is erased", () => {
        const ts = tileset();
        expect(lakeAutotileQuarterSources(map([[120]]),0,0,ts).map(p=>p.tile)).toEqual([120,120,120,120]);
        const m = map([[120,120,120],[120,240,120],[120,120,120]]);
        const before = lakeAutotileQuarterSources(m,0,0,ts);
        expect(before.find(p=>p.quarter === "se")!.tile).toBe(90);
        m.lowerTiles[4] = 120;
        shapeAutotileGroupAround(m, createWorldCoastAutotileGroup(), [{x:1,y:1}]);
        expect(lakeAutotileQuarterSources(m,0,0,ts).map(p=>p.tile)).toEqual([120,120,120,120]);
        const strip = map([[240,240,240],[120,120,120],[240,240,240]]);
        expect(lakeAutotileQuarterSources(strip,1,1,ts).map(p=>p.tile)).toEqual([60,60,60,60]);
      });
    });
  });
  describe("worldTerrainAutotiles", () => {
    isolateTimers();
    // Independently transcribed from the 30-column World.png atlas; do not derive
    // expected art roles from WORLD_TERRAIN_BLOCKS or the implementation's kits.
    const ART = [
      { key: "dirt", anchor: 6, solid: false, isolatedArt: false },
      { key: "sand", anchor: 9, solid: false, isolatedArt: false },
      { key: "marsh", anchor: 126, solid: true, isolatedArt: false },
      { key: "snow", anchor: 129, solid: false, isolatedArt: false },
      { key: "tall-grass", anchor: 243, solid: false, isolatedArt: false },
      { key: "snow-forest", anchor: 246, solid: true, isolatedArt: true },
      { key: "snow-mountain", anchor: 249, solid: true, isolatedArt: true },
      { key: "forest", anchor: 360, solid: true, isolatedArt: true },
      { key: "mountain", anchor: 363, solid: true, isolatedArt: true },
      { key: "metal-pit", anchor: 366, solid: true, isolatedArt: false },
      { key: "rock-pit", anchor: 369, solid: true, isolatedArt: false },
    ] as const;
    const PREFIX = "harness-world-v2-terrain-";
    const tileset = () => retiredEasyRpgTileset("easyrpg_chipset_world");
    const map = (rows: number[][]) => ({ width: rows[0]!.length, height: rows.length, lowerTiles: rows.flat() });
    const neighborBits = [[1,0,1],[2,1,2],[1,2,4],[0,1,8],[2,0,16],[2,2,32],[0,2,64],[0,0,128]] as const;
    // Each tuple: two perpendicular neighbor bits, diagonal bit, exposed corner,
    // horizontal boundary, vertical boundary, destination quarter and pixel offset.
    const quarterRoles = [
      [1,8,128,30,31,60,"nw",0,0], [1,2,16,32,31,62,"ne",8,0],
      [4,8,64,90,91,60,"sw",0,8], [4,2,32,92,91,62,"se",8,8],
    ] as const;
    describe("World terrain autotiles", () => {
      it.each(ART)("composes $key correctly for all 256 independent neighbor topologies", ({ key, anchor, isolatedArt }) => {
        const ts = tileset();
        const group = ts.autotileGroups!.find(g=>g.id===PREFIX+key)!;
        for (let mask = 0; mask < 256; mask++) {
          const m = map([[240,240,240],[240,anchor+61,240],[240,240,240]]);
          for (const [x,y,bit] of neighborBits) if (mask & bit) m.lowerTiles[y*3+x] = anchor+61;
          const composition = chipsetQuarterComposition(m,ts,1,1);
          const expected = quarterRoles.map(([vertical,horizontal,diagonal,corner,hEdge,vEdge,quarter,offsetX,offsetY]) => {
            const joined = Number(Boolean(mask & vertical)) + Number(Boolean(mask & horizontal));
            const offset = joined === 0 ? corner : joined === 2 ? (mask & diagonal ? 61 : 2) : mask & horizontal ? hEdge : vEdge;
            return { quarter, tile: anchor+offset, offsetX, offsetY };
          });
          // A null composition is a deliberate whole-tile optimization, so compare
          // the effective four source quarters, including that renderer fallback.
          const effective = composition?.sources ?? quarterRoles.map((r) => ({ quarter: r[6], tile: anchor+61, offsetX: r[7], offsetY: r[8] }));
          expect(effective, `anchor=${anchor}, mask=${mask}`).toEqual(expected);
          // Verify the persisted variant IDs produced by painting still render the
          // same boundary after neighboring cells have also been reshaped.
          shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
          const shaped = chipsetQuarterComposition(m,ts,1,1);
          if (isolatedArt && (mask & 15) === 0) {
            expect(m.lowerTiles[4]).toBe(anchor);
            expect(shaped).toBeNull();
          } else {
            const shapedEffective = shaped?.sources ?? quarterRoles.map(r=>({quarter:r[6],tile:m.lowerTiles[4],offsetX:r[7],offsetY:r[8]}));
            expect(shapedEffective, `shaped anchor=${anchor}, mask=${mask}`).toEqual(expected);
          }
        }
      });

      it.each(ART)("distinguishes $key isolated artwork from flat ground", ({ anchor, isolatedArt }) => {
        const m = map([[240,240,240],[240,anchor,240],[240,240,240]]);
        const composition = chipsetQuarterComposition(m,tileset(),1,1);
        if (isolatedArt) expect(composition).toBeNull();
        else expect(composition?.sources.map(p=>p.tile)).toEqual([anchor+30,anchor+32,anchor+90,anchor+92]);
      });

      it("shapes newly painted terrain, repairs diagonal erasure, and restores the painted corner", () => {
        const ts = tileset();
        const group = ts.autotileGroups!.find(g=>g.id===PREFIX+"forest")!;
        const m = map([[240,240,240,240,240],[240,421,421,421,240],[240,421,421,421,240],[240,421,421,421,240],[240,240,240,240,240]]);
        const points = m.lowerTiles.map((_,i)=>({x:i%5,y:Math.floor(i/5)}));
        shapeAutotileGroupAround(m,group,points);
        expect([m.lowerTiles[6],m.lowerTiles[7],m.lowerTiles[8],m.lowerTiles[11],m.lowerTiles[12],m.lowerTiles[13],m.lowerTiles[16],m.lowerTiles[17],m.lowerTiles[18]])
          .toEqual([390,391,392,420,421,422,450,451,452]);
        m.lowerTiles[6] = 240;
        shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
        expect(m.lowerTiles[12]).toBe(362);
        expect(chipsetQuarterComposition(m,ts,2,2)?.sources.map(p=>p.tile)).toEqual([362,421,421,421]);
        m.lowerTiles[6] = 421;
        shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
        expect(m.lowerTiles[12]).toBe(421);
        expect(m.lowerTiles[6]).toBe(390);
        const strip = map([[240,240,240,240,240],[240,421,421,421,240],[240,240,240,240,240]]);
        shapeAutotileGroupAround(strip,group,[{x:1,y:1},{x:2,y:1},{x:3,y:1}]);
        expect(chipsetQuarterComposition(strip,ts,2,1)?.sources.map(p=>p.tile)).toEqual([391,391,451,451]);
      });

      it("treats snowy woods and mountains as snow hosts without rewriting their tiles", () => {
        const ts = tileset();
        const group = ts.autotileGroups!.find(g=>g.id===PREFIX+"snow")!;
        const m = map([[307,310,247],[250,190,246],[249,307,310]]);
        const before = [...m.lowerTiles];
        shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
        expect(m.lowerTiles).toEqual(before);
        expect(chipsetQuarterComposition(m,ts,1,1)).toBeNull();
        m.lowerTiles[0] = 240;
        shapeAutotileGroupAround(m,group,[{x:0,y:0}]);
        expect(m.lowerTiles[4]).toBe(131);
        expect(chipsetQuarterComposition(m,ts,1,1)?.sources.map(p=>p.tile)).toEqual([131,190,190,190]);
      });

      it("chooses grass and snow shoreline independently for each corner", () => {
        const ts = tileset();
        const mixed = map([[190,120,240],[120,120,120],[240,120,190]]);
        expect(lakeAutotileQuarterSources(mixed,1,1,ts).map(p=>p.tile)).toEqual([93,90,90,93]);
        for (const snow of [190,247,250,246,307,249,310]) {
          const east = map([[120,120,120],[120,120,snow],[120,120,120]]);
          expect(lakeAutotileQuarterSources(east,1,1,ts).map(p=>p.tile)).toEqual([120,33,120,33]);
        }
        // A stored snow shoreline remains water and must join surrounding ocean.
        expect(lakeAutotileQuarterSources(map([[3]]),0,0,ts).map(p=>p.tile)).toEqual([120,120,120,120]);
        const snowAtSea = map([[120,120,120],[120,190,120],[120,120,120]]);
        const snowGroup = ts.autotileGroups!.find(g=>g.id===PREFIX+"snow")!;
        shapeAutotileGroupAround(snowAtSea,snowGroup,[{x:1,y:1}]);
        expect(snowAtSea.lowerTiles[4]).toBe(190);
      });

      it("seeds all 11 disjoint groups idempotently with consistent layer and passage", () => {
        const ts = tileset();
        ts.autotileGroups = []; ts.tileGroups = [];
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
        expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
        const claimed = new Set<number>();
        for (const {key,anchor,solid} of ART) {
          const group = ts.autotileGroups!.find(g=>g.id===PREFIX+key)!;
          const expected = [anchor,anchor+2,anchor+30,anchor+31,anchor+32,anchor+60,anchor+61,anchor+62,anchor+90,anchor+91,anchor+92];
          expect(group.memberTileIds).toEqual(expected);
          expect(Object.keys(group.variantMap)).toHaveLength(256);
          expect(group.memberTileIds).not.toContain(anchor+1);
          for (const t of expected) {
            expect(claimed.has(t)).toBe(false); claimed.add(t);
            expect(ts.tileMeta![t]).toMatchObject({defaultLayer:"lower",passage:solid?"solid":"passable"});
            expect(ts.priority[t]).toBe("lower");
            expect(Object.values(ts.passability[t]!)).toEqual([!solid,!solid,!solid,!solid]);
          }
        }
        expect(claimed.size).toBe(121);
        expect(claimed.has(240)).toBe(false);
        expect(ts.tileMeta![362]!.passage).toBe("solid"); // Original semantic table had a passable forest corner.
      });

      it("preserves authored overlapping groups and user or locked tile metadata", () => {
        const ts = tileset();
        const custom = { ...createWorldTerrainAutotileGroups().find(g=>g.id===PREFIX+"forest")!, id:"my-forest",name:"내 숲" };
        ts.autotileGroups = [custom];
        ts.tileMeta![421] = {label:"내 숲 몸통",source:"user",defaultLayer:"upper",passage:"passable"};
        ts.tileMeta![424] = {label:"고정 산",source:"bundled-default",userLocked:true,defaultLayer:"upper",passage:"passable"};
        for (const t of [421,424]) { ts.priority[t]="upper"; ts.passability[t]={up:true,down:false,left:true,right:false}; }
        const metadata = [421,424].map(t=>structuredClone({meta:ts.tileMeta![t],priority:ts.priority[t],pass:ts.passability[t]}));
        const original = structuredClone(custom);
        applyEasyRpgThemeMetadataPacks(ts);
        expect(ts.autotileGroups!.find(g=>g.id==="my-forest")).toEqual(original);
        expect(ts.autotileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(false);
        expect(worldTerrainQuarterKit(ts,421)).toBeNull();
        expect([421,424].map(t=>({meta:ts.tileMeta![t],priority:ts.priority[t],pass:ts.passability[t]}))).toEqual(metadata);
      });

      it.each([
        ["variant",(g:AutotileGroup)=>{g.variantMap["255"]=240;}],
        ["neighborhood",(g:AutotileGroup)=>{g.neighborhood=4;}],
        ["members",(g:AutotileGroup)=>{g.memberTileIds[0]=240;}],
        ["connections",(g:AutotileGroup)=>{g.connectTileIds!.push(240);}],
      ] as const)("disables fixed quarter composition immediately after in-place %s edits", (_,edit) => {
        const ts = tileset();
        const group = ts.autotileGroups!.find(g=>g.id===PREFIX+"forest")!;
        expect(worldTerrainQuarterKit(ts,421)).not.toBeNull();
        edit(group);
        const before = structuredClone(group);
        expect(worldTerrainQuarterKit(ts,421)).toBeNull();
        expect(seedWorldTerrainAutotiles(ts)).toBe(false);
        expect(group).toEqual(before);
        expect(chipsetQuarterComposition(map([[421]]),ts,0,0)).toBeNull();
      });

      it("leaves every other bundled tileset untouched even though tile IDs overlap", () => {
        for (const ts of Object.values(defaultTilesets())) {
          // worldmap_selected 는 월드 시트 480칸 정의를 그대로 복제해 아이콘만 덧붙인다(worldmapSelected.ts) — 같은 지형 킷을 갖는 것이 맞다.
          if (ts.id === "easyrpg_chipset_world" || ts.id === "worldmap_selected") continue;
          const before = structuredClone(ts);
          expect(seedWorldTerrainAutotiles(ts)).toBe(false);
          for (const {anchor} of ART) expect(worldTerrainQuarterKit(ts,anchor+61)).toBeNull();
          expect(ts).toEqual(before);
        }
      });

      it("preserves grafted artwork by opting its whole source block out of fixed quarter rendering", () => {
        const ts = tileset();
        const original = structuredClone(ts.autotileGroups);
        for (const targetTile of [421,360,390,362]) {
          ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
          ts.tileMeta![targetTile] = {label:"내 집 그림",source:"user",userLocked:true};
          expect(worldTerrainQuarterKit(ts,421)).toBeNull();
          expect(chipsetQuarterComposition(map([[240,240,240],[240,421,240],[240,240,240]]),ts,1,1)).toBeNull();
          expect(worldTerrainQuarterKit(ts,424)).not.toBeNull();
          expect(seedWorldTerrainAutotiles(ts)).toBe(false);
          expect(ts.autotileGroups).toEqual(original);
        }
        // T+1 is not a source slot; grafting this spare sample must not disable forest.
        ts.tileGrafts = [{targetTile:361,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
        expect(worldTerrainQuarterKit(ts,421)).not.toBeNull();
        ts.tileGrafts = [{targetTile:421,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
        const project = withRetiredEasyRpgTilesets(createBlankProject()); project.tilesets[ts.id]=ts;
        const loaded = deserialize(serialize(project)).tilesets[ts.id]!;
        expect(loaded.tileGrafts).toEqual(ts.tileGrafts);
        expect(worldTerrainQuarterKit(loaded,421)).toBeNull();
        delete loaded.tileGrafts;
        expect(worldTerrainQuarterKit(loaded,421)).not.toBeNull();
      });

      it("does not create a canonical terrain group over an existing graft", () => {
        const ts = tileset();
        ts.autotileGroups = []; ts.tileGroups=[];
        ts.tileGrafts = [{targetTile:421,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
        expect(seedWorldTerrainAutotiles(ts)).toBe(true);
        expect(ts.autotileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(false);
        expect(ts.tileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(false);
        expect(ts.autotileGroups).toHaveLength(10);
        expect(seedWorldTerrainAutotiles(ts)).toBe(false);
        delete ts.tileGrafts;
        expect(seedWorldTerrainAutotiles(ts)).toBe(true);
        expect(ts.autotileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(true);
        expect(seedWorldTerrainAutotiles(ts)).toBe(false);
      });

      it("retains terrain groups, shaped tiles and quarter rendering through project serialization", () => {
        const project = withRetiredEasyRpgTilesets(createBlankProject());
        const ts = project.tilesets.easyrpg_chipset_world!;
        const m = createBlankMap("World terrain serialization contract",5,3,ts.id);
        m.lowerTiles = [240,240,240,240,240,240,421,421,421,240,240,240,240,240,240];
        const forest = ts.autotileGroups!.find(g=>g.id===PREFIX+"forest")!;
        shapeAutotileGroupAround(m,forest,[{x:1,y:1},{x:2,y:1},{x:3,y:1}]);
        project.maps = {[m.id]:m}; project.mapTree={mapId:m.id,children:[]}; project.startMapId=m.id; project.startPos={x:0,y:0};
        const loaded = deserialize(serialize(project));
        const loadedTs=loaded.tilesets[ts.id]!;
        expect(loadedTs.autotileGroups).toEqual(ts.autotileGroups);
        expect(loaded.maps[m.id]!.lowerTiles).toEqual(m.lowerTiles);
        expect(chipsetQuarterComposition(loaded.maps[m.id]!,loadedTs,2,1)).toEqual(chipsetQuarterComposition(m,ts,2,1));
        expect(loadedTs.tileMeta![362]).toEqual(ts.tileMeta![362]);
        expect(applyEasyRpgThemeMetadataPacks(loadedTs)).toBe(false);
      });
    });
    // Regression from the authored world's road-side cove (63,23): diagonal snow cannot tint a grass edge.
    it("chooses snow skin only from land contributing the quarter boundary", () => {
      const ts = retiredEasyRpgTileset("easyrpg_chipset_world");
      const m = {width:3,height:3,lowerTiles:[120,240,190,120,120,120,120,120,120]};
      const ne = lakeAutotileQuarterSources(m,1,1,ts).find(p=>p.quarter==="ne")!;
      expect(ne.tile).toBe(60);
      m.lowerTiles[1]=120;
      expect(lakeAutotileQuarterSources(m,1,1,ts).find(p=>p.quarter==="ne")!.tile).toBe(93);
    });
  });
});

describe("tileLayerPolicy", () => {
  isolateTimers();
  // 테마 번들(시트 한 장이 끝에 덧붙으며 자라는 칩셋 14개)의 사본에 프로젝트 이식 칸(stamp_tileset_object 가 다른 칩셋 그림을 끝에 붙인 칸)이 있을 때:
  // 번들이 그 자리까지 자라면 꼬리를 새 번들 끝 뒤로 밀고(맵 번호도) 번들 구간만 새 굽기로 채운다 — 전에는 «칸이 번들보다 많은 사본» 이라 건너뛰어
  // 그 프로젝트가 새 킷을 못 받고, 번들 킷이 그 사본에서는 이식 그림을 가리켰다(2026-11-12 check-bundle-save-compat: snow_north 976 · steampunk_city 851).
  describe("themeBundleLocalTail", () => {
    isolateTimers();
    const THEME_BUNDLES = ["desert_east", "gothic_manor", "jp_city", "modern_campus", "modern_city", "pirate_isles", "prehistoric", "sengoku_edo", "sf_station", "sky_island", "snow_north", "steampunk_city", "wasteland_ruins", "wizarding_world"] as const;
    const CUT = 7;   // 번들이 «자라기 전» 을 흉내 내려고 사본 끝에서 떼는 칸 수

    describe("테마 번들 사본의 프로젝트 이식 꼬리", () => {
      it.each(THEME_BUNDLES)("%s — 번들이 이식 칸 자리까지 자라면 꼬리를 밀고 번들 구간을 채운다", (id) => {
        const made = { project: createBlankProject() as Project, currentMapId: "" };
        expect(runTool(made, "create_map", { id: "old", name: "옛 맵", width: 20, height: 15, tilesetId: id }).ok).toBe(true);
        const project = made.project; // 도구는 프로젝트 객체를 새로 갈아 끼운다
        ensureBundledTilesets(project); // 불러온 프로젝트의 모습(뒤 단계가 일부 칸을 upper 로 올린다 — pirate_isles·sf_station)에서 시작한다
        const ts = project.tilesets[id]!;
        const bundle = structuredClone(ts);
        const first = bundle.count - CUT;
        // 옛 사본: 번들 칸 표는 first 까지, 그 바로 뒤에 다른 칩셋 그림 한 칸(이식). 잘린 칸을 쓰는 번들 킷·묶음·띠는 그때 없었다.
        for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) (ts as unknown as Record<string, unknown[]>)[key] = (ts as unknown as Record<string, unknown[]>)[key]!.slice(0, first);
        ts.structureKits = (ts.structureKits ?? []).filter((kit) => !kit.rows.some((row) => [...(row.tiles ?? []), ...(row.upperTiles ?? [])].some((tile) => tile >= first)));
        ts.tileGroups = (ts.tileGroups ?? []).filter((group) => !group.tileIds.some((tile) => tile >= first));
        ts.animationStrips = (ts.animationStrips ?? []).filter((strip) => strip.baseTile < first);
        ts.passability.push({ up: false, down: false, left: false, right: false }); ts.priority.push("upper"); ts.terrain.push(0);
        ts.tileMeta!.push({ label: "빌린 기물", description: "" });
        ts.tileGrafts = [{ targetTile: first, sourceChipset: "tex_beodeul_city", sourceTile: 10 }];
        ts.count = first + 1;
        const map = project.maps.old!;
        const cell = 5 * map.width + 6;
        map.upperTiles[cell] = first;

        expect(ensureBundledTilesets(project)).toBe(true);
        const now = project.tilesets[id]!;
        const start = now.tileGrafts![0]!.targetTile;
        expect(start).toBeGreaterThanOrEqual(bundle.count);
        expect((start - first) % now.tilesPerRow).toBe(0); // 한 줄 폭 배수만큼
        expect(project.maps.old!.upperTiles[cell]).toBe(start);
        expect(now.tileMeta![start]!.label).toBe("빌린 기물");
        expect(isPassable(project, project.maps.old!, 6, 5)).toBe(false);
        expect(now.passability.slice(0, bundle.count)).toEqual(bundle.passability);
        expect(now.priority.slice(0, bundle.count)).toEqual(bundle.priority);
        expect(now.tileMeta!.slice(0, bundle.count)).toEqual(bundle.tileMeta);
        expect((now.structureKits ?? []).map((kit) => kit.id)).toEqual((bundle.structureKits ?? []).map((kit) => kit.id));
        for (const key of ["passability", "priority", "terrain", "tileMeta"] as const) expect((now as unknown as Record<string, unknown[]>)[key]).toHaveLength(now.count);
        const settled = JSON.stringify([project.tilesets[id], project.maps.old!.upperTiles]);
        ensureBundledTilesets(project);
        expect(JSON.stringify([project.tilesets[id], project.maps.old!.upperTiles])).toBe(settled);
      });
    });
  });
  // OPRN-OUT-026 — 타일 레이어·배경 정책. 투명하다는 사실과 홈 레이어 결정, 그리고
  // 하위 배치 시 받침 전략이 서로 다른 축임을 고정한다.
  describe("tileLayerPolicy", () => {
    isolateTimers();
    const BENCH = 357;
    const CONIFER_TRUNK = 290;
    const BROADLEAF_TRUNK = 292;
    const CONIFER_CANOPY = 260;
    const STRAIGHT_ROOF = 404;
    describe("tileLayerPolicy — 다섯 부류", () => {
      it("불투명 바닥은 opaqueFloor이고 받침이 없다", () => {
        const tileset = defaultTileset();
        for (const tile of [TILE.GRASS, TILE.WATER, STRAIGHT_ROOF]) {
          const policy = tileLayerPolicy(tileset, tile);
          expect(policy.kind, `타일 ${tile}`).toBe("opaqueFloor");
          expect(policy.home).toBe("lower");
          expect(policy.backingTile).toBeNull();
        }
      });

      it("투명 소품(벤치)은 상위 오버레이이고 받침을 쓰지 않는다", () => {
        const policy = tileLayerPolicy(defaultTileset(), BENCH);
        expect(policy.kind).toBe("transparentOverlay");
        expect(policy.home).toBe("upper");
        expect(policy.transparent).toBe(true);
        expect(policy.backingTile).toBeNull();
      });

      it("나무 밑동 290~293은 받침 있는 하위이고 잔디를 받침으로 쓴다", () => {
        const tileset = defaultTileset();
        for (const tile of [290, 291, 292, 293]) {
          const policy = tileLayerPolicy(tileset, tile);
          expect(policy.kind, `타일 ${tile}`).toBe("backedLower");
          expect(policy.home).toBe("lower");
          expect(policy.backingTile).toBe(DEFAULT_TRUNK_BACKING_TILE);
          expect(policy.multiPart?.partnerTiles).toContain(CONIFER_CANOPY);
        }
      });

      it("수관은 다중 조각 제약으로 표시되고 밑동을 짝으로 가리킨다", () => {
        const policy = tileLayerPolicy(defaultTileset(), CONIFER_CANOPY);
        expect(policy.kind).toBe("multiPart");
        expect(policy.home).toBe("upper");
        expect(policy.multiPart?.partnerTiles).toContain(CONIFER_TRUNK);
      });

      it("사용자가 받침을 없음으로 두면 의도적 투명 하위가 된다", () => {
        const tileset = defaultTileset();
        setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
        const policy = tileLayerPolicy(tileset, CONIFER_TRUNK);
        expect(policy.kind).toBe("transparentLower");
        expect(policy.backingTile).toBeNull();
        expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBeNull();
      });

      // 브라우저 실측(2026-09-10, verify-shots/oprn-026/03-backing-none-warning.png): 규칙 탭이
      // 「투명 하위(받침 없음)」 부류와 함께 "받침 타일로 투명 픽셀을 채웁니다" 근거를 같이 띄워
      // 바로 위 경고와 모순됐다. 근거는 실제 받침 결과를 말해야 한다.
      it("받침을 없음으로 확정한 밑동의 근거는 받침이 채운다고 말하지 않는다", () => {
        const tileset = defaultTileset();
        setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
        const policy = tileLayerPolicy(tileset, CONIFER_TRUNK);
        expect(policy.reason).not.toContain("받침 타일로 투명 픽셀을 채웁니다");
        expect(policy.reason).toContain("비어 보일 수 있습니다");
      });

      it("받침이 살아 있는 밑동의 근거는 여전히 받침 합성을 설명한다", () => {
        const policy = tileLayerPolicy(defaultTileset(), CONIFER_TRUNK);
        expect(policy.reason).toContain("받침 타일로 투명 픽셀을 채웁니다");
      });

      it("사용자가 받침 타일을 지정하면 그 타일이 받침이 된다", () => {
        const tileset = defaultTileset();
        setTileBackingOverride(tileset, CONIFER_TRUNK, TILE.PATH);
        expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBe(TILE.PATH);
      });

      it("사용자가 밑동을 상위로 확정하면 받침이 사라진다 — 상위는 하위 지면을 덮지 않는다", () => {
        const tileset = defaultTileset();
        setTileLayerOverride(tileset, BROADLEAF_TRUNK, "upper");
        const policy = tileLayerPolicy(tileset, BROADLEAF_TRUNK);
        expect(policy.home).toBe("upper");
        expect(policy.backingTile).toBeNull();
        expect(policy.source).toBe("user");
      });

      it("자동으로 되돌리면 하네스 기본값(받침 있는 하위)으로 복귀한다", () => {
        const tileset = defaultTileset();
        setTileLayerOverride(tileset, CONIFER_TRUNK, "upper");
        setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
        setTileLayerOverride(tileset, CONIFER_TRUNK, "auto");
        setTileBackingOverride(tileset, CONIFER_TRUNK, "auto");
        const policy = tileLayerPolicy(tileset, CONIFER_TRUNK);
        expect(policy.home).toBe("lower");
        expect(policy.backingTile).toBe(DEFAULT_TRUNK_BACKING_TILE);
      });
    });
    describe("backgroundlessLowerReviews — 검토 신호는 변형하지 않는다", () => {
      it("기본 칩셋에서 받침 있는 밑동은 검토 목록에 들어가지 않는다", () => {
        const reviews = backgroundlessLowerReviews(defaultTileset());
        for (const tile of [290, 291, 292, 293]) {
          expect(reviews.some((review) => review.tile === tile), `타일 ${tile}`).toBe(false);
        }
      });

      it("받침 없는 투명 하위 타일은 네 가지 선택지와 함께 검토 목록에 오른다", () => {
        const tileset = defaultTileset();
        setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
        const review = backgroundlessLowerReviews(tileset).find((item) => item.tile === CONIFER_TRUNK);
        expect(review).toBeDefined();
        expect(review?.kind).toBe("transparentLower");
        expect(review?.choices).toEqual(["overlay", "lowerWithBacking", "transparentLower", "auto"]);
      });

      it("목록을 만드는 것만으로는 타일셋이 바뀌지 않는다 — 가져오기 자동 재분류 금지", () => {
        const tileset = defaultTileset();
        const before = JSON.stringify({ priority: tileset.priority, tileMeta: tileset.tileMeta });
        backgroundlessLowerReviews(tileset);
        expect(JSON.stringify({ priority: tileset.priority, tileMeta: tileset.tileMeta })).toBe(before);
      });
    });
  });
  describe("tilesetSemanticChecker", () => {
    isolateTimers();
    describe("tileset semantic checker", () => {
      it("reports the default combined-town metadata as ready for every generation role", () => {
        // Given: the bundled default tileset has semantic groups and high-confidence tile metadata.
        const tileset = defaultTileset();

        // When: the tileset checker evaluates generation readiness.
        const summary = summarizeTilesetGenerationReadiness(tileset);

        // Then: city, house, road, water, and decor generation are all covered.
        expect(summary.ready).toBe(true);
        expect(summary.checks.map((check) => check.id)).toEqual(["city", "house", "road", "water", "decor"]);
        expect(summary.checks.every((check) => check.ready)).toBe(true);
        expect(summary.checks.find((check) => check.id === "city")?.coveredRoles).toEqual(
          expect.arrayContaining(["building", "terrain", "wall", "water"])
        );
      });

      it("names missing role slots when semantic groups are incomplete", () => {
        // Given: a tileset that lost all water groups.
        const tileset = defaultTileset();
        tileset.tileGroups = tileset.tileGroups?.filter((group) => group.role !== "water");

        // When: the tileset checker evaluates generation readiness.
        const summary = summarizeTilesetGenerationReadiness(tileset);

        // Then: city and water generation identify the missing water slot.
        expect(summary.ready).toBe(false);
        expect(summary.checks.find((check) => check.id === "city")?.missingRoleSlots).toContain("water");
        expect(summary.checks.find((check) => check.id === "water")?.missingRoleSlots).toContain("water");
      });

      it("summarizes selected tile tags and placement rules from metadata groups", () => {
        // Given: a selected tile that belongs to a semantic road group.
        const tileset = defaultTileset();
        const roadGroup = tileset.tileGroups?.find((group) => group.role === "terrain");
        if (!roadGroup) throw new Error("expected terrain road group");
        const tile = roadGroup.tileIds[0];

        // When: the selected tile usage summary is built.
        const usage = summarizeTileUsage(tileset, tile);

        // Then: inspector data includes visible meaning tags and rule text.
        expect(usage.tags).toEqual(expect.arrayContaining(["terrain", "lower", "passable"]));
        expect(usage.groups[0]).toEqual(
          expect.objectContaining({
            name: roadGroup.name,
            role: "terrain",
            defaultLayer: "lower",
          })
        );
        expect(usage.ruleText).toContain(roadGroup.placementRules);
      });

      it("marks groups with invalid structure rules as invalid", () => {
        // Given: a semantic group whose structural rules reference missing roles and out-of-range tiles.
        const tileset = defaultTileset();
        const invalidGroup = tileset.tileGroups?.find((group) => group.role === "roof");
        if (!invalidGroup) throw new Error("expected roof group");
        Object.assign(invalidGroup, {
          junctions: [
            { action: "omit", atRoles: ["missingPart"], side: "below", withRole: "wall" },
            { action: "omit", side: "above", withRole: "sky" },
          ],
          overlays: [{ tileIds: [tileset.count + 1], when: "ridge" }],
        });

        // When: the tileset checker evaluates generation readiness.
        const summary = summarizeTilesetGenerationReadiness(tileset);

        // Then: the malformed structural rule excludes that group from valid generation coverage.
        expect(summary.invalidGroups.map((group) => group.id)).toContain(invalidGroup.id);
      });
    });
  });
  describe("tileVocabAutotileCapability", () => {
    isolateTimers();
    /**
     * requireAutotileGroup 경로가 고른 그룹 id — isAutotileGroup 의 유일한 공개 관측창이다.
     * 오토타일이 아니라고 판정되면 "missing" 이 돌아온다.
     */
    function autotileGroupIdFor(tileset: TilesetDef, query: string): string {
      const result = resolveMaterialByLabel(tileset, query, { requireAutotileGroup: true });
      if (result.status === "missing") return "missing";
      return result.kind === "group" ? result.group.id : "tile";
    }
    /** 기본 타일셋의 water 그룹은 문법도 갖고 있다 — 역할 분기를 보려면 문법을 떼야 한다. */
    function tilesetWithoutWaterGrammar(): TilesetDef {
      const tileset = defaultTileset();
      tileset.tileGroups = (tileset.tileGroups ?? []).map((group) =>
        group.role === "water" ? { ...group, patternGrammar: undefined } : group
      );
      return tileset;
    }
    describe("오토타일 역할 (특성화)", () => {
      it("water 만 문법 없이도 오토타일로 취급된다", () => {
        const tileset = defaultTileset();
        expect(roleCapabilities(tileset, "water").autotile).toBe(true);
        for (const role of ["terrain", "wall", "roof", "prop", "fence", "building", "castle"]) {
          expect(roleCapabilities(tileset, role).autotile, role).toBe(false);
        }
      });

      // 위 테스트는 능력 표만 본다 — isAutotileGroup 을 한 번도 부르지 않는다.
      // 아래가 실제 판정을 두 분기로 갈라 통과시킨다.
      it("문법이 역할을 이긴다 — 문법 있는 terrain 은 오토타일, 문법 없는 fence 는 아니다", () => {
        const tileset = defaultTileset();
        // 잔디: role=terrain(autotile=false) 이지만 autotile_3x3 문법이 있어 오토타일이다.
        expect(autotileGroupIdFor(tileset, "잔디")).toBe("harness-combined-town-grass-autotile");
        // 울타리: role=fence + 문법 없음 → 오토타일이 아니다.
        expect(autotileGroupIdFor(tileset, "울타리")).toBe("missing");
      });

      it("문법을 잃은 water 그룹은 역할 능력만으로 오토타일을 유지한다", () => {
        expect(autotileGroupIdFor(tilesetWithoutWaterGrammar(), "애니메이션 물 오토타일")).toBe(
          "harness-combined-town-lake-water-autotile"
        );
      });
    });
  });
});

describe("tilesetHarness", () => {
  isolateTimers();
  describe("EasyRPG Combined Town tileset harness", () => {
    it("seeds the default Combined Town tileset with grouped metadata and grammars", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      const roadGroup = tileset.tileGroups?.find((group) => group.id.endsWith("dirt-road-autotile"));
      const sandGroup = tileset.tileGroups?.find((group) => group.id.endsWith("sand-autotile"));
      const waterGroup = tileset.tileGroups?.find((group) => group.id.endsWith("lake-water-autotile"));

      expect(roadGroup).toMatchObject({
        defaultLayer: "lower",
        patternGrammar: { kind: "autotile_3x3" },
        source: "bundled-default",
      });
      expect(waterGroup).toMatchObject({
        role: "water",
        patternGrammar: { kind: "animated_terrain" },
      });
      expect(sandGroup).toMatchObject({
        defaultLayer: "lower",
        id: "harness-combined-town-sand-autotile",
        layerHome: "lower",
        name: "모래",
        patternGrammar: { kind: "autotile_3x3" },
        role: "terrain",
        source: "bundled-default",
      });
      expect(sandGroup?.tileIds).toEqual(CHIPSET_TILE_GROUPS.sandGround);
      expect(tileset.tileMeta?.[360]).toMatchObject({
        label: "흙길 중앙",
        description: "",
        repeatability: "auto",
        source: "bundled-default",
      });
      expect(roadGroup?.description.length).toBeGreaterThan(0);
    });

    it("tree canopies are upper ★ and trunks are lower solid for forest stacking", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      // 수관: upper + 통행 가능 → ★
      expect(tileset.priority[260]).toBe("upper");
      expect(passageMarkForTile(tileset, 260)).toBe("star");
      expect(tileset.priority[262]).toBe("upper");
      expect(passageMarkForTile(tileset, 262)).toBe("star");
      // 밑동: lower + solid → 수관이 같은 칸 upper 에 겹침 가능
      expect(tileset.priority[290]).toBe("lower");
      expect(passageMarkForTile(tileset, 290)).toBe("x");
      expect(tileset.priority[292]).toBe("lower");
      expect(passageMarkForTile(tileset, 292)).toBe("x");
    });

    it("seeds conifer, dry tree, broadleaf, flower, and bush cluster rules by default", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      const group = (suffix: string) => tileset.tileGroups?.find((entry) => entry.id.endsWith(suffix));

      expect(group("conifer-tree")?.rules).toEqual([
        expect.objectContaining({ kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" }),
      ]);
      // bAlt = "a 옆에 b 대신 와도 되는 대체 타일"(clusterRuleValidators.ts:121).
      // 마른나무는 상단(261)을 세로로 이어 쌓을 수 있어야 하므로 261 이 대체로 허용된다 —
      // 출하 코드에 원래부터 있던 것이고, 이 단정이 그걸 반영하지 못해 실패하고 있었다.
      expect(group("dry-tree")?.rules).toEqual([
        expect.objectContaining({ kind: "adjacency", params: { a: 261, b: 291, bAlt: [261], relation: "aAboveB" }, strength: "hard" }),
      ]);
      // 활엽수 2×2 는 **대각 겹침**(원자를 (+1,+1) 로 밀어 수관을 맞물리게 하는 것)을 허용한다.
      // 그래서 앞 원자의 우하(293) 자리에 다음 원자의 좌상(262)이 와도 되도록 두 규칙에 bAlt 를 준다.
      // 262 는 자기 규칙(오른쪽 263, 아래 292)을 그대로 지켜야 하므로 조각난 나무는 여전히 error 다.
      expect(group("broadleaf-tree-2x2")?.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ params: { a: 262, b: 292, relation: "aAboveB" }, strength: "hard" }),
          expect.objectContaining({ params: { a: 263, b: 293, bAlt: [262], relation: "aAboveB" }, strength: "hard" }),
          expect.objectContaining({ params: { a: 262, b: 263, relation: "aLeftOfB" }, strength: "hard" }),
          expect.objectContaining({ params: { a: 292, b: 293, bAlt: [262], relation: "aLeftOfB" }, strength: "hard" }),
        ])
      );
      expect(group("flower-props")?.rules).toEqual([
        expect.objectContaining({ kind: "spacing", params: { minGap: 2 }, strength: "medium" }),
      ]);
      expect(group("bush-props")?.rules).toEqual([
        expect.objectContaining({ kind: "spacing", params: { minGap: 2 }, strength: "soft" }),
      ]);
      expect(group("bench-vertical")?.tileIds).toEqual([358, 388]);
      expect(group("bench-vertical")?.patternGrammar?.kind).toBe("vertical_expandable");
      expect(group("house-yard-props")?.tileIds).toEqual([349, 350, 351, 352]);
      expect(group("cemetery-props")?.tileIds).toEqual([323, 353, 383]);
      expect(group("table-horizontal")?.tileIds).toEqual([234, 235, 236]);
      expect(group("table-vertical")?.tileIds).toEqual([144, 174, 204]);
      expect(group("wood-floor-deck")?.tileIds).toEqual(CHIPSET_TILE_GROUPS.woodFloorBody);
      expect(group("wood-floor-deck")).toMatchObject({
        role: "terrain",
        defaultLayer: "lower",
        source: "bundled-default",
      });
      expect(group("timber-post-rail")?.tileIds).toEqual([...CHIPSET_TILE_GROUPS.timberPostStructureObjects]);
      expect(group("timber-post-rail")?.defaultLayer).toBe("lower");
      expect(tileset.priority[222]).toBe("lower");
      expect(passageMarkForTile(tileset, 222)).not.toBe("x");
      expect(passageMarkForTile(tileset, 223)).toBe("x");
      expect(tileset.tileMeta?.[222]?.label).toBe("나무 바닥 바디");
      expect(tileset.tileMeta?.[223]?.label).toBe("목조 난간 바디");
      expect(group("market-rail-upper")?.tileIds).toEqual([468, 469, 470]);
      expect(group("market-rail-upper")?.patternGrammar?.kind).toBe("horizontal_expandable");
      expect(group("stone-step-slab")?.tileIds).toEqual([268]);
      expect(tileset.priority[468]).toBe("upper");
      expect(tileset.priority[268]).toBe("upper");
      expect(passageMarkForTile(tileset, 468)).toBe("x");
      expect(passageMarkForTile(tileset, 268)).toBe("x");
      expect(tileset.tileMeta?.[468]?.label).toBe("장터 레일 좌");
      expect(tileset.tileMeta?.[268]?.label).toBe("돌단/석판");
      expect(group("wood-door")?.tileIds).toEqual([116, 146]);
      expect(group("stone-stairs")?.tileIds).toEqual([111, 112, 113]);
      expect(group("wall-ladder")?.tileIds).toEqual([322]);
      expect(tileset.tileMeta?.[358]?.label).toBe("세로 의자 상");
      expect(tileset.tileMeta?.[383]?.label).toBe("해골");
      expect(tileset.tileMeta?.[322]?.passage).toBe("passable");
      expect(tileset.priority[322]).toBe("upper");
    });

    it("does not overwrite existing rules when the Combined Town harness is re-applied", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      const conifer = tileset.tileGroups?.find((group) => group.id.endsWith("conifer-tree"));
      if (!conifer) throw new Error("missing conifer group");
      conifer.rules = [{ id: "user-rule", kind: "count", params: { max: 7 }, strength: "soft", message: "사용자 규칙" }];
      conifer.tileIds = [260];
      conifer.patternGrammar = { kind: "single", parts: [{ role: "center", tileIds: [260] }], preserveCaps: true, repeat: "source_order" };

      applyCombinedTownHarness(tileset);

      const reseeded = tileset.tileGroups?.find((group) => group.id === conifer.id);
      expect(reseeded?.rules).toEqual([{ id: "user-rule", kind: "count", params: { max: 7 }, strength: "soft", message: "사용자 규칙" }]);
      expect(reseeded?.tileIds).toEqual([260]);
      expect(reseeded?.patternGrammar).toEqual({ kind: "single", parts: [{ role: "center", tileIds: [260] }], preserveCaps: true, repeat: "source_order" });
    });

    it("seeds missing default rules without resetting user-edited group layout", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      const conifer = tileset.tileGroups?.find((group) => group.id.endsWith("conifer-tree"));
      if (!conifer) throw new Error("missing conifer group");
      conifer.rules = undefined;
      conifer.tileIds = [260];
      conifer.patternGrammar = { kind: "single", parts: [{ role: "center", tileIds: [260] }], preserveCaps: true, repeat: "source_order" };

      applyCombinedTownHarness(tileset);

      const reseeded = tileset.tileGroups?.find((group) => group.id === conifer.id);
      expect(reseeded?.tileIds).toEqual([260]);
      expect(reseeded?.patternGrammar?.kind).toBe("single");
      expect(reseeded?.rules).toEqual([
        expect.objectContaining({ kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" }),
      ]);
    });

    it("keeps tombstoned Combined Town harness groups deleted across serialization and re-apply", () => {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
      const groupId = COMBINED_TOWN_HARNESS_GROUPS[0]?.id;
      if (!groupId) throw new Error("missing harness group");
      tileset.tileGroups = tileset.tileGroups?.filter((group) => group.id !== groupId);
      tileset.suppressedHarnessGroupIds = [groupId];

      const restored = deserialize(serialize(project));
      applyCombinedTownHarness(restored.tilesets[COMBINED_TOWN_TILESET_ID]);

      expect(restored.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.some((group) => group.id === groupId)).toBe(false);
      expect(restored.tilesets[COMBINED_TOWN_TILESET_ID].suppressedHarnessGroupIds).toEqual([groupId]);
    });

    it("locks the Combined Town layer contract: roof body 374–377 lower, transparent caps 384–387 upper", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];

      expect(harnessLayerForTile(tileset, 85)).toBe("lower");
      expect(harnessLayerForTile(tileset, 378)).toBe("lower");
      expect(harnessLayerForTile(tileset, 116)).toBe("lower");
      expect(harnessLayerForTile(tileset, 404)).toBe("lower");
      // 사선 지붕 몸체는 불투명 지붕 본체 — 하위(houseKit 2026-07-17 교정 정본).
      // 예전엔 roof-overlays 그룹이 전부 상위로 묶었다.
      for (const tile of [374, 375, 376, 377]) {
        expect(harnessLayerForTile(tileset, tile), `harness ${tile}`).toBe("lower");
        expect(tileset.priority[tile], `priority ${tile}`).toBe("lower");
        expect(tileLayerHome(tileset, tile), `home ${tile}`).toBe("lower");
      }
      // 투명 마감 캡만 상위 오버레이.
      for (const tile of [384, 385, 386, 387]) {
        expect(harnessLayerForTile(tileset, tile), `harness ${tile}`).toBe("upper");
        expect(tileset.priority[tile], `priority ${tile}`).toBe("upper");
        expect(tileLayerHome(tileset, tile), `home ${tile}`).toBe("upper");
      }
      const body = tileset.tileGroups?.find((group) => group.id.endsWith("roof-body"));
      expect(body).toMatchObject({ role: "roof", defaultLayer: "lower" });
      expect(body?.tileIds).toEqual([374, 375, 376, 377]);
      const caps = tileset.tileGroups?.find((group) => group.id.endsWith("roof-overlays"));
      expect(caps?.tileIds).toEqual([384, 385, 386, 387]);
      // 창문(85)/울타리(378)는 그룹 계약이 lower여도 투명 칩이라 런타임 priority는 upper로 승격된다.
      expect(tileset.priority[85]).toBe("upper");
      expect(tileset.priority[378]).toBe("upper");
      expect(tileset.passability[374]).toEqual({ up: false, down: false, left: false, right: false });
    });

    it("keeps uploaded or unknown tilesets from inheriting Combined Town number meaning", () => {
      const base = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      const uploaded: TilesetDef = {
        ...structuredClone(base),
        id: "uploaded-town",
        image: { type: "uploaded", id: "custom-town" },
        tileMeta: undefined,
        tileGroups: undefined,
      };

      expect(applyCombinedTownHarness(uploaded)).toBe(false);
      expect(uploaded.tileMeta).toBeUndefined();
      expect(uploaded.tileGroups).toBeUndefined();
    });

    it("rejects uploaded Combined Town id collisions", () => {
      const base = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      const uploaded: TilesetDef = {
        ...structuredClone(base),
        id: COMBINED_TOWN_TILESET_ID,
        image: { type: "uploaded", id: "custom-town" },
        tileMeta: undefined,
        tileGroups: undefined,
      };

      expect(applyCombinedTownHarness(uploaded)).toBe(false);
      expect(uploaded.tileMeta).toBeUndefined();
      expect(uploaded.tileGroups).toBeUndefined();
    });

    it("preserves user-locked values when re-seeding the harness", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      tileset.tileMeta![85] = {
        label: "사용자 창문",
        description: "내가 확정한 창문",
        source: "user",
        userLocked: true,
      };

      applyCombinedTownHarness(tileset);
      expect(tileset.tileMeta?.[85]).toMatchObject({
        label: "사용자 창문",
        source: "user",
        userLocked: true,
      });
    });

    it("preserves user-edited runtime passage and terrain when re-seeding the harness", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      tileset.passability[374] = { up: false, down: false, left: false, right: false };
      tileset.terrain[374] = 9;
      tileset.tileMeta![374] = {
        ...(tileset.tileMeta?.[374] ?? { label: "", description: "" }),
        passage: "solid",
        terrainTag: 9,
        source: "user",
        userLocked: true,
      };

      applyCombinedTownHarness(tileset);

      expect(tileset.passability[374]).toEqual({ up: false, down: false, left: false, right: false });
      expect(tileset.terrain[374]).toBe(9);
      expect(tileset.tileMeta?.[374]).toMatchObject({ passage: "solid", terrainTag: 9, source: "user", userLocked: true });
    });

    it("marks transparent object groups as stackable without forcing mixed props to one layer", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets[COMBINED_TOWN_TILESET_ID];
      const harnessTileCount = new Set(COMBINED_TOWN_HARNESS_GROUPS.flatMap((group) => [...group.tileIds])).size;

      expect(harnessTileCount).toBeGreaterThan(40);
      expect(isHarnessStackableTile(tileset, 85)).toBe(true);
      expect(isHarnessStackableTile(tileset, 378)).toBe(true);
      expect(isHarnessStackableTile(tileset, TILE.TREE)).toBe(true);
      expect(harnessLayerForTile(tileset, TILE.TREE)).toBeNull();
    });
  });
  describe("EasyRPG theme metadata packs", () => {
    it("seeds exact-match dungeon and interior packs in default tilesets", () => {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const dungeon = project.tilesets.easyrpg_chipset_dungeon;
      const interior = project.tilesets.easyrpg_chipset_interior;

      expect(dungeon.tileGroups?.some((group) => group.id.startsWith(DUNGEON_HARNESS_PREFIX))).toBe(true);
      expect(interior.tileGroups?.some((group) => group.id.startsWith(INTERIOR_HARNESS_PREFIX))).toBe(true);
      expect(dungeon.tileMeta?.[270]).toMatchObject({ source: "bundled-default", confidence: "high", passage: "passable" });
      expect(dungeon.tileMeta?.[1]).toMatchObject({ source: "bundled-default", confidence: "high", passage: "solid" });
      expect(interior.tileMeta?.[270]).toMatchObject({ source: "bundled-default", confidence: "high", passage: "passable" });
      expect(interior.tileMeta?.[1]).toMatchObject({ source: "bundled-default", confidence: "high", passage: "solid" });
    });

    it("routes transparent-background interior furniture to the upper layer", () => {
      const interior = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_interior;

      expect(harnessLayerForTile(interior, 115)).toBe("upper");
      expect(harnessLayerForTile(interior, 268)).toBe("upper");
      expect(interior.priority[115]).toBe("upper");
      expect(interior.priority[268]).toBe("upper");
      expect(interior.tileMeta?.[115]).toMatchObject({
        defaultLayer: "upper",
        role: "prop",
        source: "bundled-default",
      });
      expect(interior.tileMeta?.[268]).toMatchObject({
        defaultLayer: "upper",
        role: "prop",
        source: "bundled-default",
      });
    });

    it("applies packs only to exact bundled texture ids", () => {
      const base = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
      const uploaded: TilesetDef = {
        ...structuredClone(base),
        id: "uploaded-dungeon",
        image: { type: "uploaded", id: "tex_easyrpg_chipset_dungeon" },
        tileMeta: undefined,
        tileGroups: undefined,
      };

      expect(applyEasyRpgThemeMetadataPacks(uploaded)).toBe(false);
      expect(uploaded.tileMeta).toBeUndefined();
      expect(uploaded.tileGroups).toBeUndefined();
    });

    it("preserves existing group records and IDs, including ambiguous bundled prefix records", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_dungeon;
      tileset.tileGroups = [
        ...(tileset.tileGroups ?? []),
        { id: "user-custom-group", name: "User Group", role: "terrain", defaultLayer: "lower", tileIds: [12], description: "", placementRules: "", source: "user", confidence: "high" },
        { id: `${DUNGEON_HARNESS_PREFIX}old`, name: "Old Pack Group", role: "terrain", defaultLayer: "lower", tileIds: [13], description: "", placementRules: "", source: "bundled-default", confidence: "high" },
        { id: `${DUNGEON_HARNESS_PREFIX}user-collision`, name: "User Prefix Collision", role: "terrain", defaultLayer: "lower", tileIds: [14], description: "", placementRules: "", source: "user", confidence: "high" },
        { id: `${DUNGEON_HARNESS_PREFIX}floor`, name: "User Floor Collision", role: "terrain", defaultLayer: "lower", tileIds: [15], description: "", placementRules: "", source: "user", confidence: "high" },
        { id: `${DUNGEON_HARNESS_PREFIX}floor-user-preserved`, name: "Existing Preserved Collision", role: "terrain", defaultLayer: "lower", tileIds: [16], description: "", placementRules: "", source: "user", confidence: "high" },
      ];

      applyEasyRpgThemeMetadataPacks(tileset);

      expect(tileset.tileGroups?.some((group) => group.id === "user-custom-group")).toBe(true);
      expect(tileset.tileGroups?.some((group) => group.id === `${DUNGEON_HARNESS_PREFIX}old`)).toBe(true);
      expect(tileset.tileGroups?.some((group) => group.id === `${DUNGEON_HARNESS_PREFIX}floor`)).toBe(true);
      expect(tileset.tileGroups?.some((group) => group.id === `${DUNGEON_HARNESS_PREFIX}user-collision`)).toBe(true);
      expect(tileset.tileGroups?.some((group) => group.name === "User Floor Collision")).toBe(true);
      expect(tileset.tileGroups?.some((group) => group.name === "Existing Preserved Collision")).toBe(true);
      expect(new Set(tileset.tileGroups?.map((group) => group.id)).size).toBe(tileset.tileGroups?.length);
    });

    it("preserves source:user and userLocked tile metadata while applying runtime contracts", () => {
      const tileset = withRetiredEasyRpgTilesets(createBlankProject()).tilesets.easyrpg_chipset_interior;
      tileset.tileMeta![270] = { label: "내 바닥", description: "사용자 확정", source: "user", confidence: "high", passage: "passable" };
      tileset.tileMeta![1] = { label: "잠근 벽", description: "잠금", source: "bundled-default", confidence: "high", userLocked: true, passage: "solid" };

      applyEasyRpgThemeMetadataPacks(tileset);

      expect(tileset.tileMeta?.[270]).toMatchObject({ label: "내 바닥", source: "user" });
      expect(tileset.tileMeta?.[1]).toMatchObject({ label: "잠근 벽", userLocked: true });
      expect(tileset.passability[270]).toEqual({ up: true, down: true, left: true, right: true });
      expect(tileset.passability[1]).toEqual({ up: false, down: false, left: false, right: false });
    });
  });
});
