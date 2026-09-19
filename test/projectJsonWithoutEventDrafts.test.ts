import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { projectJsonWithoutEventDrafts, projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { GameEvent, Project } from "@/project/types";

function makeEvent(id: string, x: number): GameEvent {
  return {
    id,
    x,
    y: 1,
    trigger: { kind: "action" },
    commands: [{ kind: "text", text: `body of ${id}` }],
  } as unknown as GameEvent;
}

/** 원본 깊은복제 경로와 **바이트 단위로 같은 JSON** 이어야 한다. */
function expectSameJson(project: Project): void {
  expect(projectJsonWithoutEventDrafts(project)).toBe(JSON.stringify(projectWithoutEventDrafts(project)));
}

describe("projectJsonWithoutEventDrafts", () => {
  it("matches the deep-clone projection when no event carries a draft", () => {
    const project = createBlankProject();
    project.maps[project.startMapId].events = [makeEvent("event_a", 1), makeEvent("event_b", 2)];
    expectSameJson(project);
  });

  it("matches the deep-clone projection for new drafts, edit drafts and plain events", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const edited = makeEvent("event_edit", 3);
    const original = makeEvent("event_edit", 3);
    project.maps[mapId].events = [
      makeEvent("event_plain", 1),
      { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
      { ...edited, commands: [{ kind: "text", text: "working body" }], draft: { kind: "edit", original } } as unknown as GameEvent,
      { ...makeEvent("event_edit_no_original", 4), draft: { kind: "edit" } } as unknown as GameEvent,
    ];
    expectSameJson(project);
  });

  it("matches the deep-clone projection across several maps where only one holds drafts", () => {
    const project = createBlankProject();
    const first = project.startMapId;
    project.maps[first].events = [makeEvent("event_plain", 1)];
    project.maps.map_second = structuredClone(project.maps[first]);
    project.maps.map_second.id = "map_second";
    project.maps.map_second.events = [
      { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
    ];
    expectSameJson(project);
  });

  // 이 함수의 존재 이유 자체 — 드래그 한 번에 2~3회 도는 경로에서 프로젝트 전체 복제는
  // 120x100 맵 기준 비용의 62%였다(.probe/attribute-paint.json).
  it("does not deep-clone the project", () => {
    const project = createBlankProject();
    project.maps[project.startMapId].events = [
      makeEvent("event_plain", 1),
      { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
    ];
    const clone = vi.spyOn(globalThis, "structuredClone");
    projectJsonWithoutEventDrafts(project);
    expect(clone).not.toHaveBeenCalled();
    clone.mockRestore();
  });

  it("leaves the caller's project untouched", () => {
    const project = createBlankProject();
    project.maps[project.startMapId].events = [
      { ...makeEvent("event_new", 2), draft: { kind: "new" } } as GameEvent,
    ];
    const before = JSON.stringify(project);
    projectJsonWithoutEventDrafts(project);
    expect(JSON.stringify(project)).toBe(before);
  });
});
