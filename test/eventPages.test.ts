import { beforeEach, describe, expect, it } from "vitest";
import { addSwitch } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { CHOICE_CANCEL_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { addEvent } from "@/editor/eventActions";
import {
  addEventPageCommandAt,
  addEventPage,
  copyEventPage,
  copyEventPageToClipboard,
  deleteEventPage,
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

  it("selects an adjacent page after deleting the active page", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 2, 2);
    const page2 = addEventPage(mapId, eventId);
    const page3 = addEventPage(mapId, eventId);
    editorState.set({ selectedEventPageId: page3 });

    deleteEventPage(mapId, eventId, page3);

    // 삭제된 페이지(page3)가 마지막이었으므로 이전 페이지(page2)가 선택된다.
    expect(editorState.get().selectedEventPageId).toBe(page2);
    const event = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId);
    expect(event?.pages).toHaveLength(2);
  });

  it("selects the page now at the deleted index when deleting a middle page", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 2, 2);
    const page2 = addEventPage(mapId, eventId);
    const page3 = addEventPage(mapId, eventId);
    editorState.set({ selectedEventPageId: page2 });

    deleteEventPage(mapId, eventId, page2);

    // 중간 페이지(page2) 삭제 후 같은 인덱스의 페이지(page3)가 선택된다.
    expect(editorState.get().selectedEventPageId).toBe(page3);
  });

  it("does not update selection when deletion is refused (single page)", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 2, 2);
    const event = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId);
    const page1 = event?.pages?.[0]?.id ?? "";
    editorState.set({ selectedEventPageId: page1 });

    deleteEventPage(mapId, eventId, page1);

    // 페이지가 1개뿐이면 삭제가 거부되고 선택도 변경되지 않는다.
    expect(editorState.get().selectedEventPageId).toBe(page1);
  });

  it("avoids page name collision after delete and re-add", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 2, 2);
    const page2 = addEventPage(mapId, eventId);
    const page3 = addEventPage(mapId, eventId);

    deleteEventPage(mapId, eventId, page2);
    const newPageId = addEventPage(mapId, eventId);

    const event = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId);
    const names = event?.pages?.map((page) => page.name) ?? [];
    const newPage = event?.pages?.find((page) => page.id === newPageId);
    // "페이지 3" 이 이미 존재하므로 새 페이지는 "페이지 4" 가 된다 (충돌 회피).
    expect(newPage?.name).toBe("페이지 4");
    expect(names.filter((name) => name === newPage?.name)).toHaveLength(1);
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

  it("edits commands inside choice cancel branches like regular event branches", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 2, 2);
    const pageId = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId)?.pages?.[0]?.id;
    if (!pageId) throw new Error("page missing");

    addEventPageCommandAt(mapId, eventId, pageId, [], {
      kind: "choices",
      prompt: "계속할까요?",
      options: [
        { text: "예", branch: [{ kind: "text", body: "yes" }] },
        { text: "아니오", branch: [] },
      ],
      cancelBehavior: "branch",
      cancelBranch: [{ kind: "text", body: "old cancel" }],
    });

    replaceEventPageCommandAt(mapId, eventId, pageId, [0, CHOICE_CANCEL_BRANCH_INDEX, 0], { kind: "text", body: "new cancel" });
    addEventPageCommandAt(mapId, eventId, pageId, [0, CHOICE_CANCEL_BRANCH_INDEX], { kind: "setSwitch", switchId: "cancelled", value: true });

    const command = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId)?.pages?.[0]?.commands[0];
    expect(command).toEqual({
      kind: "choices",
      prompt: "계속할까요?",
      options: [
        { text: "예", branch: [{ kind: "text", body: "yes" }] },
        { text: "아니오", branch: [] },
      ],
      cancelBehavior: "branch",
      cancelBranch: [
        { kind: "text", body: "new cancel" },
        { kind: "setSwitch", switchId: "cancelled", value: true },
      ],
    });
  });
});
