import { describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";

describe("editor default layer", () => {
  it("starts on the floor layer with the brush so the first action paints tiles", () => {
    // Module singleton defaults — not reset by tests that only patch partial state.
    // 2e9f86a9 moved the boot default event→lower / event→paint on purpose: a beginner's
    // first action is painting a tile, and the event default needed a stopgap hint.
    expect(editorState.get().layer).toBe("lower");
    expect(editorState.get().tool).toBe("paint");
  });
});
