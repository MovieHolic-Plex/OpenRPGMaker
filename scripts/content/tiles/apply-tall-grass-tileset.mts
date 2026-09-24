// Bake the tall grass E/F/G definitions (ensureForestTallGrass) into the shipped forest tileset data.
// Usage: npx vite-node --script scripts/content/tiles/apply-tall-grass-tileset.mts
// Files: src/assets/forestHarmonyTileset.json, src/assets/climateVillageTilesets.json (shared base + climate names),
//        tiledata/forest-villages/diverse/catalog.json and authored.json (the tileset the climate sheets are baked from).
// Projects and region snapshots saved before this pick the groups up on load (ensureBundledTilesets).
import fs from "node:fs";
import { ensureForestTallGrass, FOREST_TALL_GRASS_KINDS } from "../../../src/project/defaults/forestTallGrass";
import type { TilesetDef } from "../../../src/project/types";

function rewrite(file: string, edit: (json: any) => boolean): void {
  const text = fs.readFileSync(file, "utf8");
  const json = JSON.parse(text);
  const changed = edit(json);
  if (changed) fs.writeFileSync(file, JSON.stringify(json) + (text.endsWith("\n") ? "\n" : ""));
  console.log(changed ? "patched" : "unchanged", file);
}

rewrite("src/assets/forestHarmonyTileset.json", t => ensureForestTallGrass(t as TilesetDef));
for (const file of ["tiledata/forest-villages/diverse/catalog.json", "tiledata/forest-villages/diverse/authored.json"]) {
  if (fs.existsSync(file)) rewrite(file, c => ensureForestTallGrass(c.tileset as TilesetDef));
}

const CLIMATE_GRASS: Record<string, string> = { snow: "서리 내린", volcano: "재 덮인", desert: "마른", autumn: "단풍 든" };
rewrite("src/assets/climateVillageTilesets.json", data => {
  const view = { ...data.base, id: "forest_harmony_snow", name: "", image: { type: "bundled", id: "tex_forest_harmony_snow" }, count: data.base.terrain.length } as TilesetDef;
  const changed = ensureForestTallGrass(view);
  for (const key of ["autotileGroups", "tileGroups", "tileMeta", "passability", "priority", "terrain"] as const) data.base[key] = view[key];
  let named = false;
  for (const [kind, climate] of Object.entries<any>(data.climates)) {
    for (const info of FOREST_TALL_GRASS_KINDS) {
      const name = `${CLIMATE_GRASS[kind]} ${info.name}`;
      if (climate.autotileNames[info.groupId] !== name) { climate.autotileNames[info.groupId] = name; named = true; }
    }
  }
  return changed || named;
});
