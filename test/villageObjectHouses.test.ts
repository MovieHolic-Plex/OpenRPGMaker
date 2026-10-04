import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { runTool } from "@/editor/tools/toolRunner";
import { parseAuthorVillageRequest } from "@/editor/construction/parseVillageRequest";
import { inspectObjectHouseAccess, villageObjectHouseCatalog } from "@/editor/tools/village/objectHouses";
import type { BuiltHouse } from "@/editor/tools/village/constants";
import { checkReachability } from "@/project/lint/reachability";
import { countWaterCells, countTreeCells } from "@/editor/tools/villageEvaluate";
import { buildHouse30BatchA } from "../scripts/lib/house30BatchA.mts";
import { buildHouse30BatchB } from "../scripts/lib/house30BatchB.mts";
import { buildHouse30BatchC } from "../scripts/lib/house30BatchC.mts";
import { emptySpatialDocument } from "./support/spatialSchemaFixture";

function fixture(numbers = [8, 14, 26]) {
  const project = createBlankProject();
  const entries = [...buildHouse30BatchA(), ...buildHouse30BatchB(), ...buildHouse30BatchC()].filter(e => numbers.includes(e.number));
  project.tilesets[COMBINED_TOWN_TILESET_ID]!.structureKits = entries.map(e => e.kit);
  const document = emptySpatialDocument();
  document.library.objects = Object.fromEntries(entries.map(e => [`house:${e.number}`, {
    id: `house:${e.number}`, name: e.name, revision: 1, tags: ["건물 외형", `${e.floors}층 외형`], provenance: { origin: "user" },
    graphic: { tilesetId: COMBINED_TOWN_TILESET_ID, kitId: e.kit.id }, chips: [],
    anchors: e.doors.map((door, i) => ({ id: `door-${i}`, name: "현관 앞", x: door.x, y: door.y + 1 })),
  }]));
  return deserialize(JSON.stringify({ ...project, spatialAuthoring: document }));
}
const request = { target: { kind: "new", mapId: "village", name: "Object village", width: 112, height: 112 },
  houseCount: 3, houseObjectIds: ["house:8", "house:14", "house:26"],
  housePlans: [8, 14, 26].map(n => ({ objectId: `house:${n}` })), countPolicy: "exact", seed: 71,
  theme: "호수와 장터가 있는 마을", forestDensity: "sparse", npcCount: 0 };

