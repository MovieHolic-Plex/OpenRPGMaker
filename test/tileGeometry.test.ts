import { describe, expect, it } from "vitest";
import { mapTileSize } from "@/project/tileGeometry";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { resetCullableTiles, syncTileCulling, trackCullableTile } from "@/player/playSceneTileCulling";

describe("per-map tile geometry", () => {
  it("keeps legacy defaults without changing the geometry of another map", () => {
    expect(mapTileSize(undefined)).toBe(16);
    expect(mapTileSize({ tileSize: 32 })).toBe(32);
    expect(mapTileSize({ tileSize: 16 }, { tileSize: 32 })).toBe(16);
    expect(mapTileSize({}, { tileSize: 32 })).toBe(32);
    expect(mapTileSize({ tileSize: NaN })).toBe(16);
    expect(characterSpriteX(2)).toBe(40);
    expect(characterSpriteY(2)).toBe(48);
  });

  it("places feet and wide bodies on the 32px grid", () => {
    expect(characterSpriteX(2, 32)).toBe(80);
    expect(characterSpriteY(2, 32)).toBe(96);
    expect(footprintSpriteX(2, { width: 2, height: 3 }, 32)).toBe(96);
  });

  it("recomputes culling when the same scene switches map sizes", () => {
    const host = {};
    const image = () => ({ visible: true, setVisible(value: boolean) { this.visible = value; } });
    const near = image(), far = image();
    trackCullableTile(host, near, 10, 10);
    trackCullableTile(host, far, 20, 20);
    const viewport = { x: 320, y: 320, width: 32, height: 32 };
    syncTileCulling(host, viewport, 32);
    expect([near.visible, far.visible]).toEqual([true, false]);
    syncTileCulling(host, viewport, 16);
    expect([near.visible, far.visible]).toEqual([false, true]);
    resetCullableTiles(host);
  });
});
