import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { canCraft, craftRecipe } from "@/project/craftRecipes";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import type { Project, GameMap, PassFlag, TileAiMetadata, TilesetDef, EndingDef, GameEvent, ActorQueryCondition } from "@/project/types";
import { counterReachTarget, deriveCounterTiles, effectiveCounterTiles, isCounterCell, setCounterTile } from "@/project/counterTiles";
import { npcMoveDurationMs, npcMoveIntervalMs, npcWalkFrameMsForStep, PLAYER_WALK_STEP_MS } from "@/project/characterMotion";
import { DIALOGUE_FULL_PORTRAIT_DEFAULTS, normalizeDialogueFullPortraitSettings, normalizeDialogueFullScale, resolveDialogueFullPortraitLayout } from "@/project/dialogueStyles";
import { EMOTE_FRAME_SIZE, EMOTE_KINDS, emoteFrameIndex, isEmoteKind } from "@/project/emotes";
import { collectEndingWarnings } from "../src/project/endings";
import { createEventDraft, beginExistingEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { editorState } from "@/editor/editorState";
import { setEventPageTextCommand } from "@/editor/eventPages";
import { editorWorkingEvents, eventDraftDiffById, findWorkingEventCoveringPoint, projectWithoutEventDrafts, projectWithPreservedEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest, getEventDraftVaultEntry, eventDraftVaultStorageKey, persistEventDraftVaultNow, rememberEventDraftVaultEntry, listEventDraftVaultEntries, forgetEventDraftVaultEntry, restoreEventDraftVaultEntries, syncEventDraftVaultFromProject } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import { findEventCoveringPoint } from "@/project/eventFootprintQuery";
import { evalActorQueryCondition, type ActorQuerySession } from "@/project/conditionActorQueries";
import { runTool, type ToolContext } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { mapTexture } from "@/project/mapTexture";
import { adjustEffectiveFactionStance, applyPlayerKillReputation, effectiveFactionStance, factionStancePairKey, parseFactionStanceOverrides, setEffectiveFactionStance } from "@/project/factionRuntime";
import { factionStance, PLAYER_FACTION_ID, resolveFactionTable } from "@/project/factions";
import { isolateTimers } from "./mergedTeardown";

describe("cookingStation", () => {
  isolateTimers();
  const FRIED_EGG = {
    id: "recipe_fried_egg",
    name: "계란프라이",
    ingredients: [{ itemId: "item_egg", count: 2 }],
    outputItemId: "item_fried_egg",
    outputCount: 1,
    goldCost: 10,
  };
  function projectWithRecipe(): Project {
    const project = createBlankProject();
    const itemTemplate = project.database.items[0];
    if (!itemTemplate) throw new Error("blank project must include an item template");
    project.database.items.push(
      { ...itemTemplate, id: "item_egg", name: "달걀" },
      { ...itemTemplate, id: "item_fried_egg", name: "계란프라이" },
    );
    project.system.craftRecipes = [FRIED_EGG];
    return project;
  }
  describe("요리 레시피", () => {
    it("재료와 골드가 충분하면 제작되고 인벤토리가 정확히 갱신된다", () => {
      const project = projectWithRecipe();
      const session = startSession(project, 1);
      session.inventory.item_egg = 3;
      session.gold = 100;

      const result = craftRecipe(project, session, "recipe_fried_egg");
      expect(result.ok).toBe(true);
      expect(session.inventory.item_egg).toBe(1);
      expect(session.inventory.item_fried_egg).toBe(1);
      expect(session.gold).toBe(90);
    });

    it("재료가 모자라면 실패하고 인벤토리·골드가 변하지 않는다", () => {
      const project = projectWithRecipe();
      const session = startSession(project, 1);
      session.inventory.item_egg = 1;
      session.gold = 100;

      expect(craftRecipe(project, session, "recipe_fried_egg")).toEqual({ ok: false, reason: "missing-ingredients" });
      expect(session.inventory.item_egg).toBe(1);
      expect(session.inventory.item_fried_egg ?? 0).toBe(0);
      expect(session.gold).toBe(100);
    });

    it("골드가 모자라면 실패하고 재료가 소비되지 않는다", () => {
      const project = projectWithRecipe();
      const session = startSession(project, 1);
      session.inventory.item_egg = 3;
      session.gold = 5;

      expect(craftRecipe(project, session, "recipe_fried_egg")).toEqual({ ok: false, reason: "missing-gold" });
      expect(session.inventory.item_egg).toBe(3);
    });

    it("레시피가 없으면 시스템 자체가 비활성으로 보고된다(옵트인)", () => {
      const project = createBlankProject();
      const session = startSession(project, 1);
      expect(canCraft(project, session, "recipe_fried_egg")).toEqual({ ok: false, reason: "disabled" });
    });

    it("craftRecipes 가 저장/로드 왕복에서 보존된다", () => {
      const loaded = deserialize(serialize(projectWithRecipe()));
      expect(loaded.system.craftRecipes?.[0]).toMatchObject({ id: "recipe_fried_egg", outputItemId: "item_fried_egg" });
    });
  });
});

describe("counterTilesAndWalkSpeed", () => {
  isolateTimers();
  const OPEN: PassFlag = { up: true, down: true, left: true, right: true };
  const SHUT: PassFlag = { up: false, down: false, left: false, right: false };
  function tileset(): TilesetDef {
    const meta = (label: string): TileAiMetadata => ({ label, description: "", role: "furniture" });
    return {
      id: "t", name: "t", image: { type: "bundled", id: "x" }, tileSize: 16, tilesPerRow: 8, count: 5,
      passability: [OPEN, SHUT, OPEN, SHUT, SHUT], priority: ["lower", "upper", "upper", "upper", "upper"], terrain: [0, 0, 0, 0, 0],
      tileMeta: [meta("바닥"), meta("카운터 2×1 (0,0)"), meta("카운터 2×1 (0,-1)"), meta("바 의자 (0,0)"), meta("vegetable crate")],
    } as TilesetDef;
  }
  function map(): GameMap {
    // 3×5: 0행 벽 뒤 바닥, 1행 카운터 윗면(통과), 2행 카운터 발밑(막힘), 3·4행 바닥.
    const w = 3, h = 5;
    const lower = new Array(w * h).fill(0);
    const upper = new Array(w * h).fill(-1);
    for (let x = 0; x < w; x++) { upper[1 * w + x] = 2; upper[2 * w + x] = 1; }
    return { id: "m", width: w, height: h, lowerTiles: lower, upperTiles: upper, events: [] } as unknown as GameMap;
  }
  describe("counter tiles", () => {
    it("derives blocked counter/table furniture only — not the walkable top, stools or English substrings", () => {
      expect(deriveCounterTiles(tileset())).toEqual([1]);
    });

    it("reaches the cell beyond a counter, and stops at a non-counter cell", () => {
      const t = tileset(), m = map();
      expect(isCounterCell(t, m, 1, 2)).toBe(true);
      expect(isCounterCell(t, m, 1, 1)).toBe(false);
      const hit = counterReachTarget(t, m, { x: 1, y: 2 }, { x: 0, y: -1 }, (x, y) => x === 1 && y === 1);
      expect(hit).toEqual({ x: 1, y: 1 });
      // 정면이 카운터가 아니면 너머를 보지 않는다.
      expect(counterReachTarget(t, m, { x: 1, y: 3 }, { x: 0, y: -1 }, () => true)).toBeNull();
    });

    it("an explicit list wins; setCounterTile freezes the derived default first", () => {
      const t = tileset();
      expect(setCounterTile(t, 4, true)).toBe(true);
      expect(t.counterTiles).toEqual([1, 4]);
      setCounterTile(t, 1, false);
      setCounterTile(t, 4, false);
      expect(effectiveCounterTiles(t)).toEqual([]);
      expect(counterReachTarget(t, map(), { x: 1, y: 2 }, { x: 0, y: -1 }, () => true)).toBeNull();
    });
  });
  describe("NPC walk speed table", () => {
    it("normal NPC (3) walks at half the player's pace; chaser ranks 6-8 are unchanged", () => {
      expect(npcMoveDurationMs(3)).toBe(PLAYER_WALK_STEP_MS * 2);
      expect(npcMoveDurationMs(6)).toBe(160);
      expect(npcMoveDurationMs(7)).toBe(80);
      expect(npcMoveDurationMs(8)).toBe(80);
      for (let r = 1; r < 8; r++) expect(npcMoveDurationMs(r)).toBeGreaterThanOrEqual(npcMoveDurationMs(r + 1));
      expect(npcMoveIntervalMs(3)).toBe(560);
    });

    it("shows two walk patterns per tile so feet follow travel speed", () => {
      expect(npcWalkFrameMsForStep(npcMoveDurationMs(3))).toBe(160);
      expect(npcWalkFrameMsForStep(80)).toBe(60);
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

// 이모트 어휘(EMOTE_KINDS) ↔ 시트 페인터 ↔ 커밋된 PNG 드리프트 게이트.
// 한쪽만 늘어나거나 순서가 바뀌면 프레임 인덱스가 어긋나 엉뚱한 아이콘이 뜬다.
describe("emoteSheet", () => {
  isolateTimers();
  type RenderModule = {
    readonly EMOTE_SLUGS: readonly string[];
    readonly paintedEmoteSlugs: () => readonly string[];
    readonly renderEmoteSheetPng: () => Uint8Array;
  };
  type FsLike = { readonly readFileSync: (path: URL | string) => Uint8Array };
  const loadRenderer = async (): Promise<RenderModule> => {
    const moduleName = "../scripts/lib/emoteSheet/render.mjs";
    return (await import(moduleName)) as RenderModule;
  };
  const loadFs = async (): Promise<FsLike> => {
    const moduleName = "node:fs";
    return (await import(moduleName)) as FsLike;
  };
  const SHEET_URL = new URL("../public/assets/generated-emotes.png", import.meta.url);
  describe("이모트 시트", () => {
    it("EMOTE_KINDS 와 페인터 목록이 순서까지 같다", async () => {
      const renderer = await loadRenderer();
      expect(renderer.EMOTE_SLUGS).toEqual([...EMOTE_KINDS]);
      expect([...renderer.paintedEmoteSlugs()].sort()).toEqual([...EMOTE_KINDS].sort());
    });

    it("커밋된 PNG 가 현재 페인터 출력과 바이트까지 같다", async () => {
      const [renderer, fs] = await Promise.all([loadRenderer(), loadFs()]);
      const committed = fs.readFileSync(SHEET_URL);
      expect(Buffer.from(committed).equals(Buffer.from(renderer.renderEmoteSheetPng()))).toBe(true);
    });

    it("PNG 크기가 이모트 수 × 프레임 크기다", async () => {
      const fs = await loadFs();
      const bytes = Buffer.from(fs.readFileSync(SHEET_URL));
      expect(bytes.readUInt32BE(16)).toBe(EMOTE_KINDS.length * EMOTE_FRAME_SIZE);
      expect(bytes.readUInt32BE(20)).toBe(EMOTE_FRAME_SIZE);
    });

    it("프레임 인덱스는 목록 순서이고 kind 판별이 어휘를 지킨다", () => {
      EMOTE_KINDS.forEach((kind, index) => {
        expect(emoteFrameIndex(kind)).toBe(index);
        expect(isEmoteKind(kind)).toBe(true);
      });
      expect(isEmoteKind("nope")).toBe(false);
      expect(isEmoteKind(undefined)).toBe(false);
    });
  });
});

describe("endingWarningsPriority", () => {
  isolateTimers();
  const ending = (id: string, priority: number): EndingDef => ({ id, name: id, conditions: [], priority } as EndingDef);
  describe("collectEndingWarnings — priority 는 조건으로 고르는 호출에서만 의미가 있다", () => {
    const endings = [ending("a", 10), ending("b", 5), ending("c", 5)];

    it("기본값은 예전처럼 같은 조건 집합의 priority 경고를 낸다", () => {
      const warnings = collectEndingWarnings(endings);
      expect(warnings.some((w) => w.includes("엔딩 도달 불능: b"))).toBe(true);
    });

    it("이름으로만 부르는 프로젝트(priorityMatters:false)에서는 소음 경고를 내지 않는다", () => {
      expect(collectEndingWarnings(endings, { priorityMatters: false })).toEqual([]);
    });

    it("priorityMatters:false 라도 불가능한 조건 충돌은 계속 알린다", () => {
      const impossible = { id: "x", name: "x", priority: 1, conditions: [
        { kind: "switch", switchId: "s", value: true }, { kind: "switch", switchId: "s", value: false },
      ] } as EndingDef;
      expect(collectEndingWarnings([impossible], { priorityMatters: false }).join("\n")).toContain("ON/OFF");
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

describe("eventDraftVaultPersistDebounce", () => {
  isolateTimers();
  const DRAFT: GameEvent = {
    id: "draft-event",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [],
    draft: { kind: "new" },
  };
  function countingLocalStorage(): { writes: () => string[]; storage: Record<string, unknown> } {
    const writes: string[] = [];
    const values = new Map<string, string>();
    return {
      writes: () => [...writes],
      storage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          writes.push(key);
          values.set(key, value);
        },
        removeItem: (key: string) => void values.delete(key),
      },
    };
  }
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const PAST_VAULT_DEBOUNCE_MS = 420;
  describe("event draft vault persist debounce", () => {
    let counting: ReturnType<typeof countingLocalStorage>;

    beforeEach(() => {
      _resetEventDraftVaultForTest();
      counting = countingLocalStorage();
      vi.stubGlobal("localStorage", counting.storage);
    });

    afterEach(() => {
      _resetEventDraftVaultForTest();
      vi.unstubAllGlobals();
    });

    it("an explicit persist cancels the debounce it supersedes, so no duplicate write lands", async () => {
      const key = eventDraftVaultStorageKey();
      rememberEventDraftVaultEntry("map_blank_start", DRAFT);

      persistEventDraftVaultNow();
      expect(counting.writes().filter((entry) => entry === key)).toHaveLength(1);

      await wait(PAST_VAULT_DEBOUNCE_MS);

      expect(counting.writes().filter((entry) => entry === key)).toHaveLength(1);
    });

    it("a later remember still schedules its own persist after an explicit one", async () => {
      const key = eventDraftVaultStorageKey();
      persistEventDraftVaultNow();
      rememberEventDraftVaultEntry("map_blank_start", DRAFT);

      await wait(PAST_VAULT_DEBOUNCE_MS);

      expect(counting.writes().filter((entry) => entry === key).length).toBeGreaterThanOrEqual(1);
    });

    it("public copies cannot change a cached save and deletion/restore invalidate it", () => {
      const key = eventDraftVaultStorageKey();
      rememberEventDraftVaultEntry("map_blank_start", DRAFT);
      persistEventDraftVaultNow();
      const saved = listEventDraftVaultEntries();
      saved[0]!.event.x = 42;
      persistEventDraftVaultNow();
      const read = () => JSON.parse((counting.storage.getItem as (key: string) => string)(key));
      expect(read().entries[0].event.x).toBe(1);
      forgetEventDraftVaultEntry("map_blank_start", DRAFT.id);
      persistEventDraftVaultNow();
      expect((counting.storage.getItem as (key: string) => string | null)(key)).toBeNull();
      restoreEventDraftVaultEntries(saved);
      saved[0]!.event.x = 99;
      persistEventDraftVaultNow();
      expect(read().entries[0].event.x).toBe(42);
    });
    it("reuses immutable event lists but recovers forgotten drafts and new map keys", () => {
      let reads = 0;
      const events = new Proxy([DRAFT, ...Array.from({ length: 1000 }, (_, i) => ({ ...DRAFT, id: `normal-${i}`, draft: undefined }))], {
        get(target, key, receiver) { if (/^\d+$/.test(String(key))) reads++; return Reflect.get(target, key, receiver); },
      });
      const project = { maps: { a: { events } } } as unknown as Project;
      syncEventDraftVaultFromProject(project);
      expect(reads).toBeGreaterThan(1000);
      reads = 0;
      syncEventDraftVaultFromProject(project);
      expect(reads).toBe(0);
      forgetEventDraftVaultEntry("a", DRAFT.id);
      syncEventDraftVaultFromProject(project);
      syncEventDraftVaultFromProject({ maps: { b: { events } } } as unknown as Project);
      expect(listEventDraftVaultEntries().map(e => e.mapId).sort()).toEqual(["a", "b"]);
      expect(reads).toBe(0);
    });

  });
});

describe("eventSightWatchers", () => {
  isolateTimers();
  // 벽 x=3(문틈 y=5), 경비 둘이 서로 마주 본다, 문 이벤트가 문틈에 선다.
  const wall = (x: number, y: number): boolean => x === 3 && y >= 0 && y <= 9 && y !== 5;
  const events = [
    { id: "guard_a", name: "성문 경비", characterId: "guard", x: 1, y: 5, commands: [] },
    { id: "guard_b", name: "성문 경비", characterId: "guard", x: 8, y: 5, commands: [] },
    { id: "door", name: "문", x: 3, y: 5, commands: [{ kind: "transfer", mapId: "m", x: 0, y: 0 }] },
  ];
  const positions: Record<string, { x: number; y: number; direction?: "left" | "right" }> = {
    guard_a: { x: 1, y: 5, direction: "right" },
    guard_b: { x: 8, y: 5, direction: "left" },
    door: { x: 3, y: 5 },
  };
  const NIGHT = { hour: 23, minute: 0, day: 1, season: "spring" as const, year: 1 };
  const NOON = { hour: 12, minute: 0, day: 1, season: "spring" as const, year: 1 };
  function sees(condition: Partial<Extract<ActorQueryCondition, { kind: "eventSeesPlayer" }>>, x: number, y: number, extra: Partial<ActorQuerySession> = {}, ambient?: number): boolean {
    const session: ActorQuerySession = { partyActorIds: [], actorVitals: {}, x, y, flags: {}, currentMapId: "m", ...extra };
    return evalActorQueryCondition(session, { kind: "eventSeesPlayer", eventId: "", ...condition } as ActorQueryCondition, {}, {
      eventPosition: (id) => positions[id],
      blocksSight: wall,
      mapEvents: () => events,
      ambient: () => ambient,
      locations: () => [],
    });
  }
  describe("eventSeesPlayer optional fields", () => {
    it("keeps the old outcome when no new field is set", () => {
      expect(sees({ eventId: "guard_a", range: 5 }, 2, 5)).toBe(true);
      expect(sees({ eventId: "guard_a", range: 5 }, 5, 5)).toBe(true);
      expect(sees({ eventId: "guard_a", range: 5 }, 4, 3)).toBe(false);
      expect(sees({ eventId: "guard_a", range: 2 }, 4, 5)).toBe(false);
      expect(sees({ eventId: "guard_b", range: 5 }, 6, 5, { gameTime: NIGHT }, 0.9)).toBe(true);
    });

    it("doorsBlock closes the door gap", () => {
      expect(sees({ eventId: "guard_a", range: 5, doorsBlock: true }, 5, 5)).toBe(false);
    });

    it("darkness shortens sight only at night or in the dark", () => {
      expect(sees({ eventId: "guard_b", range: 5, darkness: { dark: 1 } }, 6, 5, {}, 0.9)).toBe(false);
      expect(sees({ eventId: "guard_b", range: 5, darkness: { dark: 1 } }, 6, 5, {}, 0.2)).toBe(true);
      expect(sees({ eventId: "guard_b", range: 5, darkness: { night: 1 } }, 6, 5, { gameTime: NIGHT })).toBe(false);
      expect(sees({ eventId: "guard_b", range: 5, darkness: { night: 1 } }, 6, 5, { gameTime: NOON })).toBe(true);
    });

    it("watchers pick anyone matching; not-seen means nobody sees", () => {
      expect(sees({ watchers: { name: "경비" }, range: 5 }, 7, 5)).toBe(true);
      expect(sees({ watchers: { characterId: "guard" }, range: 5 }, 2, 5)).toBe(true);
      expect(sees({ watchers: { name: "기사" }, range: 5 }, 7, 5)).toBe(false);
      expect(sees({ watchers: { name: "경비" }, range: 5, value: false }, 4, 0)).toBe(true);
      expect(sees({ watchers: { name: "경비" }, range: 5, value: false }, 7, 5)).toBe(false);
    });
  });
});

describe("examineHotspotVisibility", () => {
  isolateTimers();
  describe("place_examine_hotspots 보이지 않는 조사 지점", () => {
    it("그림 생략·투명 명시 모두 대체 그림 없이 투명으로 두고 빈 바닥 경고", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const res = runTool(ctx, "place_examine_hotspots", {
        mapId,
        hotspots: [
          { at: { x: 3, y: 3 }, name: "메멘토: 낡은 턴테이블", lines: ["바늘이 멈춰 있다."] },
          { at: { x: 4, y: 3 }, name: "숨은 쪽지", lines: ["글씨"], graphic: { transparent: true } },
          { at: { x: 5, y: 3 }, name: "보물 상자", lines: ["비어 있다."], graphic: { query: "보물 상자" } },
        ],
      });
      expect(res.ok, res.summary).toBe(true);
      expect(res.summary).toContain("2개는 빈 바닥 위 투명");
      const notes = JSON.stringify(res.warnings ?? res.diff);
      expect(notes).not.toContain("보석 표식");
      expect(notes).toContain("메멘토: 낡은 턴테이블");
      expect(notes).toContain("숨은 쪽지");
      expect(notes).not.toContain("보물 상자,");
      const turntable = ctx.project.maps[mapId]!.events.find((event) => event.pages?.[0]?.name === "메멘토: 낡은 턴테이블");
      expect(turntable?.pages?.[0]?.graphic).toEqual({ transparent: true });
    });
  });
  /** 지배 바닥이면서 통행 가능·비어 있는 칸 — 게임 검사 dream-invisible-objects 와 같은 기준. */
  function barePassableCell(project: Project, taken: ReadonlySet<string>): { x: number; y: number } {
    const map = project.maps[project.startMapId]!;
    const texture = mapTexture(map);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const index = y * map.width + x;
        if (map.lowerTiles[index] === texture.dominantTile && !(map.upperTiles[index] > 0)
          && isPassable(project, map, x, y) && !taken.has(`${x},${y}`)) return { x, y };
      }
    }
    throw new Error("빈 판 통행 가능 칸을 찾지 못했습니다");
  }
  function occupy(map: GameMap, at: { x: number; y: number }): ReadonlySet<string> {
    return new Set([...map.events.map((event) => `${event.x},${event.y}`), `${at.x},${at.y}`]);
  }
  describe("upsert_event 맨바닥 조사 사물", () => {
    it("이름에 맞는 그림이 없는 조사 사물(제단)은 보석 등 대체 그림 없이 투명 + 경고", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const at = barePassableCell(ctx.project, new Set(ctx.project.maps[mapId]!.events.map((event) => `${event.x},${event.y}`)));
      const res = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_truth_altar", name: "고대 진실의 제단", x: at.x, y: at.y, trigger: { kind: "action" }, commands: [{ kind: "text", body: "제단에 글씨가 새겨져 있다." }] },
      });
      expect(res.ok, res.summary).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_truth_altar");
      expect(event?.pages?.[0]?.graphic?.sprite).toBeUndefined();
      expect(event?.pages?.[0]?.graphic?.transparent).toBe(true);
      expect(event?.pages?.[0]?.priority).toBe("below");
      const notes = (res.diff?.warnings ?? []).join(" ");
      expect(notes).toContain("보이지 않습니다");
      expect(notes).not.toContain("보석 표식");
    });

    it("명시 graphic:{transparent:true} 는 의도로 받아 투명 그대로", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const at = barePassableCell(ctx.project, new Set(ctx.project.maps[mapId]!.events.map((event) => `${event.x},${event.y}`)));
      const res = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_invisible_note", x: at.x, y: at.y, trigger: { kind: "action" },
          pages: [{ conditions: [], graphic: { transparent: true }, commands: [{ kind: "text", body: "보이지 않는 기록." }] }],
        },
      });
      expect(res.ok, res.summary).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_invisible_note");
      expect(event?.pages?.[0]?.graphic?.transparent).toBe(true);
      expect(event?.pages?.[0]?.graphic?.sprite).toBeUndefined();
    });

    it("그 칸에 위층 장식이 있으면(사물 타일이 그림) 투명으로 남고 경고만 한다", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const map = ctx.project.maps[mapId]!;
      const taken = new Set(map.events.map((event) => `${event.x},${event.y}`));
      const at = barePassableCell(ctx.project, taken);
      // 위층 칸 하나를 골라 통행성까지 유지하는 장식 타일을 찾는다(통행을 깨면 이벤트가 다른 칸으로 옮겨 간다).
      const index = at.y * map.width + at.x;
      const original = map.upperTiles[index]!;
      let decor = original;
      for (let tile = 1; tile < 600; tile++) {
        if (tile === original) continue;
        map.upperTiles[index] = tile;
        if (isPassable(ctx.project, map, at.x, at.y)) { decor = tile; break; }
      }
      expect(decor).not.toBe(original);
      const res = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_tiled_statue", x: at.x, y: at.y, trigger: { kind: "action" }, commands: [{ kind: "text", body: "타일 위 석상." }] },
      });
      expect(res.ok, res.summary).toBe(true);
      // runTool 은 ctx.project 를 새 객체로 바꾼다 — 이전에 들고 있던 지도로는 결과가 안 보인다(핸드오프 함정).
      const stored = ctx.project.maps[mapId]!;
      const event = stored.events.find((entry) => entry.id === "ev_tiled_statue");
      expect(event?.pages?.[0]?.graphic?.sprite).toBeUndefined();
      expect(event?.pages?.[0]?.graphic?.transparent).toBe(true);
      expect((res.diff?.warnings ?? []).join(" ")).toContain("보이지 않습니다");
      expect((res.diff?.warnings ?? []).join(" ")).not.toContain("보석 표식");
    });
  });
});

