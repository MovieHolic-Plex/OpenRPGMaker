import { afterEach, describe, expect, it, vi } from "vitest";
import { plantForestComposition } from "@/editor/tools/forestComposition";
import { assertHouseProtection, captureHouseProtection, protectedHouseCells } from "@/editor/tools/houseProtection";
import * as props from "@/editor/tools/placePropsDomain";
import { runScatterObject } from "@/editor/tools/placementTools";
import { runTool } from "@/editor/tools/toolRunner";
import { DEFAULT_UNDERGROWTH_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { TILE } from "@/project/defaults/constants";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { deserialize, serialize } from "@/project/io";
import * as vocabulary from "@/project/tileVocabulary";
import type { GameMap, Project, Rect } from "@/project/types";
import { completedHouseProject, houseMap, mutateProject } from "./fixtures/completedHouse";

const UNDERGROWTH = new Set(DEFAULT_UNDERGROWTH_AUTOTILE_GROUP.memberTileIds);
const BODY = DEFAULT_UNDERGROWTH_AUTOTILE_GROUP.variantMap["255"]!;
const LITTER = new Set([259, 440, 319, 348]);
const AREA = { x: 2, y: 2, w: 20, h: 20 };

afterEach(() => vi.restoreAllMocks());

function setup(size = 30): Project {
  const project = completedHouseProject();
  const map = houseMap(project);
  map.width = size;
  map.height = size;
  map.lowerTiles = Array(size * size).fill(TILE.GRASS);
  map.upperTiles = Array(size * size).fill(TILE.EMPTY);
  delete map.layoutPlan;
  return project;
}

function own(map: GameMap, rect: Rect): void {
  map.layoutPlan = { version: 1, kind: "fixture", regions: [
    { id: "house", role: "house", label: "Accepted house", ...rect },
  ] };
}

function stackSentinels(map: GameMap): void {
  map.lowerTileStacks = {};
  map.upperTileStacks = {};
  for (const [n, cell] of protectedHouseCells(map).entries()) {
    const index = cell.y * map.width + cell.x;
    if (n % 3 === 0) continue; // Absence, empty stacks and ordered values all matter.
    map.lowerTileStacks[index] = n % 3 === 1 ? [] : [240, 72];
    map.upperTileStacks[index] = n % 3 === 1 ? [] : [199, 200];
  }
}

/** Observe writes, not merely final values: restore-after-mutation must fail too. */
function watchProtectedWrites(map: GameMap): string[] {
  const owned = new Set(protectedHouseCells(map).map(({ x, y }) => y * map.width + x));
  const writes: string[] = [];
  for (const layer of ["lowerTiles", "upperTiles"] as const) {
    map[layer] = new Proxy(map[layer], {
      set(target, property, value) {
        if (owned.has(Number(property))) writes.push(`${layer}[${String(property)}]`);
        return Reflect.set(target, property, value);
      },
    });
  }
  return writes;
}

function compose(project: Project, area = AREA, density: "dense" | "impassable" = "dense") {
  return plantForestComposition(project, { mapId: project.startMapId, area, density, seed: 7 });
}

function expectPreserved(project: Project, before: ReturnType<typeof captureHouseProtection>, writes: string[]): void {
  expect(writes).toEqual([]);
  expect(captureHouseProtection(project)).toEqual(before);
  expect(() => assertHouseProtection(before, project, [])).not.toThrow();
}

describe("direct forest composition writers", () => {
  // Isolate only the earlier object-placement stage. Floor, reachability, RNG,
  // material/passability lookup and neighbor autotiling still execute real code.
  function isolateDirectWriters(): void {
    vi.spyOn(props, "placePropsOnDraft").mockReturnValue({ summary: "No object stage", data: { placed: 0 } });
  }

  it.each(["litter", "tone", "closure", "feather", "undergrowth"] as const)(
    "preflights %s writes and still changes unowned cells", (stage) => {
      isolateDirectWriters();
      const project = setup();
      const map = houseMap(project);
      const area = stage === "undergrowth" ? { x: 2, y: 2, w: 8, h: 8 } : { x: 2, y: 2, w: 5, h: 5 };
      if (stage === "tone") {
        const resolve = vocabulary.resolveMaterialByLabel;
        vi.spyOn(vocabulary, "resolveMaterialByLabel").mockImplementation((tileset, label, options) =>
          label === "키큰 풀"
            ? { status: "approved", kind: "tile", tileId: 241, matchedLabel: label, matchedDescription: "Custom floor tone" }
            : resolve(tileset, label, options));
      }
      if (stage === "feather") map.upperTiles.fill(289);
      if (stage === "closure" || stage === "undergrowth" || stage === "tone") map.upperTiles.fill(260);
      own(map, { x: 2, y: 2, w: 3, h: area.h });
      stackSentinels(map);
      const before = captureHouseProtection(project);
      const control = structuredClone(project);
      delete houseMap(control).layoutPlan;
      const density = stage === "closure" ? "impassable" : "dense";
      const active = (target: GameMap, index: number): boolean => {
        if (stage === "litter") return LITTER.has(target.upperTiles[index]!);
        if (stage === "tone") return target.lowerTiles[index] === 241;
        if (stage === "closure") return target.upperTiles[index] === 289;
        if (stage === "feather") return target.upperTiles[index] === TILE.EMPTY;
        return UNDERGROWTH.has(target.lowerTiles[index]!);
      };
      compose(control, area, density);
      expect(before[0]!.cells.some(({ x, y }) => active(houseMap(control), y * map.width + x))).toBe(true);
      const writes = watchProtectedWrites(map);
      const result = compose(project, area, density);
      expectPreserved(project, before, writes);
      const owned = new Set(protectedHouseCells(map).map(({ x, y }) => y * map.width + x));
      expect(map.lowerTiles.some((_, index) => !owned.has(index) && active(map, index))).toBe(true);
      if (stage === "closure") expect(result.closedGaps).toBeGreaterThan(0);
      if (stage === "feather") expect(result.feathered).toBeGreaterThan(0);
      if (stage === "undergrowth") expect(result.undergrowthCells).toBeGreaterThan(0);
    },
  );

  it("rejects an entire puddle footprint touching a house and uses the other clearing", () => {
    isolateDirectWriters();
    const project = setup();
    const map = houseMap(project);
    map.lowerTiles.fill(TILE.WALL);
    const clearings = [{ x: 4, y: 4, w: 2, h: 2 }, { x: 16, y: 16, w: 2, h: 2 }];
    for (const rect of clearings) {
      for (let y = rect.y; y < rect.y + 2; y += 1) {
        for (let x = rect.x; x < rect.x + 2; x += 1) map.lowerTiles[y * map.width + x] = BODY;
      }
    }
    // Four thicket cells cannot form an undergrowth patch (minimum six), and
    // are not eligible for litter/tone. Only the real 2x2 puddle writer can act.
    const control = structuredClone(project);
    compose(control);
    const selected = clearings.find(({ x, y }) => isLakeAutotileTile(houseMap(control).lowerTiles[y * map.width + x]!));
    expect(selected).toBeDefined();
    own(map, { ...selected!, w: 1, h: 1 }); // Protect one corner, not the whole 2x2 candidate.
    stackSentinels(map);
    const before = captureHouseProtection(project);
    const writes = watchProtectedWrites(map);
    compose(project);
    expectPreserved(project, before, writes);
    for (let y = selected!.y; y < selected!.y + 2; y += 1) {
      for (let x = selected!.x; x < selected!.x + 2; x += 1) expect(map.lowerTiles[y * map.width + x]).toBe(BODY);
    }
    expect(map.lowerTiles.filter((tile) => isLakeAutotileTile(tile))).toHaveLength(4);
  });

  it.each([4, 8] as const)("protects %i-neighbor autotile writes outside the requested area", (neighborhood) => {
    isolateDirectWriters();
    const project = setup();
    const map = houseMap(project);
    const tileset = project.tilesets[map.tilesetId]!;
    const group = { ...structuredClone(DEFAULT_UNDERGROWTH_AUTOTILE_GROUP), neighborhood };
    tileset.autotileGroups = [group];
    map.lowerTiles.fill(BODY);
    map.upperTiles.fill(260);
    const area = { x: 5, y: 5, w: 5, h: 8 };
    own(map, { x: 4, y: 4, w: 1, h: 10 });
    // Deliberately retain a human-selected edge variant, not an auto-shaped body.
    for (const { x, y } of protectedHouseCells(map)) map.lowerTiles[y * map.width + x] = group.memberTileIds.find((tile) => tile !== BODY)!;
    stackSentinels(map);
    const before = captureHouseProtection(project);
    const control = structuredClone(project);
    delete houseMap(control).layoutPlan;
    compose(control, area);
    expect(before[0]!.cells.some(({ x, y, lower }) => houseMap(control).lowerTiles[y * map.width + x] !== lower)).toBe(true);
    const writes = watchProtectedWrites(map);
    expect(compose(project, area).undergrowthCells).toBeGreaterThan(0);
    expectPreserved(project, before, writes);
  });
});

describe("forest placement and final transaction guard", () => {
  it("protects single-tile bush placement before writing, while placing bushes outside", () => {
    const project = setup();
    const map = houseMap(project);
    own(map, { x: 2, y: 2, w: 4, h: 4 });
    stackSentinels(map);
    const before = captureHouseProtection(project);
    const writes = watchProtectedWrites(map);
    const result = props.placePropsOnDraft(project, { mapId: map.id, area: AREA, material: "덤불", count: 30, packing: "dense", seed: 7 });
    expectPreserved(project, before, writes);
    expect(Number((result.data as { placed: number }).placed)).toBeGreaterThan(0);
    expect(map.upperTiles.filter((tile) => tile === 289).length).toBeGreaterThan(0);
  });

  it("skips an ungrouped tree-base candidate whose repair canopy would enter a house", () => {
    const project = setup();
    const map = houseMap(project);
    const tileset = project.tilesets[map.tilesetId]!;
    // Ungrouped tile metadata is a supported resolver fallback, including soft
    // materials. Keep the real label/role; do not mock resolution or accept IDs.
    tileset.tileGroups = tileset.tileGroups!.filter((group) => !group.tileIds.includes(290));
    const material = tileset.tileMeta![290]!.label;
    expect(vocabulary.resolveMaterialByLabel(tileset, material, {
      preferGroup: true, preferRoles: ["prop", "terrain"],
    })).toMatchObject({ status: "soft", kind: "tile", tileId: 290 });
    own(map, { x: 3, y: 3, w: 4, h: 3 });
    stackSentinels(map);
    const before = captureHouseProtection(project);
    const ctx = { project: structuredClone(project) };
    const input = { mapId: map.id, material, area: { x: 3, y: 6, w: 8, h: 1 }, count: 2, packing: "dense" as const, seed: 7 };
    props.placePropsOnDraft(project, input);
    // The trunk row is entirely outside ownership. Reject its first four
    // candidates before writing, not just when the final invariant sees repair.
    for (let x = 3; x < 7; x += 1) expect(map.lowerTiles[6 * map.width + x]).toBe(TILE.GRASS);
    for (const x of [7, 8]) expect(map.lowerTiles[6 * map.width + x]).toBe(290);
    expect(captureHouseProtection(project)).toEqual(before);
    const result = runTool(ctx, "place_props", input);
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(result.data).toMatchObject({ placed: 2, tileId: 290 });
    expect(captureHouseProtection(ctx.project)).toEqual(before);
    for (const x of [7, 8]) {
      expect(houseMap(ctx.project).lowerTiles[6 * map.width + x]).toBe(290);
      expect(houseMap(ctx.project).upperTiles[5 * map.width + x]).toBe(260);
    }
  });

  it.each(["conifer-tree", "broadleaf-tree"])("keeps whole %s candidates away from protected canopy cells even with avoidProtected=false", (kind) => {
    const project = setup();
    const map = houseMap(project);
    own(map, { x: 2, y: 3, w: 5, h: 3 });
    const group = project.tilesets[map.tilesetId]!.tileGroups!.find((entry) => entry.id.includes(kind))!;
    const before = captureHouseProtection(project);
    const writes = watchProtectedWrites(map);
    const result = runScatterObject(project, {
      mapId: map.id, groupId: group.id, area: { x: 2, y: 5, w: 12, h: 2 }, count: 20,
      packing: "dense", trunkVisible: true, avoidProtected: false, seed: 7,
    });
    expectPreserved(project, before, writes);
    expect((result.data as { placed: number }).placed).toBeGreaterThan(0);
    // The unowned trunk row must also be skipped when its canopy hits the house.
    for (let x = 2; x < 7; x += 1) expect(map.lowerTiles[6 * map.width + x]).toBe(TILE.GRASS);
  });

  it.each(["dense", "impassable"] as const)("preserves ridge, empty/passable cells, deck attachment, human stamps and stacks in real %s composition", (density) => {
    const project = setup();
    const map = houseMap(project);
    own(map, { x: 3, y: 3, w: 7, h: 7 });
    Object.assign(map.layoutPlan!.regions[0]!, { shape: "rooftop-deck", doorAt: { x: 5, y: 9 } });
    map.upperTiles[10 * map.width + 7] = 322;
    map.lowerTiles[4 * map.width + 4] = TILE.EMPTY;
    map.lowerTiles[5 * map.width + 4] = 96;
    map.upperTiles[5 * map.width + 4] = 199;
    map.upperTiles[2 * map.width + 3] = 289; // Ridge vegetation is still house-owned.
    map.structurePlacements = [{
      id: "human", kitId: "deleted-kit", x: 15, y: 15, w: 3, h: 3,
      before: { lower: Array(9).fill(TILE.GRASS), upper: Array(9).fill(TILE.EMPTY) }, afterHash: "accepted",
    }];
    stackSentinels(map);
    const before = captureHouseProtection(project);
    const repeat = structuredClone(project);
    const writes = watchProtectedWrites(map);
    const result = compose(project, AREA, density);
    expectPreserved(project, before, writes);
    expect(result.placed).toBeGreaterThan(0);
    expect(result.materials).toEqual(expect.arrayContaining(["활엽수", "침엽수", "덤불"]));
    expect(compose(repeat, AREA, density)).toEqual(result);
    expect(houseMap(repeat).lowerTiles).toEqual(map.lowerTiles);
    expect(houseMap(repeat).upperTiles).toEqual(map.upperTiles);
  });

  it.each(["dense", "impassable"] as const)("commits %s forest through place_props after save/load, keeping the unchanged final guard", (density) => {
    const ctx = { project: setup() };
    own(houseMap(ctx.project), { x: 3, y: 3, w: 7, h: 7 });
    ctx.project = deserialize(serialize(ctx.project));
    const before = captureHouseProtection(ctx.project);
    const result = runTool(ctx, "place_props", { mapId: ctx.project.startMapId, area: AREA, material: "침엽수", density, seed: 7 });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(captureHouseProtection(ctx.project)).toEqual(before);
    expect((result.data as { placed: number }).placed).toBeGreaterThan(0);
    ctx.project = deserialize(serialize(ctx.project));
    const accepted = serialize(ctx.project);
    const rejected = mutateProject(ctx, (draft) => {
      compose(draft, { x: 22, y: 2, w: 6, h: 20 }, density);
      houseMap(draft).upperTiles[3 * houseMap(draft).width + 3] = 200;
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(accepted);
  });
});
