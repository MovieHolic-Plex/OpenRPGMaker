import { describe, expect, it } from "vitest";
import { parseAuthorHouseRequest } from "@/editor/construction/parseHouseRequest";
import { parseConstructionOutcome } from "@/editor/construction/parseConstructionOutcome";
import { parseAuthorVillageRequest } from "@/editor/construction/parseVillageRequest";
import { CONSTRUCTION_ROUTE_MANIFEST_PHASE, CONSTRUCTION_WRITE_ROUTE_MANIFEST, PUBLIC_CONSTRUCTION_READ_DIAGNOSTICS } from "@/editor/construction/routeManifest";
import { HOUSE_KIT_TOOLS } from "@/editor/tools/houseKitTools";
import { HOUSE_LOT_TOOLS } from "@/editor/tools/houseLotTools";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { TOOL_REGISTRY } from "@/editor/tools/toolRegistry";
import { ToolError } from "@/editor/tools/types";
import { VILLAGE_TOOLS } from "@/editor/tools/villageBuilder";
import { VILLAGE_SESSION_TOOLS } from "@/editor/tools/villageSession";
const singleHouseRequest = {
  kind: "single",
  mapId: "map_1",
  kitId: "blue-stone",
  wings: [{ x: 4, y: 3, w: 8, h: 7 }],
  interior: "exterior-only",
};
const lotsHouseRequest = {
  kind: "lots",
  mapId: "map_1",
  seed: 9,
  houses: [{
    kitId: "bright-plaster",
    wings: [{ x: 12, y: 6, w: 7, h: 6 }],
    interior: "linked-interior",
    door: true,
    ownerName: "Mina",
    windows: { spacing: 2 },
    yard: ["mailbox", { kind: "flowers", count: 2 }],
  }],
};
const existingVillageRequest = {
  target: { kind: "existing", mapId: "map_1", bounds: { x: 2, y: 2, w: 40, h: 40 } },
  houseCount: 4,
  housePlans: [{}, {}, {}, {}],
};
const newVillageRequest = {
  target: {
    kind: "new",
    mapId: "map_new_village",
    name: "New Village",
    width: 50,
    height: 52,
    plannedMap: { mapId: "map_new_village", width: 50, height: 52 },
  },
  houseCount: 4,
  countPolicy: "best-effort",
};
const emptyDiff = {
  tilesChanged: 0,
  eventsAdded: 0,
  eventsModified: 0,
  eventsRemoved: 0,
  mapsAdded: 0,
  mapsRemoved: 0,
  dbRecordsChanged: 0,
  tilesetsChanged: 0,
  switchesAdded: 0,
  variablesAdded: 0,
  worldEntitiesAdded: 0,
  worldEntitiesModified: 0,
  palettePresetsAdded: 0,
  palettePresetsModified: 0,
  endingsChanged: 0,
  sessionChanged: false,
  systemChanged: false,
};
const canonicalOutcome = {
  executionOk: true,
  applied: true,
  outcome: "applied",
  requestedEntrypoint: "author_house",
  canonicalRoute: "author_house",
  selectedImplementation: "house-kit-domain",
  routeChanges: [],
  activityPersistence: "local",
  projectPersistence: "not-requested",
  target: { kind: "existing", mapId: "map_1" },
  counts: { requested: 1, actual: 1 },
  diff: emptyDiff,
  warnings: [],
};
function expectToolError(action: () => void, code: string): void {
  let captured: unknown;
  try {
    action();
  } catch (error) {
    if (error instanceof ToolError) captured = error;
    else throw error;
  }
  expect(captured).toBeInstanceOf(ToolError);
  if (!(captured instanceof ToolError)) return;
  expect(captured.code).toBe(code);
}
describe("canonical construction contract baseline", () => {
  it("classifies every registered construction route exactly once", () => {
    // Given: construction tools from their real registry source arrays.
    const sourceTools = [
      ...MAP_TOOLS.filter((tool) => tool.name.endsWith("_house")),
      ...HOUSE_KIT_TOOLS,
      ...HOUSE_LOT_TOOLS,
      ...VILLAGE_TOOLS,
      ...VILLAGE_SESSION_TOOLS,
    ];
    const sourceNames = new Set(sourceTools.map((tool) => tool.name));
    const registered = TOOL_REGISTRY.filter((tool) => sourceNames.has(tool.name));
    // When: live registered routes are matched to write/read classifications.
    const classifications = [
      ...CONSTRUCTION_WRITE_ROUTE_MANIFEST.map((route) => ({ ...route, mode: "write" })),
      ...PUBLIC_CONSTRUCTION_READ_DIAGNOSTICS.map((route) => ({ ...route, mode: "read" })),
    ];
    const mismatches = registered.flatMap((tool) => {
      const matches = classifications.filter((route) => route.name === tool.name && route.mode === tool.mode);
      return matches.length === 1 ? [] : [`${tool.mode}:${tool.name} (${matches.length})`];
    });
    const liveByName = new Map(TOOL_REGISTRY.map((tool) => [tool.name, tool]));
    const stateMismatches = classifications.flatMap((route) => {
      const live = liveByName.get(route.name);
      const state = route.currentRegistry;
      const matches = state.registered === (live !== undefined)
        && state.deprecated === (live?.deprecated === true)
        && state.supersededBy === (live?.supersededBy ?? null);
      return matches ? [] : [route.name];
    });
    // Then: no registered construction route can disappear behind a hand-written list.
    expect(registered.map((tool) => tool.name).sort()).toEqual(sourceTools.map((tool) => tool.name).sort());
    expect(mismatches).toEqual([]);
    expect(stateMismatches).toEqual([]);
  });
  it("keeps target manifest routes unique with canonical writes public", () => {
    // Given: the migration-target write and diagnostic matrices.
    // When: the manifest is inspected for route identity and exposure.
    const names = CONSTRUCTION_WRITE_ROUTE_MANIFEST.map((route) => route.name);
    // Then: routes are unique and only canonical writes are targeted for public exposure.
    expect(CONSTRUCTION_ROUTE_MANIFEST_PHASE).toBe("canonical-migration-target");
    expect(new Set(names).size).toBe(names.length);
    expect(CONSTRUCTION_WRITE_ROUTE_MANIFEST.filter((route) => route.llmExposed).map((route) => route.name))
      .toEqual(["author_house", "author_village"]);
    expect(CONSTRUCTION_WRITE_ROUTE_MANIFEST.filter((route) => route.defaultToolBrowserExposed).map((route) => route.name))
      .toEqual(["author_house", "author_village"]);
    expect(CONSTRUCTION_WRITE_ROUTE_MANIFEST.every((route) => route.directExecution)).toBe(true);
    expect(PUBLIC_CONSTRUCTION_READ_DIAGNOSTICS.every((route) =>
      route.llmExposed && route.defaultToolBrowserExposed && route.directExecution)).toBe(true);
  });
  it.each([
    ["single", singleHouseRequest],
    ["lots", lotsHouseRequest],
  ])("parses house %s deterministically", (expectedKind, input) => {
    // Given: a canonical house request variant.
    const givenRequest: unknown = input;
    // When: the public boundary parses it.
    const parsed = parseAuthorHouseRequest(givenRequest);
    // Then: its discriminant is preserved without route inference.
    expect(parsed.kind).toBe(expectedKind);
  });
  it("parses existing and planned-new village targets", () => {
    // Given: explicit existing and new target shapes.
    const targets: readonly unknown[] = [existingVillageRequest, newVillageRequest];
    // When: both public requests cross the boundary.
    const parsed = targets.map(parseAuthorVillageRequest);
    // Then: exact is the default and best-effort stays explicit.
    expect(parsed.map((request) => [request.target.kind, request.countPolicy])).toEqual([
      ["existing", "exact"],
      ["new", "best-effort"],
    ]);
  });
  it.each([2, 33])("rejects invalid village count %s", (houseCount) => {
    // Given: a request outside the strict 4..32 range.
    const request = { ...existingVillageRequest, houseCount, housePlans: undefined };
    // When: the village boundary parses it.
    const parse = (): void => { parseAuthorVillageRequest(request); };
    // Then: a typed boundary error is returned before mutation.
    expectToolError(parse, "invalid-args");
  });
  it("rejects housePlans mismatch", () => {
    // Given: four requested houses but only three plans.
    const request = { ...existingVillageRequest, housePlans: [{}, {}, {}] };
    // When: the village boundary parses it.
    const parse = (): void => { parseAuthorVillageRequest(request); };
    // Then: a typed boundary error rejects the mismatch.
    expectToolError(parse, "invalid-args");
  });
  it("enforces target exclusivity", () => {
    // Given: an existing target polluted with new-target fields.
    const target = { ...existingVillageRequest.target, name: "Wrong", width: 50, height: 50 };
    // When: the village boundary parses it.
    const parse = (): void => { parseAuthorVillageRequest({ ...existingVillageRequest, target }); };
    // Then: the mixed target is rejected as invalid arguments.
    expectToolError(parse, "invalid-args");
  });
  it("rejects missing new-map ID", () => {
    // Given: a new target without its required named map ID.
    const target = { ...newVillageRequest.target, mapId: undefined };
    // When: the village boundary parses it.
    const parse = (): void => { parseAuthorVillageRequest({ ...newVillageRequest, target }); };
    // Then: the missing identity is rejected before map creation.
    expectToolError(parse, "invalid-args");
  });
  it("rejects planned dimensions mismatch", () => {
    // Given: a planned map descriptor that disagrees with the new target.
    const target = { ...newVillageRequest.target, plannedMap: { ...newVillageRequest.target.plannedMap, width: 49 } };
    // When: the village boundary parses it.
    const parse = (): void => { parseAuthorVillageRequest({ ...newVillageRequest, target }); };
    // Then: the typed planned-map mismatch is exposed.
    expectToolError(parse, "planned-map-mismatch");
  });
  it("requires exact outcome fields", () => {
    // Given: an applied canonical outcome with no route changes.
    const givenOutcome: unknown = canonicalOutcome;
    // When: the outcome boundary parses it.
    const parsed = parseConstructionOutcome(givenOutcome);
    // Then: every approved field is present and canonical routing stayed fixed.
    expect(Object.keys(parsed).sort()).toEqual([
      "activityPersistence", "applied", "canonicalRoute", "counts", "diff", "executionOk", "outcome",
      "projectPersistence", "requestedEntrypoint", "routeChanges", "selectedImplementation", "target", "warnings",
    ]);
    expect(parsed.routeChanges).toEqual([]);
  });
  it.each([
    ["compatibility alias", {
      ...canonicalOutcome,
      requestedEntrypoint: "build_house",
      routeChanges: [{ kind: "compatibility-alias", from: "build_house", to: "author_house" }],
    }, true],
    ["fallback", {
      ...canonicalOutcome,
      routeChanges: [{ kind: "fallback", from: "author_house", to: "author_village" }],
    }, false],
    ["canonical route change", {
      ...canonicalOutcome,
      routeChanges: [{ kind: "compatibility-alias", from: "author_house", to: "author_house" }],
    }, false],
  ])("distinguishes %s from route fallback", (_label, input, accepted) => {
    // Given: a route transition candidate.
    const parse = (): void => { parseConstructionOutcome(input); };
    // When: the outcome boundary classifies the route transition.
    let parsed = false;
    try {
      parse();
      parsed = true;
    } catch (error) {
      if (error instanceof ToolError) expect(error.code).toBe("undeclared-route-change");
      else throw error;
    }
    // Then: only a declared compatibility alias is accepted.
    expect(parsed).toBe(accepted);
  });
});
