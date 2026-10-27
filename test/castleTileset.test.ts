import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { registerTilesetTextureFrames } from "@/assets/bundled";
import { CASTLE_TILESET_TEXTURE_KEY } from "@/project/defaults/constants";

describe("bundled Castle atlas", () => {
  // 「옛 프로젝트에 성채 아틀라스를 심는다」 사례는 뺐다 — OpenGameArt 성채 PNG·번들 정의는 2026-10-07 저작권 정리로 지워졌다(ensureBundledTilesets 가 더는 심지 않는다).
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

  // 「성채 PNG·출처 고지를 웹 내보내기에 싣는다」 사례도 같은 정리로 뺐다 — 내보낼 성채 그림이 없다.
});
