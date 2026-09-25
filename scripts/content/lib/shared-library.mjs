// Generic publisher for the host shared-content SQLite (공용 DB): one library per content pipeline, holding
//   - 장소 (places): every building / room / dungeon floor as a reviewed place (root → floor place → raster kit), and
//   - 지역 (regions): every town / field / world map as a completed-map region (settlement or terrain),
// on `shared_` copies of the bundled tilesets whose image is an uploaded atlas with the grafts and colour key baked in.
// Refuses to publish unless every map renders pixel-identically with the original and the shared tileset.
// (오브젝트 are not here: they go to the bundled catalog, tiledata/<pipeline>/shared-objects.json.)
// Extracted from scripts/content/publish-rpg-places-shared-library.mjs (2026-09-25).
//
// Usage (see publish-rpg-places-shared-library.mjs for a full caller):
//   import { publishLibrary } from "./lib/shared-library.mjs";
//   await publishLibrary({
//     id: "oprn-atlas-towns-20260925", sourceProjectId, devUrl, proof: "tiledata/<pipeline>/shared-library-proof.json",
//     tilesets: { forest_harmony: { id: "shared_atlas_towns_forest", name: "…", def, docs: /^field-routes-/ (optional), owner: "shared_…" (optional) } },
//     entries: [{ id: "town-x", name: "…", map, key: "forest_harmony", as: "region", regionKind: "settlement", tags: [...],
//                 entry: [x, y], rules: ["…"], limitations: "…" },
//               { id: "inn-x", name: "…", map, key: "tibo_interior_expanded", as: "place", tags: [...], entry: [x, y] }],
//     dry: false,
//   });
// Tags follow spatialPlaceClassification: 그림체:<Tibo|EasyRPG> · 장소유형:<마을·도시|자연|건물·시설|던전·유적|이동수단> ·
// 공간형태:<실외|건물 내부|지하|수중> · 용도:<…>.
import fs from "node:fs";
import { chromium } from "playwright";
import { withTsModule } from "../../ontology-ts-loader.mjs";

