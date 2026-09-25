// Render maps with the app's own tile drawer (dev server) → PNG buffers. Tilesets are passed whole (grafts included);
// transparentColor sheets go through loadTilesetImage. Used by the atlas-towns pipeline (author, QA, viz).
import { chromium } from "playwright";

export async function renderMaps(maps, tilesets, { devUrl = process.env.DEV_URL ?? "http://127.0.0.1:9896", scale = 1 } = {}) {
  const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
  try {
    const page = await b.newPage();
    await page.route("**/__atlas-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
    await page.goto(devUrl + "/__atlas-render");
    const out = {};
    // Batches keep the page payload small.
    const list = Object.values(maps);
    for (let k = 0; k < list.length; k += 8) {
      const batch = list.slice(k, k + 8), used = Object.fromEntries([...new Set(batch.map((m) => m.tilesetId))].map((id) => [id, tilesets[id]]));
      const images = await page.evaluate(async ({ maps, tilesets, scale }) => {
        const { drawMapTileLayers, loadTilesetImage } = await import("/src/editor/mapTileDraw.ts");
        const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
        const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
        window.__atlasSheets ??= {};
        const res = {};
        for (const m of maps) {
          const t = tilesets[m.tilesetId];
          const key = t.id + ":" + t.count + ":" + (t.tileGrafts?.length ?? 0);
          if (!window.__atlasSheets[key]) {
            if (t.transparentColor) window.__atlasSheets[key] = await loadTilesetImage(t);
            else { const im = new Image(); im.src = (await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t))) ?? tilesetBaseImageUrl(t); await im.decode(); window.__atlasSheets[key] = im; }
          }
          const c = document.createElement("canvas");
          c.width = m.width * 16 * scale; c.height = m.height * 16 * scale;
          const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
          drawMapTileLayers(g, window.__atlasSheets[key], m, t, scale);
          res[m.id] = c.toDataURL();
        }
        return res;
      }, { maps: batch, tilesets: used, scale });
      for (const [id, url] of Object.entries(images)) out[id] = Buffer.from(url.split(",")[1], "base64");
    }
    return out;
  } finally { await b.close(); }
}
