import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemonstrationMessage, type DemonstrationPayload } from "@/ai/demonstrationPrompt";
import { openDemoTeachModal } from "@/editor/panels/demoTeachCanvas";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, FakeElement } from "./fakeDom";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderCanvasToolbar } from "@/editor/panels/editorZoomToolbar";
import { resetCanvasToolPillForTests } from "@/editor/panels/canvasToolPill";
import { _resetEditorGameSuspensionForTest, configureEditorGameAccessor, isEditorGameSuspended, resumeEditorGame, suspendEditorGame } from "@/editor/panels/editorGameSuspension";
import { createEditorModalDirtyCloseController, EDITOR_MODAL_DIRTY_DECISION, type EditorModalCloseAttempt, type EditorModalDirtyDecision } from "@/editor/panels/editorModalDirtyState";
import { equipmentSlotManager } from "@/editor/panels/equipmentSlotManager";
import { renderEventEditor, syncMountedEventSelection } from "@/editor/panels/eventEditor";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import type { EventPage, GameEvent, ProjectFactions, EnemyActionCondition, Project } from "@/project/types";
import { applyFactionsFromWorldPlan, combatFactionIdFromWorldEntityId, planFactionsFromWorld, WORLD_ALLY_STANCE, WORLD_COMBAT_FACTION_ID_PATTERN, WORLD_ENEMY_STANCE } from "@/project/factionsFromWorld";
import { renameFaction } from "@/editor/panels/databaseFactionModel";
import { factionStance, normalizeProjectFactions, resolveFactionTable } from "@/project/factions";
import { deserialize, serialize } from "@/project/io";
import type { ProjectWorld, WorldEntity } from "@/project/world";
import { troopAuthoringPreview } from "@/battle/battleAuthoringPreview";
import { troopIntentPanel } from "@/editor/panels/databaseTroopIntentPanel";
import fixture from "./fixtures/projects/battle-v3.json";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { itemFields } from "@/editor/panels/databaseBasicRecordFields";
import { renderSkillRecordForm } from "@/editor/panels/databaseSkillRecordView";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { renderTroopRecordForm } from "@/editor/panels/databaseTroopRecordView";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { MAP_SHIFT_NOTE } from "@/editor/panels/mapShiftCopy";
import { editorIntlLocale, matchSupportedLocale, resolveLocale } from "@/i18n/locale";
import { createTranslator } from "@/i18n/translator";
import en from "@/i18n/catalogs/en.json";
import ja from "@/i18n/catalogs/ja.json";
import zh from "@/i18n/catalogs/zh.json";
import { searchProject } from "@/editor/panels/mapEventSearchModel";
import { mapAiBadges } from "@/editor/panels/mapTreeAiBadges";
import type { MapRunTicket } from "@/editor/aiMapRunQueue";
import type { Presence } from "@/editor/panels/aiPresence";
import { isolateTimers } from "./mergedTeardown";

// 시연으로 가르치기 계약(2026-07-05): 붓질 기록 → 메시지 조립 → AI 해석 지침 내장.
// AI 추측이 틀렸을 때 말 대신 직접 깔아서 보여주는 교정 채널.
describe("demoTeach", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    store.replace(withRetiredEasyRpgTilesets(createBlankProject()));
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  describe("buildDemonstrationMessage", () => {
    const payload: DemonstrationPayload = {
      w: 3,
      h: 2,
      seed: { mapId: "map_v", x: 5, y: 7 },
      lower: [
        [240, 290, 290],
        [240, 290, 290],
      ],
      upper: [
        [-1, -1, -1],
        [-1, 87, -1],
      ],
      strokes: [
        { layer: "lower", x: 1, y: 0, tile: 290 },
        { layer: "lower", x: 2, y: 0, tile: 290 },
        { layer: "upper", x: 1, y: 1, tile: 87 },
      ],
      explanation: "나무는 2×2 이상 뭉쳐야 숲으로 보임",
    };

    it("최종 그리드·붓질 순서·설명·해석 지침(교정 툴 안내)을 담는다", () => {
      const message = buildDemonstrationMessage(payload);
      expect(message).toContain("[시연]");
      expect(message).toContain(payload.explanation);
      expect(message).toContain("240 290 290"); // 하위 그리드 행.
      expect(message).toContain(". 87 ."); // 상위 그리드(빈 칸은 .).
      expect(message).toContain("1) lower (1,0) ← 타일 290"); // 붓질 순서 보존.
      expect(message).toContain("set_tile_metadata");
      expect(message).toContain("upsert_tile_group");
      expect(message).toContain("show_tiles");
      expect(message).toContain("confirmedByUser=true");
      expect(message).toContain("placementRules");
      expect(message).toContain("map_v");
      expect(message).toContain("(5,7)");
      expect([...message.matchAll(/^(\d+)\) (lower|upper) \((\d+),(\d+)\) ← 타일 (\d+)$/gm)]
        .map((match) => ({ layer: match[2], x: Number(match[3]), y: Number(match[4]), tile: Number(match[5]) })))
        .toEqual(payload.strokes);
      expect(message).toContain("[선택지]"); // 배운 내용 확인 칩.
    });

    it("붓질이 많으면 60개까지만 나열하고 총횟수를 남긴다", () => {
      const many: DemonstrationPayload = {
        ...payload,
        strokes: Array.from({ length: 75 }, (_, index) => ({ layer: "lower" as const, x: index % 3, y: 0, tile: 240 })),
      };
      const message = buildDemonstrationMessage(many);
      expect(message).toContain("60)");
      expect(message).not.toContain("61)");
      expect(message).toContain("총 75회");
    });
  });
  describe("demoTeachCanvas 모달", () => {
    it("칠하면 붓질이 기록되고, 보내기 콜백이 최종 상태를 담는다", () => {
      const onSend = vi.fn();
      const modal = openDemoTeachModal({ seed: null, onSend }) as unknown as FakeElement;

      // 기본 붓은 잔디/하위 — (0,0)과 (1,0)을 칠한다.
      (findByTestId(modal, "demo-teach-cell-0-0") as unknown as HTMLElement).click();
      (findByTestId(modal, "demo-teach-cell-1-0") as unknown as HTMLElement).click();
      expect((findByTestId(modal, "demo-teach-count") as unknown as HTMLElement).textContent).toContain("2회");

      // 실행취소 한 번 → 1회.
      (findByTestId(modal, "demo-teach-undo") as unknown as HTMLElement).click();
      expect((findByTestId(modal, "demo-teach-count") as unknown as HTMLElement).textContent).toContain("1회");

      const explanation = findByTestId(modal, "demo-teach-explanation") as unknown as HTMLTextAreaElement;
      explanation.value = "잔디 시연";
      explanation.dispatchEvent(new Event("input"));

      (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();
      expect(onSend).toHaveBeenCalledTimes(1);
      const payload = onSend.mock.calls[0][0] as DemonstrationPayload;
      expect(payload.strokes).toHaveLength(1);
      expect(payload.strokes[0]).toEqual({ layer: "lower", x: 0, y: 0, tile: TILE.GRASS });
      expect(payload.explanation).toBe("잔디 시연");
      expect(payload.seed).toBeNull();
      expect(payload.lower[0][0]).toBe(TILE.GRASS);
    });

    it("붓질 없이 보내기는 거부한다(빈 시연 방지)", () => {
      const onSend = vi.fn();
      const modal = openDemoTeachModal({ seed: null, onSend }) as unknown as FakeElement;
      (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();
      expect(onSend).not.toHaveBeenCalled();
    });

    it("상위 지우개를 고르면 레이어가 상위로 바뀌고 -1 붓질이 기록된다", () => {
      const onSend = vi.fn();
      const modal = openDemoTeachModal({ seed: null, onSend }) as unknown as FakeElement;
      (findByTestId(modal, "demo-teach-eraser") as unknown as HTMLElement).click();
      (findByTestId(modal, "demo-teach-cell-2-1") as unknown as HTMLElement).click();
      (findByTestId(modal, "demo-teach-send") as unknown as HTMLElement).click();
      const payload = onSend.mock.calls[0][0] as DemonstrationPayload;
      expect(payload.strokes[0]).toEqual({ layer: "upper", x: 2, y: 1, tile: -1 });
    });
  });
});

describe("editorCanvasToolbarBasicZoom", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  function asFake(node: HTMLElement): FakeElement {
    if (node instanceof FakeElement) return node;
    throw new Error("expected FakeElement");
  }
  function render(): FakeElement {
    const host = document.createElement("div") as unknown as HTMLElement;
    renderCanvasToolbar(host);
    return asFake(host);
  }
  function ids(fake: FakeElement): string[] {
    return Array.from(fake.children as unknown as FakeElement[], (child) => child.dataset.testid ?? child.className);
  }
  beforeEach(() => {
    restoreDom = installFakeDom();
    resetCanvasToolPillForTests();
    const project = createBlankProject();
    store.replace(project);
    resetMapEditHistory();
    editorState.set({ currentMapId: project.startMapId, layer: "lower", paintShape: "pen", tool: "paint", zoom: 2 });
  });
  afterEach(() => {
    resetCanvasToolPillForTests();
    restoreDom?.();
    restoreDom = null;
  });
  describe("canvas tool pill", () => {
    it("keeps canvas tools, history, zoom and the contextual small task together", () => {
      const fake = render();
      expect(fake.classList.contains("canvas-tool-pill")).toBe(true);
      expect(ids(fake)).toEqual([
        "tool-paint",
        "tool-select",
        "tool-fill",
        "canvas-tool-pill-divider",
        "canvas-tool-undo",
        "editor-zoom-group",
        "small-task-open",
      ]);
      for (const gone of [
        "editor-canvas-toolbar-expand",
        "canvas-ai-workbench",
        "walk-encounter-list-open",
        "map-location-layer-toggle",
        "map-background-preview-toggle",
        "editor-grid-toggle",
        "editor-map-screenshot-button",
        "tool-rect",
        "tool-pan",
      ]) {
        expect(fake.querySelector(`[data-testid="${gone}"]`), gone).toBeNull();
      }
    });

    it("shows zoom as a percentage and keeps every editor-zoom-* level behind it", () => {
      const fake = render();
      const stepper = fake.querySelector('[data-testid="editor-zoom-stepper"]');
      expect(stepper?.textContent).toBe("200%");
      for (const z of [0.25, 0.5, 1, 2, 3, 4, 6, 8]) {
        expect(fake.querySelector(`[data-testid="editor-zoom-${z}"]`), String(z)).toBeTruthy();
      }
      (fake.querySelector('[data-testid="editor-zoom-4"]') as FakeElement).click();
      expect(editorState.get().zoom).toBe(4);
    });

    it("drives the shared tool state and reflects it as the pressed button", () => {
      let fake = render();
      (fake.querySelector('[data-testid="tool-select"]') as FakeElement).click();
      expect(editorState.get()).toMatchObject({ tool: "select" });
      fake = render();
      expect(fake.querySelector('[data-testid="tool-select"]')?.getAttribute("aria-pressed")).toBe("true");
      expect(fake.querySelector('[data-testid="tool-select"]')?.getAttribute("aria-label")).toBe("영역 선택");
      expect(fake.querySelector('[data-testid="tool-paint"]')?.getAttribute("aria-pressed")).toBe("false");
      (fake.querySelector('[data-testid="tool-fill"]') as FakeElement).click();
      expect(editorState.get().tool).toBe("fill");
    });

    it("disables undo while the history stack is empty", () => {
      const fake = render();
      const undo = fake.querySelector('[data-testid="canvas-tool-undo"]') as FakeElement | null;
      expect(undo?.disabled).toBe(true);
    });

    it("drops the tile tools on the event layer but keeps region select, undo and zoom", () => {
      editorState.set({ layer: "event", tool: "event" });
      const fake = render();
      expect(fake.querySelector('[data-testid="tool-paint"]')).toBeNull();
      expect(fake.querySelector('[data-testid="tool-fill"]')).toBeNull();
      expect(fake.querySelector('[data-testid="tool-select"]')).toBeTruthy();
      expect(fake.querySelector('[data-testid="canvas-tool-undo"]')).toBeTruthy();
      expect(fake.querySelector('[data-testid="editor-zoom-stepper"]')).toBeTruthy();
    });

    it("shows only region select on the terrain (relief) tool", () => {
      editorState.set({ layer: "lower", tool: "relief" });
      const fake = render();
      expect(fake.querySelector('[data-testid="tool-paint"]')).toBeNull();
      expect(fake.querySelector('[data-testid="tool-fill"]')).toBeNull();
      expect(fake.querySelector('[data-testid="tool-select"]')).toBeTruthy();
    });
  });
});

