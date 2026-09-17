import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTilesetImage, clearTilesetImageCache, GRAFT_EVIDENCE_WAIT_MS } from "@/ai/toolImageCanvas";
import { clearTileGraftImageCache, awaitGraftedTilesetImageUrl } from "@/assets/tileGraftImageCache";
import { tilesetBaseImageUrl } from "@/editor/tilesetImage";
import { createBlankProject } from "@/project/defaults";
import { installToolImageRasterDom, installToolImageUrlHoldGate } from "./toolImageRasterDom";

let restore: () => void;
beforeEach(() => {
  restore = installToolImageRasterDom();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  restore();
  vi.useRealTimers();
  clearTilesetImageCache();
  clearTileGraftImageCache();
});

function graftedTileset() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const tileset = project.tilesets[map.tilesetId]!;
  tileset.tileGrafts = [{
    targetTile: 0, sourceChipset: "tex_easyrpg_chipset_interior", sourceTile: 100,
  }];
  return tileset;
}

describe("cold graft evidence", () => {
  it("waits for source loading and returns the composite on the first request", async () => {
    const tileset = graftedTileset();
    const gate = installToolImageUrlHoldGate("easyrpg-chipset-interior");
    let settled = false;
    const pending = loadTilesetImage(tileset).then(image => {
      settled = true;
      return image;
    });
    await gate.sourceHeld;
    expect(settled).toBe(false);
    gate.release();
    const image = await pending;
    const exact = await awaitGraftedTilesetImageUrl(tileset, tilesetBaseImageUrl(tileset));
    expect(image.src).toBe(exact);
    expect(image.src).not.toBe(tilesetBaseImageUrl(tileset));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports failure for a missing source without delivering the base image", async () => {
    const tileset = graftedTileset();
    tileset.tileGrafts![0]!.sourceChipset = "missing-chipset";
    await expect(loadTilesetImage(tileset)).rejects.toThrow("bake failed or incomplete");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out held I/O but reuses the completed bake on retry", async () => {
    const tileset = graftedTileset();
    const gate = installToolImageUrlHoldGate("easyrpg-chipset-interior");
    const rejected = expect(loadTilesetImage(tileset)).rejects.toThrow("bake timed out");
    await gate.sourceHeld;
    await vi.advanceTimersByTimeAsync(GRAFT_EVIDENCE_WAIT_MS);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    gate.release();
    const exact = await awaitGraftedTilesetImageUrl(tileset, tilesetBaseImageUrl(tileset));
    expect((await loadTilesetImage(tileset)).src).toBe(exact);
    expect(vi.getTimerCount()).toBe(0);
  });
});
