// bbox-chipsets: the effective room spec of ANY tileset, read from its metadata only (same rule as the editor tool specFor):
// roomKit role table (roomSpecOf) + chipset assembly kits (kitHandObjects) when the role table has no furniture table.
// Round 2: + object-pool pieces (objpool/<chipset>/*.png+json, grafted onto the tileset by pool.py) from $BBOX_POOL_DIR/spec.json.
import { readFileSync, existsSync } from "node:fs";
import { roomSpecOf, type HandInteriorSpec } from "../../../src/editor/handInterior/builder";
import { kitHandObjects } from "../../../src/project/roomKit";
import type { TilesetDef } from "../../../src/project/types";
const POOL = process.env.BBOX_POOL_DIR && existsSync(`${process.env.BBOX_POOL_DIR}/spec.json`) ? JSON.parse(readFileSync(`${process.env.BBOX_POOL_DIR}/spec.json`, "utf8")) : {};
export function effectiveSpec(tileset: TilesetDef | undefined): HandInteriorSpec | undefined {
  const base = roomSpecOf(tileset);
  if (!base) return undefined;
  const kits = Object.keys(base.objects).length ? {} : kitHandObjects(tileset);
  const pool = (tileset && POOL[tileset.id]?.objects) ?? {};
  return Object.keys(kits).length || Object.keys(pool).length ? { ...base, objects: { ...base.objects, ...kits, ...pool } as HandInteriorSpec["objects"] } : base;
}
/** Category of a piece for the grouped catalog: the spec's own category when the chipset has a real taxonomy (jp_city, modern_city: ~40-100 kinds),
 *  otherwise (assembly kits: one coarse "prop") the first id word after the chipset prefix, skipping the "nv" (native-demo) marker: wz-pot-hood → pot. */
const coarse = new WeakMap<object, boolean>();
export function categoryOf(id: string, o: { category?: string; category_ko?: string; tags?: readonly string[]; pool?: boolean }, S: HandInteriorSpec): { key: string; ko: string } {
  if (o.pool) return { key: `new-${o.category}`, ko: `new: ${o.category_ko ?? o.category}` };
  if (!coarse.has(S)) coarse.set(S, new Set(Object.values(S.objects).map((x: any) => x.category)).size < 8);
  if (!coarse.get(S)) return { key: o.category ?? "misc", ko: o.category_ko ?? o.category ?? "" };
  const words = id.split(/[-_]/u).slice(1).filter((w) => w !== "nv");
  return { key: words[0] ?? "misc", ko: (o.tags?.[1] ?? o.category_ko ?? "") as string };
}
