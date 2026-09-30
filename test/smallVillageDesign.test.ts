import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import { villageDesignIssue } from "@/project/villageDesign";
import { runTool } from "@/editor/tools/toolRunner";
import { buildPresetPreview } from "@/editor/panels/villagePresetPreview";
import { villageObjectHouseCatalog } from "@/editor/tools/village/objectHouses";
import { chooseCompactHouses, compactLandmark } from "@/editor/tools/village/compactComposition";
import { computeReachableCells } from "@/project/lint/reachability";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { blankSettlementRegionDesign } from "@/editor/panels/spatialGeographyDraft";
import { spatialId } from "@/project/spatial/domain";
import { villageDesignContext } from "@/ai/villageDesignContext";
import { emptySpatialDocument } from "./support/spatialSchemaFixture";
import { buildCompactVillageHouses } from "../scripts/lib/compactVillageHouses.mts";
import { smallVillageDefinition } from "../scripts/lib/smallVillageDefinition.mts";

function fixture() {
  const project = createBlankProject(), entries = buildCompactVillageHouses();
  project.tilesets[COMBINED_TOWN_TILESET_ID]!.structureKits = entries.map(e => e.kit);
  project.spatialAuthoring = emptySpatialDocument();
  project.spatialAuthoring.library.objects = Object.fromEntries(entries.map(e => [e.id, {
    id: e.id, name: e.name, revision: 1, exteriorStories: e.exteriorStories, tags: [], provenance: { origin: "user" }, chips: [],
    graphic: { tilesetId: COMBINED_TOWN_TILESET_ID, kitId: e.kit.id },
    anchors: e.doors.map((door, i) => ({ id: `door:${i}`, name: "현관 앞", x: door.x, y: door.y + 1 })),
  }]));
  const preset = smallVillageDefinition(entries.map(e => e.id));
  project.villagePresets = [preset];
  return { project, preset };
}

const request = (presetId: string, seed = 20260913) => ({ target: { kind: "new", mapId: "small-village", name: "Small village" }, presetId, seed, countPolicy: "exact" });
function inspect(project: ReturnType<typeof createBlankProject>, map = project.maps["small-village"]!) {
  const houses = map.layoutPlan!.regions.filter(r => r.objectExterior);
  expect(houses).toHaveLength(26);
  expect(houses.filter(r => r.tags?.includes("exterior-stories:1"))).toHaveLength(23);
  expect(houses.filter(r => r.tags?.includes("exterior-stories:2"))).toHaveLength(3);
  expect(houses.filter(r => r.w > 10 || r.h > 10)).toHaveLength(2);
  expect(map.width).toBe(76); expect(map.height).toBe(76);
  const start = map.layoutPlan!.regions.find(r => r.role === "plaza")!;
  const reachable = computeReachableCells(project, map, start.x + 8, start.y + 5);
  expect(houses.flatMap(r => r.objectExterior!.doorApproaches).every(p => reachable.has(`${p.x},${p.y}`))).toBe(true);
  expect(map.villageDesignSource!.preset.design!.objectVillage!.multiStoreyCount).toBe(3);
  expect(map.villageDesignSource!.resolvedSettings.exteriors).toHaveLength(26);
}

