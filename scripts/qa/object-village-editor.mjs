/** Open the actual persisted project in the editor; only camera/UI state changes. */
import fs from "node:fs";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
const base = process.argv[2] ?? "http://127.0.0.1:19841";
const out = process.argv[4] ?? ".omo/evidence/object-village";
const expected = JSON.parse(fs.readFileSync(process.argv[3] ?? "output/evidence/object-village/reloaded-project.json", "utf8"));
const mapId = expected.startMapId, projectId = "rpg-zzu-house-template-gallery";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [], remoteWrites = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method())
      && (/\/rest\/v1\/(?:projects|spatial_|project_)/.test(url.pathname) || /\/rpc\/(?:commit|save|upsert)/.test(url.pathname))) {
      remoteWrites.push({ method: request.method(), path: url.pathname });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
    for (const key of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(key, "1");
  });
  await page.goto(`${base}/?project=${projectId}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(id => !!window.__oprnEditorStore?.getCurrent()?.maps[id] && !!window.__oprnEditWorldToClient, mapId, { timeout: 120000 });
  const readback = await page.evaluate(async mapId => {
    const { store } = await import("/src/project/store.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const { requestEditorCameraFocus } = await import("/src/editor/editorCameraFocus.ts");
    const { getGame } = await import("/src/app/mode.ts");
    if (store !== window.__oprnEditorStore) throw Error("Different editor store instance");
    editorState.set({ currentMapId: mapId, zoom: 0.5 });
    const scene = getGame().scene.getScene("EditScene");
    await new Promise(resolve => scene.game.events.once("postrender", resolve));
    const map = store.getCurrent().maps[mapId];
    requestEditorCameraFocus({ mapId, tileX: map.width / 2, tileY: map.height / 2, bounds: { x: 0, y: 0, width: map.width, height: map.height } });
    await new Promise(resolve => scene.game.events.once("postrender", resolve));
    const project = store.getCurrent();
    return { map: project.maps[mapId], currentMapId: editorState.get().currentMapId,
      remotePersistenceEnabled: store.isRemotePersistenceEnabled(),
      compactHousesInLibrary: Object.keys(project.spatialAuthoring.library.objects).filter(id => id.startsWith("compact-village:object:")).length,
      housesInLibrary: Object.keys(project.spatialAuthoring.library.objects).filter(id => id.startsWith("house30:object:")).length,
      maps: Object.keys(project.maps).length };
  }, mapId);
  assert.ok(isDeepStrictEqual(readback.map, expected.maps[mapId]), "Loaded map differs from saved readback");
  if (mapId.includes("compact")) assert.equal(readback.compactHousesInLibrary, 12);
  assert.equal(readback.remotePersistenceEnabled, true); assert.equal(readback.housesInLibrary, 30);
  await page.screenshot({ path: `${out}/editor-saved-village.png`, fullPage: true });
  fs.writeFileSync(`${out}/editor-proof.json`, JSON.stringify({ projectId, mapId, currentMapId: readback.currentMapId,
    source: "real editor URL and Supabase boot load", remotePersistenceEnabled: true,
    housesInLibrary: readback.housesInLibrary, compactHousesInLibrary: readback.compactHousesInLibrary, maps: readback.maps, mapMatchesSavedReadback: true,
    mapSHA256: createHash("sha256").update(JSON.stringify(readback.map)).digest("hex"), errors,
    blockedRemoteWrites: remoteWrites, projectContentWrites: 0 }, null, 2));
  assert.deepEqual(errors, []);
  // Boot may try to append its separate history receipt; the read-only probe blocks it.
  assert.ok(remoteWrites.every(write => write.path === "/rest/v1/project_commits"));
  console.log("Editor remote load and saved map verified");
} finally { await browser.close(); }
