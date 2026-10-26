import { describe, expect, it } from "vitest";
import type { TileClipboard } from "@/editor/editorState";
import { pasteGhostPieces } from "@/editor/pastePreviewGhost";

function clipboard(patch: Partial<TileClipboard> = {}): TileClipboard {
  return {
    width: 1,
    height: 1,
    lower: { tiles: [-1], stacks: [[]] },
    upper: { tiles: [-1], stacks: [[]] },
    ...patch,
  };
}

describe("paste preview ghost pieces", () => {
  it("draws layer 1, its stack, layer 2, shadow, layer 3, its stack, then layer 4", () => {
    const pieces = pasteGhostPieces(clipboard({
      lower: { tiles: [10], stacks: [[11, 12]], overlay: [20] },
      upper: { tiles: [30], stacks: [[31]], overlay: [40] },
      shadow: [0b0101],
    }), 0);
    expect(pieces).toEqual([
      { draw: "composed", tile: 10, alpha: 0.4 },
      { draw: "composed", tile: 11, alpha: 0.4 },
      { draw: "composed", tile: 12, alpha: 0.4 },
      { draw: "raw", tile: 20, alpha: 0.4 },
      { draw: "shadow", bits: 0b0101, alpha: 0.2 },
      { draw: "composed", tile: 30, alpha: 0.55 },
      { draw: "composed", tile: 31, alpha: 0.55 },
      { draw: "raw", tile: 40, alpha: 0.55 },
    ]);
  });

  it("skips empty cells and clipsboards that only stored layers 1 and 3", () => {
    expect(pasteGhostPieces(clipboard(), 0)).toEqual([]);
    expect(pasteGhostPieces(clipboard({
      lower: { tiles: [3], stacks: [[]] },
      upper: { tiles: [-1], stacks: [[]] },
    }), 0)).toEqual([{ draw: "composed", tile: 3, alpha: 0.4 }]);
  });

  it("masks shadow bits to the four quarters the map stores", () => {
    const pieces = pasteGhostPieces(clipboard({ shadow: [0b1111_0001] }), 0);
    expect(pieces).toEqual([{ draw: "shadow", bits: 0b0001, alpha: 0.2 }]);
  });
});
