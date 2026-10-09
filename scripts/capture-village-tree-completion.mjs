/** Actual editor tile renderer, with local read-only inputs and no editor store/DB boot. */
import fs from "node:fs";
import { chromium } from "playwright";

const output = process.argv[2] ?? "output/evidence/village-tree-completion";
const base = process.argv[3] ?? "http://127.0.0.1:19853";
const proof = JSON.parse(fs.readFileSync(`${output}/proof.json`, "utf8"));
const before = JSON.parse(fs.readFileSync(proof.source, "utf8"));
const after = JSON.parse(fs.readFileSync(`${output}/completed-project.json`, "utf8"));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 980, height: 1000 }, deviceScaleFactor: 1 });
  await page.route("**/__tree-completion", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><body></body>" }));
  await page.goto(`${base}/__tree-completion`);
  const pngs = await page.evaluate(async ({ before, after, mapId }) => {
    const { drawMapTileLayers, loadTilesetImage } = await import("/src/editor/mapTileDraw.ts");
    const maps = [];
    for (const project of [before, after]) {
      const map = project.maps[mapId], tileset = project.tilesets[map.tilesetId];
      const atlas = await loadTilesetImage(tileset);
      const canvas = document.createElement("canvas");
      canvas.width = map.width * map.tileSize; canvas.height = map.height * map.tileSize;
      const context = canvas.getContext("2d"); context.imageSmoothingEnabled = false;
      drawMapTileLayers(context, atlas, map, tileset, 1);
      maps.push(canvas);
    }
    const sheet = document.createElement("canvas"); sheet.width = 800; sheet.height = 1000;
    const context = sheet.getContext("2d"); context.imageSmoothingEnabled = false;
    context.fillStyle = "#f3f0e7"; context.fillRect(0, 0, sheet.width, sheet.height);
    context.fillStyle = "#293225"; context.font = "bold 24px sans-serif";
    context.fillText("BEFORE", 32, 36); context.fillText("AFTER", 432, 36);
    const cases = [
      { label: "Conifer companions", x: 33, y: 31, w: 8, h: 8 },
      { label: "Broadleaf companions", x: 63, y: 38, w: 8, h: 8 },
      { label: "Fence preserved; orphan trunk removed", x: 51, y: 31, w: 8, h: 8 },
    ];
    cases.forEach((sample, row) => {
      context.font = "18px sans-serif"; context.fillText(sample.label, 32, 80 + row * 300);
      maps.forEach((map, column) => context.drawImage(map, sample.x * 16, sample.y * 16,
        sample.w * 16, sample.h * 16, 32 + column * 400, 100 + row * 300, sample.w * 32, sample.h * 32));
    });
    return { sheet: sheet.toDataURL("image/png"), map: maps[1].toDataURL("image/png") };
  }, { before, after, mapId: proof.mapId });
  for (const [name, png] of Object.entries(pngs)) fs.writeFileSync(`${output}/${name}.png`, Buffer.from(png.split(",")[1], "base64"));
  fs.writeFileSync(`${output}/render-proof.json`, JSON.stringify({ renderer: "src/editor/mapTileDraw.ts", source: proof.source,
    mapId: proof.mapId, mapScale: 1, cropScale: 2, normalization: false, databaseWrites: 0 }, null, 2));
  console.log(`${output}/sheet.png`);
} finally { await browser.close(); }
