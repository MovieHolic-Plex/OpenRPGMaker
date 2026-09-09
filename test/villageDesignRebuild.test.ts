import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { asVillageDesign } from "@/project/villageDesign";
import { deserialize, serialize } from "@/project/io";
import { TILE } from "@/project/defaults/constants";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import { createAuthorVillageTool } from "@/editor/tools/authorVillageToolDef";
import { captureHouseProtection, type HouseSnapshot } from "@/editor/tools/houseProtection";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import { buildVillageDomain, inspectVillageBuild } from "@/editor/tools/village/builder";
import { auditVillage } from "@/editor/tools/village/audit";
import { ROAD_TILES } from "@/editor/tools/village/constants";
import * as roads from "@/editor/tools/village/roads";
import * as houseKit from "@/editor/houseKit";
import { buildHouses } from "@/editor/tools/village/houses";
import { mulberry32 } from "@/util/rng";

afterEach(() => vi.restoreAllMocks());

function fixture() {
  const project = createBlankProject();
  const preset = asVillageDesign({ id: "design-test", name: "계약 검증", houseCount: 4, kitMix: "amber-wood", edgeTrees: "none" });
  if (!preset.design) throw new Error("Missing design");
  preset.design.interior = false;
  preset.design.stories = [1];
  project.villagePresets = [preset];
  project.defaultVillagePresetId = preset.id;
  const first = buildVillageDomain(project, { width: 50, height: 50, seed: 7 });
  const mapId = inspectVillageBuild(project, first).exteriorMapId;
  const map = project.maps[mapId];
  const old = captureHouseProtection(project);
  expect(old).toHaveLength(4);
  const cell = old[0]?.cells[0];
  if (!cell) throw new Error("Missing completed house");
  // Accepted human edits may contain road values and layer stacks too.
  const index = cell.y * map.width + cell.x;
  map.lowerTiles[index] = SAND_TILE.BODY;
  map.lowerTileStacks = { [index]: [] };
  map.upperTileStacks = { [index]: [map.upperTiles[index]] };
  preset.design.revision = 2;
  return { ctx: { project: deserialize(serialize(project)) }, mapId,
    request: { target: { kind: "existing", mapId }, fullMap: true, countPolicy: "exact", seed: 7 } };
}

describe("existing-map village design rebuild", () => {
  it("leaves streets unchanged when real candidate stamping fails", () => {
    // Given: candidate bboxes fit, but their authored wings fail the real kit width check.
    const { ctx, mapId } = fixture();
    const map = ctx.project.maps[mapId];
    map.lowerTiles.fill(SAND_TILE.BODY);
    const before = structuredClone(map);
    const stamp = vi.spyOn(houseKit, "stampFootprintHouseKit");

    // When: every candidate is rejected by the real stamper, without runner rollback.
    const built = buildHouses(map, { x: 0, y: 0, w: 50, h: 50 }, {
      rect: { x: 21, y: 21, w: 8, h: 6 }, centerX: 25, centerRow: 24,
    }, 1, mulberry32(7), undefined, {
      theme: "", pathStyle: "sand", kitMix: "amber-wood", yardStyle: "minimal",
      plazaStyle: "well", plazaLayout: "center", edgeTrees: "none", roadWidth: 2,
      roadNaturalness: 0, settlementLayout: "plaza-ring", houseYards: [], houseKits: [],
      houseTemplates: [], houseOwners: [], housePrograms: [], templateCatalog: [{
        id: "invalid-wing", name: "Invalid wing", w: 5, h: 6,
        wingsAt: (x, y) => [{ x, y, w: 2, h: 6 }],
      }],
    }, []);

    // Then: failed candidates were actually attempted and neither layer was prepared or repaired.
    expect(stamp).toHaveBeenCalled();
    expect(stamp.mock.results.every(result => result.type === "return" && result.value.ok === false)).toBe(true);
    expect(built).toEqual([]);
    expect(map).toEqual(before);
  });

  it("accepts the revision through the public tool without reopening completed houses", () => {
    // Given: four completed houses, accepted edits, and a revised design.
    const { ctx, mapId, request } = fixture();
    const before = captureHouseProtection(ctx.project);
    const oldRegions = structuredClone(ctx.project.maps[mapId].layoutPlan?.regions);
    let sealed: HouseSnapshot[] = [];
    const paint = roads.paintVillageRoadsChecked;
    vi.spyOn(roads, "paintVillageRoadsChecked").mockImplementation(args => {
      sealed = captureHouseProtection(args.draft);
      return paint(args);
    });

    // When: the real facade, builder, inspector and runner all execute.
    const result = runTool(ctx, "author_village", request);

    // Then: revision work succeeds and both old and newly sealed values survive IO.
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ village: { actualHouseCount: 4, structuralQa: {
      ok: true, doorsConnected: 4, doorsIntact: 4, roadComponents: 1, ridgeInvaded: 0, critiqueOk: true,
    } } });
    expect(sealed).toHaveLength(8);
    expect(sealed.filter(h => before.some(old => old.id === h.id))).toEqual(before);
    const newHouses = sealed.filter(h => !before.some(old => old.id === h.id));
    expect(newHouses.flatMap(h => h.cells).filter(c => ROAD_TILES.has(c.lower))).toEqual([]);
    ctx.project = deserialize(serialize(ctx.project));
    expect(captureHouseProtection(ctx.project)).toEqual(sealed);
    expect(ctx.project.maps[mapId].layoutPlan?.regions).toEqual(expect.arrayContaining(oldRegions ?? []));
    expect(ctx.project.maps[mapId].villageDesignSource?.preset.design?.revision).toBe(2);
  });

  it("still rejects a genuinely disconnected external road after the rebuild", () => {
    // Given: the same revision, followed by a late external island and real audit.
    const { ctx, mapId, request } = fixture();
    const before = serialize(ctx.project);
    let components = 0;
    const tool = createAuthorVillageTool({ build(project, args) {
      const built = buildVillageDomain(project, args);
      if (typeof built.data !== "object" || built.data === null) throw new Error("Missing result");
      const map = project.maps[mapId];
      map.lowerTiles[0] = SAND_TILE.BODY;
      map.upperTiles[0] = TILE.EMPTY;
      components = auditVillage(map, [], [], { x: 0, y: 0, w: 50, h: 50 }).roadComponents;
      return { ...built, data: { ...built.data, roadComponents: components } };
    }, inspect: inspectVillageBuild });

    // When
    const result = runToolDefinition(ctx, tool, request);

    // Then: unchanged structural gate rejects atomically.
    expect(components).toBe(2);
    expect(result.ok).toBe(false);
    expect(result.issues?.map(issue => issue.code)).toContain("village-qa-failed");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("still rejects damage to an old house during real rebuild roads", () => {
    // Given: inject one bad write after the real road stage, not a fake builder.
    const { ctx, request } = fixture();
    const before = serialize(ctx.project);
    const house = captureHouseProtection(ctx.project)[0];
    const cell = house?.cells[0];
    if (!cell) throw new Error("Missing old house");
    const paint = roads.paintVillageRoadsChecked;
    vi.spyOn(roads, "paintVillageRoadsChecked").mockImplementation(args => {
      const result = paint(args);
      args.map.lowerTiles[cell.y * args.map.width + cell.x] = TILE.EMPTY;
      return result;
    });

    // When
    const result = runTool(ctx, "author_village", request);

    // Then: the house invariant rejects before any repair or commit.
    expect(result.ok).toBe(false);
    expect(result.issues?.map(issue => issue.code)).toContain("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });
});
