import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { computeReachableCells } from "@/project/lint/reachability";
import { prepareVillageLakesides, finishVillageLakesides, assertVillagePublicAccess } from "@/editor/tools/village/lakeside";
import { paintRoadStrip } from "@/editor/tools/village/roads";

describe("lakeside and public access", () => {
  it("finds an off-center shore when compact lots occupy all four bank midpoints", () => {
    const project = createBlankProject(), map = project.maps.map_blank_start!;
    const water = { x: 5, y: 5, w: 8, h: 6 }, blocked = new Set(["13,8", "9,12", "3,8", "9,3"]);
    for (let y = 5; y < 11; y++) for (let x = 5; x < 13; x++) blocked.add(`${x},${y}`);
    paintRoadStrip(map, "sand", [{ x: 1, y: 1 }]);
    const shores = prepareVillageLakesides(project, map, { x: 0, y: 0, w: map.width, h: map.height }, [water], "sand", blocked);
    expect(shores).toHaveLength(1);
    const entry = shores[0]!.entry;
    expect(computeReachableCells(project, map, 1, 1).has(`${entry.x},${entry.y}`)).toBe(true);
    expect([...blocked].every(key => { const [x, y] = key.split(",").map(Number); return map.lowerTiles[y! * map.width + x!] === TILE.GRASS; })).toBe(true);
  });

  it("keeps a sole north entrance open when dressing a shore with a complete bench", () => {
    const project = createBlankProject(), map = project.maps.map_blank_start!;
    map.lowerTiles.fill(45); map.upperTiles.fill(TILE.EMPTY);
    const water = { x: 4, y: 7, w: 4, h: 4 };
    for (let y = 8; y <= 10; y++) for (let x = 8; x <= 10; x++) map.lowerTiles[y * map.width + x] = TILE.GRASS;
    for (let y = 2; y <= 7; y++) map.lowerTiles[y * map.width + 9] = TILE.GRASS;
    paintRoadStrip(map, "sand", [{ x: 9, y: 2 }]);
    const shores = prepareVillageLakesides(project, map, { x: 0, y: 0, w: map.width, h: map.height }, [water], "sand", new Set());
    expect(shores).toHaveLength(1);
    expect(computeReachableCells(project, map, 9, 2).has("9,10")).toBe(true);
    expect(finishVillageLakesides(project, map, shores)).toBe(2);
    expect(computeReachableCells(project, map, 9, 2).has("9,10")).toBe(true);
    expect(map.upperTiles[8 * map.width + 9]).toBe(TILE.EMPTY);
  });

  it.each(["market-display", "lakeside"])("rejects a blocked actual %s destination even when its neighbor is reachable", tag => {
    const project = createBlankProject(), map = project.maps.map_blank_start!;
    map.layoutPlan = { version: 1, kind: "houses", regions: [{ id: "public", role: "custom", label: "Public access", x: 4, y: 4, w: 2, h: 2,
      front: { x: 5, y: 5 }, tags: [tag] }] };
    map.lowerTiles[5 * map.width + 5] = 45;
    expect(() => assertVillagePublicAccess(project, map, { x: 5, y: 6 })).toThrow(/마을 접근로가 막혔습니다/);
  });
});
