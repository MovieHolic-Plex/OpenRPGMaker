import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { createBlankProject } from "@/project/defaults";

describe("buildSystemPrompt tileset knowledge", () => {
  it("includes the human label and executable meaning without exposing the private group id", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    tileset.tileGroups = [...(tileset.tileGroups ?? []), {
      id: "user-cliff-private-id",
      name: "북쪽 반복 절벽",
      role: "wall",
      defaultLayer: "lower",
      layerHome: "lower",
      origin: "user",
      description: "2×3 단위를 이어 붙이는 절벽",
      placementRules: "가로와 세로 모두 반복 가능",
      tileIds: [0, 1, 30, 31, 60, 61],
      patternGrammar: {
        axis: "both",
        blockHeight: 3,
        blockWidth: 2,
        kind: "repeatable_block",
        minHeight: 3,
        minWidth: 2,
        parts: [{ role: "repeatBody", tileIds: [0, 1, 30, 31, 60, 61] }],
        preserveCaps: false,
        repeat: "source_order",
      },
    }];

    const context = buildSystemPrompt(project, { currentMapId: project.startMapId });

    expect(context).toContain("북쪽 반복 절벽");
    expect(context).toContain("pattern=repeatable_block");
    expect(context).toContain("shape=2x3");
    expect(context).toContain("passage=");
    expect(context).not.toContain("user-cliff-private-id");
  });
});