describe("factionRuntime", () => {
  isolateTimers();
  const table = resolveFactionTable({
    defs: [
      { id: "bandit", name: "산적" },
      { id: "guard", name: "경비병" },
      { id: "watch", name: "자경단" },
    ],
    relations: [
      { a: "bandit", b: "guard", stance: -1 },
      { a: "guard", b: "watch", stance: 1 },
    ],
  });
  describe("runtime faction stance overlay", () => {
    it("matches authored behavior exactly when the overlay is absent", () => {
      for (const a of table.ids) {
        for (const b of table.ids) {
          expect(effectiveFactionStance(table, undefined, a, b)).toBe(factionStance(table, a, b));
        }
      }
    });

    it("uses stable unambiguous ordered-pair keys and stores only changed directions", () => {
      expect(factionStancePairKey("a|b", "c")).not.toBe(factionStancePairKey("a", "b|c"));
      const changed = setEffectiveFactionStance(table, {}, "guard", PLAYER_FACTION_ID, -1);
      expect(Object.keys(changed).sort()).toEqual([
        factionStancePairKey(PLAYER_FACTION_ID, "guard"),
        factionStancePairKey("guard", PLAYER_FACTION_ID),
      ].sort());
      expect(setEffectiveFactionStance(table, changed, "guard", PLAYER_FACTION_ID, 0)).toEqual({});
    });

    it("clamps absolute and delta updates while preserving fractional reputation", () => {
      let overrides = setEffectiveFactionStance(table, {}, "guard", PLAYER_FACTION_ID, 99);
      expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(2);
      overrides = adjustEffectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID, -0.25);
      expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(1.75);
      overrides = adjustEffectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID, -99);
      expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(-2);
    });

    it("takes the more hostile direction even for asymmetric loaded overlays", () => {
      const overrides = parseFactionStanceOverrides({
        [factionStancePairKey("guard", "bandit")]: 2,
        [factionStancePairKey("bandit", "guard")]: -2,
      });
      expect(effectiveFactionStance(table, overrides, "guard", "bandit")).toBe(-2);
      expect(effectiveFactionStance(table, overrides, "bandit", "guard")).toBe(-2);
    });

    it("warms enemies of the defeated faction and cools it plus its allies", () => {
      const changed = applyPlayerKillReputation(table, {}, "guard", 0.25);
      expect(effectiveFactionStance(table, changed, "bandit", PLAYER_FACTION_ID)).toBe(0.25);
      expect(effectiveFactionStance(table, changed, "guard", PLAYER_FACTION_ID)).toBe(-0.25);
      expect(effectiveFactionStance(table, changed, "watch", PLAYER_FACTION_ID)).toBe(-0.25);
    });
  });
});
