import { describe, expect, it } from "vitest";
import { computeEventMarkerTooltipPlacement } from "@/editor/eventMarkerTooltipPlacement";

const tip = { width: 200, height: 80 } as const;
const host = { width: 1000, height: 700 } as const;

describe("computeEventMarkerTooltipPlacement", () => {
  it("anchors the bubble at the tile's top-right", () => {
    const tile = { x: 400, y: 300, width: 32, height: 32 };
    const placement = computeEventMarkerTooltipPlacement({ tile, tip, host });

    expect(placement.anchor).toBe("top-right");
    expect(placement.left).toBeGreaterThanOrEqual(tile.x + tile.width);
    expect(placement.top + tip.height).toBeLessThanOrEqual(tile.y);
  });

  it("flips left when the right edge has no room", () => {
    const tile = { x: 940, y: 300, width: 32, height: 32 };
    const placement = computeEventMarkerTooltipPlacement({ tile, tip, host });

    expect(placement.anchor).toBe("top-left");
    expect(placement.left + tip.width).toBeLessThanOrEqual(tile.x);
    expect(placement.left).toBeGreaterThanOrEqual(0);
  });

  it("flips below when the top edge has no room", () => {
    const tile = { x: 400, y: 4, width: 32, height: 32 };
    const placement = computeEventMarkerTooltipPlacement({ tile, tip, host });

    expect(placement.anchor).toBe("bottom-right");
    expect(placement.top).toBeGreaterThanOrEqual(tile.y + tile.height);
    expect(placement.top + tip.height).toBeLessThanOrEqual(host.height);
  });

  it("keeps the bubble inside the host at the top-right corner", () => {
    const tile = { x: 980, y: 2, width: 32, height: 32 };
    const placement = computeEventMarkerTooltipPlacement({ tile, tip, host });

    expect(placement.anchor).toBe("bottom-left");
    expect(placement.left).toBeGreaterThanOrEqual(0);
    expect(placement.top).toBeGreaterThanOrEqual(0);
    expect(placement.left + tip.width).toBeLessThanOrEqual(host.width);
    expect(placement.top + tip.height).toBeLessThanOrEqual(host.height);
  });
});