describe("village from saved exterior objects", () => {
  it("checks the restored real start on an existing map instead of the builder's temporary plaza spawn", () => {
    const project = fixture([1]), map = project.maps[project.startMapId]!;
    map.width = 120; map.height = 120;
    map.lowerTiles = Array(120 * 120).fill(TILE.GRASS); map.upperTiles = Array(120 * 120).fill(TILE.EMPTY);
    project.startPos = { x: 2, y: 2 };
    for (const [x, y] of [[1, 2], [3, 2], [2, 1], [2, 3]]) map.lowerTiles[y! * map.width + x!] = 45;
    const ctx = { project }, before = serialize(project);
    const result = runTool(ctx, "author_village", { target: { kind: "existing", mapId: map.id, bounds: { x: 8, y: 8, w: 88, h: 88 } },
      houseCount: 1, houseObjectIds: ["house:1"], countPolicy: "exact", interior: false, npcCount: 0, seed: 71, theme: "마을" });
    expect(result.ok).toBe(false);
    expect(result.issues?.some(issue => issue.code === "village-public-access"), result.summary).toBe(true);
    expect(serialize(ctx.project)).toBe(before);
  }, 60_000);

  it("honors best-effort's six-of-seven allowance while exact fails atomically", () => {
    const args = { target: { kind: "new", mapId: "small", name: "Small village", width: 41, height: 41 },
      houseCount: 7, houseObjectIds: ["house:1"], interior: false, npcCount: 0, seed: 71, theme: "마을" };
    const exact = { project: fixture([1]) }, before = serialize(exact.project);
    expect(runTool(exact, "author_village", { ...args, countPolicy: "exact" }).ok).toBe(false);
    expect(serialize(exact.project)).toBe(before);
    const ctx = { project: fixture([1]) };
    const partial = runTool(ctx, "author_village", { ...args, countPolicy: "best-effort" });
    expect(partial.ok, partial.summary).toBe(true);
    expect(partial.data).toMatchObject({ village: { actualHouseCount: 6 } });
  }, 60_000);

  it.each([1, 11, 26])("sizes an omitted target around the actual house %i and its central commons", number => {
    const ctx = { project: fixture([number]) };
    const result = runTool(ctx, "author_village", { target: { kind: "new", mapId: "auto", name: "Sized from objects" },
      houseCount: 1, houseObjectIds: [`house:${number}`], countPolicy: "exact", interior: false, npcCount: 0, seed: 71, theme: "마을" });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.auto!.layoutPlan!.regions.filter(r => r.role === "house")).toHaveLength(1);
  }, 60_000);

  it("resolves all 30 actual silhouettes and all their authored doorway approaches without recoloring", () => {
    const project = fixture(Array.from({ length: 30 }, (_, i) => i + 1));
    const catalog = villageObjectHouseCatalog(project, { houseObjectIds: Object.keys(project.spatialAuthoring!.library.objects) })!;
    expect(catalog).toHaveLength(30);
    expect(catalog.reduce((sum, house) => sum + house.approaches.length, 0)).toBe(37);
    expect(catalog.every(house => house.access.length >= house.approaches.length)).toBe(true);
  });

  it("builds actual courtyard/multiple-door/four-storey exteriors through the registered tool and survives IO", () => {
    const before = fixture(), ctx = { project: before };
    const canonical = serialize(before), oldMaps = structuredClone(before.maps);
    const result = runTool(ctx, "author_village", request);
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ village: { actualHouseCount: 3, interiorMapIds: [], structuralQa: { ok: true } } });
    const reloaded = deserialize(serialize(ctx.project));
    expect(reloaded.spatialAuthoring).toEqual(deserialize(canonical).spatialAuthoring);
    for (const [id, map] of Object.entries(oldMaps)) expect(reloaded.maps[id]).toEqual(map);
    const map = reloaded.maps.village!;
    const houses = map.layoutPlan!.regions.filter(r => r.role === "house");
    expect(houses).toHaveLength(3);
    expect(houses.map(house => house.objectExterior?.objectId)).toEqual(request.houseObjectIds);
    const approaches = houses.flatMap(h => h.objectExterior!.doorApproaches);
    expect(approaches).toHaveLength(4);
    expect(checkReachability(reloaded, map.id, reloaded.startPos, approaches).reachable).toBe(true);
    const catalog = villageObjectHouseCatalog(reloaded, request)!;
    const built: BuiltHouse[] = houses.map(region => {
      const source = catalog.find(h => h.design.id === region.objectExterior!.objectId)!;
      return { bbox: { x: region.x, y: region.y, w: region.w, h: region.h }, doorAt: region.doorAt!, front: region.front!,
        kitId: "bright-plaster", stories: 1, templateId: region.shape!,
        objectExterior: { objectId: source.design.id, revision: 1, name: source.design.name, raster: source.raster,
          approaches: region.objectExterior!.doorApproaches, access: region.objectExterior!.privateAccess } };
    });
    expect(inspectObjectHouseAccess(reloaded, map, built)).toEqual({ doors: 4, reachable: 4, intact: 4 });
    expect(countWaterCells(map)).toBeGreaterThan(25);
    expect(countTreeCells(map)).toBeGreaterThan(0);
    // A public gate remaining reachable must not hide a cut inside the private courtyard.
    const courtyard = built[0]!, first = courtyard.objectExterior!.approaches[0]!;
    const at = first.y * map.width + first.x, prior = map.lowerTiles[at]!;
    map.lowerTiles[at] = TILE.GRASS;
    expect(inspectObjectHouseAccess(reloaded, map, built).reachable).toBeLessThan(4);
    map.lowerTiles[at] = prior;
    const cell = courtyard.objectExterior!.raster.cells[0]!;
    (cell.layer === "lower" ? map.lowerTiles : map.upperTiles)[(courtyard.bbox.y + cell.y) * map.width + courtyard.bbox.x + cell.x] = -1;
    expect(() => inspectObjectHouseAccess(reloaded, map, built)).toThrow(/외형이 바뀌었습니다/);
  }, 90_000);

  it.each([
    { patch: { houseObjectIds: ["missing"] }, code: "village-object-missing" },
    { patch: { interior: true }, code: "village-object-interior" },
    { patch: { housePlans: [{ templateId: "rect" }, {}, {}] }, code: "village-object-conflict" },
    { patch: { target: { ...request.target, width: 32, height: 32 } }, code: "village-object-capacity" },
  ])("rejects $code atomically instead of replacing the requested objects", ({ patch, code }) => {
    const ctx = { project: fixture() }, before = serialize(ctx.project);
    const result = runTool(ctx, "author_village", { ...request, ...patch });
    expect(result.ok).toBe(false);
    expect(result.issues?.some(issue => issue.code === code), result.summary).toBe(true);
    expect(serialize(ctx.project)).toBe(before);
  });

  it("rejects missing doorway anchors, blocked courtyards and mixed per-house identities", () => {
    const project = fixture([8]);
    const object = project.spatialAuthoring!.library.objects["house:8"]!;
    const kit = project.tilesets[COMBINED_TOWN_TILESET_ID]!.structureKits![0]!;
    if (kit.kind !== "section") throw new Error("section");
    const port = object.anchors[0]!;
    kit.rows[port.y]!.tiles[port.x] = 45;
    expect(() => villageObjectHouseCatalog(project, { houseObjectIds: [object.id] })).toThrow(/대문으로 나갈 수 없습니다/);
    expect(() => parseAuthorVillageRequest({ ...request, houseCount: 1, housePlans: [{ objectId: object.id, templateId: "rect" }] })).toThrow(/cannot be combined/);
  });

  it("preserves raster outside explicit bounds and rejects overlap with a canonical owned building", () => {
    const ctx = { project: fixture([8]) };
    expect(runTool(ctx, "create_map", { id: "existing", name: "Existing", width: 120, height: 120 }).ok).toBe(true);
    const before = structuredClone(ctx.project.maps.existing!);
    const built = runTool(ctx, "author_village", { target: { kind: "existing", mapId: "existing", bounds: { x: 8, y: 8, w: 88, h: 88 } },
      houseCount: 1, houseObjectIds: ["house:8"], countPolicy: "exact", interior: false, npcCount: 0, seed: 71, theme: "호수 마을" });
    expect(built.ok, built.summary).toBe(true);
    const after = ctx.project.maps.existing!;
    for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) {
      if (x >= 8 && x < 96 && y >= 8 && y < 96) continue;
      const i = y * 120 + x;
      expect([after.lowerTiles[i], after.upperTiles[i]]).toEqual([before.lowerTiles[i], before.upperTiles[i]]);
    }
    expect(runTool(ctx, "create_map", { id: "owned", name: "Spatial ownership", width: 120, height: 120 }).ok).toBe(true);
    const object = ctx.project.spatialAuthoring!.library.objects["house:8"]!;
    const raster = villageObjectHouseCatalog(ctx.project, { houseObjectIds: [object.id] })![0]!.raster;
    const preview = runTool(ctx, "preview_spatial_build", { kind: "object", id: object.id, occurrenceId: "owned-house", seed: 1,
      target: { mapId: "owned", rect: { x: 12, y: 12, width: raster.width, height: raster.height + 1 },
        entry: { x: 12 + object.anchors[0]!.x, y: 12 + object.anchors[0]!.y } } });
    expect(preview.ok, preview.summary).toBe(true);
    expect(runTool(ctx, "apply_spatial_build", { previewId: (preview.data as { previewId: string }).previewId }).ok).toBe(true);
    const sealed = serialize(ctx.project);
    const rejected = runTool(ctx, "author_village", { ...request,
      target: { kind: "existing", mapId: "owned", bounds: { x: 8, y: 8, w: 88, h: 88 } },
      houseCount: 1, houseObjectIds: [object.id], housePlans: [{ objectId: object.id }] });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.some(issue => issue.code === "village-spatial-owned")).toBe(true);
    expect(serialize(ctx.project)).toBe(sealed);
  }, 90_000);
});