describe("editorGameSuspension", () => {
  isolateTimers();
  const modeHarness = { game: null as unknown };
  function fakeGame(): {
    loop: { running: boolean; sleep: ReturnType<typeof vi.fn>; wake: ReturnType<typeof vi.fn> };
    input: { keyboard: { enabled: boolean } };
    scale: { refresh: ReturnType<typeof vi.fn> };
  } {
    const game = {
      loop: {
        running: true,
        sleep: vi.fn(() => {
          game.loop.running = false;
        }),
        wake: vi.fn(() => {
          game.loop.running = true;
        }),
      },
      input: { keyboard: { enabled: true } },
      scale: { refresh: vi.fn() },
    };
    return game;
  }
  describe("editorGameSuspension", () => {
    beforeEach(() => {
      _resetEditorGameSuspensionForTest();
      modeHarness.game = null;
      configureEditorGameAccessor(() => modeHarness.game);
    });

    it("테스트 플레이 창이 열리면 편집기 게임 루프를 멈추고 키보드 매니저를 끈다", () => {
      const game = fakeGame();
      modeHarness.game = game;
      suspendEditorGame();
      expect(game.loop.sleep).toHaveBeenCalledTimes(1);
      expect(game.loop.running).toBe(false);
      expect(game.input.keyboard.enabled).toBe(false);
      expect(isEditorGameSuspended()).toBe(true);
    });

    it("창을 닫으면 루프를 이어서 깨우고(seamless) 키보드·크기를 되살린다", () => {
      const game = fakeGame();
      modeHarness.game = game;
      suspendEditorGame();
      resumeEditorGame();
      expect(game.loop.wake).toHaveBeenCalledWith(true);
      expect(game.loop.running).toBe(true);
      expect(game.input.keyboard.enabled).toBe(true);
      expect(game.scale.refresh).toHaveBeenCalledTimes(1);
      expect(isEditorGameSuspended()).toBe(false);
    });

    it("두 번 열어도 한 번만 잠재우고, 잠재운 적 없으면 닫기는 아무 일도 하지 않는다", () => {
      const game = fakeGame();
      modeHarness.game = game;
      resumeEditorGame();
      expect(game.loop.wake).not.toHaveBeenCalled();
      suspendEditorGame();
      suspendEditorGame();
      expect(game.loop.sleep).toHaveBeenCalledTimes(1);
    });

    it("편집기 게임이 없으면(플레이 전용 셸·접근자 미주입) 조용히 지나간다", () => {
      _resetEditorGameSuspensionForTest();
      expect(() => suspendEditorGame()).not.toThrow();
      expect(isEditorGameSuspended()).toBe(false);
      expect(() => resumeEditorGame()).not.toThrow();
    });

    it("잠든 사이 파괴된 게임(isRunning=false)은 깨우지 않는다", () => {
      const game = fakeGame() as ReturnType<typeof fakeGame> & { isRunning?: boolean };
      modeHarness.game = game;
      suspendEditorGame();
      game.isRunning = false;
      resumeEditorGame();
      expect(game.loop.wake).not.toHaveBeenCalled();
      expect(game.scale.refresh).not.toHaveBeenCalled();
      expect(isEditorGameSuspended()).toBe(false);
    });

    it("이미 꺼져 있던 키보드는 닫은 뒤에도 꺼진 채로 둔다", () => {
      const game = fakeGame();
      game.input.keyboard.enabled = false;
      modeHarness.game = game;
      suspendEditorGame();
      resumeEditorGame();
      expect(game.input.keyboard.enabled).toBe(false);
    });
  });
});

describe("editorModalDirtyState", () => {
  isolateTimers();
  type DirtyCloseHarness = {
    readonly backdrop: FakeElement;
    readonly cancelButton: FakeElement;
    readonly closeButton: FakeElement;
    readonly calls: readonly string[];
    readonly decisions: readonly EditorModalCloseAttempt[];
    readonly setDirty: (dirty: boolean) => void;
    readonly setDecision: (decision: EditorModalDirtyDecision) => void;
  };
  function createHarness(): DirtyCloseHarness {
    let dirty = false;
    let decision: EditorModalDirtyDecision = EDITOR_MODAL_DIRTY_DECISION.KeepEditing;
    const calls: string[] = [];
    const decisions: EditorModalCloseAttempt[] = [];
    const backdrop = new FakeElement("div");
    const cancelButton = new FakeElement("button");
    const closeButton = new FakeElement("button");
    const controller = createEditorModalDirtyCloseController({
      isDirty: () => dirty,
      promptUnsavedChanges: (attempt) => {
        decisions.push(attempt);
        return decision;
      },
      save: () => calls.push("save"),
      discard: () => calls.push("discard"),
      close: () => calls.push("close"),
    });
    controller.bindCancelButton(cancelButton);
    controller.bindCloseButton(closeButton);
    backdrop.addEventListener("mousedown", (event) => controller.handleBackdropMouseDown(event, backdrop));
    backdrop.addEventListener("keydown", controller.handleKeyDown);
    return {
      backdrop,
      cancelButton,
      closeButton,
      calls,
      decisions,
      setDirty: (nextDirty) => {
        dirty = nextDirty;
      },
      setDecision: (nextDecision) => {
        decision = nextDecision;
      },
    };
  }
  function eventWithTarget(type: string, target: object): Event {
    const event = new Event(type);
    Object.defineProperty(event, "target", { configurable: true, value: target });
    return event;
  }
  function escapeKeyDown(): Event {
    const event = new Event("keydown");
    Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
    return event;
  }
  describe("editor modal dirty close controller", () => {
    let restoreDom: () => void;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom();
      vi.restoreAllMocks();
    });

    it("closes immediately without prompting when the modal is clean", () => {
      const harness = createHarness();

      harness.cancelButton.dispatchEvent(new Event("click"));

      expect(harness.calls).toEqual(["close"]);
      expect(harness.decisions).toEqual([]);
    });

    it("saves and closes when a dirty cancel attempt chooses Save", () => {
      const harness = createHarness();
      harness.setDirty(true);
      harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.Save);

      harness.cancelButton.dispatchEvent(new Event("click"));

      expect(harness.decisions).toEqual(["cancel"]);
      expect(harness.calls).toEqual(["save", "close"]);
    });

    it("discards and closes when a dirty Escape attempt chooses Discard", () => {
      const harness = createHarness();
      harness.setDirty(true);
      harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.Discard);

      harness.backdrop.dispatchEvent(escapeKeyDown());

      expect(harness.decisions).toEqual(["escape"]);
      expect(harness.calls).toEqual(["discard", "close"]);
    });

    it("keeps editing when a dirty backdrop attempt chooses Keep Editing", () => {
      const harness = createHarness();
      harness.setDirty(true);
      harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.KeepEditing);

      harness.backdrop.dispatchEvent(eventWithTarget("mousedown", harness.backdrop));

      expect(harness.decisions).toEqual(["backdrop"]);
      expect(harness.calls).toEqual([]);
    });

    it("does not prompt when backdrop mousedown starts inside the dialog window", () => {
      const harness = createHarness();
      const windowEl = new FakeElement("section");
      harness.setDirty(true);
      harness.backdrop.append(windowEl);

      harness.backdrop.dispatchEvent(eventWithTarget("mousedown", windowEl));

      expect(harness.decisions).toEqual([]);
      expect(harness.calls).toEqual([]);
    });

    it("uses the same dirty prompt path for the X close button", () => {
      const harness = createHarness();
      harness.setDirty(true);
      harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.Discard);

      harness.closeButton.dispatchEvent(new Event("click"));

      expect(harness.decisions).toEqual(["x"]);
      expect(harness.calls).toEqual(["discard", "close"]);
    });
  });
});

describe("equipmentSlotHistory", () => {
  isolateTimers();
  let restoreDom: () => void;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  afterEach(() => {
    resetMapEditHistory();
    restoreDom();
  });
  function control(root: FakeElement, id: string): FakeElement {
    const found = findByTestId(root, id);
    if (!found) throw new Error(`Missing control: ${id}`);
    return found;
  }
  describe("equipment slot authoring history", () => {
    it.each(["add", "rename", "remove"])("undoes the complete %s operation", (operation) => {
      // Given an unused custom slot and the selected equipment's original assignment.
      store.update((project) => {
        project.database.equipmentSlots = [{ id: "slot_boots", label: "Boots" }];
      });
      const before = structuredClone(store.getCurrent().database);
      const equipmentId = before.equipment[0]!.id;
      const manager = equipmentSlotManager(equipmentId, () => undefined) as unknown as FakeElement;

      // When one catalog operation is performed through its real editor control.
      switch (operation) {
        case "add":
          control(manager, "db-equipment-slot-new-label").value = "Cloak";
          control(manager, "db-equipment-slot-add").click();
          break;
        case "rename": {
          const input = control(manager, "db-equipment-slot-label-slot_boots");
          input.value = "Greaves";
          input.dispatchEvent(new Event("change"));
          break;
        }
        case "remove":
          control(manager, "db-equipment-slot-remove-slot_boots").click();
          break;
      }

      // Then undo restores both the catalog and the selected equipment atomically.
      expect(store.getCurrent().database).not.toEqual(before);
      expect(undoMapEdit()).toBe(true);
      expect(store.getCurrent().database).toEqual(before);
    });
  });
});

