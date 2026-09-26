// Publish the 51 Pixel Art World maps (scripts/content/paw-maps) to the host shared-content SQLite (공용 DB)
// as one local library: each map becomes a place (root → floor place → raster kit) over one uploaded atlas.
//
// Input is output/paw-maps-pack.json (gitignored; `python3 scripts/content/paw-maps/pack.py` builds it from the
// user's own PAW downloads, so no pixels live in Git). Writes tiledata/pixel-art-world/maps-shared-library-proof.json.
// Usage: node scripts/content/publish-pixel-art-world-maps.mjs [--dry]
import fs from "node:fs";
import { withTsModule } from "../ontology-ts-loader.mjs";

const LIBRARY_ID = "pixel-art-world-maps-51-local";
const TILESET_ID = "shared_paw_maps51";
const DRY = process.argv.includes("--dry");
const pack = JSON.parse(fs.readFileSync("output/paw-maps-pack.json", "utf8"));
const count = Math.ceil(pack.count / 8) * 8;
const tileAt = (i) => pack.tiles[i] ?? { passage: "passable", layer: "lower" };
const open = (ok) => ({ up: ok, down: ok, left: ok, right: ok });

const tileset = {
  id: TILESET_ID, name: "Pixel Art World · 맵 51종 (외부·가정·시설·특수)", kind: "custom",
  image: { type: "uploaded", id: `${TILESET_ID}_image` }, tileSize: 32, tilesPerRow: 8, count,
  passability: Array.from({ length: count }, (_, i) => open(tileAt(i).passage === "passable")),
  priority: Array.from({ length: count }, (_, i) => tileAt(i).layer),
  terrain: Array(count).fill(0),
  tileMeta: Array.from({ length: count }, (_, i) => ({ label: `맵51 ${i}`, description: "Pixel Art World 맵 51종에서 잘라 낸 칸",
    defaultLayer: tileAt(i).layer, passage: tileAt(i).passage, source: "imported" })),
  tileGroups: [], autotileGroups: [], referenceDocuments: [], structureKits: [],
};
const height = (count / 8) * 32;
const lib = { version: 1, roots: [], places: {}, tilesets: { [TILESET_ID]: tileset },
  assets: { [`${TILESET_ID}_image`]: { id: `${TILESET_ID}_image`, name: tileset.name, kind: "chipset", dataUrl: pack.atlas,
    meta: { tileSize: 32, width: 256, height, frameWidth: 32, frameHeight: 32, frames: count } } },
  maps: {}, previews: {}, regions: {}, sourceProjectId: LIBRARY_ID };

for (const m of pack.maps) {
  const slug = m.id.replace(/[^a-z0-9]+/g, "_");
  const floor = `shared_floor_paw51_${slug}`, root = `shared_paw51_${slug}`, kit = `raster_paw51_${slug}`;
  const w = m.width, h = m.height;
  tileset.structureKits.push({ id: kit, name: m.name, kind: "section", width: w, height: h,
    rows: Array.from({ length: h }, (_, y) => ({ tiles: m.lowerTiles.slice(y * w, (y + 1) * w), upperTiles: m.upperTiles.slice(y * w, (y + 1) * w) })),
    learnedFrom: { mapId: floor, x: 0, y: 0, width: w, height: h } });
  lib.maps[floor] = { id: floor, name: m.name, width: w, height: h, tileSize: 32, tilesetId: TILESET_ID,
    lowerTiles: m.lowerTiles, upperTiles: m.upperTiles, events: [] };
  const tags = ["그림체:Pixel Art World", ...m.tags, `용도:${m.usage}`];
  const head = { name: m.name, revision: 1, tags, provenance: { origin: "ai", sourceId: m.id }, kind: "facility", layout: "manual",
    referenceDocuments: [{ id: `paw51-${slug}`, name: "구성 메모", description: m.note || m.name,
      documents: [{ id: "note", name: "구성.md", markdown: `# ${m.name}\n\n${m.note}\n\n사용 시트: ${m.sheets.join(", ")}\n` }], images: [] }] };
  lib.places[floor] = { id: floor, ...head, children: [], connections: [],
    ports: [{ x: m.port.x, y: m.port.y, id: `entry-${slug}`, name: "입구" }], exterior: { tilesetId: TILESET_ID, kitId: kit } };
  lib.places[root] = { id: root, ...head, children: [{ id: `child-${slug}`, source: { kind: "place", id: floor }, x: 0, y: 0, level: 1 }],
    ports: [], connections: [] };
  lib.roots.push(root);
  lib.previews[floor] = lib.previews[root] = m.preview;
}

const summary = { id: LIBRARY_ID, tileset: TILESET_ID, tiles: count, atlasSha: pack.atlasSha, places: lib.roots.length,
  placeRecords: Object.keys(lib.places).length, maps: Object.fromEntries(pack.maps.map((m) => [m.id, `${m.width}×${m.height}`])),
  bytes: JSON.stringify(lib).length };
if (DRY) { console.log(JSON.stringify(summary, null, 1)); process.exit(0); }
await withTsModule("scripts/lib/sharedContentSqlite.ts", "publish-paw-maps.mjs", async (api) => {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(api.sharedContentFile(), { readOnly: true });
  const expected = db.prepare("SELECT revision FROM content_libraries WHERE id=?").get(LIBRARY_ID)?.revision ?? null;
  db.close();
  const receipt = api.publishSharedContent(LIBRARY_ID, lib, expected);
  const again = api.readSharedContent().libraries[LIBRARY_ID];
  const ok = JSON.stringify(again) === JSON.stringify(lib);
  if (!ok) throw new Error("reloaded library differs from the published one");
  const proof = { ...summary, file: receipt.file, revision: receipt.revision, reloaded: ok, publishedAt: new Date().toISOString() };
  fs.writeFileSync("tiledata/pixel-art-world/maps-shared-library-proof.json", JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify({ id: LIBRARY_ID, revision: receipt.revision, places: summary.places, bytes: summary.bytes, reloaded: ok }));
});
