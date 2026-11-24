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