describe("eventListSelectionSync", () => {
  isolateTimers();
  let restoreFakeDom: () => void = () => undefined;
  function page(id: string): EventPage {
    return {
      id,
      name: "EV001",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function event(id: string, name: string, x: number): GameEvent {
    return { id, name, x, y: 2, trigger: { kind: "action" }, commands: [], pages: [page(`${id}-page`)] };
  }
  describe("event list selection stays in place", () => {
    beforeEach(() => {
      _resetEventDraftVaultForTest();
      restoreFakeDom = installFakeDom();
      const project = createBlankProject();
      project.maps[project.startMapId].events = [
        event("event-1", "문지기", 1),
        event("event-2", "상인", 4),
        event("event-3", "아이", 8),
      ];
      store.replace(project);
      editorState.set({
        currentMapId: project.startMapId,
        layer: "event",
        tool: "event",
        selectedEventId: "event-1",
        selectedEventPageId: "event-1-page",
        pendingEventCoordinate: null,
      });
    });

    afterEach(() => {
      document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
      _resetEventDraftVaultForTest();
      restoreFakeDom();
    });

    it("moves the highlight and summary without rebuilding rows or resetting scroll", () => {
      const sidebar = new FakeElement("div") as unknown as HTMLElement;
      document.body.append(sidebar);
      renderEventEditor(sidebar);
      const rows = sidebar.querySelector<HTMLElement>(".event-list-rows")!;
      const kept = sidebar.querySelector<HTMLElement>('[data-testid="event-list-row-event-3"]')!;
      rows.scrollTop = 180;

      editorState.set({ selectedEventId: "event-3", selectedEventPageId: "event-3-page" });
      expect(syncMountedEventSelection()).toBe(true);

      expect(sidebar.querySelector('[data-testid="event-list-row-event-3"]')).toBe(kept);
      expect(rows.scrollTop).toBe(180);
      expect(sidebar.querySelector('[data-testid="event-list-row-event-1"]')?.classList.contains("active")).toBe(false);
      expect(kept.classList.contains("active")).toBe(true);
      expect(sidebar.querySelector(".event-editor-launch-title")?.textContent).toBe("아이");
      expect(sidebar.querySelector<HTMLElement>('[data-testid="event-editor-launch"]')?.dataset.eventId).toBe("event-3");
    });

    it("keeps the same summary when only the page id changes", () => {
      const sidebar = new FakeElement("div") as unknown as HTMLElement;
      document.body.append(sidebar);
      renderEventEditor(sidebar);
      const launch = sidebar.querySelector('[data-testid="event-editor-launch"]');
      editorState.set({ selectedEventPageId: "event-1-page" });
      expect(syncMountedEventSelection()).toBe(true);
      expect(sidebar.querySelector('[data-testid="event-editor-launch"]')).toBe(launch);
    });

    it("clears the highlight when the selection is dropped", () => {
      const sidebar = new FakeElement("div") as unknown as HTMLElement;
      document.body.append(sidebar);
      renderEventEditor(sidebar);
      editorState.set({ selectedEventId: null, selectedEventPageId: null });
      expect(syncMountedEventSelection()).toBe(true);
      const rows = [...sidebar.querySelectorAll<HTMLElement>(".event-list-row")];
      expect(rows.length).toBe(3);
      expect(rows.every((row) => !row.classList.contains("active"))).toBe(true);
      expect(sidebar.querySelector('[data-testid="event-editor-launch"]')).toBeNull();
    });

    it("leaves the mounted list alone when the selected event is not in it", () => {
      const sidebar = new FakeElement("div") as unknown as HTMLElement;
      document.body.append(sidebar);
      renderEventEditor(sidebar);
      const row = sidebar.querySelector('[data-testid="event-list-row-event-1"]');
      editorState.set({ selectedEventId: "missing" });
      expect(syncMountedEventSelection()).toBe(false);
      expect(sidebar.querySelector('[data-testid="event-list-row-event-1"]')).toBe(row);
      expect(row?.classList.contains("active")).toBe(true);
    });
  });
});

describe("factionsFromWorld", () => {
  isolateTimers();
  function faction(id: string, name = id): WorldEntity {
    return { id, type: "faction", name, summary: `${name} 설명`, origin: "user" };
  }
  function world(
    entities: readonly WorldEntity[],
    relations: ProjectWorld["relations"] = [],
  ): ProjectWorld {
    return { entities, relations };
  }
  describe("world faction materialization", () => {
    it("maps each lore faction to a stable combat def with conservative aggression", () => {
      const input = world([faction("w_iron_hand", "철의 손"), faction("w_watch", "도시 경비대")]);

      const plan = planFactionsFromWorld(input, undefined);

      expect(plan.diff.defs.added).toEqual([
        { id: "w_iron_hand", name: "철의 손", aggression: 1, worldEntityId: "w_iron_hand" },
        { id: "w_watch", name: "도시 경비대", aggression: 1, worldEntityId: "w_watch" },
      ]);
      expect(plan.diff.defs.changed).toEqual([]);
      expect(plan.diff.defs.removed).toEqual([]);
      expect(plan.diff.defs.conflicts).toEqual([]);
      expect(plan.result?.defs).toEqual(plan.diff.defs.added);
    });

    it("maps enemyOf to enemy and allyOf to full alliance while unrelated pairs remain neutral", () => {
      const input = world(
        [faction("w_iron"), faction("w_watch"), faction("w_merchants")],
        [
          { a: "w_iron", b: "w_watch", kind: "enemyOf" },
          { a: "w_watch", b: "w_merchants", kind: "allyOf" },
        ],
      );

      const plan = planFactionsFromWorld(input, undefined);
      const table = resolveFactionTable(plan.result);

      expect(WORLD_ENEMY_STANCE).toBe(-1);
      expect(WORLD_ALLY_STANCE).toBe(2);
      expect(factionStance(table, "w_iron", "w_watch")).toBe(-1);
      expect(factionStance(table, "w_watch", "w_merchants")).toBe(2);
      expect(factionStance(table, "w_iron", "w_merchants")).toBe(0);
    });

    it("keeps the more-hostile interpretation when lore declares both alliance and hostility", () => {
      const input = world(
        [faction("w_iron"), faction("w_watch")],
        [
          { a: "w_iron", b: "w_watch", kind: "allyOf" },
          { a: "w_watch", b: "w_iron", kind: "enemyOf" },
        ],
      );

      const plan = planFactionsFromWorld(input, undefined);

      expect(plan.diff.relations.added).toEqual([{ a: "w_watch", b: "w_iron", stance: -1 }]);
      expect(factionStance(resolveFactionTable(plan.result), "w_iron", "w_watch")).toBe(-1);
    });

    it("is idempotent after applying the first plan", () => {
      const input = world(
        [faction("w_iron"), faction("w_watch")],
        [{ a: "w_iron", b: "w_watch", kind: "enemyOf" }],
      );
      const first = planFactionsFromWorld(input, undefined);
      const applied = applyFactionsFromWorldPlan(first);

      const second = planFactionsFromWorld(input, applied);

      expect(first.hasChanges).toBe(true);
      expect(second.hasChanges).toBe(false);
      expect(second.diff.defs.added).toEqual([]);
      expect(second.diff.relations.added).toEqual([]);
      expect(second.result).toEqual(applied);
    });

    it("keeps a materialized world faction linked after its combat id is renamed", () => {
      const input = world([faction("w_iron", "철의 손")]);
      const materialized = normalizeProjectFactions(
        applyFactionsFromWorldPlan(planFactionsFromWorld(input, undefined)),
      );
      const project = createBlankProject();
      project.world = input;
      project.factions = materialized;

      const renamed = renameFaction(project, "w_iron", "ironhand");
      expect(renamed.ok).toBe(true);
      if (!renamed.ok) return;
      const persisted = deserialize(serialize(renamed.project));
      const defsBeforeReplan = persisted.factions?.defs.length;

      const replanned = planFactionsFromWorld(input, persisted.factions);

      expect(replanned.mapping).toContainEqual(expect.objectContaining({
        worldEntityId: "w_iron",
        combatFactionId: "ironhand",
        status: "existing",
      }));
      expect(replanned.diff.defs.added).toEqual([]);
      expect(replanned.result?.defs).toHaveLength(defsBeforeReplan ?? 0);
    });

    it.each([
      ["original first", [
        { id: "w_iron", name: "철의 손", aggression: 1 as const, worldEntityId: "w_iron" },
        { id: "w_iron_1", name: "철의 손 복사본", aggression: 1 as const, worldEntityId: "w_iron" },
      ]],
      ["copy first", [
        { id: "w_iron_1", name: "철의 손 복사본", aggression: 1 as const, worldEntityId: "w_iron" },
        { id: "w_iron", name: "철의 손", aggression: 1 as const, worldEntityId: "w_iron" },
      ]],
    ] as const)("chooses the same provenance owner when duplicate claims are %s", (_label, defs) => {
      const existing: ProjectFactions = { defs: [...defs], relations: [] };

      const plan = planFactionsFromWorld(world([faction("w_iron", "철의 손")]), existing);

      expect(plan.mapping[0]).toEqual(expect.objectContaining({
        combatFactionId: "w_iron",
        status: "existing",
      }));
      expect(plan.hasChanges).toBe(false);
    });

    it("backfills provenance on a legacy materialized def so a later rename keeps the link", () => {
      const input = world([faction("w_iron", "철의 손")]);
      // 출처 필드가 없던 구버전 구체화 산출물 그대로의 행.
      const legacy: ProjectFactions = {
        defs: [{ id: "w_iron", name: "철의 손", aggression: 1 }],
        relations: [],
      };

      const backfill = planFactionsFromWorld(input, legacy);

      expect(backfill.hasChanges).toBe(true);
      expect(backfill.diff.defs.added).toEqual([]);
      expect(backfill.diff.defs.changed).toEqual([{
        before: { id: "w_iron", name: "철의 손", aggression: 1 },
        after: { id: "w_iron", name: "철의 손", aggression: 1, worldEntityId: "w_iron" },
      }]);

      const project = createBlankProject();
      project.world = input;
      project.factions = normalizeProjectFactions(applyFactionsFromWorldPlan(backfill));

      const renamed = renameFaction(project, "w_iron", "ironhand");
      expect(renamed.ok).toBe(true);
      if (!renamed.ok) return;
      const persisted = deserialize(serialize(renamed.project));
      const defsBeforeReplan = persisted.factions?.defs.length;

      const replanned = planFactionsFromWorld(input, persisted.factions);

      expect(replanned.hasChanges).toBe(false);
      expect(replanned.diff.defs.added).toEqual([]);
      expect(replanned.diff.defs.changed).toEqual([]);
      expect(replanned.result?.defs).toHaveLength(defsBeforeReplan ?? 0);
      expect(replanned.mapping).toContainEqual(expect.objectContaining({
        worldEntityId: "w_iron",
        combatFactionId: "ironhand",
        status: "existing",
      }));
    });

    it("preserves hand-authored metadata, relations, and player-kill policy while surfacing conflicts", () => {
      const authored: ProjectFactions = {
        defs: [
          { id: "w_iron", name: "철의 손", color: "#123456", aggression: 1, protectedFromNpcs: true },
          { id: "w_watch", name: "도시 경비대", aggression: 3 },
        ],
        relations: [{ a: "w_iron", b: "w_watch", stance: -2 }],
        playerKillReputation: { weight: 0.75 },
      };
      const input = world(
        [faction("w_iron", "철의 손"), faction("w_watch", "도시 경비대")],
        [{ a: "w_iron", b: "w_watch", kind: "allyOf" }],
      );

      const plan = planFactionsFromWorld(input, authored);

      // 상호 호환인 w_iron 은 출처만 보정되고, 사람이 적은 색·보호·평판 설정은 그대로 남는다.
      expect(plan.diff.defs.added).toEqual([]);
      expect(plan.diff.defs.changed).toEqual([{
        before: authored.defs[0],
        after: { ...authored.defs[0], worldEntityId: "w_iron" },
      }]);
      expect(plan.result).toEqual({
        ...authored,
        defs: [{ ...authored.defs[0], worldEntityId: "w_iron" }, authored.defs[1]],
      });
      expect(plan.diff.defs.conflicts).toEqual([
        expect.objectContaining({ worldEntityId: "w_watch", existing: authored.defs[1] }),
      ]);
      expect(plan.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "id-collision", severity: "conflict", worldEntityId: "w_watch" }),
        expect.objectContaining({ code: "relation-endpoint-blocked", severity: "conflict" }),
      ]));
      expect(factionStance(resolveFactionTable(plan.result), "w_iron", "w_watch")).toBe(-2);
    });

    it("does not overwrite a hand-authored stance that disagrees with lore", () => {
      const authored: ProjectFactions = {
        defs: [
          { id: "w_iron", name: "철의 손", aggression: 1 },
          { id: "w_watch", name: "도시 경비대", aggression: 1 },
        ],
        relations: [{ a: "w_iron", b: "w_watch", stance: -2 }],
      };
      const input = world(
        [faction("w_iron", "철의 손"), faction("w_watch", "도시 경비대")],
        [{ a: "w_iron", b: "w_watch", kind: "allyOf" }],
      );

      const plan = planFactionsFromWorld(input, authored);

      expect(plan.diff.relations.added).toEqual([]);
      expect(plan.diff.relations.conflicts).toEqual([
        { existing: authored.relations, implied: { a: "w_iron", b: "w_watch", stance: 2 } },
      ]);
      expect(plan.result?.relations).toEqual(authored.relations);
      expect(plan.issues).toContainEqual(expect.objectContaining({ code: "relation-conflict" }));
    });

    it.each(["player", "enemy"])("remaps reserved world id %s without redefining the reserved faction", (id) => {
      const plan = planFactionsFromWorld(world([faction(id, `세계관 ${id}`)]), undefined);
      const mapped = plan.mapping[0]!;

      expect(mapped.combatFactionId).not.toBe(id);
      expect(mapped.combatFactionId).toMatch(WORLD_COMBAT_FACTION_ID_PATTERN);
      expect(plan.diff.defs.added[0]?.id).toBe(mapped.combatFactionId);
      expect(plan.issues).toContainEqual(expect.objectContaining({ code: "reserved-id-remapped" }));
    });

    it("remaps invalid lore ids deterministically", () => {
      const id = "w_철의 손 guild!";
      const first = combatFactionIdFromWorldEntityId(id);
      const second = combatFactionIdFromWorldEntityId(id);

      expect(first).toBe(second);
      expect(first).toMatch(WORLD_COMBAT_FACTION_ID_PATTERN);
      expect(planFactionsFromWorld(world([faction(id)]), undefined).issues)
        .toContainEqual(expect.objectContaining({ code: "invalid-id-remapped" }));
    });

    it("keeps a same-name hand-authored faction separate and reports the collision", () => {
      const authored: ProjectFactions = {
        defs: [{ id: "hand_iron", name: "철의 손", color: "#654321", aggression: 2 }],
        relations: [],
      };

      const plan = planFactionsFromWorld(world([faction("w_iron", "철의 손")]), authored);

      expect(plan.diff.defs.added).toEqual([
        { id: "w_iron", name: "철의 손", aggression: 1, worldEntityId: "w_iron" },
      ]);
      expect(plan.result?.defs).toEqual([
        authored.defs[0],
        { id: "w_iron", name: "철의 손", aggression: 1, worldEntityId: "w_iron" },
      ]);
      expect(plan.issues).toContainEqual(expect.objectContaining({ code: "name-collision", severity: "warning" }));
    });

    it("blocks an incompatible exact-id collision instead of overwriting it", () => {
      const authored: ProjectFactions = {
        defs: [{ id: "w_iron", name: "수기 철갑단", aggression: 2 }],
        relations: [],
      };

      const plan = planFactionsFromWorld(world([faction("w_iron", "철의 손")]), authored);

      expect(plan.hasChanges).toBe(false);
      expect(plan.result).toEqual(authored);
      expect(plan.mapping[0]?.status).toBe("blocked");
      expect(plan.issues).toContainEqual(expect.objectContaining({ code: "id-collision", severity: "conflict" }));
    });
  });
});

