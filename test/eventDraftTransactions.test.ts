import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { beginExistingEventDraft, createEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { updateEventPage } from "@/editor/eventPages";
import { createDefaultGameEvent, updateEvent } from "@/editor/eventActions";
import { getMapEditHistoryEntries, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { renderEventCharacterSocialExtras } from "@/editor/panels/eventEditor/pageProps";
import { applyMemoryOpeningTemplate } from "@/editor/panels/eventEditor/memoryOpeningTemplate";
import { openFieldMonsterTemplateDialog } from "@/editor/panels/eventEditor/fieldMonsterTemplateDialog";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { projectWithEventDraftAuthoredWrites } from "@/project/eventDraftAuthored";
import { createBlankProject } from "@/project/defaults";
import { eventDraftDiffById, eventDraftHasUserChanges, projectWithoutEventDrafts } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest, applyEventDraftVault, loadEventDraftVaultFromLocalStorage, persistEventDraftVaultNow } from "@/project/eventDraftVault";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

let restoreDom: () => void;
let originalStorage: PropertyDescriptor | undefined;
let mapId: string;
let eventId: string;

function liveEvent() {
  const event = store.getCurrent().maps[mapId].events.find((entry) => entry.id === eventId);
  if (!event) throw new Error("missing test event");
  return event;
}

function editName(name: string) {
  const field = renderEventCharacterSocialExtras(mapId, liveEvent());
  if (!field) throw new Error("missing social field");
  const input = field.querySelector<HTMLInputElement>('[data-testid="event-character-display-name-input"]');
  if (!input) throw new Error("missing name input");
  input.value = name;
  input.dispatchEvent(new Event("change"));
}

beforeEach(() => {
  restoreDom = installFakeDom();
  originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  _resetEventDraftVaultForTest();
  const project = createBlankProject();
  mapId = project.startMapId;
  const event = createDefaultGameEvent(2, 2);
  eventId = event.id;
  event.characterId = "alice";
  project.maps[mapId].events = [event];
  project.characters = { alice: { displayName: "Before" } };
  store.replaceProject(project);
  beginExistingEventDraft(mapId, eventId);
  resetMapEditHistory();
});

afterEach(() => {
  document.querySelector<HTMLElement>('[data-testid="field-monster-template-cancel"]')?.click();
  _resetEventDraftVaultForTest();
  resetMapEditHistory();
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
  restoreDom();
});

describe("linked authored draft transactions", () => {
  it.each(["save", "cancel"])("keeps a new event and new profile atomic on %s", (action) => {
    discardEventDraft(mapId, eventId);
    eventId = createEventDraft(mapId, 4, 4);
    updateEvent(mapId, eventId, { characterId: "new-npc" });
    editName("New NPC");
    const exported = deserialize(serialize(projectWithoutEventDrafts(store.getCurrent())));
    expect(exported.characters?.["new-npc"]).toBeUndefined();
    expect(exported.maps[mapId].events.some((entry) => entry.id === eventId)).toBe(false);
    if (action === "save") {
      saveEventDraft(mapId, eventId);
      expect(store.getCurrent().characters?.["new-npc"]?.displayName).toBe("New NPC");
      expect(undoMapEdit()).toBe(true);
    } else discardEventDraft(mapId, eventId);
    expect(store.getCurrent().characters?.["new-npc"]).toBeUndefined();
    expect(store.getCurrent().maps[mapId].events.some((entry) => entry.id === eventId)).toBe(false);
  });

  it.each(["save", "cancel"])("preserves concurrent profile fields and project edits on %s", (action) => {
    editName("");
    const incoming = projectWithoutEventDrafts(store.getCurrent());
    incoming.characters = { alice: { displayName: "Concurrent", birthday: { season: "spring", day: 4 } } };
    incoming.title = "Concurrent project edit";
    store.replace(incoming);
    if (action === "save") saveEventDraft(mapId, eventId);
    else discardEventDraft(mapId, eventId);
    expect(store.getCurrent().characters?.alice).toEqual({
      ...(action === "cancel" ? { displayName: "Concurrent" } : {}), birthday: { season: "spring", day: 4 },
    });
    expect(store.getCurrent().title).toBe("Concurrent project edit");
  });

  it("removes an empty profile on Apply and restores it on undo", () => {
    editName("");
    saveEventDraft(mapId, eventId);
    expect(store.getCurrent().characters).toBeUndefined();
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().characters).toEqual({ alice: { displayName: "Before" } });
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().characters).toBeUndefined();
  });

  it("returning to the original name clears the dirty guard without history", () => {
    editName("Temporary");
    editName("Before");
    expect(eventDraftHasUserChanges(store.getCurrent(), mapId, eventId)).toBe(false);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it("commits template pages and a recovered switch together, with undo/redo", () => {
    const page = liveEvent().pages?.[0];
    if (!page) throw new Error("missing page");
    const before = projectWithoutEventDrafts(store.getCurrent());
    openFieldMonsterTemplateDialog(mapId, eventId, page);
    const input = document.querySelector<HTMLInputElement>('[data-testid="field-monster-template-clear-switch"]');
    const apply = document.querySelector<HTMLElement>('[data-testid="field-monster-template-apply"]');
    if (!input || !apply) throw new Error("missing field template controls");
    input.value = "recovered_switch";
    apply.click();
    const expectedPages = structuredClone(liveEvent().pages);
    persistEventDraftVaultNow("transaction-test");
    _resetEventDraftVaultForTest();
    expect(loadEventDraftVaultFromLocalStorage("transaction-test")).toBe(1);
    store.replace(applyEventDraftVault(before));
    saveEventDraft(mapId, eventId);
    expect(liveEvent().pages).toEqual(expectedPages);
    expect(store.getCurrent().switches.find((entry) => entry.id === "recovered_switch")?.name).toBeTruthy();
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().switches).toEqual(before.switches);
    expect(liveEvent().pages).toEqual(before.maps[mapId].events[0].pages);
    expect(redoMapEdit()).toBe(true);
    expect(liveEvent().pages).toEqual(expectedPages);
    expect(store.getCurrent().switches.some((entry) => entry.id === "recovered_switch")).toBe(true);
  });

  it.each(["After", ""])("isolates name %j from canonical data and history until Apply", (name) => {
    editName(name);
    expect(projectWithoutEventDrafts(store.getCurrent()).characters?.alice?.displayName).toBe("Before");
    expect(eventDraftHasUserChanges(store.getCurrent(), mapId, eventId)).toBe(true);
    expect(eventDraftDiffById(store.getCurrent(), mapId, eventId)?.changes.length).toBeGreaterThan(0);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it("discards a newly created profile without removing unrelated project edits", () => {
    updateEvent(mapId, eventId, { characterId: "new-key" });
    editName("New profile");
    store.update((project) => { project.title = "Unrelated"; });
    discardEventDraft(mapId, eventId);
    expect(store.getCurrent().characters?.["new-key"]).toBeUndefined();
    expect(store.getCurrent().title).toBe("Unrelated");
    expect(liveEvent().characterId).toBe("alice");
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it("retains name-only edits through durable vault recovery and global replacement", () => {
    editName("Recovered");
    const canonical = projectWithoutEventDrafts(store.getCurrent());
    persistEventDraftVaultNow("transaction-test");
    _resetEventDraftVaultForTest();
    expect(loadEventDraftVaultFromLocalStorage("transaction-test")).toBe(1);
    store.replace(applyEventDraftVault(canonical));
    expect(eventDraftHasUserChanges(store.getCurrent(), mapId, eventId)).toBe(true);
    expect(projectWithoutEventDrafts(store.getCurrent()).characters?.alice?.displayName).toBe("Before");
    saveEventDraft(mapId, eventId);
    expect(store.getCurrent().characters?.alice?.displayName).toBe("Recovered");
  });

  it("commits both character keys and the event in one undoable Apply", () => {
    editName("Alice edited");
    updateEvent(mapId, eventId, { characterId: "bob" });
    editName("Bob created");
    store.update((project) => { project.title = "Keep me"; });
    saveEventDraft(mapId, eventId);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(store.getCurrent().characters).toMatchObject({ alice: { displayName: "Alice edited" }, bob: { displayName: "Bob created" } });
    expect(undoMapEdit()).toBe(true);
    expect(liveEvent().characterId).toBe("alice");
    expect(store.getCurrent().characters).toEqual({ alice: { displayName: "Before" } });
    expect(store.getCurrent().title).toBe("Keep me");
    expect(redoMapEdit()).toBe(true);
    expect(liveEvent().characterId).toBe("bob");
    expect(store.getCurrent().characters?.bob?.displayName).toBe("Bob created");
  });

  it("Cancel after Apply retains the applied name and only one history entry", () => {
    editName("Applied");
    saveEventDraft(mapId, eventId);
    beginExistingEventDraft(mapId, eventId);
    editName("Discarded");
    discardEventDraft(mapId, eventId);
    expect(store.getCurrent().characters?.alice?.displayName).toBe("Applied");
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  });

  it("memory template Cancel leaves no global undo entry or changed pages", () => {
    const before = structuredClone(liveEvent().draft?.original);
    const page = liveEvent().pages?.[0];
    if (!page) throw new Error("missing page");
    applyMemoryOpeningTemplate(mapId, eventId, commands => updateEventPage(mapId, eventId, page.id, { commands }));
    expect(liveEvent().pages?.[0]?.commands.length).toBeGreaterThan(3);
    discardEventDraft(mapId, eventId);
    expect(liveEvent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it.each([false, true])("field template stages switch definitions without session writes (existing=%s)", (existing) => {
    const switchId = "transaction_clear";
    if (existing) store.update((project) => { project.switches.push({ id: switchId, name: "" }); });
    const before = projectWithoutEventDrafts(store.getCurrent());
    const page = liveEvent().pages?.[0];
    if (!page) throw new Error("missing page");
    openFieldMonsterTemplateDialog(mapId, eventId, page);
    const input = document.querySelector<HTMLInputElement>('[data-testid="field-monster-template-clear-switch"]');
    const apply = document.querySelector<HTMLElement>('[data-testid="field-monster-template-apply"]');
    if (!input || !apply) throw new Error("missing field template controls");
    input.value = switchId;
    apply.click();
    expect(liveEvent().pages).toHaveLength(2);
    expect(validateEventDraft(projectWithEventDraftAuthoredWrites(store.getCurrent(), mapId, eventId), mapId, eventId).canCommit).toBe(true);
    expect(projectWithoutEventDrafts(store.getCurrent()).switches).toEqual(before.switches);
    expect(store.getCurrent().session).toEqual(before.session);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    discardEventDraft(mapId, eventId);
    expect(store.getCurrent().switches).toEqual(before.switches);
  });
});
