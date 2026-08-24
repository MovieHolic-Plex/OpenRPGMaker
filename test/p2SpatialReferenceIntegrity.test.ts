import { afterEach, describe, expect, it } from "vitest";
import {
  databaseReferenceMessage,
  farmBuildingTypeReferenceMessage,
  homeDecorationTypeReferenceMessage,
} from "@/editor/databaseReferences";
import { createBlankProject } from "@/project/defaults";
import {
  collectProjectReferenceIssues,
  repairProjectReferences,
  validateProjectReferences,
} from "@/project/io/references";
import { applyMapDeletion, collectMapDeletionImpact } from "@/project/mapDeletion";
import { store } from "@/project/store";
import type { GameMap, Project } from "@/project/types";

afterEach(() => store.replace(createBlankProject()));

describe("P2 spatial project reference integrity", () => {
  it("reports definition FKs, placement FKs, bounds, duplicates, and footprint collisions with exact paths", () => {
    // Break caught: shape-valid spatial rows can still point at deleted project records or overlap after authoring edits.
    const project = spatialReferenceProject();
    const itemId = project.database.items[0]!.id;
    project.database.farmBuildingTypes = [
      buildingType("shed", itemId),
      buildingType("shed", itemId),
      {
        ...buildingType("broken_shed", "missing_item"),
        allowedMapIds: ["missing_map"],
        levels: [{ ...buildingType("broken_shed", itemId).levels[0]!, graphicResourceId: "missing_resource" }],
      },
    ];
    project.database.homeDecorationTypes = [
      decorationType("table", itemId),
      decorationType("table", itemId),
      { ...decorationType("broken_table", "missing_item"), graphicResourceId: "missing_resource", allowedMapIds: ["missing_map"] },
    ];
    project.session.farmBuildingPlacements = [
      buildingPlacement(project, "shed_ok", "shed", 2, 2),
      buildingPlacement(project, "shed_ok", "shed", 6, 2),
      buildingPlacement(project, "shed_missing", "missing_type", 8, 2),
      { ...buildingPlacement(project, "shed_level", "shed", 8, 3), level: 2 },
      { ...buildingPlacement(project, "shed_map", "shed", 8, 4), mapId: "missing_map" },
      buildingPlacement(project, "shed_oob", "shed", project.maps[project.startMapId]!.width - 1, 5),
    ];
    project.session.homeDecorationPlacements = [
      decorationPlacement(project, "table_collision", "table", 2, 2),
      decorationPlacement(project, "table_missing", "missing_type", 8, 6),
      { ...decorationPlacement(project, "table_orientation", "table", 8, 7), orientation: "up" },
    ];

    const issues = collectProjectReferenceIssues(project);
    expect(issues).toEqual(expect.arrayContaining([
      "database.farmBuildingTypes[1].id duplicates database.farmBuildingTypes[0].id: shed",
      "database.farmBuildingTypes[2].levels[0].graphicResourceId does not exist: missing_resource",
      "database.farmBuildingTypes[2].allowedMapIds[0] does not exist: missing_map",
      "database.homeDecorationTypes[1].id duplicates database.homeDecorationTypes[0].id: table",
      "database.homeDecorationTypes[2].placementItemId does not exist: missing_item",
      "database.homeDecorationTypes[2].graphicResourceId does not exist: missing_resource",
      "database.homeDecorationTypes[2].allowedMapIds[0] does not exist: missing_map",
      "session.farmBuildingPlacements[1].instanceId duplicates session.farmBuildingPlacements[0].instanceId: shed_ok",
      "session.farmBuildingPlacements[2].typeId does not exist: missing_type",
      "session.farmBuildingPlacements[3].level does not exist on farmBuildingType shed: 2",
      "session.farmBuildingPlacements[4].mapId does not exist: missing_map",
      `session.farmBuildingPlacements[5].footprint is out of bounds for map ${project.startMapId}`,
      "session.homeDecorationPlacements[0].footprint overlaps another spatial placement",
      "session.homeDecorationPlacements[1].typeId does not exist: missing_type",
      "session.homeDecorationPlacements[2].orientation is not allowed by homeDecorationType table: up",
    ]));
    expect(() => validateProjectReferences(project)).toThrow(/database\.farmBuildingTypes\[1\]\.id/);
  });

  it("repairs invalid definitions and cascades their placements without inventing replacements", () => {
    // Break caught: repair retains orphaned layouts or silently substitutes another definition/item.
    const project = spatialReferenceProject();
    const itemId = project.database.items[0]!.id;
    project.database.farmBuildingTypes = [
      buildingType("shed", itemId),
      buildingType("shed", itemId),
      buildingType("broken", "missing_item"),
    ];
    project.database.homeDecorationTypes = [
      decorationType("table", itemId),
      decorationType("bad", "missing_item"),
    ];
    project.session.farmBuildingPlacements = [
      buildingPlacement(project, "keep_shed", "shed", 2, 2),
      buildingPlacement(project, "overlap_shed", "shed", 2, 2),
      buildingPlacement(project, "bad_shed", "broken", 6, 2),
    ];
    project.session.homeDecorationPlacements = [
      decorationPlacement(project, "overlap_table", "table", 2, 2),
      decorationPlacement(project, "keep_table", "table", 7, 2),
      decorationPlacement(project, "bad_table", "bad", 8, 2),
    ];

    repairProjectReferences(project);

    expect(project.database.farmBuildingTypes?.map((row) => row.id)).toEqual(["shed"]);
    expect(project.database.homeDecorationTypes?.map((row) => row.id)).toEqual(["table"]);
    expect(project.session.farmBuildingPlacements?.map((row) => row.instanceId)).toEqual(["keep_shed"]);
    expect(project.session.homeDecorationPlacements?.map((row) => row.instanceId)).toEqual(["keep_table"]);
    expect(() => validateProjectReferences(project)).not.toThrow();
  });

  it("includes authored spatial placements in map deletion impact and cascades only that map", () => {
    // Break caught: deleting a map leaves general structures/decor with dangling mapIds and no confirmation count.
    const project = spatialReferenceProject();
    const itemId = project.database.items[0]!.id;
    const target = addMap(project, "map_homestead");
    project.database.farmBuildingTypes = [{ ...buildingType("shed", itemId), allowedMapIds: [project.startMapId, target.id] }];
    project.database.homeDecorationTypes = [{ ...decorationType("table", itemId), allowedMapIds: [project.startMapId, target.id] }];
    project.session.farmBuildingPlacements = [
      buildingPlacementOn(target, "shed_target", "shed", 2, 2),
      buildingPlacement(project, "shed_keep", "shed", 2, 2),
    ];
    project.session.homeDecorationPlacements = [
      decorationPlacementOn(target, "table_target", "table", 6, 2),
      decorationPlacement(project, "table_keep", "table", 6, 2),
    ];

    const impact = collectMapDeletionImpact(project, target.id);
    expect(impact?.farmBuildingPlacementIds).toEqual(["shed_target"]);
    expect(impact?.farmBuildingPlacementCount).toBe(1);
    expect(impact?.homeDecorationPlacementIds).toEqual(["table_target"]);
    expect(impact?.homeDecorationPlacementCount).toBe(1);

    applyMapDeletion(project, target.id);
    expect(project.session.farmBuildingPlacements?.map((row) => row.instanceId)).toEqual(["shed_keep"]);
    expect(project.session.homeDecorationPlacements?.map((row) => row.instanceId)).toEqual(["table_keep"]);
    expect(project.database.farmBuildingTypes?.[0]?.allowedMapIds).toEqual([project.startMapId]);
    expect(project.database.homeDecorationTypes?.[0]?.allowedMapIds).toEqual([project.startMapId]);
    expect(() => validateProjectReferences(project)).not.toThrow();
  });

  it("guards item and definition deletion while authored spatial rows reference them", () => {
    // Break caught: structured spatial editor deletes an item/type and leaves an immediately dangling row.
    const project = spatialReferenceProject();
    const itemId = project.database.items[0]!.id;
    project.database.farmBuildingTypes = [buildingType("shed", itemId)];
    project.database.homeDecorationTypes = [decorationType("table", itemId)];
    project.session.farmBuildingPlacements = [buildingPlacement(project, "shed_1", "shed", 2, 2)];
    project.session.homeDecorationPlacements = [decorationPlacement(project, "table_1", "table", 6, 2)];
    store.replace(project);

    expect(databaseReferenceMessage("items", itemId)).toMatch(/건물|장식/);
    expect(farmBuildingTypeReferenceMessage("shed")).toMatch(/shed_1/);
    expect(homeDecorationTypeReferenceMessage("table")).toMatch(/table_1/);
  });
});

