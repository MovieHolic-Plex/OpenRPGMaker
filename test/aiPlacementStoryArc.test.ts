import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { ToolError } from "@/editor/tools/types";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameEvent, GameMap, Project } from "@/project/types";

function fixture(): { project: Project; map: GameMap; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  return { project, map: project.maps[mapId], mapId };
}

function setWater(map: GameMap, x: number, y: number): void {
  map.lowerTiles[y * map.width + x] = TILE.WATER;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

function waterBlock(map: GameMap, cx: number, cy: number, radius: number): void {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) setWater(map, x, y);
  }
}

function storyArgs(mapId: string, x: number, y: number): Record<string, unknown> {
  return {
    id: "lost-crown",
    title: "잃어버린 왕관",
    mapId,
    eventId: "ev_story_beat",
    at: { x, y },
    opening: ["왕관의 흔적을 찾았다."],
    tutorialObjectives: [{ id: "find-clue", text: "단서를 조사한다." }],
    branchChoices: [
      { id: "return", label: "돌려준다", lines: ["왕관을 돌려준다."] },
      { id: "keep", label: "간직한다", lines: ["왕관을 숨긴다."] },
    ],
    twist: { enabled: false, flagId: "crown-twist", description: "", discoverInBranchId: "", reveal: [] },
  };
}

function eventById(map: GameMap): GameEvent {
  const event = map.events.find((candidate) => candidate.id === "ev_story_beat");
  if (!event) throw new Error("story beat event not found");
  return event;
}

describe("author_story_arc 비트 이벤트 통행 가능 배치", () => {
  it("통행 가능 이웃이 있는 물 타일은 상호작용 좌표를 유지한다", () => {
    const { project, map, mapId } = fixture();
    setWater(map, 5, 5);
    expect(isPassable(project, map, 5, 5)).toBe(false);

    const result = getTool("author_story_arc")!.run(project, storyArgs(mapId, 5, 5));

    const event = eventById(map);
    expect([event.x, event.y]).toEqual([5, 5]);
    expect((result.data as { adjusted: boolean }).adjusted).toBe(false);
  });

  it("3x3 물 블록 중심의 비트는 통행 가능 칸으로 자동 착지하고 경고한다", () => {
    const { project, map, mapId } = fixture();
    waterBlock(map, 8, 7, 1);
    expect(isPassable(project, map, 8, 7)).toBe(false);

    const result = getTool("author_story_arc")!.run(project, storyArgs(mapId, 8, 7));

    const event = eventById(map);
    expect(isPassable(project, map, event.x, event.y)).toBe(true);
    expect([event.x, event.y]).not.toEqual([8, 7]);
    expect((result.data as { adjusted: boolean }).adjusted).toBe(true);
    const warnings = result.warnings?.join("\n") ?? "";
    expect(warnings).toContain("(8, 7)");
    expect(warnings).toContain(`(${event.x}, ${event.y})`);
  });

  it("반경 3칸이 전부 물이면 story-beat-impassable ToolError를 낸다", () => {
    const { project, map, mapId } = fixture();
    waterBlock(map, 8, 7, 3);
    expect(isPassable(project, map, 8, 7)).toBe(false);

    let error: unknown;
    try {
      getTool("author_story_arc")!.run(project, storyArgs(mapId, 8, 7));
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ToolError);
    expect((error as ToolError).code).toBe("story-beat-impassable");
    expect(map.events).toHaveLength(0);
  });

  it("일반 지면의 비트 좌표는 바꾸지 않는다", () => {
    const { project, map, mapId } = fixture();
    expect(isPassable(project, map, 4, 4)).toBe(true);

    const result = getTool("author_story_arc")!.run(project, storyArgs(mapId, 4, 4));

    const event = eventById(map);
    expect([event.x, event.y]).toEqual([4, 4]);
    expect((result.data as { adjusted: boolean }).adjusted).toBe(false);
    expect(result.warnings).toBeUndefined();
  });
});
