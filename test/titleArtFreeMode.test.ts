import { describe, expect, it } from "vitest";
import { applyTitleArtFreeFit } from "@/editor/titleArtFitting";
import { titleArtScreenArgs } from "@/editor/titleArtGeneration";
import { buildTitleArtPrompt, prepareTitleArtRequest } from "@/editor/tools/titleArtTools";
import { TITLE_OPENING_PRESETS } from "@/project/titleEffects";

describe("title art free mode", () => {
  it("accepts a prompt with no preset and keeps the author's words in the image prompt", () => {
    const request = prepareTitleArtRequest({ prompt: "눈 덮인 등대와 오로라" });
    expect(request.preset).toBeUndefined();
    expect(buildTitleArtPrompt(request)).toContain("눈 덮인 등대와 오로라");
    expect(() => prepareTitleArtRequest({})).toThrow();
    expect(() => prepareTitleArtRequest({ preset: "nope", prompt: "아무거나 그려" })).toThrow();
  });

  it("builds effects from the vision answer and drops malformed entries", () => {
    const fit = applyTitleArtFreeFit(JSON.stringify({
      logoStyle: "gold",
      effects: [
        { kind: "godRays", source: [0.7, -0.1], toward: [0.4, 0.8], color: "#FFE6A8" },
        { kind: "water", box: [0, 0.7, 1, 1] },
        { kind: "glow", source: [0.3, 0.55], intensity: 9 },
        { kind: "motes", box: [0.1, 0.1, 0.9, 0.6] },
        { kind: "glint" },
        { kind: "lasers", source: [0.5, 0.5] },
        { kind: "camera" },
        { kind: "camera" },
      ],
    }));
    expect(fit.logoStyle).toBe("gold");
    expect(fit.effects.map((effect) => effect.kind)).toEqual(["godRays", "water", "glow", "motes", "camera"]);
    expect(fit.effects[0]?.color).toBe("#ffe6a8");
    expect(fit.effects[2]?.intensity).toBe(1.6);
    expect(fit.effects[3]?.region).toHaveLength(4);
  });

  it("falls back to a camera breath when nothing usable comes back", () => {
    expect(applyTitleArtFreeFit("not json").effects).toEqual([{ kind: "camera" }]);
  });

  it("links the art without an opening preset in free mode", () => {
    const free = titleArtScreenArgs(prepareTitleArtRequest({ prompt: "붉은 사막의 신전" }), "res", [{ kind: "camera" }], "stone");
    expect(free.openingPreset).toBeUndefined();
    expect(free.logoStyle).toBe("stone");
    const preset = TITLE_OPENING_PRESETS[0]!;
    const withPreset = titleArtScreenArgs(prepareTitleArtRequest({ preset: preset.id }), "res", undefined, "stone");
    expect(withPreset.openingPreset).toBe(preset.id);
    expect(withPreset.logoStyle).toBeUndefined();
  });
});