describe("feature16BattleUiAuthoring", () => {
  isolateTimers();
  function setup() {
    const project = deserialize(JSON.stringify(fixture));
    project.switches.push({ id: "sw_keep", name: "행동 후 스위치" });
    const troop = project.database.troops.find(t => t.id === "troop_slime")!;
    const enemy = project.database.enemies.find(e => e.id === "enemy_slime")!;
    const skill = project.database.skills[0]!;
    skill.mpCost = { flat: 5, percentMax: 0 };
    enemy.stats.maxMp = 10;
    enemy.actions = [{ skillId: skill.id, priority: 42, condition: { kind: "turn", start: 2, interval: 2 }, switchOnAfterAction: { enabled: true, switchId: "sw_keep" }, switchOffAfterAction: { enabled: false } }];
    project.database.elements = [{ id: "authored", name: "불", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 50, B: 200, C: 100, D: 0, E: -100 } }];
    enemy.elementRates = { authored: "A" };
    return { project, troop, enemy };
  }
  const input = { memberIndex: 0, actorId: "actor_hero", turn: 1, mpPercent: 100, row: "front" as const };
  describe("feature16 troop authoring what-if", () => {
    it("uses authored turns, MP rules and actual multipliers without mutating project", () => {
      const { project, troop } = setup();
      const before = JSON.stringify(project);
      expect(troopAuthoringPreview(project, troop, input)!.actions[0]!.reason).toBe("턴 조건 불일치");
      expect(troopAuthoringPreview(project, troop, { ...input, turn: 2, mpPercent: 0 })!.actions[0]!.reason).toContain("MP 부족");
      expect(troopAuthoringPreview(project, troop, { ...input, turn: 2 })!.actions[0]!.reason).toBeUndefined();
      expect(troopAuthoringPreview(project, troop, input)!.elements[0]!.multiplier).toBe(0.5); // A can be authored resistance.
      expect(JSON.stringify(project)).toBe(before);
    });
  });
  let cleanup: () => void;
  let oldWindow: typeof window;
  beforeEach(() => {
    cleanup = installFakeDom(); oldWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: () => 0, clearTimeout } });
  });
  afterEach(() => {
    cleanup();
    if (oldWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
  });
  it("edits existing enemy records through visible controls and preserves unrelated action fields on save/load", () => {
    const { project, troop, enemy } = setup();
    store.replace(project);
    const panel = troopIntentPanel(troop, 0) as unknown as FakeElement;
    const select = (id: string, value: string) => {
      const control = findByTestId(panel, id)!;
      expect(control).toBeTruthy(); control.value = value; control.dispatchEvent(new Event("change", { bubbles: true }));
    };
    for (const [id, value] of [["feature16-intent-start-0", "3"], ["feature16-intent-interval-0", "4"]]) {
      const control = findByTestId(panel, id!)!;
      control.value = value!; control.dispatchEvent(new Event("input"));
    }
    expect(store.getCurrent().database.enemies.find(e => e.id === enemy.id)!.actions[0]!.condition).toEqual({ kind: "turn", start: 3, interval: 4 });
    select("feature16-intent-condition-0", "always");
    select("feature16-intent-element-authored", "B");
    const restored = deserialize(serialize(store.getCurrent()));
    const changed = restored.database.enemies.find(e => e.id === enemy.id)!;
    expect(changed.actions[0]!.condition).toEqual({ kind: "always" });
    expect(changed.actions[0]!.switchOnAfterAction).toEqual({ enabled: true, switchId: "sw_keep" });
    expect(changed.elementRates.authored).toBe("B");
    expect(findByTestId(panel, "feature16-intent-prediction-0")).toBeTruthy();
  });
  describe("integrated combat condition preview", () => {
    const cases: { condition: EnemyActionCondition; matches: boolean }[] = [
      { condition: { kind: "always" }, matches: true },
      { condition: { kind: "turn", start: 2, interval: 3 }, matches: true },
      { condition: { kind: "turn", start: 3, interval: 3 }, matches: false },
      { condition: { kind: "hp", minPercent: 25, maxPercent: 25 }, matches: true },
      { condition: { kind: "hp", minPercent: 26, maxPercent: 100 }, matches: false },
      { condition: { kind: "mp", minPercent: 60, maxPercent: 60 }, matches: true },
      { condition: { kind: "mp", minPercent: 0, maxPercent: 59 }, matches: false },
      { condition: { kind: "status", stateId: "state_poison", present: false }, matches: true },
      { condition: { kind: "status", stateId: "state_poison", present: true }, matches: false },
      { condition: { kind: "allies", min: 1, max: 1 }, matches: true },
      { condition: { kind: "allies", min: 2, max: 3 }, matches: false },
      { condition: { kind: "switch", switchId: "preview-on", value: true }, matches: true },
      { condition: { kind: "switch", switchId: "preview-on", value: false }, matches: false },
      { condition: { kind: "switch", switchId: "preview-off", value: false }, matches: true },
      { condition: { kind: "switch", switchId: "legacy-preview", value: true }, matches: true },
    ];
    it.each(cases)("evaluates $condition with initial context: $matches", ({ condition, matches }) => {
      const { project, troop, enemy } = setup();
      enemy.stats.maxHp = enemy.stats.maxMp = 100;
      enemy.actions = [{ ...enemy.actions[0]!, skillId: "", condition }];
      troop.members = [
        { enemyId: enemy.id, x: 40, y: 40 },
        { enemyId: enemy.id, x: 60, y: 40 },
        { enemyId: enemy.id, x: 80, y: 40, hidden: true },
      ];
      project.switches.push({ id: "preview-on", name: "초기 ON" }, { id: "preview-off", name: "초기 OFF" });
      project.session.switches = { ...project.session.switches, "preview-on": true };
      project.flags["preview-off"] = true; // Declared switch initial value takes precedence over legacy flags.
      project.flags["legacy-preview"] = true;
      const before = JSON.stringify(project);
      const preview = troopAuthoringPreview(project, troop, { ...input, turn: 5, hpPercent: 25, mpPercent: 60 })!;
      expect(preview.actions[0]!.reason === undefined).toBe(matches);
      expect(preview).toMatchObject({ hp: 25, mp: 60, livingAllies: 1 });
      expect(JSON.stringify(project)).toBe(before);
    });
  });
  it.each<EnemyActionCondition>([
    { kind: "hp", minPercent: 10, maxPercent: 40 },
    { kind: "mp", minPercent: 20, maxPercent: 70 },
    { kind: "status", stateId: "state_poison", present: false },
    { kind: "allies", min: 1, max: 2 },
    { kind: "switch", switchId: "preview-switch", value: false },
  ])("shows and preserves authored $kind conditions through unrelated edits and save/load", condition => {
    const { project, troop, enemy } = setup();
    project.switches.push({ id: "preview-switch", name: "미리보기 스위치" });
    if (condition.kind === "status") condition = { ...condition, stateId: project.database.states[0]!.id };
    enemy.actions[0]!.condition = condition;
    store.replace(project);
    const panel = troopIntentPanel(troop, 0) as unknown as FakeElement;
    expect(findByTestId(panel, "feature16-intent-condition-0")!.value).toBe(condition.kind);
    expect(findByTestId(panel, "feature16-intent-context-note")!.textContent).toContain("관측한 결과가 아닙니다");
    const priority = findByTestId(panel, "feature16-intent-priority-0")!;
    priority.value = "53"; priority.dispatchEvent(new Event("input"));
    const restored = deserialize(serialize(store.getCurrent()));
    expect(restored.database.enemies.find(e => e.id === enemy.id)!.actions[0]).toMatchObject({ condition, priority: 53 });
  });
  it("edits HP assumptions and retains legacy turn capture selectors after switching condition kind", () => {
    const { project, troop, enemy } = setup();
    enemy.stats.maxHp = 100;
    enemy.actions[0] = { ...enemy.actions[0]!, skillId: "", condition: { kind: "hp", minPercent: 0, maxPercent: 50 } };
    store.replace(project);
    const panel = troopIntentPanel(troop, 0) as unknown as FakeElement;
    expect(findByTestId(panel, "feature16-intent-prediction-0")!.textContent).toContain("조건 불일치");
    const hp = findByTestId(panel, "feature16-intent-hp")!;
    hp.value = "25"; hp.dispatchEvent(new Event("input"));
    expect(findByTestId(panel, "feature16-intent-prediction-0")!.textContent).toContain("조건 통과");
    const kind = findByTestId(panel, "feature16-intent-condition-0")!;
    kind.value = "turn"; kind.dispatchEvent(new Event("change", { bubbles: true }));
    expect(findByTestId(panel, "feature16-intent-start-0")).toBeTruthy();
    expect(findByTestId(panel, "feature16-intent-interval-0")).toBeTruthy();
    expect(findByTestId(panel, "feature16-intent-condition-0")!.value).toBe("turn");
  });
});

