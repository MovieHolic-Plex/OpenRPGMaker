import { beforeEach, describe, expect, it, afterEach, vi } from "vitest";
import { addSwitch, addVariable, renameSwitch, renameVariable, eraseTile, fillTile, paintTile, toggleCollision } from "@/editor/actions";
import { createBlankProject, TILE, createBlankMap } from "@/project/defaults";
import { store } from "@/project/store";
import { withRetiredEasyRpgTilesets, startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { serialize, deserialize } from "@/project/io";
import type { GameMap, Project, GameEvent } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";
import { AgentGhostPreviewRenderer, computeGhostAnimationState, ghostPhaseChipInfo, preferredGhostToolName } from "@/editor/agentPreviewRenderers";
import { clearAgentGhostPreview, GHOST_WIPE_DURATION_MS, replaceAgentGhostPreviewFromProjectDiff, getAgentGhostPreviewState, isAgentGhostPreviewHidden, setAgentGhostPreviewHidden, subscribeAgentGhostPreview, buildGhostRevealSchedule, GHOST_WIPE_HOLD_MS, type AgentGhostCell, appendAgentGhostPreviewForToolCall, clearAgentGhostRunningTool, setAgentGhostRunningTool, type AgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { installFakeDom } from "./fakeDom";
import { buildEditorReferenceIndex, findEditorReferences, resolveEditorReferenceQuery, type EditorReferenceIndex } from "@/editor/aiAnswerLinks";
import { computeActiveToolDomains, computeAssistantToolMode, resetAssistantToolDomainMemory } from "@/editor/assistantToolMode";
import { toOpenAiTools, activeTools, allTools, LEGACY_TILE_KNOWLEDGE_SUPERSEDED, type ToolDefinition, type ToolDomain } from "@/editor/tools";
import { ESCALATION_DENYLIST, MAX_CAPABILITY_ESCALATED_TOOLS, capabilityEscalationSchemas, capabilityEscalatedToolNames } from "@/ai/capabilityEscalation";
import { mentionedToolSchemas } from "@/ai/planToolExposure";
import { editorState } from "@/editor/editorState";
import { el } from "@/util/dom";
import { declaredIntent } from "./intentFixture";
import { buildWelcomeFreeTextPrompt, buildWelcomeGenrePresetPrompt, welcomeBattleLookLine, welcomeGenrePresetById } from "@/editor/welcomeGenrePresets";
import { BATTLE_LOOK_PRESET_IDS, BATTLE_LOOK_PRESETS, battleLookMoodGuide } from "@/project/battleLook";
import { interviewBrief } from "./helpers/gameDesignBrief";
import { layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { layoutConceptFacilityDoubleRow } from "@/editor/conceptLayoutDoubleRow";
import type { ConceptBundleRecord, ConceptFacilityRecord } from "@/project/types/conceptBundle";
import { createDefaultGameEvent } from "@/editor/eventActions";

describe("actions", () => {
  isolateTimers();
  describe("databasePanelBaseline", () => {
    isolateTimers();
    describe("Database panel baseline behavior", () => {
      beforeEach(() => {
        store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
      });

      it("keeps switch and variable CRUD data in the project store", () => {
        const switchId = addSwitch("Door Open");
        const variableId = addVariable("Puzzle Count");

        renameSwitch(switchId, "Door Closed");
        renameVariable(variableId, "Puzzle Score");

        const project = store.getCurrent();
        expect(project.switches.find((entry) => entry.id === switchId)?.name).toBe("Door Closed");
        expect(project.variables.find((entry) => entry.id === variableId)?.name).toBe("Puzzle Score");
      });

      it("appends switch and variable ids beyond 1000 when legacy slots are all in use", () => {
        const project = withRetiredEasyRpgTilesets(createBlankProject());
        project.switches = Array.from({ length: 1000 }, (_, index) => ({
          id: `sw_${String(index + 1).padStart(4, "0")}`,
          name: `Switch ${index + 1}`,
        }));
        project.variables = Array.from({ length: 1000 }, (_, index) => ({
          id: `var_${String(index + 1).padStart(4, "0")}`,
          name: `Variable ${index + 1}`,
        }));
        store.replace(project);

        const switchId = addSwitch("Switch 1001");
        const variableId = addVariable("Variable 1001");

        expect(switchId).toBe("sw_1001");
        expect(variableId).toBe("var_1001");
        expect(store.getCurrent().switches.at(-1)).toEqual({ id: "sw_1001", name: "Switch 1001" });
        expect(store.getCurrent().variables.at(-1)).toEqual({ id: "var_1001", name: "Variable 1001" });
      });
    });
  });
  // test/persistenceRoundTrip.m1.test.ts
  // M1: 저장/불러오기 왕복 무결 — 사용자가 편집한 내용이 serialize→deserialize 후 보존되는지.
  // io.test.ts가 기본 케이스를 다루므로, 여기서는 '실제 편집 액션 결과'의 보존에 집중한다.
  describe("persistenceRoundTrip.m1", () => {
    isolateTimers();
    function roundTrip(project: Project): Project {
      return deserialize(serialize(project));
    }
    describe("타일 편집 왕복 보존", () => {
      it("페인트한 lower 타일이 복원된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const mapId = store.getCurrent().startMapId;
        paintTile(mapId, "lower", 1, 2, TILE.WATER);

        const before = store.getCurrent();
        const after = roundTrip(before);
        const idx = 2 * before.maps[mapId].width + 1;
        expect(after.maps[mapId].lowerTiles[idx]).toBe(TILE.WATER);
      });

      it("flood fill 결과가 복원된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const mapId = store.getCurrent().startMapId;
        fillTile(mapId, "lower", 0, 0, TILE.GRASS);

        const before = store.getCurrent();
        const after = roundTrip(before);
        // 시작 셀만 검증 (flood fill 알고리즘 자체는 별도 테스트됨)
        expect(after.maps[mapId].lowerTiles[0]).toBe(before.maps[mapId].lowerTiles[0]);
      });

      it("지운 타일(EMPTY)이 복원된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const mapId = store.getCurrent().startMapId;
        paintTile(mapId, "lower", 3, 3, TILE.WATER);
        eraseTile(mapId, "lower", 3, 3);

        const before = store.getCurrent();
        const after = roundTrip(before);
        const idx = 3 * before.maps[mapId].width + 3;
        expect(after.maps[mapId].lowerTiles[idx]).toBe(TILE.EMPTY);
      });

      it("upper 오버레이 타일이 복원된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const mapId = store.getCurrent().startMapId;
        paintTile(mapId, "upper", 5, 5, TILE.FLOWERS);

        const before = store.getCurrent();
        const after = roundTrip(before);
        const idx = 5 * before.maps[mapId].width + 5;
        // flat upperTiles 또는 스택 중 하나에 존재해야 함
        const flat = after.maps[mapId].upperTiles[idx];
        const stacked = after.maps[mapId].upperTileStacks?.[idx];
        expect(flat === TILE.FLOWERS || (stacked && stacked.includes(TILE.FLOWERS))).toBe(true);
      });

      it("양쪽 레이어의 독립 타일이 모두 복원된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const mapId = store.getCurrent().startMapId;
        paintTile(mapId, "lower", 2, 2, TILE.WATER);
        paintTile(mapId, "upper", 2, 2, TILE.FLOWERS);

        const before = store.getCurrent();
        const after = roundTrip(before);
        const idx = 2 * before.maps[mapId].width + 2;
        expect(after.maps[mapId].lowerTiles[idx]).toBe(TILE.WATER);
      });
    });
    describe("통행(passability) 편집 왕복 보존", () => {
      it("토글한 통행 변경이 복원된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const mapId = store.getCurrent().startMapId;
        paintTile(mapId, "lower", 0, 0, TILE.GRASS);
        // 토글 전 원본 통행을 미리 캡처 (GRASS는 기본 passable)
        const ts0 = store.getCurrent().tilesets[store.getCurrent().maps[mapId].tilesetId];
        const original = { ...ts0.passability[TILE.GRASS] };
        toggleCollision(mapId, 0, 0); // passable → solid

        const before = store.getCurrent();
        const after = roundTrip(before);
        const afterMap = after.maps[mapId];
        const tsAfter = after.tilesets[afterMap.tilesetId];
        const restored = tsAfter.passability[TILE.GRASS];

        // 토글 결과(solid)가 보존되어야 함 (원본 passable과 달라야 함)
        expect(restored).not.toEqual(original);
        expect(restored.up && restored.down && restored.left && restored.right).toBe(false);
      });

      it("두 번 토글(왕복)한 통행은 원본과 동일하게 복원된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const mapId = store.getCurrent().startMapId;
        paintTile(mapId, "lower", 1, 1, TILE.GRASS);
        toggleCollision(mapId, 1, 1);
        toggleCollision(mapId, 1, 1); // 원복

        const before = store.getCurrent();
        const tsBefore = before.tilesets[before.maps[mapId].tilesetId];
        const after = roundTrip(before);
        const tsAfter = after.tilesets[after.maps[mapId].tilesetId];
        expect(tsAfter.passability[TILE.GRASS]).toEqual(tsBefore.passability[TILE.GRASS]);
      });
    });
    describe("타일셋 메타데이터 왕복 보존", () => {
      it("tileMeta 배열이 보존된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const project = store.getCurrent();
        const ts = project.tilesets[project.maps[project.startMapId].tilesetId];

        const after = roundTrip(project);
        const tsAfter = after.tilesets[after.maps[after.startMapId].tilesetId];
        expect(tsAfter.tileMeta).toEqual(ts.tileMeta);
      });

      it("tileGroups가 보존된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const project = store.getCurrent();
        const ts = project.tilesets[project.maps[project.startMapId].tilesetId];

        const after = roundTrip(project);
        const tsAfter = after.tilesets[after.maps[after.startMapId].tilesetId];
        expect(tsAfter.tileGroups).toEqual(ts.tileGroups);
      });
    });
    describe("맵 크기/구조 왕복 보존", () => {
      it("width/height가 보존된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const project = store.getCurrent();
        const map = project.maps[project.startMapId];
        const before = { width: map.width, height: map.height };

        const after = roundTrip(project);
        const mapAfter = after.maps[after.startMapId];
        expect({ width: mapAfter.width, height: mapAfter.height }).toEqual(before);
      });

      it("lowerTiles/upperTiles 길이가 보존된다", () => {
        store.replace(startOnRetiredCombinedTown(createBlankProject()));
        const project = store.getCurrent();
        const map = project.maps[project.startMapId] as GameMap;
        const expectedLen = map.width * map.height;

        const after = roundTrip(project);
        const mapAfter = after.maps[after.startMapId] as GameMap;
        expect(mapAfter.lowerTiles.length).toBe(expectedLen);
        expect(mapAfter.upperTiles.length).toBe(expectedLen);
      });
    });
  });
});

