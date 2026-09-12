import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { villageObjectHouseCatalog } from "@/editor/tools/village/objectHouses";
import { chooseCompactHouses, compactHousePool, compactLandmark, LOG_WALL_TILES } from "@/editor/tools/village/compactComposition";
import { fillMissingVillageDimensions } from "@/editor/tools/authorVillageToolDef";
import { parseAuthorVillageRequest } from "@/editor/construction/parseVillageRequest";
import { buildHouse30BatchA } from "../scripts/lib/house30BatchA.mts";
import { buildHouse30BatchB } from "../scripts/lib/house30BatchB.mts";
import { buildHouse30BatchC } from "../scripts/lib/house30BatchC.mts";
import { emptySpatialDocument } from "./support/spatialSchemaFixture";
import { buildCompactVillageHouses } from "../scripts/lib/compactVillageHouses.mts";
import { runTool } from "@/editor/tools/toolRunner";
import { computeReachableCells } from "@/project/lint/reachability";
import { countTreeCells, countWaterCells } from "@/editor/tools/villageEvaluate";

function fixture() {
  const project = createBlankProject(), entries = [...buildHouse30BatchA(), ...buildHouse30BatchB(), ...buildHouse30BatchC()];
  project.tilesets[DEFAULT_TILESET_ID]!.structureKits = entries.map(e => e.kit);
  project.spatialAuthoring = emptySpatialDocument();
  project.spatialAuthoring.library.objects = Object.fromEntries(entries.map(e => [`house:${e.number}`, {
    id: `house:${e.number}`, name: e.name, revision: 1, tags: [], provenance: { origin: "user" },
    graphic: { tilesetId: DEFAULT_TILESET_ID, kitId: e.kit.id }, chips: [],
    anchors: e.doors.map((door, i) => ({ id: `door:${i}`, name: "현관 앞", x: door.x, y: door.y + 1 })),
  }]));
  return { project, ids: Object.keys(project.spatialAuthoring.library.objects) };
}

