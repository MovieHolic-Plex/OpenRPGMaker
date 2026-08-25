import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { AUTHOR_VILLAGE_TOOL } from "@/editor/tools/authorVillageTool";
import { serialize } from "@/project/io";
import {
  construction,
  createExistingProject,
  EXISTING_TARGET,
  runFacade,
  stubTool,
} from "./authorVillageFacadeFixtures";
import "./authorVillageFacadeAdversarial";

describe("author_village facade", () => {
  it("applies an exact seeded village to only the requested existing exterior", () => {
    const project = createExistingProject();
    const startBefore = { mapId: project.startMapId, pos: { ...project.startPos } };

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(construction(result)).toMatchObject({
      executionOk: true,
      applied: true,
      outcome: "applied",
      requestedEntrypoint: "author_village",
      canonicalRoute: "author_village",
      routeChanges: [],
      target: EXISTING_TARGET,
      counts: { requested: 4, actual: 4 },
    });
    expect({ mapId: project.startMapId, pos: project.startPos }).toEqual(startBefore);
    expect(Object.keys(project.maps)).toEqual(["map_existing"]);
  });

  it("supports an exact two-house starter settlement", () => {
    const project = createExistingProject();
    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 2,
      housePlans: [
        { kitId: "blue-stone", ownerName: "하린", yard: ["mailbox"] },
        { kitId: "bright-plaster", ownerName: "도윤", yard: ["flowers"] },
      ],
      npcCount: 2,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(construction(result).counts).toEqual({ requested: 2, actual: 2 });
    expect(project.maps.map_existing.events.filter((event) => event.id.startsWith("ev_village_"))).toHaveLength(2);
  });

  it("normalizes mixed existing-target fields captured from a live LLM turn", () => {
    const project = createExistingProject(32);
    const result = runFacade(project, {
      target: {
        kind: "existing",
        mapId: "map_existing",
        name: "빈 맵",
        width: 32,
        height: 24,
        bounds: { x: 1, y: 1, w: 30, h: 22 },
        plannedMap: { mapId: "map_existing", width: 32, height: 24 },
      },
      houseCount: 2,
      housePlans: [
        { kitId: "bright-plaster", yard: ["mailbox", "flowers", "pot"], ownerName: "미라", templateId: "village-home-west", program: "dwelling" },
        { kitId: "amber-wood", yard: ["firewood", "bench_h", "jar"], ownerName: "로안", templateId: "village-home-east", program: "dwelling" },
      ],
      countPolicy: "exact",
      groundTheme: "grass",
      settlementLayout: "street-grid",
      npcCount: 0,
      theme: "밝고 한적한 시작 마을",
      seed: 4217,
      interior: false,
    });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(construction(result).counts).toEqual({ requested: 2, actual: 2 });
  });

  it("exposes the same target and house-plan fields that its parser accepts", () => {
    const target = AUTHOR_VILLAGE_TOOL.parameters.properties?.target;
    const housePlan = AUTHOR_VILLAGE_TOOL.parameters.properties?.housePlans?.items;
    expect(target?.properties).toEqual(expect.objectContaining({
      kind: expect.any(Object), mapId: expect.any(Object), bounds: expect.any(Object), plannedMap: expect.any(Object),
    }));
    expect(target?.properties).not.toHaveProperty("x");
    expect(housePlan?.properties).toEqual(expect.objectContaining({
      kitId: expect.any(Object), yard: expect.any(Object), ownerName: expect.any(Object), templateId: expect.any(Object), program: expect.any(Object),
    }));
    expect(housePlan?.properties).not.toHaveProperty("wings");
  });

  it.each(["분수가 있는 평화로운 마을", "town with a Fountain centerpiece"])("substitutes one plaza well for the unavailable landmark in %s", (theme) => {
    const project = createExistingProject();

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      countPolicy: "exact",
      theme,
      seed: 7,
      interior: false,
    });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    const map = project.maps.map_existing;
    const commons = map.layoutPlan?.regions.find((region) => region.id === "village_commons");
    expect(commons).toBeDefined();
    const wellCells = map.upperTiles.flatMap((tile, index) => tile === 382
      ? [{ x: index % map.width, y: Math.floor(index / map.width) }]
      : []);
    expect(wellCells).toHaveLength(1);
    if (commons === undefined) throw new Error("village commons region missing");
    expect(wellCells[0]).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(wellCells[0]?.x).toBeGreaterThanOrEqual(commons.x - 4);
    expect(wellCells[0]?.x).toBeLessThan(commons.x + commons.w + 4);
    expect(wellCells[0]?.y).toBeGreaterThanOrEqual(commons.y - 4);
    expect(wellCells[0]?.y).toBeLessThan(commons.y + commons.h + 4);
    const warnings = construction(result).warnings;
    expect(warnings.some((warning) => /fountain|분수/i.test(warning) && /unavailable|없/i.test(warning) && /well|우물/i.test(warning) && /substitut|대체/i.test(warning))).toBe(true);
  });

  it("keeps fountain fallback well placement inside requested bounds", () => {
    const project = createExistingProject(40);
    const result = runFacade(project, {
      target: { kind: "existing", mapId: "map_existing", bounds: { x: 5, y: 5, w: 30, h: 30 } },
      houseCount: 2,
      npcCount: 0,
      countPolicy: "exact",
      theme: "분수가 있는 작은 마을",
      seed: 11,
      interior: false,
    });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(result.diff?.warnings.join("\n") ?? "").toContain("well(우물 382)");
  });

  it("does not emit the fountain fallback warning for an ordinary theme", () => {
    const project = createExistingProject();

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      countPolicy: "exact",
      theme: "quiet forest village",
      seed: 7,
      interior: false,
    });

    expect(result.ok, result.summary).toBe(true);
    expect(construction(result).warnings.some((warning) => /fountain|분수/i.test(warning))).toBe(false);
  });

  it("creates the exact requested new map identity without suffix or reuse", () => {
    const project = createEmptyToolProject("new village");
    const result = runFacade(project, {
      target: {
        kind: "new",
        mapId: "map_named_village",
        name: "Named Village",
        width: 50,
        height: 50,
        plannedMap: { mapId: "map_named_village", width: 50, height: 50 },
      },
      houseCount: 4,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    });

    expect(result.ok, result.summary).toBe(true);
    expect(project.maps.map_named_village).toMatchObject({
      id: "map_named_village",
      name: "Named Village",
      width: 50,
      height: 50,
    });
    expect(Object.keys(project.maps)).toEqual(["map_named_village"]);
    expect(construction(result).counts).toEqual({ requested: 4, actual: 4 });
  });

  it.each([0, 33])("rejects houseCount %s without clamping or writing", (houseCount) => {
    const project = createExistingProject(100);
    const before = serialize(project);

    const result = runFacade(project, { target: EXISTING_TARGET, houseCount, countPolicy: "exact" });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-args");
    expect(serialize(project)).toBe(before);
  });

  it("rejects a house-plan count mismatch before writing", () => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      housePlans: [{ yard: [] }, { yard: [] }, { yard: [] }],
      countPolicy: "exact",
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-args");
    expect(serialize(project)).toBe(before);
  });

  it("rolls back maps, interiors, events, tree, and start when exact count is short", () => {
    const project = createExistingProject(36);
    const before = serialize(project);

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 32,
      countPolicy: "exact",
      seed: 7,
      interior: true,
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-count-shortfall");
    expect(serialize(project)).toBe(before);
  });

  it("fails a colliding new map without suffixing or reusing it", () => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: { kind: "new", mapId: "map_existing", name: "Collision", width: 50, height: 50, plannedMap: { mapId: "map_existing", width: 50, height: 50 } },
      houseCount: 4,
      countPolicy: "exact",
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("map-exists");
    expect(Object.keys(project.maps)).toEqual(["map_existing"]);
    expect(serialize(project)).toBe(before);
  });

  it("accepts a fully satisfied two-house best-effort request", () => {
    const project = createExistingProject();

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 2,
      countPolicy: "best-effort",
    }, stubTool(2));

    expect(result.ok, result.summary).toBe(true);
    expect(construction(result)).toMatchObject({
      executionOk: true,
      applied: true,
      outcome: "applied",
      counts: { requested: 2, actual: 2 },
    });
  });

  it("reports an explicit best-effort result at the 85 percent threshold", () => {
    const project = createExistingProject();

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 20,
      countPolicy: "best-effort",
    }, stubTool(17));

    expect(result.ok, result.summary).toBe(true);
    expect(construction(result)).toMatchObject({
      executionOk: true,
      applied: true,
      outcome: "partial",
      counts: { requested: 20, actual: 17 },
    });
  });

  it("rolls back best-effort below the 85 percent threshold", () => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 20,
      countPolicy: "best-effort",
    }, stubTool(16));

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-count-shortfall");
    expect(serialize(project)).toBe(before);
  });

  it.each([
    { label: "structural QA", tool: stubTool(4, { qaOk: false }), code: "village-qa-failed" },
    { label: "target change", tool: stubTool(4, { mapId: "map_other" }), code: "village-target-changed" },
    { label: "inner failure", tool: stubTool(4, { innerOk: false }), code: "village-inner-failed" },
    { label: "no write", tool: stubTool(4, { mutate: false }), code: "village-no-change" },
  ])("converts $label into an atomic outer failure", ({ tool, code }) => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      countPolicy: "exact",
    }, tool);

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe(code);
    expect(serialize(project)).toBe(before);
  });

  it("rejects an existing-target write outside requested bounds", () => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: { kind: "existing", mapId: "map_existing", bounds: { x: 10, y: 10, w: 36, h: 36 } },
      houseCount: 4,
      countPolicy: "exact",
    }, stubTool(4));

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-outside-bounds");
    expect(serialize(project)).toBe(before);
  });
});

