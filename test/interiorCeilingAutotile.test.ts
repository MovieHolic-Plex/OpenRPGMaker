import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { seedInteriorCeilingAutotile, interiorCeilingQuarterKit } from "@/project/defaults/interiorCeilingAutotile";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";

const tileset = () => createBlankProject().tilesets.easyrpg_chipset_interior!;
const map = (rows: number[][]) => ({ width: rows[0]!.length, height: rows.length, lowerTiles: rows.flat() });

describe("native interior ceiling", () => {
  it("seeds the ceiling without running the room generator, idempotently", () => {
    const ts = tileset();
    expect(ts.autotileGroups?.filter(g => g.memberTileIds.includes(430))).toHaveLength(1);
    expect(seedInteriorCeilingAutotile(ts)).toBe(false);
  });

  it("closes both sides of one-cell horizontal and vertical runs", () => {
    const ts = tileset();
    const horizontal = map([[72, 72, 72], [399, 400, 401], [72, 72, 72]]);
    expect(chipsetQuarterComposition(horizontal, ts, 1, 1)?.sources.map(s => s.tile))
      .toEqual([400, 400, 460, 460]);
    const vertical = map([[72, 399, 72], [72, 429, 72], [72, 459, 72]]);
    expect(chipsetQuarterComposition(vertical, ts, 1, 1)?.sources.map(s => s.tile))
      .toEqual([429, 431, 429, 431]);
  });

  it("uses only the missing diagonal's concave quarter", () => {
    const hole = map([[430, 430, 430], [430, 371, 430], [430, 430, 72]]);
    expect(chipsetQuarterComposition(hole, tileset(), 1, 1)?.sources.map(s => s.tile))
      .toEqual([430, 430, 430, 371]);
  });

  it("preserves isolated art and declines foreign textures and edited grammar", () => {
    const ts = tileset();
    expect(chipsetQuarterComposition(map([[72, 72, 72], [72, 369, 72], [72, 72, 72]]), ts, 1, 1)).toBeNull();
    expect(interiorCeilingQuarterKit({ ...ts, image: { type: "bundled", id: "tex_easyrpg_chipset_dungeon" } }, 430)).toBeNull();
    const group = ts.autotileGroups!.find(g => g.memberTileIds.includes(430))!;
    group.variantMap["0"] = 430;
    expect(interiorCeilingQuarterKit(ts, 430)).toBeNull();
    expect(seedInteriorCeilingAutotile(ts)).toBe(false);
    expect(group.variantMap["0"]).toBe(430);
  });

  it("does not add a competing group to custom ceiling members", () => {
    const ts = tileset();
    ts.autotileGroups = [{ id: "user-ceiling", name: "Custom", memberTileIds: [430], variantMap: { "0": 430 } }];
    expect(seedInteriorCeilingAutotile(ts)).toBe(false);
    expect(ts.autotileGroups).toHaveLength(1);
    expect(interiorCeilingQuarterKit(ts, 430)).toBeNull();
  });
});
