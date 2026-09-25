// Publish the RPG interiors, RPG dungeons and fantasy places to the host shared-content SQLite (공용 DB) as one
// library: every map as a reviewed place (root → floor place → raster kit), the map source itself, a thumbnail, and
// the AI reference categories of its pipeline. The bundled tilesets are copied as `shared_` tilesets whose image is
// an uploaded atlas with the tile grafts and colour key already baked in, so the library stands on its own.
//
// Reads the canonical saves (output/evidence/<pipeline>/reloaded.json, written by save-rpg-*.mjs after reopening the
// .oprn-projects SQLite folder), renders every map with the original and the shared tileset and refuses to publish
// unless both renders are pixel-identical. Writes tiledata/rpg-places/shared-library-proof.json.
// Usage: DEV_URL=http://127.0.0.1:<port> node scripts/content/publish-rpg-places-shared-library.mjs [--dry]
import fs from "node:fs";
import { chromium } from "playwright";
import { withTsModule } from "../ontology-ts-loader.mjs";

const LIBRARY_ID = "oprn-rpg-fantasy-places-20260925";
const DRY = process.argv.includes("--dry");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const projects = Object.fromEntries(["rpg-interiors", "rpg-dungeons", "rpg-places"].map((d) => [d, read(`output/evidence/${d}/reloaded.json`)]));
const catalogs = Object.fromEntries(["rpg-interiors", "rpg-dungeons", "rpg-places"].map((d) => [d, read(`tiledata/${d}/catalog.json`)]));
const plansOf = (c) => (Array.isArray(c.plans) ? c.plans : Object.values(c.plans));

// Source tileset → shared copy. The plain dungeon sheet folds into the stone copy (same numbering below 480, the
// stone copy only adds grafts after it). The interiors save carries the newest bundled definitions.
const SOURCE = projects["rpg-interiors"].tilesets;
const DUNGEON_SOURCE = projects["rpg-dungeons"].tilesets;
const SHARED = {
  tibo_interior_expanded: { id: "shared_rpg_tibo_interior", name: "실내 확장 · Tibo (RPG 장소 공용)", def: SOURCE.tibo_interior_expanded, docs: /^(rpg-interiors-(?!ship|sewer)|fantasy-interiors)/, from: SOURCE.tibo_interior_expanded },
  easyrpg_chipset_ship: { id: "shared_rpg_ship", name: "배 · EasyRPG + Tibo 짐 (RPG 장소 공용)", def: SOURCE.easyrpg_chipset_ship, docs: /^rpg-interiors-ship/, from: SOURCE.easyrpg_chipset_ship },
  oprn_dungeon_stone: { id: "shared_rpg_dungeon_stone", name: "던전 · EasyRPG + 이식 (RPG 장소 공용)", def: DUNGEON_SOURCE.oprn_dungeon_stone, docs: /^(rpg-dungeons-|fantasy-dungeon-rooms|rpg-interiors-sewer-prison)/, from: SOURCE.easyrpg_chipset_dungeon },
  oprn_dungeon_cave: { id: "shared_rpg_dungeon_cave", name: "던전 · 동굴 재칠 (RPG 장소 공용)", def: DUNGEON_SOURCE.oprn_dungeon_cave, owner: "shared_rpg_dungeon_stone" },
  oprn_dungeon_sea: { id: "shared_rpg_dungeon_sea", name: "던전 · 해저 재칠 (RPG 장소 공용)", def: DUNGEON_SOURCE.oprn_dungeon_sea, owner: "shared_rpg_dungeon_stone" },
  oprn_dungeon_desert: { id: "shared_rpg_dungeon_desert", name: "던전 · 사막 재칠 (RPG 장소 공용)", def: DUNGEON_SOURCE.oprn_dungeon_desert, owner: "shared_rpg_dungeon_stone" },
  oprn_dungeon_lair: { id: "shared_rpg_dungeon_lair", name: "던전 · 용의 둥지 재칠 (RPG 장소 공용)", def: DUNGEON_SOURCE.oprn_dungeon_lair, owner: "shared_rpg_dungeon_stone" },
  forest_harmony: { id: "shared_rpg_forest_harmony", name: "숲의 조화 (RPG 장소 공용)", def: SOURCE.forest_harmony, docs: /^fantasy-exteriors/, from: SOURCE.forest_harmony },
};
const ALIAS = { easyrpg_chipset_dungeon: "oprn_dungeon_stone" };
const sharedOf = (tilesetId) => SHARED[ALIAS[tilesetId] ?? tilesetId];

