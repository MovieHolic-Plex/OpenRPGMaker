import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { catalog, validateVillageStudy, studyFaults, applyStudyFault } from "./validate-diverse-villages.mjs";
const project = { maps: catalog.maps, tilesets: { forest_harmony: catalog.tileset } }, normal = [];
for (const id of Object.keys(project.maps)) {
  const r = await validateVillageStudy(project, id);
  assert(r.valid, JSON.stringify(r));
  normal.push(r);
}
const examples = [];
for (const f of studyFaults()) {
  const p = structuredClone(project);
  applyStudyFault(p, f);
  const result = await validateVillageStudy(p, f.mapId);
  assert(result.errors.some((e) => e.code === f.code && e.x === f.x && e.y === f.y), JSON.stringify(result));
  examples.push({ input: f, result });
}
const dir = "tiledata/forest-villages/diverse";
fs.writeFileSync(dir + "/validation.json", JSON.stringify({ normal, examples }, null, 2));
const b = await chromium.launch();
try {
  const page = await b.newPage();
  await page.route("**/__diverse-render", (r) => r.fulfill({ contentType: "text/html", body: '<meta charset="utf-8">' }));
  await page.goto((process.env.DIVERSE_DEV_URL ?? "http://127.0.0.1:9816") + "/__diverse-render");
  const images = await page.evaluate(async ({ project: project2, faults }) => {
    const { drawMapTileLayers } = await import("/src/editor/mapTileDraw.ts");
    const { awaitGraftedTilesetImageUrl } = await import("/src/assets/tileGraftImageCache.ts");
    const { tilesetBaseImageUrl } = await import("/src/editor/tilesetImage.ts");
    const t = project2.tilesets.forest_harmony, im = new Image();
    im.src = await awaitGraftedTilesetImageUrl(t, tilesetBaseImageUrl(t));
    await im.decode();
    const render = (m) => {
      const c = document.createElement("canvas");
      c.width = m.width * 16;
      c.height = m.height * 16;
      drawMapTileLayers(c.getContext("2d"), im, m, t, 1);
      return c;
    };
    const out = {}, canvases = {};
    for (const m of Object.values(project2.maps)) {
      canvases[m.id] = render(m);
      out[m.id] = canvases[m.id].toDataURL();
    }
    for (const f of faults) {
      const m = structuredClone(project2.maps[f.mapId]), i = f.y * m.width + f.x;
      m[f.layer + "Tiles"][i] = f.replacement;
      if (f.move) m[(f.layer === "upper" ? "lower" : "upper") + "Tiles"][i] = f.tile;
      const bad = render(m), c = document.createElement("canvas");
      c.width = 576;
      c.height = 326;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#25332c";
      ctx.fillRect(0, 0, 576, 326);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "white";
      ctx.fillText("NORMAL", 12, 24);
      ctx.fillText("ERROR " + f.code, 300, 24);
      const x = Math.max(0, Math.min(m.width - 9, f.x - 4)), y = Math.max(0, Math.min(m.height - 9, f.y - 4));
      ctx.drawImage(canvases[m.id], x * 16, y * 16, 144, 144, 0, 38, 288, 288);
      ctx.drawImage(bad, x * 16, y * 16, 144, 144, 288, 38, 288, 288);
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = 2;
      ctx.strokeRect(288 + (f.x - x) * 32, 38 + (f.y - y) * 32, 32, 32);
      out[f.code] = c.toDataURL();
    }
    return out;
  }, { project, faults: studyFaults() });
  for (const [id, url] of Object.entries(images)) fs.writeFileSync(dir + "/images/" + id + ".png", Buffer.from(url.split(",")[1], "base64"));
} finally {
  await b.close();
}
console.log({ normal: normal.map((r) => r.mapId), faults: examples.map((e) => ({ code: e.input.code, x: e.input.x, y: e.input.y })) });
