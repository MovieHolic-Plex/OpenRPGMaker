import { beforeEach, describe, expect, it } from "vitest";
import { addSwitch } from "@/editor/actions";
import { addEvent } from "@/editor/eventActions";
import {
  addEventPage,
  copyEventPage,
  moveEventPage,
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
    expect(event?.pages?.[0].commands[0].kind).toBe("text");
    expect(event?.pages?.[0].trigger.kind).toBe("action");
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
    expect(resolveEventPage(event, { switches: {}, variables: {}, inventory: {}, partyActorIds: [] })?.name).toBe("Page 1");
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
});
