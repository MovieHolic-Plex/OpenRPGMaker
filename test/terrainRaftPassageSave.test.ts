import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { normalizeTerrainRecords } from "@/project/databaseUtilityRecordModel";
import { deserialize, serialize } from "@/project/io";
import { vehicleCanEnter } from "@/project/vehicles";

function pinTerrainTag(project: ReturnType<typeof createBlankProject>, tag: number): void {
  const map = project.maps[project.startMapId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  map.lowerTiles[0] = 0;
  while (tileset.terrain.length <= 0) tileset.terrain.push(0);
  tileset.terrain[0] = tag;
  const meta = [...(tileset.tileMeta ?? [])];
  while (meta.length <= 0) meta.push({ label: "", description: "" });
  meta[0] = { ...(meta[0] ?? { label: "", description: "" }), terrainTag: tag };
  tileset.tileMeta = meta;
}

describe("terrain raft passage save", () => {
  it("keeps an explicit raft ban when a boat-only lake is reloaded", () => {
    const project = createBlankProject();
    project.database.terrains.push({
      id: "terrain_boat_lake",
      name: "보트 호수",
      damage: 0,
      encounterRatePercent: 100,
      characterDisplay: "normal",
      vehiclePassage: { boat: true, ship: false, airshipLand: false, raft: false },
    });
    pinTerrainTag(project, project.database.terrains.length);

    const loaded = deserialize(serialize(project));
    const passage = loaded.database.terrains.find((record) => record.id === "terrain_boat_lake")?.vehiclePassage;
    expect(passage?.raft).toBe(false);
    const loadedMap = loaded.maps[loaded.startMapId]!;
    expect(vehicleCanEnter(loaded, loadedMap, "raft", 0, 0)).toBe(false);
    expect(vehicleCanEnter(loaded, loadedMap, "boat", 0, 0)).toBe(true);
  });

  it("keeps raft:false when the assistant upserts a boat-only lake", () => {
    const context: ToolContext = { project: createEmptyToolProject("뗏목 금지") };
    const result = runTool(context, "upsert_database_utility", {
      collection: "terrains",
      record: {
        id: "terrain_boat_lake",
        name: "보트 호수",
        damage: 0,
        encounterRatePercent: 100,
        characterDisplay: "normal",
        vehiclePassage: { boat: true, ship: false, airshipLand: false, raft: false },
      },
    });
    expect(result.ok, result.summary).toBe(true);
    const passage = context.project.database.terrains?.find((record) => record.id === "terrain_boat_lake")?.vehiclePassage;
    expect(passage?.raft).toBe(false);
    expect(passage?.chocobo).toBeUndefined();
    expect(passage?.cart).toBeUndefined();
  });

  it("still omits raft when the author did not set it", () => {
    const [record] = normalizeTerrainRecords([{
      id: "lake",
      name: "호수",
      vehiclePassage: { boat: true, ship: false, airshipLand: false },
    }]);
    expect(record?.vehiclePassage).not.toHaveProperty("raft");
    expect(record?.vehiclePassage.chocobo).toBeUndefined();
    expect(record?.vehiclePassage.cart).toBeUndefined();
  });
});