export async function publishLibrary({ id, sourceProjectId, devUrl, tilesets, entries, proof, dry = false }) {
  for (const e of entries) {
    if (!tilesets[e.key]) throw new Error(`${e.id}: no shared tileset for key ${e.key}`);
    if (e.as !== "place" && e.as !== "region") throw new Error(`${e.id}: as must be place or region`);
    if (!/^[a-z0-9-]+$/.test(e.id)) throw new Error(`${e.id}: id must be lower-case kebab`);
  }
  const used = [...new Set(entries.map((e) => e.key))];
  const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
  let baked;
  try {
    const page = await b.newPage();
    await page.route("**/__shared-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
    await page.goto((devUrl ?? process.env.DEV_URL) + "/__shared-render");
    baked = await page.evaluate(async ({ tilesets, maps }) => {
      const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
      const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
      const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
      const { createTransparentColorKeyCanvas } = await import("/src/assets/chipsetTransparency.ts");
      const load = async (src) => { const im = new Image(); im.src = src; await im.decode(); return im; };
      const atlases = {}, sheets = {};
      for (const [key, t] of Object.entries(tilesets)) {
        const im = await load((await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t));
        const keyed = t.transparentColor ? createTransparentColorKeyCanvas({ image: { ...t.image }, transparentColor: t.transparentColor }, im) ?? im : im;
        const c = document.createElement("canvas"); c.width = keyed.width; c.height = keyed.height;
        c.getContext("2d").drawImage(keyed, 0, 0);
        atlases[key] = { dataUrl: c.toDataURL("image/png"), width: c.width, height: c.height };
        sheets[key] = keyed;
      }
      const pixels = (c) => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const out = {};
      for (const { id, map, key } of maps) {
        const t = tilesets[key], size = t.tileSize ?? 16;
        const draw = (sheet, def) => { const c = document.createElement("canvas"); c.width = map.width * size; c.height = map.height * size; drawMapTileLayers(c.getContext("2d"), sheet, map, def, 1); return c; };
        const a = draw(sheets[key], t);
        const bc = draw(await load(atlases[key].dataUrl), { ...t, tileGrafts: undefined, transparentColor: undefined });
        const pa = pixels(a), pb = pixels(bc);
        let diff = 0; for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) diff++;
        const k = Math.min(1, 480 / Math.max(a.width, a.height));
        const th = document.createElement("canvas"); th.width = Math.round(a.width * k); th.height = Math.round(a.height * k);
        const g = th.getContext("2d"); g.imageSmoothingEnabled = k < 1; g.drawImage(a, 0, 0, th.width, th.height);
        out[id] = { diff, preview: th.toDataURL("image/png") };
      }
      return { atlases, maps: out };
    }, { tilesets: Object.fromEntries(used.map((k) => [k, tilesets[k].def])), maps: entries.map((e) => ({ id: e.id, map: e.map, key: e.key })) });
  } finally { await b.close(); }
  const bad = Object.entries(baked.maps).filter(([, v]) => v.diff).map(([k, v]) => `${k}:${v.diff}`);
  if (bad.length) throw new Error(`shared atlas renders differ from the original: ${bad.join(", ")}`);

  const lib = { version: 1, roots: [], places: {}, tilesets: {}, assets: {}, maps: {}, previews: {}, regions: {}, sourceProjectId };
  for (const key of used) {
    const s = tilesets[key], def = structuredClone(s.def);
    delete def.tileGrafts; delete def.transparentColor; delete def.referenceSourceTilesetId;
    def.id = s.id; def.name = s.name;
    const assetId = `${s.id}_atlas`;
    def.image = { type: "uploaded", id: assetId };
    def.referenceDocuments = s.docs ? structuredClone((s.def.referenceDocuments ?? []).filter((c) => s.docs.test(c.id))) : [];
    if (s.owner) def.referenceSourceTilesetId = s.owner;
    def.structureKits = [...(def.structureKits ?? [])];
    lib.tilesets[s.id] = def;
    const atlas = baked.atlases[key];
    lib.assets[assetId] = { id: assetId, kind: "tileset", name: s.name, dataUrl: atlas.dataUrl, meta: { width: atlas.width, height: atlas.height, tileSize: def.tileSize ?? 16, source: `번들 ${key}${s.def.tileGrafts?.length ? " + 이식 " + s.def.tileGrafts.length + "칸" : ""}을 구운 그림` } };
  }
  for (const s of Object.values(tilesets)) if (s.owner && lib.tilesets[s.id] && !lib.tilesets[s.owner]) throw new Error(`${s.id}: reference owner ${s.owner} is not in the library`);
  for (const e of entries) {
    const s = tilesets[e.key], map = e.map, preview = baked.maps[e.id].preview;
    if (e.as === "region") {
      const rid = `shared_${id.replace(/[^a-z0-9]+/g, "_")}_${e.id.replace(/-/g, "_")}`;
      lib.maps[rid] = { ...structuredClone(map), id: rid, name: e.name, tilesetId: s.id };
      lib.regions[rid] = { id: rid, name: e.name, kind: "completed-map", regionKind: e.regionKind ?? "settlement", revision: 1, width: map.width, height: map.height,
        tilesetId: s.id, preview, sourceProjectId, sourceMapId: e.id, snapshotProjectId: sourceProjectId, rules: e.rules ?? [], limitations: e.limitations ?? "",
        ...(e.referenceDocuments ? { referenceDocuments: e.referenceDocuments } : {}) };
      lib.previews[rid] = preview;
      continue;
    }
    const floor = `shared_floor_${e.id}`, root = `shared_${e.id}`, kit = `raster_${e.id}`;
    lib.tilesets[s.id].structureKits.push({ id: kit, name: e.name, kind: "section", width: map.width, height: map.height,
      rows: Array.from({ length: map.height }, (_, y) => ({ tiles: map.lowerTiles.slice(y * map.width, (y + 1) * map.width), upperTiles: map.upperTiles.slice(y * map.width, (y + 1) * map.width) })),
      learnedFrom: { mapId: floor, x: 0, y: 0, width: map.width, height: map.height } });
    lib.maps[floor] = { ...structuredClone(map), id: floor, name: e.name, tilesetId: s.id };
    const [ex, ey] = e.entry ?? [0, 0];
    lib.places[floor] = { id: floor, name: e.name, revision: 1, tags: e.tags ?? [], provenance: { origin: "builtin" }, kind: "facility", layout: "manual", children: [], connections: [],
      ports: [{ x: ex, y: ey, id: `entry-${e.id}`, name: "입구" }], exterior: { tilesetId: s.id, kitId: kit } };
    lib.places[root] = { id: root, name: e.name, revision: 1, tags: e.tags ?? [], provenance: { origin: "builtin" }, kind: "facility", layout: "manual",
      children: [{ id: `child-${e.id}`, source: { kind: "place", id: floor }, x: 0, y: 0, level: 1 }], ports: [], connections: [] };
    lib.roots.push(root);
    lib.previews[floor] = lib.previews[root] = preview;
  }
  const summary = { id, places: lib.roots.length, regions: Object.keys(lib.regions).length, maps: Object.keys(lib.maps).length, bytes: JSON.stringify(lib).length,
    tilesets: Object.fromEntries(Object.values(lib.tilesets).map((t) => [t.id, { count: t.count, references: t.referenceDocuments.map((c) => c.id) }])),
    renderCheck: `${entries.length} maps pixel-identical with the shared atlas` };
  if (dry) return summary;
  if (summary.bytes > 60 * 1024 * 1024) throw new Error(`library ${id} is ${summary.bytes} bytes — split it (host request limit 64MiB)`);
  return await withTsModule("scripts/lib/sharedContentSqlite.ts", `publish-${id}.mjs`, async (api) => {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(api.sharedContentFile(), { readOnly: true });
    const expected = db.prepare("SELECT revision FROM content_libraries WHERE id=?").get(id)?.revision ?? null;
    db.close();
    const receipt = api.publishSharedContent(id, lib, expected);
    const again = api.readSharedContent().libraries[id];
    const ok = JSON.stringify(again) === JSON.stringify(lib);
    if (!ok) throw new Error("reloaded library differs from the published one");
    const out = { ...summary, file: receipt.file, revision: receipt.revision, reloaded: ok, publishedAt: new Date().toISOString() };
    if (proof) fs.writeFileSync(proof, JSON.stringify(out, null, 2) + "\n");
    return out;
  });
}
