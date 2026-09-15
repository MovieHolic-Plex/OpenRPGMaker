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
    localStorage.setItem("oprn:editor-ui-mode", "standard");
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
  if (mapId.includes("compact") || mapId.includes("small-village")) assert.equal(readback.compactHousesInLibrary, 12);
  assert.equal(readback.remotePersistenceEnabled, true); assert.equal(readback.housesInLibrary, 30);
  await page.screenshot({ path: `${out}/editor-saved-village.png`, fullPage: true });
  await page.evaluate(async () => {
    const { openDatabaseModal } = await import("/src/editor/panels/databaseModal.ts");
    openDatabaseModal("spatialRegions");
  });
  await page.locator('[data-testid^="spatial-card-"]').filter({ hasText: "소규모 마을 · 밀집 주택과 호수 장터" }).click();
  await page.getByTestId("spatial-settlement-edit-preset").click();
  await page.getByTestId("db-village-object-profile").waitFor({ state: "visible", timeout: 90000 });
  const rules = await page.evaluate(() => ({
    multiStoreyCount: document.querySelector('[data-testid="db-village-multi-storey-count"]').value,
    clustering: document.querySelector('[data-testid="db-village-house-clustering"]').value,
    width: document.querySelector('[data-testid="db-village-reference-width"]').value,
    height: document.querySelector('[data-testid="db-village-reference-height"]').value,
    selectedObjects: document.querySelectorAll('[data-testid="db-village-object-profile"] input[type="checkbox"]:checked').length,
    defaultPressed: document.querySelector('[data-testid="db-village-design-default"]').getAttribute("aria-pressed"),
    request: document.querySelector('[data-testid="db-village-design-request"]').value,
  }));
  if (expected.villagePresets.find(p => p.id === "small-village-dense").design.stories.includes(4)) {
    assert.ok(await page.locator('[data-testid="db-village-design-stories-4"]').isChecked());
  }
  assert.deepEqual({ ...rules, request: undefined }, { multiStoreyCount: "3", clustering: "tight", width: "76", height: "76", selectedObjects: expected.villagePresets.find(p => p.id === "small-village-dense").design.objectVillage.objectIds.length, defaultPressed: "false", request: undefined });
  assert.ok(rules.request.includes("small-village-dense"));
  await page.getByTestId("db-village-preset-preview-run").click({ timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="db-village-preset-preview"]')?.dataset.previewState === "ready", null, { timeout: 90000 });
  assert.ok((await page.getByTestId("db-village-preset-preview-note").textContent()).includes("집 26채"));
  const profileBox = await page.getByTestId("db-village-object-profile").boundingBox();
  const previewBox = await page.locator(".db-village-design-preview").boundingBox();
  assert.ok(profileBox.width >= 300, "The design editor must have room for readable controls");
  assert.ok(profileBox.x + profileBox.width <= previewBox.x || profileBox.y + profileBox.height <= previewBox.y, "Editor and preview overlap");
  await page.screenshot({ path: `${out}/editor-small-village-design.png`, fullPage: true });
  const decorations = expected.villagePresets.find(p => p.id === "small-village-dense").design.objectVillage.decorations;
  if (decorations?.length) {
    await page.getByTestId("db-village-design-tab-layout").click();
    await page.getByTestId("db-village-decoration-spaces").scrollIntoViewIfNeeded();
    assert.equal(await page.locator('input[data-testid^="db-village-decoration-limit-"]').count(), decorations.length);
    for (const [i, rule] of decorations.entries()) assert.equal(await page.getByTestId(`db-village-decoration-limit-${i}`).inputValue(), String(rule.maxCount));
    await page.screenshot({ path: `${out}/editor-decoration-rules.png`, fullPage: true });
  }
  await page.getByTestId("spatial-village-back").click();
  assert.ok(await page.getByTestId("spatial-gallery").isVisible());
  fs.writeFileSync(`${out}/editor-design-proof.json`, JSON.stringify({ projectId, rules, previewReady: true, previewHouses: 26, source: "real Supabase project and database design studio", contentWrites: 0 }, null, 2));
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