describe("gen1EditorContracts", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("Gen1 editor contracts", () => {
    it("edits and normalizes move max PP and critical class", () => {
      const skill = store.getCurrent().database.skills[0];
      if (!skill) throw new Error("missing default skill");
      const form = document.createElement("section") as unknown as FakeElement;
      renderSkillRecordForm(form as unknown as HTMLElement, skill);

      input(form, "db-field-skill-max-pp", "150");
      change(form, "db-field-skill-gen1-critical", "high");

      const current = store.getCurrent().database.skills.find((record) => record.id === skill.id);
      expect(current?.maxPp).toBe(99);
      expect(current?.gen1CriticalRate).toBe("high");

      input(form, "db-field-skill-max-pp", "0");
      change(form, "db-field-skill-gen1-critical", "normal");
      const reset = store.getCurrent().database.skills.find((record) => record.id === skill.id);
      expect(reset?.maxPp).toBeUndefined();
      expect(reset?.gen1CriticalRate).toBeUndefined();
    });

    it("edits Gen1 major status and trainer-battle semantics", () => {
      const state = store.getCurrent().database.states[0];
      const troop = store.getCurrent().database.troops[0];
      if (!state || !troop) throw new Error("missing default records");
      const stateForm = document.createElement("section") as unknown as FakeElement;
      const troopForm = document.createElement("section") as unknown as FakeElement;
      renderStateRecordForm(stateForm as unknown as HTMLElement, state);
      renderTroopRecordForm(troopForm as unknown as HTMLElement, troop, () => undefined);

      change(stateForm, "db-state-gen1-major-status", "paralysis");
      const trainer = byTestId(troopForm, "db-field-troop-trainer-battle");
      trainer.checked = true;
      trainer.dispatchEvent(new Event("change"));

      expect(store.getCurrent().database.states.find((record) => record.id === state.id)?.gen1MajorStatus).toBe("paralysis");
      expect(store.getCurrent().database.troops.find((record) => record.id === troop.id)?.trainerBattle).toBe(true);
    });

    it("edits ball class without losing the compatibility multiplier", () => {
      const item = store.getCurrent().database.items.find((record) => record.id === "item_capture_orb");
      if (!item) throw new Error("missing capture item");
      updateDatabaseRecord("items", item.id, { captureProfile: { multiplier: 1.5, ballClass: "great" } });
      const form = document.createElement("section") as unknown as FakeElement;
      itemFields(form as unknown as HTMLElement, item.id);

      input(form, "db-field-item-capture-multiplier", "2");
      expect(store.getCurrent().database.items.find((record) => record.id === item.id)?.captureProfile).toEqual({ multiplier: 2, ballClass: "great" });

      change(form, "db-field-item-ball-class", "ultra");
      expect(store.getCurrent().database.items.find((record) => record.id === item.id)?.captureProfile).toEqual({ multiplier: 2, ballClass: "ultra" });
    });

    it("accepts every Gen1 field through the AI DB tool schemas and normalizers", () => {
      const context: ToolContext = { project: createBlankProject() };
      const skillId = context.project.database.skills[0]?.id ?? "";
      const stateId = context.project.database.states[0]?.id ?? "";
      const troopId = context.project.database.troops[0]?.id ?? "";

      expect(runTool(context, "upsert_skill", { skill: { id: skillId, maxPp: 150, gen1CriticalRate: "high" } }, { dryRun: false }).ok).toBe(true);
      expect(runTool(context, "upsert_state", { state: { id: stateId, gen1MajorStatus: "sleep" } }, { dryRun: false }).ok).toBe(true);
      expect(runTool(context, "upsert_troop", { troop: { id: troopId, trainerBattle: true } }, { dryRun: false }).ok).toBe(true);
      expect(runTool(context, "upsert_item", {
        item: { id: "item_capture_orb", captureProfile: { multiplier: 2, ballClass: "ultra" } },
      }, { dryRun: false }).ok).toBe(true);
      expect(runTool(context, "upsert_item", {
        item: { id: "item_capture_orb", captureProfile: { ballClass: "great" } },
      }, { dryRun: false }).ok).toBe(true);

      expect(context.project.database.skills.find((record) => record.id === skillId)).toMatchObject({ maxPp: 99, gen1CriticalRate: "high" });
      expect(context.project.database.states.find((record) => record.id === stateId)?.gen1MajorStatus).toBe("sleep");
      expect(context.project.database.troops.find((record) => record.id === troopId)?.trainerBattle).toBe(true);
      expect(context.project.database.items.find((record) => record.id === "item_capture_orb")?.captureProfile).toEqual({ multiplier: 2, ballClass: "great" });
    });
  });
  function byTestId(root: FakeElement, testid: string): FakeElement {
    const found = findByTestId(root, testid);
    if (!found) throw new Error(`missing test id ${testid}`);
    return found;
  }
  function input(root: FakeElement, testid: string, value: string): void {
    const node = byTestId(root, testid);
    node.value = value;
    node.dispatchEvent(new Event("input"));
  }
  function change(root: FakeElement, testid: string, value: string): void {
    const node = byTestId(root, testid);
    node.value = value;
    node.dispatchEvent(new Event("change"));
  }
});

