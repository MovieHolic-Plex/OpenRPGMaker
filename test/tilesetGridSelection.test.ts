import { describe, expect, it } from "vitest";
import {
  beginGridSelectionDrag,
  cancelGridSelectionDrag,
  commitGridSelectionDrag,
  createGridSelectionState,
  gridSelectionGeometry,
  selectGridTile,
  updateGridSelectionDrag,
} from "@/editor/panels/tilesetGridSelection";

describe("tileset grid selection", () => {
  const spec = { tileCount: 100, tilesPerRow: 10 };

  it("selects a row-major rectangle for forward and reverse drags", () => {
    const initial = createGridSelectionState();
    const forward = commitGridSelectionDrag(updateGridSelectionDrag(beginGridSelectionDrag(initial, 11, {}), { spec, tile: 23 }));
    const reverse = commitGridSelectionDrag(updateGridSelectionDrag(beginGridSelectionDrag(initial, 23, {}), { spec, tile: 11 }));

    expect(forward.selected).toEqual([11, 12, 13, 21, 22, 23]);
    expect(reverse.selected).toEqual(forward.selected);
    expect(gridSelectionGeometry(forward.selected, spec)).toEqual({
      height: 2,
      rectangular: true,
      tileIds: [11, 12, 13, 21, 22, 23],
      width: 3,
      x: 1,
      y: 1,
    });
  });

  it("supports toggle, additive rectangle, and stable shift anchor", () => {
    const single = selectGridTile(createGridSelectionState(), { modifiers: {}, spec, tile: 11 });
    const toggled = selectGridTile(single, { modifiers: { additive: true }, spec, tile: 12 });
    const added = commitGridSelectionDrag(updateGridSelectionDrag(beginGridSelectionDrag(toggled, 20, { additive: true }), { spec, tile: 21 }));
    const ranged = selectGridTile(added, { modifiers: { range: true }, spec, tile: 23 });

    expect(toggled.selected).toEqual([11, 12]);
    expect(added.selected).toEqual([11, 12, 20, 21]);
    expect(ranged.selected).toEqual([11, 12, 13, 21, 22, 23]);
  });

  it("cancels a transient drag without changing the committed selection", () => {
    const selected = selectGridTile(createGridSelectionState(), { modifiers: {}, spec, tile: 7 });
    const dragging = updateGridSelectionDrag(beginGridSelectionDrag(selected, 20, {}), { spec, tile: 32 });

    expect(cancelGridSelectionDrag(dragging)).toEqual(selected);
  });
});
