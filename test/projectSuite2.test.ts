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
import type { GameEvent } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

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