describe("i18n", () => {
  isolateTimers();
  describe("resolveLocale", () => {
    it("picks the first supported browser language", () => {
      expect(resolveLocale({ languages: ["ja-JP", "en-US"] })).toBe("ja");
      expect(resolveLocale({ languages: ["fr-FR", "zh-CN"] })).toBe("zh");
      expect(resolveLocale({ languages: ["ko-KR"] })).toBe("ko");
    });

    it("falls back to English for unsupported languages", () => {
      expect(resolveLocale({ languages: ["fr-FR", "de"] })).toBe("en");
      expect(resolveLocale({ languages: [] })).toBe("en");
    });

    it("maps traditional Chinese tags to the Chinese catalog", () => {
      expect(matchSupportedLocale("zh-TW")).toBe("zh");
      expect(matchSupportedLocale("zh_Hant_HK")).toBe("zh");
    });

    it("prefers query over saved choice over browser, and ignores malformed values", () => {
      expect(resolveLocale({ queryLang: "ja", saved: "zh", languages: ["en"] })).toBe("ja");
      expect(resolveLocale({ saved: "zh", languages: ["en"] })).toBe("zh");
      expect(resolveLocale({ saved: "xx", languages: ["ja"] })).toBe("ja");
      expect(resolveLocale({ queryLang: "", saved: "", languages: ["ko"] })).toBe("ko");
    });

    it("keeps automation browsers on Korean unless detection is forced", () => {
      expect(resolveLocale({ languages: ["en-US"], automation: true })).toBe("ko");
      expect(resolveLocale({ languages: ["en-US"], automation: true, forceDetect: true })).toBe("en");
      expect(resolveLocale({ saved: "ja", languages: ["en-US"], automation: true })).toBe("ja");
    });
  });
  describe("editorIntlLocale", () => {
    const day = new Date(2026, 6, 11, 10, 0, 0);
    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric", weekday: "short" };

    it("keeps Korean dates on ko-KR and uses the chosen language otherwise", () => {
      expect(editorIntlLocale("ko")).toBe("ko-KR");
      expect(editorIntlLocale("en")).toBe("en");
      expect(editorIntlLocale("ja")).toBe("ja");
      expect(editorIntlLocale("zh")).toBe("zh-CN");
      const ko = day.toLocaleDateString(editorIntlLocale("ko"), options);
      const en = day.toLocaleDateString(editorIntlLocale("en"), options);
      const ja = day.toLocaleDateString(editorIntlLocale("ja"), options);
      const zh = day.toLocaleDateString(editorIntlLocale("zh"), options);
      expect(ko).toBe(day.toLocaleDateString("ko-KR", options));
      expect(ko).toMatch(/2026년/);
      expect(en).toMatch(/July/);
      expect(en).toMatch(/2026/);
      expect(ja).toMatch(/2026年7月11日/);
      expect(zh).toMatch(/2026年7月11日/);
      for (const label of [en, ja, zh]) expect(label).not.toMatch(/[가-힣]/);
    });
  });
  describe("createTranslator", () => {
    const translator = createTranslator({
      "보기": "View",
      "맵 {0}개": "{0} maps",
      "{0}개": "{0} items",
      "\"{0}\" 와 일치하는 {1} 레코드가 없습니다.": "No {1} records match \"{0}\".",
      "아이템": "Item",
    });

    it("translates exact strings with whitespace folded", () => {
      expect(translator.translate("보기")).toBe("View");
      expect(translator.translate("  보기 \n")).toBe("View");
    });

    it("fills templates, preferring the most specific one and reordering slots", () => {
      expect(translator.translate("맵 12개")).toBe("12 maps");
      expect(translator.translate("7개")).toBe("7 items");
      expect(translator.translate("\"숲\" 와 일치하는 아이템 레코드가 없습니다.")).toBe("No Item records match \"숲\".");
    });

    it("rejects a short template that would leave a mostly-Korean sentence half translated", () => {
      const partial = createTranslator({ "{0} 용어": "{0} terms" });
      expect(partial.translate("타일 팔레트와 맵 트리 · 쉬운 용어")).toBeNull();
      expect(partial.translate("17 용어")).toBe("17 terms");
    });

    it("translates middle-dot joined labels piece by piece and keeps unknown pieces", () => {
      const pieces = createTranslator({ "칠하기": "Paint", "바닥": "Ground" });
      expect(pieces.translate("칠하기 · 바닥")).toBe("Paint · Ground");
      expect(pieces.translate("바닥 · 흙길 중앙")).toBe("Ground · 흙길 중앙");
      expect(pieces.translate("흙길 · 중앙")).toBeNull();
      // 빈 탭 이름처럼 공백 없이 붙인 나열도 조각마다 찾는다.
      expect(pieces.translate("칠하기·바닥")).toBe("Paint·Ground");
      const tooltip = createTranslator({ "칠하기": "Paint", "고른 타일로 칠합니다": "Paints with the chosen tile" });
      expect(tooltip.translate("칠하기 (B) — 고른 타일로 칠합니다")).toBe("Paint (B) — Paints with the chosen tile");
    });

    it("leaves unknown or non-Korean text alone", () => {
      expect(translator.translate("주인공이 마을에 도착했다")).toBeNull();
      expect(translator.translate("Ctrl+K")).toBeNull();
    });
  });
  describe("shipped catalogs", () => {
    const placeholders = (text: string): string[] => (text.match(/\{\d+\}/g) ?? []).sort();

    it("keep every placeholder of the Korean source", () => {
      for (const catalog of [en, ja, zh] as Record<string, string>[]) {
        const broken = Object.entries(catalog).filter(([source, target]) => placeholders(source).join() !== placeholders(target).join());
        expect(broken).toEqual([]);
      }
    });

    it("never wrap a translation in quotes the Korean source does not have", () => {
      // 2026-09-28: 일괄 생성 한 묶음(「모습 미선택」…「목장 울타리」 등 43개)이 "List" 처럼 따옴표째 들어가 화면에 그대로 보였다.
      for (const catalog of [en, ja, zh] as Record<string, string>[]) {
        const quoted = Object.entries(catalog).filter(([source, target]) => /^".*"$/.test(target) && !/^".*"$/.test(source));
        expect(quoted).toEqual([]);
      }
    });

    it("translate the View menu and its language group", () => {
      expect(createTranslator(en).translate("보기")).toBe("View");
      expect(createTranslator(ja).translate("언어")).toBeTruthy();
      expect(createTranslator(zh).translate("언어")).toBeTruthy();
    });

    it("translates actor, class, and character appearance small-task refusals", () => {
      const refusals = [
        "범위 밖 요청이에요. 주인공 항목을 선택해 주세요.",
        "범위 밖 요청이에요. 선택한 항목을 다시 골라 주세요.",
        "이름을 입력해 주세요.",
        "연결할 직업을 자료집에서 찾을 수 없어요.",
        "시작 레벨은 최고 레벨 이하여야 해요.",
        "연결할 캐릭터 외형을 찾을 수 없어요.",
        "99레벨 최대 체력은 1레벨 최대 체력 이상이어야 해요.",
        "99레벨 최대 체력은 98레벨 최대 체력 이상이어야 해요.",
        "걷기 그림을 먼저 연결해 주세요.",
        "외형에 넣을 이름, 설명이나 그림 칸을 확인해 주세요.",
        "그림을 찾을 수 없거나 외형 칸에 맞지 않아요.",
        "새 주인공이 대사에서 이미 쓰는 번호에 들어가요. 대사의 주인공 번호를 먼저 확인해 주세요.",
        "바꿀 내용을 입력해 주세요.",
        "대사에 이 이름과 연결된 화자가 있어요. 대사의 화자를 먼저 확인해 주세요.",
        "사용 중인 직업 항목이에요. 다른 곳의 연결을 먼저 해제해 주세요.",
        "다른 설정이나 이벤트, 스크립트에서 쓰는 자료집 항목은 삭제할 수 없습니다.",
        "열린 이벤트에서 새 항목의 식별자를 사용하고 있어요. 이벤트를 먼저 확인해 주세요.",
        "이 주인공을 지우면 대사에 나오는 이름이 바뀌거나 사라져요. 대사의 주인공 번호를 먼저 확인해 주세요.",
        "대사에서 이름으로 사용하는 캐릭터 외형 항목이에요. 대사의 화자를 먼저 확인해 주세요.",
        "주인공에게 연결할 직업을 먼저 만들어 주세요.",
      ];
      for (const catalog of [en, ja, zh]) {
        const translator = createTranslator(catalog);
        for (const refusal of refusals) {
          const message = translator.translate(refusal);
          expect(message, refusal).toBeTruthy();
          expect(message).not.toMatch(/[가-힣]/u);
        }
      }
    });

    it("translates map-content shift separately from view pan and map scroll", () => {
      // 「맵 밀기」는 타일·이벤트·시작 위치를 칸 단위로 옮긴다. 화면 밀기(pan)나 맵 스크롤 명령이 아니다.
      const note = MAP_SHIFT_NOTE;
      expect(en["맵 밀기"]).toBe("Shift map contents");
      expect(ja["맵 밀기"]).toBe("マップ内容をずらす");
      expect(zh["맵 밀기"]).toBe("移动地图内容");
      expect(en["맵 밀기"]).not.toBe(en["맵 화면 이동"]);
      expect(ja["맵 밀기"]).not.toBe(ja["맵 스크롤"]);
      expect(zh["맵 밀기"]).not.toBe(zh["맵 화면 이동"]);
      expect(en["맵 밀기"].toLowerCase()).not.toMatch(/pan|scroll/);
      expect(ja["맵 밀기"]).not.toContain("スクロール");
      expect(createTranslator(en).translate(note)).toBe(en[note]);
      expect(createTranslator(ja).translate(note)).toBe(ja[note]);
      expect(createTranslator(zh).translate(note)).toBe(zh[note]);
      expect(en[note]).toMatch(/tiles/i);
      expect(ja[note]).toContain("マス");
      expect(zh[note]).toContain("图块");
    });

    it("calls the ground layer 地上 in Japanese, not battle or a garbled reading", () => {
      // 바닥과 배틀은 글자가 비슷해 명령 팔레트·레이어 필터·타일 변경 안내가 バトル / バーゾリアル 로 나갔다.
      // 짧은 라벨 「바닥」과 같은 낱말(地上)을 쓴다.
      expect(ja["바닥"]).toBe("地上");
      expect(ja["레이어: 바닥"]).toBe("レイヤー: 地上");
      expect(ja["레이어 필터: 바닥(하위) 타일만"]).toBe("レイヤーフィルター: 地上(下位)タイルのみ");
      expect(ja["맵 한 칸의 바닥이나 상위 타일을 바꿉니다."]).toBe("マップ1マスの地上または上部タイルを変更します。");
      expect(ja["맵 한 칸의 바닥이나 상위 타일을 바꿉니다. 비우기를 누르면 그 칸을 지웁니다."]).toBe(
        "マップ1マスの地上または上部タイルを変更します。クリアを押すとそのマスを消します。",
      );
      for (const value of [
        ja["레이어: 바닥"],
        ja["레이어 필터: 바닥(하위) 타일만"],
        ja["맵 한 칸의 바닥이나 상위 타일을 바꿉니다."],
        ja["맵 한 칸의 바닥이나 상위 타일을 바꿉니다. 비우기를 누르면 그 칸을 지웁니다."],
      ]) {
        expect(value).not.toMatch(/バトル|バーゾリアル/);
      }
      expect(createTranslator(ja).translate("레이어: 바닥")).toBe("レイヤー: 地上");
      expect(createTranslator(ja).translate("맵 한 칸의 바닥이나 상위 타일을 바꿉니다.")).toBe(
        "マップ1マスの地上または上部タイルを変更します。",
      );
    });

    it("calls the lower map layer the ground layer, not a child or subordinate", () => {
      // 타일셋 필터·홈 레이어의 「하위」는 바닥 레이어다. 하위 맵·하위 조건의 자식 뜻과 갈라진다.
      expect(en["하위"]).toBe("Ground");
      expect(ja["하위"]).toBe("地上");
      expect(zh["하위"]).toBe("地面");
      expect(en["하위"]).toBe(en["바닥"]);
      expect(ja["하위"]).toBe(ja["바닥"]);
      expect(zh["하위"]).toBe(zh["바닥"]);

      const layerKeys = [
        "하위 + 받침",
        "하위 = 초록 테두리",
        "하위 고정",
        "하위 레이어",
        "하위 레이어 타일 — 하위 레이어 편집으로 전환",
        "하위 레이어 타일만 강조",
        "하위 레이어에서 자유롭게 칠하면 가장자리와 중앙이 자동으로 이어지는 물 지형입니다.",
        "하위 레이어에서 자유롭게 칠하면 모서리, 변, 중앙이 자동으로 이어지는 길 지형입니다.",
        "하위·상위 전부 표시",
        "투명 하위 유지",
        "투명 하위(받침 없음)",
        "이 타일의 홈 레이어를 하위로 확정",
        "받침 있는 하위",
        "하위만",
      ] as const;
      for (const key of layerKeys) {
        expect(en[key], key).not.toMatch(/\bsub\b/i);
        expect(en[key], key).toMatch(/ground/i);
        expect(ja[key], key).not.toMatch(/下位|子/);
        expect(ja[key], key).toContain("地上");
        expect(zh[key], key).not.toMatch(/子级|子图/);
        expect(zh[key], key).toContain("地面");
      }

      expect(createTranslator(en).translate("하위 레이어 타일만 강조")).toBe("Highlight ground-layer tiles only");
      expect(createTranslator(ja).translate("하위·상위 전부 표시")).toBe("地上・上位をともに表示");
      expect(createTranslator(zh).translate("하위 고정")).toBe("固定地面");

      // 같은 낱말이 자식·하위를 뜻하는 곳은 그대로다.
      expect(en["하위 {0}"]).toBe("{0} sub");
      expect(ja["하위 {0}"]).toBe("下位 {0}");
      expect(zh["하위 {0}"]).toBe("子级 {0}");
      expect(en["하위 맵"]).toBe("Sub-map");
      expect(ja["하위 맵"]).toBe("サブマップ");
      expect(zh["하위 맵"]).toBe("子地图");
      expect(en["하위 조건"]).toBe("Sub-conditions");
      expect(createTranslator(en).translate("하위 3")).toBe("3 sub");
    });

    it("uses a singular English count for one map event and one door", () => {
      // 맵 트리 메타는 「20×15 · 이벤트 1개 · 문 1개」를 조각으로 번역한다.
      // 한 줄로 붙으면 `{0}×{1} · 이벤트 {2}` 가 개수를 삼켜 "Events 1" 이 된다.
      const translator = createTranslator(en);
      expect(translator.translate("이벤트 1개")).toBe("1 event");
      expect(translator.translate("이벤트 2개")).toBe("2 events");
      expect(translator.translate("이벤트 0개")).toBe("0 events");
      expect(translator.translate("문 1개")).toBe("1 door");
      expect(translator.translate("문 2개")).toBe("2 doors");
      expect(translator.translate("문 0개")).toBe("0 doors");
    });

    it("calls terrain reachability a passability preview, not vehicle traffic or a corridor", () => {
      // 지형 도구의 통행 미리보기는 시작 위치에서 걸어 닿는 땅을 칠한다. 차 흐름(traffic)도, 복도(passage)도 아니다.
      const sentence = "경사로·기물, 지형 설계, 통행 미리보기는 아래 도구에서 고릅니다.";
      expect(en["통행"]).toBe("Passability");
      expect(en["통행 보기"]).toBe("View passability");
      expect(en["통행 미리보기"]).toBe("Passability preview");
      expect(en[sentence]).toBe("Choose ramps/props, terrain design, and passability preview from the tools below.");
      expect(en["통행 미리보기"].toLowerCase()).not.toMatch(/traffic|\bpassage\b/);
      expect(en[sentence].toLowerCase()).not.toMatch(/traffic|\bpassage\b/);
      expect(ja["통행 보기"]).toBe("通行を見る");
      expect(ja["통행 미리보기"]).toBe("通行プレビュー");
      expect(ja[sentence]).toContain("通行");
      expect(zh["통행 보기"]).toBe("查看通行");
      expect(zh["통행 미리보기"]).toBe("通行预览");
      expect(zh[sentence]).toContain("通行");
      expect(createTranslator(en).translate("통행 보기")).toBe("View passability");
      expect(createTranslator(en).translate("통행 미리보기")).toBe("Passability preview");
      expect(createTranslator(en).translate(sentence)).toBe(en[sentence]);
      expect(createTranslator(ja).translate("통행 보기")).toBe("通行を見る");
      expect(createTranslator(zh).translate("통행 미리보기")).toBe("通行预览");
    });

    it("names the loop-body controls instead of a bare multiplication sign", () => {
      expect(en["이 반복 명령 삭제"]).toBe("Delete this repeated command");
      expect(ja["이 반복 명령 삭제"]).toBe("この繰り返しコマンドを削除");
      expect(zh["이 반복 명령 삭제"]).toBe("删除此循环命令");
      expect(en["추가할 명령"]).toBe("Command to add");
      expect(ja["추가할 명령"]).toBe("追加するコマンド");
      expect(zh["추가할 명령"]).toBe("要添加的指令");
      expect(en["반복 문장"]).toBe("Repeated line");
      expect(ja["반복 문장"]).toBe("繰り返しの文");
      expect(zh["반복 문장"]).toBe("循环句子");
      expect(createTranslator(en).translate("이 반복 명령 삭제")).toBe("Delete this repeated command");
      expect(createTranslator(ja).translate("추가할 명령")).toBe("追加するコマンド");
      expect(createTranslator(zh).translate("반복 문장")).toBe("循环句子");
    });

    it("names a map's parent separately from the upper tile layer, and its vertical size as height", () => {
      // 새 맵 칸의 글자가 「상위」·「세로」이면 영어는 Upper layer·Vertical, 일본어는 上位·縦,
      // 중국어는 上层·纵向가 된다. 부모 맵과 칸수에는 그 낱말을 쓰지 않는다.
      expect(en["상위"]).toBe("Upper layer");
      expect(ja["상위"]).toBe("上位");
      expect(zh["상위"]).toBe("上层");
      expect(en["상위 맵"]).toBe("Parent map");
      expect(ja["상위 맵"]).toBe("上位マップ");
      expect(zh["상위 맵"]).toBe("上级地图");
      expect(en["세로"]).toBe("Vertical");
      expect(ja["세로"]).toBe("縦");
      expect(zh["세로"]).toBe("纵向");
      expect(en["높이"]).toBe("Height");
      expect(ja["높이"]).toBe("高さ");
      expect(zh["높이"]).toBe("高度");
      const english = createTranslator(en);
      const japanese = createTranslator(ja);
      const chinese = createTranslator(zh);
      expect(english.translate("상위 맵")).toBe("Parent map");
      expect(english.translate("상위 맵")).not.toBe(english.translate("상위"));
      expect(japanese.translate("상위 맵")).toBe("上位マップ");
      expect(chinese.translate("상위 맵")).toBe("上级地图");
      expect(english.translate("높이")).toBe("Height");
      expect(japanese.translate("높이")).toBe("高さ");
      expect(chinese.translate("높이")).toBe("高度");
      // 기본 선택 값은 「그 맵의 자식으로 둔다」이다. Submaps of 는 목록처럼 읽힌다.
      expect(en["{0}의 하위"]).toBe("Child of {0}");
      expect(english.translate("빈 맵의 하위")).toBe("Child of Empty map");
    });

    it("describes right-drag region select as a release, not placing an object", () => {
      // 도움말의 우클릭 드래그. 「놓으면」은 드래그를 떼는 것이고, 그 뒤에 뜨는 동작은
      // AI 작업·복사·지우기·구조물로 저장이다. 「저장」은 구조물에만 붙는다.
      const hint = "영역 선택 — 놓으면 AI 작업·복사·지우기·구조물로 저장";
      expect(en[hint]).toBe("Select region — when you release: 「AI task」, copy, erase, and 「Save as structure」");
      expect(en[hint].toLowerCase()).not.toMatch(/placed|save as ai/);
      expect(ja[hint]).toBe("範囲選択 — 離すと「AIタスク」·コピー·消去·「構造物として保存」");
      expect(ja[hint]).not.toMatch(/配置|リージョン/);
      expect(zh[hint]).toBe("选择区域 — 松开后：「AI 任务」·复制·擦除·「保存为结构物」");
      expect(zh[hint]).not.toMatch(/放置|保存为AI/);
      expect(createTranslator(en).translate(hint)).toBe(en[hint]);
      expect(createTranslator(ja).translate(hint)).toBe(ja[hint]);
      expect(createTranslator(zh).translate(hint)).toBe(zh[hint]);
    });

    it("calls a dragged rectangle a range in Japanese, and keeps region ids as リージョン", () => {
      // 「영역」은 맵에서 드래그한 사각형(선택 도구 V, 채우기·복사·AI 작업)이다.
      // 맵에 칠하는 지역 번호만 リージョン 이다. 도구 이름이 リージョン選択 이면 지역 번호 도구로 읽힌다.
      const regionIds = "맵에 칠해 둔 지역 번호를 밟았을 때 이벤트를 부르거나 스위치를 켜도록 연결합니다. 지역 번호를 칠하는 것은 맵 편집 화면에서 합니다.";
      expect(ja["영역"]).toBe("範囲");
      expect(ja["영역 선택"]).toBe("範囲選択");
      expect(ja["영역 선택"]).toBe(ja["영역 선택 — 놓으면 AI 작업·복사·지우기·구조물로 저장"].split(" — ")[0]);
      expect(ja["선택 영역"]).toBe("選択範囲");
      expect(ja["영역 채우기"]).toBe("範囲を塗りつぶす");
      expect(ja["영역 표시"]).toBe("範囲を強調");
      expect(ja["영역 표시"]).not.toBe(ja["영역 보기"]);
      expect(ja[regionIds]).toContain("リージョン番号");
      const japanese = createTranslator(ja);
      const rectangle = Object.entries(ja).filter(([source]) => source.includes("영역"));
      expect(rectangle.length).toBeGreaterThan(0);
      for (const [source, target] of rectangle) {
        expect(target, source).not.toContain("リージョン");
        expect(japanese.translate(source), source).toBe(target);
      }
      expect(japanese.translate(regionIds)).toContain("リージョン");
    });

    it("calls furniture push directions a push, not a camera pan", () => {
      // 이벤트 「물체 동작」의 체크박스는 가구를 미는 방향이다.
      // 「왼쪽」+「로」는 「왼쪽로」가 되고, 「{0}로 밀기」는 화면 밀기(Pan/スクロール/平移)로 읽혔다.
      const labels = ["위로 밀기", "아래로 밀기", "왼쪽으로 밀기", "오른쪽으로 밀기"] as const;
      expect(createTranslator(en).translate("위로 밀기")).toBe("Push up");
      expect(createTranslator(en).translate("아래로 밀기")).toBe("Push down");
      expect(createTranslator(en).translate("왼쪽으로 밀기")).toBe("Push left");
      expect(createTranslator(en).translate("오른쪽으로 밀기")).toBe("Push right");
      expect(createTranslator(ja).translate("위로 밀기")).toBe("上へ押す");
      expect(createTranslator(ja).translate("아래로 밀기")).toBe("下へ押す");
      expect(createTranslator(ja).translate("왼쪽으로 밀기")).toBe("左へ押す");
      expect(createTranslator(ja).translate("오른쪽으로 밀기")).toBe("右へ押す");
      expect(createTranslator(zh).translate("위로 밀기")).toBe("向上推");
      expect(createTranslator(zh).translate("아래로 밀기")).toBe("向下推");
      expect(createTranslator(zh).translate("왼쪽으로 밀기")).toBe("向左推");
      expect(createTranslator(zh).translate("오른쪽으로 밀기")).toBe("向右推");
      for (const label of labels) {
        expect(createTranslator(en).translate(label)?.toLowerCase()).not.toMatch(/pan|scroll/);
        expect(createTranslator(ja).translate(label)).not.toContain("スクロール");
        expect(createTranslator(zh).translate(label)).not.toContain("平移");
      }
      expect(en["{0}로 밀기"].toLowerCase()).not.toMatch(/pan|scroll/);
      expect(ja["{0}로 밀기"]).not.toContain("スクロール");
      expect(zh["{0}로 밀기"]).not.toContain("平移");
    });

    it("keeps item and actor picker empty copy translated after the batchim particle", () => {
      const english = createTranslator(en);
      expect(english.translate("아이템이 아직 없습니다.")).toBe("Item not yet available.");
      expect(english.translate("주인공이 아직 없습니다.")).toBe("Actor not yet available.");
      expect(english.translate("스위치가 아직 없습니다.")).toBe("Switch not yet available.");
      expect(english.translate('"없는물건" 과 일치하는 아이템이 없습니다.')).toBe('No Item matches "없는물건".');
      expect(english.translate('"가나" 와 일치하는 스위치가 없습니다.')).toBe('No Switch matches "가나".');
      expect(createTranslator(ja).translate("아이템이 아직 없습니다.")).toBe("アイテム がまだありません。");
      expect(createTranslator(zh).translate("주인공이 아직 없습니다.")).toBe("还没有 角色。");
    });

    it("calls a number-input digit a digit, and one digit stays singular in English", () => {
      // 숫자 입력 미리보기의 「N자리 · 대기 중」은 자릿수다. 좌석이 아니다.
      expect(createTranslator(en).translate("1자리 · 대기 중")).toBe("1 digit · waiting");
      expect(createTranslator(en).translate("4자리 · 대기 중")).toBe("4 digits · waiting");
      expect(en["{0}자리 · 대기 중"]).not.toMatch(/seat/i);
      expect(createTranslator(ja).translate("1자리 · 대기 중")).toBe("1桁 · 待機中");
      expect(createTranslator(ja).translate("4자리 · 대기 중")).toBe("4桁 · 待機中");
      expect(ja["{0}자리 · 대기 중"]).not.toContain("席");
      expect(createTranslator(zh).translate("1자리 · 대기 중")).toBe("1位 · 等待中");
      expect(createTranslator(zh).translate("4자리 · 대기 중")).toBe("4位 · 等待中");
      expect(zh["{0}자리 · 대기 중"]).not.toContain("名额");
    });
  });
});

