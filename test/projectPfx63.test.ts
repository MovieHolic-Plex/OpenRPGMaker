import { describe, expect, it, beforeEach, vi } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { normalizeTerrainRecords } from "@/project/databaseUtilityRecordModel";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { applySideViewLanding, planSideViewTick, resolveSideViewSettings, sideViewFallDamage, sideViewGridFor, type SideViewGrid, type SideViewPlan, type SideViewState } from "@/player/sideViewPhysics";
import { DIALOGUE_FULL_PORTRAIT_DEFAULTS, normalizeDialogueFullPortraitSettings, normalizeDialogueFullScale, resolveDialogueFullPortraitLayout } from "@/project/dialogueStyles";
import { deserialize, serialize } from "@/project/io";
import { createEventDraft, beginExistingEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { editorState } from "@/editor/editorState";
import { setEventPageTextCommand } from "@/editor/eventPages";
import { editorWorkingEvents, eventDraftDiffById, findWorkingEventCoveringPoint, projectWithoutEventDrafts, projectWithPreservedEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest, getEventDraftVaultEntry } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import { findEventCoveringPoint } from "@/project/eventFootprintQuery";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";
import { buildChangeLedger, summarizeLedgerValue, type ChangeLedgerEntry } from "@/project/changeLedger";
import { getCharacterAppearance, listAppearanceUsages, resolveActorAppearance, resolveAppearancePortrait } from "@/project/characterAppearances";
import { collectUsedUploadedAssetIds } from "@/project/webExportAssets";
import { characterAppearanceProject } from "./fixtures/characterAppearanceProject";

describe("projectSuite2", () => {
  isolateTimers();
  // 옆보기 필드(GameMap.sideView): 중력·점프·사다리·낙하 피해 — player/sideViewPhysics.ts.
  describe("mgL8SideView", () => {
    isolateTimers();
    /** '#' 벽, 'H' 사다리, '.' 빈칸. */
    function gridOf(rows: string[]): SideViewGrid {
      const at = (x: number, y: number): string => rows[y]?.[x] ?? "#";
      return { solid: (x, y) => at(x, y) === "#", climbable: (x, y) => at(x, y) === "H" };
    }
    const SETTINGS = resolveSideViewSettings({});
    /** 입력을 주며 걸음을 즉시 적용해 틱을 돌린다(씬은 걸음 한 칸이 끝날 때마다 다음 틱을 부른다). */
    function run(grid: SideViewGrid, start: { x: number; y: number }, inputs: { x: number; y: number }[]) {
      const state: SideViewState = { fallTiles: 0, jumpRemaining: 0 };
      const pos = { ...start };
      const plans: SideViewPlan[] = [];
      for (const input of inputs) {
        const plan = planSideViewTick(grid, pos.x, pos.y, state, input, SETTINGS);
        plans.push(plan);
        pos.x += plan.dx;
        pos.y += plan.dy;
      }
      return { pos, plans, state };
    }
    const IDLE = { x: 0, y: 0 };
    describe("옆보기 중력", () => {
      it("발밑이 비면 입력 없이도 바닥까지 한 칸씩 떨어진다", () => {
        const grid = gridOf([
          "#####",
          "#...#",
          "#...#",
          "#...#",
          "#####",
        ]);
        const { pos, plans } = run(grid, { x: 2, y: 1 }, [IDLE, IDLE, IDLE, IDLE]);
        expect(plans.map((p) => p.kind)).toEqual(["fall", "fall", "none", "none"]);
        expect(pos).toEqual({ x: 2, y: 3 });
        expect(plans[2].landedFallTiles).toBe(2);
      });

      it("바닥에 서 있으면 떨어지지 않고 좌우로 걷는다", () => {
        const grid = gridOf(["#####", "#...#", "#####"]);
        const { pos, plans } = run(grid, { x: 1, y: 1 }, [{ x: 1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }]);
        expect(plans.map((p) => p.kind)).toEqual(["walk", "walk", "none"]);
        expect(pos).toEqual({ x: 3, y: 1 });
      });

      it("아래 방향키로는 땅을 파고 내려가지 않는다(탑다운 이동이 아니다)", () => {
        const grid = gridOf(["#####", "#...#", "#####"]);
        const { pos } = run(grid, { x: 2, y: 1 }, [{ x: 0, y: 1 }]);
        expect(pos).toEqual({ x: 2, y: 1 });
      });
    });
    describe("옆보기 점프", () => {
      it("위 키는 점프 높이만큼 오른 뒤 다시 떨어져 착지한다", () => {
        const grid = gridOf([
          "#####",
          "#...#",
          "#...#",
          "#...#",
          "#####",
        ]);
        const up = { x: 0, y: -1 };
        const { plans, pos } = run(grid, { x: 2, y: 3 }, [up, IDLE, IDLE, IDLE, IDLE]);
        expect(plans.map((p) => p.kind)).toEqual(["jump", "jump", "fall", "fall", "none"]);
        expect(pos).toEqual({ x: 2, y: 3 });
      });

      it("점프하며 옆으로 가면 턱 위에 올라선다", () => {
        const grid = gridOf([
          "######",
          "#....#",
          "#....#",
          "#..###",
          "######",
        ]);
        // (2,3) 에서 오른쪽 턱(x 3..4) 위로: 위+오른쪽으로 뛰고 계속 오른쪽을 누르면 턱 위 (4,2) 에 선다.
        const { pos, plans } = run(grid, { x: 2, y: 3 }, [{ x: 1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, IDLE]);
        expect(plans.map((p) => p.kind)).toEqual(["jump", "jump", "fall", "none"]);
        expect(pos).toEqual({ x: 4, y: 2 });
      });

      it("천장에 머리가 닿으면 상승을 멈춘다", () => {
        const grid = gridOf(["#####", "#...#", "#####"]);
        const { plans } = run(grid, { x: 2, y: 1 }, [{ x: 0, y: -1 }]);
        expect(plans[0].kind).toBe("none");
      });

      it("점프 높이 0 인 맵은 뛰지 않는다", () => {
        const grid = gridOf(["#####", "#...#", "#...#", "#####"]);
        const settings = resolveSideViewSettings({ sideViewJumpTiles: 0 });
        const state: SideViewState = { fallTiles: 0, jumpRemaining: 0 };
        expect(planSideViewTick(grid, 2, 2, state, { x: 0, y: -1 }, settings).kind).toBe("none");
      });
    });
    describe("옆보기 사다리", () => {
      it("사다리 칸에서는 떨어지지 않고 위아래로 오른다", () => {
        const grid = gridOf([
          "#####",
          "#.H.#",
          "#.H.#",
          "#.H.#",
          "#####",
        ]);
        const up = { x: 0, y: -1 };
        const climbed = run(grid, { x: 2, y: 3 }, [up, up, IDLE, IDLE]);
        expect(climbed.plans.map((p) => p.kind)).toEqual(["climb", "climb", "none", "none"]);
        expect(climbed.pos).toEqual({ x: 2, y: 1 });
        const down = run(grid, { x: 2, y: 1 }, [{ x: 0, y: 1 }]);
        expect(down.plans[0].kind).toBe("climb");
        expect(down.pos).toEqual({ x: 2, y: 2 });
      });

      it("사다리 꼭대기 위 칸에 서 있으면 사다리를 발판으로 딛는다", () => {
        const grid = gridOf(["#####", "#...#", "#.H.#", "#####"]);
        const { plans } = run(grid, { x: 2, y: 1 }, [IDLE]);
        expect(plans[0].kind).toBe("none");
      });
    });
    describe("옆보기 낙하 피해", () => {
      it("기준 칸 수를 넘은 만큼만 칸당 피해", () => {
        expect(sideViewFallDamage(4, SETTINGS)).toBe(0);
        expect(sideViewFallDamage(6, SETTINGS)).toBe(20);
        expect(sideViewFallDamage(3, resolveSideViewSettings({ sideViewFallTiles: 1, sideViewFallDamage: 5 }))).toBe(10);
      });

      it("긴 낙하 끝 착지가 파티 HP 를 깎는다", () => {
        const rows = ["#####", ...Array.from({ length: 8 }, () => "#...#"), "#####"];
        const { plans } = run(gridOf(rows), { x: 2, y: 1 }, Array.from({ length: 9 }, () => IDLE));
        const landing = plans.find((p) => p.landedFallTiles !== undefined);
        expect(landing?.landedFallTiles).toBe(7);

        const project = createBlankProject();
        const actorId = project.database.actors[0].id;
        const session = { partyActorIds: [actorId], actorVitals: {} as Record<string, { hp: number; mp: number }> };
        const result = applySideViewLanding(project, session as never, 7, SETTINGS);
        expect(result.damage).toBe(30);
        const vitals = session.actorVitals[actorId];
        expect(vitals).toBeDefined();
        expect(result.defeated).toBe(vitals.hp <= 0);
      });
    });
    describe("옆보기 프로젝트 격자", () => {
      it("타일 통행과 지형 climbable 을 읽고, climbable 은 불러오기 정규화에서 살아남는다", () => {
        // TILE.* are combined-town chip ids (water solid, grass open); the start map is beodeul_city since the 2026-10-07 purge.
        const project = startOnRetiredCombinedTown(createBlankProject());
        const map = project.maps[project.startMapId];
        const tileset = project.tilesets[map.tilesetId];
        map.lowerTiles.fill(TILE.GRASS);
        map.lowerTiles[0] = TILE.WATER;
        tileset.tileMeta ??= {};
        tileset.tileMeta[TILE.PATH] = { ...(tileset.tileMeta[TILE.PATH] ?? {}), terrainTag: 1 };
        map.lowerTiles[map.width + 1] = TILE.PATH;
        const terrains = normalizeTerrainRecords([{ id: "ladder", name: "사다리", climbable: true }]);
        expect(terrains[0].climbable).toBe(true);
        expect(normalizeTerrainRecords([{ id: "ground", name: "땅" }])[0]).not.toHaveProperty("climbable");
        project.database.terrains = terrains;
        const grid = sideViewGridFor(project, map);
        expect(grid.solid(0, 0)).toBe(true);
        expect(grid.solid(-1, 0)).toBe(true);
        expect(grid.solid(2, 2)).toBe(false);
        expect(grid.climbable(1, 1)).toBe(true);
        expect(grid.climbable(2, 2)).toBe(false);
      });
    });
  });
  describe("dialogueFullPortrait", () => {
    isolateTimers();
    describe("전신 초상 크기 설정", () => {
      it("기본값은 화면 높이 125%·내림 20%, 장면 배율은 곱해진다", () => {
        expect(resolveDialogueFullPortraitLayout(undefined)).toEqual({ heightRatio: 1.25, dropRatio: 0.2 });
        expect(resolveDialogueFullPortraitLayout({ height: 100, drop: 10 }, 150)).toEqual({ heightRatio: 1.5, dropRatio: 0.1 });
      });

      it("범위를 벗어나면 잘라 내고, 기본값과 같은 칸은 저장하지 않는다", () => {
        expect(normalizeDialogueFullPortraitSettings({ height: 999, drop: -5 })).toEqual({ height: 200, drop: 0 });
        expect(normalizeDialogueFullPortraitSettings({ ...DIALOGUE_FULL_PORTRAIT_DEFAULTS })).toBeUndefined();
        expect(normalizeDialogueFullPortraitSettings("big")).toBeUndefined();
        expect(normalizeDialogueFullScale(100)).toBeUndefined();
        expect(normalizeDialogueFullScale(10)).toBe(40);
        expect(normalizeDialogueFullScale(Number.NaN)).toBeUndefined();
      });

      it("프로젝트 기본과 장면 배율이 저장·불러오기를 지난다", () => {
        const project = createBlankProject();
        project.system.dialogueFullPortrait = { height: 90, drop: 35 };
        project.commonEvents.push({ id: "full-scale", name: "전신", trigger: "none", commands: [
          { kind: "changeFace", resourceId: "shared-people1-girl-expressions-full-base", fullScale: 130, position: "left", flipHorizontally: false },
        ] });
        const loaded = deserialize(serialize(project));
        expect(loaded.system.dialogueFullPortrait).toEqual({ height: 90, drop: 35 });
        expect(loaded.commonEvents.find((event) => event.id === "full-scale")?.commands[0]).toMatchObject({ fullScale: 130 });
      });

      it("장면 배율이 숫자가 아니면 불러오기가 거부한다", () => {
        const project = createBlankProject();
        project.commonEvents.push({ id: "bad", name: "전신", trigger: "none", commands: [
          { kind: "changeFace", resourceId: "", fullScale: "big" as unknown as number, position: "left", flipHorizontally: false },
        ] });
        expect(() => deserialize(serialize(project))).toThrow(/fullScale/);
      });
    });
  });
  describe("eventDrafts", () => {
    isolateTimers();
    beforeEach(() => {
      _resetEventDraftVaultForTest();
      store.replaceProject(createBlankProject());
      editorState.set({ selectedEventId: null, selectedEventPageId: null });
    });
    describe("event draft lifecycle", () => {
      it("publishes opening and cancelling an unchanged edit draft without scheduling autosave", async () => {
        const mapId = store.getCurrent().startMapId;
        const eventId = createEventDraft(mapId, 4, 4);
        saveEventDraft(mapId, eventId);
        store._setCleanPersistStateForTest();
        store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
        const changes = vi.fn();
        const saveStates = vi.fn();
        const unsubscribe = store.subscribe(changes);
        const unsubscribeSave = store.subscribeAutoSave(saveStates);

        try {
          expect(beginExistingEventDraft(mapId, eventId)).toBe(true);
          expect(store.hasUnsavedChanges()).toBe(false);
          expect(changes).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
            eventId, eventDraftStarted: true,
          }));
          expect(discardEventDraft(mapId, eventId)).toBe(true);
          expect(store.hasUnsavedChanges()).toBe(false);
          expect(changes).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ eventId }));
          expect(store.getCurrent().maps[mapId].events.find(event => event.id === eventId)?.draft).toBeUndefined();
          expect(saveStates).not.toHaveBeenCalled();

          beginExistingEventDraft(mapId, eventId);
          store.updateEvent(mapId, eventId, (event) => { event.name = "Edited"; });
          expect(store.hasUnsavedChanges()).toBe(true);
          expect(saveStates).toHaveBeenLastCalledWith({ kind: "pending" });

          saveStates.mockClear();
          saveEventDraft(mapId, eventId);
          expect(store.hasUnsavedChanges()).toBe(true);
          expect(saveStates).toHaveBeenLastCalledWith({ kind: "pending" });
        } finally {
          unsubscribe();
          unsubscribeSave();
          store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
          await store.flush(); // Clear the Apply autosave timer without writing.
        }
      });

      it("opens existing multi-page events on the first page by default", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        project.maps[mapId].events = [
          {
            id: "event_multi",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "event_multi_page_1",
                name: "Visible first page",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
              {
                id: "event_multi_page_2",
                name: "Conditional page",
                conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
        ];
        store.replace(project);

        expect(beginExistingEventDraft(mapId, "event_multi")).toBe(true);

        expect(editorState.get().selectedEventPageId).toBe("event_multi_page_1");
      });

      it("keeps the currently edited page selected after saving an event draft", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        project.maps[mapId].events = [
          {
            id: "event_multi",
            x: 2,
            y: 2,
            trigger: { kind: "action" },
            commands: [],
            pages: [
              {
                id: "event_multi_page_1",
                name: "Page 1",
                conditions: [],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
              {
                id: "event_multi_page_2",
                name: "Page 2",
                conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
                graphic: {},
                trigger: { kind: "action" },
                priority: "same",
                movement: { type: "fixed", speed: 3, frequency: 3 },
                commands: [],
              },
            ],
          },
        ];
        store.replace(project);
        beginExistingEventDraft(mapId, "event_multi");
        editorState.set({ selectedEventId: "event_multi", selectedEventPageId: "event_multi_page_2" });

        saveEventDraft(mapId, "event_multi");

        expect(editorState.get().selectedEventPageId).toBe("event_multi_page_2");
      });

      it("keeps a new working draft local while canonical projection omits it until Apply", () => {
        const mapId = store.getCurrent().startMapId;
        const initialEventCount = store.getCurrent().maps[mapId].events.length;
        const initialPersistedCount = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.length;
        const eventId = createEventDraft(mapId, 2, 2);

        expect(store.getCurrent().maps[mapId].events).toHaveLength(initialEventCount + 1);
        const persistedWhileDraft = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events;
        expect(persistedWhileDraft).toHaveLength(initialPersistedCount);
        expect(persistedWhileDraft.some((event) => event.id === eventId)).toBe(false);
        expect(store.getCurrent().maps[mapId].events.find((event) => event.id === eventId)?.draft?.kind).toBe("new");
        expect(getEventDraftVaultEntry(mapId, eventId)?.event.draft?.kind).toBe("new");

        const diff = eventDraftDiffById(store.getCurrent(), mapId, eventId);
        expect(diff?.kind).toBe("created");
        expect(diff?.changes.some((change) => change.path === "event")).toBe(true);

        saveEventDraft(mapId, eventId);

        const persisted = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events;
        expect(persisted).toHaveLength(initialPersistedCount + 1);
        expect(persisted.find((event) => event.id === eventId)?.draft).toBeUndefined();
        expect(getEventDraftVaultEntry(mapId, eventId)).toBeNull();
      });

      it("discards an unsaved new event without leaving persisted data behind", () => {
        const mapId = store.getCurrent().startMapId;
        const initialEventCount = store.getCurrent().maps[mapId].events.length;
        const initialPersistedCount = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.length;
        const eventId = createEventDraft(mapId, 3, 3);

        discardEventDraft(mapId, eventId);

        expect(store.getCurrent().maps[mapId].events).toHaveLength(initialEventCount);
        expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(initialPersistedCount);
        expect(store.getCurrent().maps[mapId].events.some((event) => event.id === eventId)).toBe(false);
      });

      it("selects the newly created draft event and its active page", () => {
        const mapId = store.getCurrent().startMapId;
        const eventId = createEventDraft(mapId, 5, 5);
        const pageId = store.getCurrent().maps[mapId].events.find((event) => event.id === eventId)?.pages?.[0]?.id;

        expect(editorState.get().selectedEventId).toBe(eventId);
        expect(editorState.get().selectedEventPageId).toBe(pageId);
      });

      it("keeps edit diffs locally while canonical projection stays at the original until Apply", () => {
        const mapId = store.getCurrent().startMapId;
        const eventId = createEventDraft(mapId, 4, 4);
        saveEventDraft(mapId, eventId);
        const pageId = store.getCurrent().maps[mapId].events.find((event) => event.id === eventId)?.pages?.[0]?.id;
        if (!pageId) throw new Error("default event page missing");

        beginExistingEventDraft(mapId, eventId);
        setEventPageTextCommand(mapId, eventId, pageId, undefined, "changed before save");

        // Canonical autosave/export remains at the explicit Apply baseline.
        const beforeSave = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.find((event) => event.id === eventId);
        expect(beforeSave?.pages?.[0]?.commands).toEqual([]);
        // The live session and local vault retain the current working body.
        expect(getEventDraftVaultEntry(mapId, eventId)?.event.pages?.[0]?.commands[0]).toEqual({
          kind: "text",
          body: "changed before save",
          speaker: undefined,
        });
        // Draft metadata still carries the pre-edit original for Cancel.
        const live = store.getCurrent().maps[mapId].events.find((event) => event.id === eventId);
        expect(live?.draft?.kind).toBe("edit");
        expect(live?.draft?.original?.pages?.[0]?.commands).toEqual([]);
        const diff = eventDraftDiffById(store.getCurrent(), mapId, eventId);
        expect(diff?.kind).toBe("updated");
        expect(diff?.changes.map((change) => change.path)).toContain("event.pages[0].commands[0]");

        saveEventDraft(mapId, eventId);

        const afterSave = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.find((event) => event.id === eventId);
        expect(afterSave?.pages?.[0]?.commands[0]).toEqual({
          kind: "text",
          body: "changed before save",
          speaker: undefined,
        });
      });

      it("reapplies local working drafts onto a canonical autosave snapshot", () => {
        const mapId = store.getCurrent().startMapId;
        const newEventId = createEventDraft(mapId, 6, 6);
        const existingId = createEventDraft(mapId, 7, 7);
        saveEventDraft(mapId, existingId);
        beginExistingEventDraft(mapId, existingId);
        const pageId = store.getCurrent().maps[mapId].events.find((event) => event.id === existingId)?.pages?.[0]?.id;
        if (!pageId) throw new Error("default event page missing");
        setEventPageTextCommand(mapId, existingId, pageId, undefined, "still editing");

        const live = store.getCurrent();
        const saved = projectWithoutEventDrafts(live);
        // Canonical snapshot omits the new draft and keeps the edit baseline.
        expect(saved.maps[mapId].events.some((event) => event.id === newEventId)).toBe(false);
        expect(saved.maps[mapId].events.find((event) => event.id === existingId)?.pages?.[0]?.commands).toEqual([]);

        const restored = projectWithPreservedEventDrafts(saved, live);
        const restoredNew = restored.maps[mapId].events.find((event) => event.id === newEventId);
        const restoredEdit = restored.maps[mapId].events.find((event) => event.id === existingId);
        expect(restoredNew?.draft?.kind).toBe("new");
        expect(restoredNew?.x).toBe(6);
        expect(restoredEdit?.draft?.kind).toBe("edit");
        expect(restoredEdit?.pages?.[0]?.commands[0]).toEqual({
          kind: "text",
          body: "still editing",
          speaker: undefined,
        });
      });
    });
    describe("findWorkingEventCoveringPoint", () => {
      it("finds the same event as the full working-copy scan, without draft metadata, and clones only the hit", () => {
        const base = { trigger: { kind: "action" }, commands: [] } as unknown as GameEvent;
        const plain = { ...base, id: "plain", x: 1, y: 1 } as GameEvent;
        const big = { ...base, id: "big", x: 4, y: 4, pages: [{ id: "p", trigger: { kind: "action" }, commands: [], footprint: { width: 2, height: 2 } }] } as unknown as GameEvent;
        const drafted = { ...base, id: "drafted", x: 7, y: 7, draft: { kind: "edit", original: { ...base, id: "drafted", x: 7, y: 7 } } } as unknown as GameEvent;
        const events = [plain, big, drafted];
        for (let y = 0; y < 10; y += 1) {
          for (let x = 0; x < 10; x += 1) {
            const expected = findEventCoveringPoint(editorWorkingEvents(events), x, y);
            const actual = findWorkingEventCoveringPoint(events, x, y);
            expect(actual).toEqual(expected);
          }
        }
        const hit = findWorkingEventCoveringPoint(events, 7, 7);
        expect(hit).not.toBe(drafted);
        expect(hit && "draft" in hit).toBe(false);
        expect(drafted.draft).toBeDefined();
      });
    });
  });
});

