// Render tiledata/climate-villages maps with the app's own tile drawer (dev server) → tiledata/climate-villages/images/<id>.png.
// Also renders the untouched forest source of each map, so the guide can show before/after.
import fs from "node:fs";
import { chromium } from "playwright";
const dir = "tiledata/climate-villages", catalog = JSON.parse(fs.readFileSync(dir + "/catalog.json"));
const village = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
const sources = Object.fromEntries([...new Set(catalog.plans.map((p) => p.from))].map((id) => [id, village.maps[id]]));
const b = await chromium.launch();
try {
  const page = await b.newPage();
  await page.route("**/__climate-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9816") + "/__climate-render");
  const images = await page.evaluate(async ({ maps, sources, forest }) => {
    const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
    const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
    const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
    const { createClimateVillageTileset } = await import("/src/project/defaults/climateVillages.ts");
    const tilesets = { forest_harmony: forest };
    for (const kind of ["snow", "volcano", "desert", "autumn"]) { const t = createClimateVillageTileset(kind); tilesets[t.id] = t; }
    const sheets = {};
    const draw = async (m) => {
      const t = tilesets[m.tilesetId];
      if (!sheets[t.id]) { const im = new Image(); im.src = (await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t); await im.decode(); sheets[t.id] = im; }
      const c = document.createElement("canvas");
      c.width = m.width * 16; c.height = m.height * 16;
      drawMapTileLayers(c.getContext("2d"), sheets[t.id], m, t, 1);
      return c.toDataURL();
    };
    const out = {};
    for (const m of Object.values(maps)) out[m.id] = await draw(m);
    for (const [id, m] of Object.entries(sources)) out["source-" + id] = await draw(m);
    return out;
  }, { maps: catalog.maps, sources, forest: village.tileset });
  fs.mkdirSync(dir + "/images", { recursive: true });
  for (const [id, url] of Object.entries(images)) fs.writeFileSync(`${dir}/images/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
  console.log(Object.keys(images));
} finally {
  await b.close();
}