describe("mapEventSearchModel", () => {
  isolateTimers();
  function event(id: string, name: string, commands: GameEvent["commands"] = []): GameEvent {
    return {
      id,
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands,
      pages: [
        {
          id: `${id}_page_1`,
          name,
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands,
        },
      ],
    };
  }
  function fixture(): Project {
    const project = createBlankProject();
    const start = project.maps[project.startMapId]!;
    start.name = "햇살 마을";
    start.events = [event("ev_gate", "북문 수문장")];

    const forest = createBlankMap("Moonlit Forest", 12, 12);
    forest.id = "map_moonlit_forest";
    forest.events = [
      event("ev_owl", "Night Owl", [{ kind: "setSwitch", switchId: "sw_moon_gate", value: true }]),
    ];
    project.maps[forest.id] = forest;
    project.switches = [{ id: "sw_moon_gate", name: "Moon Gate Open" }];
    project.variables = [{ id: "var_moon_count", name: "Moon Count" }];
    project.commonEvents = [{ id: "common_moon", name: "Moon Cycle", trigger: "none", commands: [] }];
    return project;
  }
  describe("mapEventSearchModel", () => {
    it("맵 이름 부분 일치 결과에 이동할 mapId를 담는다", () => {
      const project = fixture();
      const results = searchProject({ project, selectedMapId: project.startMapId, query: "Forest", scope: "all" });

      expect(results).toContainEqual(expect.objectContaining({
        kind: "map",
        name: "Moonlit Forest",
        target: { kind: "map", mapId: "map_moonlit_forest" },
      }));
    });

    it("모든 페이지의 이벤트 이름을 찾고 mapId와 eventId를 담는다", () => {
      const project = fixture();
      const results = searchProject({ project, selectedMapId: project.startMapId, query: "owl", scope: "all" });

      expect(results).toContainEqual(expect.objectContaining({
        kind: "mapEvent",
        name: "Night Owl",
        target: { kind: "event", mapId: "map_moonlit_forest", eventId: "ev_owl" },
      }));
    });

    it("스위치 이름과 id를 찾고 참조하는 맵 이벤트를 함께 돌려준다", () => {
      const project = fixture();
      const [result] = searchProject({ project, selectedMapId: project.startMapId, query: "sw_moon", scope: "all" })
        .filter((entry) => entry.kind === "switch");

      expect(result).toEqual(expect.objectContaining({
        kind: "switch",
        name: "Moon Gate Open",
        references: [expect.objectContaining({ mapId: "map_moonlit_forest", eventId: "ev_owl" })],
      }));
    });

    it("빈 질의는 결과를 돌려주지 않는다", () => {
      const project = fixture();
      expect(searchProject({ project, selectedMapId: project.startMapId, query: "   ", scope: "all" })).toEqual([]);
    });

    it("대소문자를 무시해 맵·이벤트·공통 이벤트·변수 이름을 찾는다", () => {
      const project = fixture();
      project.maps.map_moonlit_forest!.events[0]!.pages![0]!.commands = [
        { kind: "setVariable", variableId: "var_moon_count", op: "=", value: 1 },
      ];
      const results = searchProject({ project, selectedMapId: project.startMapId, query: "MOON", scope: "all" });
      const eventResults = searchProject({ project, selectedMapId: project.startMapId, query: "NIGHT OWL", scope: "all" });

      expect(results.map((result) => result.kind)).toEqual(expect.arrayContaining([
        "map",
        "commonEvent",
        "variable",
      ]));
      expect(eventResults).toContainEqual(expect.objectContaining({ kind: "mapEvent", name: "Night Owl" }));
    });

    it("페이지 제목과 다른 이벤트 이름(GameEvent.name)으로 찾고, 참조 라벨도 그 이름을 쓴다", () => {
      const project = fixture();
      const gate = project.maps[project.startMapId]!.events[0]!;
      gate.name = "문지기 한솔";
      gate.pages![0]!.name = "페이지 1";
      gate.pages![0]!.commands = [{ kind: "setSwitch", switchId: "sw_moon_gate", value: true }];

      const byName = searchProject({ project, selectedMapId: project.startMapId, query: "한솔", scope: "selectedMap" });
      const byId = searchProject({ project, selectedMapId: project.startMapId, query: "ev_gate", scope: "selectedMap" });
      const bySwitch = searchProject({ project, selectedMapId: project.startMapId, query: "sw_moon_gate", scope: "all" })
        .find((entry) => entry.kind === "switch");

      expect(byName).toEqual([expect.objectContaining({
        kind: "mapEvent",
        name: "문지기 한솔",
        target: { kind: "event", mapId: project.startMapId, eventId: "ev_gate" },
      })]);
      expect(byId).toEqual([expect.objectContaining({ kind: "mapEvent", name: "문지기 한솔" })]);
      expect(bySwitch?.kind).toBe("switch");
      if (bySwitch?.kind !== "switch") return;
      expect(bySwitch.references).toContainEqual(expect.objectContaining({ eventId: "ev_gate", name: "문지기 한솔" }));
      expect(byName.some((entry) => entry.name === "페이지 1")).toBe(false);
    });
  });
});

