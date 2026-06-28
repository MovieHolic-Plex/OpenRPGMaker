import { beforeEach, describe, expect, it } from "vitest";
import { createEventDraft, beginExistingEventDraft, discardEventDraft, saveEventDraft } from "@/editor/eventDraftActions";
import { setEventPageTextCommand } from "@/editor/eventPages";
import { createBlankProject } from "@/project/defaults";
import { eventDraftDiffById, projectWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";

beforeEach(() => {
  store.replace(createBlankProject());
});

describe("event draft lifecycle", () => {
  it("keeps a newly clicked event out of persisted project data until save", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 2, 2);

    expect(store.getCurrent().maps[mapId].events).toHaveLength(1);
    expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(0);

    const diff = eventDraftDiffById(store.getCurrent(), mapId, eventId);
    expect(diff?.kind).toBe("created");
    expect(diff?.changes.some((change) => change.path === "event")).toBe(true);

    saveEventDraft(mapId, eventId);

    const persisted = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events;
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.id).toBe(eventId);
    expect(persisted[0]?.draft).toBeUndefined();
  });

  it("discards an unsaved new event without leaving persisted data behind", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 3, 3);

    discardEventDraft(mapId, eventId);

    expect(store.getCurrent().maps[mapId].events).toHaveLength(0);
    expect(projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events).toHaveLength(0);
  });

  it("keeps edits diffable and out of persisted project data until save", () => {
    const mapId = store.getCurrent().startMapId;
    const eventId = createEventDraft(mapId, 4, 4);
    saveEventDraft(mapId, eventId);
    const pageId = store.getCurrent().maps[mapId].events[0]?.pages?.[0]?.id;
    if (!pageId) throw new Error("default event page missing");

    beginExistingEventDraft(mapId, eventId);
    setEventPageTextCommand(mapId, eventId, pageId, undefined, "changed before save");

    const beforeSave = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events[0];
    expect(beforeSave?.pages?.[0]?.commands).toEqual([]);
    const diff = eventDraftDiffById(store.getCurrent(), mapId, eventId);
    expect(diff?.kind).toBe("updated");
    expect(diff?.changes.map((change) => change.path)).toContain("event.pages[0].commands[0]");

    saveEventDraft(mapId, eventId);

    const afterSave = projectWithoutEventDrafts(store.getCurrent()).maps[mapId].events[0];
    expect(afterSave?.pages?.[0]?.commands[0]).toEqual({
      kind: "text",
      body: "changed before save",
      speaker: undefined,
    });
  });
});
