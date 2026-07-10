import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

// createBlankProject()가 기본 맵/타일셋/아이템 픽스처를 제공하는 기존 테스트 픽스처 패턴을 따른다
// (place_npc 계열 테스트: test/placeNpcMalformedPage.test.ts)와 동일 소스.
function projectWithMap(): { project: Project; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  return { project, mapId };
}

describe("place_chest", () => {
  it("셀프스위치 2페이지 보물상자 이벤트를 만든다 (아이템+골드)", () => {
    const { project, mapId } = projectWithMap();
    const itemId = project.database.items[0]?.id ?? "item_potion";
    const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId, gold: 50 } });
    expect(result.summary).toContain("보물상자");
    const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    expect(event.pages).toHaveLength(2);
    const closed = event.pages![0];
    expect(closed.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: false }]);
    const kinds = closed.commands.map((command) => command.kind);
    expect(kinds).toEqual(["changeItem", "changeGold", "text", "setSelfSwitch"]);
    const opened = event.pages![1];
    expect(opened.conditions).toEqual([{ kind: "selfSwitch", key: "A", value: true }]);
  });

  it("contents가 비면 ToolError", () => {
    const { project, mapId } = projectWithMap();
    expect(() => getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: {} })).toThrow(/contents/);
  });

  it("DB에 없는 아이템이면 경고를 남긴다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_chest")!.run(project, { mapId, x: 3, y: 3, contents: { itemId: "item_없는것" } });
    expect(result.warnings?.some((warning) => warning.includes("item_없는것"))).toBe(true);
  });
});

describe("place_savepoint", () => {
  it("checkpointSave 커맨드를 가진 이벤트를 만든다", () => {
    const { project, mapId } = projectWithMap();
    const result = getTool("place_savepoint")!.run(project, { mapId, x: 2, y: 2 });
    const event = project.maps[mapId].events.find((entry) => entry.id === (result.data as { eventId: string }).eventId)!;
    const kinds = event.pages![0].commands.map((command) => command.kind);
    expect(kinds).toContain("checkpointSave");
  });
});
