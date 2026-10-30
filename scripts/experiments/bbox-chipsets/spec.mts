// bbox-chipsets: the effective room spec of ANY tileset, read from its metadata only (same rule as the editor tool specFor):
// roomKit role table (roomSpecOf) + chipset assembly kits (kitHandObjects) when the role table has no furniture table.
import { roomSpecOf, type HandInteriorSpec } from "../../../src/editor/handInterior/builder";
import { kitHandObjects } from "../../../src/project/roomKit";
import type { TilesetDef } from "../../../src/project/types";
export function effectiveSpec(tileset: TilesetDef | undefined): HandInteriorSpec | undefined {
  const base = roomSpecOf(tileset);
  if (!base) return undefined;
  const kits = Object.keys(base.objects).length ? {} : kitHandObjects(tileset);
  return Object.keys(kits).length ? { ...base, objects: { ...base.objects, ...kits } as HandInteriorSpec["objects"] } : base;
}
