import { describe, expect, it } from "vitest";
import { directionalPassageFromPreset, togglePassageDirection } from "@/project/tilesetPassage";
import type { PassFlag } from "@/project/types";

describe("directional tileset passage", () => {
  it("maps O, X, and star without collapsing explicit arrows", () => {
    expect(directionalPassageFromPreset("open")).toEqual({
      passability: { down: true, left: true, right: true, up: true },
      priority: "lower",
    });
    expect(directionalPassageFromPreset("blocked")).toEqual({
      passability: { down: false, left: false, right: false, up: false },
      priority: "lower",
    });
    expect(directionalPassageFromPreset("star")).toEqual({
      passability: { down: true, left: true, right: true, up: true },
      priority: "upper",
    });
  });

  it("toggles exactly one movement direction", () => {
    const passage: PassFlag = { down: false, left: true, right: false, up: true };

    expect(togglePassageDirection(passage, "right")).toEqual({ down: false, left: true, right: true, up: true });
    expect(passage).toEqual({ down: false, left: true, right: false, up: true });
  });
});
