import { beforeEach, describe, expect, it } from "vitest";
import { addSwitch } from "@/editor/actions";
import { addEvent } from "@/editor/eventActions";
import {
  addEventPageCommandAt,
  addEventPage,
  copyEventPage,
  copyEventPageToClipboard,
  pasteEventPage,
  moveEventPage,
  replaceEventPageCommandAt,
  setEventPageTextCommand,
  updateEventPage,
} from "@/editor/eventPages";
import { createBlankProject } from "@/project/defaults";
import { resolveEventPage } from "@/project/io";
import { store } from "@/project/store";

beforeEach(() => {
  store.replace(createBlankProject());
});

describe("event pages", () => {
  it("creates new events with a page-backed command model", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 2, 2);
    const event = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId);

    expect(event?.pages).toHaveLength(1);
    expect(event?.pages?.[0].commands).toEqual([]);
    expect(event?.pages?.[0].trigger.kind).toBe("action");
    const pageId = event?.pages?.[0].id;
    if (!pageId) throw new Error("page missing");
    setEventPageTextCommand(mapId, eventId, pageId, undefined, "hello");
    expect(store.getCurrent().maps[mapId].events.find((item) => item.id === eventId)?.pages?.[0].commands[0]).toEqual({
      kind: "text",
      body: "hello",
      speaker: undefined,
    });
  });

  it("resolves the highest-number matching page by switch condition", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const switchId = addSwitch("Quest Done");
    const eventId = addEvent(mapId, 2, 2);
    const secondPageId = addEventPage(mapId, eventId);
    updateEventPage(mapId, eventId, secondPageId, {
      conditions: [{ kind: "switch", switchId, value: true }],
    });
    setEventPageTextCommand(mapId, eventId, secondPageId, undefined, "second");

    const event = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId);
    if (!event) throw new Error("event missing");
    expect(resolveEventPage(event, { switches: {}, variables: {}, inventory: {}, partyActorIds: [] })?.name).toBe("페이지 1");
    expect(resolveEventPage(event, { switches: { [switchId]: true }, variables: {}, inventory: {}, partyActorIds: [] })?.id).toBe(secondPageId);
  });

  it("copies and reorders pages without corrupting sibling commands", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 2, 2);
    const page2 = addEventPage(mapId, eventId);
    setEventPageTextCommand(mapId, eventId, page2, undefined, "page two");
    const copied = copyEventPage(mapId, eventId, page2);
    setEventPageTextCommand(mapId, eventId, copied, undefined, "copy");
    moveEventPage(mapId, eventId, copied, -1);

    const event = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId);
    const pages = event?.pages ?? [];
    const original = pages.find((page) => page.id === page2);
    const clone = pages.find((page) => page.id === copied);
    expect(original?.commands[0]).toEqual({ kind: "text", body: "page two", speaker: undefined });
    expect(clone?.commands[0]).toEqual({ kind: "text", body: "copy", speaker: undefined });
    expect(pages.findIndex((page) => page.id === copied)).toBeLessThan(
      pages.findIndex((page) => page.id === page2)
    );
  });

  it("copies a page to a paste buffer and pastes it as a new selected page", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 2, 2);
    const page2 = addEventPage(mapId, eventId);
    setEventPageTextCommand(mapId, eventId, page2, undefined, "paste source");

    expect(copyEventPageToClipboard(mapId, eventId, page2)).toBe(true);
    const pasted = pasteEventPage(mapId, eventId);

    const event = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId);
    const pastedPage = event?.pages?.find((page) => page.id === pasted);
    expect(pasted).not.toBe("");
    expect(pastedPage?.id).not.toBe(page2);
    expect(pastedPage?.name).toContain("복사본");
    expect(pastedPage?.commands[0]).toEqual({ kind: "text", body: "paste source", speaker: undefined });
  });

  it("edits commands inside conditional branch pages without corrupting sibling branches", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 2, 2);
    const pageId = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId)?.pages?.[0]?.id;
    if (!pageId) throw new Error("page missing");

    addEventPageCommandAt(mapId, eventId, pageId, [], {
      kind: "fork",
      condition: { kind: "switch", switchId: "quest_done", value: true },
      then: [{ kind: "text", body: "old true" }],
      else: [{ kind: "text", body: "old false" }],
    });

    replaceEventPageCommandAt(mapId, eventId, pageId, [0, -2, 0], { kind: "text", body: "new true" });
    addEventPageCommandAt(mapId, eventId, pageId, [0, -3], { kind: "text", body: "second false" });

    const command = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId)?.pages?.[0]?.commands[0];
    expect(command).toEqual({
      kind: "fork",
      condition: { kind: "switch", switchId: "quest_done", value: true },
      then: [{ kind: "text", body: "new true" }],
      else: [{ kind: "text", body: "old false" }, { kind: "text", body: "second false" }],
    });
  });
});
