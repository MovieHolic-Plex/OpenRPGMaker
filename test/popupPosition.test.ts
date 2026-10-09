import { describe, expect, it } from "vitest";
import { anchoredPopupPosition } from "@/editor/panels/popupPosition";

describe("anchoredPopupPosition", () => {
  it("keeps a docked assistant menu inside the viewport instead of its clipped host", () => {
    // Break: the menu was absolutely positioned inside an overflow:hidden side host.
    expect(anchoredPopupPosition(
      { left: 1450, right: 1482, top: 100, bottom: 132 },
      { width: 220, height: 360 },
      { width: 1600, height: 900 },
    )).toEqual({ left: 1262, top: 136 });
  });

  it("opens above the anchor when there is no room below", () => {
    expect(anchoredPopupPosition(
      { left: 700, right: 732, top: 760, bottom: 792 },
      { width: 200, height: 300 },
      { width: 800, height: 820 },
    )).toEqual({ left: 532, top: 456 });
  });
});