describe("agentGhost", () => {
  isolateTimers();
  // 라이브 프리뷰는 150ms 스로틀로 셀이 계속 늘어난다. 예전 렌더러는 셀 집합 지문이 바뀌면
  // startTime 을 되감았으므로 툴 12개짜리 턴이 "왼쪽부터 쏵"을 12번 반복했다 — 쌓여가는 것이
  // 아니라 깜빡임으로 읽혔다. 이 스펙은 이미 드러난 셀의 공개 시각이 보존되는지를 못 박는다.
  describe("agentGhostCumulativeReveal", () => {
    isolateTimers();
    let restoreDom: (() => void) | null = null;
    let hostEl: HTMLElement;
    let mockScene: any;
    let mockLayer: any;
    let now = 1000;
    function containerFactory(): any {
      const children: any[] = [];
      return {
        add: vi.fn((child: any) => {
          children.push(child);
          child.parentContainer = children;
          return child;
        }),
        removeAll: vi.fn(() => {
          children.length = 0;
        }),
        setName: vi.fn(),
        setAlpha: vi.fn(),
        setDepth: vi.fn(),
        setVisible: vi.fn(),
        setPosition: vi.fn(),
        destroy: vi.fn(),
        parentContainer: null,
        list: children,
      };
    }
    function makeEmitter(): any {
      const handlers = new Map<string, Set<() => void>>();
      return {
        on: vi.fn((name: string, handler: () => void) => {
          const set = handlers.get(name) ?? new Set();
          set.add(handler);
          handlers.set(name, set);
        }),
        off: vi.fn((name: string, handler: () => void) => handlers.get(name)?.delete(handler)),
        once: vi.fn(),
        emit: (name: string) => {
          for (const handler of [...(handlers.get(name) ?? [])]) handler();
        },
      };
    }
    beforeEach(() => {
      now = 1000;
      restoreDom = installFakeDom();
      hostEl = document.createElement("div");
      document.body.append(hostEl);
      mockLayer = containerFactory();
      mockScene = {
        add: {
          container: vi.fn(() => containerFactory()),
          graphics: vi.fn(() => ({
            fillStyle: vi.fn(),
            fillRect: vi.fn(),
            lineStyle: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            strokePath: vi.fn(),
            strokeRect: vi.fn(),
            clear: vi.fn(),
            destroy: vi.fn(),
          })),
          image: vi.fn(() => ({
            setOrigin: vi.fn(),
            setAlpha: vi.fn(),
            setScale: vi.fn(),
            setCrop: vi.fn(),
            setVisible: vi.fn(),
            destroy: vi.fn(),
          })),
          rectangle: vi.fn(() => ({
            setOrigin: vi.fn(),
            setStrokeStyle: vi.fn(),
            setVisible: vi.fn(),
            setScale: vi.fn(),
            setPosition: vi.fn(),
            destroy: vi.fn(),
          })),
        },
        cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1, worldView: { x: 0, y: 0 } } },
        textures: { exists: vi.fn(() => true), get: vi.fn(() => ({ getSourceImage: vi.fn() })), addCanvas: vi.fn() },
        game: { canvas: { parentElement: hostEl, getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 640, height: 480 }) } },
        tweens: { add: vi.fn() },
        events: makeEmitter(),
      };
    });
    afterEach(() => {
      hostEl?.remove();
      clearAgentGhostPreview();
      restoreDom?.();
      restoreDom = null;
    });
    function blankPair(): { base: Project; draft: Project } {
      const base = createBlankProject();
      const draft = createBlankProject();
      base.maps["m1"] = createBlankMap("m1", 20, 20);
      draft.maps["m1"] = createBlankMap("m1", 20, 20);
      store.replace(base);
      return { base, draft };
    }
    function startMsByCell(renderer: AgentGhostPreviewRenderer): Map<string, number> {
      const out = new Map<string, number>();
      for (const step of renderer.getCurrentSchedule()) out.set(`${step.cell.x},${step.cell.y}`, step.startMs);
      return out;
    }
    describe("AgentGhostPreviewRenderer 누적 공개", () => {
      it("셀이 추가돼도 이미 예약된 셀의 공개 시각은 그대로다", () => {
        const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
        const { base, draft } = blankPair();

        draft.maps["m1"].lowerTiles[0] = 5; // (0,0)
        draft.maps["m1"].lowerTiles[2] = 6; // (2,0)
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();
        const first = startMsByCell(renderer);
        expect([...first.values()]).toEqual([0, GHOST_WIPE_DURATION_MS]);

        // 다음 스로틀 틱: 셀 2개가 더 붙는다.
        now += 200;
        draft.maps["m1"].lowerTiles[4] = 7; // (4,0)
        draft.maps["m1"].lowerTiles[6] = 8; // (6,0)
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();

        const second = startMsByCell(renderer);
        expect(second.get("0,0")).toBe(first.get("0,0"));
        expect(second.get("2,0")).toBe(first.get("2,0"));
        // 새 셀은 지금(경과 200ms) 이후에 드러난다 — 처음으로 되감기지 않는다.
        expect(second.get("4,0")).toBeGreaterThanOrEqual(200);
        expect(second.get("6,0")).toBeGreaterThan(second.get("4,0")!);
      });

      it("스케줄은 공개 시각 오름차순이다 — bbox 경로의 이분 탐색 전제", () => {
        const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
        const { base, draft } = blankPair();

        // 먼저 오른쪽을 칠하고, 그 뒤에 왼쪽을 칠한다(모델이 실제로 이렇게 한다).
        draft.maps["m1"].lowerTiles[10] = 5; // (10,0)
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();

        now += 500;
        draft.maps["m1"].lowerTiles[1] = 6; // (1,0)
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();

        const schedule = renderer.getCurrentSchedule();
        expect(schedule).toHaveLength(2);
        expect(schedule.map((step) => step.startMs)).toEqual([...schedule.map((step) => step.startMs)].sort((a, b) => a - b));
        // 나중에 붙은 왼쪽 셀이 나중에 드러난다 — 공간 순서가 아니라 도착 순서다.
        expect(schedule[0].cell.x).toBe(10);
        expect(schedule[1].cell.x).toBe(1);
      });

      it("같은 셀 집합으로 다시 렌더해도 공개 시각이 되감기지 않는다", () => {
        const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
        const { base, draft } = blankPair();
        draft.maps["m1"].lowerTiles[0] = 5;
        draft.maps["m1"].lowerTiles[3] = 6;
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();
        const first = startMsByCell(renderer);

        now += 1000;
        renderer.render(); // 스토어 emit / 카메라 변경으로 다시 그려지는 경우
        expect(startMsByCell(renderer)).toEqual(first);
      });

      it("프리뷰가 비면 시각 기록도 버려 다음 턴이 처음부터 시작한다", () => {
        const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
        const { base, draft } = blankPair();
        draft.maps["m1"].lowerTiles[0] = 5;
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();

        clearAgentGhostPreview();
        renderer.render();
        expect(renderer.getCurrentSchedule()).toHaveLength(0);

        now += 5000;
        const next = createBlankProject();
        next.maps["m1"] = createBlankMap("m1", 20, 20);
        next.maps["m1"].lowerTiles[0] = 9;
        replaceAgentGhostPreviewFromProjectDiff(base, next);
        renderer.render();
        // 새 턴의 첫 셀은 다시 0ms 다(이전 턴의 경과 시간을 물려받지 않는다).
        expect(startMsByCell(renderer).get("0,0")).toBe(0);
      });
    });
  });
  describe("agentGhostPreviewHidden", () => {
    isolateTimers();
    describe("agentGhostPreview hidden toggle", () => {
      beforeEach(() => {
        setAgentGhostPreviewHidden(false);
        clearAgentGhostPreview();
      });

      it("토글 상태를 보관하고 변경 시 구독자에게 알린다", () => {
        let notified = 0;
        const unsubscribe = subscribeAgentGhostPreview(() => { notified += 1; });
        const before = notified; // 구독 즉시 1회 호출됨
        setAgentGhostPreviewHidden(true);
        expect(isAgentGhostPreviewHidden()).toBe(true);
        expect(notified).toBe(before + 1);
        setAgentGhostPreviewHidden(true); // 동일 값 — emit 없음
        expect(notified).toBe(before + 1);
        setAgentGhostPreviewHidden(false);
        expect(isAgentGhostPreviewHidden()).toBe(false);
        unsubscribe();
      });

      it("숨김은 프리뷰 데이터 자체를 파괴하지 않는다", () => {
        setAgentGhostPreviewHidden(true);
        expect(getAgentGhostPreviewState().previews).toEqual([]);
        setAgentGhostPreviewHidden(false);
      });
    });
  });
  describe("agentGhostPreviewRenderers", () => {
    isolateTimers();
    describe("computeGhostAnimationState pure function", () => {
      it("와이프 선단이 지난 셀만 드러나고, 선단 앞 셀은 pending 으로 남는다", () => {
        const cells: AgentGhostCell[] = [
          { x: 0, y: 0, layer: "lower", tileId: 10, tilesetId: "ts1" },
          { x: 1, y: 0, layer: "lower", tileId: 11, tilesetId: "ts1" },
        ];
        const schedule = buildGhostRevealSchedule(cells);
        const before = computeGhostAnimationState(schedule, -10);
        expect(before.cellStates.map((cell) => cell.phase)).toEqual(["pending", "pending"]);
        expect(before.revealedCount).toBe(0);
        expect(before.isScheduleComplete).toBe(false);
        const atStart = computeGhostAnimationState(schedule, 0);
        expect(atStart.cellStates.map((cell) => cell.phase)).toEqual(["revealed", "pending"]);
        expect(atStart.revealedCount).toBe(1);
        const midWipe = computeGhostAnimationState(schedule, GHOST_WIPE_DURATION_MS - 1);
        expect(midWipe.cellStates.map((cell) => cell.phase)).toEqual(["revealed", "pending"]);
        const atEnd = computeGhostAnimationState(schedule, GHOST_WIPE_DURATION_MS);
        expect(atEnd.cellStates.map((cell) => cell.phase)).toEqual(["revealed", "revealed"]);
        expect(atEnd.revealedCount).toBe(2);
        // 마지막 열이 드러난 직후에는 아직 완료가 아니다 — 짧은 유지 시간 뒤에 완료로 넘어간다.
        expect(atEnd.isScheduleComplete).toBe(false);
        const settled = computeGhostAnimationState(schedule, GHOST_WIPE_DURATION_MS + GHOST_WIPE_HOLD_MS);
        expect(settled.isScheduleComplete).toBe(true);
        expect(settled.revealedCount).toBe(2);
      });

      it("빈 스케줄은 즉시 완료 상태다", () => {
        const empty = computeGhostAnimationState([], 0);
        expect(empty.cellStates).toEqual([]);
        expect(empty.revealedCount).toBe(0);
        expect(empty.isScheduleComplete).toBe(true);
      });

      it("한 열뿐인 변경도 유지 시간 뒤 완료로 수렴한다", () => {
        const schedule = buildGhostRevealSchedule([{ x: 3, y: 3, layer: "lower", tileId: 7 }]);
        expect(computeGhostAnimationState(schedule, 0).isScheduleComplete).toBe(false);
        expect(computeGhostAnimationState(schedule, GHOST_WIPE_HOLD_MS).isScheduleComplete).toBe(true);
      });
    });
    describe("ghostPhaseChipInfo helper", () => {
      it("narrates toolNames in Korean and tracks progress vs completion without exposing internal ids", () => {
        const buildInfo = ghostPhaseChipInfo({
          toolName: "build_house",
          revealedCount: 3,
          totalCount: 10,
          isScheduleComplete: false,
        });
        expect(buildInfo.koreanLabel).toBe("집을 만드는 중");
        expect(buildInfo.spinner).toBe(true);
        expect(buildInfo.text).toBe("집을 만드는 중 · 3/10 셀");
        expect(buildInfo.text).not.toContain("build_house");

        const npcInfo = ghostPhaseChipInfo({
          toolName: "place_npc",
          revealedCount: 1,
          totalCount: 1,
          isScheduleComplete: false,
        });
        expect(npcInfo.koreanLabel).toBe("사람을 만드는 중");
        expect(npcInfo.text).toBe("사람을 만드는 중 · 1/1 셀");
        expect(npcInfo.text).not.toContain("place_npc");

        const eventInfo = ghostPhaseChipInfo({
          toolName: "upsert_event",
          revealedCount: 1,
          totalCount: 2,
          isScheduleComplete: false,
        });
        expect(eventInfo.koreanLabel).toBe("이벤트를 만드는 중");

        const otherInfo = ghostPhaseChipInfo({
          toolName: "unknown_internal_tool",
          revealedCount: 0,
          totalCount: 5,
          isScheduleComplete: false,
        });
        expect(otherInfo.koreanLabel).toBe("작업을 진행하는 중");
        expect(otherInfo.text).not.toContain("unknown_internal_tool");

        const doneInfo = ghostPhaseChipInfo({
          toolName: "paint_tiles",
          revealedCount: 10,
          totalCount: 10,
          isScheduleComplete: true,
          runningToolName: "",
        });
        expect(doneInfo.spinner).toBe(false);
        expect(doneInfo.text).toBe("초안 완성");

        const stillRunningInfo = ghostPhaseChipInfo({
          toolName: "paint_tiles",
          revealedCount: 10,
          totalCount: 10,
          isScheduleComplete: true,
          runningToolName: "paint_tiles",
        });
        expect(stillRunningInfo.spinner).toBe(true);
        expect(stillRunningInfo.text).toBe("타일을 칠하는 중 · 10/10 셀");
      });

      it("셀 수를 아직 모르는 도구 시작 직후에는 0/0 분수를 쓰지 않고 행동만 알린다", () => {
        const info = ghostPhaseChipInfo({
          toolName: "paint_tiles",
          revealedCount: 0,
          totalCount: 0,
          isScheduleComplete: false,
        });
        expect(info.text).toBe("타일을 칠하는 중");
        expect(info.text).not.toContain("0/0");
        expect(info.spinner).toBe(true);
      });
    });
    /** Phaser 씬 이벤트 최소 대역 — 프레임 티커(update)와 shutdown/destroy 만 다룬다. */
    function makeEmitter() {
      const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
      return {
        handlers,
        on(name: string, fn: (...args: unknown[]) => void) {
          if (!handlers.has(name)) handlers.set(name, new Set());
          handlers.get(name)!.add(fn);
          return this;
        },
        once(name: string, fn: (...args: unknown[]) => void) {
          return this.on(name, fn);
        },
        off(name: string, fn: (...args: unknown[]) => void) {
          handlers.get(name)?.delete(fn);
          return this;
        },
        emit(name: string) {
          for (const fn of [...(handlers.get(name) ?? [])]) fn();
          return true;
        },
        count(name: string) {
          return handlers.get(name)?.size ?? 0;
        },
      };
    }
    describe("preferredGhostToolName", () => {
      it("diff 가짜 도구명보다 tool_started 로 들어온 실제 도구명을 쓴다", () => {
        expect(preferredGhostToolName("live_project_diff", "fill_region")).toBe("fill_region");
        expect(preferredGhostToolName("fill_region", "paint_tiles")).toBe("fill_region");
        expect(preferredGhostToolName("live_project_diff", "")).toBe("live_project_diff");
        expect(preferredGhostToolName("", "upsert_event")).toBe("upsert_event");
      });
    });
    describe("AgentGhostPreviewRenderer with mock phaser and DOM", () => {
      let restoreDom: (() => void) | null = null;
      let hostEl: any;
      let mockScene: any;
      let mockLayer: any;
      let containerFactory: (() => any) | null = null;

      beforeEach(() => {
        restoreDom = installFakeDom();
        clearAgentGhostPreview();
        hostEl = document.createElement("div");
        const canvas = document.createElement("canvas");
        hostEl.append(canvas);
        document.body.append(hostEl);

        const makeContainer = () => {
          const c: any = {
            setName: vi.fn(),
            add: vi.fn((...kids: any[]) => { kids.forEach(k => { c.list.push(k); k.parentContainer = c; }); }),
            removeAll: vi.fn(() => { c.list.length = 0; }),
            destroy: vi.fn(() => { c.destroyed = true; }),
            list: [],
            parentContainer: null,
          };
          return c;
        };
        containerFactory = makeContainer;
        mockLayer = {
          // Phaser 규약 재현: removeAll(true) 는 자식을 파괴하고 parentContainer 를 끊는다.
          removeAll: vi.fn(() => { mockLayer.list.length = 0; }),
          add: vi.fn((child: any) => {
            child.parentContainer = mockLayer;
            mockLayer.list.push(child);
          }),
          list: [],
        };

        mockScene = {
          add: {
            container: vi.fn(() => containerFactory!()),
            graphics: vi.fn(() => ({
              fillStyle: vi.fn(),
              fillRect: vi.fn(),
              lineStyle: vi.fn(),
              beginPath: vi.fn(),
              moveTo: vi.fn(),
              lineTo: vi.fn(),
              strokePath: vi.fn(),
              strokeRect: vi.fn(),
              clear: vi.fn(),
              destroy: vi.fn(),
            })),
            image: vi.fn(() => ({
              setOrigin: vi.fn(),
              setAlpha: vi.fn(),
              setScale: vi.fn(),
                        setCrop: vi.fn(),
              setVisible: vi.fn(),
              destroy: vi.fn(),
            })),
            rectangle: vi.fn(() => ({
              setOrigin: vi.fn(),
              setStrokeStyle: vi.fn(),
              setVisible: vi.fn(),
              setScale: vi.fn(),
              setPosition: vi.fn(),
              destroy: vi.fn(),
            })),
          },
          cameras: {
            main: {
              scrollX: 0,
              scrollY: 0,
              zoom: 1,
              worldView: { x: 0, y: 0 },
            },
          },
          textures: {
            exists: vi.fn(() => true),
            get: vi.fn(() => ({
              getSourceImage: vi.fn(),
            })),
            addCanvas: vi.fn(),
          },
          game: {
            canvas,
          },
          tweens: {
            add: vi.fn(),
          },
          events: makeEmitter(),
        };
      });

      afterEach(() => {
        hostEl?.remove();
        clearAgentGhostPreview();
        restoreDom?.();
        restoreDom = null;
      });

      it("(a) chip appears with Korean label containing '중' then transitions to text containing '초안 완성'", () => {
        let now = 1000;
        const renderer = new AgentGhostPreviewRenderer(
          mockScene,
          mockLayer,
          () => "m1",
          { clock: () => now }
        );

        // Setup preview in store diff
        const base = createBlankProject();
        const draft = createBlankProject();
        base.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"].lowerTiles[0] = 5; // changed 1 cell
        store.replace(base);

        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();

        const chip = hostEl.querySelector("[data-testid='ai-ghost-phase-chip']");
        expect(chip).not.toBeNull();
        expect(chip?.textContent).toContain("중");

        // Advance clock past completion
        now += 3000;
        renderer.update();
        expect(chip?.textContent).toContain("초안 완성");
        expect(chip?.querySelector(".ai-ghost-phase-spinner")).toBeNull();

        // Clear previews -> chip removed
        clearAgentGhostPreview();
        renderer.render();
        expect(hostEl.querySelector("[data-testid='ai-ghost-phase-chip']")).toBeNull();
      });

      it("(b) reveal schedule order honored", () => {
        let now = 1000;
        const renderer = new AgentGhostPreviewRenderer(
          mockScene,
          mockLayer,
          () => "m1",
          { clock: () => now }
        );

        const base = createBlankProject();
        const draft = createBlankProject();
        base.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"].lowerTiles[0] = 5;
        draft.maps["m1"].lowerTiles[1] = 6;
        store.replace(base);

        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();

        const schedule = renderer.getCurrentSchedule();
        expect(schedule).toHaveLength(2);
        expect(schedule[0].cell.x).toBe(0);
        expect(schedule[1].cell.x).toBe(1);
        expect(schedule[0].startMs).toBeLessThan(schedule[1].startMs);
      });

      it("(b2) 같은 셀이 프리뷰 두 장에 겹쳐 들어와도 사라진 셀의 공개 시각은 버린다", () => {
        // 청소 조건의 비교 대상은 프리뷰 셀의 **개수**가 아니라 서로 다른 키의 수여야 한다.
        // appendAgentGhostPreviewForToolCall 경로는 같은 맵에 프리뷰를 여러 장 얹으므로(id 가
        // 도구명·인자까지 포함해 달라진다) 같은 좌표가 중복 계수되고, 개수로 비교하면 청소가
        // 건너뛰어져 되돌아온 셀이 **이미 지나간 시각**을 물려받아 와이프 없이 튀어나온다.
        let now = 1000;
        const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });

        const base = createBlankProject();
        base.maps["m1"] = createBlankMap("m1", 10, 10);
        const draft = structuredClone(base);
        draft.maps["m1"].lowerTiles[0] = 5; // (0,0) — 첫 열
        draft.maps["m1"].lowerTiles[9] = 6; // (9,0) — 마지막 열
        store.replace(base);

        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();
        const firstAtX0 = renderer.getCurrentSchedule().find((step) => step.cell.x === 0)?.startMs;
        const firstAtX9 = renderer.getCurrentSchedule().find((step) => step.cell.x === 9)?.startMs;
        expect(firstAtX0).toBe(0);
        expect(firstAtX9).toBe(GHOST_WIPE_DURATION_MS);

        // 프리뷰가 (0,0) 한 칸으로 줄어드는데, 그 한 칸이 서로 다른 프리뷰 두 장에 들어 있다.
        clearAgentGhostPreview();
        appendAgentGhostPreviewForToolCall(base, "clear_region", { mapId: "m1", x: 0, y: 0, w: 1, h: 1 });
        appendAgentGhostPreviewForToolCall(base, "mirror_region", { mapId: "m1", x: 0, y: 0, w: 1, h: 1 });
        now += 5000;
        renderer.render();

        // (9,0) 이 다시 들어온다 — 사라졌던 셀이므로 지금 시각부터 새 와이프를 받아야 한다.
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();
        const again = renderer.getCurrentSchedule();
        expect(again.find((step) => step.cell.x === 0)?.startMs).toBe(firstAtX0);
        expect(again.find((step) => step.cell.x === 9)?.startMs).toBe(5000);
      });

      it("(d) 씬 update 이벤트가 공개 애니메이션을 진행시키고 완료 후 스스로 떨어진다", () => {
        let now = 1000;
        const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });

        const base = createBlankProject();
        const draft = createBlankProject();
        base.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"].lowerTiles[0] = 5;
        draft.maps["m1"].lowerTiles[1] = 6;
        store.replace(base);

        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();

        // 렌더 직후 티커가 붙는다 — render() 를 다시 부르지 않아도 프레임마다 진행한다.
        expect(mockScene.events.count("update")).toBe(1);
        const chip = hostEl.querySelector("[data-testid='ai-ghost-phase-chip']");
        expect(chip?.textContent).toContain("중");

        now += 3000;
        mockScene.events.emit("update");
        expect(chip?.textContent).toContain("초안 완성");

        // 스케줄 + 샤인이 끝나면 유휴 상태로 돌아간다(프레임 작업 0).
        expect(mockScene.events.count("update")).toBe(0);
      });

      it("(e) 같은 셀 집합으로 다시 렌더해도 진행 상태가 처음으로 되돌아가지 않는다", () => {
        let now = 1000;
        const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });

        const base = createBlankProject();
        const draft = createBlankProject();
        base.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"].lowerTiles[0] = 5;
        store.replace(base);

        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();
        const chip = hostEl.querySelector("[data-testid='ai-ghost-phase-chip']");

        now += 3000;
        renderer.update();
        expect(chip?.textContent).toContain("초안 완성");

        // 스토어 emit·카메라 변경 등으로 다시 렌더돼도 완료 상태를 유지한다.
        renderer.render();
        expect(hostEl.querySelector("[data-testid='ai-ghost-phase-chip']")?.textContent).toContain("초안 완성");
      });

      it("(c) >256-cell preview keeps actual tile sprites and the count", () => {
        let now = 1000;
        const renderer = new AgentGhostPreviewRenderer(
          mockScene,
          mockLayer,
          () => "m1",
          { clock: () => now }
        );

        const base = createBlankProject();
        const draft = createBlankProject();
        base.maps["m1"] = createBlankMap("m1", 20, 20);
        draft.maps["m1"] = createBlankMap("m1", 20, 20);
        for (let i = 0; i < 300; i++) {
          draft.maps["m1"].lowerTiles[i] = (draft.maps["m1"].lowerTiles[i] ?? 0) + 1;
        }
        store.replace(base);

        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();

        // Large previews must not collapse to a bounding box.
        expect(mockScene.add.image).toHaveBeenCalled();

        const chip = hostEl.querySelector("[data-testid='ai-ghost-phase-chip']");
        expect(chip).not.toBeNull();
        expect(chip?.textContent).toContain("300 셀");
      });

      it("이어 칠한 칸만 스프라이트를 추가하고, 이미 만든 칸은 다시 만들지 않는다", () => {
        let now = 1000;
        const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
        const base = createBlankProject();
        const draft = createBlankProject();
        base.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"].lowerTiles[0] = 5;
        store.replace(base);
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();
        const imagesAfterFirst = mockScene.add.image.mock.calls.length;
        expect(imagesAfterFirst).toBe(1);

        draft.maps["m1"].lowerTiles[1] = 6;
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();

        expect(mockScene.add.image.mock.calls.length - imagesAfterFirst).toBe(1);
        expect(renderer["animGroup"]).toBe(mockLayer.list[0]);
      });

      it("레이어에서 떨어진 미리보기는 다음 render()에서 새 그룹에 다시 붙인다", () => {
        let now = 1000;
        const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
        const base = createBlankProject();
        const draft = createBlankProject();
        base.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"] = createBlankMap("m1", 10, 10);
        draft.maps["m1"].lowerTiles[0] = 5;
        store.replace(base);
        replaceAgentGhostPreviewFromProjectDiff(base, draft);
        renderer.render();
        const firstGroup = renderer["animGroup"] as { parentContainer: unknown };
        firstGroup.parentContainer = null;
        mockLayer.list.length = 0;
        renderer.render();
        const secondGroup = renderer["animGroup"];
        expect(secondGroup).not.toBe(firstGroup);
        const tileLayer = renderer["tileLayer"] as { parentContainer: unknown; list: unknown[] };
        expect(tileLayer.parentContainer).toBe(secondGroup);
        expect(tileLayer.list.length).toBeGreaterThan(0);
        expect(renderer["tileLayerParent"]).toBe(secondGroup);
      });
    });
  });
  describe("agentGhostRunningTool", () => {
    isolateTimers();
    afterEach(clearAgentGhostPreview);
    describe("running-tool map ownership", () => {
      it.each([
        { mapId: "a" },
        { target: { kind: "existing", mapId: "a" } },
      ])("captures the explicit tool target before preview cells for %j", (args) => {
        // Given: no geometry has arrived.
        clearAgentGhostPreview();
        // When: a map-targeted tool starts.
        setAgentGhostRunningTool("fill_region", args);
        // Then: activity already belongs to its target, not a viewed map.
        expect(getAgentGhostPreviewState()).toMatchObject({ previews: [], runningToolName: "fill_region", runningToolMapId: "a" });
      });

      it("publishes an owner change even when the tool name is unchanged", () => {
        // Given: A owns a running tool.
        setAgentGhostRunningTool("fill_region", { mapId: "a" });
        const states: AgentGhostPreviewState[] = [];
        const unsubscribe = subscribeAgentGhostPreview(state => states.push(state));
        try {
          // When: the same tool starts on B.
          setAgentGhostRunningTool("fill_region", { mapId: "b" });
          // Then: subscribers receive the changed ownership.
          expect(states).toHaveLength(2);
          expect(states[1]).toMatchObject({ runningToolName: "fill_region", runningToolMapId: "b" });
        } finally { unsubscribe(); }
      });

      it.each([undefined, {}, { mapId: 12 }, { target: { kind: "new" } }])("does not inherit the last owner for unknown target %j", (args) => {
        // Given: a previously targeted tool.
        setAgentGhostRunningTool("fill_region", { mapId: "a" });
        // When: a tool without a known map starts.
        setAgentGhostRunningTool("get_project_summary", args);
        // Then: the name remains available, but canvas ownership is unknown.
        expect(getAgentGhostPreviewState()).toMatchObject({ runningToolName: "get_project_summary", runningToolMapId: null });
      });

      it.each([clearAgentGhostRunningTool, clearAgentGhostPreview])("clears name and ownership together via %s", (clear) => {
        // Given: an owned running tool.
        setAgentGhostRunningTool("fill_region", { mapId: "a" });
        // When: tool/turn state is cleared.
        clear();
        // Then: neither name nor owner survives.
        expect(getAgentGhostPreviewState()).toMatchObject({ runningToolName: "", runningToolMapId: null });
      });
    });
  });
});

