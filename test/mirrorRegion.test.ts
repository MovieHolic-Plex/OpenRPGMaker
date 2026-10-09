import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

function setup() {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  // 3×2 영역 (1,1)~(3,2)에 식별 가능한 타일 패턴을 깐다
  const at = (x: number, y: number) => y * map.width + x;
  map.lowerTiles[at(1, 1)] = 101;
  map.lowerTiles[at(2, 1)] = 102;
  map.lowerTiles[at(3, 1)] = 103;
  map.lowerTiles[at(1, 2)] = 104;
  map.lowerTiles[at(2, 2)] = 105;
  map.lowerTiles[at(3, 2)] = 106;
  map.upperTiles[at(1, 1)] = 201;
  map.lowerTileStacks = { [at(1, 1)]: [301, 302] };
  map.events.push({
    id: "ev_m",
    x: 1,
    y: 2,
    trigger: { kind: "action" },
    commands: [],
    pages: [],
  } as never);
  return { project, mapId, map, at };
}

describe("mirror_region", () => {
  it("horizontal: 타일·스택·이벤트 x좌표를 좌우 대칭한다", () => {
    const { project, mapId, map, at } = setup();
    getTool("mirror_region")!.run(project, { mapId, x: 1, y: 1, w: 3, h: 2, axis: "horizontal" });
    expect(map.lowerTiles[at(1, 1)]).toBe(103);
    expect(map.lowerTiles[at(2, 1)]).toBe(102);
    expect(map.lowerTiles[at(3, 1)]).toBe(101);
    expect(map.lowerTiles[at(3, 2)]).toBe(104);
    expect(map.upperTiles[at(3, 1)]).toBe(201); // upper도 대칭
    expect(map.lowerTileStacks?.[at(3, 1)]).toEqual([301, 302]); // 스택 이동
    expect(map.lowerTileStacks?.[at(1, 1)]).toBeUndefined();
    const event = map.events.find((entry) => entry.id === "ev_m")!;
    expect(event.x).toBe(3); // 1 → 3 (영역 [1,3] 대칭)
    expect(event.y).toBe(2);
  });

  it("vertical: y좌표를 상하 대칭한다", () => {
    const { project, mapId, map, at } = setup();
    getTool("mirror_region")!.run(project, { mapId, x: 1, y: 1, w: 3, h: 2, axis: "vertical" });
    expect(map.lowerTiles[at(1, 1)]).toBe(104);
    expect(map.lowerTiles[at(1, 2)]).toBe(101);
  });

  it("영역이 맵과 겹치지 않으면 ToolError", () => {
    const { project, mapId } = setup();
    expect(() =>
      getTool("mirror_region")!.run(project, { mapId, x: 999, y: 999, w: 2, h: 2, axis: "horizontal" })
    ).toThrow();
  });
});
