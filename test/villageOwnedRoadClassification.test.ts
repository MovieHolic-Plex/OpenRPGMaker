import { describe, expect, it } from "vitest";
import { createAuthorVillageTool } from "@/editor/tools/authorVillageTool";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import { auditVillage, roadComponentNotes } from "@/editor/tools/village/audit";
import { buildVillageDomain, inspectVillageBuild } from "@/editor/tools/village/builder";
import { ensureSingleRoadComponent } from "@/editor/tools/village/roads";
import { environmentalRoadAt, type BuiltHouse } from "@/editor/tools/village/constants";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";

const area = { x: 0, y: 0, w: 50, h: 50 };
const request = { target: { kind: "existing", mapId: "town" }, fullMap: true,
  houseCount: 4, countPolicy: "exact", seed: 7, interior: false };

function blank() {
  const ctx = { project: createEmptyToolProject("Owned road regression") };
  const created = runTool(ctx, "create_map", { id: "town", name: "Town", width: 50, height: 50 });
  expect(created.ok, JSON.stringify(created.issues)).toBe(true);
  return ctx;
}

function house() {
  const ctx = blank();
  const authored = runTool(ctx, "author_house", { kind: "single", mapId: "town", kitId: "blue-stone",
    wings: [{ x: 3, y: 3, w: 7, h: 8 }], roofDeck: true, interior: "linked-interior", yard: [] });
  expect(authored.ok, JSON.stringify(authored.issues)).toBe(true);
  expect(ctx.project.maps.town.upperTiles[4 * 50 + 5]).toBe(199);
  return ctx;
}

function stamp() {
  const ctx = blank();
  const map = ctx.project.maps.town;
  map.structurePlacements = [{ id: "human-stamp", kitId: "removed-kit", x: 3, y: 3, w: 3, h: 3,
    before: { lower: Array(9).fill(TILE.GRASS), upper: Array(9).fill(TILE.EMPTY) }, afterHash: "human" }];
  return ctx;
}

