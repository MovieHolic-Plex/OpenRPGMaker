// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONNECTION_COLLECTIONS, createRecordConnectionsReader, recordConnections } from "@/editor/databaseRecordConnections";
import { commandsReferenceLocations, createCommandReferenceLocationsReader } from "@/editor/databaseCommandReferences";
import { createConnectionsPanel } from "@/editor/panels/databaseConnectionsPanel";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { createBlankProject } from "@/project/defaults";
import { beginEventEditDraft } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { DatabaseCollection } from "@/editor/databaseActions";
import type { Command, Project } from "@/project/types";
import { renderLifeCollectionsTab } from "@/editor/panels/databaseLifeCollectionsView";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { shouldIgnoreEditorShortcut, historyHotkeyOwnedByPanel } from "@/editor/hotkeys";
import { openHarnessModal } from "@/editor/panels/aiHarnessModal";
import { openToolBrowserModal } from "@/editor/panels/toolBrowserModal";
import { hasOpenModalLayer, resetModalStackForTest } from "@/editor/ui/modalStack";
import { elementDisplayName } from "@/battle/skillHelp";
import { elementGradeWord } from "@/editor/panels/databaseElementPresentation";
import { beginGameExport, endGameExport, resetGameExportForTest } from "@/editor/panels/gameExportNotice";
import { resetToastsForTest } from "@/util/toast";
import { localDiagnostics, startLocalDiagnostics } from "@/editor/localDiagnostics";
import { openLocalDiagnosticsDialog } from "@/editor/panels/localDiagnosticsDialog";
import { recordEditActivity } from "@/editor/editActivityLog";
import { createLogger } from "@/util/logger";
import { publishDiagnostic } from "@/util/diagnosticObserver";
import { closeMapContextMenu, openMapContextMenu } from "@/editor/panels/mapContextMenu";
import { openMapCreateDialog, mapCreateIssueLines } from "@/editor/panels/mapCreateDialog";
import { inspectMapCreateInput, mapCreateInputOk } from "@/project/mapCreateSpec";
import { MAX_TOOL_MAP_DIMENSION, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { editorState } from "@/editor/editorState";
import { isolateTimers } from "./mergedTeardown";

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

describe("gameExportNotice", () => {
  isolateTimers();
  afterEach(() => {
    resetGameExportForTest();
    resetToastsForTest();
    document.body.replaceChildren();
    vi.useRealTimers();
  });
  function toastTexts(): string[] {
    return [...document.querySelectorAll(".toast")].map((node) => node.textContent ?? "");
  }
  describe("game export notice", () => {
    it("keeps the progress toast up past the default two seconds", () => {
      vi.useFakeTimers();
      expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
      const notice = document.querySelector<HTMLElement>('[data-testid="toast"]');
      expect(notice?.textContent).toContain("게임 번들을 만드는 중...");
      expect(notice?.classList.contains("show")).toBe(true);
      vi.advanceTimersByTime(3_000);
      expect(notice?.classList.contains("show")).toBe(true);
    });

    it("refuses a second export while the first is still running", () => {
      expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
      expect(beginGameExport("실행형 HTML 을 만드는 중...")).toBe(false);
      const texts = toastTexts();
      expect(texts.some((text) => text.includes("게임 번들을 만드는 중"))).toBe(true);
      expect(texts.some((text) => text.includes("이미 게임을 내보내는 중"))).toBe(true);
      expect(texts.some((text) => text.includes("실행형 HTML"))).toBe(false);
    });

    it("replaces progress with an error that stays past the default four seconds", () => {
      vi.useFakeTimers();
      beginGameExport("게임 번들을 만드는 중...");
      endGameExport("게임 내보내기 실패: manifest", "error");
      const notice = document.querySelector<HTMLElement>('[data-testid="toast"]');
      expect(notice?.textContent).toContain("게임 내보내기 실패: manifest");
      expect(notice?.classList.contains("error")).toBe(true);
      expect(toastTexts().some((text) => text.includes("게임 번들을 만드는 중"))).toBe(false);
      vi.advanceTimersByTime(5_000);
      expect(notice?.classList.contains("show")).toBe(true);
      vi.advanceTimersByTime(16_000);
      expect(notice?.classList.contains("show")).toBe(false);
    });

    it("allows another export after the first finishes", () => {
      expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
      endGameExport("게임 내보내기 완료: 맵 1개, 에셋 2개", "ok");
      expect(beginGameExport("게임 번들을 만드는 중...")).toBe(true);
    });
  });
});

describe("localDiagnosticsWorkflow", () => {
  isolateTimers();
  afterEach(() => { localDiagnostics.clear(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  function button(id: string): HTMLButtonElement {
    const value = document.querySelector(`[data-testid="${id}"]`);
    if (!(value instanceof HTMLButtonElement)) throw new Error(`Missing button ${id}`);
    return value;
  }
  function check(id: string): void {
    const value = document.querySelector(`[data-testid="${id}"]`);
    if (!(value instanceof HTMLInputElement)) throw new Error(`Missing input ${id}`);
    value.click();
  }
  it("subscribes to real authoring/log sources only after consent and clears on project switch", () => {
    expect(startLocalDiagnostics(true, ["authoring", "warning"])).toBe(true);
    recordEditActivity({ scope: "map", origin: "ai", generation: 42, label: "secret private prompt" });
    createLogger("test").warn("secret private endpoint", { token: "private" });
    expect(localDiagnostics.snapshot().receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "authoring", generation: 42, origin: "ai" }),
      expect.objectContaining({ category: "warning", phase: "reported" }),
    ]));
    store.replaceProject(createBlankProject());
    expect(localDiagnostics.snapshot()).toMatchObject({ active: false, sessionId: null, receipts: [] });
  });
  it("requires category choices and explicit consent, then exposes persistent stop/clear", () => {
    openLocalDiagnosticsDialog();
    expect(button("diagnostics-start").disabled).toBe(true);
    check("diagnostics-category-movement");
    expect(button("diagnostics-start").disabled).toBe(true);
    check("diagnostics-consent");
    button("diagnostics-start").click();
    expect(localDiagnostics.snapshot().active).toBe(true);
    expect(button("diagnostics-stop").isConnected).toBe(true);
    button("diagnostics-stop").click();
    expect(localDiagnostics.snapshot().active).toBe(false);
    button("diagnostics-clear").click();
    expect(localDiagnostics.snapshot().sessionId).toBeNull();
  });
  it("previews selected sections but cancellation never writes clipboard, file or transcript", async () => {
    const write = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: write } });
    startLocalDiagnostics(true, ["movement", "error"]);
    publishDiagnostic({ category: "movement", phase: "completed", x: 2, y: 3 });
    publishDiagnostic({ category: "error", phase: "reported" });
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const network = vi.spyOn(globalThis, "fetch");
    openLocalDiagnosticsDialog();
    check("diagnostics-section-error");
    button("diagnostics-preview").click();
    const preview = document.querySelector<HTMLTextAreaElement>("[data-testid=diagnostics-preview-text]");
    expect(JSON.parse(preview?.value ?? "null").receipts).toHaveLength(1);
    button("diagnostics-copy").click();
    button("app-modal-cancel").click();
    await Promise.resolve();
    expect(write).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
  it.each(["json", "markdown"])("copies exactly the %s preview only after confirmation", async format => {
    const copied = Promise.withResolvers<string>();
    const deadline = setTimeout(() => copied.reject(new Error("Clipboard signal missing")), 1000);
    const write = vi.fn(async (text: string) => { copied.resolve(text); });
    vi.stubGlobal("navigator", { clipboard: { writeText: write } });
    startLocalDiagnostics(true, ["movement"]);
    publishDiagnostic({ category: "movement", phase: "completed", x: 1, y: 2 });
    openLocalDiagnosticsDialog();
    const select = document.querySelector<HTMLSelectElement>("[data-testid=diagnostics-format]");
    if (!select) throw new Error("Expected report format select");
    select.value = format; select.dispatchEvent(new Event("change"));
    button("diagnostics-preview").click();
    const expected = document.querySelector<HTMLTextAreaElement>("[data-testid=diagnostics-preview-text]")?.value;
    expect(write).not.toHaveBeenCalled();
    button("diagnostics-copy").click();
    expect(write).not.toHaveBeenCalled();
    button("app-modal-confirm").click();
    try { expect(await copied.promise).toBe(expected); } finally { clearTimeout(deadline); }
    expect(write).toHaveBeenCalledOnce();
  });
  it("invalidates a pending export when its project/session is replaced", async () => {
    const write = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: write } });
    startLocalDiagnostics(true, ["movement"]);
    openLocalDiagnosticsDialog(); button("diagnostics-preview").click();
    button("diagnostics-copy").click();
    store.replaceProject(createBlankProject());
    button("app-modal-confirm").click();
    await Promise.resolve();
    expect(write).not.toHaveBeenCalled();
    expect(document.querySelector("[data-testid=local-diagnostics-dialog]")).toBeNull();
  });
});

