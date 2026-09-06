import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  buildHouseKit,
  INTERNAL_ONLY_HOUSE_KIT_IDS,
  PUBLIC_HOUSE_KIT_IDS,
  type BuildHouseKitInput,
} from "@/editor/tools/houseKitDomain";
import { placePropsOnDraft, type PlacePropsInput } from "@/editor/tools/placePropsDomain";
import { HOUSE_KITS } from "@/editor/houseKit";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import { runTool } from "@/editor/tools/toolRunner";
import { sha256HexText } from "@/util/sha256";

const GRASS_TILE = 240;

function preparedProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error(`Missing fixture map: ${project.startMapId}`);
  map.lowerTiles.fill(GRASS_TILE);
  return project;
}

async function semanticHash(project: Project): Promise<string> {
  return sha256HexText(serialize(project));
}

function pureLoc(source: string): number {
  return source
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0 && !/^\s*(?:\/\/|#|--)/u.test(line))
    .length;
}

describe("HouseKit domain seam baseline characterization", () => {
  it("locks the exterior-only blue-stone L-house semantic hash", async () => {
    // Given
    const ctx = { project: preparedProject() };

    // When
    const result = runTool(ctx, "author_house", {
      kind: "single",
      mapId: ctx.project.startMapId,
      kitId: "blue-stone",
      wings: [
        { x: 2, y: 2, w: 8, h: 6 },
        { x: 6, y: 2, w: 4, h: 9 },
      ],
      interior: "exterior-only",
      door: true,
      yard: [],
    });

    // Then
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });

  it("locks the linked-interior semantic hash", async () => {
    // Given
    const ctx = { project: preparedProject() };

    // When
    const result = runTool(ctx, "author_house", {
      kind: "single",
      mapId: ctx.project.startMapId,
      kitId: "blue-stone",
      wings: [
        { x: 2, y: 2, w: 8, h: 6 },
        { x: 6, y: 2, w: 4, h: 9 },
      ],
      interior: "linked-interior",
      door: true,
      ownerName: "Seam QA",
      yard: [],
    });

    // Then
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });
});
describe("HouseKit durable completed-house registration", () => {
  it.each(["single", "lots"])("registers %s footprints and preserves them through reload", (kind) => {
    const ctx = { project: preparedProject() };
    const house = { kitId: "blue-stone", wings: [{ x: 2, y: 2, w: 6, h: 6 }], interior: "exterior-only", yard: [] };
    const result = runTool(ctx, "author_house", kind === "single"
      ? { kind, mapId: ctx.project.startMapId, ...house }
      : { kind, mapId: ctx.project.startMapId, houses: [house], seed: 7 });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    ctx.project = deserialize(serialize(ctx.project));
    const regions = ctx.project.maps[ctx.project.startMapId]?.layoutPlan?.regions.filter((region) => region.role === "house");
    expect(regions).toHaveLength(1);
    expect(regions?.[0]).toMatchObject({ x: 2, y: 2, w: 6, h: 6, kitId: "blue-stone" });
    const before = serialize(ctx.project);
    const erased = runTool(ctx, "tile_erase", { mapId: ctx.project.startMapId, rect: { x: 2, y: 2, w: 6, h: 6 } });
    expect(erased.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });
});

describe("HouseKit domain seam", () => {
  const exteriorInput = (mapId: string): BuildHouseKitInput => ({
    mapId,
    kitId: "blue-stone",
    wings: [
      { x: 2, y: 2, w: 8, h: 6 },
      { x: 6, y: 2, w: 4, h: 9 },
    ],
    door: true,
    doorEvent: true,
    interior: false,
  });

  it("author_house single produces the domain exterior-only semantic project", async () => {
    // Given
    const directProject = preparedProject();
    const toolCtx = { project: preparedProject() };

    // When
    const domainResult = buildHouseKit(directProject, exteriorInput(directProject.startMapId));
    const toolResult = runTool(toolCtx, "author_house", {
      kind: "single",
      mapId: toolCtx.project.startMapId,
      kitId: "blue-stone",
      wings: [
        { x: 2, y: 2, w: 8, h: 6 },
        { x: 6, y: 2, w: 4, h: 9 },
      ],
      interior: "exterior-only",
      door: true,
      yard: [],
    });

    // Then
    expect(toolResult.ok, JSON.stringify(toolResult.issues)).toBe(true);
    expect(domainResult.data.kitId).toBe("blue-stone");
  });

  it("author_house single produces the domain linked-interior semantic project", async () => {
    // Given
    const directProject = preparedProject();
    const toolCtx = { project: preparedProject() };
    const directInput: BuildHouseKitInput = {
      ...exteriorInput(directProject.startMapId),
      interior: true,
      ownerName: "Seam QA",
    };

    // When
    const domainResult = buildHouseKit(directProject, directInput);
    const toolResult = runTool(toolCtx, "author_house", {
      kind: "single",
      mapId: toolCtx.project.startMapId,
      kitId: "blue-stone",
      wings: [
        { x: 2, y: 2, w: 8, h: 6 },
        { x: 6, y: 2, w: 4, h: 9 },
      ],
      interior: "linked-interior",
      door: true,
      ownerName: "Seam QA",
      yard: [],
    });

    // Then
    expect(toolResult.ok, JSON.stringify(toolResult.issues)).toBe(true);
    expect(domainResult.data.kitId).toBe("blue-stone");
  });

  it("keeps one exhaustive public kit list and a safe HouseKit module size", async () => {
    // Given
    const declaredIds = [...PUBLIC_HOUSE_KIT_IDS, ...INTERNAL_ONLY_HOUSE_KIT_IDS];
    const domainSource = await readFile(new URL("../src/editor/tools/houseKitDomain.ts", import.meta.url), "utf8");
    const supportSource = await readFile(new URL("../src/editor/tools/houseKitDraftSupport.ts", import.meta.url), "utf8");

    // When
    const uniqueDeclaredIds = [...new Set(declaredIds)].sort();

    // Then
    expect(uniqueDeclaredIds).toEqual(Object.keys(HOUSE_KITS).sort());
    expect(pureLoc(domainSource)).toBeLessThanOrEqual(220);
    expect(pureLoc(supportSource)).toBeLessThanOrEqual(220);
  });

  it("keeps house lot and registered prop composition on shared domain calls", async () => {
    // Given
    const adapterSource = await readFile(new URL("../src/editor/tools/houseLotTools.ts", import.meta.url), "utf8");
    const domainSource = await readFile(new URL("../src/editor/tools/houseLotDomain.ts", import.meta.url), "utf8");
    const constructionSource = await readFile(new URL("../src/editor/tools/v3/constructionTools.ts", import.meta.url), "utf8");
    const directProject = preparedProject();
    const toolCtx = { project: preparedProject() };
    const directInput: PlacePropsInput = {
      mapId: directProject.startMapId,
      area: { x: 1, y: 1, w: 16, h: 10 },
      material: "침엽수",
      count: 4,
      minGap: 1,
      naturalness: 0.5,
      seed: 3,
    };

    // When
    const forbiddenComposition = /CONSTRUCTION_TOOLS_V3|\w+Tool\.run\(/.test(adapterSource + domainSource);
    const domainResult = placePropsOnDraft(directProject, directInput);
    const toolResult = runTool(toolCtx, "place_props", directInput);

    // Then
    expect(forbiddenComposition).toBe(false);
    expect(domainSource).toContain("buildHouseKit(");
    expect(constructionSource).toContain("placePropsOnDraft(");
    expect(toolResult.ok, JSON.stringify(toolResult.issues)).toBe(true);
    expect(domainResult.data).toEqual(toolResult.data);
    expect(await semanticHash(directProject)).toBe(await semanticHash(toolCtx.project));
  });

  it("leaves the caller hash unchanged when the target map is missing", async () => {
    // Given
    const ctx = { project: preparedProject() };
    const beforeHash = await semanticHash(ctx.project);

    // When
    const result = runTool(ctx, "author_house", {
      kind: "single",
      mapId: "missing_map",
      kitId: "blue-stone",
      wings: [{ x: 2, y: 2, w: 6, h: 6 }],
      interior: "exterior-only",
      door: true,
      yard: [],
    });

    // Then
    expect(result.ok).toBe(false);
    expect(await semanticHash(ctx.project)).toBe(beforeHash);
  });

  it("leaves the caller hash unchanged when a wing is out of bounds", async () => {
    // Given
    const ctx = { project: preparedProject() };
    const beforeHash = await semanticHash(ctx.project);

    // When
    const result = runTool(ctx, "author_house", {
      kind: "single",
      mapId: ctx.project.startMapId,
      kitId: "blue-stone",
      wings: [{ x: 18, y: 2, w: 6, h: 6 }],
      interior: "exterior-only",
      door: true,
      yard: [],
    });

    // Then
    expect(result.ok).toBe(false);
    expect(await semanticHash(ctx.project)).toBe(beforeHash);
  });
});
