// Render tiledata/atlas-interiors maps with the app's own tile drawer (dev server) → tiledata/atlas-interiors/images/<id>.png.
// Usage: DEV_URL=http://127.0.0.1:<port> node scripts/content/render-atlas-interiors.mjs [catalog.json] [id...]
import fs from "node:fs";
import { chromium } from "playwright";
const dir = "tiledata/atlas-interiors";
const file = process.argv[2] && process.argv[2].endsWith(".json") ? process.argv[2] : dir + "/catalog.json";
const ids = process.argv.slice(2).filter((a) => !a.endsWith(".json"));
const catalog = JSON.parse(fs.readFileSync(file));
const maps = Object.fromEntries(Object.entries(catalog.maps).filter(([id]) => !ids.length || ids.includes(id)));
const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const page = await b.newPage();
  await page.route("**/__atlas-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9899") + "/__atlas-render");
  const images = await page.evaluate(async ({ maps, tilesets }) => {
    const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
    const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
    const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
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
  }, { maps, tilesets: catalog.tilesets });
  fs.mkdirSync(dir + "/images", { recursive: true });
  for (const [id, url] of Object.entries(images)) fs.writeFileSync(`${dir}/images/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
  console.log(Object.keys(images).length);
} finally {
  await b.close();
}
