// The dungeon-family tileset: the bundled EasyRPG dungeon definition on one of its same-numbered pictures, with
//  - 480..488  the original grafts (Tibo chest and mine cart, town stone steps and parapet)  — kit.mjs GRAFTS
//  - 510..     the atlas parts sheet (tiledata/atlas-dungeons/parts.json, public/assets/atlas-dungeons/parts.png):
//              EasyRPG interior/ship copies, recoloured crystals and fires, the moored ship, coffins, webs, traps …
// Every family copy (stone, cave, sea, desert, lair and the atlas repaints) carries the same slots, so a piece placed
// on one theme means the same thing on every other.
import fs from "node:fs";
import { GRAFTS, GRAFT_CHIPSETS } from "./kit.mjs";

export const PARTS_FILE = "tiledata/atlas-dungeons/parts.json";
export const PARTS_TEXTURE = "tex_oprn_dungeon_parts";

export function loadParts() {
  return JSON.parse(fs.readFileSync(PARTS_FILE, "utf8"));
}

const PASS = (s) => ({ up: s.includes("u"), down: s.includes("d"), left: s.includes("l"), right: s.includes("r") });

/**
 * base: a blank project (createBlankProject), id/name/texture of the copy, drawn: slots the repaint drew over with
 * its own solid piece ([tile, label]).
 */
export function dungeonFamily(base, { id, name, texture, drawn = [], parts = loadParts() }) {
  const TIBO = base.tilesets.tibo_interior_expanded, TOWN = base.tilesets.easyrpg_chipset_combined_town;
  const t = structuredClone(base.tilesets.easyrpg_chipset_dungeon);
  delete t.referenceDocuments;
  Object.assign(t, { id, name, image: { type: "bundled", id: texture } });
  t.tileGrafts = [
    ...Object.values(GRAFTS).map((g) => ({ sourceChipset: GRAFT_CHIPSETS[g.chipset ?? "tibo"], sourceTile: g.source, targetTile: g.target })),
    ...parts.parts.map((p, i) => ({ sourceChipset: PARTS_TEXTURE, sourceTile: i, targetTile: p.tile })),
  ];
  const last = parts.parts.length ? parts.parts.at(-1).tile : 509;
  t.count = Math.ceil((last + 1) / 30) * 30;
  while (t.terrain.length < t.count) t.terrain.push(0);
  while (t.priority.length < t.count) t.priority.push("lower");
  while (t.passability.length < t.count) t.passability.push({ up: false, down: false, left: false, right: false });
  while (t.tileMeta.length < t.count) t.tileMeta.push({ label: "미사용", source: "unknown" });
  for (const g of Object.values(GRAFTS)) {
    const src = g.chipset === "town" ? TOWN : TIBO;
    t.passability[g.target] = structuredClone(src.passability[g.source]);
    t.priority[g.target] = "lower";
    t.tileMeta[g.target] = { label: `${g.label} · ${g.chipset === "town" ? "EasyRPG 마을" : "Tibo"} ${g.source} 이식`, source: "custom" };
  }
  for (const p of parts.parts) {
    t.passability[p.tile] = PASS(p.pass);
    t.priority[p.tile] = p.layer === "lower" ? "lower" : "upper";
    t.tileMeta[p.tile] = { label: `${p.label} · 조각 ${p.tile}`, description: p.source, source: "custom" };
  }
  // Slots this repaint draws over with its own piece (the desert sheet's coffin sits in the unused rail slots).
  for (const [tile, label] of drawn) {
    t.passability[tile] = { up: false, down: false, left: false, right: false };
    t.priority[tile] = "lower";
    t.tileMeta[tile] = { ...structuredClone(t.tileMeta[145]), label, source: "custom" };
  }
  return t;
}