describe("mapContextMenuLayout", () => {
  isolateTimers();
  describe("map context menu item layout", () => {
    afterEach(() => {
      closeMapContextMenu();
    });

    it("keeps an empty icon slot so the label is not clipped to the 16px first column", () => {
      openMapContextMenu({
        mapId: "map-1",
        mapName: "테스트",
        point: { x: 10, y: 10 },
        items: [
          {
            action: () => {},
            icon: "",
            id: "create-event",
            label: "이벤트 생성...",
            shortcut: "Enter",
            testId: "event-layer-create-event",
          },
        ],
      });

      const item = document.querySelector<HTMLButtonElement>('[data-testid="event-layer-create-event"]');
      expect(item).not.toBeNull();
      const children = Array.from(item!.children) as HTMLElement[];
      expect(children.map((node) => node.className)).toEqual([
        "map-context-menu-icon",
        "map-context-menu-label",
        "map-context-menu-shortcut",
      ]);
      expect(children[0].getAttribute("aria-hidden")).toBe("true");
      expect(children[1].textContent).toBe("이벤트 생성...");
      expect(children[2].textContent).toBe("Enter");
    });
  });
});

// 새 맵 대화창은 빈 이름과 범위 밖 크기를 다른 값으로 바꿔 넣지 않는다.
// 예전에는 이름 "" · 가로 -5 · 높이 2 가 말없이 4×4 「새 맵」이 됐다.
describe("mapCreateValidation", () => {
  isolateTimers();
  function node<T extends HTMLElement = HTMLElement>(testId: string): T {
    const found = document.querySelector<T>(`[data-testid="${testId}"]`);
    if (!found) throw new Error(`Missing test control: ${testId}`);
    return found;
  }
  function setField(testId: string, value: string): void {
    const input = node<HTMLInputElement>(testId);
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  beforeEach(() => {
    document.body.replaceChildren();
    store.replace(createBlankProject());
    const project = store.getCurrent();
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  });
  afterEach(() => {
    closeMapContextMenu();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    document.body.replaceChildren();
  });
  describe("새 맵 크기·이름 검사", () => {
    it("빈 이름과 -5×2 는 거절 사유를 돌려주고 통과로 치지 않는다", () => {
      const issues = inspectMapCreateInput({ name: "   ", width: "-5", height: "2" });
      expect(issues.nameBlank).toBe(true);
      expect(issues.width).toEqual({ kind: "too-small", value: -5 });
      expect(issues.height).toEqual({ kind: "too-small", value: 2 });
      expect(mapCreateInputOk(issues)).toBe(false);
      const lines = mapCreateIssueLines(issues);
      expect(lines.join("\n")).toContain("이름을 비웠습니다");
      expect(lines.join("\n")).toContain("새 맵");
      expect(lines.join("\n")).toContain("가로 -5칸은 4칸보다 작습니다.");
      expect(lines.join("\n")).toContain("높이 2칸은 4칸보다 작습니다.");
      expect(lines.join("\n")).toContain("다른 크기로 바꿔 넣지 않습니다.");
    });

    it("빈 칸·정수가 아닌 값·상한 초과를 각각 구분한다", () => {
      expect(inspectMapDimension("")).toEqual({ kind: "empty" });
      expect(inspectMapDimension("4.5")).toEqual({ kind: "not-integer", raw: "4.5" });
      expect(inspectMapDimension(String(MAX_TOOL_MAP_DIMENSION + 1))).toEqual({
        kind: "too-big",
        value: MAX_TOOL_MAP_DIMENSION + 1,
      });
      expect(inspectMapDimension("8")).toBeNull();
      const huge = inspectMapCreateInput({ name: "항구", width: String(MAX_TOOL_MAP_DIMENSION + 1), height: "6" });
      expect(mapCreateIssueLines(huge).join("\n")).toContain(mapSizeLimitMessage());
    });

    it("대화창은 빈 이름과 -5×2 로 4×4 맵을 만들지 않고 거절 문장을 보여 준다", () => {
      const before = new Set(Object.keys(store.getCurrent().maps));
      openMapCreateDialog();
      setField("map-create-name", "");
      setField("map-create-width", "-5");
      setField("map-create-height", "2");

      const error = node("map-create-error");
      expect(error.hidden).toBe(false);
      expect(error.textContent).toContain("이름을 비웠습니다");
      expect(error.textContent).toContain("「새 맵」");
      expect(error.textContent).toContain("가로 -5칸은 4칸보다 작습니다.");
      expect(error.textContent).toContain("높이 2칸은 4칸보다 작습니다.");
      expect(error.textContent).toContain("다른 크기로 바꿔 넣지 않습니다.");
      expect(node("map-create-name").getAttribute("aria-invalid")).toBe("true");
      expect(node("map-create-width").getAttribute("aria-invalid")).toBe("true");
      expect(node("map-create-height").getAttribute("aria-invalid")).toBe("true");

      node("map-create-confirm").click();

      expect(node("map-create-dialog").isConnected).toBe(true);
      expect(new Set(Object.keys(store.getCurrent().maps))).toEqual(before);
      expect(Object.values(store.getCurrent().maps).some((map) => map.width === 4 && map.height === 4)).toBe(false);
      expect(Object.values(store.getCurrent().maps).some((map) => map.name === "새 맵" && map.width === 4)).toBe(false);
    });

    it("거절한 뒤에 올바른 이름과 크기를 넣으면 그 크기 그대로 만든다", () => {
      openMapCreateDialog();
      setField("map-create-name", "");
      setField("map-create-width", "-5");
      setField("map-create-height", "2");
      node("map-create-confirm").click();
      expect(node("map-create-dialog").isConnected).toBe(true);

      setField("map-create-name", "항구");
      setField("map-create-width", "8");
      setField("map-create-height", "6");
      expect(node("map-create-error").hidden).toBe(true);

      const before = new Set(Object.keys(store.getCurrent().maps));
      node("map-create-confirm").click();
      const createdId = Object.keys(store.getCurrent().maps).find((id) => !before.has(id));
      if (!createdId) throw new Error("맵이 만들어지지 않았습니다");
      expect(store.getCurrent().maps[createdId]).toMatchObject({ name: "항구", width: 8, height: 6 });
      expect(document.querySelector("[data-testid='map-create-dialog']")).toBeNull();
    });
  });
  function inspectMapDimension(raw: string) {
    return inspectMapCreateInput({ name: "이름", width: raw, height: "6" }).width;
  }
});