describe("author_village settlement scale and winter", () => {
  it("builds a deterministic 100x100 snow city with the requested population", () => {
    const args = {
      target: {
        kind: "new",
        mapId: "map_winter_city",
        name: "Winter City",
        width: 100,
        height: 100,
        plannedMap: { mapId: "map_winter_city", width: 100, height: 100 },
      },
      houseCount: 20,
      npcCount: 50,
      countPolicy: "exact",
      groundTheme: "snow",
      settlementLayout: "street-grid",
      seed: 41,
      interior: false,
    } as const;
    const first = createEmptyToolProject("winter city one");
    const second = createEmptyToolProject("winter city two");

    const firstResult = runFacade(first, args);
    const secondResult = runFacade(second, args);

    expect(firstResult.ok, `${firstResult.summary} ${JSON.stringify(firstResult.issues ?? [])}`).toBe(true);
    expect(secondResult.ok, `${secondResult.summary} ${JSON.stringify(secondResult.issues ?? [])}`).toBe(true);
    const firstMap = first.maps.map_winter_city;
    const secondMap = second.maps.map_winter_city;
    expect(firstMap).toBeTruthy();
    expect(firstMap.lowerTiles).toEqual(secondMap.lowerTiles);
    expect(firstMap.events.map((event) => [event.id, event.x, event.y])).toEqual(
      secondMap.events.map((event) => [event.id, event.x, event.y]),
    );
    const data = firstResult.data as { village: { actualHouseCount: number }; construction: { counts: { actual: number } } };
    expect(data.village.actualHouseCount).toBe(20);
    expect(firstMap.events.filter((event) => event.id.startsWith("ev_village_"))).toHaveLength(50);
    const snowTiles = new Set([67, 37, 97, 66, 68, 36, 38, 96, 98, 6, 8]);
    const roadTiles = new Set([424, 394, 454, 423, 425, 393, 395, 453, 455, 456, 421, 391, 451, 420, 422, 390, 392, 450, 452, 360, 362, 300, 190, 160, 220, 189, 191, 159, 161, 219, 221, 129, 131, 69]);
    const exteriorGround = firstMap.lowerTiles.filter((tile) => snowTiles.has(tile) || roadTiles.has(tile)).length;
    expect(firstMap.lowerTiles.filter((tile) => snowTiles.has(tile)).length).toBeGreaterThan(7_000);
    expect(exteriorGround).toBeGreaterThan(8_000);
    expect(snowTiles.has(firstMap.lowerTiles[first.startPos.y * firstMap.width + first.startPos.x] ?? -1) || roadTiles.has(firstMap.lowerTiles[first.startPos.y * firstMap.width + first.startPos.x] ?? -1)).toBe(true);
    expect(new Set(firstMap.events.filter((event) => event.id.startsWith("ev_village_")).map((event) => `${event.x},${event.y}`)).size).toBe(50);
    expect(firstMap.layoutPlan?.regions.find((region) => region.role === "plaza")?.tags).toContain("street-grid");
  }, 90_000);

  it("rolls back an exact request when the requested population cannot fit", () => {
    const project = createExistingProject(36);
    const before = serialize(project);

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      npcCount: 512,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-population-shortfall");
    expect(serialize(project)).toBe(before);
  });
});
