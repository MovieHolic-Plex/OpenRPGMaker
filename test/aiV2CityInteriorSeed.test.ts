import { describe, expect, it } from "vitest";
import { cityInteriorSeed } from "@/ai/v2/place/builders/cityInteriorSeed";
import type { PlaceSpec } from "@/ai/v2/shared/types";

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
});
