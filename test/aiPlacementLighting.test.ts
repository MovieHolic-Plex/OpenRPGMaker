import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project, Rect } from "@/project/types";

type LightingToolCase = {
  readonly name: string;
  readonly label: string;
  readonly args: (mapId: string, area: Rect) => Record<string, unknown>;
};

const CASES: readonly LightingToolCase[] = [
  {
    name: "set_lighting_volume",
    label: "영역 조명",
    args: (mapId, area) => ({ mapId, ambient: 0.7, applyMode: "event", area }),
  },
  {
    name: "set_scene_mood",
    label: "장면 분위기",
    args: (mapId, area) => ({
      mapId,
      applyMode: "event",
      weather: { kind: "fog", intensity: 0.4 },
      lighting: { ambient: 0.7, area },
    }),
  },
];

function fixture(): { project: Project; map: GameMap; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  return { project, map: project.maps[mapId], mapId };
}

function setSolid(map: GameMap, x: number, y: number, tile: number): void {
  map.lowerTiles[y * map.width + x] = tile;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

function cells(area: Rect): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) result.push({ x, y });
  }
  return result;
}

for (const toolCase of CASES) {
  describe(`${toolCase.name} 통행 불가 칸 제외`, () => {
    it(`${toolCase.label} 영역에서 물과 벽을 건너뛰고 통행 가능 칸에만 이벤트를 만든다`, () => {
      const { project, map, mapId } = fixture();
      const area = { x: 2, y: 2, w: 3, h: 2 };
      setSolid(map, 2, 2, TILE.WATER);
      setSolid(map, 3, 2, TILE.WALL);
      expect(isPassable(project, map, 2, 2)).toBe(false);
      expect(isPassable(project, map, 3, 2)).toBe(false);
      const passableCount = cells(area).filter(({ x, y }) => isPassable(project, map, x, y)).length;

      const result = getTool(toolCase.name)!.run(project, toolCase.args(mapId, area));

      const data = result.data as { eventIds: string[] };
      expect(data.eventIds).toHaveLength(passableCount);
      const created = map.events.filter((event) => data.eventIds.includes(event.id));
      expect(created).toHaveLength(passableCount);
      for (const event of created) expect(isPassable(project, map, event.x, event.y)).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings?.[0]).toContain("2개");
      expect(result.warnings?.[0]).toContain("(2, 2)");
      expect(result.warnings?.[0]).toContain("(3, 2)");
    });

    it(`${toolCase.label} 영역이 모두 통행 가능하면 이전과 같은 수의 이벤트를 만든다`, () => {
      const { project, map, mapId } = fixture();
      const area = { x: 8, y: 8, w: 2, h: 2 };
      expect(cells(area).every(({ x, y }) => isPassable(project, map, x, y))).toBe(true);

      const result = getTool(toolCase.name)!.run(project, toolCase.args(mapId, area));

      const data = result.data as { eventIds: string[] };
      expect(data.eventIds).toHaveLength(area.w * area.h);
      expect(result.warnings).toBeUndefined();
    });
  });
}
