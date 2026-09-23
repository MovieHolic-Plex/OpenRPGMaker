// Render tiledata/field-routes maps with the app's own tile drawer (dev server) → tiledata/field-routes/images/<id>.png.
// Forest fields draw with the diverse forest-village tileset (its grafts), climate fields with the climate sheets.
import fs from "node:fs";
import { chromium } from "playwright";
const dir = "tiledata/field-routes", catalog = JSON.parse(fs.readFileSync(dir + "/catalog.json"));
const forest = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json")).tileset;
const b = await chromium.launch();
try {
  const page = await b.newPage();
  await page.route("**/__field-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9816") + "/__field-render");
  const images = await page.evaluate(async ({ maps, forest }) => {
    const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
    const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
    const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
    const { createClimateVillageTileset } = await import("/src/project/defaults/climateVillages.ts");
    const tilesets = { forest_harmony: forest };
    for (const kind of ["snow", "volcano", "desert", "autumn"]) { const t = createClimateVillageTileset(kind); tilesets[t.id] = t; }
    const sheets = {}, out = {};
    for (const m of Object.values(maps)) {
      const t = tilesets[m.tilesetId];
      if (!sheets[t.id]) { const im = new Image(); im.src = (await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t); await im.decode(); sheets[t.id] = im; }
      const c = document.createElement("canvas");
      c.width = m.width * 16; c.height = m.height * 16;
      drawMapTileLayers(c.getContext("2d"), sheets[t.id], m, t, 1);
      out[m.id] = c.toDataURL();
    }
    return out;
  }, { maps: catalog.maps, forest });
  fs.mkdirSync(dir + "/images", { recursive: true });
  for (const [id, url] of Object.entries(images)) fs.writeFileSync(`${dir}/images/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
  console.log(Object.keys(images));
} finally {
  await b.close();
}