describe("mapTreeAiBadges", () => {
  isolateTimers();
  const maps = new Set(["map_a", "map_b", "map_c"]);
  const isMap = (id: string) => maps.has(id);
  function ticket(id: number, mapKey: string, status: MapRunTicket["status"], extra: Partial<MapRunTicket> = {}): MapRunTicket {
    return { id, mapKey, exclusive: false, foreground: false, label: `요청 ${id}`, status, wait: status === "waiting" ? "same-map" : null, ahead: 0,
      enqueuedAt: 0, startedAt: null, endedAt: null, error: null, ...extra };
  }
  function presence(extra: Partial<Presence>): Presence {
    return { id: "p", source: "chat", name: "조수", readsOnly: false, no: 1, tone: 0, state: "working", mapId: null, mapName: null, task: "",
      action: "", steps: 0, startedAt: undefined, recent: [], ...extra };
  }
  describe("mapAiBadges", () => {
    it("shows who holds a map and which maps are waiting for its lock", () => {
      const badges = mapAiBadges([], [ticket(1, "map_a", "running"), ticket(2, "map_a", "waiting"), ticket(3, "map_a", "waiting", { ahead: 1 })], isMap);
      expect(badges.get("map_a")!.map((b) => [b.kind, b.text])).toEqual([["working", "조수 작업 중"], ["waiting", "대기 2"]]);
      const queued = mapAiBadges([], [ticket(4, "map_b", "waiting", { wait: "exclusive" })], isMap);
      expect(queued.get("map_b")!.map((b) => [b.kind, b.text])).toEqual([["waiting", "잠금 대기"]]);
    });

    it("names the team worker that owns a map, with its job colour", () => {
      const badges = mapAiBadges([presence({ name: "시공 1", tone: 1, mapId: "map_b" }), presence({ id: "r", name: "검수", readsOnly: true, mapId: "map_c" })], [], isMap);
      expect(badges.get("map_b")).toEqual([expect.objectContaining({ kind: "working", text: "시공 1 작업 중", tone: 1 })]);
      expect(badges.has("map_c")).toBe(false);
    });

    it("does not badge project-wide or exclusive (team) queue keys", () => {
      const badges = mapAiBadges([], [ticket(1, "__project__", "running"), ticket(2, "map_c", "running", { exclusive: true })], isMap);
      expect(badges.size).toBe(0);
    });
  });
});
