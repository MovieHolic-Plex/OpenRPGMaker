// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi, beforeAll } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { mixedFixture } from "./support/spatialMixedFixture";
import { bindSpatialAuthoringControllerFactory, clearAuthoringSession, visibleAuthoringProject, previewAuthoringDraft, applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { renderSpatialCompositionWorkspace } from "@/editor/panels/spatialCompositionWorkspace";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { editComposition } from "@/editor/panels/spatialCompositionAccess";
import { spatialId, assertNever, findOccurrenceChildId, own } from "@/project/spatial/domain";
import { isolateTimers } from "./mergedTeardown";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import { runTool } from "@/editor/tools";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import { BATTLE_LOOK_PRESET_IDS, BATTLE_LOOK_PRESETS, normalizeBattleLook, patchBattleLook, resolveBattleLook } from "@/project/battleLook";
import { resolveFontStack } from "@/project/fontRegistry";
import { appearanceGenerationController } from "@/editor/characterAppearanceGeneration";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { selectCharacterAppearance } from "@/editor/panels/databaseAppearanceView";
import { ensureCurrentMonsterArt, hasCurrentMonsterArt, isCurrentMonsterArt, preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { pixelEnemySheet, setPixelEnemySheetProjectSource, PIXEL_ENEMY_SHEETS } from "@/assets/pixelEnemySheets";
import { enemyPixelCellOrder, renderEnemyPixelPreview } from "@/editor/panels/databaseEnemyPixelPreview";
import { applyCurrentMonsterStandIns, standInOriginalArt } from "@/project/defaults/currentMonsterStandIns";
import type { Project, TilesetDef, EnemyRecord, Command } from "@/project/types";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { commitGeographyEdit, editGeography, geographyFromProject, withGeographyName, type GeographyDraftTarget } from "../src/editor/panels/spatialGeographyDraft";
import { moveGeographyChild, setTerrainAreas } from "../src/editor/panels/spatialGeographyGeometry";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import type { SpatialId } from "../src/project/spatial/types";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { geographyControllerInput } from "./support/spatialGeographyControllerFixture";
import { geographyRoot, geographyWorld } from "./support/spatialGeographyFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { editorState } from "@/editor/editorState";
import { resetScratchConceptTabSession } from "@/editor/panels/scratchConceptTab";
import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import { closeTilesetAiWorkspace, isTilesetAiWorkspaceOpen, openTilesetAiWorkspace } from "@/editor/panels/tilesetAiWorkspaceModal";
import { renderTilesetsTab } from "@/editor/panels/tilesetSettingsPanel";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { resetTilesetAiReviewSessions, runTilesetAiReview, setTilesetAiReviewAnalyzer } from "@/editor/tilesetAiNativeReviewSession";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { resetTilesetAiConversation } from "@/editor/tilesetAiConversationSession";
import { fieldByTestId as findByTestId, mountField as renderWithFakeDom } from "./helpers/aiTestSignals";
import { walkField, walkSelect, walkGroupComposition } from "@/editor/panels/walkEncounterOptions";
import { renderEnemyRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { battleEventCommandRuntimeSupport, m2CommandRuntimeClassification } from "@/project/eventCommands/runtimeSupport";
import { renderSkillRetroStage } from "@/editor/panels/databaseSkillRetroStage";
import { disposeDatabasePreviewsIn, retainDatabasePreviewsIn, setDatabasePreviewSurfaceActive, setDatabasePreviewsActiveIn } from "@/editor/panels/databasePreviewLifecycle";
import { CONNECTION_COLLECTIONS, createRecordConnectionsReader, recordConnections } from "@/editor/databaseRecordConnections";
import { commandsReferenceLocations, createCommandReferenceLocationsReader } from "@/editor/databaseCommandReferences";
import { createConnectionsPanel } from "@/editor/panels/databaseConnectionsPanel";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { beginEventEditDraft } from "@/project/eventDrafts";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { renderLifeCollectionsTab } from "@/editor/panels/databaseLifeCollectionsView";
import { shouldIgnoreEditorShortcut, historyHotkeyOwnedByPanel } from "@/editor/hotkeys";
import { openHarnessModal } from "@/editor/panels/aiHarnessModal";
import { openToolBrowserModal } from "@/editor/panels/toolBrowserModal";
import { hasOpenModalLayer, resetModalStackForTest } from "@/editor/ui/modalStack";
import { elementDisplayName } from "@/battle/skillHelp";
import { elementGradeWord } from "@/editor/panels/databaseElementPresentation";

describe("editorPanelsSuite29", () => {
  isolateTimers();
  describe("databaseGroupStrip", () => {
    isolateTimers();
    /**
     * 그룹 띠 — 띠를 누르면 옆 목록이 그 그룹 구획으로 바뀐다.
     * 결함(2026-09-28): syncGroupStrip 이 부를 때마다 보는 그룹을 활성 탭의 그룹으로 되돌려,
     * 띠를 눌러도 목록이 그대로였다. 활성 탭이 **바뀐 때만** 따라가야 한다.
     */
    const previous = store.getCurrent();
    function host(): HTMLElement {
      const root = document.createElement("div");
      root.className = "database-modal-body";
      document.body.replaceChildren(root);
      renderDatabasePanel(root);
      return root;
    }
    beforeEach(() => {
      store.replace(createBlankProject(), { preserveEventDrafts: false });
      setDatabaseActiveTab("classes");
    });
    afterEach(() => {
      document.body.replaceChildren();
      store.replace(previous, { preserveEventDrafts: false });
    });
    describe("자료집 단일 통합 레일", () => {
      afterEach(() => {
        window.localStorage.removeItem("oprn:database.railCollapsed");
      });

      it("2단 그룹 띠를 두지 않고 모든 활성 구획 탭을 단일 레일에 한 번에 노출한다", () => {
        const root = host();
        expect(root.querySelector('[data-testid="db-group-strip"]')).toBeNull();
        expect(root.querySelector<HTMLElement>('[data-testid="db-tab-classes"]')).not.toBeNull();
        expect(root.querySelector<HTMLElement>('[data-testid="db-tab-enemies"]')).not.toBeNull();
        expect(root.querySelector<HTMLElement>('[data-testid="db-tab-system"]')).not.toBeNull();
        expect(root.querySelector<HTMLElement>('[data-testid="db-tab-classes"]')?.dataset.inView).toBeUndefined();
        expect(root.querySelector<HTMLElement>('[data-testid="db-tab-enemies"]')?.dataset.inView).toBeUndefined();
      });

      it("메뉴 접기 단추로 196px↔52px 접기를 토글·기억하며 인라인 left 를 쓰지 않는다", () => {
        const root = host();
        const toggle = root.querySelector<HTMLElement>('[data-testid="db-rail-collapse-toggle"]')!;
        const tabs = root.querySelector<HTMLElement>(".db-tabs")!;
        expect(root.dataset.railCollapsed).toBe("0");
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
        expect(tabs.style.left).toBe("");

        toggle.click();
        expect(root.dataset.railCollapsed).toBe("1");
        expect(toggle.getAttribute("aria-expanded")).toBe("false");
        expect(window.localStorage.getItem("oprn:database.railCollapsed")).toBe("1");
        expect(tabs.style.left).toBe("");

        // 접힌 상태에서 검색 입력에 포커스가 가면 자동으로 다시 펼친다.
        root.querySelector<HTMLInputElement>('[data-testid="db-tab-search"]')!.dispatchEvent(new Event("focus"));
        expect(root.dataset.railCollapsed).toBe("0");
        expect(toggle.getAttribute("aria-expanded")).toBe("true");
      });

      it("휴대 폭 상단 바는 바텀 시트를 열고(검색·스크림 포함), 탭을 고르면 닫히며 소속 그룹·탭 이름을 단다", () => {
        const root = host();
        const switcher = root.querySelector<HTMLElement>('[data-testid="db-tab-switcher"]')!;
        expect(switcher.classList.contains("db-tab")).toBe(false);
        expect(switcher.textContent).toContain("파티");
        expect(switcher.textContent).toContain("직업");
        expect(switcher.getAttribute("aria-expanded")).toBe("false");
        switcher.click();
        expect(root.dataset.railOpen).toBe("1");
        expect(switcher.getAttribute("aria-expanded")).toBe("true");
        root.querySelector<HTMLElement>('[data-testid="db-tab-states"]')!.click();
        expect(root.dataset.railOpen).toBe("0");
        expect(switcher.getAttribute("aria-expanded")).toBe("false");
        expect(switcher.textContent).toContain("전투");
        expect(switcher.textContent).toContain("상태");
        expect(switcher.getAttribute("aria-label")).toBe("탭 바꾸기, 지금 상태");

        // 빠른 검색 버튼은 바텀 시트를 열고, 스크림·닫기 단추로 닫는다.
        root.querySelector<HTMLElement>('[data-testid="db-phone-search-btn"]')!.click();
        expect(root.dataset.railOpen).toBe("1");
        root.querySelector<HTMLElement>('[data-testid="db-rail-scrim"]')!.click();
        expect(root.dataset.railOpen).toBe("0");
      });

      it("다른 구획의 탭을 한 번에 누르면 즉시 활성 탭이 바뀐다", () => {
        const root = host();
        root.querySelector<HTMLElement>('[data-testid="db-tab-enemies"]')!.click();
        expect(root.querySelector<HTMLElement>(".db-tab.active")?.dataset.testid).toBe("db-tab-enemies");

        root.querySelector<HTMLElement>('[data-testid="db-tab-system"]')!.click();
        expect(root.querySelector<HTMLElement>(".db-tab.active")?.dataset.testid).toBe("db-tab-system");
      });

      it("프로그램 점프(조수·딥링크)는 새 활성 탭을 즉시 활성화한다", () => {
        setDatabaseActiveTab("skills");
        const rerooted = host();
        expect(rerooted.querySelector<HTMLElement>(".db-tab.active")?.dataset.testid).toBe("db-tab-skills");
      });
    });
  });
  describe("spatialCompositionWorkspace", () => {
    isolateTimers();
    const previous = store.getCurrent();
    beforeEach(() => { clearAuthoringSession(); const fixture = mixedFixture();
      for (const records of [fixture.spatialAuthoring!.library.places, fixture.spatialAuthoring!.library.regions, fixture.spatialAuthoring!.library.worlds]) for (const [id, value] of Object.entries(records)) records[id] = { ...value, composition: { ...value.composition!, tiles: [] } };
      store.replace(fixture, { preserveEventDrafts: false }); bindSpatialAuthoringControllerFactory(createSpatialAuthoringController); });
    afterEach(() => { document.body.replaceChildren(); clearAuthoringSession(); bindSpatialAuthoringControllerFactory(null); store.replace(previous, { preserveEventDrafts: false }); });
    const source = { kind: "space" as const, id: spatialId("room-design") };
    function mount() {
      const render = () => document.body.replaceChildren(renderSpatialCompositionWorkspace({ ...spatialSession(), tab: "spaces" }, { id: "room", name: "Room", kind: "spaces", source: "own", usage: 0, canonicalSource: source }, render));
      render();
    }
    function click(id: string) { document.querySelector<HTMLButtonElement>(`[data-testid='${id}']`)!.click(); }
    it("moves and removes a selected direct member with consecutive keyboard edits, then applies", () => {
      mount();
      document.querySelector<HTMLButtonElement>(".spatial-mixed-member")!.click();
      expect(document.activeElement?.getAttribute("data-testid")).toBe("composition-board");
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[source.id].composition!.members[0].x).toBe(6);
      expect(store.getCurrent().spatialAuthoring!.library.spaces[source.id].composition!.members[0].x).toBe(4);
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
      expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[source.id].composition!.members).toHaveLength(0);
      click("composition-undo");
      expect(visibleAuthoringProject().spatialAuthoring!.library.spaces[source.id].composition!.members).toHaveLength(1);
      expect(previewAuthoringDraft().kind).toBe("ok"); expect(applyAuthoringPreview().kind).toBe("ok");
      expect(store.getCurrent().spatialAuthoring!.library.spaces[source.id].composition!.members[0].x).toBe(6);
    });
    it("rejects shrinking across a child's footprint without poisoning the draft", () => {
      const before = visibleAuthoringProject();
      expect(editComposition(source, value => ({ ...value, height: 7 }))).not.toBeNull();
      expect(visibleAuthoringProject()).toBe(before);
      expect(editComposition(source, value => ({ ...value, width: 22 }))).toBeNull();
      expect(previewAuthoringDraft().kind).toBe("ok");
    });
    it("offers a single place material category in both place editors", () => {
      for (const [kind, id, tab, allowed] of [["space", "room-design", "spaces", ["tile", "object", "place"]], ["place", "inn", "places", ["tile", "object", "place"]], ["region", "town", "regions", ["tile", "object", "place"]], ["world", "world", "worlds", ["tile", "object", "place", "region"]]] as const) {
        const root = renderSpatialCompositionWorkspace({ ...spatialSession(), tab }, { id, name: id, kind: tab, source: "own", usage: 0, canonicalSource: { kind, id: spatialId(id) } }, () => {});
        expect([...root.querySelectorAll("[data-testid^='composition-material-']")].map(el => el.getAttribute("data-testid")!.replace("composition-material-", ""))).toEqual(allowed);
      }
    });
    it("shows both room and building materials together while excluding self and ancestors", () => {
      const render = () => document.body.replaceChildren(renderSpatialCompositionWorkspace({ ...spatialSession(), tab: "regions" }, {
        id: "town", name: "마을", kind: "regions", source: "own", usage: 0, canonicalSource: { kind: "region", id: spatialId("town") },
      }, render));
      render();
      click("composition-material-place");
      expect(document.querySelector("[data-testid='composition-asset-room-design']")).not.toBeNull();
      expect(document.querySelector("[data-testid='composition-asset-inn']")).not.toBeNull();
      expect(document.querySelector("[data-testid='composition-material-space']")).toBeNull();
      mount();
      click("composition-material-place");
      expect(document.querySelector("[data-testid='composition-asset-room-design']")).toBeNull();
      expect(document.querySelector("[data-testid='composition-asset-inn']")).toBeNull();
    });
  });
});

describe("editorPanelsSuite3", () => {
  isolateTimers();
  /**
   * 전투 화면 꾸미기(2026-10-01): system.battleLook = { preset?, 칸별 덮어쓰기 } (project/battleLook.ts).
   * 저장 계약(pixel 프리셋 그대로면 생략·프리셋과 같은 칸은 지움·무효값 버림), 자료집 전투 화면 탭(2026-10-02 시스템 탭에서 옮김), AI set_project_settings battle.look 을 묶는다.
   * 화면 증거는 verify-shots/battle-look/<프리셋>/(player.html 프로브).
   */
  describe("battleLook", () => {
    isolateTimers();
    describe("system.battleLook — 저장 계약", () => {
      it("새 프로젝트는 도트 창 프리셋이고 JSON 에 키가 없다", () => {
        const project = createBlankProject();
        expect(resolveBattleLook(project.system.battleLook).preset).toBe("pixel");
        expect(serialize(project)).not.toContain("battleLook");
      });

      it("프리셋과 바꾼 칸만 왕복을 보존한다", () => {
        const project = createBlankProject();
        project.system.battleLook = { preset: "gold", window: "parch", accent: "#E8A0B8", light: 2 };
        const restored = deserialize(serialize(project)).system.battleLook;
        // light 2 는 gold 프리셋 값이라 저장하지 않는다.
        expect(restored).toEqual({ preset: "gold", window: "parch", accent: "#e8a0b8" });
        const base = createBlankProject();
        expect(normalizeSystemRecords({ ...base.system, battleLook: { preset: "pixel" } }).battleLook).toBeUndefined();
      });

      it("모르는 프리셋·칸 값은 버린다", () => {
        expect(normalizeBattleLook({ preset: "chrome", party: "floating", light: 5, accent: "gold", font: "comic-sans" })).toBeUndefined();
        expect(normalizeBattleLook({ preset: "pop", command: "nowhere" })).toEqual({ preset: "pop" });
      });

      it("프리셋 12종은 모두 풀리고 칸을 바꾸면 사용자 설정이 된다", () => {
        expect(BATTLE_LOOK_PRESET_IDS).toHaveLength(12);
        for (const id of BATTLE_LOOK_PRESET_IDS) {
          const look = resolveBattleLook({ preset: id });
          expect(look.preset).toBe(id);
          expect(look.customized).toBe(false);
          expect(look.window).toBe(BATTLE_LOOK_PRESETS[id].axes.window);
        }
        const custom = resolveBattleLook(patchBattleLook({ preset: "ink" }, { party: "cards" }));
        expect(custom).toMatchObject({ preset: "ink", party: "cards", customized: true });
      });

      it("글꼴: 고르지 않으면 창 꾸밈 기본, 고르면 그 글꼴, 고전 창은 프로젝트 픽셀 글꼴", () => {
        expect(resolveBattleLook({ preset: "ink" }).fontStack).toBe(resolveFontStack("myeongjo"));
        expect(resolveBattleLook({ preset: "ink", font: "neodgm" }).fontStack).toBe(resolveFontStack("neodgm"));
        expect(resolveBattleLook({ preset: "line" }).fontStack).toBeUndefined();
        expect(resolveBattleLook({ preset: "line" }).retroWindow).toBe(true);
        expect(resolveBattleLook({ preset: "veil" }).retroWindow).toBe(false);
      });
    });
    describe("자료집 전투 화면 탭 — 전투 화면 꾸미기", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
      });
      afterEach(() => {
        document.body.innerHTML = "";
      });

      function renderSystem(): HTMLElement {
        const host = document.createElement("div");
        document.body.append(host);
        renderBattleScreenTab(host);
        return host;
      }

      it("프리셋 카드 12장, 고르면 저장되고 pixel 로 돌리면 키가 빠진다", () => {
        const host = renderSystem();
        expect(host.querySelectorAll('[data-testid^="db-battle-look-preset-"]')).toHaveLength(12);
        expect(host.querySelector('[data-testid="db-battle-look-preset-pixel"]')?.getAttribute("aria-pressed")).toBe("true");
        host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-gold"]')!.click();
        expect(store.getCurrent().system.battleLook).toEqual({ preset: "gold" });
        expect(host.querySelector('[data-testid="db-battle-look-preset-gold"]')?.getAttribute("aria-pressed")).toBe("true");
        host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-pixel"]')!.click();
        expect(store.getCurrent().system.battleLook).toBeUndefined();
      });

      it("칸을 바꾸면 그 칸만 저장되고 「사용자 설정」·되돌리기가 뜬다", () => {
        const host = renderSystem();
        host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-preset-ink"]')!.click();
        const party = host.querySelector<HTMLSelectElement>('[data-testid="db-battle-look-party"]')!;
        party.value = "cards";
        party.dispatchEvent(new Event("change"));
        expect(store.getCurrent().system.battleLook).toEqual({ preset: "ink", party: "cards" });
        expect(host.querySelector('[data-testid="db-battle-look-status"]')?.textContent).toContain("사용자 설정");
        host.querySelector<HTMLButtonElement>('[data-testid="db-battle-look-reset"]')!.click();
        expect(store.getCurrent().system.battleLook).toEqual({ preset: "ink" });
      });

      it("강조색은 「꾸밈 기본」을 끄면 저장되고 켜면 지워진다", () => {
        const host = renderSystem();
        const usesDefault = (): HTMLInputElement => host.querySelector<HTMLInputElement>('[data-testid="db-battle-look-accent-default"]')!;
        const color = (): HTMLInputElement => host.querySelector<HTMLInputElement>('[data-testid="db-battle-look-accent"]')!;
        expect(usesDefault().checked).toBe(true);
        color().value = "#88ccff";
        usesDefault().checked = false;
        usesDefault().dispatchEvent(new Event("change"));
        expect(store.getCurrent().system.battleLook).toEqual({ accent: "#88ccff" });
        usesDefault().checked = true;
        usesDefault().dispatchEvent(new Event("change"));
        expect(store.getCurrent().system.battleLook).toBeUndefined();
      });
    });
    describe("AI set_project_settings — battle.look", () => {
      it("프리셋으로 갈아타면 바꾼 칸을 버리고, 칸만 주면 프리셋 위에 덮는다", () => {
        const context = { project: createBlankProject() };
        expect(runTool(context, "set_project_settings", { battle: { look: { preset: "ink", party: "cards", accent: "#D9B86C" } } }).ok).toBe(true);
        expect(context.project.system.battleLook).toEqual({ preset: "ink", party: "cards", accent: "#d9b86c" });
        expect(runTool(context, "set_project_settings", { battle: { look: { turnOrder: true, accent: "" } } }).ok).toBe(true);
        expect(context.project.system.battleLook).toEqual({ preset: "ink", party: "cards", turnOrder: true });
        expect(runTool(context, "set_project_settings", { battle: { look: { preset: "pixel" } } }).ok).toBe(true);
        expect(context.project.system.battleLook).toBeUndefined();
      });

      it("모르는 프리셋·칸·글꼴·색·스킨은 거절한다", () => {
        const context = { project: createBlankProject() };
        expect(runTool(context, "set_project_settings", { battle: { look: { preset: "chrome" } } }).ok).toBe(false);
        expect(runTool(context, "set_project_settings", { battle: { look: { party: "floating" } } }).ok).toBe(false);
        expect(runTool(context, "set_project_settings", { battle: { look: { light: 3 } } }).ok).toBe(false);
        expect(runTool(context, "set_project_settings", { battle: { look: { font: "comic-sans" } } }).ok).toBe(false);
        expect(runTool(context, "set_project_settings", { battle: { look: { accent: "gold" } } }).ok).toBe(false);
        expect(runTool(context, "set_project_settings", { battle: { uiStyle: "octopath-2" } }).ok).toBe(false);
      });
    });
  });
  describe("characterAppearanceLifecycle", () => {
    isolateTimers();
    beforeEach(() => {
      const project = createBlankProject();
      project.database.characterAppearances = [
        { id: "first", name: "First", description: "" },
        { id: "second", name: "Second", description: "" },
      ];
      store.replace(project);
      selectCharacterAppearance("first");
      openDatabaseModal("characterAppearances");
    });
    afterEach(() => {
      requestDatabaseModalClose("battleTest");
      appearanceGenerationController.cancel();
      vi.unstubAllGlobals();
    });
    function click(testid: string): void {
      const element = document.querySelector(`[data-testid="${testid}"]`);
      if (!(element instanceof HTMLButtonElement)) throw new TypeError(`Missing button ${testid}`);
      element.click();
    }
    function deferred<T>() {
      let settle: (value: T) => void = () => { throw new TypeError("Promise not initialized"); };
      const promise = new Promise<T>((resolve) => { settle = resolve; });
      return { promise, resolve: (value: T) => settle(value) };
    }
    describe("appearance generation view lifecycle", () => {
      it.each([
        "appearance-row-second",
        "appearance-add",
        "appearance-duplicate",
        "appearance-delete",
        "db-tab-actors",
        "database-modal-close",
      ])("cancels generation and ignores late output when activating %s", async (action) => {
        const response = deferred<Response>();
        const started = deferred<void>();
        vi.stubGlobal("fetch", () => { started.resolve(); return response.promise; });
        const assetsBefore = Object.keys(store.getCurrent().assets.uploaded);
        const generation = appearanceGenerationController.generate({ appearanceId: "first", slot: "face" });
        await started.promise;
        expect(appearanceGenerationController.getState().status).toBe("generating");

        click(action);

        const statusAfterAction = appearanceGenerationController.getState().status;
        response.resolve(new Response(JSON.stringify({ image: {
          dataUrl: "data:image/png;base64,AAAA", mimeType: "image/png", model: "test", provider: "test",
        } }), { status: 200 }));
        await generation;
        expect(statusAfterAction).toBe("idle");
        expect(appearanceGenerationController.getState().status).toBe("idle");
        expect(Object.keys(store.getCurrent().assets.uploaded)).toEqual(assetsBefore);
        expect(store.getCurrent().database.characterAppearances?.every((record) => !record.face)).toBe(true);
      });
    });
  });
  describe("currentMonsterArtDefaults", () => {
    isolateTimers();
    // qa1124 항목 4(오너 2026-11-24 «최신 몬스터들 반영»): 새 프로젝트 기본 적이 현행 id 를 쓰는데 그림이 설치되지 않아
    // 자료집·전투에 옛 3×3 그림이 보였고, 편집기 칸 표는 시트 격자와 상관없이 9칸만 그렸다.

    describe("기본 적의 현행 몬스터 그림", () => {
      it("현행 id 적은 정식 번들 5×4 시트를 직접 쓰고, 정규화는 중복 battle-gen 업로드만 정리하며 사용자 업로드는 건드리지 않는다", async () => {
        await preloadCurrentMonsterArt();
        const project = createBlankProject() as Project;
        const currentIds = [...new Set(project.database.enemies.map((e) => e.monsterResourceId).filter(isCurrentMonsterArt))] as string[];
        expect(currentIds.length).toBeGreaterThan(0);
        const keep = currentIds[0]!;
        const legacy = currentIds[1]!;
        const userAsset = { id: keep, name: "내 그림", kind: "monster" as const, dataUrl: "data:image/png;base64,AAAA", meta: { width: 1, height: 1 } };
        project.assets.uploaded[keep] = userAsset;
        project.assets.uploaded[legacy] = { id: legacy, name: "옛 복사", kind: "monster", dataUrl: "data:image/png;base64,BBBB", meta: { width: 96, height: 96 }, generatedBy: "battle-gen:fallen-star" };
        project.assets.uploaded[`${legacy}-sheet16`] = { id: `${legacy}-sheet16`, name: "옛 시트", kind: "picture", dataUrl: "data:image/png;base64,CCCC", meta: { width: 480, height: 384 }, generatedBy: "battle-gen:fallen-star" };

        expect(ensureCurrentMonsterArt(project)).toBe(true);
        expect(project.assets.uploaded[keep]).toBe(userAsset);
        expect(project.assets.uploaded[legacy]).toBeUndefined();
        expect(project.assets.uploaded[`${legacy}-sheet16`]).toBeUndefined();
        setPixelEnemySheetProjectSource(() => project);
        try {
          for (const id of currentIds.slice(1)) {
            expect(hasCurrentMonsterArt(project, id), id).toBe(true);
            expect(pixelEnemySheet(id)?.grid, id).toBe("5x4");
          }
        } finally {
          setPixelEnemySheetProjectSource(undefined);
        }
        // 두 번째 로드는 아무것도 하지 않는다(정규화 표식이 «바뀜»으로 남지 않게).
        expect(ensureCurrentMonsterArt(project)).toBe(false);
      });

      it("새 프로젝트 기본 적은 모두 현행 그림이고, 옛 그림을 이미 바꾼 적은 대역하지 않는다", () => {
        const project = createBlankProject() as Project;
        expect(project.database.enemies.filter((e) => !isCurrentMonsterArt(e.monsterResourceId)).map((e) => e.id)).toEqual([]);
        const red = project.database.enemies.find((e) => e.id === "enemy_slime_red")!;
        expect(red.monsterResourceId).toBe("generated-enemy-slime-green");
        expect(standInOriginalArt(red)).toBe("generated-enemy-slime-red");

        const saved = [{ ...red, monsterResourceId: "generated-enemy-slime-red" }, { ...red, id: "enemy_slime_blue", monsterResourceId: "my-upload" }];
        expect(applyCurrentMonsterStandIns(saved)).toBe(1);
        expect(saved.map((e) => e.monsterResourceId)).toEqual(["generated-enemy-slime-green", "my-upload"]);
        expect(standInOriginalArt(saved[1])).toBeUndefined();
      });

      it("칸 표는 시트 격자를 따른다: 3×3 9칸 · 4×4 15칸(예약 칸 제외) · 5×4 20칸 · 비운 칸은 빠진다", () => {
        expect(enemyPixelCellOrder({})).toHaveLength(9);
        expect(enemyPixelCellOrder({ grid: "4x4" })).toHaveLength(15);
        expect(enemyPixelCellOrder({ grid: "5x4" })).toHaveLength(20);
        expect(enemyPixelCellOrder({ grid: "5x4", missingCells: [18, 19] })).toHaveLength(18);
      });
    });
  });
});

