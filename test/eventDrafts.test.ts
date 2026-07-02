import { beforeEach, describe, expect, it } from "vitest";
import { createEventDraft, beginExistingEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { editorState } from "@/editor/editorState";
import { setEventPageTextCommand } from "@/editor/eventPages";
import { createBlankProject } from "@/project/defaults";
import { eventDraftDiffById, projectWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({ selectedEventId: null, selectedEventPageId: null });
});

describe("event draft lifecycle", () => {
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

  it("keeps a newly clicked event out of persisted project data until save", () => {
    const mapId = store.getCurrent().startMapId;
    const initialEventCount = store.getCurrent().maps[mapId].events.length;
    const initialPersistedCount = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.length;
    const eventId = createEventDraft(mapId, 2, 2);

    expect(store.getCurrent().maps[mapId].events).toHaveLength(initialEventCount + 1);
    expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(initialPersistedCount);

    const diff = eventDraftDiffById(store.getCurrent(), mapId, eventId);
    expect(diff?.kind).toBe("created");
    expect(diff?.changes.some((change) => change.path === "event")).toBe(true);

    saveEventDraft(mapId, eventId);

    const persisted = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events;
    expect(persisted).toHaveLength(initialPersistedCount + 1);
    expect(persisted.find((event) => event.id === eventId)?.draft).toBeUndefined();
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

  it("keeps edits diffable and out of persisted project data until save", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 4, 4);
    saveEventDraft(mapId, eventId);
    const pageId = store.getCurrent().maps[mapId].events.find((event) => event.id === eventId)?.pages?.[0]?.id;
    if (!pageId) throw new Error("default event page missing");

    beginExistingEventDraft(mapId, eventId);
    setEventPageTextCommand(mapId, eventId, pageId, undefined, "changed before save");

    const beforeSave = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events.find((event) => event.id === eventId);
    expect(beforeSave?.pages?.[0]?.commands).toEqual([]);
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
});
