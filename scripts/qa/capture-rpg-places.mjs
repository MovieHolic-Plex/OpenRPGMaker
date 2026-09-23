// Publication evidence for the fantasy places under 장소; read-only browser session, no project mutations.
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const out = "verify-shots/rpg-places";
fs.mkdirSync(out, { recursive: true });
const plans = JSON.parse(fs.readFileSync("tiledata/rpg-places/catalog.json")).plans;
const shipped = JSON.parse(fs.readFileSync("src/assets/sharedRpgPlaceReferences.json"));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 }, acceptDownloads: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
    for (const k of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(k, "1");
  });
  await page.goto(`${process.env.BASE ?? "http://127.0.0.1:9816"}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded", timeout: 12e4 });
  const guest = page.getByTestId("login-guest");
  await page.getByTestId("ai-input").or(guest).first().waitFor({ timeout: 12e4 });
  if (await guest.isVisible()) await guest.click();
  await page.getByTestId("ai-input").waitFor({ timeout: 12e4 });
  const baseline = await page.evaluate(async () => JSON.stringify((await import("/src/project/store.ts")).store.getCurrent()));
  // The guidance reaches the open project through the bundled-tileset ensure path.
  const guidance = await page.evaluate((expected) => {
    const project = JSON.parse(expected.baseline);
    return Object.entries(expected.ids).map(([ts, id]) => ({ tileset: ts, category: id, present: (project.tilesets[ts]?.referenceDocuments ?? []).some((c) => c.id === id) }));
  }, { baseline, ids: Object.fromEntries(Object.entries(shipped).map(([ts, k]) => [ts, k.id])) });
  assert(guidance.every((g) => g.present), JSON.stringify(guidance));
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor();
  const world = page.getByTestId("db-tab-group-world");
  if (await world.getAttribute("aria-expanded") === "false") await world.click();
  await page.getByTestId("db-tab-spatial-places").click();
  // Since the simplified map tabs (#1172) the source chips may be hidden; the default cards are listed either way.
  const defaults = page.getByTestId("spatial-source-defaults");
  if (await defaults.isVisible()) await defaults.click();
  await page.screenshot({ path: `${out}/place-library.png` });
  const proof = [];
  for (const plan of plans) {
    const expected = JSON.parse(fs.readFileSync(`public/assets/region-references/${plan.id}.oprn.json`)), map = expected.maps[plan.id];
    const id = `${plan.id}-${map.width}x${map.height}`;
    const actual = await page.evaluate(async (id2) => {
      const { preloadAllRegionReferences, readRegionReference } = await import("/src/project/regionReferenceSnapshots.ts"); await preloadAllRegionReferences();
      const lower = [], upper = [];
      for (let row = 0; row !== null;) { const r = readRegionReference(id2, row, 16); lower.push(...r.map.lowerTiles); upper.push(...r.map.upperTiles); row = r.map.nextRow; }
      return { lower, upper };
    }, id);
    assert.deepEqual(actual.lower, map.lowerTiles);
    assert.deepEqual(actual.upper, map.upperTiles);
    const card = page.getByTestId(`spatial-card-region-reference:${id}`);
    await card.scrollIntoViewIfNeeded();
    await card.click();
    // The preview lives in the 상세 inspector, which the simplified tabs keep closed by default.
    const toggle = page.getByTestId("spatial-inspector-toggle");
    if (await toggle.getAttribute("aria-pressed") !== "true") await toggle.click();
    const dimensions = await page.getByTestId("region-reference-preview").locator("img").evaluate(async (img) => { await img.decode(); return [img.naturalWidth, img.naturalHeight]; });
    assert.deepEqual(dimensions, [map.width * 16, map.height * 16]);
    const link = page.getByTestId("region-reference-download");
    const downloading = page.waitForEvent("download");
    await link.click();
    const download = await downloading;
    assert.deepEqual(JSON.parse(fs.readFileSync(await download.path())), expected);
    await page.screenshot({ path: `${out}/${plan.id}-place.png` });
    proof.push({ id, aiRowsExact: true, preview: dimensions, downloadExact: true });
  }
  assert.equal(await page.evaluate(async () => JSON.stringify((await import("/src/project/store.ts")).store.getCurrent())), baseline);
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/browser-proof.json`, JSON.stringify({ guidance, places: proof, activeProjectUnchanged: true, errors }, null, 2) + "\n");
  console.log(guidance, proof.length);
} finally {
  await browser.close();
}