describe("small-village saved canonical contract", () => {
  it.each([20260913, 7])("builds from presetId alone with exactly three upstairs exteriors, seed %s", seed => {
    const { project, preset } = fixture(), context = { project };
    const result = runTool(context, "author_village", request(preset.id, seed));
    expect(result.ok, result.summary).toBe(true);
    inspect(context.project);
    expect(context.project.defaultVillagePresetId).toBeUndefined();
    const loaded = deserialize(serialize(context.project)); inspect(loaded);
    expect(villageDesignContext(loaded)).toContain("2층 이상 총 3채(큰집 포함)");
  }, 90_000);

  it("shows the actual saved composition in the editor preset preview", () => {
    const { project, preset } = fixture();
    const preview = buildPresetPreview(project, preset.id, 20260913);
    expect(preview.ok, !preview.ok ? preview.reason : "").toBe(true);
    if (!preview.ok) throw Error(preview.reason);
    inspect({ ...project, maps: { ...project.maps, [preview.map.id]: preview.map } }, preview.map);
    expect(project.maps[preview.map.id]).toBeUndefined();
  }, 90_000);

  it("rejects fixed overrides atomically and preserves optional legacy floor semantics", () => {
    const { project, preset } = fixture(), context = { project }, before = serialize(project);
    for (const patch of [{ presetId: "missing-canonical-preset" }, { multiStoreyCount: 4 }, { houseClustering: "balanced" }, { houseCount: 25 }, { houseObjectIds: [preset.design!.objectVillage!.objectIds[0]] }]) {
      const result = runTool(context, "author_village", { ...request(preset.id), ...patch });
      expect(result.ok).toBe(false); expect(result.summary).toContain("설계서");
      expect(serialize(context.project)).toBe(before);
    }
    const object = Object.values(project.spatialAuthoring!.library.objects)[0]!;
    delete (object as { exteriorStories?: number }).exteriorStories;
    const legacy = deserialize(serialize(project));
    expect(legacy.spatialAuthoring!.library.objects[object.id]!.exteriorStories).toBeUndefined();
    const bad = runTool({ project: legacy }, "author_village", request(preset.id));
    expect(bad.ok).toBe(false); expect(bad.summary).toContain("층수");
    expect(villageDesignIssue({ ...preset.design, objectVillage: { ...preset.design!.objectVillage, multiStoreyCount: 27 } })).toContain("집 수");
  });

  it("counts fixed landmarks in the same quota and rejects four fixed upstairs houses", () => {
    const { project, preset } = fixture();
    const pool = villageObjectHouseCatalog(project, { houseObjectIds: preset.design!.objectVillage!.objectIds, composition: "compact", presetId: preset.id })!;
    const upper = pool.find(h => h.design.exteriorStories === 2 && !compactLandmark(h))!;
    const landmark = pool.find(compactLandmark)!;
    const chosen = chooseCompactHouses(pool, 26, [{ objectId: landmark.design.id }, { objectId: upper.design.id }], 3);
    expect(chosen.filter(h => h.design.exteriorStories! >= 2)).toHaveLength(3);
    expect(() => chooseCompactHouses(pool, 26, Array.from({ length: 4 }, () => ({ objectId: upper.design.id })), 3)).toThrow(/충돌/);
    expect(chooseCompactHouses(pool, 26, [], 0).every(h => h.design.exteriorStories === 1)).toBe(true);
  });

  it("compiles a real settlement region and rebuilds only after ownership verification", () => {
    const { project, preset } = fixture();
    const id = spatialId("small-region"), root = spatialId("small-region-example");
    const created = blankSettlementRegionDesign(project, preset.id, "Small village region");
    expect(created.terrain.width).toBe(76); expect(created.terrain.height).toBe(76);
    project.spatialAuthoring!.library.regions[id] = { ...created, id };
    project.spatialAuthoring = instantiateSpatialDesign(project.spatialAuthoring!, project, {
      source: { kind: "region", id }, rootId: root, x: 0, y: 0, level: 0, seed: 20260913, generatorVersion: "small-village-test",
    });
    const first = compileSpatialOccurrence(project, { occurrenceId: root });
    const mapId = `spatial-geography:${root.length}:${root}`;
    inspect(first, first.maps[mapId]);
    const second = compileSpatialOccurrence(deserialize(serialize(first)), { occurrenceId: root });
    const delta = second.maps[mapId]!.lowerTiles.flatMap((tile, i) => tile === first.maps[mapId]!.lowerTiles[i] ? [] : [{ x: i % 76, y: Math.floor(i / 76), a: first.maps[mapId]!.lowerTiles[i], b: tile }]);
    expect(delta, JSON.stringify({ first: [first.startMapId, first.startPos], second: [second.startMapId, second.startPos] })).toEqual([]);
    expect(second.maps[mapId]!.upperTiles).toEqual(first.maps[mapId]!.upperTiles);
    const changed = structuredClone(first); changed.maps[mapId]!.lowerTiles[0] = 20;
    expect(() => compileSpatialOccurrence(changed, { occurrenceId: root })).toThrow(/ownership/);
  }, 120_000);
});
