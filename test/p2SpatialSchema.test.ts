import { describe, expect, it } from "vitest";
import { normalizeDatabaseRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";

type MutableRecord = Record<string, any>;

function configureSpatialProject(project: ReturnType<typeof createBlankProject>): void {
  const itemId = project.database.items[0]!.id;
  (project.database as MutableRecord).farmBuildingTypes = [{
    id: "farm_building_shed",
    name: "Shed",
    levels: [
      {
        level: 1,
        footprint: { width: 2, height: 3 },
        capacity: 8,
        cost: { gold: 100, items: [{ itemId, count: 2 }] },
        graphicResourceId: "easyrpg-picture-cloud",
      },
      {
        level: 2,
        footprint: { width: 3, height: 3 },
        capacity: 16,
        cost: { gold: 250, items: [{ itemId, count: 4 }] },
        graphicResourceId: "easyrpg-picture-cloud",
      },
    ],
  }];
  (project.database as MutableRecord).homeDecorationTypes = [{
    id: "home_decor_table",
    name: "Table",
    placementItemId: itemId,
    footprint: { width: 2, height: 1 },
    blocksMovement: true,
    allowedOrientations: ["down", "left", "right", "up"],
    graphicResourceId: "easyrpg-picture-cloud",
  }];
  (project.session as MutableRecord).farmBuildingPlacements = [{
    instanceId: "farm_building_1",
    typeId: "farm_building_shed",
    level: 1,
    mapId: project.startMapId,
    x: 2,
    y: 2,
    orientation: "down",
  }];
  (project.session as MutableRecord).homeDecorationPlacements = [{
    instanceId: "home_decor_1",
    typeId: "home_decor_table",
    mapId: project.startMapId,
    x: 7,
    y: 2,
    orientation: "left",
  }];
}

describe("P2 spatial authored schema", () => {
  it("round-trips independent building/decor definitions and instantiates keyed runtime placements", () => {
    // Break caught: authored P2 placements serialize but startSession has no independent runtime authority.
    const project = createBlankProject();
    configureSpatialProject(project);

    const loaded = deserialize(serialize(project)) as unknown as MutableRecord;
    expect(loaded.database.farmBuildingTypes).toEqual((project.database as MutableRecord).farmBuildingTypes);
    expect(loaded.database.homeDecorationTypes).toEqual((project.database as MutableRecord).homeDecorationTypes);
    expect(loaded.session.farmBuildingPlacements).toEqual((project.session as MutableRecord).farmBuildingPlacements);
    expect(loaded.session.homeDecorationPlacements).toEqual((project.session as MutableRecord).homeDecorationPlacements);

    const session = startSession(loaded as never, 601) as unknown as MutableRecord;
    expect(session.farmBuildingPlacements).toEqual({
      farm_building_1: expect.objectContaining({ typeId: "farm_building_shed", level: 1, x: 2, y: 2 }),
    });
    expect(session.homeDecorationPlacements).toEqual({
      home_decor_1: expect.objectContaining({ typeId: "home_decor_table", orientation: "left", x: 7, y: 2 }),
    });
    expect((loaded.system as MutableRecord).farmAnimalBuildings).toBeUndefined();
  });

  it("rejects duplicate ids, unsafe footprints, non-contiguous levels, and unknown orientations", () => {
    // Break caught: validateProjectV3 ignores malformed known P2 fields and lets unbounded footprint loops reach runtime.
    const cases: Array<{ mutate: (wire: MutableRecord) => void; pattern: RegExp }> = [
      {
        mutate: (wire) => {
          wire.database.farmBuildingTypes = [
            buildingTypeWire(wire, "duplicate"),
            buildingTypeWire(wire, "duplicate"),
          ];
        },
        pattern: /farmBuildingTypes.*duplicat/i,
      },
      {
        mutate: (wire) => {
          wire.database.farmBuildingTypes = [{
            ...buildingTypeWire(wire, "unsafe"),
            levels: [{
              ...buildingTypeWire(wire, "unsafe").levels[0],
              footprint: { width: Number.MAX_SAFE_INTEGER + 1, height: 1 },
            }],
          }];
        },
        pattern: /farmBuildingTypes.*footprint/i,
      },
      {
        mutate: (wire) => {
          wire.database.farmBuildingTypes = [{
            ...buildingTypeWire(wire, "gap"),
            levels: [
              buildingTypeWire(wire, "gap").levels[0],
              { ...buildingTypeWire(wire, "gap").levels[0], level: 3 },
            ],
          }];
        },
        pattern: /farmBuildingTypes.*level/i,
      },
      {
        mutate: (wire) => {
          wire.session.homeDecorationPlacements = [{
            instanceId: "decor_1",
            typeId: "decor_table",
            mapId: wire.startMapId,
            x: 1,
            y: 1,
            orientation: "diagonal",
          }];
        },
        pattern: /homeDecorationPlacements.*orientation/i,
      },
    ];

    for (const { mutate, pattern } of cases) {
      const wire = JSON.parse(serialize(createBlankProject())) as MutableRecord;
      mutate(wire);
      expect(() => deserialize(JSON.stringify(wire))).toThrow(pattern);
    }
  });

  it("bounds direct normalization without inventing optional legacy packages", () => {
    // Break caught: direct store writes bypass the JSON gate and preserve unsafe/duplicate spatial records.
    const project = createBlankProject();
    const normalized = normalizeDatabaseRecords({
      ...project.database,
      farmBuildingTypes: Array.from({ length: 270 }, (_, index) => ({
        id: index === 1 ? "building_0" : `building_${index}`,
        name: `Building ${index}`,
        levels: [{
          level: 1,
          footprint: { width: 1e300, height: 2 },
          capacity: 1e300,
          graphicResourceId: "easyrpg-picture-cloud",
        }],
      })),
      homeDecorationTypes: [{
        id: "decor_table",
        name: "Table",
        placementItemId: project.database.items[0]!.id,
        footprint: { width: 2, height: 1 },
        blocksMovement: true,
        allowedOrientations: ["left", "left", "diagonal"],
        graphicResourceId: "easyrpg-picture-cloud",
      }],
    } as never) as unknown as MutableRecord;

    expect(normalized.farmBuildingTypes).toHaveLength(256);
    expect(normalized.farmBuildingTypes.filter((row: MutableRecord) => row.id === "building_0")).toHaveLength(1);
    expect(normalized.farmBuildingTypes[0]).toMatchObject({
      levels: [{ footprint: { width: 1, height: 2 }, capacity: 1 }],
    });
    expect(normalized.homeDecorationTypes[0].allowedOrientations).toEqual(["left"]);

    const legacy = deserialize(serialize(createBlankProject())) as unknown as MutableRecord;
    expect(legacy.database.farmBuildingTypes).toBeUndefined();
    expect(legacy.database.homeDecorationTypes).toBeUndefined();
    expect(legacy.session.farmBuildingPlacements).toBeUndefined();
    expect(legacy.session.homeDecorationPlacements).toBeUndefined();
  });
});

function buildingTypeWire(wire: MutableRecord, id: string): MutableRecord {
  return {
    id,
    name: id,
    levels: [{
      level: 1,
      footprint: { width: 2, height: 2 },
      capacity: 4,
      cost: { items: [{ itemId: wire.database.items[0].id, count: 1 }] },
      graphicResourceId: "easyrpg-picture-cloud",
    }],
  };
}
