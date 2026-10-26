import { beforeEach, describe, expect, it } from "vitest";
import { addEvent } from "@/editor/eventActions";
import {
  addEventPageCommand,
  moveEventPageCommandAt,
  moveEventPageCommandToIndex,
} from "@/editor/eventPages";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, MapId } from "@/project/types";

// 드래그 재정렬(RM2K3 이벤트 명령 순서 변경) 백엔드 검증.
describe("event command drag reorder", () => {
  let mapId: MapId;
  let eventId: string;
  let pageId: string;

  beforeEach(() => {
    store.replace(createBlankProject());
    mapId = store.getCurrent().startMapId;
    eventId = addEvent(mapId, 1, 1);
    const event = store.getCurrent().maps[mapId].events.find((item) => item.id === eventId)!;
    pageId = event.pages![0].id;
    // 새 이벤트의 첫 페이지는 빈 명령 목록으로 시작한다(createDefaultGameEvent: commands = []) — [A,B,C] 를 직접 쌓는다.
    addEventPageCommand(mapId, eventId, pageId, { kind: "text", body: "A" });
    addEventPageCommand(mapId, eventId, pageId, { kind: "text", body: "B" });
    addEventPageCommand(mapId, eventId, pageId, { kind: "text", body: "C" });
  });

  function bodies(): string[] {
    const page = store
      .getCurrent()
      .maps[mapId].events.find((item) => item.id === eventId)!
      .pages!.find((item) => item.id === pageId)!;
    return page.commands.map((cmd: Command) => (cmd.kind === "text" ? cmd.body : cmd.kind));
  }

  it("moves a command to an arbitrary index in one store update", () => {
    // [A, B, C] → 첫 명령을 끝으로 보낸다.
    moveEventPageCommandToIndex(mapId, eventId, pageId, [0], 2);
    expect(bodies()).toEqual(["B", "C", "A"]);
  });

  it("moves a command earlier without disturbing siblings", () => {
    // [A, B, C] → 마지막 명령을 맨 앞으로.
    moveEventPageCommandToIndex(mapId, eventId, pageId, [2], 0);
    expect(bodies()).toEqual(["C", "A", "B"]);
  });

  it("clamps target index to valid range", () => {
    moveEventPageCommandToIndex(mapId, eventId, pageId, [0], 999);
    expect(bodies()).toEqual(["B", "C", "A"]);
  });

  it("is a no-op when source equals destination", () => {
    moveEventPageCommandToIndex(mapId, eventId, pageId, [1], 1);
    expect(bodies()).toEqual(["A", "B", "C"]);
  });

  it("step move (dir) still works for the up/down buttons", () => {
    moveEventPageCommandAt(mapId, eventId, pageId, [2], -1);
    expect(bodies()).toEqual(["A", "C", "B"]);
  });
});
