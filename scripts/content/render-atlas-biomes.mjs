// Render tiledata/atlas-biomes maps with the app's own tile drawer (dev server) → tiledata/atlas-biomes/images/<id>.png.
// Biome fields draw with the atlas biome tilesets (atlasBiomes.ts), world maps with the atlas world tileset.
// Usage: DEV_URL=http://127.0.0.1:<port> node scripts/content/render-atlas-biomes.mjs   (ATLAS_ONLY=<id,id> for some)
import fs from "node:fs";
import { chromium } from "playwright";
const dir = "tiledata/atlas-biomes", catalog = JSON.parse(fs.readFileSync(dir + "/catalog.json"));
const only = process.env.ATLAS_ONLY ? process.env.ATLAS_ONLY.split(",") : null;
const maps = Object.fromEntries(Object.entries(catalog.maps).filter(([id]) => !only || only.includes(id)));
const b = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const page = await b.newPage();
  await page.route("**/__atlas-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DEV_URL ?? "http://127.0.0.1:9911") + "/__atlas-render");
  const ids = Object.keys(maps);
  fs.mkdirSync(dir + "/images", { recursive: true });
  // in batches (a page holds every data URL until it returns)
  for (let k = 0; k < ids.length; k += 12) {
    const batch = Object.fromEntries(ids.slice(k, k + 12).map((id) => [id, maps[id]]));
    const images = await page.evaluate(async ({ maps }) => {
      const { drawMapTileLayers, loadTilesetImage } = await import("/src/editor/mapTileDraw.ts");
      const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
      const { createAtlasBiomeTileset } = await import("/src/project/defaults/atlasBiomes.ts");
      const worldDef = () => window.__atlasWorld ??= import("/src/project/defaults/blankProject.ts").then((d) => d.createBlankProject().tilesets.atlas_biome_world);
      const cache = (window.__atlasSheets ??= {}), defs = (window.__atlasDefs ??= {});
      const out = {};
      for (const m of Object.values(maps)) {
        let t = defs[m.tilesetId];
        if (!t) {
          t = m.tilesetId === "atlas_biome_world" ? await worldDef() : createAtlasBiomeTileset(m.tilesetId.replace("atlas_biome_", ""));
          defs[m.tilesetId] = t;
        }
        if (!cache[t.id]) { if (t.transparentColor) cache[t.id] = await loadTilesetImage(t); else { const im = new Image(); im.src = tilesetBaseImageUrl(t); await im.decode(); cache[t.id] = im; } }
        const c = document.createElement("canvas");
        c.width = m.width * 16; c.height = m.height * 16;
        drawMapTileLayers(c.getContext("2d"), cache[t.id], m, t, 1);
        out[m.id] = c.toDataURL();
      }
      return out;
    }, { maps: batch });
    for (const [id, url] of Object.entries(images)) fs.writeFileSync(`${dir}/images/${id}.png`, Buffer.from(url.split(",")[1], "base64"));
    console.log(Object.keys(images).join(" "));
  }
} finally {
  await b.close();
}
