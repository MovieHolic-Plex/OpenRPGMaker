import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { terrainRecordAt } from "@/project/terrainAt";

function tagTile(project: ReturnType<typeof createBlankProject>, tag: number): { mapId: string; x: number; y: number } {
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("missing start map");
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new Error("missing tileset");
  const x = project.startPos.x;
  const y = project.startPos.y;
  const tile = map.lowerTiles[y * map.width + x] ?? 0;
  if (!Array.isArray(tileset.terrain)) (tileset as { terrain: number[] }).terrain = [];
  while (tileset.terrain.length <= tile) tileset.terrain.push(0);
  tileset.terrain[tile] = tag;
  const meta = [...(tileset.tileMeta ?? [])];
  while (meta.length <= tile) meta.push({ label: "", description: "" });
  meta[tile] = { ...(meta[tile] ?? { label: "", description: "" }), terrainTag: tag };
  tileset.tileMeta = meta;
  return { mapId, x, y };
}

describe("terrainRecordAt", () => {
  it("resolves tag N to the Nth authored terrain record", () => {
    const project = createBlankProject();
    const loc = tagTile(project, 2);
    project.database.terrains = [
      { id: "t1", name: "평지", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
      { id: "t2", name: "독늪", damage: 10, encounterRatePercent: 50, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
    ];
    const found = terrainRecordAt(project, loc);
    expect(found?.record.id).toBe("t2");
    expect(found?.tag).toBe(2);
  });

  it("returns undefined when the tile has no tag", () => {
    const project = createBlankProject();
    const loc = tagTile(project, 0);
    expect(terrainRecordAt(project, loc)).toBeUndefined();
  });

  it("falls back to tileMeta.terrainTag over tileset.terrain", () => {
    const project = createBlankProject();
    const loc = tagTile(project, 0);
    const map = project.maps[loc.mapId];
    if (!map) throw new Error("missing map");
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    const tile = map.lowerTiles[loc.y * map.width + loc.x] ?? 0;
    const meta = [...(tileset.tileMeta ?? [])];
    while (meta.length <= tile) meta.push({ label: "", description: "" });
    meta[tile] = { ...(meta[tile] ?? { label: "", description: "" }), terrainTag: 3 };
    tileset.tileMeta = meta;
    project.database.terrains = [
      { id: "t1", name: "평지", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
      { id: "t2", name: "둘", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
      { id: "t3", name: "셋", damage: 7, encounterRatePercent: 10, characterDisplay: "transparent", vehiclePassage: { boat: true, ship: false, airshipLand: false } },
    ];
    const found = terrainRecordAt(project, loc);
    expect(found?.tag).toBe(3);
    expect(found?.record.id).toBe("t3");
  });
});
