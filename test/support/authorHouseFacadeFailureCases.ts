import { expect, it } from "vitest";

import { runAuthorHouse } from "@/editor/tools/authorHouseFacade";

import {
  exteriorSingle,
  preparedProject,
  projectHash,
  requireHouseData,
} from "./authorHouseFacadeFixture";

export function registerAuthorHouseFailureCases(): void {
  it.each([
    {
      label: "missing target",
      request: { ...exteriorSingle, mapId: "missing" },
      issueCode: "missing-map",
    },
    {
      label: "invalid wing",
      request: { ...exteriorSingle, wings: [{ x: 3, y: 3, w: 2, h: 6 }] },
      issueCode: "invalid-args",
    },
    {
      label: "legacy linked-interior booleans",
      request: { ...exteriorSingle, interior: true, doorEvent: true },
      issueCode: "invalid-args",
    },
  ])("blocks $label atomically with a selected route", ({ request, issueCode }) => {
    const ctx = { project: preparedProject() };
    const before = projectHash(ctx.project);

    const result = runAuthorHouse(ctx, request);

    const data = requireHouseData(result.data);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe(issueCode);
    expect(data.construction).toMatchObject({
      canonicalRoute: "author_house",
      selectedImplementation: "house-kit-domain",
      executionOk: false,
      applied: false,
      outcome: "blocked",
      counts: { actual: 0 },
    });
    expect(projectHash(ctx.project)).toBe(before);
    expect(data.houses).toEqual([]);
    expect(data.changes.changedMapIds).toEqual([]);
  });

  it("rejects overlapping lot definitions atomically", () => {
    const ctx = { project: preparedProject() };
    const before = projectHash(ctx.project);
    const duplicate = {
      kitId: "blue-stone",
      wings: [{ x: 3, y: 3, w: 8, h: 6 }],
      interior: "exterior-only",
      door: true,
      yard: [],
    } as const;

    const result = runAuthorHouse(ctx, {
      kind: "lots",
      mapId: "m1",
      houses: [duplicate, duplicate],
    });

    const data = requireHouseData(result.data);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-house-lots");
    expect(data.construction.counts).toEqual({ requested: 2, actual: 0 });
    expect(projectHash(ctx.project)).toBe(before);
  });

  it("rejects an overlapping replay and preserves the first applied project exactly", () => {
    const ctx = { project: preparedProject() };
    const first = runAuthorHouse(ctx, exteriorSingle);
    expect(first.ok, first.summary).toBe(true);
    const afterFirst = projectHash(ctx.project);

    const replay = runAuthorHouse(ctx, exteriorSingle);

    const data = requireHouseData(replay.data);
    expect(replay.ok).toBe(false);
    expect(replay.issues?.[0]?.code).toBe("house-overlap");
    expect(data.construction.outcome).toBe("blocked");
    expect(projectHash(ctx.project)).toBe(afterFirst);
  });

  it("rolls back a real material-not-found yard failure before the outer commit", () => {
    const ctx = { project: preparedProject() };
    const tileset = ctx.project.tilesets[ctx.project.maps.m1?.tilesetId ?? ""];
    if (tileset === undefined) throw new Error("fixture tileset missing");
    tileset.tileMeta = [];
    tileset.tileGroups = [];
    const projectReference = ctx.project;
    const before = projectHash(ctx.project);

    const result = runAuthorHouse(ctx, {
      kind: "lots",
      mapId: "m1",
      houses: [{
        kitId: "blue-stone",
        wings: [{ x: 3, y: 3, w: 8, h: 6 }],
        interior: "exterior-only",
        door: true,
        yard: [{ kind: "mailbox", count: 1 }],
      }],
    });

    const data = requireHouseData(result.data);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("material-not-found");
    expect(data.construction).toMatchObject({
      selectedImplementation: "house-lot-domain",
      canonicalRoute: "author_house",
      executionOk: false,
      applied: false,
      outcome: "blocked",
      counts: { requested: 1, actual: 0 },
    });
    expect(data.construction.warnings.join("\n")).toContain("우편함");
    expect(ctx.project).toBe(projectReference);
    expect(projectHash(ctx.project)).toBe(before);
  });

  it("rolls back a zero-placement yard shortfall", () => {
    const ctx = { project: preparedProject() };
    const map = ctx.project.maps.m1;
    if (map === undefined) throw new Error("fixture map missing");
    map.upperTiles.fill(1);
    const before = projectHash(ctx.project);

    const result = runAuthorHouse(ctx, {
      kind: "lots",
      mapId: "m1",
      houses: [{
        kitId: "blue-stone",
        wings: [{ x: 3, y: 3, w: 8, h: 6 }],
        interior: "exterior-only",
        door: true,
        yard: [{ kind: "mailbox", count: 2 }],
      }],
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("yard-placement-shortfall");
    expect(result.data.construction.counts).toEqual({ requested: 1, actual: 0 });
    expect(projectHash(ctx.project)).toBe(before);
  });
}