// Classification tags (spatialPlaceClassification: 그림체 / 장소유형 / 공간형태 / 용도).
function tags(pipeline, plan, tilesetId) {
  const style = tilesetId === "tibo_interior_expanded" ? "Tibo" : "EasyRPG";
  const t = (category, environment, ...purposes) => [`그림체:${style}`, `장소유형:${category}`, `공간형태:${environment}`, ...purposes.map((p) => `용도:${p}`), "RPG 판타지"];
  const id = plan.id;
  if (pipeline === "rpg-interiors") {
    if (plan.group === "ship") return t("이동수단", "건물 내부", "항해");
    if (plan.group === "sewer") return t("던전·유적", "지하", "탐험", "감옥");
    const purpose = /inn/.test(id) ? "숙박" : /home|house|cabin/.test(id) ? "주택" : { castle: "성", leisure: "오락", civic: "공공시설", staples: "시설" }[plan.group] ?? "시설";
    return t("건물·시설", "건물 내부", purpose);
  }
  if (pipeline === "rpg-dungeons") {
    const env = plan.series === "sunken" ? "수중" : /roof/.test(id) ? "실외" : plan.series === "tower" || plan.series === "demon" ? "건물 내부" : "지하";
    return t("던전·유적", env, "탐험");
  }
  if (/shop-street/.test(id)) return t("마을·도시", "실외", "상점");
  if (/ruined-castle/.test(id)) return t("던전·유적", "실외", "탐험");
  if (/jail|demon-throne/.test(id)) return t("던전·유적", "지하", "탐험");
  if (/shop|smithy/.test(id)) return t("건물·시설", "건물 내부", "상점");
  if (/wizard/.test(id)) return t("건물·시설", "건물 내부", "시설");
  return t("건물·시설", "건물 내부", "성");
}

const entries = [];
for (const [pipeline, project] of Object.entries(projects)) {
  for (const plan of plansOf(catalogs[pipeline])) {
    const map = project.maps[plan.id];
    if (!map) throw new Error(`${pipeline}: ${plan.id} missing from the canonical save`);
    if (!sharedOf(map.tilesetId)) throw new Error(`${plan.id}: no shared tileset for ${map.tilesetId}`);
    entries.push({ pipeline, plan, map });
  }
}

const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
let baked;
try {
  const page = await b.newPage();
  await page.route("**/__rpg-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9823") + "/__rpg-render");
  baked = await page.evaluate(async ({ tilesets, maps }) => {
    const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
    const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
    const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
    const { createTransparentColorKeyCanvas } = await import("/src/assets/chipsetTransparency.ts");
    const load = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im; };
    const atlases = {}, sheets = {};
    for (const [id, t] of Object.entries(tilesets)) {
      const im = await load((await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t));
      const keyed = t.transparentColor ? createTransparentColorKeyCanvas({ image: { ...t.image }, transparentColor: t.transparentColor }, im) ?? im : im;
      const c = document.createElement("canvas");
      c.width = keyed.width; c.height = keyed.height;
      c.getContext("2d").drawImage(keyed, 0, 0);
      atlases[id] = { dataUrl: c.toDataURL("image/png"), width: c.width, height: c.height };
      sheets[id] = keyed;
    }
    const pixels = (c) => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const out = {};
    for (const { id, map, source, shared } of maps) {
      const draw = async (sheet, t) => { const c = document.createElement("canvas"); c.width = map.width * 16; c.height = map.height * 16; drawMapTileLayers(c.getContext("2d"), sheet, map, t, 1); return c; };
      const a = await draw(sheets[source], tilesets[source]);
      const bSheet = await load(atlases[source].dataUrl);
      const bCanvas = await draw(bSheet, { ...shared, tileGrafts: undefined, transparentColor: undefined });
      const pa = pixels(a), pb = pixels(bCanvas);
      let diff = 0; for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) diff++;
      // thumbnail: long side ≤ 480
      const k = Math.min(1, 480 / Math.max(a.width, a.height));
      const t = document.createElement("canvas"); t.width = Math.round(a.width * k); t.height = Math.round(a.height * k);
      const g = t.getContext("2d"); g.imageSmoothingEnabled = k < 1; g.drawImage(a, 0, 0, t.width, t.height);
      out[id] = { diff, preview: t.toDataURL("image/png") };
    }
    return { atlases, maps: out };
  }, {
    tilesets: Object.fromEntries([...new Set(entries.map((e) => ALIAS[e.map.tilesetId] ?? e.map.tilesetId))].map((k) => [k, SHARED[k].def])),
    maps: entries.map((e) => { const k = ALIAS[e.map.tilesetId] ?? e.map.tilesetId; return { id: e.plan.id, map: e.map, source: k, shared: SHARED[k].def }; }),
  });
} finally {
  await b.close();
}
const mismatched = Object.entries(baked.maps).filter(([, v]) => v.diff).map(([id, v]) => `${id}:${v.diff}`);
if (mismatched.length) throw new Error(`shared atlas renders differ from the original: ${mismatched.join(", ")}`);