describe("aiAnswerLinks", () => {
  isolateTimers();
  function eventNamed(id: string, name: string, x: number, y: number): GameEvent {
    return {
      id,
      x,
      y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_page_1`,
          name,
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        },
      ],
    };
  }
  function mapWith(id: string, name: string, events: GameEvent[] = []): GameMap {
    const map = createBlankMap(name, 20, 20);
    map.id = id;
    map.events = events;
    return map;
  }
  function projectWith(maps: readonly GameMap[]): Project {
    const project = createBlankProject();
    project.maps = {};
    for (const map of maps) project.maps[map.id] = map;
    const first = maps[0];
    if (first) project.startMapId = first.id;
    return project;
  }
  describe("buildEditorReferenceIndex", () => {
    it("indexes map names and named map events, longest label first", () => {
      const project = projectWith([
        mapWith("map_village", "마을 광장", [eventNamed("ev_hana", "상인 하나", 4, 7)]),
        mapWith("map_house_interior_1", "상인 하나의 집"),
      ]);

      const labels = buildEditorReferenceIndex(project).entries.map((entry) => entry.label);

      expect(labels[0]).toBe("상인 하나의 집");
      expect(labels).toContain("마을 광장");
      expect(labels).toContain("상인 하나");
    });

    it("marks a label shared by several places as ambiguous instead of guessing one", () => {
      const project = projectWith([
        mapWith("map_a", "여관", [eventNamed("ev_1", "주민", 1, 1)]),
        mapWith("map_b", "여관", [eventNamed("ev_2", "주민", 2, 2)]),
      ]);

      const index = buildEditorReferenceIndex(project);
      const inn = index.entries.find((entry) => entry.label === "여관");
      const villager = index.entries.find((entry) => entry.label === "주민");

      expect(inn?.target).toEqual({ kind: "ambiguous", label: "여관", count: 2 });
      expect(villager?.target).toEqual({ kind: "ambiguous", label: "주민", count: 2 });
    });

    it("skips names too short or without letters to be recognizable in prose", () => {
      const project = projectWith([mapWith("map_short", "A"), mapWith("map_digits", "12"), mapWith("map_ok", "동굴")]);

      const labels = buildEditorReferenceIndex(project).entries.map((entry) => entry.label);

      expect(labels).toEqual(["동굴"]);
    });

    it("is stable regardless of map insertion order", () => {
      const first = projectWith([mapWith("map_b", "북쪽 숲"), mapWith("map_a", "남쪽 들")]);
      const second = projectWith([mapWith("map_a", "남쪽 들"), mapWith("map_b", "북쪽 숲")]);

      expect(buildEditorReferenceIndex(first).entries).toEqual(buildEditorReferenceIndex(second).entries);
    });
  });
  describe("findEditorReferences", () => {
    const project = projectWith([
      mapWith("map_village", "마을", [eventNamed("ev_hana", "상인 하나", 4, 7)]),
      mapWith("map_house_interior_1", "상인 하나의 집"),
    ]);
    const index = buildEditorReferenceIndex(project);
    const boundaryIndex: EditorReferenceIndex = {
      entries: [
        { label: "광장", target: { kind: "map", mapId: "map_square" } },
        { label: "마을", target: { kind: "map", mapId: "map_village" } },
        { label: "집", target: { kind: "map", mapId: "map_house" } },
      ],
    };

    it("finds a quoted name in the assistant's own sentence", () => {
      const text = "건물 중에는 우측 하단 마을 구역에 ‘상인 하나의 집’(실내 맵 1채)이 마련되어 있습니다.";

      const spans = findEditorReferences(text, index);
      const labels = spans.map((span) => span.label);

      expect(labels).toContain("상인 하나의 집");
      const house = spans.find((span) => span.label === "상인 하나의 집");
      expect(text.slice(house?.start ?? 0, house?.end ?? 0)).toBe("상인 하나의 집");
      expect(house?.target).toEqual({ kind: "map", mapId: "map_house_interior_1" });
    });

    it("prefers the longest name and never overlaps spans", () => {
      const spans = findEditorReferences("상인 하나의 집에 들어가세요.", index);

      expect(spans).toHaveLength(1);
      expect(spans[0]?.label).toBe("상인 하나의 집");
    });

    it("이름 뒤에 이어진 완전한 조사와 한 번의 보조사 결합을 허용한다", () => {
      const cases = [
        ...[
          "하고", "한테", "께서", "마다", "조차", "밖에", "에서",
          "으로", "에게", "까지", "부터", "처럼", "보다",
        ].map((particle) => ({ sentence: `마을${particle}`, label: "마을" })),
        { sentence: "집에", label: "집" },
        { sentence: "집을", label: "집" },
        { sentence: "집이", label: "집" },
        { sentence: "집에서", label: "집" },
        { sentence: "집에서는", label: "집" },
        { sentence: "집으로도", label: "집" },
        { sentence: "집까지만", label: "집" },
        { sentence: "집하고", label: "집" },
        { sentence: "집한테", label: "집" },
        { sentence: "집께서", label: "집" },
        { sentence: "집마다", label: "집" },
        { sentence: "집조차", label: "집" },
        { sentence: "집밖에", label: "집" },
        { sentence: "집부터", label: "집" },
        { sentence: "집처럼", label: "집" },
        { sentence: "집보다", label: "집" },
        { sentence: "집에게", label: "집" },
        { sentence: "집이에요", label: "집" },
        { sentence: "광장에서", label: "광장" },
        { sentence: "마을.", label: "마을" },
        { sentence: "마을’", label: "마을" },
        { sentence: "마을", label: "마을" },
      ];

      for (const { sentence, label } of cases) {
        expect(findEditorReferences(sentence, boundaryIndex).map((span) => span.label)).toContain(label);
      }
    });

    it("조사 첫 음절로 시작하는 합성어는 거부한다", () => {
      for (const sentence of [
        "마을이장", "마을의사", "마을도서관", "마을과수원", "마을이야기",
        "마을도로", "마을지도", "마을하나", "마을마차",
      ]) {
        expect(findEditorReferences(sentence, index)).toEqual([]);
      }
    });

    it("더 긴 단어의 일부인 이름은 거부한다", () => {
      for (const sentence of [
        "마을길을 깔았습니다", "마을회관을 지었습니다", "새마을 계획",
        "마을길", "마을회관", "새마을", "마을도로를 깔았습니다",
      ]) {
        expect(findEditorReferences(sentence, index)).toEqual([]);
      }
    });

    it("returns spans sorted by position", () => {
      const spans = findEditorReferences("마을 남쪽에 상인 하나의 집이 있습니다. 마을 북쪽은 비었습니다.", index);

      expect(spans.map((span) => span.start)).toEqual([...spans.map((span) => span.start)].sort((a, b) => a - b));
      expect(spans.length).toBeGreaterThanOrEqual(3);
    });

    it("returns nothing for an empty index or empty text", () => {
      expect(findEditorReferences("마을", { entries: [] })).toEqual([]);
      expect(findEditorReferences("", index)).toEqual([]);
    });
  });
  describe("resolveEditorReferenceQuery", () => {
    const project = projectWith([
      mapWith("map_village", "마을 광장", [
        eventNamed("ev_hana", "상인 하나", 4, 7),
        eventNamed("ev_dul", "상인 둘", 8, 9),
      ]),
      mapWith("map_house_interior_1", "상인 하나의 집"),
    ]);
    const index = buildEditorReferenceIndex(project);

    it("정확한 이름은 더 긴 부분 일치보다 우선한다", () => {
      expect(resolveEditorReferenceQuery(index, "상인 하나")).toEqual({
        kind: "found",
        entry: {
          label: "상인 하나",
          target: {
            kind: "event",
            mapId: "map_village",
            eventId: "ev_hana",
            x: 4,
            y: 7,
          },
        },
      });
    });

    it("부분 이름이 한 종류뿐이면 그 이름을 찾는다", () => {
      expect(resolveEditorReferenceQuery(index, "하나의")).toEqual({
        kind: "found",
        entry: expect.objectContaining({ label: "상인 하나의 집" }),
      });
    });

    it("서로 다른 부분 이름이 여럿이면 후보를 모두 보고한다", () => {
      expect(resolveEditorReferenceQuery(index, "상인")).toEqual({
        kind: "ambiguous",
        labels: ["상인 둘", "상인 하나", "상인 하나의 집"],
      });
    });

    it("모르는 이름이나 빈 이름은 찾지 못했다고 보고한다", () => {
      expect(resolveEditorReferenceQuery(index, "없는 이름")).toEqual({ kind: "missing" });
      expect(resolveEditorReferenceQuery(index, "   ")).toEqual({ kind: "missing" });
    });
  });
});

describe("assistantToolMode", () => {
  isolateTimers();
  describe("aiCapabilityEscalation", () => {
    isolateTimers();
    const TITLE_REQUEST = "타이틀 화면 바꿔줘";
    // 선언 없는(폴백) 턴의 도메인 슬라이스 — 코어 + UI 도메인만. 승격은 이 슬라이스 밖의 능력을 되살린다.
    function domainExposedNames(_text: string): Set<string> {
      const domains = computeActiveToolDomains(null);
      return new Set(toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name));
    }
    function names(schemas: readonly { readonly function: { readonly name: string } }[]): string[] {
      return schemas.map((schema) => schema.function.name);
    }
    describe("자연어 능력 승격 리졸버", () => {
      it("finds tools outside an explicitly scoped caller catalog", () => {
        const exposed = domainExposedNames(TITLE_REQUEST);
        // 케이스 전제: 도메인 슬라이스에도, 정확한 이름 언급 승격에도 없다.
        expect(exposed.has("set_title_screen")).toBe(false);
        expect(names(mentionedToolSchemas(TITLE_REQUEST))).not.toContain("set_title_screen");

        expect(names(capabilityEscalationSchemas(TITLE_REQUEST, exposed))).toContain("set_title_screen");
      });

      it("빈 문자열·공백·구두점만 있는 입력은 예외 없이 []", () => {
        for (const text of ["", "   ", "\n\t ", "!!!", " ... ?! ", "---"]) {
          expect(capabilityEscalationSchemas(text, new Set()), JSON.stringify(text)).toEqual([]);
        }
      });

      it("이미 노출된 툴은 다시 반환하지 않는다", () => {
        const exposed = domainExposedNames(TITLE_REQUEST);
        const first = names(capabilityEscalationSchemas(TITLE_REQUEST, exposed));
        expect(first.length).toBeGreaterThan(0);
        const withAll = names(capabilityEscalationSchemas(TITLE_REQUEST, new Set([...exposed, ...first])));
        for (const name of first) expect(withAll).not.toContain(name);
      });

      it("deprecated(supersededBy) 툴은 절대 반환하지 않는다", () => {
        const deprecated = allTools().filter((tool) => tool.deprecated === true && tool.supersededBy);
        expect(deprecated.length).toBeGreaterThan(0);
        const active = new Set(activeTools().map((tool) => tool.name));
        for (const tool of deprecated) {
          const returned = names(capabilityEscalationSchemas(`${tool.name} ${tool.description}`, new Set()));
          expect(returned, tool.name).not.toContain(tool.name);
          for (const name of returned) expect(active.has(name), name).toBe(true);
        }
      });

      it("bounds optional search suggestions without truncating the native catalog", () => {
        for (const text of [TITLE_REQUEST, "속성 상성표 설정하고 세이브 시작 지점도 바꾸고 장비랑 직업도 추가해줘"]) {
          expect(capabilityEscalationSchemas(text, new Set()).length).toBeLessThanOrEqual(MAX_CAPABILITY_ESCALATED_TOOLS);
        }
        const all = toOpenAiTools(activeTools());
        expect(all.length).toBeGreaterThan(128);
        expect(names(all)).toEqual(activeTools().map((tool) => tool.name));
        expect(capabilityEscalationSchemas(TITLE_REQUEST, new Set(names(all)))).toEqual([]);
      });

      // 되돌릴 수 없는 폐기 툴은 어휘가 아무리 맞아도 자동으로 얹히지 않는다.
      it("폐기 툴은 이름·설명을 그대로 던져도 승격되지 않는다", () => {
        const byName = new Map(allTools().map((tool) => [tool.name, tool] as const));
        for (const name of ESCALATION_DENYLIST) {
          const tool = byName.get(name);
          expect(tool, name).toBeDefined();
          const returned = names(capabilityEscalationSchemas(`${name} ${tool!.description}`, new Set()));
          expect(returned, name).not.toContain(name);
        }
      });

      it("부분 재작업 요청이 프로젝트 폐기 툴을 끌어오지 않는다", () => {
        for (const text of ["이 맵 상점 재고를 초기화해줘", "이 맵 처음부터 다시 칠해줘", "여기 지워버리고 다시 깔아줘"]) {
          const returned = names(capabilityEscalationSchemas(text, new Set()));
          expect(returned, text).not.toContain("reset_project");
          expect(returned, text).not.toContain("remove_map");
        }
      });

      it("같은 입력은 같은 순서를 낸다", () => {
        const exposed = domainExposedNames(TITLE_REQUEST);
        expect(names(capabilityEscalationSchemas(TITLE_REQUEST, exposed))).toEqual(
          names(capabilityEscalationSchemas(TITLE_REQUEST, exposed)),
        );
      });
    });
  });
  // 컨텍스트 모드 툴 스코핑 T4 (2026-07-07 타일 시공 흐름 재설계 §2.2).
  // - tile 모드: v3 프리미티브 + 코어만 노출(~12개), 옛 타일 지식 툴 0개.
  // - event 모드: 이벤트 툴 포함, 타일 프리미티브 제외.
  // - deprecated 는 어떤 모드에서도 노출되지 않는다.
  // - 모드 판정은 UI 상태에서만 결정론으로 계산된다(원칙 0).
  describe("toolDomainScoping", () => {
    isolateTimers();
    const OLD_TILE_TOOLS = [...LEGACY_TILE_KNOWLEDGE_SUPERSEDED.keys()];
    const V3_PRIMITIVES = ["build_wall", "build_roof", "place_door", "place_window", "lay_path", "place_props", "fill_region", "tile_erase"];
    const CORE_TOOLS = ["create_map", "resize_map", "get_project_summary", "list_resources", "tile_query"];
    function exposedNames(mode?: "tile" | "map" | "event" | "database"): Set<string> {
      return new Set(toOpenAiTools(undefined, mode ? { mode } : {}).map((tool) => tool.function.name));
    }
    describe("T4 — toOpenAiTools 모드 스코핑", () => {
      it("옛 타일 지식 툴 11종은 deprecated(비노출)이며 실행 호환(supersededBy)이 유지된다", () => {
        const byName = new Map(allTools().map((tool) => [tool.name, tool]));
        const exposed = exposedNames();
        for (const [name, replacement] of LEGACY_TILE_KNOWLEDGE_SUPERSEDED) {
          const tool = byName.get(name);
          expect(tool, name).toBeDefined();
          expect(tool!.deprecated, name).toBe(true);
          expect(tool!.supersededBy, name).toBe(replacement);
          expect(exposed.has(name), name).toBe(false);
        }
      });

      it("tile 모드: v3 프리미티브 + 코어 노출, propose 비노출, 옛 타일 툴 0개", () => {
        const exposed = exposedNames("tile");
        for (const name of ["paint_road", ...V3_PRIMITIVES, ...CORE_TOOLS]) {
          expect(exposed.has(name), name).toBe(true);
        }
        expect(exposed.has("propose_tile_vocabulary")).toBe(false);
        for (const name of OLD_TILE_TOOLS) expect(exposed.has(name), name).toBe(false);
        for (const name of ["upsert_event", "place_npc", "upsert_item", "plan_world", "create_quest"]) {
          expect(exposed.has(name), name).toBe(false);
        }
        expect(exposed.size).toBeGreaterThanOrEqual(12);
        expect([...exposed]).toEqual(eligibleNames(activeTools(), new Set(["tile"])));
      });

      it("event 모드: 이벤트 툴 포함, 타일 프리미티브 제외, 코어는 상시", () => {
        const exposed = exposedNames("event");
        for (const name of ["upsert_event", "place_npc", "move_event", "find_events", "get_event", ...CORE_TOOLS]) {
          expect(exposed.has(name), name).toBe(true);
        }
        for (const name of V3_PRIMITIVES) expect(exposed.has(name), name).toBe(false);
      });

      it("deprecated 는 어떤 모드에서도 0개", () => {
        const deprecated = new Set(allTools().filter((tool) => tool.deprecated === true).map((tool) => tool.name));
        for (const mode of [undefined, "tile", "map", "event", "database"] as const) {
          const exposed = exposedNames(mode);
          for (const name of deprecated) expect(exposed.has(name), `${mode ?? "all"}:${name}`).toBe(false);
        }
      });

      // Removed it "canonical construction만 write surface에": author_house and author_village were removed from the tool registry on purpose.

      it("mode 없으면 종전 동작(deprecated 만 제외한 전체 노출)", () => {
        const exposedCount = allTools().filter((tool) => tool.deprecated !== true).length;
        expect(toOpenAiTools().length).toBe(exposedCount);
      });

      it("multi-domain filters retain every eligible tool, including database tools", () => {
        const tools = makeExposureTestTools();
        resetAssistantToolDomainMemory();
        const domains = computeActiveToolDomains(declaredIntent({ tools: ["upsert_item", "build_wall", "define_quest", "plan_world"] }));
        const exposed = toOpenAiTools(tools, { domains });
        const names = new Set(exposed.map((tool) => tool.function.name));

        expect([...names]).toEqual(eligibleNames(tools, domains));
        expect(names.has("deprecated_tool")).toBe(false);
        for (let index = 0; index < 8; index += 1) {
          expect(names.has(`database_tool_${index}`), `database_tool_${index}`).toBe(true);
        }
      });
    });
    describe("T4 — computeAssistantToolMode (UI 상태 결정론)", () => {
      const restores: (() => void)[] = [];
      afterEach(() => {
        while (restores.length > 0) restores.pop()?.();
        editorState.set({ layer: "lower", tool: "paint" });
        resetAssistantToolDomainMemory();
      });

      it("DOM 없음(헤드리스) → map (판정 불가 기본)", () => {
        expect(computeAssistantToolMode()).toBe("map");
      });

      it("좌측 타일 팔레트가 보이고 타일 레이어 편집 중이면 tile", () => {
        restores.push(installFakeDom());
        document.body.append(el("div", { dataset: { testid: "left-palette-root" } }));
        editorState.set({ layer: "lower", tool: "paint" });
        expect(computeAssistantToolMode()).toBe("tile");
      });

      it("이벤트 레이어/도구면 event, DB 모달이 열려 있으면 database 가 우선한다", () => {
        restores.push(installFakeDom());
        document.body.append(el("div", { dataset: { testid: "left-palette-root" } }));
        editorState.set({ layer: "event" });
        expect(computeAssistantToolMode()).toBe("event");
        document.body.append(el("div", { dataset: { testid: "database-modal" } }));
        expect(computeAssistantToolMode()).toBe("database");
      });
    });
    describe("T4 — computeActiveToolDomains (선언 유니온 + TTL)", () => {
      afterEach(() => {
        resetAssistantToolDomainMemory();
        editorState.set({ layer: "lower", tool: "paint" });
      });

      it("선언한 툴의 도메인이 결정론으로 열린다 — 문장은 보지 않는다", () => {
        const enemy = computeActiveToolDomains(declaredIntent({ tools: ["simulate_battle", "upsert_enemy"] }));
        for (const domain of ["core", "map", "battle", "database"] as const) expect(enemy.has(domain)).toBe(true);
        const wall = computeActiveToolDomains(declaredIntent({ tools: ["build_wall"] }));
        for (const domain of ["core", "map", "tile"] as const) expect(wall.has(domain)).toBe(true);
        expect(computeActiveToolDomains(null).size).toBe(2);
      });

      // Removed it "야외 시공 선언은 tile 을 열어": author_village was removed from the tool registry on purpose.

      it("modify intent exposes all three editing domains without pruning", () => {
        const domains = computeActiveToolDomains(declaredIntent({ mode: "modify" }));
        for (const domain of ["tile", "map", "event"] as const) expect(domains.has(domain)).toBe(true);
        const list = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
        expect(list).toEqual(eligibleNames(activeTools(), domains));
        expect(list).toContain("fill_region");
      });

      it("system intent exposes every system capability", () => {
        const resetDomains = computeActiveToolDomains(declaredIntent({ tools: ["reset_project"], resetsContext: true }));
        const resetExposed = toOpenAiTools(undefined, { domains: resetDomains });
        expect(resetDomains.has("system")).toBe(true);
        expect(resetExposed.map((tool) => tool.function.name)).toEqual(eligibleNames(activeTools(), resetDomains));
        expect(resetExposed.some((tool) => tool.function.name === "reset_project")).toBe(true);

        const nightDomains = computeActiveToolDomains(declaredIntent({ tools: ["configure_time_system"] }));
        const nightExposed = toOpenAiTools(undefined, { domains: nightDomains });
        expect(nightDomains.has("system")).toBe(true);
        expect(nightExposed.map((tool) => tool.function.name)).toEqual(eligibleNames(activeTools(), nightDomains));
        expect(nightExposed.some((tool) => tool.function.name === "configure_time_system")).toBe(true);
      });
    });
    function eligibleNames(tools: readonly ToolDefinition[], domains: ReadonlySet<ToolDomain>): string[] {
      return tools.filter((tool) => !tool.deprecated && (!tool.domains || tool.domains.includes("core") || tool.domains.some((domain) => domains.has(domain)))).map((tool) => tool.name);
    }
    function makeExposureTestTools(): ToolDefinition[] {
      const make = (name: string, domain: ToolDomain, deprecated = false): ToolDefinition => ({
        name,
        description: name,
        mode: domain === "core" ? "read" : "write",
        domains: [domain],
        parameters: { type: "object", properties: {} },
        ...(deprecated ? { deprecated: true } : {}),
        run: () => ({ summary: name }),
      });
      return [
        ...Array.from({ length: 5 }, (_, index) => make(`core_tool_${index}`, "core")),
        ...Array.from({ length: 8 }, (_, index) => make(`database_tool_${index}`, "database")),
        ...Array.from({ length: 8 }, (_, index) => make(`tile_tool_${index}`, "tile")),
        ...Array.from({ length: 8 }, (_, index) => make(`battle_tool_${index}`, "battle")),
        ...Array.from({ length: 8 }, (_, index) => make(`quest_tool_${index}`, "quest")),
        ...Array.from({ length: 8 }, (_, index) => make(`world_tool_${index}`, "world")),
        make("deprecated_tool", "core", true),
      ];
    }
  });
});

// 조수가 전투 화면 꾸미기(system.battleLook)를 알고 고르게 하는 지시(2026-10-02).
// 없던 때는 도구 한 줄 설명·첫 제작 지시 어디에도 이 칸이 없어 어떤 게임이든 기본 「도트 창」 그대로였다.
describe("battleLookAssistant", () => {
  isolateTimers();
  describe("전투 화면 꾸미기 — 조수 지시", () => {
    it("set_project_settings 한 줄 설명과 preset 설명이 꾸미기와 분위기 짝을 싣는다", () => {
      const tool = activeTools().find((entry) => entry.name === "set_project_settings")!;
      expect(tool.description).toContain("battle.look");
      const battle = (tool.parameters as { properties: Record<string, { properties: Record<string, { properties: Record<string, { description?: string }> }> }> }).properties.battle!;
      const preset = battle.properties.look!.properties.preset!;
      for (const id of BATTLE_LOOK_PRESET_IDS) expect(preset.description).toContain(`${id}(${BATTLE_LOOK_PRESETS[id].label})=`);
    });

    it("「전투 화면」 요청이면 set_project_settings 가 첫 라운드에 붙는다", () => {
      for (const request of ["전투 화면을 화려하게 꾸며줘", "전투 화면 바꿔줘", "전투창 디자인 바꿔줘"]) {
        expect(capabilityEscalatedToolNames(request, new Set()), request).toContain("set_project_settings");
      }
    });

    it("모험 JRPG 첫 제작 지시(기획 있음·없음)에 프리셋 고르기 줄이 붙고 측면 스킨 id 를 준다", () => {
      const jrpg = welcomeGenrePresetById("adventure-jrpg")!;
      for (const prompt of [buildWelcomeGenrePresetPrompt(jrpg, interviewBrief("adventure-jrpg")), buildWelcomeGenrePresetPrompt(jrpg)]) {
        expect(prompt).toContain("battle.look.preset");
        expect(prompt).toContain(battleLookMoodGuide());
      }
      expect(welcomeBattleLookLine()).toMatch(/battle\.uiStyle: retro2003/u);
    });

    it("몬스터 대치(측면 아님) 장르에는 붙이지 않는다", () => {
      const monster = welcomeGenrePresetById("monster-collect")!;
      expect(buildWelcomeGenrePresetPrompt(monster, interviewBrief("monster-collect"))).not.toContain("battle.look");
    });

    it("자유 문장은 턴제 전투를 말할 때만 붙인다", () => {
      expect(buildWelcomeFreeTextPrompt("용사가 마왕을 쓰러뜨리는 짧은 RPG")).toContain("battle.look.preset");
      expect(buildWelcomeFreeTextPrompt("바닷가 마을에서 농사짓고 이웃과 친해지는 생활 게임")).not.toContain("battle.look");
    });
  });
});

describe("conceptDoubleRowLayout", () => {
  isolateTimers();
  describe("place_concept double-row 도면", () => {
    // Removed it "모르는 layout 은 invalid-plan": place_concept was removed from the tool registry on purpose.

    // Removed it "double-row 는 복도 북쪽과 남쪽에": place_concept was removed from the tool registry on purpose.

    it("BUILTIN에 없는 장소는 theme이 placeId 그대로, 복도는 corridor다", () => {
      const bundle: ConceptBundleRecord = {
        id: "t",
        label: "T",
        facilities: [{ id: "f", label: "F", placeIds: ["living", "corridor"] }],
        places: [
          { id: "living", label: "거실", role: "room", size: "m" },
          { id: "corridor", label: "복도", role: "walkway" },
        ],
        things: [],
      };
      const facility: ConceptFacilityRecord = bundle.facilities[0]!;
      for (const layout of [layoutConceptFacility(bundle, facility), layoutConceptFacilityDoubleRow(bundle, facility)]) {
        const living = layout.rooms.find((room) => room.placeId === "living")!;
        const walkway = layout.rooms.find((room) => room.role === "walkway")!;
        expect(living.theme).toBe("living");
        expect(walkway.theme).toBe("corridor");
      }
    });
  });
  describe("row/double-row legacy walkway contract", () => {
    it.each([
      [{ id: "passage", label: "Hall" }, "walkway"],
      [{ id: "passage", label: "corridor" }, "walkway"],
      [{ id: "corridor", label: "연결" }, "walkway"],
      [{ id: "hall", label: "홀" }, "room"],
      [{ id: "hall", label: "Hall", role: "entrance" }, "entrance"],
      [{ id: "hall", label: "Hall", role: "room" }, "room"],
    ] as const)("%j resolves to %s in both layouts", (place, role) => {
      const bundle: ConceptBundleRecord = {
        id: "test", label: "Test", facilities: [{ id: "f", label: "F", placeIds: [place.id] }],
        places: [{ ...place }], things: [],
      };
      for (const layout of [layoutConceptFacility(bundle, bundle.facilities[0]!), layoutConceptFacilityDoubleRow(bundle, bundle.facilities[0]!)]) {
        expect(layout.rooms.find((room) => room.placeId === place.id)?.role).toBe(role);
      }
    });
  });
});

describe("createDefaultGameEvent", () => {
  isolateTimers();
  describe("createDefaultGameEvent", () => {
    it("creates events without a default charset graphic", () => {
      const event = createDefaultGameEvent(3, 4);
      expect(event.sprite).toBeUndefined();
      expect(event.pages?.[0]?.graphic).toEqual({});
      expect(event.x).toBe(3);
      expect(event.y).toBe(4);
      expect(event.commands).toEqual([]);
    });
  });
});