describe("projectSuite3", () => {
  isolateTimers();
  // 변경 내역(긴 명세) — 큰 위임의 검토는 칩이 아니라 항목별 before → after 로 한다.
  //
  // 깨질 것(실측 2026-09-14, 감독 지시): "before/after 가 굉장히 긴 명세여야 하는 것 아닌가.
  // 보통 맡기는 일이 매우 클텐데" — 지도 그림 두 장과 칩 한 줄로는 위임을 검토할 수 없다.
  describe("changeLedger", () => {
    isolateTimers();
    function blank(): { project: Project; mapId: string } {
      const project = createBlankProject();
      return { project, mapId: Object.keys(project.maps)[0]! };
    }
    function clone(project: Project): Project {
      return structuredClone(project) as Project;
    }
    function mapOf(project: Project, mapId: string): GameMap {
      const map = project.maps[mapId];
      if (!map) throw new TypeError(`맵 없음: ${mapId}`);
      return map;
    }
    function event(id: string, name: string, x: number, y: number): GameEvent {
      return { id, name, x, y, trigger: "action", commands: [], pages: [] } as unknown as GameEvent;
    }
    function entryFor(entries: readonly ChangeLedgerEntry[], label: string): ChangeLedgerEntry {
      const entry = entries.find((candidate) => candidate.label === label);
      if (!entry) throw new Error(`항목 없음: ${label} — ${entries.map((candidate) => candidate.label).join(", ")}`);
      return entry;
    }
    function mapLabel(project: Project, mapId: string): string {
      return `${mapOf(project, mapId).name} (${mapId})`;
    }
    describe("buildChangeLedger — 항목별 before → after", () => {
      it("이벤트가 움직이면 영역·이름·좌표 변화가 나온다", () => {
        const { project: before, mapId } = blank();
        mapOf(before, mapId).events = [event("e1", "NPC_가드", 1, 1)];
        const after = clone(before);
        mapOf(after, mapId).events = [event("e1", "NPC_가드", 4, 7)];

        const { entries } = buildChangeLedger(before, after);
        const entry = entryFor(entries, "NPC_가드");

        expect(entry.area).toContain("이벤트 ·");
        expect(entry.change).toBe("changed");
        expect(entry.detail).toEqual(expect.arrayContaining(["X: 1 → 4", "Y: 1 → 7"]));
      });

      it("새 이벤트는 추가로, 지운 이벤트는 삭제로 남는다 — 어느 쪽도 조용히 사라지지 않는다", () => {
        const { project: before, mapId } = blank();
        mapOf(before, mapId).events = [event("e0", "사라진 경비", 2, 2)];
        const after = clone(before);
        mapOf(after, mapId).events = [event("e1", "새 상인", 5, 5)];

        const { entries } = buildChangeLedger(before, after);

        expect(entryFor(entries, "새 상인").change).toBe("added");
        expect(entryFor(entries, "새 상인").detail).toEqual(expect.arrayContaining(["X: 5", "Y: 5"]));
        expect(entryFor(entries, "사라진 경비").change).toBe("removed");
        expect(entryFor(entries, "사라진 경비").detail).toEqual(expect.arrayContaining(["X: 2"]));
      });

      it("퀘스트는 key 가 신원이고 title 이 이름이다", () => {
        const { project: before } = blank();
        const after = clone(before);
        after.quests = [{ key: "quest_bell", title: "종을 되찾아라", summary: "…", steps: [] } as never];

        const quest = entryFor(buildChangeLedger(before, after).entries, "종을 되찾아라");

        expect(quest.area).toBe("퀘스트");
        expect(quest.change).toBe("added");
        expect(quest.detail).toEqual(expect.arrayContaining(["제목: 종을 되찾아라"]));
      });

      it("데이터베이스 레코드의 필드 변화가 값과 함께 나온다", () => {
        const { project: before } = blank();
        before.database = { ...before.database, items: [{ id: "item_1", name: "포션", price: 50 } as never] };
        const after = clone(before);
        after.database = { ...after.database, items: [{ id: "item_1", name: "큰 포션", price: 120 } as never] };

        const item = entryFor(buildChangeLedger(before, after).entries, "큰 포션");

        expect(item.area).toBe("데이터베이스 · 아이템");
        expect(item.detail).toEqual(expect.arrayContaining(["이름: 포션 → 큰 포션", "가격: 50 → 120"]));
      });

      it("맵 타일은 칸 수로 요약한다 — 만 칸짜리 배열을 명세에 쏟지 않는다", () => {
        const { project: before, mapId } = blank();
        const after = clone(before);
        const map = mapOf(after, mapId);
        map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
        map.lowerTiles[1] = (map.lowerTiles[1] ?? 0) + 1;

        const detail = entryFor(buildChangeLedger(before, after).entries, mapLabel(after, mapId)).detail ?? [];

        expect(detail).toContain("아래층 타일: 2칸 바뀜");
        // 이벤트는 자기 항목이 맡는다 — 맵 항목이 이벤트 목록 전체를 요약하지 않는다.
        expect(detail.some((line) => line.startsWith("이벤트:"))).toBe(false);
      });

      it("맵 이름·인카운터 같은 속성 변화도 이름을 얻는다", () => {
        const { project: before, mapId } = blank();
        const after = clone(before);
        mapOf(after, mapId).name = "달빛 숲";
        mapOf(after, mapId).encounterRate = 12;

        const detail = entryFor(buildChangeLedger(before, after).entries, mapLabel(after, mapId)).detail ?? [];

        expect(detail).toEqual(expect.arrayContaining([`이름: ${summarizeLedgerValue(before.maps[mapId]!.name)} → 달빛 숲`]));
        expect(detail).toEqual(expect.arrayContaining(["인카운터율: 없음 → 12"]));
      });

      it("프로젝트 정보 같은 싱글톤도 필드별로 나온다", () => {
        const { project: before } = blank();
        const after = clone(before);
        after.meta = { ...after.meta, title: "새 게임", author: "나" };

        const meta = entryFor(buildChangeLedger(before, after).entries, "게임 정보");

        expect(meta.area).toBe("프로젝트 정보");
        expect(meta.detail).toEqual(expect.arrayContaining([`제목: ${summarizeLedgerValue(before.meta.title)} → 새 게임`]));
      });

      it("모르는 모양의 필드도 남는다 — 변경이 사라지지 않는다", () => {
        const { project: before } = blank();
        const after = clone(before);
        after.aiInstructions = "항상 한국어로";

        expect(entryFor(buildChangeLedger(before, after).entries, "AI 지시문").after).toBe("항상 한국어로");
      });

      it("아무것도 안 바뀌면 빈 명세", () => {
        const { project: before } = blank();
        const ledger = buildChangeLedger(before, clone(before));
        expect(ledger.entries).toEqual([]);
        expect(ledger.total).toBe(0);
      });

      it("상한을 넘으면 자르되 전체 수를 잃지 않는다", () => {
        const { project: before, mapId } = blank();
        const after = clone(before);
        mapOf(after, mapId).events = Array.from({ length: 12 }, (_, index) => event(`e${index}`, `NPC_${index}`, index, index));

        const ledger = buildChangeLedger(before, after, { maxEntries: 5 });

        expect(ledger.entries).toHaveLength(5);
        expect(ledger.total).toBeGreaterThan(5);
      });
    });
    describe("summarizeLedgerValue", () => {
      it("긴 본문은 잘라 한 줄로 만든다 — 명세가 카드를 삼키지 않게", () => {
        const summary = summarizeLedgerValue("가".repeat(400));
        expect(summary.length).toBeLessThanOrEqual(91);
        expect(summary.endsWith("…")).toBe(true);
      });

      it("빈 값·목록·불리언을 사람이 읽는 말로 바꾼다", () => {
        expect(summarizeLedgerValue(undefined)).toBe("없음");
        expect(summarizeLedgerValue("")).toBe("빈 값");
        expect(summarizeLedgerValue(["a", "b"])).toBe("a, b (2개)");
        expect(summarizeLedgerValue([{ a: 1 }, { b: 2 }])).toBe("2개 항목");
        expect(summarizeLedgerValue(true)).toBe("true");
      });

      it("중첩 개체는 JSON 대신 키 이름으로 — 명세에 소음을 쏟지 않는다", () => {
        expect(summarizeLedgerValue({ hp: "HP", mp: "MP" })).toBe("hp HP, mp MP (2개)");
        expect(summarizeLedgerValue({ pages: [{}, {}], commands: [] })).toBe("pages, commands … (2개 항목)");
        expect(summarizeLedgerValue({})).toBe("빈 값");
      });
    });
  });
  describe("characterAppearanceSets", () => {
    isolateTimers();
    describe("character appearance authored boundary", () => {
      it.each([
        ["non-array catalog", {}],
        ["missing name", [{ id: "look", description: "" }]],
        ["duplicate ids", [{ id: "look", name: "A", description: "" }, { id: "look", name: "B", description: "" }]],
        ["invalid slot", [{ id: "look", name: "A", description: "", charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 8 } }]],
        ["missing resource", [{ id: "look", name: "A", description: "", face: { resourceId: "missing-face" } }]],
        ["wrong resource kind", [{ id: "look", name: "A", description: "", face: { resourceId: "easyrpg-charset-actor1" } }]],
      ])("rejects %s when loading authored appearances", (_name, characterAppearances) => {
        // Given authored JSON at the existing load boundary.
        const project = createBlankProject();
        const wire = JSON.stringify({ ...project, database: { ...project.database, characterAppearances } });
        // When / Then malformed authored fields must not be silently retained or dropped.
        expect(() => deserialize(wire)).toThrow();
      });

      it("keeps the catalog absent when loading a legacy project", () => {
        // Given a legacy project with no catalog.
        const project = createBlankProject();
        // When it crosses the persistence boundary.
        const loaded = deserialize(serialize(project));
        // Then no empty catalog is invented.
        expect(Object.hasOwn(loaded.database, "characterAppearances")).toBe(false);
      });

      it("preserves catalog, page link, and actor link across save and reload", () => {
        // Given a complete set and an intentionally empty set.
        const project = characterAppearanceProject();
        const legacyActor = { ...project.database.actors[0] };
        // When persisted through the canonical path.
        const loaded = deserialize(serialize(project));
        // Then references and legacy direct fields survive together.
        expect(loaded.database.characterAppearances).toEqual(project.database.characterAppearances);
        expect(loaded.database.actors[0].appearanceId).toBe("look");
        expect(loaded.database.actors[0].characterResourceId).toBe(legacyActor.characterResourceId);
        expect(loaded.maps[loaded.startMapId].events[0].pages?.[0].graphic.appearanceId).toBe("look");
        expect(getCharacterAppearance(loaded, "empty")).toEqual({ id: "empty", name: "Empty", description: "" });
        expect(collectUsedUploadedAssetIds(loaded)).toContain("uploaded-walk");
      });

      it.each(["actor", "page", "command"] as const)("rejects dangling %s links when reloading", (target) => {
        // Given a reference to an absent set.
        const project = characterAppearanceProject();
        const event = project.maps[project.startMapId].events[0];
        switch (target) {
          case "actor": project.database.actors[0].appearanceId = "missing"; break;
          case "page": {
            const page = event.pages?.[0];
            if (!page) throw new Error("fixture page missing");
            page.graphic.appearanceId = "missing";
            break;
          }
          case "command": event.commands = [{ kind: "changeFace", resourceId: "", appearanceId: "missing", position: "left", flipHorizontally: false }]; break;
        }
        // When / Then load rejects instead of erasing authored intent.
        expect(() => deserialize(serialize(project))).toThrow(/appearanceId/);
      });

      it("reports actors, pages, and nested common-event commands when checking usages", () => {
        // Given a reference nested under a loop.
        const project = characterAppearanceProject();
        project.commonEvents.push({ id: "appearance-common", name: "Portrait", trigger: "none", commands: [
          { kind: "loop", body: [{ kind: "changeFace", resourceId: "", appearanceId: "look", position: "left", flipHorizontally: false }] },
        ] });
        // When deletion protection asks for usages.
        const usages = listAppearanceUsages(project, "look");
        // Then each reference kind blocks unsafe deletion.
        expect(usages.map((usage) => usage.kind)).toEqual(["actor", "event", "command"]);
        expect(listAppearanceUsages(project, "empty")).toEqual([]);
      });

      it("falls back to legacy direct slots when an actor links an incomplete set", () => {
        // Given a metadata-only appearance.
        const project = characterAppearanceProject();
        const actor = { ...project.database.actors[0], appearanceId: "empty" };
        // When effective slots are projected.
        const effective = resolveActorAppearance(project, actor);
        // Then omitted set slots retain legacy values and authoring stays intact.
        expect(effective).toEqual(actor);
        expect(resolveAppearancePortrait(project, "empty", "bust")).toBeUndefined();
      });

      it("rejects a charset upload with an unsupported authored sheet layout", () => {
        // Given a purported charset that cannot contain eight 3x4 characters.
        const project = characterAppearanceProject();
        project.assets.uploaded["uploaded-walk"].meta.width = 48;
        // When / Then the linked resource cannot silently use an arbitrary slice.
        expect(() => deserialize(serialize(project))).toThrow(/charset/);
      });

      it.each([
        ["bust", "generated-face-actor1-bust"],
        ["bust", "generated-face-actor1-full"],
        // 생성 영웅 얼굴(generated-actor-hero-01-face)은 생성 계획에서 rejected 라 더는 고를 수 없다 — 출하 얼굴 칸으로 본다.
        ["face", "easyrpg-faceset-actor1-00"],
      ] as const)("accepts built-in portrait %s/%s offered by the picker", (slot, resourceId) => {
        // Given a real built-in picture, without a redundant project profile.
        const project = characterAppearanceProject();
        project.resourceProfiles = project.resourceProfiles.filter((profile) => profile.assetId !== resourceId);
        project.database.characterAppearances = [{ id: "look", name: "Guide", description: "", [slot]: { resourceId } }];
        // When the authored selection crosses the save/load boundary.
        const loaded = deserialize(serialize(project));
        // Then the picker choice remains valid with explicit bust presentation.
        expect(resolveAppearancePortrait(loaded, "look", slot)?.resourceId).toBe(resourceId);
      });
    });
  });
});
