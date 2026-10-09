import { beforeEach, describe, expect, it } from "vitest";
import { databaseReferenceMessage } from "@/editor/databaseReferences";
import { applyMapDeletion, collectMapDeletionImpact } from "@/project/mapDeletion";
import { repairProjectReferences } from "@/project/io/references";
import { store } from "@/project/store";
import { p2LifeProject } from "./fixtures/p2LifeSystems";

describe("P2 reference repair and map deletion", () => {
  beforeEach(() => store.replace(p2LifeProject()));

  it("reports exact fishing/forage map impact and cascades only matching definitions", () => {
    // Break caught: deleting a map leaves invisible P2 definitions or removes unrelated areas.
    const project = p2LifeProject();
    const source = project.maps[project.startMapId]!;
    project.maps.map_delete = { ...structuredClone(source), id: "map_delete", name: "Delete me", events: [] };
    project.mapTree.children.push({ mapId: "map_delete", children: [] });
    project.system.fishing!.spots.push({
      id: "spot_delete", mapId: "map_delete", area: { x: 0, y: 0, w: 2, h: 2 }, catches: [{ fishId: "fish_trout", weight: 1 }],
    });
    project.system.seasonalForage!.areas.push({
      id: "area_delete", mapId: "map_delete", area: { x: 0, y: 0, w: 2, h: 2 }, dailySpawnCount: 1, maxActive: 1,
      despawnAfterDays: 1, entries: [{ id: "berry_delete", itemId: "item_berry", weight: 1 }],
    });

    expect(collectMapDeletionImpact(project, "map_delete")).toMatchObject({
      fishingSpotCount: 1,
      fishingSpotIds: ["spot_delete"],
      forageAreaCount: 1,
      forageAreaIds: ["area_delete"],
    });
    applyMapDeletion(project, "map_delete");
    expect(project.system.fishing?.spots.map((row) => row.id)).toEqual(["spot_pond"]);
    expect(project.system.seasonalForage?.areas.map((row) => row.id)).toEqual(["area_farm"]);
  });

  it("repairs dangling child references without weakening museum reward conditions", () => {
    // Break caught: load repair leaves dead catch/forage rows or changes an AND reward condition into an easier one.
    const project = p2LifeProject();
    project.database.fishSpecies![0]!.itemId = "missing_item";
    project.system.seasonalForage!.areas[0]!.entries.push({ id: "stale", itemId: "missing_item", weight: 1 });
    project.system.museum!.rewards.push({ id: "stale_reward", requiredItemIds: ["missing_item"], reward: { gold: 1 } });

    repairProjectReferences(project);
    expect(project.database.fishSpecies).toEqual([]);
    expect(project.system.fishing?.spots).toEqual([]);
    expect(project.system.seasonalForage?.areas[0]?.entries.map((row) => row.id)).toEqual(["berry"]);
    expect(project.system.museum?.rewards.map((row) => row.id)).toEqual(["museum_first"]);
  });

  it("blocks editor item deletion for every P2 authoring owner", () => {
    const project = store.getCurrent();
    project.system.sellPrices = [];
    project.system.shipping = { enabled: false, allowedItemIds: [] };
    store.replace(project);
    expect(databaseReferenceMessage("items", "item_trout")).toMatch(/물감|물고기|박물관/);

    project.database.fishSpecies = [];
    project.system.fishing = { enabled: false, spots: [] };
    project.system.museum = { enabled: false, eligibleItemIds: [], rewards: [] };
    store.replace(project);
    expect(databaseReferenceMessage("items", "item_berry")).toMatch(/채집|도감/);

    project.system.seasonalForage = { enabled: false, areas: [] };
    project.system.collections = { enabled: true, trackedItemIds: ["item_reward"] };
    store.replace(project);
    expect(databaseReferenceMessage("items", "item_reward")).toContain("수집 도감");
  });
});
