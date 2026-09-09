import { describe, expect, it } from "vitest";
import { defaultTilesets } from "@/project/defaults/defaultAssets";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { searchResources } from "@/assets/resourceSearch";
import { animationFrameForTile } from "@/project/defaults/chipsetAnimation";
import { CHIPSET_LABEL_CORRECTIONS, seedChipsetLabelCorrections } from "@/project/defaults/chipsetLabelCorrections";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

describe("approved chipset corrections", () => {
  it("finds stained glass rather than gems after metadata seeding", () => {
    const tilesets = defaultTilesets();
    ensureTilesetHarnesses({ tilesets });
    const tileset = tilesets.easyrpg_chipset_retro_house;
    expect(searchResources("tile", "스테인드 글라스", { tileset }).map(result => result.id)).toContain("tile:84");
    expect(searchResources("tile", "보석", { tileset }).map(result => result.id)).not.toContain("tile:84");
  });

  it("keeps floor runtime contracts while correcting their semantic role", () => {
    const tilesets = defaultTilesets();
    ensureTilesetHarnesses({ tilesets });
    const tileset = tilesets.easyrpg_chipset_dungeon;
    for (const tile of [78, 79]) {
      expect(tileset.tileMeta?.[tile]?.role).toBe("floor");
      expect(tileset.priority[tile]).toBe("lower");
      expect(tileset.passability[tile]).toEqual({ up: true, down: true, left: true, right: true });
    }
  });

  it("describes the mine lower row with fixed caps and a repeating center", () => {
    const tilesets = defaultTilesets();
    ensureTilesetHarnesses({ tilesets });
    const tileset = tilesets.easyrpg_chipset_dungeon;
    expect([255, 256, 257].map(tile => tileset.tileMeta?.[tile]?.repeatability)).toEqual(["fixed", "center", "fixed"]);
  });

  it("cycles the whirlpool by increasing tile ID independently of the placed frame", () => {
    for (const tile of [125, 155, 185, 215]) {
      expect([0, 250, 500, 750, 1000].map(time => animationFrameForTile(tile, time))).toEqual([125, 155, 185, 215, 125]);
    }
  });

  it("preserves user metadata when the harness is reapplied", () => {
    const tilesets = defaultTilesets();
    const tileset = tilesets.easyrpg_chipset_retro_house;
    const custom = { label: "사용자 창문", description: "직접 작성", tags: ["사용자 태그"], source: "user" as const };
    if (!tileset.tileMeta) throw new Error("missing tile metadata");
    tileset.tileMeta[84] = custom;
    ensureTilesetHarnesses({ tilesets });
    expect(tileset.tileMeta[84]).toEqual(custom);
  });

  it("keeps all approved metadata through save and load without resurrecting old tags", () => {
    const project = createBlankProject();
    const restored = deserialize(serialize(project));
    for (const correction of CHIPSET_LABEL_CORRECTIONS) {
      const tileset = Object.values(restored.tilesets).find(entry => entry.image.id === correction.textureKey);
      const meta = tileset?.tileMeta?.[correction.index];
      expect(meta?.label).toBe(correction.label);
      expect(meta?.tags).toEqual(correction.tags);
      expect(meta?.repeatability).toBe(correction.repeatability);
      expect(searchResources("tile", correction.label, { tileset }).map(result => result.id)).toContain(`tile:${correction.index}`);
    }
  });

  it("is idempotent and does not modify layout or passability", () => {
    const tilesets = defaultTilesets();
    ensureTilesetHarnesses({ tilesets });
    for (const tileset of Object.values(tilesets)) {
      const before = JSON.stringify(tileset);
      expect(seedChipsetLabelCorrections(tileset)).toBe(false);
      expect(JSON.stringify(tileset)).toBe(before);
    }
  });

  it("preserves origin-user, locked, and grafted artwork on corrected slots", () => {
    for (const protection of ["origin", "locked", "graft"] as const) {
      const tilesets = defaultTilesets();
      const tileset = tilesets.easyrpg_chipset_retro_house;
      const custom = { label: "직접 판독한 그림", description: "보존", source: "ai" as const,
        ...(protection === "origin" ? { origin: "user" as const } : {}),
        ...(protection === "locked" ? { locked: true } : {}) };
      if (!tileset.tileMeta) throw new Error("missing tile metadata");
      tileset.tileMeta[84] = custom;
      if (protection === "graft") tileset.tileGrafts = [{ targetTile: 84, sourceChipset: "tex_easyrpg_chipset_dungeon", sourceTile: 84 }];
      ensureTilesetHarnesses({ tilesets });
      expect(tileset.tileMeta[84]).toEqual(custom);
    }
  });
});
