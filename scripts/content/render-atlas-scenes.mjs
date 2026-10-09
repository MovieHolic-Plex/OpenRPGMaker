// Render tiledata/atlas-scenes maps with the app's own tile drawer (dev server) → tiledata/atlas-scenes/images/<id>.png.
// Usage: DEV_URL=http://127.0.0.1:<port> node scripts/content/render-atlas-scenes.mjs [id,id]
import fs from "node:fs";
import { chromium } from "playwright";

const dir = "tiledata/atlas-scenes", catalog = JSON.parse(fs.readFileSync(dir + "/catalog.json"));
const only = process.argv[2] ? new Set(process.argv[2].split(",")) : null;
const maps = Object.fromEntries(Object.entries(catalog.maps).filter(([id]) => !only || only.has(id)));
const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const page = await b.newPage();
  await page.route("**/__atlas-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9900") + "/__atlas-render");
  fs.mkdirSync(dir + "/images", { recursive: true });
  for (const [id, m] of Object.entries(maps)) {
    const url = await page.evaluate(async ({ m, t }) => {
      const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
      const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
      const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
      const { createTransparentColorKeyCanvas } = await import("/src/assets/chipsetTransparency.ts");
      window.__sheets ??= {};
      if (!window.__sheets[t.id]) {
        const im = new Image(); im.src = (await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t); await im.decode();
        window.__sheets[t.id] = t.transparentColor ? createTransparentColorKeyCanvas({ image: { ...t.image }, transparentColor: t.transparentColor }, im) ?? im : im;
      }
      const c = document.createElement("canvas");
      c.width = m.width * 16; c.height = m.height * 16;
      drawMapTileLayers(c.getContext("2d"), window.__sheets[t.id], m, t, 1);
      return c.toDataURL();
    }, { m, t: catalog.tilesets[m.tilesetId] });
    fs.writeFileSync(`${dir}/images/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
  }
  console.log(Object.keys(maps).length, "rendered");
} finally {
  await b.close();
}