describe("editorPanelsSuite30", () => {
  isolateTimers();
  describe("spatialGeographyControllerOverrides", () => {
    isolateTimers();
    const previous = store.getCurrent();
    const target: GeographyDraftTarget = {
      cardId: geographyRoot, localId: geographyWorld, name: "Contract world",
      source: "placed", kind: "world", occurrenceId: geographyRoot,
    };
    const request = { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } } as const;
    let baseline: string;
    let compiledBaseline: string;
    let selectedId: SpatialId;
    let siblingId: SpatialId;
    beforeAll(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
      store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
      // Establish an independently edited occurrence through canonical IO and the real controller.
      store.replace(deserialize(serialize(geographyControllerInput("world"))));
      const controller = createSpatialAuthoringController();
      const draft = authoringValue(controller.createDraft());
      const document = fixtureDocument(draft.project);
      const selected = findOccurrenceChildId(document, geographyRoot, { slotId: spatialId("first"), index: 0 });
      const sibling = findOccurrenceChildId(document, geographyRoot, { slotId: spatialId("third"), index: 0 });
      if (!selected || !sibling) throw new TypeError("Missing associated world children");
      selectedId = selected;
      siblingId = sibling;
      const child = own(document.occurrences, sibling);
      draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences,
        [sibling]: { ...child, x: 53 } } };
      deserialize(serialize(draft.project));
      authoringValue(controller.apply(authoringValue(controller.preview(draft, { operation: { kind: "edit" } }))));
      baseline = serialize(deserialize(serialize(store.getCurrent())));
      const compilation = authoringValue(controller.preview(authoringValue(controller.createDraft()), request));
      authoringValue(controller.apply(compilation));
      compiledBaseline = serialize(deserialize(serialize(store.getCurrent())));
      const world = geographyFromProject(store.getCurrent(), target);
      if (!world || !("regions" in world)) throw new TypeError("Missing placed world");
      expect(world.regions.find(slot => slot.id === "third")?.x).toBe(46);
      expect(own(fixtureDocument(store.getCurrent()).occurrences, sibling).x).toBe(53);
      resetMapEditHistory();
      vi.clearAllTimers();
      vi.useRealTimers();
    });
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
      store.replace(deserialize(baseline));
      resetMapEditHistory();
    });
    afterEach(() => { store.replace(previous); resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
    it.each([
      { edit: "name", compiled: false, expectedSelectedX: 6 },
      { edit: "terrain", compiled: false, expectedSelectedX: 6 },
      { edit: "selected-move", compiled: false, expectedSelectedX: 8 },
      { edit: "selected-move", compiled: true, expectedSelectedX: 8 },
      { edit: "name", compiled: true, expectedSelectedX: 6 },
      { edit: "terrain", compiled: true, expectedSelectedX: 6 },
    ] as const)("preserves an actual sibling override when a placed parent receives a $edit edit (compiled=$compiled)", ({ edit, compiled, expectedSelectedX }) => {
      // Given a canonical reloaded world with same-source siblings and a distinct actual override.
      store.replace(deserialize(compiled ? compiledBaseline : baseline));
      const before = serialize(store.getCurrent());
      const original = fixtureDocument(store.getCurrent());
      const controller = createSpatialAuthoringController();
      const draft = authoringValue(controller.createDraft());
      const world = geographyFromProject(draft.project, target);
      if (!world || !("regions" in world)) throw new TypeError("Missing placed world");
      // When the geography draft seam edits only the parent metadata or the selected sibling slot.
      switch (edit) {
        case "name": Object.assign(draft.project, editGeography(draft.project, target,
          design => withGeographyName(design, "Renamed occurrence"))); break;
        case "terrain": Object.assign(draft.project, commitGeographyEdit(draft.project, target,
          setTerrainAreas(world, [{ kind: "rect", x: 0, y: 0, width: 2, height: 2, material: "water" }]))); break;
        case "selected-move": Object.assign(draft.project, commitGeographyEdit(draft.project, target,
          moveGeographyChild(world, spatialId("first"), 8, 10))); break;
        default: assertNever(edit);
      }
      // Then unchanged slots preserve their actual values, even before compilation.
      expect(own(fixtureDocument(draft.project).occurrences, siblingId)).toMatchObject({ x: 53, y: 10, level: 0 });
      const preview = authoringValue(controller.preview(draft, request));
      // Compilation emits entries/events at actual occurrence coordinates.
      const document = fixtureDocument(preview.project);
      expect(own(document.occurrences, siblingId)).toMatchObject({ x: 53, y: 10, level: 0 });
      expect(own(document.occurrences, selectedId)).toMatchObject({ x: expectedSelectedX, y: 10, level: 0 });
      const binding = own(document.occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
      if (!binding) throw new TypeError("Missing compiled overview ownership");
      const overview = own(preview.project.maps, binding.mapId);
      for (const [id, x] of [[selectedId, expectedSelectedX], [siblingId, 53]] as const) {
        const entry = binding.overviewEntries?.find(entry => entry.target.occurrenceId === id);
        if (!entry) throw new TypeError("Missing compiled overview entry");
        expect(entry).toMatchObject({ x, y: 10 });
        expect(overview.events.find(event => event.id === entry.eventId)).toMatchObject({ x, y: 10 });
        expect(preview.project.mapConnections?.find(link => link.id === entry.returnEventId)?.to)
          .toEqual({ mapId: binding.mapId, x, y: 10 });
      }
      expect(document.library).toEqual(original.library);
      expect(document.connections).toEqual(original.connections);
      expect(Object.keys(document.occurrences).sort()).toEqual(Object.keys(original.occurrences).sort());
      for (const occurrence of Object.values(document.occurrences)) {
        const prior = own(original.occurrences, occurrence.id);
        expect(occurrence.parentSlot).toEqual(prior.parentSlot);
        expect(occurrence.snapshot.ports).toEqual(prior.snapshot.ports);
        expect(occurrence.source).toEqual(prior.source);
      }
      expect(serialize(store.getCurrent())).toBe(before);
      expect(getMapEditHistoryEntries()).toEqual([]);
      expect(authoringValue(controller.apply(preview)).changed).toBe(true);
      expect(getMapEditHistoryEntries()).toHaveLength(1);
      const accepted = serialize(store.getCurrent());
      expect(accepted).toBe(serialize(preview.project));
      expect(controller.undo()).toBe(true);
      expect(serialize(store.getCurrent())).toBe(before);
      expect(controller.redo()).toBe(true);
      expect(serialize(store.getCurrent())).toBe(accepted);
    });
  });
  describe("spatialNavigation", () => {
    isolateTimers();
    const tabs = ["tiles", "objects", "places", "regions", "worlds"] as const;
    let host: HTMLDivElement;
    const previousProject = store.getCurrent();
    const previousEditor = editorState.get();
    beforeEach(() => {
      const project = createBlankProject();
      // Missing libraries exercise the read-only contract, not an already-seeded fallback.
      for (const tileset of Object.values(project.tilesets)) delete tileset.scratchConceptBundles;
      store.replace(project);
      editorState.set({ currentMapId: project.startMapId });
      resetScratchConceptTabSession();
      setDatabaseActiveTab("scratchConcepts");
      host = document.createElement("div");
      host.className = "database-modal-body";
      document.body.append(host);
    });
    afterEach(() => {
      host.remove();
      resetScratchConceptTabSession();
      store.replace(previousProject);
      editorState.set(previousEditor);
      setDatabaseActiveTab("overview");
    });
    describe("spatial navigation acceptance (task 12 owns GREEN)", () => {
      it("renders the five ordered spatial destinations when the legacy concept route opens", () => {
        // Given: real database host and current outdoor map from beforeEach.
        // When
        renderDatabasePanel(host);
        // Then: renderer output, not a registry-only assertion.
        expect(Array.from(host.querySelectorAll<HTMLElement>('.db-tabs [data-testid^="db-tab-spatial-"]'), node => node.dataset.testid))
          .toEqual(tabs.map(tab => `db-tab-spatial-${tab}`));
      });

      it("leaves the whole project unchanged when opening a legacy authoring route to browse", () => {
        // Given
        const before = structuredClone(store.getCurrent());
        // When
        renderDatabasePanel(host);
        // Then: opening the route must not seed the missing interior catalog.
        expect(store.getCurrent()).toEqual(before);
      });

      it.each(tabs)("keeps browsing %s read-only through the rendered navigation control", tab => {
        // Given
        renderDatabasePanel(host);
        const before = structuredClone(store.getCurrent());
        const control = host.querySelector<HTMLButtonElement>(`[data-testid="db-tab-spatial-${tab}"]`);
        expect(control, `Missing rendered spatial route: ${tab}`).not.toBeNull();
        if (!control) throw new Error(`Missing rendered spatial route: ${tab}`);
        // When
        control.click();
        // Then
        expect(control.classList.contains("active")).toBe(true);
        expect(store.getCurrent()).toEqual(before);
      });
    });
  });
});

