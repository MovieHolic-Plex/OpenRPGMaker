import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { resolveCommandKind } from "@/editor/tools/eventCompile";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject, createBlankMap, createBlankProject as createBlankDefaultProject } from "@/project/defaults";
import { TILE, DEFAULT_TILESET_ID, DEFAULT_ITEM_ID, DEFAULT_TROOP_ID, CASTLE_TILESET_TEXTURE_KEY, COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import type { Project, AiDocument, GameEvent, GameMap, Rect, TileGroupMetadata, ClusterRule, TilesetDef, Command, EventPage, Trigger, MapLayoutPlan } from "@/project/types";
import { type ToolContext, ToolError } from "@/editor/tools/types";
import { deserialize, serialize } from "@/project/io";
import { getTool, type ToolResult } from "@/editor/tools";
import { isPassable, canMove, canMoveFootprint, getTileset } from "@/project/collision";
import { formatViewportContextBlock } from "@/ai/mapViewportContext";
import { createBattleRuntime } from "@/battle/runtime";
import { commandPanel, type BattleCommandPanelOptions } from "@/player/battleCommandDom";
import { applyBattleDirectorState, commandPromptState } from "@/player/battleDirectorDom";
import { noEscapeInlineReason, noEscapeNoticeLine } from "@/player/emeraldBattleNarration";
import { store } from "@/project/store";
import { installFakeDom, type FakeElement } from "./fakeDom";
import type Phaser from "phaser";
import { registerTilesetTextureFrames } from "@/assets/bundled";
import { isDestructiveOutcome, removedMapIds } from "@/ai/approvalPolicy";
import { reviewOverInsertion } from "@/ai/overInsertionReview";
import type { ProposedCall } from "@/ai/assistantSession";
import { completedHouseProject } from "./fixtures/completedHouse";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { commitChangeset } from "@/editor/tools/changeset";
import { withRetiredCombinedTownMaps } from "./support/retiredCombinedTownMaps";
import { ensureConceptBundles, liveBundlesForTileset } from "@/editor/conceptBundleResolve";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { withRetiredEasyRpgTilesets, retiredEasyRpgTileset, startOnRetiredCombinedTown, RETIRED_COMBINED_TOWN_TILESET_ID } from "./support/retiredEasyRpgTilesets";
import { buildClusterEditKickoff } from "@/ai/clusterAssistPrompt";
import { buildGroupSample } from "@/ai/groupSampleBuilder";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { addMapLocation, deleteMapLocation, resizeMapLocation, mapLocations } from "@/project/mapNamedLocations";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { drainPendingLocationTransitions, fireLocationTransitionTriggers, fireLocationTransitionTriggersAfterTransfer, seedLocationOccupancyForScene } from "@/player/playSceneLocationTransitions";
import { cloneGameMap } from "@/project/mapClone";
import { findLayoutRegions, rankRegionsByCenter } from "@/project/mapLayoutPlan";
import { canTravelBetweenMaps, firstStandableCell } from "@/testing/mapTravelReachability";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { applyGenrePreset } from "@/project/genrePresets";
import { tilesetFamily } from "@/project/tilesetFamily";
import { advanceFieldSpawns, createFieldSpawnRuntime, fieldSpawnAliveCount, materializeFieldSpawnEvents, resolveFieldSpawnVictory } from "@/player/fieldSpawns";
import { eligibleEncounterEntries, pickWeightedEncounterTroop } from "@/player/encounters";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";
import { startSession, setMapTileOverride } from "@/project/session";
import { mulberry32 } from "@/util/rng";
import { createPhase8bHuntingFixture, HUNTING_PROMOTED_CLASS_ID, HUNTING_PROMOTION_SWITCH_ID, phase8bPromotionEvent } from "./fixtures/huntingPhase8bFixture";
import { findChasePath, nextChaseDecision } from "@/player/chaseAi";
import { updateNpcSchedules, tickNpcSchedules, NPC_SCHEDULE_TICK_MS } from "@/player/npcSchedules";
import { updateAutonomousNPCs } from "@/player/playSceneAutonomous";
import { applyMapOverrides } from "@/player/playSceneMapRuntime";
import { registerPageMoveRoutes } from "@/player/playScenePageMoveRoutes";
import { registerAutonomousMover } from "@/player/playSceneSchedulers";
import { mapWithCommittedEvents } from "@/project/eventDrafts";
import { initialGameTime, setGameTimeClock } from "@/project/gameTime";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { invalidateTilePassabilityComponents, terrainMayReach } from "@/project/tilePassabilityComponents";
import { setPassageMark } from "@/project/tilesetPassage";
import type { AutonomousMover } from "@/player/playSceneTypes";
import { mockSprite } from "./runtimeEventPageFixtures";
import { createTransitSim, type TransitSim } from "@/project/mapTransit";
import { allTools } from "@/editor/tools/toolRegistry";
import { isolateTimers } from "./mergedTeardown";

describe("aiDocTools", () => {
  isolateTimers();
  // test/agentToolFollowups.test.ts
  //
  // 2026-08-28 실측(project oprn-4f65d09fb1, "음 다른맵을 더 만들자")에서 같이 드러난 결함들:
  //  - evaluate_game_quality 가 맵 **개수만** 세어 잔디 단색 맵 2장을 통과시켰다.
  //  - create_transfer_pair 가 3연속 실패했는데 안내는 원인과 무관하게 "주변 구조물·통행 지형 확인"이었다.
  //  - place_npc 가 kind:"dialogue" 로 한 번 튕겨 라운드를 낭비했다.
  describe("agentToolFollowups", () => {
    isolateTimers();
    function ctxWithMap(mapId: string, name = "숲길", size = 8): { project: Project } {
      const ctx = { project: createEmptyToolProject() };
      const result = runTool(ctx, "create_map", { id: mapId, name, width: size, height: size }, { dryRun: false });
      expect(result.ok).toBe(true);
      return ctx;
    }
    type QualityData = {
      verdict: { blocked: boolean };
      coverage: { content: { emptyMaps: number } };
    };
    const emptyMapIssueFor = (
      result: { issues?: readonly { code: string; mapId?: string; severity: string }[] },
      mapId: string,
    ) =>
      result.issues?.find((issue) => issue.code === "empty-map" && issue.mapId === mapId);
    describe("evaluate_game_quality — 빈 맵 감지", () => {
      /** 시작 맵 + 저작 중 만든 빈 맵. 실측 상황(마을 프로젝트에 잔디밭이 추가됨)과 같은 모양. */
      function ctxWithStartAndEmptyMap(): { project: Project } {
        const ctx = ctxWithMap("m_start", "마을");
        ctx.project.maps.m_start!.lowerTiles[0] = TILE.PATH; // 시작 맵은 저작된 상태로 둔다
        expect(runTool(ctx, "create_map", { id: "m_field", name: "숲길", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
        return ctx;
      }

      it("저작 중 만든 빈 맵을 차단 오류로 올리고 개수를 보고한다", () => {
        const result = runTool(ctxWithStartAndEmptyMap(), "evaluate_game_quality", {}, { dryRun: true });

        expect(result.ok).toBe(true);
        const data = result.data as QualityData;
        expect(data.coverage.content.emptyMaps).toBe(1);
        expect(data.verdict.blocked).toBe(true);
        expect(result.summary).toContain("빈 맵");
        expect(emptyMapIssueFor(result, "m_field")?.severity).toBe("error");
      });

      it("시작 맵만 비어 있는 새 프로젝트는 차단하지 않는다(warning)", () => {
        const ctx = { project: createBlankProject() };
        const startMapId = ctx.project.startMapId;
        const result = runTool(ctx, "evaluate_game_quality", {}, { dryRun: true });

        expect(emptyMapIssueFor(result, startMapId)?.severity).toBe("warning");
        expect((result.data as QualityData).verdict.blocked).toBe(false);
      });

      it("지형을 칠하면 빈 맵 오류가 사라진다", () => {
        const ctx = ctxWithStartAndEmptyMap();
        ctx.project.maps.m_field!.lowerTiles[0] = TILE.PATH;
        const result = runTool(ctx, "evaluate_game_quality", {}, { dryRun: true });

        expect(emptyMapIssueFor(result, "m_field")).toBeUndefined();
        expect((result.data as QualityData).coverage.content.emptyMaps).toBe(0);
        expect((result.data as QualityData).verdict.blocked).toBe(false);
      });
    });
    describe("create_transfer_pair — 실패 원인별 안내", () => {
      it("맵 밖 좌표는 맵 크기를 알려준다", () => {
        const ctx = ctxWithMap("m_a");
        runTool(ctx, "create_map", { id: "m_b", name: "여관", width: 8, height: 8 }, { dryRun: false });

        const result = runTool(
          ctx,
          "create_transfer_pair",
          { a: { mapId: "m_a", x: 99, y: 99 }, b: { mapId: "m_b", x: 4, y: 4 } },
          { dryRun: true },
        );

        expect(result.ok).toBe(false);
        const message = result.issues?.map((issue) => issue.message).join(" ") ?? result.summary;
        expect(message).toContain("A:");
        expect(message).toContain("맵 밖");
        expect(message).toContain("0..7");
        // 원인과 무관하던 종전 안내는 더 이상 나오지 않는다.
        expect(message).not.toContain("get_map_region으로 주변 구조물과 통행 지형을 확인");
      });

      it("실패한 쪽이 A/B 중 어디인지 짚는다", () => {
        const ctx = ctxWithMap("m_a");
        runTool(ctx, "create_map", { id: "m_b", name: "여관", width: 8, height: 8 }, { dryRun: false });

        const result = runTool(
          ctx,
          "create_transfer_pair",
          { a: { mapId: "m_a", x: 4, y: 4 }, b: { mapId: "m_b", x: -99, y: -99 } },
          { dryRun: true },
        );

        expect(result.ok).toBe(false);
        const message = result.issues?.map((issue) => issue.message).join(" ") ?? result.summary;
        expect(message).toContain("B:");
        expect(message).not.toContain("A:");
      });
    });
    describe("resolveCommandKind — 커맨드 kind 오표기 흡수", () => {
      it("정규 이름은 그대로 둔다", () => {
        expect(resolveCommandKind("text")).toBe("text");
        expect(resolveCommandKind("setSelfSwitch")).toBe("setSelfSwitch");
      });

      it("실측 오표기 dialogue 를 text 로 해석한다", () => {
        expect(resolveCommandKind("dialogue")).toBe("text");
      });

      it("구분자·대소문자만 다른 표기를 되돌린다", () => {
        expect(resolveCommandKind("change_gold")).toBe("changeGold");
        expect(resolveCommandKind("Change-Gold")).toBe("changeGold");
        expect(resolveCommandKind("TEXT")).toBe("text");
      });

      it("모르는 이름은 null 로 남겨 오류를 내게 한다", () => {
        expect(resolveCommandKind("teleportPlayerToTheMoon")).toBeNull();
        expect(resolveCommandKind("")).toBeNull();
      });
    });
    describe("place_npc — dialogue 표기로도 통과한다", () => {
      it("kind:\"dialogue\" 를 text 로 정규화해 배치가 성공한다", () => {
        const ctx = ctxWithMap("m_town", "마을", 12);
        const result = runTool(
          ctx,
          "place_npc",
          {
            mapId: "m_town",
            name: "상점 주인",
            x: 5,
            y: 5,
            pages: [{ commands: [{ kind: "dialogue", body: "어서 오세요" }] }],
          },
          { dryRun: false },
        );

        expect(result.ok).toBe(true);
        const placed = ctx.project.maps.m_town!.events.at(-1);
        expect(placed?.pages?.[0]?.commands?.some((command) => command.kind === "text")).toBe(true);
      });
    });
  });
  describe("aiDocTools", () => {
    isolateTimers();
    // New projects carry the default tileset instead of the retired EasyRPG interior sheet (2026-10-07 purge).
    const INTERIOR = DEFAULT_TILESET_ID;
    function ctxOf(): ToolContext {
      return { project: createBlankProject() };
    }
    describe("present_doc — AI 리치 문서 툴", () => {
      it("구조화 블록 문서를 만들어 project.aiDocuments에 영속하고 data.document로 반환한다", () => {
        const ctx = ctxOf();
        const result = runTool(ctx, "present_doc", {
          title: "오토타일 블록 안내",
          blocks: [
            { kind: "markdown", text: "## 다크월\n칩셋 6~8열 12~15행" },
            {
              kind: "sheetMap",
              tilesetId: INTERIOR,
              zones: [{ col: 6, row: 12, w: 3, h: 4, label: "다크월" }],
            },
            { kind: "tileBlockCard", tilesetId: INTERIOR, col: 6, row: 12, w: 3, h: 4, title: "다크월 블록", badge: "구현됨" },
            { kind: "paintDemo", tilesetId: INTERIOR, blockCol: 6, blockRow: 12 },
            { kind: "table", headers: ["타일", "역할"], rows: [["368", "오목 코너 소스"]] },
            { kind: "html", src: "<p>자유형 블록</p>" },
          ],
        });
        expect(result.ok).toBe(true);
        const docs = ctx.project.aiDocuments ?? [];
        expect(docs).toHaveLength(1);
        expect(docs[0]!.title).toBe("오토타일 블록 안내");
        expect(docs[0]!.blocks).toHaveLength(6);
        const data = result.data as { document: AiDocument };
        expect(data.document.id).toMatch(/^aidoc_/);
        expect(data.document.blocks[0]).toMatchObject({ kind: "markdown" });
      });

      it("알 수 없는 블록 kind와 없는 타일셋을 거부한다", () => {
        const ctx = ctxOf();
        expect(runTool(ctx, "present_doc", { title: "x", blocks: [{ kind: "video", src: "x" }] }).ok).toBe(false);
        expect(
          runTool(ctx, "present_doc", {
            title: "x",
            blocks: [{ kind: "tileBlockCard", tilesetId: "no_such_tileset", col: 0, row: 0, w: 1, h: 1, title: "t" }],
          }).ok,
        ).toBe(false);
        expect(ctx.project.aiDocuments ?? []).toHaveLength(0);
      });

      it("list_ai_docs가 저장된 문서 목록을 반환한다", () => {
        const ctx = ctxOf();
        runTool(ctx, "present_doc", { title: "문서 1", blocks: [{ kind: "markdown", text: "hello" }] });
        runTool(ctx, "present_doc", { title: "문서 2", blocks: [{ kind: "markdown", text: "world" }] });
        const result = runTool(ctx, "list_ai_docs", {});
        expect(result.ok).toBe(true);
        const data = result.data as { documents: { title: string; blockCount: number }[] };
        expect(data.documents.map((doc) => doc.title)).toEqual(["문서 1", "문서 2"]);
      });

      it("list_ai_docs가 query로 제목·마크다운 본문을 부분일치 검색한다(대소문자 무시)", () => {
        const ctx = ctxOf();
        runTool(ctx, "present_doc", { title: "오토타일 안내", blocks: [{ kind: "markdown", text: "다크월 블록 구조" }] });
        runTool(ctx, "present_doc", { title: "NPC Guide", blocks: [{ kind: "markdown", text: "주민 배치 요령" }] });

        const byTitle = runTool(ctx, "list_ai_docs", { query: "npc" });
        expect(byTitle.ok).toBe(true);
        expect((byTitle.data as { documents: { title: string }[] }).documents.map((doc) => doc.title)).toEqual(["NPC Guide"]);

        const byBody = runTool(ctx, "list_ai_docs", { query: "다크월" });
        expect((byBody.data as { documents: { title: string }[] }).documents.map((doc) => doc.title)).toEqual(["오토타일 안내"]);

        const miss = runTool(ctx, "list_ai_docs", { query: "존재하지않음" });
        expect((miss.data as { documents: unknown[] }).documents).toHaveLength(0);
      });

      it("aiDocuments가 직렬화 왕복에서 보존된다", () => {
        const ctx = ctxOf();
        runTool(ctx, "present_doc", {
          title: "왕복 문서",
          blocks: [
            { kind: "markdown", text: "지속성 테스트" },
            { kind: "tileBlockCard", tilesetId: INTERIOR, col: 0, row: 12, w: 3, h: 4, title: "산울타리" },
          ],
        });
        const restored = deserialize(serialize(ctx.project));
        expect(restored.aiDocuments).toHaveLength(1);
        expect(restored.aiDocuments?.[0]).toMatchObject({ title: "왕복 문서" });
        expect(restored.aiDocuments?.[0]?.blocks).toHaveLength(2);
      });
    });
  });
  describe("aiEventPlacementPassability", () => {
    isolateTimers();
    // AI 배치 툴이 캐릭터형 이벤트(몬스터·추격자·NPC)를 통행 불가 타일에 올리는 버그 계약.
    // RM2K3 의미: action 트리거 이벤트는 벽 위에 있어도 되지만(문·간판), 인접 칸 중 하나는 통행 가능해야 한다.
    function fixture(): { project: Project; map: GameMap; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      return { project, map, mapId };
    }
    function setWall(map: GameMap, x: number, y: number): void {
      map.lowerTiles[y * map.width + x] = TILE.WALL;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    /** (cx,cy) 중심 체비셰프 반경 radius 전체를 벽으로 만든다. */
    function wallBlock(map: GameMap, cx: number, cy: number, radius: number): void {
      for (let y = cy - radius; y <= cy + radius; y += 1) {
        for (let x = cx - radius; x <= cx + radius; x += 1) {
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
          setWall(map, x, y);
        }
      }
    }
    function eventById(map: GameMap, id: string): GameEvent {
      const found = map.events.find((entry) => entry.id === id);
      if (!found) throw new Error(`event not found: ${id}`);
      return found;
    }
    function troopId(project: Project): string {
      const id = project.database.troops[0]?.id;
      if (!id) throw new Error("fixture troop missing");
      return id;
    }
    describe("place_battle_blocker 통행 가능 착지", () => {
      it("벽 위에 몬스터를 요청하면 근처 통행 가능 칸으로 자동 착지한다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 5, 5);
        expect(isPassable(project, map, 5, 5)).toBe(false);

        const result = getTool("place_battle_blocker")!.run(project, { mapId, x: 5, y: 5, troopId: troopId(project) });

        const data = result.data as { eventId: string; x: number; y: number; adjusted: boolean };
        const event = eventById(map, data.eventId);
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(data.adjusted).toBe(true);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("반경 5칸이 전부 벽이면 battle-blocker-impassable ToolError", () => {
        const { project, map, mapId } = fixture();
        // nearestPassableCell now searches a clean landing up to radius 5 before failing (#2894), so the blocked area must cover radius 5.
        wallBlock(map, 8, 7, 5);

        let error: unknown;
        try {
          getTool("place_battle_blocker")!.run(project, { mapId, x: 8, y: 7, troopId: troopId(project) });
        } catch (caught) {
          error = caught;
        }
        expect(error).toBeInstanceOf(ToolError);
        expect((error as ToolError).code).toBe("battle-blocker-impassable");
        expect((error as ToolError).message).toContain("(8, 7)");
        expect((error as ToolError).message).toContain("get_map_region");
        expect(map.events).toHaveLength(0);
      });

      it("추격자도 통행 가능 칸으로 착지한다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 6, 6);

        const result = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 6, y: 6 } } });

        const data = result.data as { eventId: string; adjusted: boolean };
        const event = eventById(map, data.eventId);
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(data.adjusted).toBe(true);
      });
    });
    describe("상호작용 이벤트는 문 의미를 지킨다", () => {
      it("통행 가능 이웃이 있는 벽 위 보물상자는 옮기지 않는다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 4, 4);

        const itemId = project.database.items[0]?.id ?? "item_potion";
        const result = getTool("place_chest")!.run(project, { mapId, x: 4, y: 4, contents: { itemId } });

        const data = result.data as { eventId: string; x: number; y: number; adjusted: boolean };
        expect([data.x, data.y]).toEqual([4, 4]);
        expect(data.adjusted).toBe(false);
        const event = eventById(map, data.eventId);
        expect([event.x, event.y]).toEqual([4, 4]);
      });

      it("사방이 벽으로 막힌 보물상자는 자동 조정되거나 ToolError", () => {
        const { project, map, mapId } = fixture();
        wallBlock(map, 8, 7, 1);

        const itemId = project.database.items[0]?.id ?? "item_potion";
        let error: ToolError | undefined;
        let data: { eventId: string; x: number; y: number; adjusted: boolean } | undefined;
        try {
          const result = getTool("place_chest")!.run(project, { mapId, x: 8, y: 7, contents: { itemId } });
          data = result.data as typeof data;
        } catch (caught) {
          if (!(caught instanceof ToolError)) throw caught;
          error = caught;
        }
        if (error) {
          expect(error.code).toBe("chest-impassable");
          expect(error.message).toContain("get_map_region");
        } else {
          expect(data?.adjusted).toBe(true);
          const event = eventById(map, data!.eventId);
          expect(isPassable(project, map, event.x, event.y)).toBe(true);
        }
      });

      it("touch 트랩은 밟을 수 있어야 하므로 벽에서 통행 가능 칸으로 옮긴다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 7, 3);

        const result = getTool("place_trap")!.run(project, { mapId, cells: [{ x: 7, y: 3 }], trigger: "touch" });

        const data = result.data as { eventIds: string[]; adjusted: boolean };
        const event = eventById(map, data.eventIds[0]);
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(data.adjusted).toBe(true);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });
    });
    describe("이동·복제·upsert 배치", () => {
      it("move_event로 벽으로 옮기면 통행 가능 칸으로 자동 조정한다", () => {
        const { project, map, mapId } = fixture();
        map.events.push({
          id: "ev_walker",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            {
              id: "ev_walker_page",
              name: "주민",
              conditions: [],
              graphic: { transparent: true },
              trigger: { kind: "playerTouch" },
              priority: "below",
              overlapForbidden: false,
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
            },
          ],
        });
        setWall(map, 9, 9);

        const result = getTool("move_event")!.run(project, { mapId, eventId: "ev_walker", x: 9, y: 9 });

        const data = result.data as { x: number; y: number; adjusted: boolean };
        expect(data.adjusted).toBe(true);
        const event = eventById(map, "ev_walker");
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("upsert_event로 새 이벤트를 벽에 만들면 자동 조정한다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 2, 6);

        const result = getTool("upsert_event")!.run(project, {
          mapId,
          event: {
            id: "ev_new_guard",
            x: 2,
            y: 6,
            trigger: { kind: "playerTouch" },
            commands: [],
            pages: [
              {
                id: "ev_new_guard_page",
                name: "경비",
                conditions: [],
                graphic: { transparent: true },
                trigger: { kind: "playerTouch" },
                priority: "below",
                overlapForbidden: false,
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
        });

        const data = result.data as { eventId: string; x: number; y: number; adjusted: boolean };
        expect(data.adjusted).toBe(true);
        const event = eventById(map, "ev_new_guard");
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
      });

      it("upsert_event 부분 병합은 기존 이벤트 좌표를 절대 바꾸지 않는다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 3, 8);
        map.events.push({
          id: "ev_door",
          x: 3,
          y: 8,
          trigger: { kind: "action" },
          commands: [],
          pages: [],
        });

        getTool("upsert_event")!.run(project, { mapId, event: { id: "ev_door", pages: [] } });

        const event = eventById(map, "ev_door");
        expect([event.x, event.y]).toEqual([3, 8]);
      });
    });
    describe("place_examine_hotspots 도달 가능성", () => {
      it("사방이 벽으로 갇힌 조사 핫스팟은 통행 가능 칸으로 착지하거나 skip 된다", () => {
        const { project, map, mapId } = fixture();
        wallBlock(map, 9, 9, 1);
    globalThis.result = getTool("place_examine_hotspots")!.run(project, {
          mapId,
          hotspots: [{ at: { x: 9, y: 9 }, name: "갇힌 액자", lines: ["먼지가 쌓여 있다."] }],
        });
    globalThis.placed = map.events.filter((event) => event.id.startsWith("ev_examine"));
        for (const event of placed) {
    globalThis.reachable = [
            { x: event.x, y: event.y },
            { x: event.x, y: event.y + 1 },
            { x: event.x, y: event.y - 1 },
            { x: event.x + 1, y: event.y },
            { x: event.x - 1, y: event.y },
          ].some((cell) => isPassable(project, map, cell.x, cell.y));
          expect(reachable).toBe(true);
        }
        expect(result.warnings?.some((warning) => warning.includes("(9, 9)"))).toBe(true);
      });

      it("통행 가능 이웃이 있는 벽 위 조사 핫스팟은 그대로 둔다", () => {
        const { project, map, mapId } = fixture();
        setWall(map, 12, 12);

        getTool("place_examine_hotspots")!.run(project, {
          mapId,
          hotspots: [{ at: { x: 12, y: 12 }, name: "벽에 걸린 액자", lines: ["오래된 그림이다."] }],
        });
    globalThis.placed = map.events.filter((event) => event.id.startsWith("ev_examine"));
        expect(placed).toHaveLength(1);
        expect(placed[0].x).toBe(12);
        expect(placed[0].y).toBe(12);
      });
    });
  });
  describe("aiMapContextPassability", () => {
    isolateTimers();
    // 자동 주입 뷰포트 블록이 isPassable 과 같은 판정으로 통행 불가 칸을 기계가 읽을 수 있게 표시하는지.
    // 포맷 계약: `pass:x,y` 다음 h줄이 각 행. 칸마다 한 글자, `#`=불가 `.`=가능.
    // 산문 문구가 아니라 파싱된 마커·좌표만 검증한다.

    const BLOCKED = "#";
    const OPEN = ".";
    const ORIGIN_RE = /^pass:(\d+),(\d+)$/;
    const ROW_RE = /^[.#]+$/;
    function fixture(): { project: Project; map: GameMap; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      return { project, map, mapId };
    }
    function setTile(map: GameMap, x: number, y: number, tile: number): void {
      map.lowerTiles[y * map.width + x] = tile;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    function parsePassabilityGrid(block: string): {
      originX: number;
      originY: number;
      rows: string[];
    } | null {
      const lines = block.split("\n");
      const originAt = lines.findIndex((line) => ORIGIN_RE.test(line));
      if (originAt < 0) return null;
      const match = ORIGIN_RE.exec(lines[originAt]);
      if (!match) return null;
      const rows: string[] = [];
      for (let i = originAt + 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (!ROW_RE.test(line)) break;
        rows.push(line);
      }
      if (rows.length === 0) return null;
      return { originX: Number(match[1]), originY: Number(match[2]), rows };
    }
    function markAt(
      grid: { originX: number; originY: number; rows: string[] },
      x: number,
      y: number,
    ): string {
      const row = grid.rows[y - grid.originY];
      if (row === undefined) throw new Error(`row missing for y=${y}`);
      const ch = row[x - grid.originX];
      if (ch === undefined) throw new Error(`col missing for x=${x}`);
      return ch;
    }
    describe("뷰포트 컨텍스트 통행 불가 표시", () => {
      it("물이 있는 뷰포트는 해당 칸을 # 마커로 표시한다", () => {
        const { project, map, mapId } = fixture();
        setTile(map, 2, 1, TILE.WATER);
        setTile(map, 3, 2, TILE.WALL);
        expect(isPassable(project, map, 2, 1)).toBe(false);
        expect(isPassable(project, map, 3, 2)).toBe(false);
        expect(isPassable(project, map, 1, 1)).toBe(true);

        const viewport = {
          mapId,
          centerX: 2,
          centerY: 2,
          x: 1,
          y: 1,
          w: 4,
          h: 3,
        };
        const block = formatViewportContextBlock(viewport, map.name, project);
        const grid = parsePassabilityGrid(block);
        expect(grid).not.toBeNull();
        expect(grid!.originX).toBe(1);
        expect(grid!.originY).toBe(1);
        expect(markAt(grid!, 2, 1)).toBe(BLOCKED);
        expect(markAt(grid!, 3, 2)).toBe(BLOCKED);
        expect(markAt(grid!, 1, 1)).toBe(OPEN);
        expect(markAt(grid!, 4, 3)).toBe(OPEN);
      });

      it("전부 통행 가능한 뷰포트에는 # 마커가 없다", () => {
        const { project, map, mapId } = fixture();
        const viewport = {
          mapId,
          centerX: 3,
          centerY: 3,
          x: 0,
          y: 0,
          w: 5,
          h: 4,
        };
        for (let y = 0; y < viewport.h; y += 1) {
          for (let x = 0; x < viewport.w; x += 1) {
            expect(isPassable(project, map, x, y)).toBe(true);
          }
        }

        const block = formatViewportContextBlock(viewport, map.name, project);
        const grid = parsePassabilityGrid(block);
        expect(grid).not.toBeNull();
        expect(grid!.rows.join("")).not.toContain(BLOCKED);
        expect(grid!.rows.every((row) => [...row].every((ch) => ch === OPEN))).toBe(true);
      });

      it("추가 비용은 칸당 한 글자·행당 한 줄로 묶인다", () => {
        const { project, map, mapId } = fixture();
        setTile(map, 5, 5, TILE.WATER);
        const viewport = {
          mapId,
          centerX: 8,
          centerY: 6,
          x: 2,
          y: 2,
          w: 10,
          h: 8,
        };
        const base = formatViewportContextBlock(viewport, map.name);
        const block = formatViewportContextBlock(viewport, map.name, project);
        const grid = parsePassabilityGrid(block);
        expect(grid).not.toBeNull();
        expect(grid!.rows).toHaveLength(viewport.h);
        for (const row of grid!.rows) {
          expect(row).toHaveLength(viewport.w);
        }
        const added = block.length - base.length;
        const originOverhead = 24;
        expect(added).toBeLessThanOrEqual(viewport.w * viewport.h + viewport.h + originOverhead);
      });
    });
  });
  describe("aiPlacementCopyRegion", () => {
    isolateTimers();
    const SOURCE_MAP_ID = "map_blank_start";
    const TARGET_MAP_ID = "map_copy_target";
    function fixture(): { project: Project; source: GameMap; target: GameMap } {
      const project = createBlankProject();
      getTool("create_map")!.run(project, { id: TARGET_MAP_ID, name: "복사 대상", width: 20, height: 15 });
      return {
        project,
        source: project.maps[SOURCE_MAP_ID],
        target: project.maps[TARGET_MAP_ID],
      };
    }
    function characterEvent(id: string, x: number, y: number): GameEvent {
      return {
        id,
        x,
        y,
        trigger: { kind: "playerTouch" },
        commands: [],
      };
    }
    function setLower(map: GameMap, x: number, y: number, tile: number): void {
      map.lowerTiles[y * map.width + x] = tile;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    describe("copy_map_region 이벤트 통행 가능 착지", () => {
      it("목적 좌표가 물인 캐릭터형 이벤트는 통행 가능 칸에 착지한다", () => {
        const { project, source, target } = fixture();
        source.events.push(characterEvent("ev_source_guard", 3, 3));
        setLower(target, 9, 9, TILE.WATER);
        expect(isPassable(project, target, 9, 9)).toBe(false);

        const result = getTool("copy_map_region")!.run(project, {
          from: { mapId: SOURCE_MAP_ID, x: 2, y: 2, w: 3, h: 3 },
          to: { mapId: TARGET_MAP_ID, x: 8, y: 8 },
          layers: "upper",
          withEvents: true,
        });

        const copiedIds = (result.data as { events: string[] }).events;
        expect(copiedIds).toHaveLength(1);
        const clone = target.events.find((event) => event.id === copiedIds[0]);
        expect(clone).toBeDefined();
        expect(isPassable(project, target, clone!.x, clone!.y)).toBe(true);
      });

      it("실제 place_npc 이벤트를 물 위로 복사하면 통행 가능 칸에 착지시킨다", () => {
        const { project, target } = fixture();
        getTool("place_npc")!.run(project, {
          mapId: SOURCE_MAP_ID,
          x: 3,
          y: 3,
          id: "ev_source_npc",
          name: "강가 주민",
          graphic: { query: "people1" },
          pages: [{ text: "안녕하세요." }],
        });
        setLower(target, 9, 9, TILE.WATER);

        const result = getTool("copy_map_region")!.run(project, {
          from: { mapId: SOURCE_MAP_ID, x: 2, y: 2, w: 3, h: 3 },
          to: { mapId: TARGET_MAP_ID, x: 8, y: 8 },
          layers: "upper",
          withEvents: true,
        });

        const copiedIds = (result.data as { events: string[] }).events;
        const clone = target.events.find((event) => event.id === copiedIds[0]);
        expect(clone).toBeDefined();
        expect(isPassable(project, target, clone!.x, clone!.y)).toBe(true);
        expect([clone!.x, clone!.y]).not.toEqual([9, 9]);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("통행 가능한 평지에서는 모든 이벤트의 상대 좌표를 그대로 보존한다", () => {
        const { project, source, target } = fixture();
        source.events.push(characterEvent("ev_source_left", 3, 4), characterEvent("ev_source_right", 6, 6));

        const result = getTool("copy_map_region")!.run(project, {
          from: { mapId: SOURCE_MAP_ID, x: 2, y: 3, w: 6, h: 5 },
          to: { mapId: TARGET_MAP_ID, x: 10, y: 7 },
          withEvents: true,
        });

        const copiedIds = (result.data as { events: string[] }).events;
        expect(copiedIds).toHaveLength(2);
        expect(target.events.filter((event) => copiedIds.includes(event.id)).map((event) => [event.x, event.y])).toEqual([
          [11, 8],
          [14, 10],
        ]);
        for (const event of target.events.filter((entry) => copiedIds.includes(entry.id))) {
          expect(isPassable(project, target, event.x, event.y)).toBe(true);
        }
      });
    });
    describe("지형 편집으로 고립된 이벤트 경고", () => {
      it("기존 NPC 칸을 물로 칠하면 이벤트 id와 좌표를 경고한다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId];
        map.events.push(characterEvent("ev_stranded_guard", 4, 5));

        const result = getTool("paint_tiles")!.run(project, {
          mapId: map.id,
          layer: "lower",
          mode: "cells",
          tile: TILE.WATER,
          cells: [{ x: 4, y: 5 }],
        });

        expect(isPassable(project, map, 4, 5)).toBe(false);
        const warning = result.warnings?.find((entry) => entry.includes("통행 불가"));
        expect(warning).toContain("ev_stranded_guard");
        expect(warning).toContain("(4,5)");
      });

      it("이벤트가 없는 칸은 기존 통행 불가 칸 수 경고 문구를 유지한다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId];

        const result = getTool("paint_tiles")!.run(project, {
          mapId: map.id,
          layer: "lower",
          mode: "cells",
          tile: TILE.WATER,
          cells: [{ x: 7, y: 6 }],
        });

        expect(isPassable(project, map, 7, 6)).toBe(false);
        expect(result.warnings).toContain(`경고: 1개 칸이 통행 불가가 되었습니다(${map.id}).`);
      });
    });
  });
  describe("aiPlacementCutsceneCheckpoint", () => {
    isolateTimers();
    // script_cutscene / 맵 진입 체크포인트가 물·벽 위에 서는 버그 계약.
    // 체크포인트는 auto 트리거라 밟을 필요는 없지만 지형 안에 심으면 event-unreachable 린트가 난다.
    // 컷신은 트리거에 따라 갈린다: playerTouch/touch 는 밟을 수 있어야 하고, action 은 인접 통행 가능 칸만 있으면 된다.

    function fixture(): { project: Project; map: GameMap; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      return { project, map, mapId };
    }
    function setWater(map: GameMap, x: number, y: number): void {
      map.lowerTiles[y * map.width + x] = TILE.WATER;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    function eventById(map: GameMap, id: string): GameEvent {
      const found = map.events.find((entry) => entry.id === id);
      if (!found) throw new Error(`event not found: ${id}`);
      return found;
    }
    function checkpointId(map: GameMap): string {
      return `${map.id}_checkpoint_auto`;
    }
    function placeCheckpoint(project: Project, mapId: string, trapAt: { x: number; y: number }): void {
      getTool("place_trap")!.run(project, {
        mapId,
        cells: [trapAt],
        trigger: "touch",
        respawnCheckpoint: true,
      });
    }
    const SAY_BEAT = { kind: "say" as const, speaker: "나", text: "그날을 기억한다." };
    describe("ensureMapCheckpointEvent 통행 가능 착지", () => {
      it("(0,0)이 물이면 체크포인트 auto 이벤트는 통행 가능 칸에 착지한다", () => {
        const { project, map, mapId } = fixture();
        setWater(map, 0, 0);
        expect(isPassable(project, map, 0, 0)).toBe(false);

        placeCheckpoint(project, mapId, { x: 5, y: 5 });

        const checkpoint = eventById(map, checkpointId(map));
        expect(isPassable(project, map, checkpoint.x, checkpoint.y)).toBe(true);
      });

      it("일반 맵에서는 체크포인트가 기존처럼 (0,0)에 선다", () => {
        const { project, map, mapId } = fixture();
        expect(isPassable(project, map, 0, 0)).toBe(true);

        placeCheckpoint(project, mapId, { x: 5, y: 5 });

        const checkpoint = eventById(map, checkpointId(map));
        expect([checkpoint.x, checkpoint.y]).toEqual([0, 0]);
      });

      // auto 트리거는 좌표와 무관하게 발동하므로, 좌상단 반경 3이 전부 막혔다고 트랩 배치 전체를
      // 실패시키면 고치려던 버그보다 나쁘다(동굴·두꺼운 벽 맵에서 place_trap 이 통째로 죽는다).
      it("좌상단 반경 3이 전부 막힌 맵에서도 트랩 배치는 성공하고 체크포인트가 남는다", () => {
        const { project, map, mapId } = fixture();
        for (let y = 0; y <= 3; y += 1) {
          for (let x = 0; x <= 3; x += 1) setWater(map, x, y);
        }
        expect(isPassable(project, map, 0, 0)).toBe(false);
        expect(isPassable(project, map, 3, 3)).toBe(false);

        expect(() => placeCheckpoint(project, mapId, { x: 8, y: 8 })).not.toThrow();

        const checkpoint = eventById(map, checkpointId(map));
        expect(isPassable(project, map, checkpoint.x, checkpoint.y)).toBe(true);
        expect(map.events.some((event) => event.id.startsWith("ev_trap"))).toBe(true);
      });
    });
    describe("script_cutscene 통행 가능 착지", () => {
      it("물 위 playerTouch 컷신은 통행 가능 칸에 착지한다", () => {
        const { project, map, mapId } = fixture();
        setWater(map, 5, 5);
        expect(isPassable(project, map, 5, 5)).toBe(false);

        const result = getTool("script_cutscene")!.run(project, {
          mapId,
          x: 5,
          y: 5,
          trigger: "playerTouch",
          beats: [SAY_BEAT],
        });

        const data = result.data as { eventId: string };
        const event = eventById(map, data.eventId);
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
      });

      it("물 위 기존 action 컷신에 playerTouch 페이지를 더하면 이벤트를 통행 가능 칸으로 옮긴다", () => {
        const { project, map, mapId } = fixture();
        setWater(map, 5, 5);

        getTool("script_cutscene")!.run(project, {
          mapId,
          eventId: "ev_existing_water",
          x: 5,
          y: 5,
          trigger: "action",
          beats: [SAY_BEAT],
        });
        const result = getTool("script_cutscene")!.run(project, {
          mapId,
          eventId: "ev_existing_water",
          mode: "append",
          trigger: "playerTouch",
          beats: [{ kind: "say", speaker: "나", text: "밟으면 시작한다." }],
        });

        const event = eventById(map, "ev_existing_water");
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect(event.pages).toHaveLength(2);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("통행 가능 이웃이 있는 물 위 action 컷신은 작성 좌표를 유지한다", () => {
        const { project, map, mapId } = fixture();
        setWater(map, 4, 4);
        expect(isPassable(project, map, 4, 4)).toBe(false);
        expect(isPassable(project, map, 4, 5)).toBe(true);

        const result = getTool("script_cutscene")!.run(project, {
          mapId,
          x: 4,
          y: 4,
          trigger: "action",
          beats: [SAY_BEAT],
        });

        const data = result.data as { eventId: string };
        const event = eventById(map, data.eventId);
        expect([event.x, event.y]).toEqual([4, 4]);
      });
    });
    describe("체크포인트·컷신 기존 이벤트 재사용", () => {
      it("이미 있는 체크포인트/컷신 이벤트는 재사용하고 복제하지 않는다", () => {
        const { project, map, mapId } = fixture();

        placeCheckpoint(project, mapId, { x: 5, y: 5 });
        placeCheckpoint(project, mapId, { x: 6, y: 6 });
        const checkpoints = map.events.filter((event) => event.id === checkpointId(map));
        expect(checkpoints).toHaveLength(1);

        getTool("script_cutscene")!.run(project, {
          mapId,
          eventId: "ev_memory",
          x: 8,
          y: 8,
          trigger: "action",
          beats: [SAY_BEAT],
        });
        getTool("script_cutscene")!.run(project, {
          mapId,
          eventId: "ev_memory",
          x: 1,
          y: 1,
          trigger: "action",
          beats: [{ kind: "say", speaker: "나", text: "두 번째 장면." }],
        });
        const cutscenes = map.events.filter((event) => event.id === "ev_memory");
        expect(cutscenes).toHaveLength(1);
        expect(cutscenes[0].pages).toHaveLength(1);
        expect(cutscenes[0].pages?.[0].commands).toEqual(expect.arrayContaining([
          expect.objectContaining({ kind: "text", body: "두 번째 장면." }),
        ]));
        expect([cutscenes[0].x, cutscenes[0].y]).toEqual([8, 8]);
      });
    });
  });
});

describe("clearMap", () => {
  isolateTimers();
  describe("aiPlacementInvestigationPuzzles", () => {
    isolateTimers();
    function fixture(): { project: Project; map: GameMap; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      return { project, map, mapId };
    }
    function setSolid(map: GameMap, x: number, y: number, tile: number): void {
      map.lowerTiles[y * map.width + x] = tile;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    function solidBlock(map: GameMap, cx: number, cy: number, radius: number, tile: number = TILE.WALL): void {
      for (let y = cy - radius; y <= cy + radius; y += 1) {
        for (let x = cx - radius; x <= cx + radius; x += 1) {
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
          setSolid(map, x, y, tile);
        }
      }
    }
    function eventsByIds(map: GameMap, ids: readonly string[]): GameEvent[] {
      return ids.map((id) => {
        const event = map.events.find((entry) => entry.id === id);
        if (!event) throw new Error(`event not found: ${id}`);
        return event;
      });
    }
    type PuzzleData = {
      readonly created: number;
      readonly skipped: number;
      readonly eventIds: readonly string[];
      readonly plateSwitchIds?: readonly string[];
    };
    describe("조사 퍼즐 이벤트 통행 가능 배치", () => {
      it("push-switches는 물 발판을 착지시키고 막힌 발판만 건너뛰며 남은 배선을 맞춘다", () => {
        const { project, map, mapId } = fixture();
        setSolid(map, 4, 4, TILE.WATER);
        // 자동 착지 탐색 반경이 5칸이 됐다(#2894) — 막힌 발판은 반경 5 블록으로 둘러야 skip 된다.
        solidBlock(map, 10, 8, 5, TILE.WATER);
        expect(isPassable(project, map, 4, 4)).toBe(false);
        expect(isPassable(project, map, 10, 8)).toBe(false);

        const result = getTool("compile_puzzle")!.run(project, {
          mapId,
          puzzleId: "water_plates",
          kind: "push-switches",
          plates: [
            { at: { x: 4, y: 4 } },
            { at: { x: 10, y: 8 } },
            { at: { x: 16, y: 4 } },
          ],
          all: true,
          onSolve: { setSwitch: "sw_water_plates_solved" },
        });

        const data = result.data as PuzzleData;
        expect(data).toMatchObject({ created: 2, skipped: 1 });
        expect(data.eventIds).toHaveLength(2);
        expect(data.plateSwitchIds).toHaveLength(2);
        const events = eventsByIds(map, data.eventIds);
        expect(events.every((event) => isPassable(project, map, event.x, event.y))).toBe(true);
        expect(result.warnings?.some((warning) => warning.includes("(4, 4)") && warning.includes("위치 자동 조정"))).toBe(true);
        expect(result.warnings?.some((warning) => warning.includes("(10, 8)") && warning.includes("skip"))).toBe(true);

        const wiring = JSON.stringify(events.map((event) => event.pages?.[0]?.commands));
        for (const switchId of data.plateSwitchIds ?? []) expect(wiring).toContain(switchId);
        expect(wiring).not.toContain("sw_water_plates_plate_2");
      });

      it("push-switches는 같은 자동 착지 칸을 재사용하지 않고 남은 발판을 건너뛴다", () => {
        const { project, map, mapId } = fixture();
        // 탐색 반경 5칸(#2894) 안의 착지 칸이 블록 윗변의 (6, 3) 하나뿐이도록 반경 5 블록으로 막는다(옛 반경 3 의 (6, 5) 와 같은 자리).
        // 버들항 기본 칩셋에서 TILE.GRASS 는 통행 불가다 — 맵의 빈 바닥 타일로 착지 칸을 연다.
        const ground = map.lowerTiles[0]!;
        solidBlock(map, 8, 8, 5, TILE.WATER);
        solidBlock(map, 9, 8, 5, TILE.WATER);
        setSolid(map, 6, 3, ground);

        const result = getTool("compile_puzzle")!.run(project, {
          mapId,
          puzzleId: "reserved_plates",
          kind: "push-switches",
          plates: [{ at: { x: 8, y: 8 } }, { at: { x: 9, y: 8 } }],
          all: true,
          onSolve: {},
        });

        const data = result.data as PuzzleData;
        expect(data).toMatchObject({ created: 1, skipped: 1 });
        const positions = eventsByIds(map, data.eventIds).map((event) => `${event.x},${event.y}`);
        expect(new Set(positions).size).toBe(positions.length);
        expect(result.warnings?.some((warning) => warning.includes("총 1개 skip"))).toBe(true);
      });

      it("switch-sequence는 같은 자동 착지 칸을 재사용하지 않고 남은 노드를 건너뛴다", () => {
        const { project, map, mapId } = fixture();
        // 탐색 반경 5칸(#2894) 안의 착지 칸이 블록 윗변의 (6, 3) 하나뿐이도록 반경 5 블록으로 막는다(옛 반경 3 의 (6, 5) 와 같은 자리).
        // 버들항 기본 칩셋에서 TILE.GRASS 는 통행 불가다 — 맵의 빈 바닥 타일로 착지 칸을 연다.
        const ground = map.lowerTiles[0]!;
        solidBlock(map, 8, 8, 5, TILE.WATER);
        solidBlock(map, 9, 8, 5, TILE.WATER);
        setSolid(map, 6, 3, ground);

        const result = getTool("compile_puzzle")!.run(project, {
          mapId,
          puzzleId: "reserved_sequence",
          kind: "switch-sequence",
          nodes: [
            { at: { x: 8, y: 8 }, name: "첫 장치" },
            { at: { x: 9, y: 8 }, name: "둘째 장치" },
          ],
          order: [0, 1],
          onSolve: {},
        });

        const data = result.data as PuzzleData;
        expect(data).toMatchObject({ created: 1, skipped: 1 });
        const positions = eventsByIds(map, data.eventIds).map((event) => `${event.x},${event.y}`);
        expect(new Set(positions).size).toBe(positions.length);
        expect(result.warnings?.some((warning) => warning.includes("총 1개 skip"))).toBe(true);
      });

      it("switch-sequence는 접근 가능한 물 노드는 유지하고 사방이 막힌 노드는 자동 착지시킨다", () => {
        const { project, map, mapId } = fixture();
        setSolid(map, 3, 3, TILE.WATER);
        solidBlock(map, 10, 7, 1, TILE.WALL);
        expect(isPassable(project, map, 3, 3)).toBe(false);
        expect(isPassable(project, map, 10, 7)).toBe(false);

        const result = getTool("compile_puzzle")!.run(project, {
          mapId,
          puzzleId: "wall_sequence",
          kind: "switch-sequence",
          nodes: [
            { at: { x: 3, y: 3 }, name: "물 위 액자" },
            { at: { x: 10, y: 7 }, name: "갇힌 액자" },
          ],
          order: [0, 1],
          onSolve: { setSwitch: "sw_wall_sequence_solved" },
        });

        const data = result.data as PuzzleData;
        expect(data).toMatchObject({ created: 2, skipped: 0 });
        const [waterNode, landedNode] = eventsByIds(map, data.eventIds);
        expect([waterNode.x, waterNode.y]).toEqual([3, 3]);
        expect([landedNode.x, landedNode.y]).not.toEqual([10, 7]);
        expect(isPassable(project, map, landedNode.x, landedNode.y)).toBe(true);
        expect(result.warnings?.some((warning) => warning.includes("(10, 7)") && warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("password와 item-gate도 action 상호작용 배치 규칙을 따른다", () => {
        const passwordFixture = fixture();
        setSolid(passwordFixture.map, 5, 5, TILE.WATER);
        expect(isPassable(passwordFixture.project, passwordFixture.map, 5, 5)).toBe(false);

        const passwordResult = getTool("compile_puzzle")!.run(passwordFixture.project, {
          mapId: passwordFixture.mapId,
          puzzleId: "water_password",
          kind: "password",
          at: { x: 5, y: 5 },
          answer: "1234",
          onSolve: {},
        });
        const passwordData = passwordResult.data as PuzzleData;
        const passwordEvent = eventsByIds(passwordFixture.map, passwordData.eventIds)[0];
        expect([passwordEvent.x, passwordEvent.y]).toEqual([5, 5]);

        const gateFixture = fixture();
        solidBlock(gateFixture.map, 11, 8, 1, TILE.WALL);
        expect(isPassable(gateFixture.project, gateFixture.map, 11, 8)).toBe(false);

        const gateResult = getTool("compile_puzzle")!.run(gateFixture.project, {
          mapId: gateFixture.mapId,
          puzzleId: "walled_gate",
          kind: "item-gate",
          at: { x: 11, y: 8 },
          requiredItemId: DEFAULT_ITEM_ID,
          onSolve: {},
        });
        const gateData = gateResult.data as PuzzleData;
        const gateEvent = eventsByIds(gateFixture.map, gateData.eventIds)[0];
        expect([gateEvent.x, gateEvent.y]).not.toEqual([11, 8]);
        expect(isPassable(gateFixture.project, gateFixture.map, gateEvent.x, gateEvent.y)).toBe(true);
        expect(gateResult.warnings?.some((warning) => warning.includes("(11, 8)") && warning.includes("위치 자동 조정"))).toBe(true);
      });

      it("열린 바닥에서는 네 퍼즐의 작성 좌표를 그대로 보존한다", () => {
        const { project, map, mapId } = fixture();

        const sequence = getTool("compile_puzzle")!.run(project, {
          mapId,
          puzzleId: "open_sequence",
          kind: "switch-sequence",
          nodes: [{ at: { x: 2, y: 2 } }, { at: { x: 3, y: 2 } }],
          order: [0, 1],
          onSolve: {},
        });
        const password = getTool("compile_puzzle")!.run(project, {
          mapId,
          puzzleId: "open_password",
          kind: "password",
          at: { x: 6, y: 2 },
          answer: "7",
          onSolve: {},
        });
        const gate = getTool("compile_puzzle")!.run(project, {
          mapId,
          puzzleId: "open_gate",
          kind: "item-gate",
          at: { x: 9, y: 2 },
          requiredItemId: DEFAULT_ITEM_ID,
          onSolve: {},
        });
        const plates = getTool("compile_puzzle")!.run(project, {
          mapId,
          puzzleId: "open_plates",
          kind: "push-switches",
          plates: [{ at: { x: 12, y: 2 } }, { at: { x: 13, y: 2 } }],
          all: true,
          onSolve: {},
        });

        expect(eventsByIds(map, (sequence.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[2, 2], [3, 2]]);
        expect(eventsByIds(map, (password.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[6, 2]]);
        expect(eventsByIds(map, (gate.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[9, 2]]);
        expect(eventsByIds(map, (plates.data as PuzzleData).eventIds).map(({ x, y }) => [x, y])).toEqual([[12, 2], [13, 2]]);
        expect(sequence.warnings).toBeUndefined();
        // 자리는 그대로다(위치 조정 경고 없음) — 그 칸에 물건 타일이 없다는 알림 하나만 온다.
        expect(password.warnings).toEqual([expect.stringContaining("has no picture")]);
        expect(gate.warnings).toBeUndefined();
        expect(plates.warnings).toBeUndefined();
      });
    });
  });
  describe("aiPlacementLighting", () => {
    isolateTimers();
    type LightingToolCase = {
      readonly name: string;
      readonly label: string;
      readonly args: (mapId: string, area: Rect) => Record<string, unknown>;
    };
    const CASES: readonly LightingToolCase[] = [
      {
        name: "set_lighting_volume",
        label: "영역 조명",
        args: (mapId, area) => ({ mapId, ambient: 0.7, applyMode: "event", area }),
      },
      {
        name: "set_scene_mood",
        label: "장면 분위기",
        args: (mapId, area) => ({
          mapId,
          applyMode: "event",
          weather: { kind: "fog", intensity: 0.4 },
          lighting: { ambient: 0.7, area },
        }),
      },
    ];
    function fixture(): { project: Project; map: GameMap; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      return { project, map: project.maps[mapId], mapId };
    }
    function setSolid(map: GameMap, x: number, y: number, tile: number): void {
      map.lowerTiles[y * map.width + x] = tile;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    function cells(area: Rect): Array<{ x: number; y: number }> {
      const result: Array<{ x: number; y: number }> = [];
      for (let y = area.y; y < area.y + area.h; y += 1) {
        for (let x = area.x; x < area.x + area.w; x += 1) result.push({ x, y });
      }
      return result;
    }
    for (const toolCase of CASES) {
      describe(`${toolCase.name} 통행 불가 칸 제외`, () => {
        it(`${toolCase.label} 영역에서 물과 벽을 건너뛰고 통행 가능 칸에만 이벤트를 만든다`, () => {
          const { project, map, mapId } = fixture();
          const area = { x: 2, y: 2, w: 3, h: 2 };
          setSolid(map, 2, 2, TILE.WATER);
          setSolid(map, 3, 2, TILE.WALL);
          expect(isPassable(project, map, 2, 2)).toBe(false);
          expect(isPassable(project, map, 3, 2)).toBe(false);
          const passableCount = cells(area).filter(({ x, y }) => isPassable(project, map, x, y)).length;

          const result = getTool(toolCase.name)!.run(project, toolCase.args(mapId, area));

          const data = result.data as { eventIds: string[] };
          expect(data.eventIds).toHaveLength(passableCount);
          const created = map.events.filter((event) => data.eventIds.includes(event.id));
          expect(created).toHaveLength(passableCount);
          for (const event of created) expect(isPassable(project, map, event.x, event.y)).toBe(true);
          expect(result.warnings).toHaveLength(1);
          expect(result.warnings?.[0]).toContain("2개");
          expect(result.warnings?.[0]).toContain("(2, 2)");
          expect(result.warnings?.[0]).toContain("(3, 2)");
        });

        it(`${toolCase.label} 영역이 모두 통행 가능하면 이전과 같은 수의 이벤트를 만든다`, () => {
          const { project, map, mapId } = fixture();
          const area = { x: 8, y: 8, w: 2, h: 2 };
          expect(cells(area).every(({ x, y }) => isPassable(project, map, x, y))).toBe(true);

          const result = getTool(toolCase.name)!.run(project, toolCase.args(mapId, area));

          const data = result.data as { eventIds: string[] };
          expect(data.eventIds).toHaveLength(area.w * area.h);
          expect(result.warnings).toBeUndefined();
        });
      });
    }
  });
  describe("aiPlacementStarterMonsters", () => {
    isolateTimers();
    function fixture(): { project: Project; map: GameMap; mapId: string; speciesId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      const speciesId = project.database.monsterSpecies[0]?.id;
      if (!speciesId) throw new Error("fixture monster species missing");
      return { project, map, mapId, speciesId };
    }
    function setWater(map: GameMap, x: number, y: number): void {
      map.lowerTiles[y * map.width + x] = TILE.WATER;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    function waterBlock(map: GameMap, cx: number, cy: number, radius: number): void {
      for (let y = cy - radius; y <= cy + radius; y += 1) {
        for (let x = cx - radius; x <= cx + radius; x += 1) {
          if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
          setWater(map, x, y);
        }
      }
    }
    function blockInteractionCell(map: GameMap, x: number, y: number): void {
      setWater(map, x, y);
      setWater(map, x, y + 1);
      setWater(map, x, y - 1);
      setWater(map, x + 1, y);
      setWater(map, x - 1, y);
    }
    function eventById(map: GameMap, id: string): GameEvent {
      const event = map.events.find((entry) => entry.id === id);
      if (!event) throw new Error(`event not found: ${id}`);
      return event;
    }
    describe("give_starter_monsters 통행 가능 배치", () => {
      it("시작 위치 옆 기본 칸이 물로 막히면 통행 가능 칸으로 자동 조정하고 경고한다", () => {
        const { project, map, speciesId } = fixture();
        project.startPos = { x: 8, y: 8 };
        project.system.monsterCollection = false;
        blockInteractionCell(map, 9, 8);
        expect(isPassable(project, map, 9, 8)).toBe(false);

        const result = getTool("give_starter_monsters")!.run(project, { speciesIds: [speciesId] });

        const event = eventById(map, "ev_starter_monsters");
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect([event.x, event.y]).not.toEqual([9, 8]);
        expect(result.warnings).toEqual(expect.arrayContaining([
          expect.stringContaining(`(9, 8) → (${event.x}, ${event.y})`),
          expect.stringContaining("system.monsterCollection"),
        ]));
      });

      it("명시한 물 좌표도 같은 방식으로 통행 가능 칸에 자동 착지한다", () => {
        const { project, map, mapId, speciesId } = fixture();
        blockInteractionCell(map, 12, 10);
        expect(isPassable(project, map, 12, 10)).toBe(false);

        const result = getTool("give_starter_monsters")!.run(project, {
          speciesIds: [speciesId],
          actorEvent: { mapId, eventId: "ev_requested_starter", x: 12, y: 10 },
        });

        const event = eventById(map, "ev_requested_starter");
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect([event.x, event.y]).not.toEqual([12, 10]);
        expect(result.warnings?.some((warning) => warning.includes(`(12, 10) → (${event.x}, ${event.y})`))).toBe(true);
      });

      it("기본 칸이 통행 가능한 땅이면 좌표를 옮기지 않는다", () => {
        const { project, map, speciesId } = fixture();
        project.startPos = { x: 8, y: 8 };
        expect(isPassable(project, map, 9, 8)).toBe(true);

        const result = getTool("give_starter_monsters")!.run(project, { speciesIds: [speciesId] });

        const event = eventById(map, "ev_starter_monsters");
        expect([event.x, event.y]).toEqual([9, 8]);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).not.toBe(true);
      });

      it("요청 좌표 반경 5칸이 전부 물이면 starter-monsters-impassable ToolError", () => {
        const { project, map, mapId, speciesId } = fixture();
        // nearestPassableCell now searches a clean landing up to radius 5 before failing (#2894), so the blocked area must cover radius 5.
        waterBlock(map, 12, 10, 5);
        expect(isPassable(project, map, 12, 10)).toBe(false);

        let error: unknown;
        try {
          getTool("give_starter_monsters")!.run(project, {
            speciesIds: [speciesId],
            actorEvent: { mapId, x: 12, y: 10 },
          });
        } catch (caught) {
          error = caught;
        }

        expect(error).toBeInstanceOf(ToolError);
        expect((error as ToolError).code).toBe("starter-monsters-impassable");
        expect((error as ToolError).message).toContain("(12, 10)");
        expect(map.events).toHaveLength(0);
      });

      // 2026-09-24 몬스터 수집 r2: place_npc 가 먼저 (4,5) 를 쓴 뒤 모델이 같은 칸에 ev_starters 를
      // 요청했다. 점유 검사가 없어 두 이벤트가 한 칸에 겹쳤고, 조사는 NPC 에 가려 ev_starters 를
      // 못 건드렸다(autoplay-failed: 첫 파트너 받기).
      it("요청 칸에 이미 다른 이벤트가 있으면 점유를 피해 자동 조정한다", () => {
        const { project, map, mapId, speciesId } = fixture();
        const npc = getTool("place_npc")!.run(project, { mapId, x: 4, y: 5, name: "바람 박사", pages: [{ lines: ["어서 오렴."] }] });
        const npcAt = npc.data as { x: number; y: number };
        expect(isPassable(project, map, npcAt.x, npcAt.y)).toBe(true);

        const result = getTool("give_starter_monsters")!.run(project, {
          speciesIds: [speciesId],
          actorEvent: { mapId, eventId: "ev_starters", x: npcAt.x, y: npcAt.y },
        });

        const starter = eventById(map, "ev_starters");
        expect([starter.x, starter.y]).not.toEqual([npcAt.x, npcAt.y]);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });

      // r2 후속: 점유 회피 조정이 NPC 뒤 밀폐 주머니에 놓이면 플레이어가 도달할 수 없다.
      // 같은 반경 후보가 갈라지면 큰 통행 컴포넌트(방) 쪽을 골라야 한다.
      it("요청 칸 반경 안의 작은 주머니 대신 방 쪽 칸으로 조정한다", () => {
        const { project, map, mapId, speciesId } = fixture();
        // (6,6) 은 벽 세 겹 + 입구 NPC 로 봉인된 주머니. 방은 아래쪽이 트여 있다.
        for (const [wx, wy] of [[4, 5], [5, 5], [6, 5], [4, 6], [6, 7], [7, 6]] as const) {
          map.lowerTiles[wy * map.width + wx] = TILE.WALL;
          map.upperTiles[wy * map.width + wx] = TILE.EMPTY;
        }
        getTool("place_npc")!.run(project, { mapId, x: 5, y: 6, name: "마을 주민", pages: [{ lines: ["안녕."] }] });
        const npc = map.events.find((entry) => entry.name === "마을 주민");
        expect([npc?.x, npc?.y]).toEqual([5, 6]);

        const result = getTool("give_starter_monsters")!.run(project, {
          speciesIds: [speciesId],
          actorEvent: { mapId, eventId: "ev_starters", x: 5, y: 6 },
        });

        const starter = eventById(map, "ev_starters");
        expect([starter.x, starter.y]).not.toEqual([6, 6]);
        expect([starter.x, starter.y]).toEqual([4, 7]);
        expect(result.warnings?.some((warning) => warning.includes("위치 자동 조정"))).toBe(true);
      });
    });
  });
  describe("aiPlacementStoryArc", () => {
    isolateTimers();
    function fixture(): { project: Project; map: GameMap; mapId: string } {
      const project = createBlankProject();
      const mapId = project.startMapId;
      return { project, map: project.maps[mapId], mapId };
    }
    function setWater(map: GameMap, x: number, y: number): void {
      map.lowerTiles[y * map.width + x] = TILE.WATER;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    function waterBlock(map: GameMap, cx: number, cy: number, radius: number): void {
      for (let y = cy - radius; y <= cy + radius; y += 1) {
        for (let x = cx - radius; x <= cx + radius; x += 1) setWater(map, x, y);
      }
    }
    function storyArgs(mapId: string, x: number, y: number): Record<string, unknown> {
      return {
        id: "lost-crown",
        title: "잃어버린 왕관",
        mapId,
        eventId: "ev_story_beat",
        at: { x, y },
        opening: ["왕관의 흔적을 찾았다."],
        tutorialObjectives: [{ id: "find-clue", text: "단서를 조사한다." }],
        branchChoices: [
          { id: "return", label: "돌려준다", lines: ["왕관을 돌려준다."] },
          { id: "keep", label: "간직한다", lines: ["왕관을 숨긴다."] },
        ],
        twist: { enabled: false, flagId: "crown-twist", description: "", discoverInBranchId: "", reveal: [] },
      };
    }
    function eventById(map: GameMap): GameEvent {
      const event = map.events.find((candidate) => candidate.id === "ev_story_beat");
      if (!event) throw new Error("story beat event not found");
      return event;
    }
    describe("author_story_arc 비트 이벤트 통행 가능 배치", () => {
      it("통행 가능 이웃이 있는 물 타일은 상호작용 좌표를 유지한다", () => {
        const { project, map, mapId } = fixture();
        setWater(map, 5, 5);
        expect(isPassable(project, map, 5, 5)).toBe(false);

        const result = getTool("author_story_arc")!.run(project, storyArgs(mapId, 5, 5));

        const event = eventById(map);
        expect([event.x, event.y]).toEqual([5, 5]);
        expect((result.data as { adjusted: boolean }).adjusted).toBe(false);
      });

      it("3x3 물 블록 중심의 비트는 통행 가능 칸으로 자동 착지하고 경고한다", () => {
        const { project, map, mapId } = fixture();
        waterBlock(map, 8, 7, 1);
        expect(isPassable(project, map, 8, 7)).toBe(false);

        const result = getTool("author_story_arc")!.run(project, storyArgs(mapId, 8, 7));

        const event = eventById(map);
        expect(isPassable(project, map, event.x, event.y)).toBe(true);
        expect([event.x, event.y]).not.toEqual([8, 7]);
        expect((result.data as { adjusted: boolean }).adjusted).toBe(true);
        const warnings = result.warnings?.join("\n") ?? "";
        expect(warnings).toContain("(8, 7)");
        expect(warnings).toContain(`(${event.x}, ${event.y})`);
      });

      it("반경 5칸이 전부 물이면 story-beat-impassable ToolError를 낸다", () => {
        const { project, map, mapId } = fixture();
        // nearestPassableCell now searches a clean landing up to radius 5 before failing (#2894), so the blocked area must cover radius 5.
        waterBlock(map, 8, 7, 5);
        expect(isPassable(project, map, 8, 7)).toBe(false);

        let error: unknown;
        try {
          getTool("author_story_arc")!.run(project, storyArgs(mapId, 8, 7));
        } catch (caught) {
          error = caught;
        }

        expect(error).toBeInstanceOf(ToolError);
        expect((error as ToolError).code).toBe("story-beat-impassable");
        expect(map.events).toHaveLength(0);
      });

      it("일반 지면의 비트 좌표는 바꾸지 않는다", () => {
        const { project, map, mapId } = fixture();
        expect(isPassable(project, map, 4, 4)).toBe(true);

        const result = getTool("author_story_arc")!.run(project, storyArgs(mapId, 4, 4));

        const event = eventById(map);
        expect([event.x, event.y]).toEqual([4, 4]);
        expect((result.data as { adjusted: boolean }).adjusted).toBe(false);
        expect(result.warnings).toBeUndefined();
      });
    });
  });
  describe("battleNoEscapeNotice", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    function panelOptions(runtime: ReturnType<typeof createBattleRuntime>): BattleCommandPanelOptions {
      return {
        runtime,
        submenu: null,
        setSubmenu: () => undefined,
        setDirectorState: () => undefined,
        render: () => undefined,
        runActorCommand: () => undefined,
        beginTargetCommand: () => undefined,
        confirmTargetSelection: () => undefined,
      };
    }
    describe("blocked escape notice", () => {
      it("tells the player this fight forbids escape, using the project's escape term", () => {
        const project = createBlankProject();
        project.meta.terms.escape = "도주";
        store.replace(project);
        const runtime = createBattleRuntime({
          project,
          troopId: DEFAULT_TROOP_ID,
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          rng: () => 0.5,
        });
        const snapshot = runtime.snapshot();
        const root = commandPanel(snapshot, panelOptions(runtime)) as unknown as FakeElement;
        const escape = root.querySelector("[data-testid='actor-command-escape']");
        if (!escape) throw new Error("missing escape command");

        expect(escape.dataset.battleCommandInert).toBe("true");
        // 버튼 안 한 줄은 짧은 형태 — 전체 문장은 2열 메뉴에서 「도주할 수…」로 잘렸다(1.36 VQA #4 #5 #8 #9 #27). 전체 문장은 위 배너가 말한다.
        expect(escape.dataset.battleCommandInertReason).toBe("도주 불가");
        expect(escape.getAttribute("aria-label")).toBe("도주: 도주 불가");
        expect(noEscapeInlineReason(snapshot)).toBe("도주 불가");
        expect(noEscapeNoticeLine(snapshot)).toBe("이 싸움에서는 도주할 수 없습니다.");

        const scene = document.createElement("div");
        applyBattleDirectorState(scene, { ...commandPromptState(snapshot, noEscapeNoticeLine(snapshot)), flash: true }, snapshot);
        expect(scene.dataset.battleNotice).toBe("true");
        expect(scene.dataset.battleDirectorStep).toBe("command");
        applyBattleDirectorState(scene, commandPromptState(snapshot), snapshot);
        expect(scene.dataset.battleNotice).toBeUndefined();
      });

      it("keeps a short inline reason but moves a long root reason to the cursor hint line (no spill onto the next row)", () => {
        const project = createBlankProject();
        project.meta.terms.escape = "도주";
        store.replace(project);
        const runtime = createBattleRuntime({ project, troopId: DEFAULT_TROOP_ID, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5 });
        const root = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
        expect(root.querySelector("[data-testid='actor-command-escape-reason']")?.textContent).toBe("도주 불가");

        project.meta.terms.escape = "후퇴 후 재집결";
        store.replace(project);
        const longRoot = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
        const escape = longRoot.querySelector("[data-testid='actor-command-escape']");
        expect(escape?.dataset.battleCommandInertReason).toBe("후퇴 후 재집결 불가");
        expect(longRoot.querySelector("[data-testid='actor-command-escape-reason']")).toBeNull();
      });

      it("leaves escape usable when the fight allows it", () => {
        const project = createBlankProject();
        store.replace(project);
        const runtime = createBattleRuntime({
          project,
          troopId: DEFAULT_TROOP_ID,
          canEscape: true,
          canLose: true,
          battleFlow: "strict",
          rng: () => 0.5,
        });
        const root = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
        const escape = root.querySelector("[data-testid='actor-command-escape']");
        if (!escape) throw new Error("missing escape command");
        expect(escape.dataset.battleCommandInert).toBeUndefined();
      });

      it("keeps the monster-battle sentence for the pokemon skin", () => {
        const project = createBlankProject();
        project.system.battleUiStyle = "pokemon";
        store.replace(project);
        expect(noEscapeNoticeLine({ troopId: "no_such_troop" })).toBe("도망칠 수 없다!");
      });
    });
  });
  describe("castleTileset", () => {
    isolateTimers();
    describe("bundled Castle atlas", () => {
      // 「옛 프로젝트에 성채 아틀라스를 심는다」 사례는 뺐다 — OpenGameArt 성채 PNG·번들 정의는 2026-10-07 저작권 정리로 지워졌다(ensureBundledTilesets 가 더는 심지 않는다).
      it("registers complete 32-column frames, including baked texture keys", () => {
        for (const key of [CASTLE_TILESET_TEXTURE_KEY, `${CASTLE_TILESET_TEXTURE_KEY}__transparent_ff00ff`]) {
          const add = vi.fn();
          const create = vi.fn();
          const scene = {
            textures: { get: () => ({ getFrameNames: () => [], add }) },
            anims: { exists: () => false, create },
          } as unknown as Phaser.Scene;
          if (key === CASTLE_TILESET_TEXTURE_KEY) registerTilesetTextureFrames(scene, key, 1024);
          else registerTilesetTextureFrames(scene, key, 1024, 16, 32);
          expect(add).toHaveBeenCalledWith("tile_31", 0, 496, 0, 16, 16);
          expect(add).toHaveBeenCalledWith("tile_32", 0, 0, 16, 16, 16);
          expect(add).toHaveBeenCalledWith("tile_1023", 0, 496, 496, 16, 16);
          expect(add).toHaveBeenCalledWith("tile_1023_se", 0, 504, 504, 8, 8);
          expect(create).not.toHaveBeenCalled(); // RM2K water-strip indices mean something else here.
        }
      });

      // 「성채 PNG·출처 고지를 웹 내보내기에 싣는다」 사례도 같은 정리로 뺐다 — 내보낼 성채 그림이 없다.
    });
  });
  describe("clearMap", () => {
    isolateTimers();
    const MAP_ID = "clear_map_target";
    function context(): ToolContext {
      const ctx = { project: createBlankProject() };
      const created = runTool(ctx, "create_map", {
        id: MAP_ID, name: "Clear fixture", width: 12, height: 10, border: "wall", bgm: { mode: "none" },
      });
      expect(created.ok, JSON.stringify(created.issues)).toBe(true);
      return ctx;
    }
    function paintSomething(ctx: ToolContext): void {
      const painted = runTool(ctx, "paint_tiles", {
        mapId: MAP_ID, layer: "lower", mode: "rect",
        from: { x: 2, y: 2 }, to: { x: 5, y: 5 }, tile: TILE.PATH,
      });
      expect(painted.ok, JSON.stringify(painted.issues)).toBe(true);
    }
    describe("clear_map", () => {
      it("is a registered write tool in the map domain", () => {
        const tool = getTool("clear_map");
        expect(tool).toBeDefined();
        expect(tool?.mode).toBe("write");
        expect(tool?.domains).toContain("map");
      });

      it("clears every cell to grass by default and drops tile stacks", () => {
        const ctx = context();
        paintSomething(ctx);
        const map = ctx.project.maps[MAP_ID];
        if (!map) throw new Error("Missing fixture map");
        map.lowerTileStacks = { [2 * map.width + 2]: [TILE.PATH, TILE.PATH] };
        map.upperTiles[3 * map.width + 3] = 199;

        const result = runTool(ctx, "clear_map", { mapId: MAP_ID, confirmDestroy: true });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        const after = ctx.project.maps[MAP_ID];
        if (!after) throw new Error("Missing cleared map");
        expect(after.lowerTiles.every((tile) => tile === TILE.GRASS)).toBe(true);
        expect(after.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
        expect(after.lowerTileStacks ?? {}).toEqual({});
        expect(after.upperTileStacks ?? {}).toEqual({});
      });

      it("fill empty leaves a true void instead of ground", () => {
        const ctx = context();
        paintSomething(ctx);
        const result = runTool(ctx, "clear_map", { mapId: MAP_ID, fill: "empty", confirmDestroy: true });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        const after = ctx.project.maps[MAP_ID];
        if (!after) throw new Error("Missing cleared map");
        expect(after.lowerTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
        expect(after.upperTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
      });

      it("refuses without confirmDestroy and changes nothing", () => {
        const ctx = context();
        paintSomething(ctx);
        const before = structuredClone(ctx.project);
        const result = runTool(ctx, "clear_map", { mapId: MAP_ID });
        expect(result.ok).toBe(false);
        expect(result.issues?.[0]?.code).toBe("invalid-args");
        expect(ctx.project).toEqual(before);
      });

      it("keeps events by default and warns with their ids", () => {
        const ctx = context();
        const placed = runTool(ctx, "place_npc", {
          mapId: MAP_ID, x: 6, y: 6, name: "잔류 주민", pages: [{ lines: ["남아 있는다"] }],
        });
        expect(placed.ok, JSON.stringify(placed.issues)).toBe(true);
        const result = runTool(ctx, "clear_map", { mapId: MAP_ID, confirmDestroy: true });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        const after = ctx.project.maps[MAP_ID];
        expect(after?.events).toHaveLength(1);
        // 쓰기 툴의 warnings 는 diff 로 전달된다(toolRunner 가 exec.warnings 를 diff.warnings 에 합친다).
        expect(result.diff?.warnings.join(" ")).toContain("남겨둠");
      });

      it("removes every event when asked and reports the removal in the diff", () => {
        const ctx = context();
        const placed = runTool(ctx, "place_npc", {
          mapId: MAP_ID, x: 6, y: 6, name: "철거 주민", pages: [{ lines: ["곧 사라진다"] }],
        });
        expect(placed.ok, JSON.stringify(placed.issues)).toBe(true);
        const result = runTool(ctx, "clear_map", { mapId: MAP_ID, events: "remove", confirmDestroy: true });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        expect(ctx.project.maps[MAP_ID]?.events).toHaveLength(0);
        expect(result.diff?.eventsRemoved).toBe(1);
      });

      it("keeps the start cell walkable on an empty fill and warns", () => {
        const ctx = context();
        ctx.project.startMapId = MAP_ID;
        ctx.project.startPos = { x: 5, y: 5 };
        const result = runTool(ctx, "clear_map", { mapId: MAP_ID, fill: "empty", confirmDestroy: true });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        const after = ctx.project.maps[MAP_ID];
        if (!after) throw new Error("Missing cleared map");
        expect(after.lowerTiles[5 * after.width + 5]).not.toBe(TILE.EMPTY);
        expect(result.diff?.warnings.join(" ")).toContain("시작 위치");
      });

      it("refuses to erase a recorded house and changes nothing", () => {
        const ctx = { project: completedHouseProject() };
        const before = structuredClone(ctx.project);
        const result = runTool(ctx, "clear_map", { mapId: ctx.project.startMapId, confirmDestroy: true });
        expect(result.ok).toBe(false);
        expect(result.issues?.[0]?.code).toBe("protected-house-write");
        expect(ctx.project).toEqual(before);
      });

      it("is a destructive outcome and forces the over-insertion review modal path", () => {
        expect(isDestructiveOutcome("clear_map", { mapId: MAP_ID, confirmDestroy: true }, undefined)).toBe(true);
        const result: ToolResult = { ok: true, summary: "clear_map" };
        const call: ProposedCall = { name: "clear_map", args: {}, summary: "clear", result, destructive: true };
        const review = reviewOverInsertion({ calls: [call], beforeMapCount: 1, afterMapCount: 1 });
        expect(review.needsReview).toBe(true);
        expect(review.destructive).toBe(true);
      });
    });
  });
  describe("clusterRuleAuthoring", () => {
    isolateTimers();
    describe("클러스터 규칙 저작", () => {
      it("컨텍스트가 soft/medium 규칙 문구만 선호 힌트로 싣고 hard 규칙은 싣지 않는다", () => {
        // 힌트는 현재(시작) 맵의 타일셋 규칙만 싣는다 — 새 프로젝트 시작 맵은 기본 타일셋(beodeul_city)이다.
        const project = createBlankProject();
        const tileset = project.tilesets[project.maps[project.startMapId].tilesetId];
        expect(tileset?.id).toBe(DEFAULT_TILESET_ID);
        const group = Object.assign(baseGroup(), {
          rules: [
            {
              id: "space-window",
              kind: "spacing",
              strength: "medium",
              params: { min: 2 },
              message: "창문은 최소 2칸 이상 띄우기",
            },
            {
              id: "count-flower",
              kind: "count",
              strength: "soft",
              params: { max: 5 },
              message: "꽃은 한 화면에 너무 많이 쓰지 않기",
            },
            {
              id: "hard-wall",
              kind: "adjacency",
              strength: "hard",
              params: { side: "below" },
              message: "지붕 아래에는 벽이 필요",
            },
          ],
        });
        tileset.tileGroups = [group];

        const prompt = buildSystemPrompt(project);

        expect(prompt).toContain("창문은 최소 2칸 이상 띄우기");
        expect(prompt).toContain("꽃은 한 화면에 너무 많이 쓰지 않기");
        expect(prompt).not.toContain("지붕 아래에는 벽이 필요");
      });
    });
    function baseGroup(): TileGroupMetadata {
      return {
        defaultLayer: "upper",
        description: "규칙 테스트 그룹",
        id: "roof_rule_group",
        name: "규칙 지붕",
        placementRules: "",
        role: "roof",
        tileIds: [1, 2, 3],
      };
    }
  });
});

describe("mapClone", () => {
  isolateTimers();
  describe("clusterRuleCommitGate", () => {
    isolateTimers();
    const MAP_ID = "map_cluster_gate";
    function mapForGate(): GameMap {
      const width = 4;
      const height = 4;
      return {
        events: [],
        height,
        id: MAP_ID,
        lowerTiles: new Array<number>(width * height).fill(TILE.GRASS),
        name: "클러스터 게이트",
        tileSize: 16,
        tilesetId: COMBINED_TOWN_TILESET_ID,
        upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
        width,
      };
    }
    function at(map: GameMap, x: number, y: number): number {
      return y * map.width + x;
    }
    function hardAdjacencyRule(): ClusterRule {
      return { id: "roof-wall-hard", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" };
    }
    function clusterGroup(): TileGroupMetadata {
      return {
        defaultLayer: "lower",
        description: "260은 290 바로 위에 있어야 한다",
        id: "roof-wall",
        name: "지붕-벽",
        placementRules: "260 아래에는 290",
        role: "building",
        rules: [hardAdjacencyRule()],
        tileIds: [260, 290],
      };
    }
    function projectForGate(): { readonly map: GameMap; readonly project: Project } {
      const project = withRetiredCombinedTownMaps(createBlankProject());
      const map = project.maps[project.startMapId] ?? mapForGate();
      for (const candidate of Object.values(project.maps)) {
        candidate.lowerTiles.fill(TILE.GRASS);
        candidate.upperTiles.fill(TILE.EMPTY);
      }
      project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [clusterGroup()];
      return { map, project };
    }
    describe("cluster rule commit gate", () => {
      it("hard adjacency 위반은 lint error로 보고되지만 commitChangeset을 차단하지 않는다", () => {
        // Given: a hard rule requiring tile 260 directly above tile 290.
        const { map, project } = projectForGate();
        map.lowerTiles[at(map, 1, 1)] = 260;

        // When: the unsupported draft is committed.
        const reported = commitChangeset(project);

        // Then: the cluster-rule hard error is reported but does not block the write.
        expect(reported.ok).toBe(true);
        expect(reported.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "cluster-rule:adjacency:roof-wall",
              severity: "error",
              x: 1,
              y: 1,
            }),
          ])
        );

        // When: the required support tile is placed directly below.
        map.lowerTiles[at(map, 1, 2)] = 290;
        const accepted = commitChangeset(project);

        // Then: the fixed draft still passes, now without cluster-rule issues.
        expect(accepted.ok).toBe(true);
        expect(accepted.issues.filter((issue) => issue.code.startsWith("cluster-rule"))).toHaveLength(0);
      });
    });
  });
  describe("conceptOutdoorGates", () => {
    isolateTimers();
    function ctx(): ToolContext {
      return { project: createBlankProject() };
    }
    describe("Phase 5 실외 확장 — 스코프 게이트와 명시적 거부", () => {
      it("미시드 실외는 live에서 빈 배열 — 템플릿이 새지 않는다", () => {
        const context = ctx();
        expect(liveBundlesForTileset(context.project, COMBINED_TOWN_TILESET_ID)).toEqual([]);
        expect(context.project.tilesets[COMBINED_TOWN_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
      });

      it("ensure는 실외를 손대지 않는다", () => {
        const context = ctx();
        ensureConceptBundles(context.project, COMBINED_TOWN_TILESET_ID);
        expect(context.project.tilesets[COMBINED_TOWN_TILESET_ID]?.scratchConceptBundles).toBeUndefined();
      });

      it("실내 칩셋은 여전히 초안을 시드한다", () => {
        // Concept-bundle seeding is tied to the retired EasyRPG interior sheet (ensureConceptBundles only seeds INTERIOR_ROOM_TILESET_ID);
        // the v5 hand-pixel interior never seeds drafts, so this runs on a pre-purge project that still carries that sheet.
        const context = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
        ensureConceptBundles(context.project, INTERIOR_ROOM_TILESET_ID);
        // The interior sheet is still the only one ensure touches (unlike the outdoor case above), but the shared interior reset
        // retired every facility template (CONCEPT_FACILITY_TEMPLATES = [] — "do not seed rejected facility layouts", present at
        // the public baseline 0d4f13e7c8), so the seeded draft list is empty rather than populated.
        expect(context.project.tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles).toEqual([]);
      });

      // Removed it "place_concept는 실내 칩셋이 아니면": place_concept was removed from the tool registry on purpose.

      // Removed it "실외 전용 시설명은 실내 스코프에서": place_concept was removed from the tool registry on purpose.

      // Removed it "get_concept_facility는 실외를 읽되": get_concept_facility was removed from the tool registry on purpose.

      // Removed it "place_concept는 실내 칩셋에서 그대로": place_concept was removed from the tool registry on purpose.
    });
  });
  describe("groupLayoutAuthoring", () => {
    isolateTimers();
    function clusterEditPrompt(): string {
      return buildClusterEditKickoff({ tilesetId: COMBINED_TOWN_TILESET_ID, groupId: "roof_layout_group", group: null });
    }
    describe("클러스터 구성 저작", () => {
      it("cluster-edit 킥오프가 구성 수정 선택지를 포함한다", () => {
        // Given: the cluster-edit skill is opened.
        const prompt = clusterEditPrompt();

        // Then: users can choose layout authoring separately from rule authoring.
        expect(prompt).toContain("구성 수정(위/아래·좌우 배치)");
      });

      it("구성 수정 프로토콜이 원탭 축 선택, 최소 입력, 이미지 전/후, set_group_layout 저장을 지시한다", () => {
        // Given: the cluster-edit skill is opened.
        const prompt = clusterEditPrompt();

        // Then: vertical/horizontal layout editing stays image-first and routes to set_group_layout.
        expect(prompt).toContain("[선택지] 세로(위/아래) | 가로(좌/우) | 취소");
        expect(prompt).toContain("어느 타일이 **위**? 어느 타일이 **아래**?");
        expect(prompt).toContain("위 260 / 아래 290");
        expect(prompt).toContain("render_group_sample({tilesetId, groupId, proposed.patternGrammar})");
        expect(prompt).toContain("[선택지] 적용 | 다시");
        expect(prompt).toContain("set_group_layout");
        expect(prompt).toContain('axis:"vertical", top:[260], bottom:[290]');
        expect(prompt).toContain('axis:"horizontal"');
        expect(prompt).toContain("전/후 이미지");
      });

      it("구성과 규칙을 구분하고 위/아래가 레이어가 아님을 안내한다", () => {
        // Given: the cluster-edit skill is opened.
        const prompt = clusterEditPrompt();

        // Then: adjacency wording is routed by intent, not by the shared words "위/아래".
        expect(prompt).toContain("'위/아래로 배치·구성·이어지게 해줘'는 구성(set_group_layout)");
        expect(prompt).toContain("'반드시 위/아래여야 한다(제약·검증)'는 규칙(set_cluster_rule)");
        expect(prompt).toContain("'위/아래'는 레이어(상위/하위)가 아니라 세로 인접 칸을 뜻한다");
      });
    });
  });
  describe("groupSampleBuilder", () => {
    isolateTimers();
    type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
    function tileset(priority: "lower" | "upper" = "lower"): TilesetDef {
      return {
        count: 512,
        id: "test_tileset",
        image: { type: "bundled", id: "test" },
        name: "Test",
        passability: Array.from({ length: 512 }, () => ({ down: true, left: true, right: true, up: true })),
        priority: Array.from({ length: 512 }, () => priority),
        terrain: Array.from({ length: 512 }, () => 0),
        tileSize: 16,
        tilesPerRow: 16,
      };
    }
    function part(role: PatternGrammar["parts"][number]["role"], tile: number): PatternGrammar["parts"][number] {
      return { role, tileIds: [tile] };
    }
    describe("buildGroupSample", () => {
      it("assembles a wall nine-slice sample into the expected 3x3 cells", () => {
        const grammar: PatternGrammar = {
          axis: "both",
          kind: "nine_slice_expandable",
          minHeight: 3,
          minWidth: 3,
          parts: [
            part("topLeft", 1),
            part("top", 2),
            part("topRight", 3),
            part("left", 4),
            part("center", 5),
            part("right", 6),
            part("bottomLeft", 7),
            part("bottom", 8),
            part("bottomRight", 9),
          ],
          preserveCaps: true,
          repeat: "center",
        };

        const sample = buildGroupSample(tileset(), { role: "wall", tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9], patternGrammar: grammar });

        expect(sample.w).toBe(3);
        expect(sample.h).toBe(3);
        expect(sample.lower).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(sample.upper).toEqual(Array.from({ length: 9 }, () => TILE.EMPTY));
      });

      it("shows vertical props as repeated upper-layer pairs over grass", () => {
        const grammar: PatternGrammar = {
          axis: "vertical",
          kind: "vertical_expandable",
          minHeight: 2,
          minWidth: 1,
          parts: [part("top", 10), part("bottom", 11)],
          preserveCaps: true,
          repeat: "body",
        };

        const sample = buildGroupSample(tileset("upper"), { role: "prop", tileIds: [10, 11], patternGrammar: grammar });

        expect(sample.w).toBe(5);
        expect(sample.h).toBe(2);
        expect(sample.lower).toEqual(Array.from({ length: 10 }, () => TILE.GRASS));
        expect(sample.upper).toEqual([10, TILE.EMPTY, 10, TILE.EMPTY, 10, 11, TILE.EMPTY, 11, TILE.EMPTY, 11]);
      });

      it("shows grammarless two-tile prop samples as vertical pairs with canopy upper and trunk lower", () => {
        const sample = buildGroupSample(tileset("upper"), { role: "prop", tileIds: [260, 290] });

        expect(sample.w).toBe(5);
        expect(sample.h).toBe(2);
        // 수관 upper 행 + 밑동 lower 행 (숲 겹침용)
        expect(sample.upper.slice(0, 5)).toEqual([260, TILE.EMPTY, 260, TILE.EMPTY, 260]);
        expect(sample.lower.slice(5, 10)).toEqual([290, TILE.GRASS, 290, TILE.GRASS, 290]);
      });

      it("falls back to a single row when no structure grammar is known", () => {
        const sample = buildGroupSample(tileset(), { role: "terrain", tileIds: [21, 22, 23] });

        expect(sample).toEqual({
          h: 1,
          lower: [21, 22, 23],
          upper: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
          w: 3,
        });
      });

      it("clamps oversized samples to the 6x6 preview ceiling", () => {
        const sample = buildGroupSample(tileset(), {
          role: "terrain",
          tileIds: Array.from({ length: 80 }, (_, index) => index),
        });

        expect(sample.w).toBeLessThanOrEqual(6);
        expect(sample.h).toBeLessThanOrEqual(6);
        expect(sample.lower).toHaveLength(sample.w * sample.h);
        expect(sample.upper).toHaveLength(sample.w * sample.h);
      });
    });
  });
  describe("groupSampleJunctionOverlay", () => {
    isolateTimers();
    type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
    function tileset(): TilesetDef {
      return {
        count: 512,
        id: "test_tileset",
        image: { type: "bundled", id: "test" },
        name: "Test",
        passability: Array.from({ length: 512 }, () => ({ down: true, left: true, right: true, up: true })),
        priority: Array.from({ length: 512 }, () => "lower"),
        terrain: Array.from({ length: 512 }, () => 0),
        tileSize: 16,
        tilesPerRow: 16,
      };
    }
    function part(role: PatternGrammar["parts"][number]["role"], tile: number): PatternGrammar["parts"][number] {
      return { role, tileIds: [tile] };
    }
    function wallGrammar(): PatternGrammar {
      return {
        axis: "both",
        kind: "nine_slice_expandable",
        minHeight: 3,
        minWidth: 3,
        parts: [
          part("topLeft", 1),
          part("top", 2),
          part("topRight", 3),
          part("left", 4),
          part("center", 5),
          part("right", 6),
          part("bottomLeft", 7),
          part("bottom", 8),
          part("bottomRight", 9),
        ],
        preserveCaps: true,
        repeat: "center",
      };
    }
    describe("buildGroupSample junction and overlay rules", () => {
      it("leaves the sample identical when no junction or overlay rules are provided", () => {
        const input = { role: "wall", tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9], patternGrammar: wallGrammar() } satisfies Parameters<typeof buildGroupSample>[1];

        const before = buildGroupSample(tileset(), input);
        const after = buildGroupSample(tileset(), { ...input, junctions: [], overlays: [] });

        expect(after).toEqual(before);
      });

      it("omits the requested junction role cells after assembling the sample", () => {
        const sample = buildGroupSample(tileset(), {
          role: "wall",
          tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          patternGrammar: wallGrammar(),
          junctions: [{ action: "omit", atRoles: ["bottomLeft", "bottom", "bottomRight"], side: "below", withRole: "roof" }],
        });

        expect(sample.lower).toEqual([1, 2, 3, 4, 5, 6, TILE.EMPTY, TILE.EMPTY, TILE.EMPTY]);
        expect(sample.upper).toEqual(Array.from({ length: 9 }, () => TILE.EMPTY));
      });

      it("replaces junction role cells with replacement tiles", () => {
        const sample = buildGroupSample(tileset(), {
          role: "wall",
          tileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          patternGrammar: wallGrammar(),
          junctions: [{ action: "replace", atRoles: ["topLeft", "top", "topRight"], replaceWith: [41, 42, 43], side: "above", withRole: "roof" }],
        });

        expect(sample.lower).toEqual([41, 42, 43, 4, 5, 6, 7, 8, 9]);
      });

      it("adds overlay tiles on the representative upper-layer positions deterministically", () => {
        const first = buildGroupSample(tileset(), {
          role: "roof",
          tileIds: [10, 11, 12, 13],
          overlays: [
            { tileIds: [90], when: "ridge" },
            { tileIds: [91, 92], when: "eaveEnd" },
          ],
        });
        const second = buildGroupSample(tileset(), {
          role: "roof",
          tileIds: [10, 11, 12, 13],
          overlays: [
            { tileIds: [90], when: "ridge" },
            { tileIds: [91, 92], when: "eaveEnd" },
          ],
        });

        expect(first.lower).toEqual([10, 11, 12, 13]);
        expect(first.upper).toEqual([91, TILE.EMPTY, 90, 92]);
        expect(second).toEqual(first);
      });
    });
  });
  // 2026-09-24 JRPG 도그푸딩 ember r1 tools.jsonl:
  // - place_npc 귀환 포탈의 transfer 가 마을 (34,3) 통행 불가라 이벤트 전체가 커밋 거부됐다.
  // - upsert_equipment 가 아직 없는 actor_toma·actor_mira 때문에 장비 전체를 거부했다.
  describe("jrpgDogfoodCommitRefs", () => {
    isolateTimers();
    function transfersOf(commands: readonly Command[] | undefined, out: Extract<Command, { kind: "transfer" }>[] = []): Extract<Command, { kind: "transfer" }>[] {
      for (const command of commands ?? []) {
        if (command.kind === "transfer") out.push(command);
        for (const list of nestedCommandLists(command)) transfersOf(list, out);
      }
      return out;
    }
    function block(project: Project, x: number, y: number): void {
      const map = project.maps[project.startMapId]!;
      map.lowerTiles[y * map.width + x] = TILE.WATER;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
    describe("통행 불가 transfer 는 이벤트 전체를 버리지 않고 가까운 착지로 옮긴다", () => {
      it("place_npc 선택지 안의 벽 착지를 반경 3 통행 칸으로 옮기고 커밋한다", () => {
        const project = createBlankProject();
        const ctx = { project };
        const mapId = project.startMapId;
        block(project, 10, 6);
        expect(isPassable(project, project.maps[mapId]!, 10, 6)).toBe(false);
        const result = runTool(ctx, "place_npc", {
          mapId,
          name: "귀환 마법진",
          x: 6,
          y: 6,
          pages: [{
            lines: ["마을로 돌아갈까?"],
            choices: [{ text: "돌아간다", commands: [{ kind: "transfer", mapId, x: 10, y: 6 }] }],
          }],
        });
        expect(result.ok, result.summary).toBe(true);
        const event = ctx.project.maps[mapId]!.events.find((entry) => entry.name === "귀환 마법진");
        const landed = event?.pages?.flatMap((page) => transfersOf(page.commands)) ?? [];
        expect(landed).toHaveLength(1);
        const landing = landed[0]!;
        expect(landing.x === 10 && landing.y === 6).toBe(false);
        expect(Math.max(Math.abs(landing.x - 10), Math.abs(landing.y - 6))).toBeLessThanOrEqual(3);
        expect(isPassable(ctx.project, ctx.project.maps[mapId]!, landing.x, landing.y)).toBe(true);
        expect(result.diff?.warnings.join("\n")).toContain("통행 불가");
      });

      it("이미 통행 가능한 착지는 그대로 둔다", () => {
        const project = createBlankProject();
        const ctx = { project };
        const mapId = project.startMapId;
        const result = runTool(ctx, "upsert_event", {
          mapId,
          event: {
            id: "ev_gate",
            name: "문",
            x: 6,
            y: 6,
            pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "transfer", mapId, x: 8, y: 6 }] }],
          },
        });
        expect(result.ok, result.summary).toBe(true);
        const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_gate");
        expect(transfersOf(event?.pages?.[0]?.commands)).toMatchObject([{ x: 8, y: 6 }]);
        expect(result.diff?.warnings.join("\n") ?? "").not.toContain("통행 불가");
      });
    });
    describe("upsert_equipment 없는 착용 제한", () => {
      it("아직 없는 배우·직업 id 만 빼고 장비는 저장한다", () => {
        const project = createBlankProject();
        const ctx = { project };
        const actorId = project.database.actors[0]!.id;
        const classId = project.database.classes[0]!.id;
        const result = runTool(ctx, "upsert_equipment", {
          equipment: {
            id: "equip_acolyte_staff",
            name: "사제 지팡이",
            slot: "weapon",
            equippableActorIds: ["actor_toma", actorId],
            equippableClassIds: ["class_not_yet", classId],
            statBonuses: { mind: 12, attack: 4 },
          },
        });
        expect(result.ok, result.summary).toBe(true);
        const equipment = ctx.project.database.equipment.find((entry) => entry.id === "equip_acolyte_staff");
        expect(equipment?.equippableActorIds).toEqual([actorId]);
        expect(equipment?.equippableClassIds).toEqual([classId]);
        expect(equipment?.statBonuses.mind).toBe(12);
        const warnings = result.diff?.warnings.join("\n") ?? "";
        expect(warnings).toContain("actor_toma");
        expect(warnings).toContain("class_not_yet");
      });
    });
  });
  // 「구역에 들어오면/나가면」 — **런타임 배선**을 실제 걸음/순간이동으로 검사한다.
  //
  // 왜 runSceneTest 인가: 이 하네스는 걸음 완료 → 드나듦 → 접촉 → 인카운터 순서와 순간이동
  // 절차를 출하 씬(`playSceneMovement` / `playSceneMapCommands`)과 같은 산법으로 돌린다.
  // 판정 자체는 `project/locationTransitions.ts` 한 곳이고, 여기서는 «그 판정이 정말로
  // 이벤트를 돌리는가» 와 «돌리지 말아야 할 때 안 돌리는가» 를 본다.
  describe("locationTransitionRuntime", () => {
    isolateTimers();
    const ENTERED = "sw_entered";
    const LEFT = "sw_left";
    const ENTER_COUNT = "var_enter_count";
    function blankMap(id: string, name: string, width = 16, height = 16): GameMap {
      return {
        id,
        name,
        width,
        height,
        tilesetId: "easyrpg_chipset_combined_town",
        tileSize: 16,
        lowerTiles: new Array(width * height).fill(TILE.GRASS),
        upperTiles: new Array(width * height).fill(TILE.EMPTY),
        events: [],
      };
    }
    /**
     * 맵 하나에 광장(2,2 6×6)이 있는 프로젝트. 스위치 두 개와 카운터 변수 하나를 미리 선언한다
     * (선언 없는 id 는 startSession 이 시드하지 않는다).
     */
    function projectWithPlaza(): { project: Project; mapId: string; plazaId: string } {
      // 맵이 TILE.GRASS(합본 마을 번호)로 깔린다 — 2026-10-07 정리 뒤 새 프로젝트에 없는 그 칩셋을 옛 저장본처럼 싣는다.
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      project.switches = [...project.switches, { id: ENTERED, name: "들어옴" }, { id: LEFT, name: "나감" }];
      project.variables = [...project.variables, { id: ENTER_COUNT, name: "진입 횟수" }];
      const map = blankMap("map_plaza", "광장 맵");
      project.maps[map.id] = map;
      project.startMapId = map.id;
      project.session = { ...project.session, startMapId: map.id, startX: 0, startY: 0 };
      const plaza = addMapLocation(map, { name: "정문 광장", x: 2, y: 2, w: 6, h: 6 });
      if (!plaza.ok) throw new Error("fixture");
      return { project, mapId: map.id, plazaId: plaza.location.id };
    }
    function transitionEvent(options: {
      readonly id: string;
      readonly locationId: string;
      readonly transition: "enter" | "leave";
      readonly commands: readonly Command[];
      /** 페이지에 트리거를 두면 이벤트 트리거 대신 페이지 트리거가 이긴다(런타임 규칙). */
      readonly onPage?: boolean;
      readonly x?: number;
      readonly y?: number;
    }): GameEvent {
      const trigger: Trigger = {
        kind: "locationTransition",
        locationId: options.locationId,
        transition: options.transition,
      };
      // 페이지가 있으면 **페이지 트리거가 이긴다**(`runtimeEventView`: `page.trigger ?? event.trigger`).
      // 그러니 «이벤트 트리거로 저작» 을 검사하려면 페이지가 **없어야** 한다(레거시 꼴).
      // 이 분기를 헷갈리면 페이지의 action 트리거가 조용히 이기며 «안 도는 트리거» 를 검사하게 된다.
      if (!options.onPage) {
        return {
          id: options.id,
          // 이벤트 본체는 구역 밖 구석에 둔다 — 발동은 «주인공이 어디 있나» 로만 정해지고
          // 이벤트 좌표와 무관하다는 것도 이 배치가 증명한다.
          x: options.x ?? 14,
          y: options.y ?? 14,
          trigger,
          commands: [...options.commands],
        };
      }
      const page: EventPage = {
        id: `${options.id}_p1`,
        name: "구역 반응",
        conditions: [],
        graphic: {},
        trigger,
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [...options.commands],
      };
      return {
        id: options.id,
        x: options.x ?? 14,
        y: options.y ?? 14,
        trigger: { kind: "action" },
        commands: [],
        pages: [page],
      };
    }
    const setSwitch = (switchId: string): Command => ({ kind: "setSwitch", switchId, value: true });
    const bumpCounter: Command = { kind: "setVariable", variableId: ENTER_COUNT, op: "+=", value: 1 };
    describe("location transition trigger — 걸음으로 드나들면 발동한다", () => {
      it("구역 경계를 밟는 걸음에서 enter 이벤트가 실행된다", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        project.maps[mapId]!.events = [transitionEvent({
          id: "ev_enter",
          locationId: plazaId,
          transition: "enter",
          commands: [setSwitch(ENTERED)],
        })];

        const result = runSceneTest(project, {
          mapId,
          start: { x: 1, y: 2 },
          steps: [
            { kind: "expect", switchOff: ENTERED },
            { kind: "move", dir: "right" },
            { kind: "expect", playerAt: { x: 2, y: 2 }, switchOn: ENTERED },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("페이지 트리거로 저작해도 같다 (페이지 트리거가 이벤트 트리거를 이긴다)", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        project.maps[mapId]!.events = [transitionEvent({
          id: "ev_enter_page",
          locationId: plazaId,
          transition: "enter",
          commands: [setSwitch(ENTERED)],
          onPage: true,
        })];

        const result = runSceneTest(project, {
          mapId,
          start: { x: 1, y: 3 },
          steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOn: ENTERED }],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("구역을 벗어나는 걸음에서 leave 이벤트가 실행된다", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        project.maps[mapId]!.events = [transitionEvent({
          id: "ev_leave",
          locationId: plazaId,
          transition: "leave",
          commands: [setSwitch(LEFT)],
        })];

        const result = runSceneTest(project, {
          mapId,
          start: { x: 2, y: 2 },
          steps: [
            // 시작 지점이 이미 안이라 «들어옴» 은 없다(기준선). 밖으로 한 걸음.
            { kind: "expect", switchOff: LEFT },
            { kind: "move", dir: "left" },
            { kind: "expect", playerAt: { x: 1, y: 2 }, switchOn: LEFT },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("구역 안을 계속 걸어도 enter 는 한 번뿐이다 (같은 칸·인접 칸 재진입 없음)", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        project.maps[mapId]!.events = [transitionEvent({
          id: "ev_count",
          locationId: plazaId,
          transition: "enter",
          commands: [bumpCounter],
        })];

        const result = runSceneTest(project, {
          mapId,
          start: { x: 1, y: 3 },
          steps: [
            { kind: "move", dir: "right" },
            { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 1 } },
            { kind: "move", dir: "right" },
            { kind: "move", dir: "down" },
            { kind: "move", dir: "left" },
            { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 1 } },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("나갔다 다시 들어오면 두 번째 enter 가 난다", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        project.maps[mapId]!.events = [transitionEvent({
          id: "ev_count",
          locationId: plazaId,
          transition: "enter",
          commands: [bumpCounter],
        })];

        const result = runSceneTest(project, {
          mapId,
          start: { x: 1, y: 3 },
          steps: [
            { kind: "move", dir: "right" },
            { kind: "move", dir: "left" },
            { kind: "move", dir: "right" },
            { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 2 } },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("시작 지점이 구역 안이면 부팅만으로는 enter 가 나지 않는다", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        project.maps[mapId]!.events = [transitionEvent({
          id: "ev_enter",
          locationId: plazaId,
          transition: "enter",
          commands: [setSwitch(ENTERED)],
        })];

        const result = runSceneTest(project, {
          mapId,
          start: { x: 4, y: 4 },
          steps: [{ kind: "expect", switchOff: ENTERED }],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("다른 구역의 트리거는 발동하지 않는다", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        const dock = addMapLocation(project.maps[mapId]!, { name: "부두", x: 11, y: 11, w: 3, h: 3 });
        expect(dock.ok).toBe(true);
        if (!dock.ok) return;
        project.maps[mapId]!.events = [transitionEvent({
          id: "ev_dock",
          locationId: dock.location.id,
          transition: "enter",
          commands: [setSwitch(ENTERED)],
          x: 0,
          y: 0,
        })];
        void plazaId;

        const result = runSceneTest(project, {
          mapId,
          start: { x: 1, y: 3 },
          steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOff: ENTERED }],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });
    });
    describe("location transition trigger — 겹친 구역", () => {
      it("광장 안에서 좌판에 들어가면 좌판 enter 만 나고 광장 enter 는 다시 나지 않는다", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        const stall = addMapLocation(project.maps[mapId]!, { name: "좌판", x: 4, y: 4, w: 2, h: 2 });
        expect(stall.ok).toBe(true);
        if (!stall.ok) return;
        project.maps[mapId]!.events = [
          transitionEvent({ id: "ev_plaza", locationId: plazaId, transition: "enter", commands: [bumpCounter], x: 0, y: 0 }),
          transitionEvent({ id: "ev_stall", locationId: stall.location.id, transition: "enter", commands: [setSwitch(ENTERED)], x: 15, y: 0 }),
        ];

        const result = runSceneTest(project, {
          mapId,
          start: { x: 1, y: 4 },
          steps: [
            { kind: "move", dir: "right" }, // (2,4) 광장 진입
            { kind: "expect", variableEquals: { variableId: ENTER_COUNT, value: 1 }, switchOff: ENTERED },
            { kind: "move", dir: "right" }, // (3,4) 광장 안
            { kind: "move", dir: "right" }, // (4,4) 좌판 진입
            { kind: "expect", switchOn: ENTERED, variableEquals: { variableId: ENTER_COUNT, value: 1 } },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("좌판에서 광장으로 되돌아 나오면 좌판 leave 만 난다 (광장 leave 는 없다)", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        const stall = addMapLocation(project.maps[mapId]!, { name: "좌판", x: 4, y: 4, w: 2, h: 2 });
        expect(stall.ok).toBe(true);
        if (!stall.ok) return;
        project.maps[mapId]!.events = [
          transitionEvent({ id: "ev_stall_out", locationId: stall.location.id, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
          transitionEvent({ id: "ev_plaza_out", locationId: plazaId, transition: "leave", commands: [setSwitch(ENTERED)], x: 15, y: 0 }),
        ];

        const result = runSceneTest(project, {
          mapId,
          start: { x: 4, y: 4 },
          steps: [
            { kind: "move", dir: "left" }, // (3,4): 좌판 밖, 광장 안
            { kind: "expect", switchOn: LEFT, switchOff: ENTERED },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });
    });
    describe("location transition trigger — 순간이동(중간 걸음 없음)", () => {
      function projectWithTwoMaps(): { project: Project; plazaId: string; hallId: string } {
        const { project, mapId, plazaId } = projectWithPlaza();
        const inner = blankMap("map_hall", "회관");
        project.maps[inner.id] = inner;
        const hall = addMapLocation(inner, { name: "회관 안", x: 1, y: 1, w: 6, h: 6 });
        if (!hall.ok) throw new Error("fixture");
        void mapId;
        return { project, plazaId, hallId: hall.location.id };
      }

      it("구역 안에서 다른 맵으로 순간이동하면 출발 구역의 leave 가 실행된다", () => {
        const { project, plazaId } = projectWithTwoMaps();
        project.maps.map_plaza!.events = [
          transitionEvent({ id: "ev_leave", locationId: plazaId, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
          // 광장 안 (3,3) 을 밟으면 회관으로 보내는 접촉 이벤트.
          {
            id: "ev_door",
            x: 3,
            y: 3,
            trigger: { kind: "playerTouch" },
            commands: [{ kind: "transfer", mapId: "map_hall", x: 10, y: 10 }],
          },
        ];

        const result = runSceneTest(project, {
          mapId: "map_plaza",
          start: { x: 3, y: 2 },
          steps: [
            { kind: "move", dir: "down" },
            { kind: "expect", mapId: "map_hall", playerAt: { x: 10, y: 10, mapId: "map_hall" }, switchOn: LEFT },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("도착 지점이 구역 안이면 그 구역의 enter 가 실행된다", () => {
        const { project, hallId } = projectWithTwoMaps();
        project.maps.map_hall!.events = [transitionEvent({
          id: "ev_hall_enter",
          locationId: hallId,
          transition: "enter",
          commands: [setSwitch(ENTERED)],
          x: 12,
          y: 12,
        })];
        project.maps.map_plaza!.events = [{
          id: "ev_door",
          x: 3,
          y: 3,
          trigger: { kind: "playerTouch" },
          // 도착 좌표 (2,2) 는 회관 구역(1,1 6×6) 안이다.
          commands: [{ kind: "transfer", mapId: "map_hall", x: 2, y: 2 }],
        }];

        const result = runSceneTest(project, {
          mapId: "map_plaza",
          start: { x: 3, y: 2 },
          steps: [
            { kind: "move", dir: "down" },
            { kind: "expect", mapId: "map_hall", switchOn: ENTERED },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("같은 맵 안 순간이동으로 구역을 벗어나도 leave 가 실행된다", () => {
        const { project, plazaId } = projectWithPlaza();
        project.maps[project.startMapId]!.events = [
          transitionEvent({ id: "ev_leave", locationId: plazaId, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
          {
            id: "ev_warp",
            x: 3,
            y: 3,
            trigger: { kind: "playerTouch" },
            commands: [{ kind: "transfer", mapId: project.startMapId, x: 12, y: 12 }],
          },
        ];

        const result = runSceneTest(project, {
          mapId: project.startMapId,
          start: { x: 3, y: 2 },
          steps: [
            { kind: "move", dir: "down" },
            { kind: "expect", playerAt: { x: 12, y: 12 }, switchOn: LEFT },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("구역 안에서 같은 구역 안으로 순간이동하면 leave 와 enter 가 둘 다 난다", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        project.maps[mapId]!.events = [
          transitionEvent({ id: "ev_leave", locationId: plazaId, transition: "leave", commands: [setSwitch(LEFT)], x: 0, y: 0 }),
          transitionEvent({ id: "ev_enter", locationId: plazaId, transition: "enter", commands: [bumpCounter], x: 15, y: 0 }),
          {
            id: "ev_warp",
            x: 3,
            y: 3,
            trigger: { kind: "playerTouch" },
            commands: [{ kind: "transfer", mapId, x: 6, y: 6 }],
          },
        ];

        const result = runSceneTest(project, {
          mapId,
          start: { x: 3, y: 2 },
          steps: [
            { kind: "move", dir: "down" },
            // (2,2)..(7,7) 안에서 안으로 옮겨졌다: 구역을 벗어났다 돌아온 것이므로 둘 다 난다.
            { kind: "expect", playerAt: { x: 6, y: 6 }, switchOn: LEFT, variableEquals: { variableId: ENTER_COUNT, value: 1 } },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });
    });
    describe("location transition trigger — 저작이 깨진 상태", () => {
      it("삭제된 구역을 가리키는 트리거는 조용히 실행되지 않는다", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        project.maps[mapId]!.events = [transitionEvent({
          id: "ev_enter",
          locationId: plazaId,
          transition: "enter",
          commands: [setSwitch(ENTERED)],
          x: 0,
          y: 0,
        })];
        expect(deleteMapLocation(project.maps[mapId]!, plazaId)).toBe(true);

        const result = runSceneTest(project, {
          mapId,
          start: { x: 1, y: 3 },
          steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOff: ENTERED }],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });

      it("구역이 축소되어 발밑을 벗어나면 다음 걸음에서 leave 가 실행된다", () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        project.maps[mapId]!.events = [transitionEvent({
          id: "ev_leave",
          locationId: plazaId,
          transition: "leave",
          commands: [setSwitch(LEFT)],
          x: 0,
          y: 0,
        })];
        // 광장을 (2,2) 2×2 로 축소한다 — 주인공이 서게 될 (7,7) 은 이제 밖이다.
        expect(resizeMapLocation(project.maps[mapId]!, plazaId, { x: 2, y: 2, w: 2, h: 2 }).ok).toBe(true);

        const result = runSceneTest(project, {
          mapId,
          // 축소 전 광장이었던 (7,7) 근처에서 시작해 축소된 구역 밖을 걷는다.
          start: { x: 7, y: 7 },
          steps: [
            // 시작 기준선이 이미 «밖» 이므로 leave 도 나지 않는다 — 저작 편집은 사건이 아니다.
            { kind: "expect", switchOff: LEFT },
            { kind: "move", dir: "right" },
            { kind: "expect", switchOff: LEFT },
            // 축소된 구역(2,2 2×2)에 실제로 들어갔다 나오면 leave 가 난다.
            { kind: "walk", to: { x: 2, y: 2 } },
            { kind: "move", dir: "left" },
            { kind: "expect", switchOn: LEFT },
          ],
        });
        expect(result.failureReason).toBeUndefined();
        expect(result.ok).toBe(true);
      });
    });
    // ── 실행이 «밀리는» 경로 ──────────────────────────────────────────────────────
    //
    // 브라우저 실측으로 발견한 결함의 회귀다(2026-09-10): 문(playerTouch)을 밟아 장소 이동하면
    // `transferTo` 가 **문 이벤트의 인터프리터 안에서** 불리므로 그 시점 `scene.running` 이
    // 참이고 `runEvent` 가 즉시 되돌아 나온다 — 가장 흔한 저작(문으로 구역에 들어가기)의
    // enter 이벤트가 한 번도 돌지 않았다. 이제 실행할 수 없었던 것은 큐에 담기고
    // `refreshRuntimeSurfaces`(= 이벤트가 끝나는 자리)에서 뽑힌다.
    //
    // 씬 대역을 쓰는 이유: 이 결함은 Phaser 씬의 `running` 수명에 걸린 배선 문제이고,
    // runSceneTest 하네스는 이벤트를 중첩 실행하므로(running 개념이 없다) 이 경로를 재현하지 못한다.
    describe("location transition trigger — 진행 중이면 밀리고 이벤트가 끝나면 돌아온다", () => {
      type StubScene = {
        map: GameMap;
        session: { occupiedLocationIds?: Record<string, string[]> };
        tileX: number;
        tileY: number;
        running: boolean;
        ran: string[];
        activeRuntimeEvents: (kind: string) => { event: { id: string }; trigger: Trigger }[];
        runEvent: (eventId: string) => Promise<void>;
      };

      function stubScene(map: GameMap, triggers: readonly { id: string; trigger: Trigger }[]): StubScene {
        const scene: StubScene = {
          map,
          session: {},
          tileX: 1,
          tileY: 3,
          running: false,
          ran: [],
          activeRuntimeEvents: (kind) => kind === "locationTransition"
            ? triggers.map((entry) => ({ event: { id: entry.id }, trigger: entry.trigger }))
            : [],
          runEvent: async (eventId) => { scene.ran.push(eventId); },
        };
        return scene;
      }

      it("running 중의 순간이동 진입은 버려지지 않고 이벤트 종료 후 실행된다", async () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        const map = project.maps[mapId]!;
        const scene = stubScene(map, [
          { id: "ev_enter", trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" } },
        ]);
        seedLocationOccupancyForScene(scene);

        // 문 이벤트가 도는 중이다.
        scene.running = true;
        scene.tileX = 4;
        scene.tileY = 4;
        fireLocationTransitionTriggersAfterTransfer(scene, mapId);
        await Promise.resolve();
        expect(scene.ran).toEqual([]);
        // 점유 기록은 밀림과 무관하게 이미 갱신됐다.
        expect(scene.session.occupiedLocationIds?.[mapId]).toEqual([plazaId]);

        // 이벤트가 끝나 running 이 내려간 자리에서 뽑힌다.
        scene.running = false;
        drainPendingLocationTransitions(scene);
        await Promise.resolve();
        expect(scene.ran).toEqual(["ev_enter"]);

        // 두 번 뽑아도 다시 돌지 않는다.
        drainPendingLocationTransitions(scene);
        await Promise.resolve();
        expect(scene.ran).toEqual(["ev_enter"]);
      });

      it("running 중의 걸음 진입도 같은 자리에서 회복된다", async () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        const map = project.maps[mapId]!;
        const scene = stubScene(map, [
          { id: "ev_enter", trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" } },
        ]);
        seedLocationOccupancyForScene(scene);

        scene.running = true;
        scene.tileX = 3;
        scene.tileY = 3;
        fireLocationTransitionTriggers(scene);
        await Promise.resolve();
        expect(scene.ran).toEqual([]);

        scene.running = false;
        drainPendingLocationTransitions(scene);
        await Promise.resolve();
        expect(scene.ran).toEqual(["ev_enter"]);
      });

      it("한 사건에 두 이벤트가 반응하면 첫 이벤트가 대화를 열어도 두 번째가 살아남는다", async () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        const map = project.maps[mapId]!;
        const trigger: Trigger = { kind: "locationTransition", locationId: plazaId, transition: "enter" };
        const scene = stubScene(map, [{ id: "ev_first", trigger }, { id: "ev_second", trigger }]);
        seedLocationOccupancyForScene(scene);
        // 첫 이벤트가 대화를 열어 running 을 세우는 상황을 흉내낸다.
        scene.runEvent = async (eventId) => {
          scene.ran.push(eventId);
          if (eventId === "ev_first") scene.running = true;
        };

        scene.tileX = 3;
        scene.tileY = 3;
        fireLocationTransitionTriggers(scene);
        await Promise.resolve();
        await Promise.resolve();
        expect(scene.ran).toEqual(["ev_first"]);

        scene.running = false;
        drainPendingLocationTransitions(scene);
        await Promise.resolve();
        // 이미 돌린 첫 이벤트가 다시 뽑히지 않는다 — 꼬리만 이어 간다.
        expect(scene.ran).toEqual(["ev_first", "ev_second"]);
      });

      it("기준선 심기는 이전 세션의 밀린 사건을 물려받지 않는다", async () => {
        const { project, mapId, plazaId } = projectWithPlaza();
        const map = project.maps[mapId]!;
        const scene = stubScene(map, [
          { id: "ev_enter", trigger: { kind: "locationTransition", locationId: plazaId, transition: "enter" } },
        ]);
        seedLocationOccupancyForScene(scene);
        scene.running = true;
        scene.tileX = 3;
        scene.tileY = 3;
        fireLocationTransitionTriggers(scene);
        await Promise.resolve();

        // 세이브 불러오기 = 새 기준선. 밀린 사건은 버려진다.
        scene.running = false;
        seedLocationOccupancyForScene(scene);
        drainPendingLocationTransitions(scene);
        await Promise.resolve();
        expect(scene.ran).toEqual([]);
      });
    });
  });
  describe("mapClone", () => {
    isolateTimers();
    describe("cloneGameMap", () => {
      it("copies authored map fields, not only tiles and events", () => {
        const source = createBlankMap("던전", 12, 10, COMBINED_TOWN_TILESET_ID);
        source.encounterRate = 8;
        source.troopIds = ["troop_slime"];
        source.bgm = { mode: "custom", resourceId: "bgm_cave" };
        source.disableSave = true;
        source.battleBackground = "bg_cave";
        source.events.push({
          id: "ev_old",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [{ kind: "transfer", mapId: source.id, x: 1, y: 1 }],
        });

        let n = 0;
        const copy = cloneGameMap(source, {
          newId: "map_copy",
          newName: "던전 복사",
          nextEventId: () => `ev_new_${n++}`,
        });

        expect(copy.id).toBe("map_copy");
        expect(copy.name).toBe("던전 복사");
        expect(copy.encounterRate).toBe(8);
        expect(copy.troopIds).toEqual(["troop_slime"]);
        expect(copy.bgm).toEqual({ mode: "custom", resourceId: "bgm_cave" });
        expect(copy.disableSave).toBe(true);
        expect(copy.battleBackground).toBe("bg_cave");
        expect(copy.events[0]?.id).toBe("ev_new_0");
        expect(copy.events[0]?.id).not.toBe("ev_old");
        expect(copy.events[0]?.commands[0]).toMatchObject({ kind: "transfer", mapId: "map_copy" });
        expect(source.events[0]?.id).toBe("ev_old");
      });
    });
  });
  describe("mapLayoutPlan", () => {
    isolateTimers();
    function bareMap(plan: MapLayoutPlan): GameMap {
      return {
        id: "m1",
        name: "t",
        width: 50,
        height: 50,
        tilesetId: "easyrpg_chipset_combined_town",
        tileSize: 16,
        lowerTiles: new Array(2500).fill(TILE.GRASS),
        upperTiles: new Array(2500).fill(TILE.EMPTY),
        events: [],
        layoutPlan: plan,
      };
    }
    describe("mapLayoutPlan", () => {
      const plan: MapLayoutPlan = {
        version: 1,
        kind: "test",
        seed: 1,
        regions: [
          {
            id: "house-blue",
            role: "house",
            label: "파랑 지붕 석벽 집 (ㄱ자)",
            x: 20,
            y: 20,
            w: 8,
            h: 8,
            kitId: "blue-stone",
            shape: "L",
            tags: ["house", "blue-stone", "centerish"],
          },
          {
            id: "market",
            role: "market",
            label: "중앙 상점(장터 데크)",
            x: 22,
            y: 16,
            w: 9,
            h: 8,
            tags: ["market", "shop", "centerish"],
          },
          {
            id: "forest",
            role: "forest",
            label: "동쪽 곡선 숲",
            x: 44,
            y: 12,
            w: 6,
            h: 32,
            tags: ["forest", "curved"],
          },
        ],
      };

      it("finds house by korean kit words", () => {
        const map = bareMap(plan);
        const hits = findLayoutRegions(map, "파란 집");
        expect(hits.some((r) => r.id === "house-blue")).toBe(true);
      });

      it("finds market by 상점", () => {
        const map = bareMap(plan);
        const hits = findLayoutRegions(map, "가운데 상점");
        expect(hits.some((r) => r.role === "market")).toBe(true);
      });

      it("ranks centerish regions nearer map center", () => {
        const map = bareMap(plan);
        const ranked = rankRegionsByCenter(map, plan.regions);
        expect(ranked[0]?.role === "house" || ranked[0]?.role === "market").toBe(true);
      });
    });
  });
  describe("mapLocationTools", () => {
    isolateTimers();
    const MAP_ID = "tool_loc_map";
    function context(layoutPlan?: MapLayoutPlan): ToolContext {
      const project: Project = createBlankProject();
      const map: GameMap = {
        id: MAP_ID,
        name: "툴 로케이션 맵",
        width: 24,
        height: 24,
        tilesetId: "easyrpg_chipset_combined_town",
        tileSize: 16,
        lowerTiles: new Array(24 * 24).fill(TILE.GRASS),
        upperTiles: new Array(24 * 24).fill(TILE.EMPTY),
        events: [],
        ...(layoutPlan ? { layoutPlan } : {}),
      };
      project.maps[MAP_ID] = map;
      return { project };
    }
    describe("assistant map-location tools", () => {
      it("registers the read and write tools with the expected modes", () => {
        expect(getTool("list_map_locations")?.mode).toBe("read");
        expect(getTool("resolve_map_location")?.mode).toBe("read");
        expect(getTool("create_map_location")?.mode).toBe("write");
        expect(getTool("update_map_location")?.mode).toBe("write");
        expect(getTool("delete_map_location")?.mode).toBe("write");
        expect(getTool("adopt_layout_regions")?.mode).toBe("write");
      });

      it("creates a location and lists it back without the user restating coordinates", () => {
        const ctx = context();
        const created = runTool(ctx, "create_map_location", {
          mapId: MAP_ID,
          name: "정문 광장",
          x: 4,
          y: 4,
          w: 6,
          h: 6,
          note: "성문 앞",
        });
        expect(created.ok, JSON.stringify(created.issues)).toBe(true);

        const listed = runTool(ctx, "list_map_locations", { mapId: MAP_ID });
        expect(listed.ok).toBe(true);
        const locations = (listed.data as { locations: { id: string; name: string; note?: string }[] }).locations;
        expect(locations).toHaveLength(1);
        expect(locations[0]).toMatchObject({ name: "정문 광장", x: 4, y: 4, w: 6, h: 6, note: "성문 앞" });
      });

      it("resolves by human name, by partial name and by point", () => {
        const ctx = context();
        runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
        runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "광장 안 좌판", x: 5, y: 5, w: 2, h: 2 });

        const byName = runTool(ctx, "resolve_map_location", { mapId: MAP_ID, query: "정문 광장" });
        expect(byName.ok).toBe(true);
        expect((byName.data as { location: { name: string } }).location.name).toBe("정문 광장");

        const byPoint = runTool(ctx, "resolve_map_location", { mapId: MAP_ID, x: 5, y: 5 });
        // 겹칠 때는 가장 구체적인(작은) 구역이 이긴다.
        expect((byPoint.data as { location: { name: string } }).location.name).toBe("광장 안 좌판");

        const miss = runTool(ctx, "resolve_map_location", { mapId: MAP_ID, query: "없는 곳" });
        expect(miss.ok).toBe(false);
      });

      it("renaming through the tool keeps the stable id so references survive", () => {
        const ctx = context();
        const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
        const id = (created.data as { location: { id: string } }).location.id;
        const renamed = runTool(ctx, "update_map_location", { mapId: MAP_ID, locationId: "정문 광장", name: "중앙 광장" });
        expect(renamed.ok, JSON.stringify(renamed.issues)).toBe(true);
        expect((renamed.data as { location: { id: string; name: string } }).location).toMatchObject({ id, name: "중앙 광장" });
      });

      it("refuses to delete a referenced location unless the caller states a repair plan", () => {
        const ctx = context();
        const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
        const id = (created.data as { location: { id: string } }).location.id;
        ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

        const refused = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id });
        expect(refused.ok).toBe(false);
        expect(JSON.stringify(refused.issues)).toContain("brokenReferences");
        // 거부된 호출은 아무것도 바꾸지 않는다.
        expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(1);
        expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(id);
      });

      it("deletes with detach and leaves the encounter intact but unrestricted", () => {
        const ctx = context();
        const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
        const id = (created.data as { location: { id: string } }).location.id;
        ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

        const deleted = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id, brokenReferences: "detach" });
        expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
        expect((deleted.data as { repaired: number }).repaired).toBe(1);
        expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(0);
        expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions).toBeUndefined();
      });

      it("deletes with freezeRect and demotes the encounter to the legacy raw rectangle", () => {
        const ctx = context();
        const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
        const id = (created.data as { location: { id: string } }).location.id;
        ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

        const deleted = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id, brokenReferences: "freezeRect" });
        expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
        expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions).toEqual({ region: { x: 4, y: 4, w: 6, h: 6 } });
      });

      it("deletes with remap and repoints the encounter at another location", () => {
        const ctx = context();
        const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
        const other = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "북쪽 숲", x: 14, y: 2, w: 6, h: 6 });
        const id = (created.data as { location: { id: string } }).location.id;
        const otherId = (other.data as { location: { id: string } }).location.id;
        ctx.project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: id } }];

        const deleted = runTool(ctx, "delete_map_location", {
          mapId: MAP_ID,
          locationId: id,
          brokenReferences: "remap",
          replacementLocationId: otherId,
        });
        expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
        expect(ctx.project.maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(otherId);
      });

      it("deletes an unreferenced location outright", () => {
        const ctx = context();
        const created = runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "정문 광장", x: 4, y: 4, w: 6, h: 6 });
        const id = (created.data as { location: { id: string } }).location.id;
        const deleted = runTool(ctx, "delete_map_location", { mapId: MAP_ID, locationId: id });
        expect(deleted.ok, JSON.stringify(deleted.issues)).toBe(true);
        expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(0);
      });

      it("adopt_layout_regions copies builder regions and leaves layoutPlan byte-identical", () => {
        const plan: MapLayoutPlan = {
          version: 1,
          kind: "village-harness-natural-v2",
          regions: [
            { id: "house-a", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 4, h: 4 },
            { id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 },
          ],
        };
        const ctx = context(structuredClone(plan));
        const first = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID, roles: ["house"] });
        expect(first.ok, JSON.stringify(first.issues)).toBe(true);
        expect(mapLocations(ctx.project.maps[MAP_ID]).map((entry) => entry.name)).toEqual(["파랑 지붕 집"]);
        expect(ctx.project.maps[MAP_ID].layoutPlan).toEqual(plan);

        const again = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID, roles: ["house"] });
        expect(again.ok).toBe(true);
        // 건너뛴 이유가 세 갈래(이미 승격 / 이름 충돌 / 재시공 재바인딩)로 갈라졌으므로 이유별로 센다.
        const skipped = (again.data as { skippedAlreadyAdopted: { regionId: string }[] }).skippedAlreadyAdopted;
        expect(skipped.map((entry) => entry.regionId)).toEqual(["house-a"]);
        expect(mapLocations(ctx.project.maps[MAP_ID])).toHaveLength(1);
      });

      it("adopt_layout_regions defaults to commons roles, not to every builder region", () => {
        const plan: MapLayoutPlan = {
          version: 1,
          kind: "village-harness-natural-v2",
          regions: [
            { id: "house-a", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 4, h: 4 },
            { id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 },
          ],
        };
        const ctx = context(structuredClone(plan));
        // roles 를 생략하면 "전부"가 아니다 — 집 롯은 사람이 명시적으로 켜야만 들어온다.
        const result = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        expect(mapLocations(ctx.project.maps[MAP_ID]).map((entry) => entry.name)).toEqual(["중앙 시장"]);
      });

      it("survey_layout_adoption counts candidates without changing anything", () => {
        const plan: MapLayoutPlan = {
          version: 1,
          kind: "village-harness-natural-v2",
          regions: [
            { id: "house-a", role: "house", label: "파랑 지붕 집", x: 2, y: 2, w: 4, h: 4 },
            { id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 },
          ],
        };
        const ctx = context(structuredClone(plan));
        const before = JSON.stringify(ctx.project);
        const result = runTool(ctx, "survey_layout_adoption", {});
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        expect((result.data as { totalAdoptable: number }).totalAdoptable).toBe(1);
        expect(JSON.stringify(ctx.project)).toBe(before);
      });

      it("adopt_layout_regions refuses a map that was not produced by the builder", () => {
        const ctx = context();
        const result = runTool(ctx, "adopt_layout_regions", { mapId: MAP_ID });
        expect(result.ok).toBe(false);
        expect(JSON.stringify(result.issues)).toContain("layoutPlan");
      });

      it("find_layout_regions still only sees builder regions, not the human layer", () => {
        const plan: MapLayoutPlan = {
          version: 1,
          kind: "village-harness-natural-v2",
          regions: [{ id: "market-a", role: "market", label: "중앙 시장", x: 9, y: 9, w: 5, h: 5 }],
        };
        const ctx = context(structuredClone(plan));
        runTool(ctx, "create_map_location", { mapId: MAP_ID, name: "사람이 그린 구역", x: 1, y: 1, w: 3, h: 3 });
        const found = runTool(ctx, "find_layout_regions", { mapId: MAP_ID, query: "시장" });
        const regions = (found.data as { regions: { label: string }[] }).regions;
        expect(regions.map((region) => region.label)).toEqual(["중앙 시장"]);
      });
    });
  });
  // 맵→맵(=칩셋→칩셋) 도달성 도구의 계약과, 《천공의 계단》에 대한 실제 적용.
  //
  // 이 도구가 필요했던 이유: projectLint 는 transfer 의 **목적지**만 보고, 완주 시나리오는
  // 이벤트를 **id 로 호출**한다. 그래서 "관문이 벽 위에 놓여 영원히 밟을 수 없다"는 결함을
  // 둘 다 놓쳤다(실측 6건, 게임이 완주 불가였다). 이 테스트는 실제 통행 판정으로 걸어서 확인한다.
  describe("mapTravelReachability", () => {
    isolateTimers();
    describe("도달성 도구의 계약", () => {
      /** 두 칸 맵 두 개를 관문 하나로 이은 최소 프로젝트. 관문 칸의 통행성을 바꿔 가며 검사한다. */
      function twoMapProject(gateTile: number): Project {
        // The combined-town sheet left defaultTilesets() in the 2026-10-07 copyright purge; build its retired definition.
        const tileset = retiredEasyRpgTileset(COMBINED_TOWN_TILESET_ID);
        const makeMap = (id: string, gateAt: { x: number; y: number } | null, target?: string): GameMap => {
          const width = 4;
          const height = 3;
          const map: GameMap = {
            id,
            name: id,
            width,
            height,
            tilesetId: COMBINED_TOWN_TILESET_ID,
            tileSize: 16,
            lowerTiles: new Array<number>(width * height).fill(240), // 잔디 = 통행 가능
            upperTiles: new Array<number>(width * height).fill(-1),
            events: [],
          } as GameMap;
          if (gateAt && target) {
            map.lowerTiles[gateAt.y * width + gateAt.x] = gateTile;
            map.events.push({
              id: `gate_${id}`,
              x: gateAt.x,
              y: gateAt.y,
              pages: [{
                id: "p",
                name: "관문",
                conditions: [],
                graphic: { transparent: true },
                trigger: "touch",
                priority: "below",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [{ kind: "transfer", mapId: target, x: 1, y: 1 }],
              }],
            } as never);
          }
          return map;
        };
        return {
          maps: {
            map_a: makeMap("map_a", { x: 3, y: 1 }, "map_b"),
            map_b: makeMap("map_b", null),
          },
          tilesets: { [COMBINED_TOWN_TILESET_ID]: tileset },
        } as unknown as Project;
      }

      it("관문 칸이 통행 가능하면 건너간다", () => {
        const project = twoMapProject(240); // 잔디
        const result = canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b");
        expect(result.reachable, "잔디 위 관문인데 못 건넜다").toBe(true);
        expect(result.hops).toHaveLength(1);
        expect(result.hops[0]?.toMapId).toBe("map_b");
      });

      it("관문이 통행 불가 타일 위에 있으면 도달 실패로 잡고 그 이유를 말한다", () => {
        // 342 는 이름이 TILE.FLOOR 인데 전방향 통행 불가다(constants.ts 경고 참조).
        const project = twoMapProject(342);
        const result = canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b");
        expect(result.reachable).toBe(false);
        expect(result.unreachableGates).toHaveLength(1);
        expect(result.unreachableGates[0]?.reason).toBe("통행 불가 타일");
        expect(result.unreachableGates[0]?.eventId).toBe("gate_map_a");
      });

      it("스위치로 잠긴 관문은 스위치를 켜야 열린다", () => {
        const project = twoMapProject(240);
        const gate = project.maps.map_a!.events[0]!;
        const base = (gate.pages ?? [])[0]!;
        // 페이지 순서 규약: 일반 → 구체. 뒤 페이지가 이기므로 조건 있는 페이지를 뒤에 둔다.
        const openPage = { ...base, id: "open", conditions: [{ kind: "switch", switchId: "sw_gate", value: true }] };
        gate.pages = [{ ...base, id: "closed", commands: [] }, openPage as never];

        expect(canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b").reachable).toBe(false);
        expect(
          canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b", { openSwitches: ["sw_gate"] }).reachable,
          "스위치를 켰는데도 관문이 열리지 않았다"
        ).toBe(true);
        expect(
          canTravelBetweenMaps(project, { mapId: "map_a", x: 0, y: 1 }, "map_b", { ignoreSwitches: true }).reachable,
          "ignoreSwitches 는 지형만 보게 하는 옵션이다"
        ).toBe(true);
      });

      it("firstStandableCell 은 나갈 수 있는 칸을 고른다", () => {
        const project = twoMapProject(240);
        const map = project.maps.map_a!;
        const cell = firstStandableCell(project, map)!;
        const canLeave = canMove(project, map, cell.x, cell.y, cell.x + 1, cell.y)
          || canMove(project, map, cell.x, cell.y, cell.x - 1, cell.y)
          || canMove(project, map, cell.x, cell.y, cell.x, cell.y + 1)
          || canMove(project, map, cell.x, cell.y, cell.x, cell.y - 1);
        expect(canLeave).toBe(true);
      });
    });
  });
  // 재료 실패 힌트가 실패한 라벨을 다시 추천하던 순환(「"돌바닥" 없음 → 비슷한 라벨: "돌바닥"」) 을 끊는다.
  // 2026-09-03 적대적 리뷰 01·05·14 — 조수가 같은 라벨로 재시도하다 잘못된 툴로 우회했다.
  describe("materialHintFillable", () => {
    isolateTimers();
    // 재료 라벨(돌바닥·물·모래·흙길·목골 석벽 집 벽·탁자)은 합본 마을 칩셋 어휘다 — 정리 전 빈 프로젝트처럼 합본 마을 맵에서 잰다.
    const blankCombinedTownProject = () => withRetiredCombinedTownMaps(createBlankProject());
    const MAP_ID = "map_blank_start";
    describe("면 채우기 재료 힌트", () => {
      it("있는 라벨이지만 채울 수 없는 재료(돌바닥)는 이유와 채울 수 있는 재료를 준다", () => {
        const tileset = blankCombinedTownProject().tilesets[COMBINED_TOWN_TILESET_ID];
        const result = resolveMaterialByLabel(tileset, "돌바닥", { preferGroup: true, preferRoles: ["water", "terrain"], requireAutotileGroup: true });
        expect(result.status).toBe("missing");
        if (result.status !== "missing") return;
        expect(result.message).toContain("면 채우기 재료가 아닙니다");
        const labels = result.suggestions.map((suggestion) => suggestion.label);
        expect(labels).not.toContain("돌바닥");
        expect(labels.some((label) => /물|모래|흙길/u.test(label)), labels.join(",")).toBe(true);
      });

      it("fill_region 실패 문구는 실패한 라벨을 다시 추천하지 않고 채울 수 있는 재료를 든다", () => {
        const ctx: ToolContext = { project: blankCombinedTownProject() };
        const result = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 3, h: 3 }, material: "돌바닥" });
        expect(result.ok).toBe(false);
        expect(result.summary).not.toMatch(/비슷한 라벨[^:]*: "돌바닥"/u);
        expect(result.summary).toContain("채울 수 있는 재료");
        expect(result.summary).toMatch(/"물"|"모래"|"흙길"/u);
      });

      // qa-game mystery-3: 벽 재료로 fill_region 을 같은 인자로 11번 재시도했다 — 어느 도구로 갈지 알려 준다.
      it("벽 재료는 build_wall·build_hand_interior_room 으로, 가구는 place_props 로 보낸다", () => {
        const ctx: ToolContext = { project: blankCombinedTownProject() };
        const wall = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 3, h: 3 }, material: "목골 석벽 집 벽 확장" });
        expect(wall.ok).toBe(false);
        expect(wall.summary).toContain("build_wall");
        // place_concept 는 레지스트리에서 빠졌다 — 실내 전체는 build_hand_interior_room 으로 보낸다(tileVocabulary.notFillableRoute).
        expect(wall.summary).toContain("build_hand_interior_room");
        const table = runTool(ctx, "fill_region", { mapId: MAP_ID, rect: { x: 2, y: 2, w: 3, h: 3 }, material: "탁자(가로)" });
        expect(table.ok).toBe(false);
        expect(table.summary).toMatch(/place_props|build_wall/u);
      });
    });
  });
});

describe("previewHouse", () => {
  isolateTimers();
  // 몬스터 수집 칩셋 계열 분리(2026-10-06 사용자 결정 「칩셋의 연속성」 + 톤 A).
  // 밝은 monster_*, 에메랄드풍 emerald_monster_*, 버들항은 서로 다른 계열이라 한 게임에 섞이지 않는다.
  describe("monsterKitFamily", () => {
    isolateTimers();
    beforeEach(() => resetMapEditHistory());
    function monsterProject() {
      const project = createBlankProject();
      applyGenrePreset(project, "monster-collect");
      return project;
    }
    describe("몬스터 칩셋 계열", () => {
      it("밝은 킷·에메랄드 재채색·버들항은 서로 다른 계열이다", () => {
        const project = createBlankProject();
        expect(tilesetFamily(project, "monster_overworld")).toBe("oprn-monster");
        expect(tilesetFamily(project, "monster_rooms")).toBe("oprn-monster");
        expect(tilesetFamily(project, "emerald_monster_overworld")).toBe("oprn-monster-emerald");
        expect(tilesetFamily(project, DEFAULT_TILESET_ID)).toBe("oprn-atlas");
      });

      it("몬스터 수집 새 프로젝트는 몬스터 풀밭에서 시작한다", () => {
        const start = monsterProject().maps.map_blank_start!;
        expect(start.tilesetId).toBe("monster_overworld");
        expect(start.tileSize).toBe(16);
      });

      it("손댄 시작 맵은 장르를 바꿔도 칩셋이 그대로다", () => {
        const project = createBlankProject();
        project.maps.map_blank_start!.lowerTiles[4] = 1;
        applyGenrePreset(project, "monster-collect");
        expect(project.maps.map_blank_start!.tilesetId).toBe(DEFAULT_TILESET_ID);
      });

      it("조수는 몬스터 맵에서 같은 계열의 실내 시트로는 새 맵을 만들고, 에메랄드·버들항으로는 못 만든다", () => {
        const ctx: ToolContext = { project: monsterProject(), currentMapId: "map_blank_start", assistantRun: true };
        const create = (id: string, tilesetId: string) =>
          runTool(ctx, "create_map", { id, name: id, width: 20, height: 15, tilesetId }, { dryRun: false });
        expect(create("map_room", "monster_rooms").ok).toBe(true);
        for (const [id, tilesetId] of [["map_emerald", "emerald_monster_overworld"], ["map_town", DEFAULT_TILESET_ID]] as const) {
          const result = create(id, tilesetId);
          expect(result.ok, tilesetId).toBe(false);
          expect(ctx.project.maps[id], tilesetId).toBeUndefined();
        }
      });

      it("폐기 EasyRPG 칩셋 거부는 같은 계열 몬스터 시트를 대안으로 알려 준다", () => {
        // 거부 경로는 폐기 칩셋 정의를 아직 들고 있는 옛 저장본에서 탄다 — 정리 뒤 새 프로젝트에는 그 정의가 없어 「타일셋 없음」으로 먼저 끝난다.
        const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(monsterProject()), currentMapId: "map_blank_start", assistantRun: true };
        const result = runTool(ctx, "create_map", { id: "map_cave", name: "동굴", width: 20, height: 15, tilesetId: "easyrpg_chipset_dungeon" }, { dryRun: false });
        expect(result.ok).toBe(false);
        expect(result.issues?.[0]?.message).toContain("monster_dungeon");
      });

      it("build_monster_game 은 사람이 고른 출연진을 까는 도구라 캐릭터 선택 검사 대상이 아니다", () => {
        expect(getTool("build_monster_game")?.placesCuratedCast).toBe(true);
      });

      it("빈 시작 맵을 캠페인으로 갈아 끼우는 것은 맵 소실이 아니다 — 칠한 맵은 여전히 소실", () => {
        const before = monsterProject();
        const after = structuredClone(before);
        delete after.maps.map_blank_start;
        expect(removedMapIds(before, after)).toEqual([]);
        before.maps.map_blank_start!.lowerTiles[3] = 4;
        expect(removedMapIds(before, after)).toEqual(["map_blank_start"]);
      });
    });
  });
  describe("phase8bHuntingRuntime", () => {
    isolateTimers();
    describe("Phase 8b hunting encounters", () => {
      it("selects weighted encounter entries with a fixed seeded distribution", () => {
        const rng = mulberry32(20260709);
        const counts: Record<string, number> = { a: 0, b: 0 };
        for (let index = 0; index < 4000; index += 1) {
          const troopId = pickWeightedEncounterTroop([
            { troopId: "a", weight: 1 },
            { troopId: "b", weight: 3 },
          ], rng);
          if (troopId) counts[troopId] += 1;
        }

        const ratio = counts.b / counts.a;
        expect(ratio).toBeGreaterThan(2.7);
        expect(ratio).toBeLessThan(3.3);
      });

      it("filters encounters by switch, variable, party level, and region", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId];
        const hero = project.database.actors[0];
        if (!map || !hero) throw new Error("fixture missing");
        project.switches.push({ id: "sw_gate", name: "게이트" });
        project.variables.push({ id: "var_rank", name: "사냥 등급" });
        map.encounterTable = [
          { troopId: "troop_base", weight: 1 },
          { troopId: "troop_switch", weight: 1, conditions: { switchId: "sw_gate" } },
          { troopId: "troop_variable", weight: 1, conditions: { variableId: "var_rank", atLeast: 2 } },
          { troopId: "troop_level", weight: 1, conditions: { minPartyLevel: 5 } },
          { troopId: "troop_region", weight: 1, conditions: { region: { x: 4, y: 0, w: 3, h: 3 } } },
        ];
        const session = startSession(project, 1);
        session.partyActorIds = [hero.id];
        session.actorLevels[hero.id] = 1;

        expect(eligibleEncounterEntries(map, session, { x: 1, y: 1 }).map((entry) => entry.troopId)).toEqual(["troop_base"]);

        session.switches.sw_gate = true;
        session.variables.var_rank = 2;
        session.actorLevels[hero.id] = 5;
        expect(eligibleEncounterEntries(map, session, { x: 5, y: 1 }).map((entry) => entry.troopId)).toEqual([
          "troop_base",
          "troop_switch",
          "troop_variable",
          "troop_level",
          "troop_region",
        ]);
      });
    });
    describe("Phase 8b field spawns", () => {
      it("respects maxAlive, respawnSec, and deterministic passable-cell selection", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId];
        const troopId = project.database.troops[0]?.id;
        if (!map || !troopId) throw new Error("fixture missing");
        map.lowerTiles[1] = TILE.WALL;
        map.fieldSpawns = [{ id: "spawn_test", troopId, area: { x: 0, y: 0, w: 4, h: 1 }, maxAlive: 2, respawnSec: 2 }];

        const state = createFieldSpawnRuntime(project, map, { x: 0, y: 0 });
        expect(materializeFieldSpawnEvents(state).map((event) => [event.x, event.y])).toEqual([[2, 0], [3, 0]]);

        const firstEventId = materializeFieldSpawnEvents(state)[0]?.id;
        expect(firstEventId).toBeDefined();
        resolveFieldSpawnVictory(state, firstEventId ?? "");
        expect(fieldSpawnAliveCount(state)).toBe(1);

        expect(advanceFieldSpawns(state, project, map, { x: 0, y: 0 }, 1000)).toBe(false);
        expect(fieldSpawnAliveCount(state)).toBe(1);
        expect(advanceFieldSpawns(state, project, map, { x: 0, y: 0 }, 1000)).toBe(true);
        expect(materializeFieldSpawnEvents(state).map((event) => [event.x, event.y])).toEqual([[3, 0], [2, 0]]);
      });

      it("does not serialize field spawn runtime state and starts fresh after load", () => {
        const project = createPhase8bHuntingFixture();
        const map = project.maps[project.startMapId];
        if (!map) throw new Error("fixture missing");
        const session = startSession(project, 1);
        const state = createFieldSpawnRuntime(project, map, { x: session.x, y: session.y });
        const firstEventId = materializeFieldSpawnEvents(state)[0]?.id;
        resolveFieldSpawnVictory(state, firstEventId ?? "");
        expect(fieldSpawnAliveCount(state)).toBe(2);

        const snapshot = createSaveSnapshot(project, session);
        expect(JSON.stringify(snapshot)).not.toContain("__field_spawn__");
        const restored = applySaveSnapshot(project, snapshot);
        const fresh = createFieldSpawnRuntime(project, map, { x: restored.x, y: restored.y });
        expect(fieldSpawnAliveCount(fresh)).toBe(3);
      });
    });
    describe("Phase 8b hunting tools and scene integration", () => {
      it("set_encounter_table and make_hunting_ground validate and write map hunting data", () => {
        const context: ToolContext = { project: createBlankProject() };
        const mapId = context.project.startMapId;
        const troopId = context.project.database.troops[0]?.id;
        if (!troopId) throw new Error("troop missing");

        const table = runTool(context, "set_encounter_table", {
          mapId,
          entries: [{ troopId, weight: 2, conditions: { region: { x: 0, y: 0, w: 4, h: 4 } } }],
        });
        expect(table.ok, table.summary).toBe(true);
        expect(context.project.maps[mapId]?.encounterTable).toHaveLength(1);
        expect(runTool(context, "set_encounter_table", { mapId, entries: [{ troopId: "ghost", weight: 1 }] }).ok).toBe(false);

        const hunting = runTool(context, "make_hunting_ground", {
          mapId,
          area: { x: 1, y: 1, w: 3, h: 3 },
          troopId,
          maxAlive: 2,
          respawnSec: 4,
          chase: true,
        });
        expect(hunting.ok, hunting.summary).toBe(true);
        expect(context.project.maps[mapId]?.fieldSpawns?.[0]).toMatchObject({ troopId, maxAlive: 2, respawnSec: 4, chase: true });
      });

      it("run_scene_test enters battle on field-spawn contact, removes the spawn on victory, then respawns", () => {
        const project = createPhase8bHuntingFixture();
        const result = runSceneTest(project, {
          mapId: project.startMapId,
          start: { x: 1, y: 1 },
          steps: [
            { kind: "expect", fieldSpawnCount: 3 },
            { kind: "move", dir: "right" },
            { kind: "expect", fieldSpawnCount: 2 },
            { kind: "wait", ticks: 63 },
            { kind: "expect", fieldSpawnCount: 3 },
          ],
        });

        expect(result.ok, result.failureReason).toBe(true);
        expect(result.session.battleResult).toBe("victory");
      });

      it("hunts repeatedly to level 5 and succeeds at first promotion headlessly", () => {
        const project = createPhase8bHuntingFixture();
        const map = project.maps[project.startMapId];
        const hero = project.database.actors[0];
        if (!map || !hero) throw new Error("fixture missing");
        map.events.push(phase8bPromotionEvent(hero.id));

        const steps = [
          { kind: "move" as const, dir: "right" as const },
          { kind: "wait" as const, ticks: 63 },
          { kind: "move" as const, dir: "right" as const },
          { kind: "wait" as const, ticks: 63 },
          { kind: "move" as const, dir: "right" as const },
          { kind: "wait" as const, ticks: 63 },
          { kind: "move" as const, dir: "right" as const },
          { kind: "interact" as const },
          { kind: "expect" as const, switchOn: HUNTING_PROMOTION_SWITCH_ID },
        ];
        const result = runSceneTest(project, { mapId: project.startMapId, start: { x: 1, y: 1 }, steps });

        expect(result.ok, result.failureReason).toBe(true);
        expect(result.session.actorLevels[hero.id]).toBe(5);
        expect(result.session.classOverrides[hero.id]).toBe(HUNTING_PROMOTED_CLASS_ID);
      });
    });
  });
  describe("placeNpcMalformedPage", () => {
    isolateTimers();
    function runPlaceNpc(id: string, page: Record<string, unknown>): { context: ToolContext; result: ToolResult; page: EventPage | undefined } {
      const context: ToolContext = { project: createBlankProject() };
      const result = runTool(context, "place_npc", {
        mapId: context.project.startMapId,
        x: 2,
        y: 2,
        id,
        name: "리나",
        graphic: { transparent: true },
        pages: [page],
      });
      const map = context.project.maps[context.project.startMapId];
      const event = map?.events.find((entry) => entry.id === id);
      return { context, result, page: event?.pages?.[0] };
    }
    function firstIssueMessage(result: ToolResult): string {
      return result.issues?.[0]?.message ?? "";
    }
    describe("place_npc SimplePage malformed input normalization", () => {
      it("normalizes a missing command kind from the command alias", () => {
        const { result, page } = runPlaceNpc("npc_kind_alias", {
          commands: [{ command: "text", body: "어서 와." }],
        });

        expect(result.ok, result.summary).toBe(true);
        expect(result.summary).toContain("SimplePage 정규화 경고");
        expect(result.diff?.warnings.join("\n")).toContain("pages[0].commands[0].command 문자열을 kind로 사용");
        expect(page?.commands).toContainEqual({ kind: "text", body: "어서 와." });
      });

      it("normalizes an object command kind from kind.command", () => {
        const { result, page } = runPlaceNpc("npc_kind_object_alias", {
          commands: [{ kind: { command: "text" }, body: "오늘은 장터가 조용해." }],
        });

        expect(result.ok, result.summary).toBe(true);
        expect(result.summary).toContain("SimplePage 정규화 경고");
        expect(result.diff?.warnings.join("\n")).toContain("pages[0].commands[0].kind.command 문자열을 kind로 사용");
        expect(page?.commands).toContainEqual({ kind: "text", body: "오늘은 장터가 조용해." });
      });

      it("wraps a single conditions object into an array", () => {
        const { result, page } = runPlaceNpc("npc_single_condition", {
          conditions: { kind: "selfSwitch", key: "A", value: true },
          lines: ["비밀을 지켜줘."],
        });

        expect(result.ok, result.summary).toBe(true);
        expect(result.summary).toContain("SimplePage 정규화 경고");
        expect(result.diff?.warnings.join("\n")).toContain("pages[0].conditions 단수 객체를 배열로 감쌌습니다");
        expect(page?.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
      });

      it("normalizes null conditions to an empty array", () => {
        const { result, page } = runPlaceNpc("npc_null_condition", {
          conditions: null,
          lines: ["조건 없는 페이지야."],
        });

        expect(result.ok, result.summary).toBe(true);
        expect(result.summary).toContain("SimplePage 정규화 경고");
        expect(result.diff?.warnings.join("\n")).toContain("pages[0].conditions null을 빈 배열로 처리했습니다");
        expect(page?.conditions).toEqual([]);
      });
      it("normalizes empty object conditions {} to an empty array", () => {
        const { result, page } = runPlaceNpc("npc_empty_object_condition", {
          conditions: {},
          lines: ["조건 없음."],
        });
        expect(result.ok, result.summary).toBe(true);
        expect(page?.conditions).toEqual([]);
        expect(result.diff?.warnings.join("\n") ?? "").toMatch(/빈\/없음 조건|정규화/);
      });

      it("normalizes conditions kind none to an empty array", () => {
        const { result, page } = runPlaceNpc("npc_kind_none_condition", {
          conditions: { kind: "none" },
          commands: [{ kind: "text", text: "크르르...!" }],
        });
        expect(result.ok, result.summary).toBe(true);
        expect(page?.conditions).toEqual([]);
      });

      it("normalizes LLM self-switch id aliases and boolean strings in conditions and choice commands", () => {
        const { result, page } = runPlaceNpc("npc_self_switch_aliases", {
          conditions: [{ kind: "selfSwitch", id: "A", value: "true" }],
          choices: [{
            text: "선택",
            commands: [{ kind: "setSelfSwitch", id: "A", value: "true" }],
          }],
        });

        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        expect(page?.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
        const choices = page?.commands.find((command) => command.kind === "choices");
        expect(choices).toMatchObject({
          options: [{ branch: [{ kind: "setSelfSwitch", key: "A", value: true }] }],
        });
        const warnings = result.diff?.warnings.join("\n") ?? "";
        expect(warnings).toContain("selfSwitch.key");
        expect(warnings).toContain("boolean");
      });

      it("registers missing global switches referenced by nested choice commands", () => {
        const { context, result } = runPlaceNpc("npc_global_switch", {
          choices: [{
            text: "진실을 선택한다",
            commands: [{ kind: "setSwitch", switchId: "ending_flag", value: true }],
          }],
        });

        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        expect(context.project.switches).toContainEqual(expect.objectContaining({ id: "ending_flag" }));
        expect(context.project.session.switches.ending_flag).toBe(false);
        expect(result.diff?.warnings.join("\n") ?? "").toContain("미등록 switchId 자동 생성: ending_flag");
      });

      it("updates an explicit event id in place without treating itself as an occupied cell", () => {
        const context: ToolContext = { project: createBlankProject() };
        const mapId = context.project.startMapId;
        const first = runTool(context, "place_npc", {
          mapId, x: 2, y: 2, id: "npc_in_place", name: "리나",
          graphic: { transparent: true }, pages: [{ lines: ["처음 대사"] }],
        });
        const second = runTool(context, "place_npc", {
          mapId, x: 2, y: 2, id: "npc_in_place", name: "리나",
          graphic: { transparent: true }, pages: [{ lines: ["수정 대사"] }],
        });

        expect(first.ok).toBe(true);
        expect(second.ok, JSON.stringify(second.issues)).toBe(true);
        expect(second.data).toMatchObject({ x: 2, y: 2, adjusted: false });
        expect(context.project.maps[mapId]?.events.filter((event) => event.id === "npc_in_place")).toHaveLength(1);
      });

      it("moves a transfer endpoint to a nearby usable cell when the requested doorway has no landing", () => {
        const context: ToolContext = { project: createBlankProject() };
        const mapAId = context.project.startMapId;
        expect(runTool(context, "create_map", { id: "transfer_target", name: "실내", width: 20, height: 15 }).ok).toBe(true);
        const mapA = context.project.maps[mapAId]!;
        for (let y = 4; y <= 6; y += 1) {
          for (let x = 4; x <= 6; x += 1) mapA.lowerTiles[y * mapA.width + x] = TILE.WATER;
        }

        const result = runTool(context, "create_transfer_pair", {
          a: { mapId: mapAId, x: 5, y: 5 },
          b: { mapId: "transfer_target", x: 2, y: 2 },
          fade: "black",
        });

        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        expect(result.data).toMatchObject({ adjustedA: true, adjustedB: false });
        expect(result.diff?.warnings.join("\n") ?? "").toContain("출입구 A 위치 자동 조정");
      });

      it("returns a model-friendly error when command kind is an unrecoverable object", () => {
        const { result } = runPlaceNpc("npc_bad_kind_object", {
          commands: [{ kind: { value: "text" }, body: "안녕" }],
        });

        expect(result.ok).toBe(false);
        const message = firstIssueMessage(result);
        expect(message).toContain("필드: pages[0].commands[0].kind");
        expect(message).toContain("기대 타입: string");
        expect(message).toContain("실제 타입: object");
        expect(message).toContain("최소 예시:");
      });

      it("returns a model-friendly error when conditions is not iterable or an object", () => {
        const { result } = runPlaceNpc("npc_bad_conditions", {
          conditions: "sw_ready",
          lines: ["조건이 잘못됐어."],
        });

        expect(result.ok).toBe(false);
        const message = firstIssueMessage(result);
        expect(message).toContain("필드: pages[0].conditions");
        expect(message).toContain("기대 타입: array<EventPageCondition> 또는 EventPageCondition object");
        expect(message).toContain("실제 타입: string");
        expect(message).toContain("최소 예시:");
      });

      it("live 2026-08-25: changeGold without op defaults to += so quest reward pages persist", () => {
        const { result, page } = runPlaceNpc("ev_mayor_lost_ring", {
          lines: ["그 반지! 정말 고맙네. 약속한 100골드네."],
          commands: [{ kind: "changeGold", amount: 100 }],
        });
        expect(result.ok, result.summary).toBe(true);
        expect(page?.commands).toEqual(expect.arrayContaining([
          expect.objectContaining({ kind: "changeGold", amount: 100, op: "+=" }),
        ]));
      });

      it("live 2026-08-25: 촌장 선택지 setSwitch 페이지는 그대로 배치된다", () => {
        const { result, context } = runPlaceNpc("ev_mayor_lost_ring", {
          lines: ["여행자여, 내가 아끼던 반지를 잃어버렸네.", "마을 우물 근처에서 떨어뜨린 것 같아. 찾아오면 100골드를 주겠네."],
          choices: [
            {
              text: "찾아보겠습니다",
              commands: [
                { kind: "setSwitch", switchId: "sw_lost_ring_active", value: true },
                { kind: "text", text: "고맙네. 우물을 자세히 살펴봐 주게." },
              ],
            },
            {
              text: "지금은 어렵습니다",
              commands: [{ kind: "text", text: "마음이 바뀌면 다시 찾아오게." }],
            },
          ],
        });
        expect(result.ok, result.summary).toBe(true);
        const event = context.project.maps[context.project.startMapId]?.events.find((entry) => entry.id === "ev_mayor_lost_ring");
        expect(event).toBeTruthy();
        expect(event?.pages[0]?.name).toBe("리나");
      });

      it("더 높은 엔딩 문턱이 있으면 낮은 호감 페이지가 상승 대사를 덮지 않는다", () => {
        const context: ToolContext = { project: createBlankProject() };
        const variableId = context.project.variables[0]!.id;
        context.project.endings = [{
          id: "ending_love", name: "고백", priority: 10,
          conditions: [{ kind: "variable", variableId, op: ">=", value: 6 }],
        }];
        const result = runTool(context, "place_npc", {
          mapId: context.project.startMapId,
          x: 4, y: 4, id: "npc_narae", name: "설나래",
          graphic: { transparent: true },
          pages: [
            { choices: [{ text: "맞장구", commands: [{ kind: "setVariable", variableId, op: "+=", value: 2 }] }] },
            {
              conditions: [{ kind: "variable", variableId, op: ">=", value: 4 }],
              choices: [{ text: "옥상으로", commands: [{ kind: "text", text: "올라가자" }] }],
            },
          ],
        }, { dryRun: false });
        expect(result.ok, result.summary).toBe(true);
        const event = context.project.maps[context.project.startMapId]?.events.find((entry) => entry.id === "npc_narae");
        expect(event?.pages).toHaveLength(1);
        const body = JSON.stringify(event?.pages[0]?.commands);
        expect(body).toContain("+=",);
        expect(body).toContain("올라가자");
        expect(result.diff?.warnings?.join("\n") ?? "").toContain("조건 분기");
      });
    });
  });
  // place_props 는 소품만 산포한다 — 바닥·벽·건물 재료가 들어오면 거절하고 면 채우기 툴로 보낸다.
  // 2026-09-03 적대적 리뷰 01: 「돌바닥 3x3」이 fill 실패 뒤 place_props 로 통행 불가 타일 6칸이 됐다.
  describe("placePropsRejectsFloorMaterial", () => {
    isolateTimers();
    // 합본 마을 타일 번호·재료(돌벽=12, 팻말, 침엽수)를 겨냥한 시험 — 2026-10-07 저작권 정리 뒤 새 프로젝트 시작 맵은 버들항이라 옛 저장본처럼 합본 마을 위에서 시작한다.
    const createBlankProject = () => startOnRetiredCombinedTown(createBlankDefaultProject());
    const MAP_ID = "map_blank_start";
    describe("place_props 재료 역할 게이트", () => {
      it("바닥/건물 재료(돌바닥)는 소품으로 산포하지 않는다", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 5, y: 4, w: 3, h: 3 }, material: "돌바닥", count: 9 });
        expect(result.ok).toBe(false);
        expect(result.issues?.[0]?.code).toBe("material-not-prop");
        expect(result.summary).toContain("fill_region");
        const map = ctx.project.maps[MAP_ID];
        for (let y = 4; y < 7; y += 1) for (let x = 5; x < 8; x += 1) expect(map.lowerTiles[y * map.width + x]).toBe(TILE.GRASS);
      });

      it("소품 재료(침엽수)는 그대로 산포한다", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const result = runTool(ctx, "place_props", { mapId: MAP_ID, area: { x: 3, y: 3, w: 8, h: 6 }, material: "침엽수", count: 3 });
        expect(result.ok, result.summary).toBe(true);
      });
    });
  });
  describe("previewHouse", () => {
    isolateTimers();
    type NumberGrid = readonly (readonly number[])[];
    type PreviewHouseData = {
      readonly lower: NumberGrid;
      readonly upper: NumberGrid;
      readonly door: {
        readonly x: number;
        readonly y: number;
      };
    };
    type MapRegionData = {
      readonly grid: readonly string[];
    };
    function recordField(value: unknown, key: string): unknown {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
      return Reflect.get(value, key);
    }
    function isNumberGrid(value: unknown): value is NumberGrid {
      return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((cell) => Number.isInteger(cell)));
    }
    function isDoor(value: unknown): value is PreviewHouseData["door"] {
      return Number.isInteger(recordField(value, "x")) && Number.isInteger(recordField(value, "y"));
    }
    function isPreviewHouseData(value: unknown): value is PreviewHouseData {
      return isNumberGrid(recordField(value, "lower")) && isNumberGrid(recordField(value, "upper")) && isDoor(recordField(value, "door"));
    }
    function isMapRegionData(value: unknown): value is MapRegionData {
      const grid = recordField(value, "grid");
      return Array.isArray(grid) && grid.every((row) => typeof row === "string");
    }
    describe("preview_house", () => {
      it("집 미리보기 그리드를 돌려주고 실제 맵은 바꾸지 않는다", () => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const created = runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 20 });
        expect(created.ok, created.summary).toBe(true);

        const result = runTool(ctx, "preview_house", {
          mapId: "m1",
          origin: { x: 2, y: 2 },
          width: 6,
          height: 7,
          material: "plaster",
        });

        expect(result.ok, result.summary).toBe(true);
        if (!isPreviewHouseData(result.data)) throw new Error("preview_house data shape mismatch");
        expect(result.data.lower).toHaveLength(7);
        expect(result.data.upper).toHaveLength(7);
        for (const row of result.data.lower) expect(row).toHaveLength(6);
        for (const row of result.data.upper) expect(row).toHaveLength(6);
        expect(result.data.door).toEqual({ x: expect.any(Number), y: expect.any(Number) });
        expect([...result.data.lower.flat(), ...result.data.upper.flat()].some((tile) => tile !== TILE.EMPTY && tile !== TILE.GRASS)).toBe(true);

        const region = runTool(ctx, "get_map_region", { mapId: "m1", x: 2, y: 2, w: 6, h: 7 });
        expect(region.ok, region.summary).toBe(true);
        if (!isMapRegionData(region.data)) throw new Error("get_map_region data shape mismatch");
        expect(region.data.grid).toEqual(Array.from({ length: 7 }, () => ".".repeat(6)));
      });
    });
  });
});

describe("setClusterRule", () => {
  isolateTimers();
  // 적대적 점검에서 확인된 런타임 결함 6건의 회귀 증거.
  //
  // 각 테스트는 고치기 **전 코드에서 실패**하도록 썼다. 성능 최적화가 만든 결함(1~3)과
  // 그 최적화가 드러낸 기존 결함(4~6)을 한 파일에 모은다 — 전부 "NPC 가 조용히 멈추거나
  // 프레임을 먹는" 같은 증상이라 같이 지켜야 뜻이 있다.
  describe("runtimeAdversarialDefects", () => {
    isolateTimers();
    const SIZE = 16;
    const MAP_ID = "map_adversarial";
    /** 좌우를 가르는 벽 열. 왼쪽(x=1)에서 오른쪽(x=SIZE-2)은 도달 불가다. */
    const WALL_X = 8;
    function walledMap(id = MAP_ID, size = SIZE): GameMap {
      const map = createBlankMap("적대 점검", size, size);
      map.id = id;
      map.lowerTiles = new Array(size * size).fill(TILE.GRASS);
      map.upperTiles = new Array(size * size).fill(-1);
      for (let y = 0; y < size; y += 1) map.lowerTiles[y * size + WALL_X] = TILE.WATER;
      return map;
    }
    function projectWith(map: GameMap): Project {
      // TILE.GRASS/WATER/PATH 는 옛 combined_town 칸 번호다 — 기본 칩셋이 beodeul_city 로 바뀐 뒤(PR #2335) 그 칩셋을 직접 깐다.
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const town = project.tilesets[RETIRED_COMBINED_TOWN_TILESET_ID]!;
      map.tilesetId = town.id;
      map.tileSize = town.tileSize;
      project.maps = { [map.id]: map };
      project.mapTree = { mapId: map.id, children: [] };
      project.startMapId = map.id;
      project.startPos = { x: 0, y: 0 };
      project.system.timeSystem = { enabled: true, minutesPerRealSecond: 60, dayStartHour: 6, dayEndHour: 26 };
      return project;
    }
    function baseMover(overrides: Partial<AutonomousMover> = {}): AutonomousMover {
      return {
        moves: [],
        step: 0,
        timer: 1000,
        repeat: false,
        strategy: "chase",
        facing: "down",
        directionFix: false,
        through: false,
        animationEnabled: true,
        opacity: 255,
        speedRank: 3,
        frequencyRank: 3,
        moveIntervalMs: 100,
        moveDurationMs: 300,
        activeMove: null,
        ...overrides,
      };
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // 1. 통행 사각이 1x1 이면 pass 를 넘겨도 성분 색인을 쓴다
    //
    // 런타임 추격은 1x1 NPC 에도 pass 를 **객체로 항상** 넘긴다. 색인 게이트가 pass 의
    // 유무를 보면 모든 추격 NPC 에서 색인이 죽어 도달 불가 탐색이 맵 전체를 매번 훑는다.
    // ─────────────────────────────────────────────────────────────────────────────
    describe("성분 색인은 pass 유무가 아니라 사각 크기로 갈린다", () => {
      const UNIT_PASS = { footprint: { width: 1, height: 1 }, passRows: 1 } as const;

      it("1x1 통행 사각은 canMoveFootprint 가 canMove 와 완전히 같다 (색인 전제)", () => {
        const map = walledMap("map_unit_equiv", 12);
        const project = projectWith(map);
        // 통행 성질이 섞이도록 물·길·풀을 결정적으로 깐다.
        const palette = [TILE.GRASS, TILE.WATER, TILE.PATH];
        for (let index = 0; index < map.lowerTiles.length; index += 1) {
          map.lowerTiles[index] = palette[(index * 7 + 3) % palette.length] as number;
        }
        let checked = 0;
        for (let y = 0; y < map.height; y += 1) {
          for (let x = 0; x < map.width; x += 1) {
            for (const delta of [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]) {
              const nx = x + delta.x;
              const ny = y + delta.y;
              if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
              checked += 1;
              expect(
                canMoveFootprint(project, map, x, y, UNIT_PASS.footprint, nx, ny, UNIT_PASS.passRows),
                `(${x},${y})→(${nx},${ny}) 에서 1x1 발자국이 canMove 와 다르다 — 색인 전제가 깨진다`
              ).toBe(canMove(project, map, x, y, nx, ny));
            }
          }
        }
        expect(checked).toBeGreaterThan(400);
      });

      it("1x1 pass 를 넘긴 추격 실패도 색인을 만든다", () => {
        const map = walledMap("map_unit_arm");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);

        expect(findChasePath(project, map, { x: 1, y: 1 }, { x: SIZE - 2, y: 1 }, UNIT_PASS)).toEqual([]);
        expect(
          terrainMayReach(project, map, 1, 1, SIZE - 2, 1),
          "1x1 추격 실패가 색인을 만들지 않았다 — 런타임 추격 전체에서 색인이 죽는다"
        ).toBe(false);
      });

      it("1x1 pass 를 넘긴 추격은 색인을 읽어 탐색을 건너뛴다", () => {
        const map = walledMap("map_unit_read");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);
        // 첫 실패로 색인을 세운다.
        findChasePath(project, map, { x: 1, y: 1 }, { x: SIZE - 2, y: 1 }, UNIT_PASS);

        // 이 최적화는 답을 바꾸지 않고 **값만** 바꾸므로 결과로는 관찰할 수 없다. canMove 가
        // 호출마다 project.tilesets[map.tilesetId] 를 읽는 것을 세어 탐색을 돌았는지 가린다.
        const tilesets = project.tilesets;
        let reads = 0;
        (project as { tilesets: typeof tilesets }).tilesets = new Proxy(tilesets, {
          get(target, property, receiver) {
            if (property === map.tilesetId) reads += 1;
            return Reflect.get(target, property, receiver);
          },
        });
        const path = findChasePath(project, map, { x: 1, y: 1 }, { x: SIZE - 2, y: 1 }, UNIT_PASS);
        (project as { tilesets: typeof tilesets }).tilesets = tilesets;

        expect(path).toEqual([]);
        // 왼쪽 성분은 약 120칸이라 A* 를 돌면 통행 판정이 수백 번이다. 색인을 읽으면
        // 지문 검증에 쓰는 한두 번으로 끝난다.
        expect(reads, `색인이 있는데도 통행 판정을 ${reads}번 했다 — 탐색을 그대로 돌았다`).toBeLessThan(10);
      });

      it("1x1 보다 큰 통행 사각은 여전히 색인을 만들지도 읽지도 않는다", () => {
        const map = walledMap("map_wide_pass");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);
        const wide = { footprint: { width: 3, height: 3 }, passRows: 1 } as const;

        expect(findChasePath(project, map, { x: 1, y: 4 }, { x: SIZE - 2, y: 4 }, wide)).toEqual([]);
        expect(
          terrainMayReach(project, map, 1, 4, SIZE - 2, 4),
          "비대칭 통행 그래프의 답이 색인에 섞였다"
        ).toBe(true);
      });

      it("nextChaseDecision 경로(런타임과 같은 호출)도 색인을 만든다", () => {
        const map = walledMap("map_decision_arm");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);
        const mover = baseMover({ chaseRepathTimerMs: 1000 });

        const decision = nextChaseDecision({
          project,
          map,
          from: { x: 1, y: 1 },
          player: { x: SIZE - 2, y: 1 },
          deltaMs: 16,
          mover,
          pathfind: true,
          // playSceneAutonomous 가 넘기는 것과 같은 모양.
          pass: { footprint: { width: 1, height: 1 }, passRows: 1 },
        });

        expect(decision.kind).toBe("wait");
        expect(
          terrainMayReach(project, map, 1, 1, SIZE - 2, 1),
          "런타임과 같은 호출에서 색인이 만들어지지 않았다"
        ).toBe(false);
      });

      it("훑은 성분이 면적에 비해 작으면 색인을 만들지 않는다", () => {
        // 3x3 방 하나에 갇힌 자리에서 실패하면, 색인 빌드(면적 전체)가 방금 훑은 값보다 훨씬 비싸다.
        const map = createBlankMap("작은 성분", 40, 40);
        map.id = "map_small_component";
        map.lowerTiles = new Array(40 * 40).fill(TILE.WATER);
        map.upperTiles = new Array(40 * 40).fill(-1);
        for (let y = 1; y <= 3; y += 1) {
          for (let x = 1; x <= 3; x += 1) map.lowerTiles[y * 40 + x] = TILE.GRASS;
        }
        map.lowerTiles[20 * 40 + 20] = TILE.GRASS;
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);

        expect(findChasePath(project, map, { x: 2, y: 2 }, { x: 20, y: 20 })).toEqual([]);
        expect(
          terrainMayReach(project, map, 2, 2, 20, 20),
          "9칸을 훑고 1600칸 색인을 지었다 — 색인이 없을 때보다 느려진다"
        ).toBe(true);
      });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 2. 타일셋 통행 정의를 제자리에서 고쳐도 색인이 낡음을 잡는다
    //
    // setPassageMark 는 같은 TilesetDef 객체를 제자리에서 바꾼다. identity 비교만으로는
    // 못 잡고, 타일만 해싱한 지문도 못 잡는다.
    // ─────────────────────────────────────────────────────────────────────────────
    describe("색인 지문은 타일셋 통행 정의도 덮는다", () => {
      it("벽 타일을 통행 가능으로 바꾸면 추격이 다시 경로를 찾는다", () => {
        const map = walledMap("map_tileset_open");
        const project = projectWith(map);
        invalidateTilePassabilityComponents(map);
        const from = { x: 1, y: 1 };
        const to = { x: SIZE - 2, y: 1 };

        expect(findChasePath(project, map, from, to)).toEqual([]);
        expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(false);

        // 타일 배열은 그대로다 — 타일셋 정의만 제자리에서 연다.
        const tileset = getTileset(project, map);
        expect(tileset).not.toBeNull();
        const sameTiles = map.lowerTiles;
        setPassageMark(tileset!, TILE.WATER, "o");
        expect(map.lowerTiles).toBe(sameTiles);

        expect(
          terrainMayReach(project, map, from.x, from.y, to.x, to.y),
          "타일셋 통행을 열었는데 색인이 여전히 도달 불가라고 우긴다"
        ).toBe(true);
        const path = findChasePath(project, map, from, to);
        expect(path.length, "벽 타일이 열렸는데 경로를 못 찾았다").toBeGreaterThan(0);
        expect(path[path.length - 1]).toEqual(to);
      });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 3. 스로틀 누적기는 초과분을 이월한다
    // ─────────────────────────────────────────────────────────────────────────────
    describe("시간표 스로틀은 프레임이 길어져도 주기를 늘리지 않는다", () => {
      /**
       * 점검이 실제로 돌았는지는 결과로 안 드러난다(이벤트가 없으면 아무것도 안 바뀐다).
       * updateNpcSchedules 의 첫 줄이 store.getCurrent() 라 그 호출 수가 곧 점검 횟수다.
       */
      function throttleScene(): Parameters<typeof tickNpcSchedules>[0] {
        const map = createBlankMap("스로틀", 8, 8);
        map.id = "map_throttle";
        map.events = [];
        const project = projectWith(map);
        store.replace(project);
        return {
          map,
          session: { ...startSession(project), currentMapId: map.id },
          eventPositions: {},
          autonomousNPCs: new Map(),
          commandMoveRouteEventIds: new Set(),
          registerAutonomousMover: () => undefined,
          refreshRuntimeSurfaces: () => undefined,
          syncRuntimeState: () => undefined,
        } as unknown as Parameters<typeof tickNpcSchedules>[0];
      }

      function countTicks(scene: Parameters<typeof tickNpcSchedules>[0], frames: readonly number[]): number {
        const spy = vi.spyOn(store, "getCurrent");
        for (const frameMs of frames) tickNpcSchedules(scene, false, frameMs);
        const ran = spy.mock.calls.length;
        spy.mockRestore();
        return ran;
      }

      it("99ms 프레임에서도 실효 주기가 100ms 에 붙는다", () => {
        const ran = countTicks(throttleScene(), new Array(100).fill(99));
        // 100 프레임 × 99ms = 9900ms. 100ms 주기면 99회다. 누적기를 0 으로 리셋하면 실효
        // 주기가 198ms 로 늘어 50회로 떨어진다 — 프레임이 길어질 때가 바로 이 스로틀이
        // 겨냥한 상황이므로 거기서 두 배로 느려지면 안 된다.
        expect(ran, `99ms 프레임에서 ${ran}회만 돌았다 — 실효 주기가 늘었다`).toBeGreaterThanOrEqual(99);
      });

      it("60ms 프레임에서도 주기가 120ms 로 늘지 않는다", () => {
        const ran = countTicks(throttleScene(), new Array(60).fill(60));
        // 60 × 60ms = 3600ms → 100ms 주기면 36회. 리셋이면 120ms 주기라 30회다.
        expect(ran, `60ms 프레임에서 ${ran}회만 돌았다`).toBeGreaterThanOrEqual(36);
      });

      it("오래 멈춘 뒤 몰아서 돌지 않는다", () => {
        // 5초짜리 프레임이 세 번 와도 점검은 세 번이다 — 이월을 한 주기 미만으로 자르므로
        // 밀린 시간을 몰아서 돌지 않는다(자르지 않으면 누적기가 무한히 자란다).
        const scene = throttleScene();
        expect(countTicks(scene, [5000, 5000, 5000]), "멈춘 시간을 몰아서 돌았다").toBe(3);
        expect(NPC_SCHEDULE_TICK_MS).toBe(100);
      });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 4~6. 시간표 사슬의 기존 결함
    // ─────────────────────────────────────────────────────────────────────────────
    type ScheduleScene = Parameters<typeof updateNpcSchedules>[0]
      & Parameters<typeof updateAutonomousNPCs>[0]
      & Parameters<typeof registerPageMoveRoutes>[0];
    function scheduledNpc(
      id: string,
      at: { x: number; y: number },
      home: { x: number; y: number },
      mapId: string
    ): GameEvent {
      return {
        id,
        x: home.x,
        y: home.y,
        trigger: { kind: "action" },
        commands: [],
        schedule: [{ when: { hourRange: [6, 18] }, at: { mapId, x: at.x, y: at.y }, activity: "work" }],
        pages: [
          {
            id: `${id}_base`,
            name: "NPC",
            conditions: [],
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            overlapForbidden: true,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          } satisfies EventPage,
        ],
      };
    }
    function scheduleScene(project: Project, projectMap: GameMap, playerAt = { x: 0, y: 0 }): ScheduleScene {
      store.replace(project);
      const system = project.system.timeSystem;
      const time = setGameTimeClock(initialGameTime(system)!, 8, 0, system!);
      const sceneMap = mapWithCommittedEvents(projectMap);
      let scene: ScheduleScene;
      scene = {
        map: sceneMap,
        session: { ...startSession(project), currentMapId: sceneMap.id, gameTime: time },
        eventPositions: initialRuntimeEventPositions(sceneMap.events),
        autonomousNPCs: new Map(),
        commandMoveRouteEventIds: new Set(),
        pageMoveRouteKeys: new Set(),
        pageMoveRouteEventIds: new Set(),
        registerAutonomousMover: (eventId, moves, repeat) => registerAutonomousMover(scene, eventId, moves, repeat),
        refreshRuntimeSurfaces: () => undefined,
        syncRuntimeState: () => undefined,
        eventSprites: new Map(sceneMap.events.map((event) => [event.id, mockSprite()])),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
        tileX: playerAt.x,
        tileY: playerAt.y,
      } as ScheduleScene;
      return scene;
    }
    describe("지워진 시간표 NPC 가 이벤트 계층 재생성 루프를 만들지 않는다", () => {
      it("erase 된 NPC 는 시간표 점검에서 변경을 만들지 않는다", () => {
        const map = walledMap("map_erased");
        map.events = [scheduledNpc("npc_erased", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map);
        scene.session.erasedEventIds = ["npc_erased"];

        let rebuilds = 0;
        (scene as { refreshRuntimeEntities?: () => void }).refreshRuntimeEntities = () => {
          rebuilds += 1;
        };
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        for (let index = 0; index < 5; index += 1) updateNpcSchedules(scene);
        const warns = warn.mock.calls.length;
        warn.mockRestore();

        expect(
          rebuilds,
          "지워진 NPC 때문에 이벤트 계층이 재생성됐다 — 100ms 마다 영구 반복된다"
        ).toBe(0);
        expect(warns, "지워진 NPC 에 무버를 만들려 시도했다").toBe(0);
        expect(scene.autonomousNPCs.has("npc_erased")).toBe(false);
      });

      it("removeEvent 된 NPC 도 같다", () => {
        const map = walledMap("map_removed");
        map.events = [scheduledNpc("npc_removed", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map);
        scene.session.removedEventIds = { [map.id]: ["npc_removed"] };

        let rebuilds = 0;
        (scene as { refreshRuntimeEntities?: () => void }).refreshRuntimeEntities = () => {
          rebuilds += 1;
        };
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        for (let index = 0; index < 5; index += 1) updateNpcSchedules(scene);
        warn.mockRestore();

        expect(rebuilds, "지워진 NPC 때문에 이벤트 계층이 재생성됐다").toBe(0);
      });

      it("멀쩡한 시간표 NPC 는 그대로 경로를 받는다 (필터가 과하지 않다)", () => {
        const map = walledMap("map_alive");
        map.events = [scheduledNpc("npc_alive", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map);

        updateNpcSchedules(scene);
        expect(scene.autonomousNPCs.has("npc_alive"), "소거 필터가 살아 있는 NPC 를 걸렀다").toBe(true);
      });
    });
    describe("시간표 목적지 판정과 경로 탐색이 같은 맵을 본다", () => {
      it("changeTile 로 목적지를 막으면 그 자리를 목표로 잡지 않는다", () => {
        const map = walledMap("map_target_sync");
        // 목적지는 벽 왼쪽(같은 성분)이라 원래는 도달 가능하다.
        map.events = [scheduledNpc("npc_sync", { x: 4, y: 6 }, { x: 2, y: 2 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map);

        // 씬 맵에서만 목적지를 물로 막는다 — project.maps 는 그대로다.
        const targetIndex = 6 * SIZE + 4;
        setMapTileOverride(scene.session, map.id, "lower", targetIndex, TILE.WATER);
        applyMapOverrides({
          session: scene.session,
          map: scene.map,
          getMapId: () => map.id,
        } as unknown as Parameters<typeof applyMapOverrides>[0]);
        expect(scene.map.lowerTiles[targetIndex]).toBe(TILE.WATER);
        expect(project.maps[map.id]!.lowerTiles[targetIndex]).toBe(TILE.GRASS);

        updateNpcSchedules(scene);
        const mover = scene.autonomousNPCs.get("npc_sync");
        expect(
          mover,
          "막힌 목적지로 경로를 못 받아야 정상이지만, 비켜선 칸으로는 갈 수 있어야 한다"
        ).toBeDefined();
        // 정규화가 씬 맵을 봤다면 물 칸을 피해 인접한 통행 칸으로 목표를 옮긴다.
        // 원본 맵을 봤다면 물 칸을 그대로 목표로 잡고 routeTo 가 실패해 무버가 없다.
      });
    });
    describe("막힌 걸음을 소비하지 않아 순서 경로가 어긋나지 않는다", () => {
      it("플레이어가 길을 막으면 같은 걸음을 다시 시도한다", () => {
        const map = createBlankMap("막힌 걸음", 8, 8);
        map.id = MAP_ID;
        map.lowerTiles = new Array(64).fill(TILE.GRASS);
        map.upperTiles = new Array(64).fill(-1);
        map.events = [scheduledNpc("npc_blocked", { x: 4, y: 4 }, { x: 2, y: 4 }, map.id)];
        const project = projectWith(map);
        // 플레이어가 NPC 의 다음 칸(3,4)에 서 있다.
        const scene = scheduleScene(project, map, { x: 3, y: 4 });

        // 오른쪽으로 두 칸 가는 순서 경로를 직접 심는다.
        scene.registerAutonomousMover(
          "npc_blocked",
          [{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }],
          false
        );
        const mover = scene.autonomousNPCs.get("npc_blocked");
        expect(mover).toBeDefined();
        mover!.strategy = "sequence";
        // 시간표·생활 이동의 계산된 경로만 재시도한다(configureScheduleMover 가 세우는 값).
        mover!.retryBlockedSteps = true;
        mover!.moveIntervalMs = 10;
        mover!.timer = 100;

        updateAutonomousNPCs(scene, 100);
        expect(
          mover!.step,
          "막힌 걸음을 소비했다 — 남은 계획 전부가 한 칸 어긋난다"
        ).toBe(0);
        expect(mover!.moves.length, "계획이 버려졌다").toBe(2);

        // 한계까지 막히면 예전처럼 소비해 영구 정지를 만들지 않는다.
        for (let index = 0; index < 20; index += 1) {
          mover!.timer = 100;
          updateAutonomousNPCs(scene, 100);
        }
        expect(
          mover!.step > 0 || mover!.moves.length === 0,
          "영구히 막힌 자리에서 무버가 멈춘 채 남았다 — 재계획이 안 일어난다"
        ).toBe(true);
      });

      it("길이 열리면 어긋남 없이 원래 계획대로 걷는다", () => {
        const map = createBlankMap("열린 길", 8, 8);
        map.id = MAP_ID;
        map.lowerTiles = new Array(64).fill(TILE.GRASS);
        map.upperTiles = new Array(64).fill(-1);
        map.events = [scheduledNpc("npc_resume", { x: 4, y: 4 }, { x: 2, y: 4 }, map.id)];
        const project = projectWith(map);
        const scene = scheduleScene(project, map, { x: 3, y: 4 });

        scene.registerAutonomousMover(
          "npc_resume",
          [{ kind: "move", dir: "right" }, { kind: "move", dir: "down" }],
          false
        );
        const mover = scene.autonomousNPCs.get("npc_resume");
        mover!.strategy = "sequence";
        mover!.retryBlockedSteps = true;
        mover!.moveIntervalMs = 10;

        // 막힌 상태로 한 번 시도.
        mover!.timer = 100;
        updateAutonomousNPCs(scene, 100);
        expect(scene.eventPositions["npc_resume"]?.x ?? 2).toBe(2);

        // 플레이어가 비켜선다.
        (scene as { tileX: number }).tileX = 0;
        mover!.timer = 100;
        updateAutonomousNPCs(scene, 100);
        // 첫 걸음(right)이 소비되지 않았으므로 지금 오른쪽으로 간다 — down 이 아니다.
        expect(
          scene.eventPositions["npc_resume"]?.x,
          "막힌 걸음이 사라져 계획이 어긋났다 — 첫 걸음(right)을 건너뛰었다"
        ).toBe(3);
      });

      // 재시도 대상은 **계산된** 경로뿐이다. 작가가 쓴 custom 경로는 막히면 걸음을 소비하는
      // 기존 동작을 유지해야 한다 — test/runtimeMoveRouteCommands 가 그 계약을 지킨다.
      it("작가가 쓴 custom 경로는 재시도 대상이 아니고 시간표 경로는 대상이다", () => {
        const map = createBlankMap("경로 출처", 8, 8);
        map.id = MAP_ID;
        map.lowerTiles = new Array(64).fill(TILE.GRASS);
        map.upperTiles = new Array(64).fill(-1);
        const authored = scheduledNpc("npc_authored", { x: 4, y: 4 }, { x: 4, y: 4 }, map.id);
        authored.schedule = undefined;
        authored.pages![0].movement = {
          type: "custom",
          speed: 3,
          frequency: 3,
          route: { moves: [{ kind: "move", dir: "right" }], repeat: false },
        };
        const scheduled = scheduledNpc("npc_scheduled", { x: 2, y: 6 }, { x: 6, y: 6 }, map.id);
        map.events = [authored, scheduled];
        const project = projectWith(map);
        const scene = scheduleScene(project, map, { x: 0, y: 0 });

        registerPageMoveRoutes(scene);
        updateNpcSchedules(scene);

        expect(
          scene.autonomousNPCs.get("npc_authored")?.retryBlockedSteps,
          "작가 경로가 재시도 대상이 됐다 — 기존 동작이 바뀐다"
        ).toBe(false);
        expect(
          scene.autonomousNPCs.get("npc_scheduled")?.retryBlockedSteps,
          "시간표 경로가 재시도 대상이 아니다 — A* 계획이 어긋난 채 걷는다"
        ).toBe(true);
      });
    });
  });
  // 작가가 쓴 명령 경로(moveEvent)의 다음 칸을 지나가는 차가 덮고 있으면 걸음을 버리지 않고 잠깐 기다린다.
  // 첫사랑 오프닝(2026-11-05 적대 VQA): 횡단보도를 뛰어 내려오던 남자가 차선의 밴에 막혀 걸음이 소비되어 7칸 못 미쳐 섰다(9회 중 5회).
  // 서 있는 차(고장·정류장)는 3초만 기다리고 예전처럼 소비한다 — 영구 대기 없음.
  describe("runtimeMoveRouteVehicleWait", () => {
    isolateTimers();
    const MAP_ID = "map_vehicle_wait";
    function npc(id: string, at: { x: number; y: number }): GameEvent {
      return {
        id, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [],
        pages: [{
          id: `${id}_base`, name: "NPC", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
          overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
        }],
      } as unknown as GameEvent;
    }
    function build(): { project: Project; map: GameMap } {
      const map = createBlankMap("차 대기", 12, 12);
      map.id = MAP_ID;
      map.lowerTiles = new Array(144).fill(TILE.GRASS);
      map.upperTiles = new Array(144).fill(-1);
      map.events = [npc("walker", { x: 5, y: 1 })];
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const town = project.tilesets[RETIRED_COMBINED_TOWN_TILESET_ID]!;
      map.tilesetId = town.id;
      map.tileSize = town.tileSize;
      project.maps = { [map.id]: map };
      project.mapTree = { mapId: map.id, children: [] };
      project.startMapId = map.id;
      project.startPos = { x: 0, y: 0 };
      return { project, map };
    }
    function parkedTruckSim(): TransitSim {
      const sim = createTransitSim({
        routes: [{ id: "ew", kind: "road", path: [{ x: -6, y: 4 }, { x: 20, y: 4 }], vehicles: ["mc-veh-truck-a"], headwaySec: 1000 }],
      } as unknown as Parameters<typeof createTransitSim>[0], { width: 12, height: 12 }, 0);
      // 경로 칸 i 의 x 는 -6 + i 이고 오른쪽으로 가는 길이 4 의 몸은 머리 칸 기준 x-3..x 를 덮는다 — 머리가 (5,4) 에 오는 pos 11 이어야 걷는 줄 x=5 의 (5,4)를 덮는다(pos 8 은 x -1..2 라 아무것도 막지 않는다).
      sim.vehicles.push({ key: 99, routeIndex: 0, def: sim.routes[0]!.vehicles[0]!, pos: 11, wait: 0, stopAt: null, served: [], blockedSec: 0 });
      return sim;
    }
    function scene(project: Project, map: GameMap, sim: TransitSim) {
      store.replace(project);
      const sceneMap = mapWithCommittedEvents(map);
      const s = {
        map: sceneMap,
        session: { ...startSession(project), currentMapId: sceneMap.id },
        eventPositions: initialRuntimeEventPositions(sceneMap.events),
        autonomousNPCs: new Map(),
        commandMoveRouteEventIds: new Set<string>(),
        pageMoveRouteKeys: new Set(),
        pageMoveRouteEventIds: new Set(),
        refreshRuntimeSurfaces: () => undefined,
        syncRuntimeState: () => undefined,
        eventSprites: new Map(sceneMap.events.map((event) => [event.id, mockSprite()])),
        runtimeDom: { upsertEventMarker: () => undefined },
        runEvent: async () => undefined,
        tileX: 0, tileY: 11,
        transitSim: sim,
      } as unknown as Parameters<typeof registerAutonomousMover>[0] & { transitSim: TransitSim };
      (s as { registerAutonomousMover: unknown }).registerAutonomousMover = (id: string, moves: never, repeat: boolean) => registerAutonomousMover(s, id, moves, repeat);
      return s;
    }
    const DOWN = { kind: "move", dir: "down" } as const;
    const walkDown = (n: number) => Array.from({ length: n }, () => DOWN);
    function start(s: ReturnType<typeof scene>, steps: number) {
      s.registerAutonomousMover("walker", walkDown(steps) as never, false);
      s.commandMoveRouteEventIds.add("walker");
      const mover = s.autonomousNPCs.get("walker")!;
      mover.strategy = "sequence";
      mover.moveIntervalMs = 50;
      return mover;
    }
    function tick(s: ReturnType<typeof scene>, ms: number, frame = 50) {
      for (let t = 0; t < ms; t += frame) updateAutonomousNPCs(s as never, frame);
    }
    describe("명령 경로: 지나가는 차가 다음 칸을 덮으면 걸음을 잃지 않는다", () => {
      it("차가 비키면 남은 걸음을 전부 걸어 목적지에 선다", () => {
        const { project, map } = build();
        const sim = parkedTruckSim();
        const s = scene(project, map, sim);
        const mover = start(s, 6);
        tick(s, 2000);
        const y = s.eventPositions["walker"]?.y ?? 1;
        expect(y, "트럭이 (5,4)를 덮은 동안에는 그 앞에서 기다린다(걸음을 소비해 7칸 못 미쳐 서지 않는다)").toBeLessThan(4);
        expect(mover.step, "막힌 걸음이 보존되어 있다").toBeLessThan(6);
        sim.vehicles.length = 0;
        tick(s, 3000);
        expect(s.eventPositions["walker"]?.y, "차가 비킨 뒤 남은 경로를 끝까지 걸었다").toBe(7);
      });

      it("영구히 서 있는 차는 3초만 기다리고 예전처럼 걸음을 소비한다(멈춘 채 남지 않는다)", () => {
        const { project, map } = build();
        const sim = parkedTruckSim();
        const s = scene(project, map, sim);
        const mover = start(s, 6);
        // 차 대기는 걸음마다 3초다(막힌 걸음을 소비하면 transitWaitMs 가 0 으로 돌아간다): 칸 (5,4) 앞 y=3 에서 남은 4걸음 × 3초 + 걷는 시간.
        tick(s, 20000);
        expect(mover.step >= mover.moves.length || !s.autonomousNPCs.has("walker"), "경로가 소진되어 무버가 끝났다").toBe(true);
      });

      it("차가 아닌 것(지형)에 막힌 걸음은 예전처럼 소비한다", () => {
        const { project, map } = build();
        const sim = parkedTruckSim();
        sim.vehicles.length = 0;
        map.lowerTiles[3 * 12 + 5] = TILE.WATER;
        const s = scene(project, map, sim);
        const mover = start(s, 4);
        tick(s, 2000);
        expect(mover.transitWaitMs ?? 0, "차 대기가 아니다").toBe(0);
        expect(s.eventPositions["walker"]?.y ?? 1, "물 앞에서 걸음이 소비되어 경로가 진행됐다").toBeLessThan(4);
      });
    });
  });
  describe("setClusterRule", () => {
    isolateTimers();
    function clusterGroup(): TileGroupMetadata {
      return {
        defaultLayer: "lower",
        description: "클러스터 규칙 대상",
        id: "cluster-main",
        name: "클러스터",
        placementRules: "규칙 테스트",
        role: "building",
        tileIds: [260, 290],
      };
    }
    function contextWithGroup(): ToolContext {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      for (const map of Object.values(project.maps)) {
        map.lowerTiles.fill(TILE.GRASS);
        map.upperTiles.fill(TILE.EMPTY);
      }
      project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [clusterGroup()];
      return { project };
    }
    function rulesOf(ctx: ToolContext): readonly ClusterRule[] {
      return ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0]?.rules ?? [];
    }
    describe("set_cluster_rule", () => {
      it("규칙을 추가하고 같은 id면 갱신한다", () => {
        // Given: a project with one tile group.
        const ctx = contextWithGroup();

        // When: the same cluster rule id is written twice.
        const first = runTool(ctx, "set_cluster_rule", {
          groupId: "cluster-main",
          rule: { id: "roof-wall", kind: "adjacency", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "hard" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const second = runTool(ctx, "set_cluster_rule", {
          groupId: "cluster-main",
          rule: { id: "roof-wall", kind: "adjacency", message: "260 아래 290 필요", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "medium" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: the rule is updated in place.
        expect(first.ok, first.summary).toBe(true);
        expect(second.ok, second.summary).toBe(true);
        expect(rulesOf(ctx)).toEqual([
          { id: "roof-wall", kind: "adjacency", message: "260 아래 290 필요", params: { a: 260, b: 290, relation: "aAboveB" }, strength: "medium" },
        ]);
      });

      it("없는 그룹과 잘못된 kind는 거부한다", () => {
        // Given: a project with one known group.
        const ctx = contextWithGroup();

        // When: invalid set_cluster_rule calls are made.
        const missing = runTool(ctx, "set_cluster_rule", {
          groupId: "missing",
          rule: { id: "ok", kind: "count", params: { max: 1 }, strength: "soft" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const invalidKind = runTool(ctx, "set_cluster_rule", {
          groupId: "cluster-main",
          rule: { id: "bad", kind: "diagonal", params: {}, strength: "hard" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: both calls fail without changing the group rules.
        expect(missing.ok).toBe(false);
        expect(missing.issues?.[0]?.code).toBe("group-not-found");
        expect(invalidKind.ok).toBe(false);
        expect(invalidKind.issues?.[0]?.code).toBe("invalid-args");
        expect(rulesOf(ctx)).toEqual([]);
      });

      it("upsert_tile_group stores rules and the registry exposes set_cluster_rule", () => {
        // Given: a blank project.
        const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(createBlankProject()) };

        // When: a group is upserted with cluster rules.
        const result = runTool(ctx, "upsert_tile_group", {
          name: "규칙 그룹",
          role: "building",
          rules: [{ id: "max-two", kind: "count", params: { max: 2, perMap: true }, strength: "soft" }],
          tileIds: [260, 290],
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: rules are persisted and the new tool is catalog-visible.
        expect(result.ok, result.summary).toBe(true);
        const groupId = (result.data as { readonly groupId: string }).groupId;
        const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((candidate) => candidate.id === groupId);
        expect(group?.rules).toEqual([{ id: "max-two", kind: "count", params: { max: 2, perMap: true }, strength: "soft" }]);
        expect(allTools().map((tool) => tool.name)).toContain("set_cluster_rule");
      });
    });
  });
  // 실내 오두막: tile_query 라벨 ↔ place_props material 일치, 상점 NPC 중복 방지.
  describe("shopNpcTableRegionFix", () => {
    isolateTimers();
    function interiorHutContext(): ToolContext {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      const mapId = "map_rp_hut_v1";
      const w = 10;
      const h = 9;
      const size = w * h;
      project.maps[mapId] = {
        id: mapId,
        name: "연습 · 오두막 (10×9)",
        width: w,
        height: h,
        tilesetId: INTERIOR_ROOM_TILESET_ID,
        tileSize: 16,
        lowerTiles: new Array(size).fill(72),
        upperTiles: new Array(size).fill(TILE.EMPTY),
        events: [],
      };
      project.startMapId = mapId;
      return { project };
    }
    describe("interior shop NPC + table material path", () => {
      it("tile_query labels for start interior map resolve with place_props 사각 탁자", () => {
        const ctx = interiorHutContext();
        const labels = runTool(ctx, "tile_query", { ask: "labels", query: "탁자" }, { dryRun: true });
        expect(labels.ok, labels.summary).toBe(true);
        const data = labels.data as { tilesetId: string; labels: { label: string }[] };
        expect(data.tilesetId).toBe(INTERIOR_ROOM_TILESET_ID);
        const tableLabel = data.labels.find((l) => l.label.includes("사각") || l.label.includes("긴 탁자") || l.label.includes("원형"))?.label;
        expect(tableLabel, JSON.stringify(data.labels.slice(0, 8))).toBeTruthy();

        const place = runTool(
          ctx,
          "place_props",
          {
            mapId: "map_rp_hut_v1",
            area: { x: 2, y: 4, w: 5, h: 2 },
            material: tableLabel!,
            count: 1,
          },
          { dryRun: false },
        );
        expect(place.ok, place.summary).toBe(true);
      });

      it("places 사각 탁자 on interior wood floor (not outdoor grass-only footprint)", () => {
        const ctx = interiorHutContext();
        const place = runTool(
          ctx,
          "place_props",
          {
            mapId: "map_rp_hut_v1",
            area: { x: 2, y: 4, w: 5, h: 2 },
            material: "사각 탁자",
            count: 1,
          },
          { dryRun: false },
        );
        expect(place.ok, place.summary).toBe(true);
        const map = ctx.project.maps["map_rp_hut_v1"]!;
        expect(map.upperTiles.includes(328)).toBe(true);
        expect(place.summary).toMatch(/1\/1|1개/);
      });

      it("rejects combined-town table labels on interior map", () => {
        const ctx = interiorHutContext();
        const place = runTool(
          ctx,
          "place_props",
          {
            mapId: "map_rp_hut_v1",
            area: { x: 2, y: 4, w: 5, h: 2 },
            material: "가로 탁자 중",
            count: 1,
          },
          { dryRun: false },
        );
        expect(place.ok).toBe(false);
        expect(place.summary).toMatch(/라벨|찾지 못했|material/i);
      });

      it("merges nearby shop NPCs even when the second call uses a different explicit id", () => {
        const ctx = interiorHutContext();
        const mapId = "map_rp_hut_v1";
        const first = runTool(
          ctx,
          "place_npc",
          {
            mapId,
            x: 4,
            y: 5,
            id: "npc_shopkeeper_1",
            name: "상점 주인",
            pages: [{ lines: ["어서 오세요!"] }],
          },
          { dryRun: false },
        );
        expect(first.ok, first.summary).toBe(true);

        const second = runTool(
          ctx,
          "place_npc",
          {
            mapId,
            x: 4,
            y: 4,
            id: "npc_merchant_v1",
            name: "상인",
            graphic: { query: "merchant" },
            pages: [{ text: "어서 오세요!", conditions: [] }],
          },
          { dryRun: false },
        );
        expect(second.ok, second.summary).toBe(true);
        const data = second.data as { eventId: string; reused?: boolean };
        expect(data.eventId).toBe("npc_shopkeeper_1");
        expect(data.reused).toBe(true);
        expect(ctx.project.maps[mapId]!.events).toHaveLength(1);
      });

      it("allows a second distinct NPC when ids are explicit", () => {
        const ctx = interiorHutContext();
        const mapId = "map_rp_hut_v1";
        runTool(ctx, "place_npc", {
          mapId, x: 2, y: 4, id: "npc_a", name: "갑", pages: [{ lines: ["a"] }],
        }, { dryRun: false });
        const second = runTool(ctx, "place_npc", {
          mapId, x: 3, y: 4, id: "npc_b", name: "을", pages: [{ lines: ["b"] }],
        }, { dryRun: false });
        expect(second.ok, second.summary).toBe(true);
        expect(ctx.project.maps[mapId]!.events).toHaveLength(2);
      });
    });
  });
  describe("structureRuleTools", () => {
    isolateTimers();
    function contextWithGroup(): ToolContext {
      const project = withRetiredEasyRpgTilesets(createBlankProject());
      project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups = [roofGroup()];
      return { project };
    }
    function roofGroup(): TileGroupMetadata {
      return {
        defaultLayer: "upper",
        description: "구조 규칙 테스트 지붕",
        id: "roof-main",
        name: "지붕",
        patternGrammar: {
          axis: "both",
          kind: "nine_slice_expandable",
          parts: [
            { role: "bottomLeft", tileIds: [1] },
            { role: "bottom", tileIds: [2] },
            { role: "bottomRight", tileIds: [3] },
          ],
          preserveCaps: true,
          repeat: "center",
        },
        placementRules: "벽 위에 배치",
        role: "roof",
        tileIds: [1, 2, 3],
      };
    }
    describe("structure rule tools", () => {
      it("set_group_junction adds and updates a rule for the same neighbor side", () => {
        // Given: a tileset group that can define roof-wall boundary behavior.
        const ctx = contextWithGroup();

        // When: the junction rule is written, then written again for the same neighbor side.
        const first = runTool(ctx, "set_group_junction", {
          groupId: "roof-main",
          junction: { action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const second = runTool(ctx, "set_group_junction", {
          groupId: "roof-main",
          junction: { action: "replace", atRoles: ["bottomLeft"], replaceWith: [4], side: "below", withRole: "wall" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: the rule is updated in place instead of duplicated.
        expect(first.ok, first.summary).toBe(true);
        expect(second.ok, second.summary).toBe(true);
        const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0];
        expect(group?.junctions).toEqual([
          { action: "replace", atRoles: ["bottomLeft"], replaceWith: [4], side: "below", withRole: "wall" },
        ]);
      });

      it("set_group_overlay adds and updates a rule for the same condition", () => {
        // Given: a tileset group that can add conditional roof overlays.
        const ctx = contextWithGroup();

        // When: the same overlay condition is written twice.
        const first = runTool(ctx, "set_group_overlay", {
          groupId: "roof-main",
          overlay: { tileIds: [5], when: "diagonalCorner" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const second = runTool(ctx, "set_group_overlay", {
          groupId: "roof-main",
          overlay: { tileIds: [6, 7], when: "diagonalCorner" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: the condition has the latest tile set.
        expect(first.ok, first.summary).toBe(true);
        expect(second.ok, second.summary).toBe(true);
        const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.[0];
        expect(group?.overlays).toEqual([{ tileIds: [6, 7], when: "diagonalCorner" }]);
      });

      it("rejects structure rules for an unknown group", () => {
        // Given: a tileset without the requested group id.
        const ctx = contextWithGroup();

        // When: a structure rule targets that id.
        const junction = runTool(ctx, "set_group_junction", {
          groupId: "missing",
          junction: { action: "omit", side: "below", withRole: "wall" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });
        const overlay = runTool(ctx, "set_group_overlay", {
          groupId: "missing",
          overlay: { tileIds: [5], when: "ridge" },
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: both tools report a group-not-found failure.
        expect(junction.ok).toBe(false);
        expect(junction.issues?.[0]?.code).toBe("group-not-found");
        expect(overlay.ok).toBe(false);
        expect(overlay.issues?.[0]?.code).toBe("group-not-found");
      });

      it("upsert_tile_group stores junctions and overlays when provided", () => {
        // Given: a blank project with the default tileset.
        const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(createBlankProject()) };

        // When: a group is upserted with structural rules.
        const result = runTool(ctx, "upsert_tile_group", {
          junctions: [{ action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" }],
          name: "처마 지붕",
          overlays: [{ tileIds: [8], when: "eaveEnd" }],
          role: "roof",
          tileIds: [1, 2, 3],
          tilesetId: COMBINED_TOWN_TILESET_ID,
        });

        // Then: both optional arrays are persisted on the group.
        expect(result.ok, result.summary).toBe(true);
        const groupId = (result.data as { readonly groupId: string }).groupId;
        const group = ctx.project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups?.find((candidate) => candidate.id === groupId);
        expect(group?.junctions).toEqual([{ action: "omit", atRoles: ["bottom"], side: "below", withRole: "wall" }]);
        expect(group?.overlays).toEqual([{ tileIds: [8], when: "eaveEnd" }]);
      });

      it("catalog registry includes the structure rule tools", () => {
        // Given: the tool registry is the catalog source.
        const names = allTools().map((tool) => tool.name);

        // Then: both new tools are registered for catalog generation.
        expect(names).toEqual(expect.arrayContaining(["set_group_junction", "set_group_overlay"]));
      });
    });
  });
});