function spatialReferenceProject(): Project { return createBlankProject(); }

function buildingType(id: string, itemId: string) {
  return {
    id,
    name: id,
    levels: [{
      level: 1,
      footprint: { width: 2, height: 2 },
      capacity: 4,
      cost: { items: [{ itemId, count: 1 }] },
      graphicResourceId: "easyrpg-picture-cloud",
    }],
  };
}

function decorationType(id: string, itemId: string) {
  return {
    id,
    name: id,
    placementItemId: itemId,
    footprint: { width: 1, height: 1 },
    blocksMovement: true,
    allowedOrientations: ["down", "left"] as const,
    graphicResourceId: "easyrpg-picture-cloud",
  };
}

function buildingPlacement(project: Project, instanceId: string, typeId: string, x: number, y: number) {
  return buildingPlacementOn(project.maps[project.startMapId]!, instanceId, typeId, x, y);
}

function buildingPlacementOn(map: GameMap, instanceId: string, typeId: string, x: number, y: number) {
  return { instanceId, typeId, level: 1, mapId: map.id, x, y, orientation: "down" as const };
}

function decorationPlacement(project: Project, instanceId: string, typeId: string, x: number, y: number) {
  return decorationPlacementOn(project.maps[project.startMapId]!, instanceId, typeId, x, y);
}

function decorationPlacementOn(map: GameMap, instanceId: string, typeId: string, x: number, y: number) {
  return { instanceId, typeId, mapId: map.id, x, y, orientation: "down" as const };
}

function addMap(project: Project, id: string): GameMap {
  const map = structuredClone(project.maps[project.startMapId]!);
  map.id = id;
  map.name = id;
  map.events = [];
  project.maps[id] = map;
  project.mapTree.children.push({ mapId: id, children: [] });
  return map;
}
