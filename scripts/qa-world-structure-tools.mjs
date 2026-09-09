import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { runRuntimeQa, startPlayerQaServer } from "./lib/runtimeQaRun.mjs";

const out = "reports/world-structure-tools";
const project = JSON.parse(fs.readFileSync(`${out}/project.json`, "utf8"));
const verification = JSON.parse(fs.readFileSync(`${out}/verification.json`, "utf8"));
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets"] });
const server = await startPlayerQaServer();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("http://127.0.0.1:10147/**", async route => route.fulfill({ response: await route.fetch({ timeout: 60000, maxRetries: 2 }) }));
  await page.goto("http://127.0.0.1:10147/?blankProject=1");
  await page.getByTestId("menu-project").waitFor({ timeout: 120000 });
  const editorResult = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { createBlankProject } = await import("/src/project/defaults/defaultProject.ts");
    const { createBlankMap } = await import("/src/project/defaults/defaultMaps.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const { previewTool, applyToolToStore } = await import("/src/editor/tools/applyChangesetToStore.ts");
    const { undoMapEdit, redoMapEdit, resetMapEditHistory } = await import("/src/editor/mapEditHistory.ts");
    const p = createBlankProject(), map = createBlankMap("공통 도구 직접 적용", 48, 44, "easyrpg_chipset_world");
    map.id = "world_author_ui"; map.lowerTiles.fill(240); map.upperTiles.fill(-1);
    p.maps = { [map.id]: map }; p.mapTree = { mapId: map.id, children: [] }; p.startMapId = map.id; p.startPos = { x: 1, y: 1 };
    for (let y = 10; y <= 15; y++) map.lowerTiles[y * map.width + 40] = 120;
    store.replace(p, { change: { label: "공통 도구 QA 준비", origin: "system", scope: "project" } });
    editorState.set({ currentMapId: map.id, zoom: 1 });
    resetMapEditHistory();
    const signature = () => JSON.stringify({ maps: store.getCurrent().maps, tilesets: store.getCurrent().tilesets });
    const before = signature();
    const args = { mapId: map.id, surface: "grass", tiers: [
      { x: 5, y: 4, width: 29, height: 27, stairX: 9 },
      { x: 9, y: 7, width: 20, height: 17, stairX: 25 },
      { x: 14, y: 10, width: 10, height: 7, stairX: 17 },
    ] };
    const dry = previewTool("author_world_mountain", args);
    if (!dry.ok || signature() !== before) throw new Error(`Preview failed: ${JSON.stringify(dry)}`);
    const applied = applyToolToStore("author_world_mountain", args);
    if (!applied.ok) throw new Error(JSON.stringify(applied));
    const after = signature();
    if (!undoMapEdit() || signature() !== before) throw new Error("Undo did not restore map and private tileset");
    if (!redoMapEdit() || signature() !== after) throw new Error("Redo did not restore construction");
    const bridge = applyToolToStore("author_world_bridge", { mapId: map.id, x: 40, y: 10, length: 6, orientation: "vertical" });
    if (!bridge.ok) throw new Error(JSON.stringify(bridge));
    return { previewUnchanged: true, undoRestored: true, redoRestored: true, mountain: applied.data, bridge: bridge.data };
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${out}/editor.png` });
  // Atlas captures use the very same project that was reloaded from Supabase.
  const atlas = await page.evaluate(async project => {
    const { drawMapTileLayers, loadTilesetImage } = await import("/src/editor/mapTileDraw.ts");
    const images = [];
    for (const map of Object.values(project.maps)) {
      const tileset = project.tilesets[map.tilesetId], source = await loadTilesetImage(tileset);
      const canvas = document.createElement("canvas"); canvas.width = map.width * 16; canvas.height = map.height * 16;
      const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
      drawMapTileLayers(ctx, source, map, tileset, 1);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let pink = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 255 && pixels[i + 1] === 103 && pixels[i + 2] === 139 && pixels[i + 3]) pink++;
      if (pink > 0) throw new Error(`${map.id}: ${pink} unmasked color-key pixels`);
      images.push({ id: map.id, image: canvas.toDataURL() });
    }
    return images;
  }, project);
  for (const image of atlas) fs.writeFileSync(`${out}/${image.id}.png`, Buffer.from(image.image.split(",")[1], "base64"));
  assert.deepEqual(errors, []);
  await page.close();

  const runtimePage = await browser.newPage();
  await runtimePage.route(`${server.url}/**`, async route => route.fulfill({ response: await route.fetch({ timeout: 60000, maxRetries: 2 }) }));
  const mapId = project.startMapId;
  const record = verification.receipts.find(receipt => receipt.name === "author_world_mountain" && receipt.args.mapId === mapId);
  assert(record);
  const approach = [{ x: 1, y: 1 }];
  for (let y = 2; y <= record.data.entry.y; y++) approach.push({ x: 1, y });
  for (let x = 2; x <= record.data.entry.x; x++) approach.push({ x, y: record.data.entry.y });
  const route = approach.concat(record.data.route.slice(1));
  const moves = route.slice(1).map((p, i) => ({ kind: "move", dir: p.x > route[i].x ? "right" : p.x < route[i].x ? "left" : p.y > route[i].y ? "down" : "up" }));
  const runtime = await runRuntimeQa(runtimePage, {
    id: "world-structure-tools", projectFixture: `${out}/project.json`,
    beats: [
      { id: "title", expect: { testidPresent: ["title-screen"] } },
      { id: "entry", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }], expect: { mapId, x: 1, y: 1 } },
      { id: "summit", ops: [{ kind: "playerRoute", moves }, { kind: "waitForPosition", mapId, ...record.data.summit, timeoutMs: 120000 }],
        expect: { mapId, ...record.data.summit, playerSpriteTextureLoaded: true }, shot: true },
    ],
  }, { serverUrl: server.url });
  assert.deepEqual(runtime.errors, []);
  assert(runtime.beats.every(beat => beat.failures.length === 0));
  fs.writeFileSync(`${out}/browser-checks.json`, JSON.stringify({ editorResult, errors, atlasImages: atlas.length, runtimeBeats: runtime.beats.length, runtimeErrors: runtime.errors }, null, 2));
  console.log(JSON.stringify({ editorUndoRedo: true, dryRun: true, atlasImages: atlas.length, runtimeBeats: runtime.beats.length, errors: 0 }));
} finally {
  await browser.close();
  await server.close();
}
