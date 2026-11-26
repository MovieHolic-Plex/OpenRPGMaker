import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditor, syncMountedEventSelection } from "@/editor/panels/eventEditor";
import { requestEditorCameraFocus, subscribeEditorCameraFocus, type CameraFocusTarget } from "@/editor/editorCameraFocus";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { EventPage, GameEvent, ProjectFactions, EnemyActionCondition, Project, FarmAnimalBuildingDefinition, FarmAnimalSpeciesRecord, GameMap } from "@/project/types";
import { FakeElement, installFakeDom, findByTestId } from "./fakeDom";
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
import { IMAGE_GENERATION_MODEL, IMAGE_GENERATION_PROVIDER_ID, ImageGenerationError, generateAiImage, imageGenerationEndpoint, imageGenerationUsesOtherProvider } from "@/ai/imageGenerationClient";
import { IMAGE_CHATGPT_LOGIN_REQUIRED, RECOMMENDED_IMAGE_MODEL, RECOMMENDED_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";
import { defaultAiConfig } from "@/ai/llmClient";
import { closestLibraryPictures, imageFailureNextStep, isImageCredentialFailure } from "@/editor/imageGenerationFallback";
import { generateOpeningStill } from "@/editor/openingImageGeneration";
import { generateTitleArt } from "@/editor/titleArtGeneration";
import { createImageGenerationQueue } from "@/ai/imageGenerationQueue";
import { getTool } from "@/editor/tools";
import { IMAGE_GENERATION_UNAVAILABLE_CODE, imageGenerationFailureCode, imageGenerationUnavailableError, imageGenerationUnavailableInstruction, imageUnavailableGateNotice } from "@/editor/imageGenerationNotice";
import { isImageGenerationUnavailableResult, reportImageGenerationUnavailable } from "@/editor/panels/imageGenerationGate";
import { isolateTimers } from "./mergedTeardown";
import { searchProject } from "@/editor/panels/mapEventSearchModel";
import { mapAiBadges } from "@/editor/panels/mapTreeAiBadges";
import type { MapRunTicket } from "@/editor/aiMapRunQueue";
import type { Presence } from "@/editor/panels/aiPresence";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { parseEmotionCycle, renderSystemTab } from "@/editor/panels/databaseSystemView";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { databaseReferenceMessage } from "@/editor/databaseReferences";
import { renderFarmAnimalsTab } from "@/editor/panels/databaseFarmAnimalsView";
import { collectProjectReferenceIssues, repairProjectReferences, validateProjectReferences } from "@/project/io/references";
import { applyMapDeletion, collectMapDeletionImpact } from "@/project/mapDeletion";
import { resetToastsForTest } from "@/util/toast";

describe("eventListCameraFocus", () => {
  isolateTimers();
  let restoreFakeDom: () => void = () => undefined;
  function fakeContainer(): HTMLElement {
    return new FakeElement("div") as unknown as HTMLElement;
  }
  function page(): EventPage {
    return {
      id: "page-1",
      name: "EV001",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function event(): GameEvent {
    return { id: "event-1", x: 7, y: 4, trigger: { kind: "action" }, commands: [], pages: [page()] };
  }
  describe("event list → editor camera focus", () => {
    beforeEach(() => {
      _resetEventDraftVaultForTest();
      restoreFakeDom = installFakeDom();
      const project = createBlankProject();
      project.maps[project.startMapId].events = [event()];
      store.replace(project);
      editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
    });

    afterEach(() => {
      document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
      _resetEventDraftVaultForTest();
      restoreFakeDom();
    });

    it("pub/sub delivers focus target to subscribers", () => {
      const received: CameraFocusTarget[] = [];
      const unsub = subscribeEditorCameraFocus((target) => received.push(target));
      requestEditorCameraFocus({ mapId: "m1", tileX: 3, tileY: 5 });
      unsub();
      // After unsubscribe, further requests must not arrive.
      requestEditorCameraFocus({ mapId: "m1", tileX: 1, tileY: 1 });
      expect(received).toEqual([{ mapId: "m1", tileX: 3, tileY: 5 }]);
    });

    it("clicking a map-event list row requests camera focus on that event tile", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;

      const received: CameraFocusTarget[] = [];
      const unsub = subscribeEditorCameraFocus((target) => received.push(target));

      const sidebar = fakeContainer();
      renderEventEditor(sidebar);

      const row = sidebar.querySelector<HTMLElement>('[data-testid="event-list-row-event-1"]');
      expect(row).not.toBeNull();
      row?.click();

      unsub();

      // Selection (existing behavior) still updates editorState.
      expect(editorState.get().selectedEventId).toBe("event-1");
      expect(editorState.get().tool).toBe("event");
      expect(editorState.get().layer).toBe("event");

      // New behavior: exactly one focus request at the event's tile on this map.
      expect(received).toEqual([{ mapId, tileX: 7, tileY: 4 }]);
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

describe("imageGeneration", () => {
  isolateTimers();
  describe("imageGenerationClient", () => {
    isolateTimers();
    function jsonResponse(body: unknown, status = 200): Response {
      return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    }
    describe("imageGenerationClient", () => {
      it("defaults to the ChatGPT image provider, not Gemini", () => {
        expect(IMAGE_GENERATION_PROVIDER_ID).toBe("openai-codex");
        expect(IMAGE_GENERATION_MODEL).toBe("codex-image-default");
      });

      it("동반 서비스의 같은 오리진 /v1 경로를 친다", () => {
        expect(imageGenerationEndpoint()).toBe("/v1/images/generations");
      });

      it("그림은 항상 이미지 지원 제공자로 보낸다", async () => {
        const seen: { url: string; provider: string; body: unknown }[] = [];
        const image = await generateAiImage(
          { prompt: "슬라임" },
          {
            fetch: async (input, init) => {
              const headers = new Headers(init?.headers);
              seen.push({
                url: String(input),
                provider: headers.get("X-Oprn-Provider") ?? "",
                body: JSON.parse(String(init?.body ?? "{}")),
              });
              return jsonResponse({
                image: {
                  dataUrl: "data:image/png;base64,AAA",
                  mimeType: "image/png",
                  model: IMAGE_GENERATION_MODEL,
                  provider: IMAGE_GENERATION_PROVIDER_ID,
                },
              });
            },
          },
        );

        expect(seen).toHaveLength(1);
        expect(seen[0]!.url).toBe("/v1/images/generations");
        expect(seen[0]!.provider).toBe(RECOMMENDED_IMAGE_PROVIDER_ID);
        expect(seen[0]!.body).toEqual({ prompt: "슬라임", model: RECOMMENDED_IMAGE_MODEL });
        expect(image.dataUrl).toBe("data:image/png;base64,AAA");
      });

      it("빈 프롬프트는 요청 전에 거부한다", async () => {
        let calls = 0;
        await expect(
          generateAiImage({ prompt: "  " }, { fetch: async () => { calls += 1; return jsonResponse({}); } }),
        ).rejects.toThrow(ImageGenerationError);
        expect(calls).toBe(0);
      });

      it("사용자 중단과 요청 시간 초과를 구분한다", async () => {
        const abortError = new DOMException("중단", "AbortError");
        const controller = new AbortController();
        controller.abort();

        await expect(
          generateAiImage({ prompt: "슬라임", signal: controller.signal }, { fetch: async () => { throw abortError; } }),
        ).rejects.toThrow("생성을 취소했습니다");
        await expect(
          generateAiImage({ prompt: "슬라임" }, { fetch: async () => { throw abortError; } }),
        ).rejects.toThrow("이미지 생성이 시간 안에 끝나지 않았습니다.");
      });

      it("서버 오류 본문의 사람이 읽는 메시지를 그대로 올린다", async () => {
        await expect(
          generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ error: "이미지 생성은 …만 지원합니다." }, 409) }),
        ).rejects.toThrow("이미지 생성은 …만 지원합니다.");
      });

      it("ChatGPT 인증에 실패하면 다른 제공자를 부르지 않고 로그인 안내를 올린다", async () => {
        const seen: [string | null, string][] = [];
        const result = generateAiImage(
          { prompt: "슬라임", model: "gemini-3.1-flash-image", providerId: "google-antigravity" },
          { fetch: async (_input, init) => {
            seen.push([new Headers(init?.headers).get("X-Oprn-Provider"), JSON.parse(String(init?.body)).model]);
            return jsonResponse({ error: "Unauthorized" }, 401);
          } },
        );
        await expect(result).rejects.toBeInstanceOf(ImageGenerationError);
        await expect(result).rejects.toMatchObject({ message: IMAGE_CHATGPT_LOGIN_REQUIRED, status: 401 });
        expect(seen).toEqual([["openai-codex", "codex-image-default"]]);
      });

      it("dataUrl 이 없는 200 응답도 실패로 본다", async () => {
        await expect(
          generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ image: { mimeType: "image/png" } }) }),
        ).rejects.toThrow(ImageGenerationError);
      });

      it("대화 제공자와 그림 제공자가 같을 때만 다른 제공자 안내가 필요 없다", () => {
        const config = { ...defaultAiConfig(), providerId: "google-antigravity" };
        expect(config.imageProviderId).toBe(IMAGE_GENERATION_PROVIDER_ID);
        expect(imageGenerationUsesOtherProvider(config)).toBe(true);
        expect(imageGenerationUsesOtherProvider({ ...config, providerId: "openai-codex" })).toBe(false);
      });
    });
  });
  describe("imageGenerationFallback", () => {
    isolateTimers();
    // 2026-10-25 심사(salad-omo-1 「그림 생성이 Google 로그인 요구」 7건): 그림 연결이 없을 때 실패 안내가 «제작을 멈추라»고 시켜 턴이 멈췄다.
    const LOGIN = "이미지를 만들려면 AI 설정 → Google Antigravity 로그인에서 연결해 주세요.";
    const noLogin = async () => { throw new ImageGenerationError(LOGIN, 401); };
    describe("image generation fallback when the image login is missing", () => {
      it("treats a missing login as a failure that won't clear up during this run", () => {
        expect(isImageCredentialFailure(new ImageGenerationError(LOGIN, 401))).toBe(true);
        expect(isImageCredentialFailure(new ImageGenerationError("이미지 생성이 시간 안에 끝나지 않았습니다."))).toBe(false);
      });

      it("names the closest library pictures by description, skipping city skylines for a fairy-tale scene", () => {
        const picks = closestLibraryPictures("동화 같은 숲 마을의 밤");
        expect(picks.length).toBeGreaterThan(0);
        expect(picks.some((pick) => /skyline|city/u.test(pick.id))).toBe(false);
      });

      it("the next step says to keep building, never to stop", () => {
        const step = imageFailureNextStep("title", "숲 마을", new ImageGenerationError(LOGIN, 401));
        expect(step).toContain("다시 부르지 마라");
        expect(step).toContain("계속한다");
        expect(step).toContain("턴을 멈추지 않는다");
        expect(step).not.toContain("멈추고");
      });

      it("opening and title-art failures carry the fallback instead of a stop order", async () => {
        const opening = await generateOpeningStill({ prompt: "새벽 안개 낀 숲속 마을 광장, 아무도 없는 풍경" }, { generateImage: noLogin });
        expect(opening.ok).toBe(false);
        if (!opening.ok) {
          expect(opening.summary).toContain("Antigravity");
          expect(opening.summary).toContain("턴을 멈추지 않는다");
          expect(opening.summary).not.toContain("제작을 멈추고");
        }
        const title = await generateTitleArt({ prompt: "동화 공방의 오르골" }, { generateImage: noLogin, fitEffects: false });
        expect(title.ok).toBe(false);
        if (!title.ok) expect(title.summary).toContain("set_title_screen");
      });
    });
  });
  describe("imageGenerationQueue", () => {
    isolateTimers();
    function deferred<T>(): {
      readonly promise: Promise<T>;
      readonly resolve: (value: T) => void;
      readonly reject: (error: unknown) => void;
    } {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((innerResolve, innerReject) => {
        resolve = innerResolve;
        reject = innerReject;
      });
      return { promise, resolve, reject };
    }
    describe("imageGenerationQueue", () => {
      it("빈 프롬프트는 넣지 않는다", () => {
        const queue = createImageGenerationQueue({ runner: async () => "x" });
        expect(() => queue.enqueue({ prompt: "  " })).toThrow();
        expect(queue.getSnapshot().jobs).toHaveLength(0);
      });

      it("작업은 들어온 순서대로 끝나고 상태가 전이된다", async () => {
        const order: string[] = [];
        const queue = createImageGenerationQueue({
          runner: async (job) => {
            order.push(job.label);
            return `data:${job.label}`;
          },
        });
        const seen: string[][] = [];
        queue.subscribe((snapshot) => seen.push(snapshot.jobs.map((job) => job.status)));
        const first = queue.enqueue({ prompt: "슬라임", kind: "backdrop" });
        const second = queue.enqueue({ prompt: "고블린", kind: "backdrop" });
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs.every((job) => job.status === "done")).toBe(true);
        });
        expect(order).toEqual(["슬라임", "고블린"]);
        const jobs = queue.getSnapshot().jobs;
        expect(jobs.map((job) => job.id)).toEqual([first, second]);
        expect(jobs[0]!.attempts).toBe(1);
        expect(jobs[0]!.result).toBe("data:슬라임");
        expect(seen.flat()).toContain("running");
        expect(queue.getSnapshot().queued).toBe(0);
        expect(queue.getSnapshot().running).toBe(0);
      });

      it("동시성은 직렬이 기본이고 실패한 작업은 에러를 들고 멈춘다", async () => {
        let active = 0;
        let peak = 0;
        const queue = createImageGenerationQueue({
          runner: async (job) => {
            active += 1;
            peak = Math.max(peak, active);
            try {
              if (job.label === "깨짐") throw new Error("서버 불량");
              await new Promise((resolve) => setTimeout(resolve, 5));
              return "ok";
            } finally {
              active -= 1;
            }
          },
        });
        queue.enqueue({ prompt: "하나" });
        queue.enqueue({ prompt: "깨짐" });
        queue.enqueue({ prompt: "셋" });
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs.filter((job) => job.status === "done")).toHaveLength(2);
        });
        expect(peak).toBe(1);
        const snapshot = queue.getSnapshot();
        expect(snapshot.failed).toBe(1);
        const failed = snapshot.jobs.find((job) => job.label === "깨짐")!;
        expect(failed.status).toBe("error");
        expect(failed.error).toBe("서버 불량");
      });

      it("실행 중 취소는 결과를 버리고 다음 작업을 돌린다", async () => {
        const gate = deferred<string>();
        const started: string[] = [];
        const queue = createImageGenerationQueue({
          runner: async (job, options) => {
            started.push(job.label);
            if (job.label === "느림") {
              // runner 가 signal 을 무시하고 늦게 resolve 해도 큐는 버려야 한다.
              void options.signal;
              return gate.promise;
            }
            return "fast";
          },
        });
        const slow = queue.enqueue({ prompt: "느림" });
        queue.enqueue({ prompt: "빠름" });
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs.find((job) => job.id === slow)?.status).toBe("running");
        });
        expect(queue.cancel(slow)).toBe(true);
        gate.resolve("late-data");
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs.find((job) => job.label === "빠름")?.status).toBe("done");
        });
        const slowJob = queue.getSnapshot().jobs.find((job) => job.id === slow)!;
        expect(slowJob.status).toBe("cancelled");
        expect(slowJob.result).toBeNull();
        expect(started).toEqual(["느림", "빠름"]);
        queue.dispose();
      });

      it("취소 후 재시도하면 이전 실행의 늦은 결과는 버린다", async () => {
        const first = deferred<string>();
        const second = deferred<string>();
        let calls = 0;
        const queue = createImageGenerationQueue({
          runner: async () => {
            calls += 1;
            return calls === 1 ? first.promise : second.promise;
          },
        });
        const id = queue.enqueue({ prompt: "느림" });
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs[0]?.status).toBe("running");
        });
        expect(queue.cancel(id)).toBe(true);
        expect(queue.retry(id)).toBe(true);
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs[0]?.attempts).toBe(2);
        });
        // 취소된 첫 실행이 늦게 성공해도 재시도 실행에는 닿지 않는다. 첫 promise 의
        // continuation 은 runOne 이 먼저 붙였으므로, 여기서 await 하면 stale 분기가
        // 완전히 정착한 뒤에 깨어난다(고정 sleep 없이 결정적이다).
        first.resolve("stale-data");
        await first.promise;
        const during = queue.getSnapshot().jobs[0]!;
        expect(during.status).toBe("running");
        expect(during.result).toBeNull();
        // 재시도 실행의 결과만 적용된다.
        second.resolve("fresh-data");
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs[0]?.status).toBe("done");
        });
        expect(queue.getSnapshot().jobs[0]?.result).toBe("fresh-data");
        queue.dispose();
      });

      it("대기 중 취소는 runner 를 부르지 않고 재시도하면 다시 돈다", async () => {
        const gate = deferred<string>();
        let calls = 0;
        const queue = createImageGenerationQueue({
          runner: async (job) => {
            calls += 1;
            if (job.label === "차단") return gate.promise;
            if (calls === 2) throw new Error("한 번 실패");
            return "recovered";
          },
        });
        queue.enqueue({ prompt: "차단" });
        const waiting = queue.enqueue({ prompt: "대기" });
        expect(queue.cancel(waiting)).toBe(true);
        expect(calls).toBe(1);
        gate.resolve("blocker-done");
        const failed = queue.enqueue({ prompt: "실패" });
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.status).toBe("error");
        });
        expect(queue.retry(failed)).toBe(true);
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.status).toBe("done");
        });
        expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.attempts).toBe(2);
        expect(queue.cancel(failed)).toBe(false);
        expect(queue.retry(failed)).toBe(false);
      });

      it("clearFinished 는 끝난 것만 걷고 실패는 남긴다", async () => {
        const queue = createImageGenerationQueue({
          runner: async (job) => {
            if (job.label === "깨짐") throw new Error("불량");
            return "ok";
          },
        });
        queue.enqueue({ prompt: "성공" });
        const bad = queue.enqueue({ prompt: "깨짐" });
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs.every((job) => job.status !== "queued" && job.status !== "running")).toBe(true);
        });
        queue.clearFinished();
        const remaining = queue.getSnapshot().jobs;
        expect(remaining.map((job) => job.id)).toEqual([bad]);
      });

      it("구독 해지는 이후 알림을 받지 않는다", () => {
        const queue = createImageGenerationQueue({ runner: async () => "x" });
        let calls = 0;
        const off = queue.subscribe(() => {
          calls += 1;
        });
        queue.enqueue({ prompt: "하나" });
        const afterEnqueue = calls;
        off();
        queue.enqueue({ prompt: "둘" });
        expect(calls).toBe(afterEnqueue);
        queue.dispose();
      });

      it("concurrency 상한은 1~4 로 고정된다", async () => {
        let active = 0;
        let peak = 0;
        const queue = createImageGenerationQueue({
          concurrency: 99,
          runner: async () => {
            active += 1;
            peak = Math.max(peak, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active -= 1;
            return "ok";
          },
        });
        for (let index = 0; index < 8; index += 1) queue.enqueue({ prompt: `작업${index}` });
        await vi.waitFor(() => {
          expect(queue.getSnapshot().jobs.every((job) => job.status === "done")).toBe(true);
        });
        expect(peak).toBeLessThanOrEqual(4);
        queue.dispose();
      });
    });
  });
  describe("imageGenerationUnavailableNotice", () => {
    isolateTimers();
    describe("image generation unavailable — loud failure", () => {
      it("keeps the wire code that every surface matches on", () => {
        expect(IMAGE_GENERATION_UNAVAILABLE_CODE).toBe("image-generation-unavailable");
      });

      it("returns a hard error that carries the code and the agent instruction verbatim", () => {
        const error = imageGenerationUnavailableError();
        expect(error.name).toBe("ToolError");
        expect(error.code).toBe(IMAGE_GENERATION_UNAVAILABLE_CODE);
        expect(error.message).toBe(imageGenerationUnavailableInstruction());
      });

      it("materialises a gate notice of the image-unavailable kind with one reason and one fix", () => {
        const notice = imageUnavailableGateNotice();
        expect(notice.kind).toBe("image-unavailable");
        expect(notice.reasons).toHaveLength(1);
        expect(notice.nextSteps).toHaveLength(1);
      });

      it("recognises the failure result only through the code and raises the gate once", () => {
        const shown: string[] = [];
        const raised = reportImageGenerationUnavailable(
          { summary: `x ${IMAGE_GENERATION_UNAVAILABLE_CODE} y` },
          (notice) => shown.push(notice.kind),
        );
        expect(raised).toBe(true);
        expect(shown).toEqual(["image-unavailable"]);
        expect(isImageGenerationUnavailableResult({ summary: "정상 완료" })).toBe(false);
        expect(isImageGenerationUnavailableResult({ issues: [{ code: IMAGE_GENERATION_UNAVAILABLE_CODE }] })).toBe(true);
      });

      it("raises the same loud code for a credential failure, not a generic image failure", () => {
        // 자동 Google 대체를 없애면서 「자격 없음」이 새로 도달 가능해졌다 — 그 실패가 조용한 일반 실패로 남으면
        // 캔버스 띠·차단 모달이 뜨지 않는다. 일시 오류는 한 번 더 시도할 수 있으므로 구분을 유지한다.
        expect(imageGenerationFailureCode(new ImageGenerationError("ChatGPT 로그인이 필요합니다", 401))).toBe(IMAGE_GENERATION_UNAVAILABLE_CODE);
        expect(imageGenerationFailureCode(new ImageGenerationError("일시 오류", 502))).toBe("image-generation-failed");
        expect(imageGenerationFailureCode(new Error("network down"))).toBe("image-generation-failed");
      });

      it("fails the real registry tool hard with that code instead of reporting success", () => {
        expect(getTool("generate_opening_image")?.mode).toBe("write");
        const result = runTool({ project: createBlankProject() }, "generate_opening_image", { prompt: "폐허가 된 성문 앞의 새벽" });
        expect(result.ok).toBe(false);
        expect(result.issues?.map((issue) => issue.code)).toContain(IMAGE_GENERATION_UNAVAILABLE_CODE);
        expect(isImageGenerationUnavailableResult(result)).toBe(true);
      });
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

// 전투 자원·감정·장비 부여·장비 강화의 편집기 노출(#7 #9 #16 #21 #23). 폼에서 바꾼 값이 저장값에 닿는지 본다.
describe("mgL3BattleResourceEditor", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    project.database.states = [{ id: "state_joy", name: "기쁨" }];
    project.database.equipment = [
      normalizeEquipmentRecord({ id: "equip_blade", name: "검", slot: "weapon" }),
      normalizeEquipmentRecord({ id: "equip_blade_plus", name: "검+", slot: "weapon" }),
    ];
    store.replace(project);
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  function byTestId(root: FakeElement, testid: string): FakeElement {
    const node = findByTestId(root, testid);
    if (!node) throw new Error(`missing ${testid}`);
    return node;
  }
  function change(root: FakeElement, testid: string, value: string): void {
    const node = byTestId(root, testid);
    node.value = value;
    node.dispatchEvent(new Event("change"));
  }
  function check(root: FakeElement, testid: string, checked: boolean): void {
    const node = byTestId(root, testid);
    node.checked = checked;
    node.dispatchEvent(new Event("change"));
  }
  describe("skill form: battle resource costs", () => {
    it("writes resource2Cost / limitSkill / partyGaugeCost and clears them at zero", () => {
      const skillId = store.getCurrent().database.skills[0]!.id;
      const form = document.createElement("section") as unknown as FakeElement;
      renderSkillRecordForm(form as unknown as HTMLElement, store.getCurrent().database.skills[0]!);
      const current = () => store.getCurrent().database.skills.find((skill) => skill.id === skillId)!;
      change(form, "db-field-skill-resource2-cost", "30");
      check(form, "db-field-skill-limit", true);
      change(form, "db-field-skill-party-gauge-cost", "50");
      expect(current()).toMatchObject({ resource2Cost: 30, limitSkill: true, partyGaugeCost: 50 });
      change(form, "db-field-skill-resource2-cost", "0");
      check(form, "db-field-skill-limit", false);
      expect(current().resource2Cost).toBeUndefined();
      expect(current().limitSkill).toBeUndefined();
    });
  });
  describe("state form: emotion family and tier", () => {
    it("sets the family, then the tier, and clearing the family removes the emotion", () => {
      const current = () => store.getCurrent().database.states[0]!;
      const render = (): FakeElement => {
        const form = document.createElement("section") as unknown as FakeElement;
        renderStateRecordForm(form as unknown as HTMLElement, current());
        return form;
      };
      change(render(), "db-state-emotion-family", "기쁨");
      expect(current().emotion).toEqual({ family: "기쁨", tier: 1 });
      change(render(), "db-state-emotion-tier", "3");
      expect(current().emotion).toEqual({ family: "기쁨", tier: 3 });
      change(render(), "db-state-emotion-family", "");
      expect(current().emotion).toBeUndefined();
    });
  });
  describe("equipment form: grants and half MP", () => {
    it("toggles granted skills, sets a granted skill command, and exposes the half-MP flag", () => {
      const skillId = store.getCurrent().database.skills[0]!.id;
      const current = () => store.getCurrent().database.equipment.find((record) => record.id === "equip_blade")!;
      const form = document.createElement("section") as unknown as FakeElement;
      const rerender = (): void => {
        form.replaceChildren();
        renderEquipmentRecordForm(form as unknown as HTMLElement, current(), rerender);
      };
      rerender();
      check(form, `db-field-equipment-grant-skill-${skillId}`, true);
      expect(current().grantsSkillIds).toEqual([skillId]);
      change(form, "db-field-equipment-grant-command-skill", skillId);
      expect(current().grantsCommand).toMatchObject({ id: "cmd_equip_equip_blade", kind: "skill", skillId });
      check(form, "db-field-equipment-effect-half-mp", true);
      expect(current().effectFlags.halfMpCost).toBe(true);
      check(form, `db-field-equipment-grant-skill-${skillId}`, false);
      change(form, "db-field-equipment-grant-command-skill", "");
      expect(current().grantsSkillIds).toBeUndefined();
      expect(current().grantsCommand).toBeUndefined();
    });
  });
  describe("system tab: battle resources", () => {
    // 시스템 탭은 HUD 편집기(databaseFieldHud)까지 한꺼번에 그리는데, 그 편집기가 ResizeObserver 를
    // 무조건 만든다. 공용 fakeDom 에는 없다(actionCombatEditorFields 도 같은 이유로 깨져 있다) —
    // 이 파일에서만 관찰을 하지 않는 대역을 끼운다. 검사 대상(전투 자원 필드)은 크기와 무관하다.
    let restoreResizeObserver: (() => void) | undefined;
    beforeEach(() => {
      const scope = globalThis as { ResizeObserver?: unknown };
      const previous = scope.ResizeObserver;
      scope.ResizeObserver = class { observe(): void {} unobserve(): void {} disconnect(): void {} };
      restoreResizeObserver = () => { scope.ResizeObserver = previous; };
    });
    afterEach(() => restoreResizeObserver?.());

    function renderSystem(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderSystemTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }

    it("enables and disables each gauge, the weakness option, and parses the emotion cycle", () => {
      const system = () => store.getCurrent().system;
      check(renderSystem(), "db-field-system-limit-gauge", true);
      check(renderSystem(), "db-field-system-resource2", true);
      check(renderSystem(), "db-field-system-party-gauge", true);
      check(renderSystem(), "db-field-system-weakness-extra-action", true);
      expect(system().limitGauge?.enabled).toBe(true);
      expect(system().resource2?.enabled).toBe(true);
      expect(system().partyGauge?.enabled).toBe(true);
      expect(system().weaknessExtraAction).toBe(true);
      change(renderSystem(), "db-field-system-resource2-max", "60");
      expect(system().resource2?.max).toBe(60);
      change(renderSystem(), "db-field-system-emotion-cycle", "기쁨>분노=1.5\n엉터리\n분노 > 슬픔 = 2");
      expect(system().emotionCycle).toEqual([
        { attackerFamily: "기쁨", targetFamily: "분노", multiplier: 1.5 },
        { attackerFamily: "분노", targetFamily: "슬픔", multiplier: 2 },
      ]);
      check(renderSystem(), "db-field-system-limit-gauge", false);
      check(renderSystem(), "db-field-system-weakness-extra-action", false);
      change(renderSystem(), "db-field-system-emotion-cycle", "");
      expect(system().limitGauge).toBeUndefined();
      expect(system().weaknessExtraAction).toBeUndefined();
      expect(system().emotionCycle).toBeUndefined();
    });

    it("parseEmotionCycle drops malformed and negative lines", () => {
      expect(parseEmotionCycle("a>b=-1\na>b\n>b=2\nx>y=0.5")).toEqual([{ attackerFamily: "x", targetFamily: "y", multiplier: 0.5 }]);
    });
  });
  describe("life crafting: equipment upgrade target", () => {
    it("switching an upgrade row to equipment lists equipment and stores target", () => {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderLifeCraftingTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      byTestId(host, "db-life-section-upgrades").click();
      byTestId(host, "db-life-add").click();
      check(host, "db-life-upgrade-target-equipment", true);
      const rule = () => store.getCurrent().system.itemUpgrades![0]!;
      expect(rule()).toMatchObject({ target: "equipment", fromItemId: "equip_blade", toItemId: "equip_blade" });
      change(host, "db-life-upgrade-to-item", "equip_blade_plus");
      expect(rule().toItemId).toBe("equip_blade_plus");
      check(host, "db-life-upgrade-target-equipment", false);
      expect(rule().target).toBeUndefined();
    });
  });
});

describe("p1ReferenceIntegrity", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  afterEach(() => {
    resetToastsForTest();
    restoreDom?.();
    restoreDom = undefined;
  });
  describe("P1 farm-animal project reference integrity", () => {
    it("reports duplicate definitions and every cross-record failure with an exact authored path", () => {
      // Break caught: farm-animal rows can contain dangling ids and impossible capacity/compatibility without blocking play.
      const project = referenceProject();
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      addEvent(project, "event_chicken");
      project.database.farmAnimalSpecies = [
        species("chicken", feedItem.id, productItem.id),
        species("cow", "missing_feed", "missing_product"),
        species("chicken", feedItem.id, productItem.id),
      ];
      project.system.farmAnimalBuildings = [
        building(project, "coop", 1, ["chicken", "missing_species"]),
        building(project, "coop", 4, ["chicken"]),
        { ...building(project, "missing_home", 4, ["chicken"]), mapId: "missing_map" },
        { ...building(project, "off_map", 4, ["chicken"]), x: project.maps[project.startMapId]!.width },
        building(project, "cow_home", 4, ["chicken"]),
      ];
      project.session.farmAnimals = [
        { instanceId: "hen_1", speciesId: "chicken", name: "Hen 1", buildingId: "coop", eventId: "event_chicken" },
        { instanceId: "hen_2", speciesId: "chicken", name: "Hen 2", buildingId: "coop" },
        { instanceId: "hen_1", speciesId: "chicken", name: "Duplicate" },
        { instanceId: "ghost", speciesId: "missing_species", name: "Ghost" },
        { instanceId: "no_home", speciesId: "chicken", name: "No home", buildingId: "missing_building" },
        { instanceId: "no_event", speciesId: "chicken", name: "No event", eventId: "missing_event" },
        { instanceId: "wrong_home", speciesId: "cow", name: "Wrong home", buildingId: "cow_home" },
      ];

      const issues = collectProjectReferenceIssues(project);

      expect(issues).toEqual(expect.arrayContaining([
        "database.farmAnimalSpecies[2].id duplicates database.farmAnimalSpecies[0].id: chicken",
        "database.farmAnimalSpecies[1].feedItemId does not exist: missing_feed",
        "database.farmAnimalSpecies[1].productItemId does not exist: missing_product",
        "system.farmAnimalBuildings[1].id duplicates system.farmAnimalBuildings[0].id: coop",
        "system.farmAnimalBuildings[0].allowedSpeciesIds[1] does not exist: missing_species",
        "system.farmAnimalBuildings[2].mapId does not exist: missing_map",
        `system.farmAnimalBuildings[3].position (${project.maps[project.startMapId]!.width}, 0) is out of bounds for map ${project.startMapId}`,
        "session.farmAnimals[2].instanceId duplicates session.farmAnimals[0].instanceId: hen_1",
        "session.farmAnimals[3].speciesId does not exist: missing_species",
        "session.farmAnimals[4].buildingId does not exist: missing_building",
        "session.farmAnimals[5].eventId does not exist: missing_event",
        "session.farmAnimals[6].buildingId cow_home does not allow speciesId cow",
        "session.farmAnimals[1].buildingId exceeds system.farmAnimalBuildings[0].capacity: coop (1)",
      ]));
      expect(() => validateProjectReferences(project)).toThrow(/database\.farmAnimalSpecies\[2\]\.id/);
    });

    it("repairs invalid definitions and assignments without inventing replacement species or capacity", () => {
      // Break caught: load repair substitutes unrelated ids or leaves a cascading farm-animal reference failure.
      const project = referenceProject();
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      addEvent(project, "event_keep");
      project.database.farmAnimalSpecies = [
        species("chicken", feedItem.id, productItem.id),
        species("cow", feedItem.id, productItem.id),
        species("invalid_items", "missing_feed", productItem.id),
      ];
      project.system.farmAnimalBuildings = [
        building(project, "coop", 1, ["chicken", "invalid_items", "missing_species"]),
        { ...building(project, "missing_home", 4, ["chicken"]), mapId: "missing_map" },
        { ...building(project, "off_map", 4, ["chicken"]), y: project.maps[project.startMapId]!.height },
      ];
      project.session.farmAnimals = [
        { instanceId: "keep", speciesId: "chicken", name: "Keep", buildingId: "coop", eventId: "event_keep" },
        { instanceId: "overflow", speciesId: "chicken", name: "Overflow", buildingId: "coop" },
        { instanceId: "incompatible", speciesId: "cow", name: "Incompatible", buildingId: "coop" },
        { instanceId: "invalid_species", speciesId: "invalid_items", name: "Invalid items" },
        { instanceId: "unknown_species", speciesId: "missing_species", name: "Unknown" },
        { instanceId: "unknown_home", speciesId: "chicken", name: "Unknown home", buildingId: "missing_building" },
        { instanceId: "removed_home", speciesId: "chicken", name: "Removed home", buildingId: "missing_home" },
      ];

      repairProjectReferences(project);

      expect(project.database.farmAnimalSpecies?.map((row) => row.id)).toEqual(["chicken", "cow"]);
      // 맵 밖으로 나간 축사는 지우지 않고 맵 안으로 당긴다(배정된 개체를 말없이 풀지 않게) — 맵이 없어진 축사만 빠진다.
      const startHeight = project.maps[project.startMapId]!.height;
      expect(project.system.farmAnimalBuildings).toEqual([
        expect.objectContaining({ id: "coop", capacity: 1, allowedSpeciesIds: ["chicken"] }),
        expect.objectContaining({ id: "off_map", capacity: 4, y: startHeight - 1, allowedSpeciesIds: ["chicken"] }),
      ]);
      expect(project.session.farmAnimals?.map((row) => row.instanceId)).toEqual([
        "keep", "overflow", "incompatible", "unknown_home", "removed_home",
      ]);
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "keep")).toMatchObject({
        speciesId: "chicken",
        buildingId: "coop",
        eventId: "event_keep",
      });
      for (const instanceId of ["overflow", "incompatible", "unknown_home", "removed_home"]) {
        expect(project.session.farmAnimals?.find((row) => row.instanceId === instanceId)?.buildingId).toBeUndefined();
      }
      expect(() => validateProjectReferences(project)).not.toThrow();
    });

    it("includes animal-home ids in map impact and clears only assignments to cascaded homes", () => {
      // Break caught: deleting a map silently leaves farmAnimalBuildings and starting-animal buildingIds dangling.
      const project = referenceProject();
      const target = addMap(project, "map_barnyard");
      target.events.push({
        id: "event_barnyard_hen",
        x: 0,
        y: 0,
        trigger: { kind: "action" },
        commands: [],
      });
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
      project.system.farmAnimalBuildings = [
        buildingOn(target, "coop", 4, ["chicken"]),
        buildingOn(target, "barn", 4, ["chicken"]),
        building(project, "source_home", 4, ["chicken"]),
      ];
      project.session.farmAnimals = [
        {
          instanceId: "coop_animal",
          speciesId: "chicken",
          name: "Coop",
          buildingId: "coop",
          eventId: "event_barnyard_hen",
        },
        { instanceId: "barn_animal", speciesId: "chicken", name: "Barn", buildingId: "barn" },
        { instanceId: "source_animal", speciesId: "chicken", name: "Source", buildingId: "source_home" },
      ];

      const impact = collectMapDeletionImpact(project, target.id);
      expect(impact?.farmAnimalBuildingCount).toBe(2);
      expect(impact?.farmAnimalBuildingIds).toEqual(["coop", "barn"]);

      applyMapDeletion(project, target.id);

      expect(project.system.farmAnimalBuildings?.map((row) => row.id)).toEqual(["source_home"]);
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "coop_animal")?.buildingId).toBeUndefined();
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "coop_animal")?.eventId).toBeUndefined();
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "barn_animal")?.buildingId).toBeUndefined();
      expect(project.session.farmAnimals?.find((row) => row.instanceId === "source_animal")?.buildingId).toBe("source_home");
      expect(() => validateProjectReferences(project)).not.toThrow();
    });

    it("blocks database item deletion when a species uses it as feed or product", () => {
      // Break caught: deleting an item used by a farm species bypasses the database reference guard.
      const project = referenceProject();
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
      store.replace(project);

      expect(databaseReferenceMessage("items", feedItem.id)).toMatch(/동물 종.*먹이/);
      expect(databaseReferenceMessage("items", productItem.id)).toMatch(/동물 종.*생산물/);
    });

    it("keeps referenced species and buildings when their farm-animal UI delete buttons are clicked", () => {
      // Break caught: the structured animal editor splices referenced species/buildings without consulting a guard.
      restoreDom = installFakeDom();
      const project = referenceProject();
      const [feedItem, productItem] = project.database.items;
      if (!feedItem || !productItem) throw new Error("default item fixture is incomplete");
      project.database.farmAnimalSpecies = [species("chicken", feedItem.id, productItem.id)];
      project.system.farmAnimalBuildings = [building(project, "coop", 4, ["chicken"])];
      project.session.farmAnimals = [{ instanceId: "hen", speciesId: "chicken", name: "Hen", buildingId: "coop" }];
      store.replace(project);
      const host = document.createElement("div") as unknown as FakeElement;
      renderFarmAnimalsTab(host as unknown as HTMLElement, () => undefined);

      findByTestId(host, "db-farm-species-chicken")?.querySelector("button")?.click();
      findByTestId(host, "db-farm-building-coop")?.querySelector("button")?.click();

      expect(store.getCurrent().database.farmAnimalSpecies?.map((row) => row.id)).toEqual(["chicken"]);
      expect(store.getCurrent().system.farmAnimalBuildings?.map((row) => row.id)).toEqual(["coop"]);
    });
  });
  function referenceProject(): Project {
    return createBlankProject();
  }
  function species(id: string, feedItemId: string, productItemId: string): FarmAnimalSpeciesRecord {
    return {
      id,
      name: id,
      feedItemId,
      productItemId,
      productCount: 1,
      productEveryDays: 1,
      petFriendship: 10,
    };
  }
  function building(
    project: Project,
    id: string,
    capacity: number,
    allowedSpeciesIds: string[],
  ): FarmAnimalBuildingDefinition {
    return buildingOn(project.maps[project.startMapId]!, id, capacity, allowedSpeciesIds);
  }
  function buildingOn(
    map: GameMap,
    id: string,
    capacity: number,
    allowedSpeciesIds: string[],
  ): FarmAnimalBuildingDefinition {
    return { id, name: id, mapId: map.id, x: 0, y: 0, capacity, allowedSpeciesIds };
  }
  function addMap(project: Project, id: string): GameMap {
    const map = structuredClone(project.maps[project.startMapId]!);
    map.id = id;
    map.name = id;
    map.events = [];
    project.maps[id] = map;
    project.mapTree.children.push({ mapId: id, children: [] });
    return map;
  }
  function addEvent(project: Project, id: string): void {
    const event: GameEvent = {
      id,
      x: 0,
      y: 0,
      trigger: { kind: "action" },
      commands: [],
    };
    project.maps[project.startMapId]!.events.push(event);
  }
});
