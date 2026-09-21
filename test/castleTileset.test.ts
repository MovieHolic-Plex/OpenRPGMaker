import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { registerTilesetTextureFrames } from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledResourceProfiles, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { CASTLE_TILESET_ID, CASTLE_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";
import { collectWebExportAssets } from "@/project/webExportAssets";

describe("bundled Castle atlas", () => {
  it("adds the atlas to old projects without changing maps or overwriting tile settings on reload", () => {
    const project = createBlankProject();
    const maps = structuredClone(project.maps);
    delete project.tilesets[CASTLE_TILESET_ID];
    project.resourceProfiles = project.resourceProfiles.filter(row => row.assetId !== CASTLE_TILESET_TEXTURE_KEY);
    ensureBundledTilesets(project);
    ensureBundledResourceProfiles(project);
    const castle = project.tilesets[CASTLE_TILESET_ID];
    expect(castle).toMatchObject({ kind: "custom", tileSize: 16, tilesPerRow: 32, count: 1024 });
    expect(castle.passability[770].up).toBe(true); // grass, beyond the legacy 480-cell limit
    expect(castle.passability[20].up).toBe(false); // stone wall
    castle.priority[770] = "upper";
    castle.passability[770].up = false;
    castle.tileMeta![770].label = "내 잔디";
    const authored = structuredClone(castle);
    ensureBundledTilesets(project);
    ensureBundledResourceProfiles(project);
    expect(project.tilesets[CASTLE_TILESET_ID]).toEqual(authored);
    expect(project.maps).toEqual(maps);
    expect(project.resourceProfiles.filter(row => row.assetId === CASTLE_TILESET_TEXTURE_KEY)).toEqual([
      expect.objectContaining({ tileWidth: 16, tileHeight: 16, imageWidth: 512, imageHeight: 512 }),
    ]);
  });

  it("registers complete 32-column frames, including baked texture keys", () => {
    for (const key of [CASTLE_TILESET_TEXTURE_KEY, `${CASTLE_TILESET_TEXTURE_KEY}__transparent_ff00ff`]) {
      const add = vi.fn();
      const create = vi.fn();
      const scene = {
        textures: { get: () => ({ getFrameNames: () => [], add }) },
        anims: { exists: () => false, create },
      } as unknown as Phaser.Scene;
      if (key === CASTLE_TILESET_TEXTURE_KEY) registerTilesetTextureFrames(scene, key, 1024);
      else registerTilesetTextureFrames(scene, key, 1024, 16, 32);
      expect(add).toHaveBeenCalledWith("tile_31", 0, 496, 0, 16, 16);
      expect(add).toHaveBeenCalledWith("tile_32", 0, 0, 16, 16, 16);
      expect(add).toHaveBeenCalledWith("tile_1023", 0, 496, 496, 16, 16);
      expect(add).toHaveBeenCalledWith("tile_1023_se", 0, 504, 504, 8, 8);
      expect(create).not.toHaveBeenCalled(); // RM2K water-strip indices mean something else here.
    }
  });

  it("ships the attribution notice alongside the original PNG", () => {
    const paths = collectWebExportAssets(createBlankProject()).map(asset => asset.zipPath);
    expect(paths).toContain("assets/opengameart-castle-tiles.png");
    expect(paths).toContain("assets/opengameart-castle-tiles-CREDITS.txt");
  });
});