describe("editorPanelsSuite31", () => {
  isolateTimers();
  describe("tilesetAiWorkspaceModal", () => {
    isolateTimers();
    type FakeElement = HTMLElement;
    function installFakeDom(): () => void {
      document.body.replaceChildren();
      return () => document.body.replaceChildren();
    }
    let cleanupDom: (() => void) | null = null;
    let tilesetId = "";
    function currentTileset(): TilesetDef {
      const tileset = store.getCurrent().tilesets[tilesetId];
      if (!tileset) throw new Error("missing tileset fixture");
      return tileset;
    }
    function fakeAnalyzer(): void {
      setTilesetAiReviewAnalyzer(async (tileset, feedback) => {
        const columns = tileset.tilesPerRow;
        return {
          kind: "success",
          rawAnswer: "{}",
          review: {
          fingerprint: tilesetKnowledgeFingerprint(tileset),
          proposals: [
            {
              cellLayers: null,
              confidence: 0.96,
              description: "cliff",
              evidence: "cliff pattern",
              feedback: feedback.join(" "),
              id: "cliff",
              name: "반복 절벽",
              passage: { down: false, left: false, right: false, up: false },
              placementRules: "",
              question: "절벽이 맞나요?",
              quickReplies: ["맞아"],
              status: "pending",
              template: "repeatable-cliff-2x3",
              tileIds: [0, 1, columns, columns + 1, columns * 2, columns * 2 + 1],
            },
            {
              cellLayers: null,
              confidence: 0.42,
              description: "desk",
              evidence: "desk pattern",
              feedback: "",
              id: "desk",
              name: "미확인 가구",
              passage: { down: false, left: false, right: false, up: false },
              placementRules: "",
              question: "책상인가요?",
              quickReplies: ["책상", "선반"],
              status: "pending",
              template: "desk",
              tileIds: [3, 4],
            },
          ],
          summary: "two proposals",
          warnings: [],
          },
        };
      });
    }
    describe("AI tileset workspace entry", () => {
      beforeEach(() => {
        cleanupDom = installFakeDom();
        const project = createBlankProject();
        tilesetId = Object.keys(project.tilesets)[0] ?? "";
        const tileset = project.tilesets[tilesetId];
        if (!tileset) throw new Error("missing tileset fixture");
        tileset.tileGroups = [];
        store.replace(project);
        resetTilesetAiReviewSessions();
        resetTilesetAiConversation();
      });

      afterEach(() => {
        closeTilesetAiWorkspace();
        setTilesetAiReviewAnalyzer(null);
        resetTilesetAiReviewSessions();
        resetTilesetAiConversation();
        cleanupDom?.();
        cleanupDom = null;
      });

      it("keeps the human knowledge editor visible without an inline AI inbox", () => {
        // Given / When
        const panel = renderWithFakeDom(() => renderTileGroupPanel(currentTileset(), () => undefined));

        // Then
        expect(findByTestId(panel, "tileset-knowledge-template-water-autotile-3x3")).not.toBeNull();
        expect(findByTestId(panel, "tileset-ai-review-inbox")).toBeNull();
        expect(findByTestId(panel, "tileset-ai-review-manual")).toBeNull();
      });

      it("retires the separate AI launcher and exposes reference documents in the tile library", () => {
        const editor = renderWithFakeDom(() => renderTilesetEditor(currentTileset(), () => undefined));
        expect(findByTestId(editor, "tileset-ai-workspace-open")).toBeNull();

        const host = renderWithFakeDom(() => {
          const root = document.createElement("div");
          renderTilesetsTab(root, () => undefined);
          return root;
        });
        expect(findByTestId(host, "tileset-ai-workspace-open")).toBeNull();
        expect(findByTestId(host, "tileset-section-tab-references")?.textContent).toBe("AI 참고문서");
      });
    });
    describe("AI tileset workspace three-step flow", () => {
      beforeEach(() => {
        cleanupDom = installFakeDom();
        const project = createBlankProject();
        tilesetId = Object.keys(project.tilesets)[0] ?? "";
        const tileset = project.tilesets[tilesetId];
        if (!tileset) throw new Error("missing tileset fixture");
        tileset.tileGroups = [];
        store.replace(project);
        resetTilesetAiReviewSessions();
        resetTilesetAiConversation();
        fakeAnalyzer();
      });

      afterEach(() => {
        closeTilesetAiWorkspace();
        setTilesetAiReviewAnalyzer(null);
        resetTilesetAiReviewSessions();
        resetTilesetAiConversation();
        cleanupDom?.();
        cleanupDom = null;
      });

      it("starts on the analyze step and moves to questions once analysis lands", async () => {
        // Given
        openTilesetAiWorkspace(tilesetId);
        const host = document.body.querySelector("[data-testid='tileset-ai-workspace-host']");
        expect(host).not.toBeNull();

        // When — land the analysis, then observe the natural step on a fresh open
        await runTilesetAiReview(currentTileset(), () => undefined);
        closeTilesetAiWorkspace();
        openTilesetAiWorkspace(tilesetId);

        // Then — natural step after analysis is questions
        const body = document.body as unknown as FakeElement;
        const workspace = findByTestId(body, "tileset-ai-workspace");
        expect(workspace?.dataset.step).toBe("questions");
        expect(findByTestId(body, "tileset-ai-workspace-step-questions")?.classList.contains("current")).toBe(true);
      });

      it("shows the summary step with a confirmed list and applies to the project", async () => {
        // Given
        await runTilesetAiReview(currentTileset(), () => undefined);
        openTilesetAiWorkspace(tilesetId);
        const body = document.body as unknown as FakeElement;
        const toSummary = findByTestId(body, "tileset-ai-workspace-to-summary");
        expect(toSummary).not.toBeNull();

        // When — skip remaining questions, go to summary
        toSummary?.click();
        const workspace = findByTestId(body, "tileset-ai-workspace");
        expect(workspace?.dataset.step).toBe("summary");
        expect(findByTestId(body, "tileset-ai-summary-item-cliff")).not.toBeNull();

        const apply = findByTestId(body, "tileset-ai-workspace-apply");
        expect(apply?.textContent).toContain("확정된 1개 적용");
        apply?.click();

        // Then
        expect(currentTileset().tileGroups?.map((group) => group.name)).toEqual(["반복 절벽"]);
        expect(findByTestId(body, "tileset-ai-workspace-apply")?.textContent).toContain("적용됨");
        expect(isTilesetAiWorkspaceOpen()).toBe(true);
      });
    });
  });
  describe("zz-qa-fixes", () => {
    isolateTimers();
    describe("walkEncounterOptions", () => {
      isolateTimers();
      it("keeps unnamed authored records selectable with a visible identifier", () => {
        const select = walkSelect([{ id: "var_0001", name: "" }], "var_0001", () => undefined);
        expect(select.options[0]?.textContent?.trim()).not.toBe("");
        expect(select.value).toBe("var_0001");
      });
      it("assigns the field name explicitly without incorporating its option labels", () => {
        const select = walkSelect([{ id: "a", name: "option-a" }], "a", () => undefined);
        const field = walkField("field-a", select);
        expect(select.getAttribute("aria-label")).toBe(field.querySelector("span")?.textContent);
      });
      it("counts repeated and hidden authored members instead of using the legacy enemy list", () => {
        const strip = walkGroupComposition({ id: "group", name: "Group", enemyIds: ["wrong"], autoAlign: false, battleEventPages: [], members: [
          { enemyId: "a", x: 0, y: 0 }, { enemyId: "a", x: 1, y: 1, hidden: true }, { enemyId: "b", x: 2, y: 2 },
        ] });
        expect(Array.from(strip.children).map((child) => ({ ...(child as HTMLElement).dataset }))).toEqual([
          { enemyId: "a", count: "2", hiddenCount: "1" }, { enemyId: "b", count: "1", hiddenCount: "0" },
        ]);
      });
      it("counts legacy enemyIds when no formation was authored and preserves an empty authored formation", () => {
        const troop = { id: "group", name: "Group", enemyIds: ["a", "a"], autoAlign: true, battleEventPages: [] };
        expect(walkGroupComposition(troop).querySelector<HTMLElement>("[data-enemy-id=a]")?.dataset.count).toBe("2");
        expect(walkGroupComposition({ ...troop, members: [] }).querySelector("[data-enemy-id]")).toBeNull();
      });
    });
    // Adversarial unit checks for fixes 3/4/5 (temp QA file — delete after run).
    describe("zz-qa-fixes", () => {
      isolateTimers();
      function enemyWith(resourceId: string | undefined): EnemyRecord {
        return {
          id: "enemy_qa",
          name: "QA",
          monsterResourceId: resourceId,
          stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 1, mind: 1, agility: 1 },
          rewards: { exp: 0, gold: 0 },
          actions: [],
          stateRates: {},
        } as unknown as EnemyRecord;
      }
      describe("fix 3: m2-109-result-summary classification", () => {
        it("does not throw and classifies as editor-only in troop context", () => {
          expect(() => m2CommandRuntimeClassification("m2-109-result-summary")).not.toThrow();
          const support = battleEventCommandRuntimeSupport({ kind: "m2Command", commandId: "m2-109-result-summary", fields: {} });
          expect(support).toBe("editor-only");
        });

        it("every persisted m2 id used by the troop panel is classifiable (no crash path)", () => {
          for (const id of ["m2-101-enemy-encounter", "m2-102-change-battleback", "m2-109-result-summary"]) {
            expect(() => battleEventCommandRuntimeSupport({ kind: "m2Command", commandId: id, fields: {} }), id).not.toThrow();
          }
        });
      });
      describe("fix 4: generated-resource preview slot", () => {
        it("renders a neutral slot with no button for generated- resources", () => {
          const form = document.createElement("div");
          renderEnemyRecordForm(form, enemyWith("generated-qa-monster"));
          const slot = form.querySelector(".db-neutral-resource-slot.generated");
          expect(slot).not.toBeNull();
          expect(slot!.querySelector("button")).toBeNull();
        });

        it("empty resource renders an empty neutral slot, also buttonless", () => {
          const form = document.createElement("div");
          renderEnemyRecordForm(form, enemyWith(undefined));
          const slot = form.querySelector(".db-neutral-resource-slot.empty");
          expect(slot).not.toBeNull();
          expect(slot!.querySelector("button")).toBeNull();
        });
      });
    });
  });
});

