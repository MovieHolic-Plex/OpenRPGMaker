import { describe, expect, it } from "vitest";
import { cityInteriorSeed } from "@/ai/v2/place/builders/cityInteriorSeed";
import { MODERN_KR_BUILDER } from "@/ai/v2/place/builders/modernCity";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import { createBlankProject } from "@/project/defaults";
import { INTERIOR_BARE_FLOOR_LIMIT, measureInteriorBareFloor } from "@/editor/handInterior/bareFloor";
import { NEIGHBORHOOD_KONBINI } from "@/editor/handInterior/neighborhoodKonbini";
import { isPassable } from "@/project/collision";
import { computeReachableCells } from "@/project/lint/reachability";

const house: PlaceSpec = { type: "house", name: "역 앞 카페", style: "kr-modern", variety: "game-a" };

describe("modern interior seeds", () => {
  it("keeps the same floor plan for a game and room when a fresh tool call has a new salt", () => {
    expect(cityInteriorSeed({ ...house, salt: 17 })).toEqual(cityInteriorSeed({ ...house, salt: 9001 }));
    expect(cityInteriorSeed({ ...house, variety: "game-b" })).not.toEqual(cityInteriorSeed(house));
    expect(cityInteriorSeed({ ...house, name: "항구 카페" })).not.toEqual(cityInteriorSeed(house));
  });

  it("reuses saved seeds, respects explicit seeds and never compounds a variant on rebuild", () => {
    const changed = { ...house, hints: { variant: 2 } };
    expect(cityInteriorSeed(changed, 11)).toEqual({ baseSeed: 11, seed: 213 });
    expect(cityInteriorSeed({ ...changed, hints: { variant: 2, seed: 5 } }, 11)).toEqual({ baseSeed: 5, seed: 207 });
    expect(cityInteriorSeed({ ...house, variety: undefined, salt: 17 })).toEqual({ baseSeed: 18, seed: 18 });
  });

  it("keeps a legacy Korean room's actual layout until a different variant is requested", () => {
    const project = createBlankProject();
    const run = () => createBuildRun({ project, currentMapId: project.startMapId });
    const build = MODERN_KR_BUILDER.build;
    const original = build(run(), { ...house, hints: { seed: 1497 } });
    const oldSpec = { ...house, hints: { variant: 2 } };
    const saved = { builder: MODERN_KR_BUILDER.id, spec: oldSpec, result: { ...original, state: { seed: 1497, program: "cafe" } }, rounds: 1 };
    const renamed = { ...oldSpec, name: "서울 카페 별관" };
    const rebuilt = build(run(), renamed, saved);
    expect(rebuilt.ok).toBe(true);
    expect(rebuilt.mapIds).toEqual(original.mapIds);
    expect(rebuilt.entrance).toEqual(original.entrance);
    expect(rebuilt.state).toMatchObject({ seed: 1497, baseSeed: 1497 });
    const changed = build(run(), { ...renamed, hints: { variant: 3 } }, { ...saved, spec: renamed, result: rebuilt });
    expect(changed.state).toMatchObject({ seed: 1800, baseSeed: 1497 });
  });

  it("retains fractional layout selectors accepted by saved Japanese houses", () => {
    const spec = { ...house, style: "jp-modern", hints: { variant: 0.5 } };
    expect(cityInteriorSeed(spec, 1497)).toEqual({ baseSeed: 1497, seed: 1547.5 });
  });
});

describe("new Korean convenience stores", () => {
  const store: PlaceSpec = { type: "house", name: "편의점", style: "kr-modern" };
  const task = "편의점 실내 맵을 만들어 줘. 진열대랑 계산대, 음료 냉장고가 있게 해 줘.";

  it("stocks compact walkable aisles while different games can mirror the plan", () => {
    const entrances = [];
    for (const key of ["neighborhood-a", "neighborhood-b"]) {
      const project = createBlankProject();
      const ctx = { project, currentMapId: project.startMapId };
      const result = MODERN_KR_BUILDER.build(createBuildRun(ctx), { ...store, variety: `${key}|${task}` });
      expect(result.ok, result.summary).toBe(true);
      expect(result.state).toMatchObject({ program: NEIGHBORHOOD_KONBINI });
      const map = ctx.project.maps[result.mapIds[0]!]!;
      const entry = result.entrance!;
      expect(measureInteriorBareFloor(ctx.project, map)!.pct).toBeLessThanOrEqual(INTERIOR_BARE_FLOOR_LIMIT + 5);
      const reachable = computeReachableCells(ctx.project, map, entry.x, entry.y);
      const walkable = map.lowerTiles.filter((_, index) =>
        isPassable(ctx.project, map, index % map.width, Math.floor(index / map.width)));
      expect(reachable.size).toBe(walkable.length);
      entrances.push(entry.x);
    }
    expect(entrances[0]).not.toBe(entrances[1]);
  });

  it("keeps the classic program and floor when an older saved store is rebuilt", () => {
    const project = createBlankProject();
    const ctx = { project, currentMapId: project.startMapId };
    const build = MODERN_KR_BUILDER.build;
    const original = build(createBuildRun(ctx), { ...store, hints: { program: "konbini", seed: 382 } });
    expect(original.ok, original.summary).toBe(true);
    expect(original.state).toMatchObject({ program: "konbini", seed: 382 });
    const originalMap = ctx.project.maps[original.mapIds[0]!]!;
    const legacy = {
      builder: MODERN_KR_BUILDER.id, spec: store, rounds: 0,
      result: { ...original, state: { seed: 382, program: "konbini" } },
    };
    const renamed = build(createBuildRun(ctx), { ...store, name: "편의점 별관" }, legacy);
    expect(renamed.ok, renamed.summary).toBe(true);
    expect(renamed.state).toMatchObject({ program: "konbini", seed: 382 });
    expect(renamed.mapIds).toEqual(original.mapIds);
    expect(renamed.entrance).toEqual(original.entrance);
    expect(ctx.project.maps[renamed.mapIds[0]!]!.lowerTiles).toEqual(originalMap.lowerTiles);
    expect(ctx.project.maps[renamed.mapIds[0]!]!.upperTiles).toEqual(originalMap.upperTiles);
  });

  it("keeps the stocked program on rebuild and applies an explicit variant to the saved base seed", () => {
    const project = createBlankProject();
    const ctx = { project, currentMapId: project.startMapId };
    const spec = { ...store, variety: "neighborhood-a" };
    const original = MODERN_KR_BUILDER.build(createBuildRun(ctx), spec);
    expect(original.ok, original.summary).toBe(true);
    const { baseSeed } = cityInteriorSeed(spec);
    const edited = MODERN_KR_BUILDER.build(createBuildRun(ctx), { ...spec, name: "새 간판", hints: { variant: 2 } }, {
      builder: MODERN_KR_BUILDER.id, spec, rounds: 0, result: original,
    });
    expect(edited.ok, edited.summary).toBe(true);
    expect(edited.mapIds).toEqual(original.mapIds);
    expect(edited.state).toMatchObject({ program: NEIGHBORHOOD_KONBINI, baseSeed, seed: baseSeed + 202 });
  });
});
