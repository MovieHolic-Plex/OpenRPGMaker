import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { TILE } from "@/project/defaults/constants";
import { isBlankStartProject, isUntouchedMap } from "@/project/projectBlankness";

// 첫 방문 브리핑(「빈 맵으로 시작」)은 이 판정이 true 일 때만 뜬다(src/app/mode.ts finishEditorBoot).
describe("isBlankStartProject", () => {
  it("treats a freshly created project as blank", () => {
    expect(isBlankStartProject(createBlankProject())).toBe(true);
  });

  it("is not blank once the only map has an event", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events.push({ id: "ev_1", name: "NPC", x: 1, y: 1, pages: [] } as unknown as (typeof map.events)[number]);
    expect(isBlankStartProject(project)).toBe(false);
  });

  it("is not blank once any tile layer is painted", () => {
    type Map = ReturnType<typeof createBlankMap>;
    const edits: ((map: Map) => void)[] = [
      (map) => { map.lowerTiles[3] = TILE.WATER; },
      (map) => { map.upperTiles[3] = TILE.TREE; },
      (map) => { map.lowerOverlayTiles = map.lowerTiles.map(() => TILE.EMPTY); map.lowerOverlayTiles[0] = 7; },
      (map) => { map.shadowBits = map.lowerTiles.map(() => 0); map.shadowBits[0] = 1; },
      (map) => { map.relief = { width: map.width, height: map.height, levels: map.lowerTiles.map(() => 0) }; map.relief.levels[0] = 2; },
    ];
    for (const edit of edits) {
      const map = createBlankMap("m", 4, 4);
      expect(isUntouchedMap(map)).toBe(true);
      edit(map);
      expect(isUntouchedMap(map)).toBe(false);
    }
  });

  it("keeps empty optional layers blank", () => {
    const map = createBlankMap("m", 3, 3);
    map.lowerOverlayTiles = map.lowerTiles.map(() => TILE.EMPTY);
    map.shadowBits = map.lowerTiles.map(() => 0);
    expect(isUntouchedMap(map)).toBe(true);
  });

  it("is not blank with a second map or a common event", () => {
    const twoMaps = createBlankProject();
    const extra = createBlankMap("second", 4, 4);
    twoMaps.maps[extra.id] = extra;
    expect(isBlankStartProject(twoMaps)).toBe(false);

    const withCommon = createBlankProject();
    withCommon.commonEvents.push({ id: "ce_1" } as unknown as (typeof withCommon.commonEvents)[number]);
    expect(isBlankStartProject(withCommon)).toBe(false);
  });
});