describe("editorPanelsSuite5", () => {
  isolateTimers();
  describe("databasePreviewHiddenSurface", () => {
    isolateTimers();
    let host: HTMLElement;
    let pending: Map<number, FrameRequestCallback>;
    let hidden = false;
    let reduced = false;
    beforeEach(() => {
      pending = new Map(); hidden = false; reduced = false;
      let id = 0;
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { pending.set(++id, callback); return id; });
      vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
      vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
      const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
      vi.spyOn(preference, "matches", "get").mockImplementation(() => reduced);
      vi.spyOn(window, "matchMedia").mockReturnValue(preference);
      vi.stubGlobal("Image", class extends EventTarget {
        complete = true; naturalWidth = 480; naturalHeight = 480;
        set src(_url: string) { queueMicrotask(() => this.dispatchEvent(new Event("load"))); this.onload?.(); }
        onload?: () => void;
      });
      host = document.createElement("section");
      document.body.append(host);
      setDatabasePreviewSurfaceActive(host, false);
    });
    afterEach(() => {
      disposeDatabasePreviewsIn(host);
      document.body.replaceChildren();
      vi.restoreAllMocks(); vi.unstubAllGlobals();
    });
    async function construct(kind: "skill" | "enemy"): Promise<HTMLElement> {
      const project = createBlankProject();
      const result = kind === "enemy"
        ? renderEnemyPixelPreview({ name: "Preview", monsterResourceId: PIXEL_ENEMY_SHEETS[0]!.resourceId })
        : renderSkillRetroStage(project.database.skills.find(skill => skill.id === "skill_attack")!, project);
      if (!result) throw new Error(`Missing ${kind} stage fixture`);
      host.append(result.element);
      await Promise.resolve(); await Promise.resolve();
      const stage = host.querySelector<HTMLElement>("[data-editor-preview-lifecycle]");
      if (!stage) throw new Error("Missing lifecycle stage");
      return stage;
    }
    function tick(stamp: number): void {
      const callbacks = [...pending.values()]; pending.clear();
      for (const callback of callbacks) callback(stamp);
    }
    describe("real retro/pixel stages on inactive surfaces", () => {
      it.each(["skill", "enemy"] as const)("keeps %s parked, pauses document hiding, reattaches cache and tears down", async kind => {
        const stage = await construct(kind);
        expect(pending.size).toBe(0);
        expect(stage.dataset.running).not.toBe("true");
        setDatabasePreviewSurfaceActive(host, true);
        expect(pending.size).toBe(1);
        tick(16); tick(100);
        hidden = true; document.dispatchEvent(new Event("visibilitychange"));
        expect(pending.size).toBe(0);
        hidden = false; document.dispatchEvent(new Event("visibilitychange"));
        expect(pending.size).toBe(1);
        retainDatabasePreviewsIn(host, true);
        setDatabasePreviewsActiveIn(host, false);
        const content = [...host.childNodes]; host.replaceChildren();
        await Promise.resolve();
        expect(pending.size).toBe(0);
        host.append(...content);
        retainDatabasePreviewsIn(host, false);
        setDatabasePreviewsActiveIn(host, true);
        expect(pending.size).toBe(1);
        disposeDatabasePreviewsIn(host);
        document.dispatchEvent(new Event("visibilitychange"));
        expect(pending.size).toBe(0);
      });

      it.each(["skill", "enemy"] as const)("does not start %s under reduced motion", async kind => {
        reduced = true;
        await construct(kind);
        setDatabasePreviewSurfaceActive(host, true);
        expect(pending.size).toBe(0);
      });

      it("preserves the enemy's still-cell choice after hide/reveal", async () => {
        await construct("enemy");
        setDatabasePreviewSurfaceActive(host, true);
        // 칸 표는 접힌 채로 나오고(버튼 줄이기), 펼치면 보인다.
        const cells = host.querySelector<HTMLElement>("[data-testid='db-enemy-pixel-cells']")!;
        const fold = cells.closest("details") as HTMLDetailsElement;
        expect(cells.hidden).toBe(true);
        fold.open = true;
        fold.dispatchEvent(new Event("toggle"));
        expect(cells.hidden).toBe(false);
        const cell = host.querySelector<HTMLButtonElement>("[data-testid='db-enemy-pixel-cell-idle_a']")!;
        cell.click();
        setDatabasePreviewSurfaceActive(host, false);
        setDatabasePreviewSurfaceActive(host, true);
        expect(pending.size).toBe(0);
        expect(cell.getAttribute("aria-pressed")).toBe("true");
      });
    });
  });
  describe("databaseUx2ConnectionsCache", () => {
    isolateTimers();
    const SKILL = "skill_ux2_cache";
    function fixture(): Project {
      const project = createBlankProject();
      project.database.skills.push({ ...structuredClone(project.database.skills[0]!), id: SKILL, name: "UX skill", description: "Description" });
      project.commonEvents = Array.from({ length: 4 }, (_, index) => ({
        id: `common_ux2_${index}`, name: `Event ${index}`, trigger: "none" as const,
        commands: [
          ...Array.from({ length: 1000 }, (): Command => ({ kind: "text", body: "unrelated" })),
          { kind: "learnSkill", actorId: project.database.actors[0]!.id, skillId: SKILL, action: "learn" },
        ],
      }));
      return project;
    }
    function replaceCollection(project: Project, collection: DatabaseCollection, patch: (records: Project["database"][typeof collection]) => void): Project {
      const records = structuredClone(project.database[collection]);
      patch(records);
      return { ...project, database: { ...project.database, [collection]: records } };
    }
    beforeEach(() => store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false }));
    afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
    describe("UX round 2: incoming uses cache", () => {
      it.each([...CONNECTION_COLLECTIONS])("does not scan event commands on selected %s name/description edits", (collection) => {
        const project = fixture();
        const id = collection === "skills" ? SKILL : project.database[collection][0]!.id;
        const spies = project.commonEvents.map((event) => vi.spyOn(event.commands, "some"));
        const read = createRecordConnectionsReader();
        read(project, collection, id);
        const counts = spies.map((spy) => spy.mock.calls.length);
        const next = replaceCollection(project, collection, (records) => {
          const record = records.find((entry) => entry.id === id)!;
          record.name += " renamed";
          if ("description" in record) record.description = "";
        });
        const result = read(next, collection, id);
        expect(spies.map((spy) => spy.mock.calls.length)).toEqual(counts);
        expect(result).toEqual(recordConnections(next, collection, id));
      });

      it("retains the uses array while description checks change and ignores unrelated assets/tile grids", () => {
        const project = fixture();
        const read = createRecordConnectionsReader();
        const initial = read(project, "skills", SKILL);
        const next = replaceCollection(project, "skills", (records) => {
          const record = records.find((entry) => entry.id === SKILL)!;
          if ("description" in record) record.description = "";
          record.name = "Renamed";
        });
        const result = read(next, "skills", SKILL);
        expect(result.uses).toBe(initial.uses);
        expect(result.checks).toContain("설명이 비어 있어요");
        const unrelated: Project = {
          ...next, tilesets: {}, assets: { ...next.assets },
          maps: { ...next.maps, [next.startMapId]: { ...next.maps[next.startMapId]!, lowerTiles: [] } },
        };
        expect(read(unrelated, "skills", SKILL).uses).toBe(initial.uses);
      });

      it("invalidates changed relationships, referenced labels, selection and replacement projects", () => {
        let project = fixture();
        const read = createRecordConnectionsReader();
        read(project, "skills", SKILL);
        project = replaceCollection(project, "classes", (records) => {
          const record = records[0]!;
          if ("learnedSkills" in record) record.learnedSkills.push({ level: 1, skillId: SKILL });
        });
        expect(read(project, "skills", SKILL).uses.some((use) => use.target?.collection === "classes")).toBe(true);
        project = replaceCollection(project, "classes", (records) => { records[0]!.name = "Renamed class"; });
        expect(read(project, "skills", SKILL).uses.some((use) => use.name === "Renamed class")).toBe(true);
        project = { ...project, commonEvents: project.commonEvents.map((event) => ({ ...event, name: `New ${event.name}` })) };
        expect(read(project, "skills", SKILL).uses.some((use) => use.name === "New Event 0")).toBe(true);
        expect(read(project, "skills", project.database.skills[0]!.id)).toEqual(recordConnections(project, "skills", project.database.skills[0]!.id));
        const replacement = fixture();
        replacement.commonEvents = [];
        expect(read(replacement, "skills", SKILL)).toEqual(recordConnections(replacement, "skills", SKILL));
      });

      it("invalidates fallback sources and their labels, including sources outside the direct uses list", () => {
        let project = fixture();
        const itemId = project.database.items[0]!.id;
        project.database.enemies = [];
        project.commonEvents = [];
        project.system.sellPrices = [{ itemId, price: 1 }];
        const read = createRecordConnectionsReader();
        expect(read(project, "items", itemId).uses).toContainEqual({ kind: "다른 곳", name: "판매 가격 규칙이 이 아이템을 사용 중입니다." });
        project = { ...project, system: { ...project.system, sellPrices: [], craftRecipes: [{
          id: "recipe_ux2", name: "UX recipe", outputItemId: itemId, outputCount: 1, ingredients: [],
        }] } };
        expect(read(project, "items", itemId).uses.some((use) => use.name.includes("UX recipe"))).toBe(true);
        project = { ...project, system: { ...project.system, craftRecipes: [{ ...project.system.craftRecipes![0]!, name: "New recipe" }] } };
        expect(read(project, "items", itemId).uses.some((use) => use.name.includes("New recipe"))).toBe(true);
        project = { ...project, system: { ...project.system, craftRecipes: [] }, session: { ...project.session, inventory: { [itemId]: 1 } } };
        expect(read(project, "items", itemId)).toEqual(recordConnections(project, "items", itemId));
        expect(read(project, "items", itemId).uses.length).toBeGreaterThan(0);
      });
    });
    describe("command predicate cache and current location labels", () => {
      it("refreshes common-event/map/troop/page names while keeping cached command matches", () => {
        const project = fixture();
        const commands: Command[] = [{ kind: "learnSkill", actorId: project.database.actors[0]!.id, skillId: SKILL, action: "learn" }];
        project.maps[project.startMapId]!.events = [{ id: "map_event", name: "Old event", x: 0, y: 0, trigger: { kind: "action" }, commands }];
        project.database.troops[0]!.battleEventPages = [{ id: "page", name: "Old page", conditions: [], span: "battle", commands }];
        project.database.troops[0]!.afterBattle = { victory: commands };
        const spy = vi.spyOn(commands, "some");
        const read = createCommandReferenceLocationsReader();
        read(project, "skills", SKILL);
        const count = spy.mock.calls.length;
        const next: Project = {
          ...project,
          commonEvents: project.commonEvents.map((event) => ({ ...event, name: `New ${event.name}` })),
          maps: { ...project.maps, [project.startMapId]: { ...project.maps[project.startMapId]!, name: "New map", events: [{ ...project.maps[project.startMapId]!.events[0]!, name: "New event" }] } },
          database: { ...project.database, troops: project.database.troops.map((troop, index) => index ? troop : {
            ...troop, name: "New troop", battleEventPages: [{ ...troop.battleEventPages[0]!, name: "New page" }],
          }) },
        };
        const result = read(next, "skills", SKILL);
        expect(spy.mock.calls.length).toBe(count);
        expect(result).toContainEqual({ kind: "mapEvent", mapName: "New map", eventName: "New event", eventId: "map_event" });
        expect(result).toContainEqual({ kind: "troopBattleEvent", troopName: "New troop", pageName: "New page" });
        expect(result).toEqual(commandsReferenceLocations(next, "skills", SKILL));
      });

      it("invalidates canonical draft ownership, nested conditions, after-battle commands and removed sources", () => {
        let project = fixture();
        const mapId = project.startMapId;
        const actorId = project.database.actors[0]!.id;
        project.maps[mapId]!.events = [{ id: "draft_ux2", name: "Draft event", x: 0, y: 0, trigger: { kind: "action" }, commands: [{ kind: "learnSkill", actorId, skillId: SKILL, action: "learn" }] }];
        beginEventEditDraft(project, mapId, "draft_ux2");
        project.maps[mapId]!.events[0]!.commands = [];
        const read = createCommandReferenceLocationsReader();
        expect(read(project, "skills", SKILL).some((location) => location.kind === "mapEvent")).toBe(true);
        project = structuredClone(project);
        project.maps[mapId]!.events[0]!.draft!.conflict = { kind: "remote-delete", detectedAt: 1 };
        expect(read(project, "skills", SKILL).some((location) => location.kind === "mapEvent")).toBe(false);
        project = structuredClone(project);
        const itemId = project.database.items[0]!.id;
        project.maps[mapId]!.events[0]!.condition = { kind: "all", conditions: [{ kind: "not", condition: { kind: "item", itemId, present: true } }] };
        expect(read(project, "items", itemId).some((location) => location.kind === "mapEvent")).toBe(true);
        project = structuredClone(project);
        project.database.troops[0]!.afterBattle = { victory: [{ kind: "learnSkill", actorId, skillId: SKILL, action: "learn" }] };
        expect(read(project, "skills", SKILL).some((location) => location.kind === "troopBattleEvent")).toBe(true);
        project = structuredClone(project);
        project.commonEvents = [];
        project.maps[mapId]!.events = [];
        for (const troop of project.database.troops) { troop.afterBattle = undefined; troop.battleEventPages = []; }
        expect(read(project, "skills", SKILL)).toEqual([]);
      });
    });
    describe("native Connections panel behavior", () => {
      it("expands/collapses without scans, retains focus, updates checks and keeps navigation", () => {
        const project = fixture();
        store.replaceProject(project);
        setSelectedRecordId("skills", SKILL);
        const current = store.getCurrent();
        const spies = current.commonEvents.map((event) => vi.spyOn(event.commands, "some"));
        const navigate = vi.fn();
        const panel = createConnectionsPanel(navigate);
        const host = document.createElement("div");
        const name = document.createElement("input");
        host.append(name);
        document.body.append(host);
        panel.host = host;
        panel.paint("skills");
        const counts = spies.map((spy) => spy.mock.calls.length);
        const uses = panel.element.querySelector<HTMLElement>('[data-testid="db-connections-uses"]')!;
        expect(uses.querySelectorAll(".db-connections-use")).toHaveLength(3);
        const more = uses.querySelector<HTMLButtonElement>(".db-connections-more")!;
        more.focus();
        more.click();
        expect(uses.querySelectorAll(".db-connections-use")).toHaveLength(4);
        expect(document.activeElement?.getAttribute("aria-expanded")).toBe("true");
        (document.activeElement as HTMLButtonElement).click();
        expect(uses.querySelectorAll(".db-connections-use")).toHaveLength(3);
        expect(spies.map((spy) => spy.mock.calls.length)).toEqual(counts);
        name.value = "Editing";
        name.focus();
        name.setSelectionRange(2, 4);
        store.updateDatabase("skills", (database) => { database.skills.find((skill) => skill.id === SKILL)!.description = ""; });
        panel.paint("skills");
        expect(panel.element.querySelector('[data-testid="db-connections-checks"]')?.textContent).toContain("설명이 비어 있어요");
        expect(document.activeElement).toBe(name);
        expect([name.selectionStart, name.selectionEnd]).toEqual([2, 4]);
        expect(spies.map((spy) => spy.mock.calls.length)).toEqual(counts);
        store.updateDatabase("classes", (database) => { database.classes[0]!.learnedSkills.push({ level: 1, skillId: SKILL }); });
        panel.paint("skills");
        const link = panel.element.querySelector<HTMLButtonElement>(".db-connections-link")!;
        link.click();
        expect(navigate).toHaveBeenCalledWith({ collection: "classes", id: store.getCurrent().database.classes[0]!.id });
      });

      it("keeps CSS-hidden panels current without rescanning unchanged references on presentation edits", () => {
        store.replaceProject(fixture());
        setSelectedRecordId("skills", SKILL);
        const panel = createConnectionsPanel(() => {});
        const host = document.createElement("div");
        document.body.append(host);
        panel.host = host;
        panel.element.style.display = "none";
        panel.paint("skills");
        const spies = store.getCurrent().commonEvents.map((event) => vi.spyOn(event.commands, "some"));
        store.updateDatabase("skills", (database) => { database.skills.find((skill) => skill.id === SKILL)!.name += " updated"; });
        panel.paint("skills");
        expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
        store.update((project) => { project.commonEvents[0]!.name = "Updated while hidden"; });
        panel.paint("skills");
        panel.element.style.display = "";
        // Revealing requires no special invalidation or resize observer.
        expect(panel.element.textContent).toContain("Updated while hidden");
      });

      it("reattaches after body replacement and clears expansion on selection or project lineage changes", () => {
        store.replaceProject(fixture());
        setSelectedRecordId("skills", SKILL);
        const panel = createConnectionsPanel(() => {});
        const host = document.createElement("div");
        document.body.append(host);
        panel.host = host;
        panel.paint("skills");
        panel.element.querySelector<HTMLButtonElement>(".db-connections-more")!.click();
        host.replaceChildren();
        panel.paint("skills");
        expect(panel.element.parentElement).toBe(host);
        expect(panel.element.querySelector(".db-connections-more")?.getAttribute("aria-expanded")).toBe("true");
        store.replaceProject(fixture());
        setSelectedRecordId("skills", SKILL);
        panel.paint("skills");
        expect(panel.element.querySelector(".db-connections-more")?.getAttribute("aria-expanded")).toBe("false");
        panel.paint("lifeCollections");
        expect(panel.element.hidden).toBe(true);
        panel.paint("skills");
        expect(panel.element.hidden).toBe(false);
        setSelectedRecordId("skills", store.getCurrent().database.skills[0]!.id);
        panel.paint("skills");
        expect(panel.element.textContent).not.toContain("Event 0");
        for (const button of panel.element.querySelectorAll(".db-connections-more")) expect(button.getAttribute("aria-expanded")).toBe("false");
      });
    });
  });
  describe("databaseUx2LifeCollections", () => {
    isolateTimers();
    function control<T extends HTMLElement = HTMLInputElement>(host: HTMLElement, testid: string): T {
      const node = host.querySelector<T>(`[data-testid="${testid}"]`);
      if (!node) throw new Error(`Missing ${testid}`);
      return node;
    }
    function inputSearch(host: HTMLElement, value: string): HTMLInputElement {
      const search = control(host, "db-life-collections-search");
      search.value = value;
      search.dispatchEvent(new Event("input", { bubbles: true }));
      vi.advanceTimersByTime(100);
      return search;
    }
    function mount() {
      const host = document.createElement("div");
      document.body.append(host);
      let renders = 0;
      const rerender = (): void => {
        renders++;
        host.replaceChildren();
        renderLifeCollectionsTab(host, rerender);
      };
      rerender();
      control<HTMLButtonElement>(host, "db-life-collections-chip-all").click();
      inputSearch(host, "");
      control<HTMLButtonElement>(host, "db-life-collections-row-fish-fish_ux2_0").click();
      return { host, renders: () => renders, rerender };
    }
    beforeEach(() => {
      vi.useFakeTimers();
      const project = createBlankProject();
      const item = project.database.items[0]!;
      while (project.database.items.length < 1000) {
        const index = project.database.items.length;
        project.database.items.push({ ...structuredClone(item), id: `item_ux2_${index}`, name: `Item ${index}` });
      }
      project.database.fishSpecies = Array.from({ length: 100 }, (_, index) => ({
        id: `fish_ux2_${index}`, name: `Fish ${index}`, itemId: item.id, skillXp: 1,
      }));
      project.system.fishing = { enabled: true, spots: [{
        id: "spot_ux2", name: "UX spot", mapId: project.startMapId, area: { x: 0, y: 0, w: 2, h: 2 },
        catches: [{ fishId: "fish_ux2_0", weight: 1 }],
      }] };
      project.system.seasonalForage = { enabled: true, areas: [{
        id: "area_ux2", name: "UX forage", mapId: project.startMapId, area: { x: 0, y: 0, w: 2, h: 2 },
        entries: [{ id: "entry_ux2", itemId: item.id, weight: 1 }], dailySpawnCount: 1, maxActive: 1, despawnAfterDays: 1,
      }] };
      project.system.museum = { enabled: true, eligibleItemIds: [], rewards: [{ id: "museum_ux2", name: "UX museum", minDonations: 1 }] };
      project.system.collections = { enabled: true, trackedItemIds: [] };
      store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
      store.replace(project);
      resetMapEditHistory();
    });
    afterEach(() => {
      document.body.replaceChildren();
      vi.clearAllTimers();
      vi.useRealTimers();
    });
    describe("UX round 2: retained Life search and selected inspectors", () => {
      it("retains search identity, midpoint caret and inspector drafts through paused and no-match typing", () => {
        const { host, renders } = mount();
        const search = control(host, "db-life-collections-search");
        const inspector = control(host, "db-life-collections-panel-fish-fish_ux2_0");
        const name = control(host, "db-life-collections-name-fish-fish_ux2_0");
        name.value = "Uncommitted DOM draft";
        search.focus();
        search.value = "Fih 0";
        search.setSelectionRange(2, 2);
        search.dispatchEvent(new Event("input", { bubbles: true }));
        const count = renders();
        vi.advanceTimersByTime(180);
        expect(document.activeElement).toBe(search);
        expect(control(host, "db-life-collections-search")).toBe(search);
        expect([search.selectionStart, search.selectionEnd]).toEqual([2, 2]);
        search.value = "Fish 0";
        search.setSelectionRange(3, 3);
        search.dispatchEvent(new Event("input", { bubbles: true }));
        vi.advanceTimersByTime(180);
        expect(document.activeElement).toBe(search);
        expect([search.selectionStart, search.selectionEnd]).toEqual([3, 3]);
        expect(host.querySelectorAll('[data-testid^="db-life-collections-row-fish-"]')).toHaveLength(1);
        inputSearch(host, "absent-name");
        expect(host.querySelectorAll('[data-testid^="db-life-collections-row-"]')).toHaveLength(0);
        expect(control(host, "db-life-collections-list-pane").querySelector(".db-ws-count")?.textContent).toBe("0/103개");
        expect(control(host, "db-life-collections-panel-fish-fish_ux2_0")).toBe(inspector);
        expect(name.value).toBe("Uncommitted DOM draft");
        expect(renders()).toBe(count);
        expect(host.querySelectorAll('[data-testid^="db-life-collections-fish-item-"] option')).toHaveLength(store.getCurrent().database.items.length);
        expect(host.querySelectorAll('[data-testid^="db-life-collections-panel-"][hidden]')).toHaveLength(0);
      });

      it("does not steal focus when a debounce completes after the user changes controls", () => {
        const { host } = mount();
        const search = control(host, "db-life-collections-search");
        search.focus();
        search.value = "Fish";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        const name = control(host, "db-life-collections-name-fish-fish_ux2_0");
        name.focus();
        name.setSelectionRange(1, 3);
        vi.advanceTimersByTime(100);
        expect(document.activeElement).toBe(name);
        expect([name.selectionStart, name.selectionEnd]).toEqual([1, 3]);
      });

      it("filters before creating rows and mounts one inspector of any kind only when selected", () => {
        const { host, renders } = mount();
        const before = renders();
        control<HTMLButtonElement>(host, "db-life-collections-chip-fishing").click();
        expect(renders()).toBe(before);
        expect(host.querySelectorAll('[data-testid^="db-life-collections-row-fish-"]')).toHaveLength(0);
        expect(control(host, "db-life-collections-chip-fishing").getAttribute("aria-pressed")).toBe("true");
        for (const [kind, id] of [["fishing", "spot_ux2"], ["forage", "area_ux2"], ["museum", "museum_ux2"], ["fish", "fish_ux2_1"]]) {
          control<HTMLButtonElement>(host, `db-life-collections-chip-${kind}`).click();
          control<HTMLButtonElement>(host, `db-life-collections-row-${kind}-${id}`).click();
          expect(host.querySelectorAll('[data-testid="small-task-open"]')).toHaveLength(0);
          expect(control(host, `db-life-collections-panel-${kind}-${id}`).hidden).toBe(false);
          expect(host.querySelectorAll('[data-testid^="db-life-collections-panel-"]')).toHaveLength(1);
        }
      });

      it("creates collapsed item chips on first expansion and retains them through search", () => {
        const { host } = mount();
        const card = control(host, "db-life-collections-museum-eligible-card");
        expect(host.querySelector('[data-testid="db-life-collections-museum-eligible"]')).toBeNull();
        card.querySelector<HTMLButtonElement>(".db-ws-card-toggle")!.click();
        const chips = control(host, "db-life-collections-museum-eligible");
        expect(chips.children).toHaveLength(store.getCurrent().database.items.length);
        inputSearch(host, "absent");
        expect(control(host, "db-life-collections-museum-eligible")).toBe(chips);
        card.querySelector<HTMLButtonElement>(".db-ws-card-toggle")!.click();
        card.querySelector<HTMLButtonElement>(".db-ws-card-toggle")!.click();
        expect(chips.children).toHaveLength(store.getCurrent().database.items.length);
      });

      it("preserves pre-debounce input across rendering and ignores the detached search callback", () => {
        const { host, rerender } = mount();
        const oldSearch = control(host, "db-life-collections-search");
        oldSearch.value = "Fish 1";
        oldSearch.dispatchEvent(new Event("input", { bubbles: true }));
        rerender();
        const search = inputSearch(host, "Fish 2");
        expect(search.value).toBe("Fish 2");
        expect(host.querySelector('[data-testid="db-life-collections-row-fish-fish_ux2_2"]')).not.toBeNull();
        expect(host.querySelector('[data-testid="db-life-collections-row-fish-fish_ux2_1"]')).toBeNull();
      });
    });
  });
  // 도구 목록·AI 내부 로그·마을 정보 창은 .database-modal-backdrop 을 써서 편집기 단축키 가드에 안 걸렸고,
  // 자기 document 리스너로만 Esc 를 받아 같은 Esc 가 뒤의 맵까지 내려갔다(에디터 적대적 리뷰 F52·F53).
  describe("editorModalInputIsolation", () => {
    isolateTimers();
    function keyOnBody(key: string): KeyboardEvent {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      Object.defineProperty(event, "target", { value: document.body });
      return event;
    }
    beforeEach(() => {
      resetModalStackForTest();
      store.replace(createBlankProject());
      document.body.innerHTML = "";
    });
    afterEach(() => {
      document.body.innerHTML = "";
      resetModalStackForTest();
    });
    describe("도구 목록·AI 내부 로그 창은 편집기 입력을 막는다", () => {
      const openers: readonly [string, () => HTMLElement][] = [
        ["tool-browser-modal", () => openToolBrowserModal()],
        ["ai-harness-modal", () => openHarnessModal({ audit: [], statusTimeline: [], getSnapshot: () => null })],
      ];

      for (const [testid, open] of openers) {
        it(`${testid}: 열려 있으면 도구 키·Delete·Ctrl+Z 가 맵으로 가지 않는다`, () => {
          expect(shouldIgnoreEditorShortcut(keyOnBody("Delete"))).toBe(false);
          expect(historyHotkeyOwnedByPanel()).toBe(false);
          open();
          expect(shouldIgnoreEditorShortcut(keyOnBody("Delete"))).toBe(true);
          expect(shouldIgnoreEditorShortcut(keyOnBody("1"))).toBe(true);
          expect(historyHotkeyOwnedByPanel()).toBe(true);
        });

        it(`${testid}: Esc 한 번은 창만 닫고 맵까지 내려가지 않는다`, () => {
          open();
          let reachedBehind = false;
          const behind = (event: KeyboardEvent): void => { if (event.key === "Escape") reachedBehind = true; };
          window.addEventListener("keydown", behind);
          try {
            document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
          } finally {
            window.removeEventListener("keydown", behind);
          }
          expect(document.querySelector(`[data-testid='${testid}']`)).toBeNull();
          expect(reachedBehind).toBe(false);
          expect(hasOpenModalLayer()).toBe(false);
          expect(shouldIgnoreEditorShortcut(keyOnBody("Delete"))).toBe(false);
        });
      }
    });
  });
  describe("elementKoreanDefaults", () => {
    isolateTimers();
    // qa1124 항목 8(오너 2026-11-24 «'전투 규칙' 의 속성은 이해하기가 어렵다»): 새 프로젝트 속성 이름이 영어(Sword·Hit·ATK…)였고
    // 배율은 등급 문자(A~E)로만 보였다.
    describe("속성 이름·배율 낱말", () => {
      it("새 프로젝트 기본 속성 이름에 영어가 없다", () => {
        const names = (createBlankProject().database.elements ?? []).map((element) => element.name);
        expect(names.length).toBeGreaterThan(0);
        expect(names.filter((name) => /[A-Za-z]/u.test(name))).toEqual([]);
      });

      it("작가가 손대지 않은 예전 영어 기본 이름은 한국어로 보이고, 작가가 바꾼 이름은 그대로다", () => {
        const db = (name: string) => ({ database: { elements: [{ id: "atk", name, kind: "magical" as const, rateLabels: ["A", "B", "C", "D", "E"] as const, damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } }] } }) as never;
        expect(elementDisplayName(db("ATK"), "atk")).toBe("공격력");
        expect(elementDisplayName(db("내 공격"), "atk")).toBe("내 공격");
      });

      it("배율을 낱말로 읽는다", () => {
        expect([200, 150, 100, 50, 0, -100, 300].map(elementGradeWord)).toEqual(["2배", "1.5배", "보통", "절반", "무효", "흡수", "3배"]);
      });
    });
  });
});
