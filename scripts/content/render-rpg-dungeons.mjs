// Render tiledata/rpg-dungeons maps with the app's own tile drawer (dev server) → tiledata/rpg-dungeons/images/<id>.png.
// Usage: node scripts/content/render-rpg-dungeons.mjs [catalog.json] [outDir]   (DEV_URL, default http://127.0.0.1:9862)
import fs from "node:fs";
import { chromium } from "playwright";
const dir = "tiledata/rpg-dungeons";
const catalog = JSON.parse(fs.readFileSync(process.argv[2] ?? dir + "/catalog.json"));
const out = process.argv[3] ?? dir + "/images";
const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const page = await b.newPage();
  await page.route("**/__rpg-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9862") + "/__rpg-render");
  const images = await page.evaluate(async ({ maps, tilesets }) => {
    const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
    const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
    const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
    const sheets = {};
    const draw = async (m) => {
      const t = tilesets[m.tilesetId];
      if (!sheets[t.id]) { const im = new Image(); im.src = (await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t); await im.decode(); sheets[t.id] = im; }
      const c = document.createElement("canvas");
      c.width = m.width * 16; c.height = m.height * 16;
      drawMapTileLayers(c.getContext("2d"), sheets[t.id], m, t, 1);
      return c.toDataURL();
    };
    const res = {};
    for (const m of Object.values(maps)) res[m.id] = await draw(m);
    return res;
  }, { maps: catalog.maps, tilesets: catalog.tilesets });
  fs.mkdirSync(out, { recursive: true });
  for (const [id, url] of Object.entries(images)) fs.writeFileSync(`${out}/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
  console.log(Object.keys(images).join(" "));
} finally {
  await b.close();
}