const lib = { version: 1, roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, previews: {}, regions: {},
  sourceProjectId: Object.values(projects).map((p) => p.meta?.projectId ?? p.meta?.id ?? "").filter(Boolean).join("+") || "oprn-rpg-places-20260925" };
for (const [key, s] of Object.entries(SHARED)) {
  if (!baked.atlases[key]) continue;
  const def = structuredClone(s.def);
  delete def.tileGrafts; delete def.transparentColor; delete def.referenceSourceTilesetId;
  def.id = s.id; def.name = s.name;
  const assetId = `${s.id}_atlas`;
  def.image = { type: "uploaded", id: assetId };
  def.referenceDocuments = s.docs ? structuredClone((s.from.referenceDocuments ?? []).filter((c) => s.docs.test(c.id))) : [];
  if (s.owner) def.referenceSourceTilesetId = s.owner;
  def.structureKits = [...(def.structureKits ?? [])];
  lib.tilesets[s.id] = def;
  const atlas = baked.atlases[key];
  lib.assets[assetId] = { id: assetId, kind: "tileset", name: s.name, dataUrl: atlas.dataUrl, meta: { width: atlas.width, height: atlas.height, tileSize: def.tileSize ?? 16, source: `번들 ${key}${s.def.tileGrafts?.length ? " + 이식 " + s.def.tileGrafts.length + "칸" : ""}을 구운 그림` } };
}
for (const { pipeline, plan, map } of entries) {
  const s = sharedOf(map.tilesetId), floor = `shared_floor_rpg_${plan.id}`, root = `shared_rpg_${plan.id}`, kit = `raster_rpg_${plan.id}`;
  lib.tilesets[s.id].structureKits.push({ id: kit, name: plan.name, kind: "section", width: map.width, height: map.height,
    rows: Array.from({ length: map.height }, (_, y) => ({ tiles: map.lowerTiles.slice(y * map.width, (y + 1) * map.width), upperTiles: map.upperTiles.slice(y * map.width, (y + 1) * map.width) })),
    learnedFrom: { mapId: floor, x: 0, y: 0, width: map.width, height: map.height } });
  lib.maps[floor] = { ...structuredClone(map), id: floor, name: plan.name, tilesetId: s.id };
  const t = tags(pipeline, plan, map.tilesetId === "easyrpg_chipset_dungeon" ? "oprn_dungeon_stone" : map.tilesetId);
  const [ex, ey] = plan.entry ?? [0, 0];
  lib.places[floor] = { id: floor, name: plan.name, revision: 1, tags: t, provenance: { origin: "builtin" }, kind: "facility", layout: "manual", children: [], connections: [],
    ports: [{ x: ex, y: ey, id: `entry-rpg-${plan.id}`, name: "입구" }], exterior: { tilesetId: s.id, kitId: kit } };
  lib.places[root] = { id: root, name: plan.name, revision: 1, tags: t, provenance: { origin: "builtin" }, kind: "facility", layout: "manual",
    children: [{ id: `child-rpg-${plan.id}`, source: { kind: "place", id: floor }, x: 0, y: 0, level: 1 }], ports: [], connections: [] };
  lib.roots.push(root);
  lib.previews[floor] = lib.previews[root] = baked.maps[plan.id].preview;
}

const summary = { id: LIBRARY_ID, places: lib.roots.length, maps: Object.keys(lib.maps).length,
  tilesets: Object.fromEntries(Object.values(lib.tilesets).map((t) => [t.id, { count: t.count, references: t.referenceDocuments.map((c) => c.id), referenceSourceTilesetId: t.referenceSourceTilesetId }])),
  bytes: JSON.stringify(lib).length, renderCheck: `${entries.length} maps pixel-identical with the shared atlas` };
if (DRY) { console.log(JSON.stringify(summary, null, 1)); process.exit(0); }
await withTsModule("scripts/lib/sharedContentSqlite.ts", "publish-rpg-places.mjs", async (api) => {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(api.sharedContentFile(), { readOnly: true });
  const expected = db.prepare("SELECT revision FROM content_libraries WHERE id=?").get(LIBRARY_ID)?.revision ?? null;
  db.close();
  const receipt = api.publishSharedContent(LIBRARY_ID, lib, expected);
  const again = api.readSharedContent().libraries[LIBRARY_ID];
  const ok = JSON.stringify(again) === JSON.stringify(lib);
  if (!ok) throw new Error("reloaded library differs from the published one");
  const proof = { ...summary, file: receipt.file, revision: receipt.revision, reloaded: ok, publishedAt: new Date().toISOString() };
  fs.writeFileSync("tiledata/rpg-places/shared-library-proof.json", JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify({ id: LIBRARY_ID, revision: receipt.revision, places: summary.places, bytes: summary.bytes, reloaded: ok }));
});
