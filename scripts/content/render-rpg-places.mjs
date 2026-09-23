// Render tiledata/rpg-places maps with the app's own tile drawer (dev server) → tiledata/rpg-places/images/<id>.png.
// Also renders the rejected 「벽을 뚫은 폐성」 next to the kept one for the guide.
import fs from "node:fs";
import { chromium } from "playwright";
const dir = "tiledata/rpg-places", catalog = JSON.parse(fs.readFileSync(dir + "/catalog.json"));
// Wrong way, kept only as a contrast: cutting holes through the wall assembly leaves raw, edgeless gaps.
const holed = structuredClone(catalog.maps["fantasy-ruined-castle"]);
for (const [hx, hy, hw, hh] of [[10, 4, 5, 4], [33, 6, 4, 3], [40, 14, 3, 5], [6, 18, 3, 6]])
  for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) { holed.lowerTiles[y * holed.width + x] = 240; holed.upperTiles[y * holed.width + x] = 604; }
const b = await chromium.launch();
try {
  const page = await b.newPage();
  await page.route("**/__rpg-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9816") + "/__rpg-render");
  const images = await page.evaluate(async ({ maps, tilesets, holed }) => {
    const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
    const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
    const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
    const sheets = {};
    const draw = async (m) => {
      const t = tilesets[m.tilesetId];
      if (!sheets[t.id]) { const im = new Image(); im.src = (await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t); /* null when nothing is grafted */ await im.decode(); sheets[t.id] = im; }
      const c = document.createElement("canvas");
      c.width = m.width * 16; c.height = m.height * 16;
      drawMapTileLayers(c.getContext("2d"), sheets[t.id], m, t, 1);
      return c.toDataURL();
    };
    const out = {};
    for (const m of Object.values(maps)) out[m.id] = await draw(m);
    out["guide-ruin-holed"] = await draw(holed);
    return out;
  }, { maps: catalog.maps, tilesets: catalog.tilesets, holed });
  fs.mkdirSync(dir + "/images", { recursive: true });
  for (const [id, url] of Object.entries(images)) fs.writeFileSync(`${dir}/images/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
  console.log(Object.keys(images));
} finally {
  await b.close();
}
