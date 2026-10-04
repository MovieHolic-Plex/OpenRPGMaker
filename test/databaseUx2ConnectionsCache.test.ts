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