describe("compact village composition contract", () => {
  it.each(["80×80", "automatic"])("builds 24 small masonry homes and two landmarks with lake, groves and 243-family patches (%s)", size => {
    const project = createBlankProject(), entries = buildCompactVillageHouses();
    project.tilesets[DEFAULT_TILESET_ID]!.structureKits = entries.map(entry => entry.kit);
    project.spatialAuthoring = emptySpatialDocument();
    project.spatialAuthoring.library.objects = Object.fromEntries(entries.map(entry => [entry.id, {
      id: entry.id, name: entry.name, revision: 1, tags: [], provenance: { origin: "user" }, chips: [],
      graphic: { tilesetId: DEFAULT_TILESET_ID, kitId: entry.kit.id },
      anchors: entry.doors.map((door, i) => ({ id: `door:${i}`, name: "현관 앞", x: door.x, y: door.y + 1 })),
    }]));
    const ctx = { project };
    const built = runTool(ctx, "author_village", { target: { kind: "new", mapId: "compact", name: "Small town", ...(size === "80×80" ? { width: 80, height: 80 } : {}) },
      houseCount: 26, houseObjectIds: entries.map(entry => entry.id), composition: "compact", countPolicy: "exact", seed: 20260913,
      interior: false, npcCount: 0, settlementLayout: "clusters", theme: "작은 집과 숲, 호수, 장터 마을", forestDensity: "dense" });
    expect(built.ok, built.summary).toBe(true);
    const map = ctx.project.maps.compact!, houses = map.layoutPlan!.regions.filter(region => region.objectExterior);
    expect(houses).toHaveLength(26);
    expect(houses.filter(house => house.w > 10 || house.h > 10)).toHaveLength(2);
    expect(houses.every(house => house.w <= 15 && house.h <= 15)).toBe(true);
    const homes = houses.filter(house => house.w <= 10 && house.h <= 10);
    expect(homes.filter(house => house.h >= 9).length).toBeLessThanOrEqual(7);
    expect(new Set(houses.map(house => house.objectExterior!.objectId)).size).toBe(12);
    expect(Math.max(...homes.map(house => homes.filter(other => other.objectExterior!.objectId === house.objectExterior!.objectId).length))).toBeLessThanOrEqual(4);
    expect(countWaterCells(map)).toBeGreaterThan(map.width * map.height * 0.035);
    expect(map.layoutPlan!.regions.some(region => region.tags?.includes("lakeside"))).toBe(true);
    expect(countTreeCells(map)).toBeGreaterThan(map.width * map.height * 0.16);
    expect(map.lowerTiles.filter(tile => [243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335].includes(tile)).length).toBeGreaterThan(100);
    const reachable = computeReachableCells(ctx.project, map, ctx.project.startPos.x, ctx.project.startPos.y);
    expect(houses.flatMap(house => house.objectExterior!.doorApproaches).every(p => reachable.has(`${p.x},${p.y}`))).toBe(true);
    expect(built.issues?.filter(issue => issue.severity === "error" && issue.mapId === map.id) ?? []).toEqual([]);
  }, 90_000);

  it("filters actual log-wall cells and oversized exteriors without modifying the source library", () => {
    const { project, ids } = fixture(), before = structuredClone(project);
    const allowed = villageObjectHouseCatalog(project, { houseObjectIds: ids, composition: "compact" })!;
    expect(allowed.length).toBeGreaterThan(6);
    expect(allowed.every(h => h.raster.width <= 15 && h.raster.height <= 15)).toBe(true);
    expect(allowed.every(h => h.raster.cells.every(c => !LOG_WALL_TILES.has(c.tile)))).toBe(true);
    expect(allowed.some(h => h.design.id === "house:3")).toBe(false);
    expect(allowed.some(h => h.design.id === "house:26")).toBe(false);
    expect(project).toEqual(before);
  });

  it("uses only two landmarks in a 26-house village, even when many large candidates exist", () => {
    const { project, ids } = fixture();
    const pool = villageObjectHouseCatalog(project, { houseObjectIds: ids, composition: "compact" })!;
    const large = pool.find(compactLandmark)!;
    const manyLandmarks = [...pool, ...Array.from({ length: 5 }, (_, i) => ({ ...large, design: { ...large.design, id: `extra-large:${i}` } }))];
    const chosen = chooseCompactHouses(manyLandmarks, 26, []);
    expect(chosen).toHaveLength(26);
    expect(chosen.filter(compactLandmark)).toHaveLength(2);
    expect(chosen.filter(h => !compactLandmark(h))).toHaveLength(24);
    expect(new Set(chosen.map(h => h.design.id)).size).toBeGreaterThan(6);
  });

  it("rejects conflicting fixed log/oversize houses and a third large house", () => {
    const { project, ids } = fixture();
    const catalog = villageObjectHouseCatalog(project, { houseObjectIds: ids })!;
    expect(() => compactHousePool(catalog, ["house:3"])).toThrow(/통나무/);
    expect(() => compactHousePool(catalog, ["house:26"])).toThrow(/15×15/);
    const pool = compactHousePool(catalog, []), large = pool.find(compactLandmark)!;
    const small = pool.find(house => !compactLandmark(house))!;
    const upperLog = { ...small, raster: { ...small.raster, cells: [...small.raster.cells, { x: 1, y: 4, tile: 133, layer: "upper" as const }] } };
    expect(() => compactHousePool([upperLog], [])).toThrow(/회벽·석벽/);
    expect(() => chooseCompactHouses(pool, 26, Array.from({ length: 3 }, () => ({ objectId: large.design.id })))).toThrow(/최대 2채/);
    expect(() => villageObjectHouseCatalog(project, { composition: "compact" })).toThrow(/houseObjectIds/);
  });

  it("sizes from the selected small homes and carries the explicit composition through the facade parser", () => {
    const { project, ids } = fixture();
    const args = { target: { kind: "new", mapId: "compact", name: "Small town" }, houseCount: 26,
      houseObjectIds: ids, countPolicy: "exact", composition: "compact", interior: false };
    const compact = parseAuthorVillageRequest(fillMissingVillageDimensions(args, project));
    const spacious = parseAuthorVillageRequest(fillMissingVillageDimensions({ ...args, composition: undefined }, project));
    expect(compact.composition).toBe("compact");
    if (compact.target.kind !== "new" || spacious.target.kind !== "new") throw Error("new");
    expect(compact.target.width! * compact.target.height!).toBeLessThan(spacious.target.width! * spacious.target.height!);
    expect(() => parseAuthorVillageRequest({ ...args, composition: "unknown" })).toThrow(/composition/);
  });
});
