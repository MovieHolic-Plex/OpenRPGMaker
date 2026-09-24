// Render tiledata/rpg-interiors maps with the app's own tile drawer (dev server) → tiledata/rpg-interiors/images/<id>.png.
// Usage: DEV_URL=http://127.0.0.1:<port> node scripts/content/render-rpg-interiors.mjs
import fs from "node:fs";
import { chromium } from "playwright";
const dir = "tiledata/rpg-interiors", catalog = JSON.parse(fs.readFileSync(dir + "/catalog.json"));
const b = await chromium.launch();
try {
  const page = await b.newPage();
  await page.route("**/__rpg-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9816") + "/__rpg-render");
  const images = await page.evaluate(async ({ maps, tilesets }) => {
    const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
    const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
    const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
    const { createTransparentColorKeyCanvas } = await import("/src/assets/chipsetTransparency.ts");
    const sheets = {};
    const out = {};
    for (const m of Object.values(maps)) {
      const t = tilesets[m.tilesetId];
      if (!sheets[t.id]) {
        const im = new Image(); im.src = (await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t); await im.decode();
        // Same colour-key contract as loadTilesetImage/Phaser: the ship sheet keeps magenta on some props.
        sheets[t.id] = t.transparentColor ? createTransparentColorKeyCanvas({ image: { ...t.image }, transparentColor: t.transparentColor }, im) ?? im : im;
      }
      const c = document.createElement("canvas");
      c.width = m.width * 16; c.height = m.height * 16;
      drawMapTileLayers(c.getContext("2d"), sheets[t.id], m, t, 1);
      out[m.id] = c.toDataURL();
    }
    return out;
  }, { maps: catalog.maps, tilesets: catalog.tilesets });
  fs.mkdirSync(dir + "/images", { recursive: true });
  for (const [id, url] of Object.entries(images)) fs.writeFileSync(`${dir}/images/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
  console.log(Object.keys(images).length);
} finally {
  await b.close();
}
