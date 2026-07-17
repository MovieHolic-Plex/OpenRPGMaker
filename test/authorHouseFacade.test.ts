import { describe, expect, it } from "vitest";

import { parseConstructionOutcome } from "@/editor/construction/parseConstructionOutcome";
import { AUTHOR_HOUSE_TOOL, runAuthorHouse } from "@/editor/tools/authorHouseFacade";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import {
  eventTransfersTo,
  exteriorSingle,
  preparedProject,
  requireHouseData,
} from "./support/authorHouseFacadeFixture";
import { registerAuthorHouseFailureCases } from "./support/authorHouseFacadeFailureCases";

describe("author_house canonical facade", () => {
  it("stays unregistered until the exposure migration while its typed runner enters ToolRunner", () => {
    // Given
    const ctx = { project: preparedProject() };

    // When
    const genericResult = runTool(ctx, "author_house", exteriorSingle);
    const facadeResult = runAuthorHouse(ctx, exteriorSingle);

    // Then
    expect(getTool("author_house")).toBeUndefined();
    expect(AUTHOR_HOUSE_TOOL.name).toBe("author_house");
    expect(genericResult.ok).toBe(false);
    expect(facadeResult.ok, facadeResult.summary).toBe(true);
  });

  it("builds one exterior-only house with exact target and change evidence", () => {
    // Given
    const ctx = { project: preparedProject() };
    const startBefore = structuredClone(ctx.project.startPos);
    const treeBefore = structuredClone(ctx.project.mapTree);

    // When
    const result = runAuthorHouse(ctx, exteriorSingle);

    // Then
    const data = requireHouseData(result.data);
    expect(result.ok, result.summary).toBe(true);
    expect(data.construction).toMatchObject({
      requestedEntrypoint: "author_house",
      canonicalRoute: "author_house",
      selectedImplementation: "house-kit-domain",
      target: { kind: "existing", mapId: "m1" },
      counts: { requested: 1, actual: 1 },
      executionOk: true,
      applied: true,
      outcome: "applied",
    });
    expect(parseConstructionOutcome(data.construction)).toEqual(data.construction);
    expect(data.houses).toHaveLength(1);
    expect(data.houses[0]?.interior).toBeUndefined();
    expect(data.changes.changedMapIds).toEqual(["m1"]);
    expect(data.changes.addedMapIds).toEqual([]);
    expect(data.changes.changedCells.length).toBeGreaterThan(0);
    expect(ctx.project.startPos).toEqual(startBefore);
    expect(ctx.project.mapTree).toEqual(treeBefore);
  });

  it("keeps a domain clearance warning in the shared construction outcome", () => {
    const ctx = { project: preparedProject() };
    const map = ctx.project.maps.m1;
    if (map === undefined) throw new Error("fixture map missing");
    const front = { x: 20, y: 22 };
    map.lowerTiles[front.y * map.width + front.x] = 290;
    map.upperTiles[front.y * map.width + front.x] = 260;

    const result = runAuthorHouse(ctx, {
      ...exteriorSingle,
      wings: [{ x: 18, y: 15, w: 6, h: 7 }],
    });

    const data = requireHouseData(result.data);
    const warning = "문 앞 (20,22) 통행 확보 — 지면으로 정리";
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.warnings).toContain(warning);
    expect(data.construction.warnings).toContain(warning);
    expect(parseConstructionOutcome(data.construction)).toEqual(data.construction);
  });

  it("builds one linked interior with a valid bidirectional transfer pair", () => {
    // Given
    const ctx = { project: preparedProject() };

    // When
    const result = runAuthorHouse(ctx, {
      ...exteriorSingle,
      ownerName: "Linked QA",
      interior: "linked-interior",
    });

    // Then
    const data = requireHouseData(result.data);
    const house = data.houses[0];
    expect(result.ok, result.summary).toBe(true);
    expect(house?.interior).toBeDefined();
    if (house?.interior === undefined) throw new Error("linked house has no interior evidence");
    expect(data.construction.counts).toEqual({ requested: 1, actual: 1 });
    expect(data.changes.addedMapIds).toContain(house.interior.interiorMapId);
    expect(data.changes.addedEventIds).toContain(house.interior.doorEventId);
    expect(data.changes.addedEventIds).toContain(house.interior.exitEventId);
    expect(eventTransfersTo({
      project: ctx.project,
      mapId: "m1",
      eventId: house.interior.doorEventId,
      targetMapId: house.interior.interiorMapId,
    })).toBe(true);
    expect(eventTransfersTo({
      project: ctx.project,
      mapId: house.interior.interiorMapId,
      eventId: house.interior.exitEventId,
      targetMapId: "m1",
    })).toBe(true);
  });

  it("builds each requested lot directly through the lot domain and reports every house", () => {
    // Given
    const ctx = { project: preparedProject() };

    // When
    const result = runAuthorHouse(ctx, {
      kind: "lots",
      mapId: "m1",
      seed: 7,
      houses: [
        {
          kitId: "blue-stone",
          wings: [{ x: 3, y: 3, w: 8, h: 6 }],
          interior: "exterior-only",
          door: true,
          ownerName: "A",
          yard: [],
        },
        {
          kitId: "bright-plaster",
          wings: [{ x: 22, y: 15, w: 7, h: 6 }],
          interior: "linked-interior",
          door: true,
          ownerName: "B",
          yard: ["mailbox"],
        },
      ],
    });

    // Then
    const data = requireHouseData(result.data);
    expect(result.ok, result.summary).toBe(true);
    expect(data.construction.selectedImplementation).toBe("house-lot-domain");
    expect(data.construction.counts).toEqual({ requested: 2, actual: 2 });
    expect(data.houses).toHaveLength(2);
    expect(data.houses[0]?.interior).toBeUndefined();
    expect(data.houses[1]?.interior).toBeDefined();
  });

  registerAuthorHouseFailureCases();
});
