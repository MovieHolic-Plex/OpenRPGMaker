import { describe, expect, it } from "vitest";
import { cityInteriorSeed } from "@/ai/v2/place/builders/cityInteriorSeed";
import { MODERN_KR_BUILDER } from "@/ai/v2/place/builders/modernCity";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import { createBlankProject } from "@/project/defaults";

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
