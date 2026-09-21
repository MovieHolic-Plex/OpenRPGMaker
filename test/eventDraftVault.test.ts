import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  beginExistingEventDraft,
  createEventDraft,
  discardEventDraft,
  saveEventDraft,
} from "@/editor/eventDraftActions";
import { setEventPageTextCommand } from "@/editor/eventPages";
import { createBlankProject } from "@/project/defaults";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import {
  _resetEventDraftVaultForTest,
  applyEventDraftVault,
  getEventDraftVaultEntry,
  loadEventDraftVaultFromLocalStorage,
  persistEventDraftVaultNow,
  preserveEventDraftsOnProject,
} from "@/project/eventDraftVault";
import { store } from "@/project/store";

beforeEach(() => {
  _resetEventDraftVaultForTest();
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => void storage.delete(key),
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
    },
  });
  store.replaceProject(createBlankProject());
});

afterEach(() => {
  _resetEventDraftVaultForTest();
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("event draft vault recovery", () => {
  it("restores a wiped new draft after store.replace from a remote-like snapshot", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 3, 4);
    expect(getEventDraftVaultEntry(mapId, eventId)?.event.draft?.kind).toBe("new");

    // Simulate autosave/AI merge that drops the draft event entirely.
    const stripped = projectWithoutEventDrafts(store.getCurrent());
    stripped.maps[mapId].events = stripped.maps[mapId].events.filter((event) => event.id !== eventId);
    store.replace(stripped);

    const restored = store.getCurrent().maps[mapId].events.find((event) => event.id === eventId);
    expect(restored?.draft?.kind).toBe("new");
    expect(restored?.x).toBe(3);
    expect(restored?.y).toBe(4);
  });

  it("survives localStorage round-trip for crash recovery", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 5, 6);
    const pageId = store.getCurrent().maps[mapId].events.find((event) => event.id === eventId)?.pages?.[0]?.id;
    if (!pageId) throw new Error("missing page");
    setEventPageTextCommand(mapId, eventId, pageId, undefined, "crash-safe text");
    persistEventDraftVaultNow();

    // Simulate process restart: empty vault, then reload from localStorage.
    _resetEventDraftVaultForTest();
    expect(getEventDraftVaultEntry(mapId, eventId)).toBeNull();
    expect(loadEventDraftVaultFromLocalStorage()).toBe(1);

    const blank = createBlankProject();
    // Reuse the same map id so vault can reattach.
    const oldMap = store.getCurrent().maps[mapId];
    blank.maps = { [mapId]: { ...structuredClone(oldMap), events: [] } };
    blank.startMapId = mapId;
    blank.mapTree = { children: [{ mapId, children: [] }] };

    const recovered = applyEventDraftVault(blank);
    const event = recovered.maps[mapId].events.find((entry) => entry.id === eventId);
    expect(event?.draft?.kind).toBe("new");
    expect(event?.pages?.[0]?.commands[0]).toEqual({
      kind: "text",
      body: "crash-safe text",
      speaker: undefined,
    });
  });

  it("does not resurrect a discarded new event", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 1, 1);
    discardEventDraft(mapId, eventId);
    expect(getEventDraftVaultEntry(mapId, eventId)).toBeNull();

    const stripped = projectWithoutEventDrafts(store.getCurrent());
    store.replace(stripped);
    expect(store.getCurrent().maps[mapId].events.some((event) => event.id === eventId)).toBe(false);
  });

  it("preserveEventDraftsOnProject prefers live working body", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 2, 2);
    saveEventDraft(mapId, eventId);
    const pageId = store.getCurrent().maps[mapId].events.find((event) => event.id === eventId)?.pages?.[0]?.id;
    if (!pageId) throw new Error("missing page");
    // reopen as edit draft and change
    beginExistingEventDraft(mapId, eventId);
    setEventPageTextCommand(mapId, eventId, pageId, undefined, "live wins");

    const live = store.getCurrent();
    const incoming = projectWithoutEventDrafts(live);
    const merged = preserveEventDraftsOnProject(incoming, live);
    expect(merged.maps[mapId].events.find((event) => event.id === eventId)?.pages?.[0]?.commands[0]).toEqual({
      kind: "text",
      body: "live wins",
      speaker: undefined,
    });
    expect(merged.maps[mapId].events.find((event) => event.id === eventId)?.draft?.kind).toBe("edit");
    expect(projectWithoutEventDrafts(merged).maps[mapId].events.find((event) => event.id === eventId)?.pages?.[0]?.commands).toEqual([]);
  });

  it("keeps the working edit but saves an incoming canonical body", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 3, 3);
    saveEventDraft(mapId, eventId);
    const pageId = store.getCurrent().maps[mapId].events.find((event) => event.id === eventId)?.pages?.[0]?.id;
    if (!pageId) throw new Error("missing page");
    beginExistingEventDraft(mapId, eventId);
    setEventPageTextCommand(mapId, eventId, pageId, undefined, "still typing");

    const live = store.getCurrent();
    const incoming = projectWithoutEventDrafts(live);
    const incomingEvent = incoming.maps[mapId].events.find((event) => event.id === eventId);
    const page = incomingEvent?.pages?.[0];
    if (!page) throw new Error("missing incoming page");
    page.commands = [{ kind: "text", body: "from disk" }];

    const merged = preserveEventDraftsOnProject(incoming, live);
    const mergedEvent = merged.maps[mapId].events.find((event) => event.id === eventId);
    expect(mergedEvent?.pages?.[0]?.commands[0]).toEqual({
      kind: "text",
      body: "still typing",
      speaker: undefined,
    });
    expect(mergedEvent?.draft?.kind).toBe("edit");
    expect(mergedEvent?.draft?.original?.pages?.[0]?.commands[0]).toEqual({
      kind: "text",
      body: "from disk",
    });
    expect(projectWithoutEventDrafts(merged).maps[mapId].events.find((event) => event.id === eventId)?.pages?.[0]?.commands[0]).toEqual({
      kind: "text",
      body: "from disk",
    });
  });

  it("does not resurrect a committed event that the incoming project deleted", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 2, 2);
    saveEventDraft(mapId, eventId);
    beginExistingEventDraft(mapId, eventId);
    const live = store.getCurrent();
    const incoming = projectWithoutEventDrafts(live);
    incoming.maps[mapId].events = incoming.maps[mapId].events.filter((event) => event.id !== eventId);

    const merged = preserveEventDraftsOnProject(incoming, live);
    const kept = merged.maps[mapId].events.find((event) => event.id === eventId);

    expect(kept?.draft?.conflict?.kind).toBe("remote-delete");
    expect(projectWithoutEventDrafts(merged).maps[mapId].events.some((event) => event.id === eventId)).toBe(false);
    expect(getEventDraftVaultEntry(mapId, eventId)?.event.draft?.conflict?.kind).toBe("remote-delete");
  });
});
