// Render tiledata/rpg-outdoors maps with the app's own tile drawer (dev server) → tiledata/rpg-outdoors/images/<id>.png.
// Forest maps draw with the diverse forest-village tileset (its grafts), climate maps with the climate sheets, the world
// map with the bundled EasyRPG world tileset (quarter-art coast/terrain autotiles are drawn by the same drawer).
// Usage: DEV_URL=http://127.0.0.1:<port> node scripts/content/render-rpg-outdoors.mjs   (OUTDOOR_ONLY=<id,id> for some)
import fs from "node:fs";
import { chromium } from "playwright";
const dir = "tiledata/rpg-outdoors", catalog = JSON.parse(fs.readFileSync(dir + "/catalog.json"));
const forest = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json")).tileset;
const only = process.env.OUTDOOR_ONLY ? process.env.OUTDOOR_ONLY.split(",") : null;
const maps = Object.fromEntries(Object.entries(catalog.maps).filter(([id]) => !only || only.includes(id)));
const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const page = await b.newPage();
  await page.route("**/__outdoor-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9863") + "/__outdoor-render");
  const images = await page.evaluate(async ({ maps, forest }) => {
    const { drawMapTileLayers, loadTilesetImage } = await import("/src/editor/mapTileDraw.ts");
    const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
    const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
    const { createClimateVillageTileset } = await import("/src/project/defaults/climateVillages.ts");
    const { createBlankProject } = await import("/src/project/defaults.ts");
    const blank = createBlankProject();
    const world = blank.tilesets.easyrpg_chipset_world;
    const tilesets = { forest_harmony: forest, easyrpg_chipset_world: world, oprn_world_keyed: { ...world, id: "oprn_world_keyed", transparentColor: "#ff678b" } };
    for (const kind of ["snow", "volcano", "desert", "autumn"]) { const t = createClimateVillageTileset(kind); tilesets[t.id] = t; }
    const sheets = {}, out = {};
    for (const m of Object.values(maps)) {
      const t = tilesets[m.tilesetId];
      if (!sheets[t.id] && t.transparentColor) sheets[t.id] = await loadTilesetImage(t);
      if (!sheets[t.id]) { const im = new Image(); im.src = (await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t); await im.decode(); sheets[t.id] = im; }
      const c = document.createElement("canvas");
      c.width = m.width * 16; c.height = m.height * 16;
      drawMapTileLayers(c.getContext("2d"), sheets[t.id], m, t, 1);
      out[m.id] = c.toDataURL();
    }
    return out;
  }, { maps, forest });
  fs.mkdirSync(dir + "/images", { recursive: true });
  for (const [id, url] of Object.entries(images)) fs.writeFileSync(`${dir}/images/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
  console.log(Object.keys(images).join(" "));
} finally {
  await b.close();
}