describe("village environmental road ownership", () => {
  it.each(["control", "human-deck-edit", "human-stamp"] as const)(
    "accepts the exact public village when existing ownership is %s", (kind) => {
      // Given: accepted geometry survives real IO, including both layer stacks.
      const ctx = kind === "human-stamp" ? stamp() : house();
      const map = ctx.project.maps.town;
      if (kind !== "control") map.lowerTiles[4 * 50 + 5] = 424;
      map.lowerTileStacks = { [4 * 50 + 5]: [] };
      map.upperTileStacks = { [4 * 50 + 5]: [map.upperTiles[4 * 50 + 5]] };
      ctx.project = deserialize(serialize(ctx.project));
      const before = captureHouseProtection(ctx.project);
      const interiors = Object.fromEntries(Object.entries(ctx.project.maps).filter(([id]) => id !== "town"));

      // When: use the registered public facade, not a mocked builder or inspector.
      const result = runTool(ctx, "author_village", request);

      // Then: all accepted bytes survive and four new doors reach one external network.
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(result.data).toMatchObject({ village: { actualHouseCount: 4, structuralQa: {
        ok: true, doorsConnected: 4, doorsIntact: 4, roadComponents: 1, critiqueOk: true,
      } } });
      expect(captureHouseProtection(ctx.project).filter(h => before.some(old =>
        old.mapId === h.mapId && old.source === h.source && old.id === h.id))).toEqual(before);
      expect(Object.fromEntries(Object.entries(ctx.project.maps).filter(([id]) => id !== "town"))).toEqual(interiors);
      expect(roadComponentNotes(ctx.project.maps.town, area)).toHaveLength(1);
    },
  );

  it("excludes the bbox, ridge and recorded ladder, but not the surrounding yard", () => {
    // Given: metadata, not tile visuals, defines the accepted ownership.
    const ctx = blank();
    const map = ctx.project.maps.town;
    map.layoutPlan = { version: 1, kind: "houses", regions: [{ id: "old", role: "house",
      label: "Deck", x: 3, y: 3, w: 7, h: 8, doorAt: { x: 6, y: 10 }, tags: ["roof-deck"] }] };
    const owned = [{ x: 5, y: 4 }, { x: 5, y: 2 }, { x: 7, y: 11 }];
    const yard = [{ x: 2, y: 4 }, { x: 5, y: 11 }];
    for (const { x, y } of [...owned, ...yard]) map.lowerTiles[y * 50 + x] = SAND_TILE.BODY;
    map.upperTiles[11 * 50 + 7] = 322;

    // When
    const isRoad = environmentalRoadAt(map);

    // Then: no whole-yard exclusion can hide genuine outside road fragments.
    expect(owned.map(({ x, y }) => isRoad(x, y))).toEqual([false, false, false]);
    expect(yard.map(({ x, y }) => isRoad(x, y))).toEqual([true, true]);
  });

  it("retains external water bridges without treating owned water decks as roads", () => {
    // Given: equal plank/water values inside and outside a human stamp.
    const ctx = stamp();
    const map = ctx.project.maps.town;
    for (const x of [5, 12]) {
      map.lowerTiles[4 * 50 + x] = 120;
      map.upperTiles[4 * 50 + x] = 199;
    }
    map.upperTiles[4 * 50 + 15] = 199;

    // When
    const isRoad = environmentalRoadAt(map);

    // Then: external water/planks connect, ordinary planks on grass do not.
    expect([isRoad(5, 4), isRoad(12, 4), isRoad(15, 4)]).toEqual([false, true, false]);
  });

  it("does not construct an external spur to a road-valued human stamp", () => {
    // Given: the owned tile lies on the stamp edge, reachable by the old repair BFS.
    const ctx = stamp();
    const map = ctx.project.maps.town;
    map.lowerTiles[4 * 50 + 5] = SAND_TILE.BODY;
    for (let x = 12; x < 20; x += 1) map.lowerTiles[4 * 50 + x] = SAND_TILE.BODY;
    const before = serialize(ctx.project);

    // When
    ensureSingleRoadComponent(map, area, new Set(), "sand");

    // Then: ownership is not a road endpoint, so there is nothing to repair.
    expect(serialize(ctx.project)).toBe(before);
    expect(auditVillage(map, [], [], area).roadComponents).toBe(1);
  });

  it("does not connect external components through owned road values", () => {
    // Given: two genuine external segments joined only by the stamp's lower tiles.
    const ctx = stamp();
    const map = ctx.project.maps.town;
    for (let x = 1; x <= 8; x += 1) map.lowerTiles[4 * 50 + x] = SAND_TILE.BODY;

    // When
    const audit = auditVillage(map, [], [], area);

    // Then: neither outside segment is hidden just because it touches ownership.
    expect(audit.roadComponents).toBe(2);
    expect(roadComponentNotes(map, area)).toHaveLength(2);
  });

  it("does not count a nearby owned road value as a door connection", () => {
    // Given: a door has only a neighboring stamp, not a road, to its south.
    const ctx = stamp();
    const map = ctx.project.maps.town;
    map.lowerTiles[4 * 50 + 5] = SAND_TILE.BODY;
    const built: BuiltHouse = { bbox: { x: 6, y: 1, w: 3, h: 3 }, doorAt: { x: 6, y: 3 },
      front: { x: 6, y: 4 }, kitId: "blue-stone", stories: 1, templateId: "rect" };

    // When
    const audit = auditVillage(map, [built], [], area);

    // Then
    expect(audit.doorsConnected).toBe(0);
  });

  it("keeps the real facade gate closed when a disconnected external island remains", () => {
    // Given: the real builder is followed by a late external road edit, then real audit/inspection.
    const ctx = house();
    ctx.project.maps.town.lowerTiles[4 * 50 + 5] = SAND_TILE.BODY;
    ctx.project = deserialize(serialize(ctx.project));
    const before = serialize(ctx.project);
    let components = 0;
    const tool = createAuthorVillageTool({
      build(project, args) {
        const built = buildVillageDomain(project, args);
        if (typeof built.data !== "object" || built.data === null) throw new TypeError("Expected village result data");
        const map = project.maps.town;
        expect(roadComponentNotes(map, { x: 0, y: 0, w: 2, h: 2 })).toHaveLength(0);
        map.lowerTiles[0] = SAND_TILE.BODY;
        map.upperTiles[0] = TILE.EMPTY;
        components = auditVillage(map, [], [], area).roadComponents;
        return { ...built, data: { ...built.data, roadComponents: components } };
      },
      inspect: inspectVillageBuild,
    });

    // When
    const result = runToolDefinition(ctx, tool, request);

    // Then: the count gate is unchanged and rejection remains atomic.
    expect(components).toBe(2);
    expect(result.ok).toBe(false);
    expect(result.issues?.map(issue => issue.code)).toContain("village-qa-failed");
    expect(serialize(ctx.project)).toBe(before);
  });
});
