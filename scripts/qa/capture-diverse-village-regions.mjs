// Focused publication evidence; read-only browser session, no canonical project mutations.
import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const out = "verify-shots/village-diversity";
fs.mkdirSync(out, { recursive: true });
const plans = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json")).plans;
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
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor();
  const world = page.getByTestId("db-tab-group-world");
  if (await world.getAttribute("aria-expanded") === "false") await world.click();
  await page.getByTestId("db-tab-spatial-regions").click();
  // Since the simplified map tabs (#1172) the source chips may be hidden; the default cards are listed either way.
  const defaults = page.getByTestId("spatial-source-defaults");
  if (await defaults.isVisible()) await defaults.click();
  await page.screenshot({ path: `${out}/region-library.png` });
  const proof = [];
  for (const plan of plans) {
    const id = `${plan.id}-${plan.width}x${plan.height}`;
    const expected = JSON.parse(fs.readFileSync(`public/assets/region-references/${plan.id}.oprn.json`));
    const actual = await page.evaluate(async (id2) => {
      const { preloadAllRegionReferences, readRegionReference } = await import("/src/project/regionReferenceSnapshots.ts"); await preloadAllRegionReferences();
      const lower = [], upper = [];
      let row = 0;
      while (row !== null) {
        const r = readRegionReference(id2, row, 16);
        lower.push(...r.map.lowerTiles);
        upper.push(...r.map.upperTiles);
        row = r.map.nextRow;
      }
      return { lower, upper };
    }, id);
    assert.deepEqual(actual.lower, expected.maps[plan.id].lowerTiles);
    assert.deepEqual(actual.upper, expected.maps[plan.id].upperTiles);
    await page.getByTestId(`spatial-card-region-reference:${id}`).click();
    const dimensions = await page.getByTestId("region-reference-preview").locator("img").evaluate(async (img) => {
      await img.decode();
      return [img.naturalWidth, img.naturalHeight];
    });
    assert.deepEqual(dimensions, [plan.width * 16, plan.height * 16]);
    const link = page.getByTestId("region-reference-download");
    if (!await link.isVisible()) await page.getByTestId("spatial-inspector-toggle").click();
    const visiblePreview = await page.getByTestId("region-reference-preview").boundingBox();
    assert(visiblePreview.width >= 250 && visiblePreview.height >= 180);
    const downloading = page.waitForEvent("download");
    await link.click();
    const download = await downloading;
    assert.deepEqual(JSON.parse(fs.readFileSync(await download.path())), expected);
    await page.screenshot({ path: `${out}/${plan.id}-region.png` });
    proof.push({ id, aiRowsExact: true, preview: dimensions, downloadExact: true, filename: download.suggestedFilename() });
  }
  // The river villages are also listed under 장소, reading the same snapshot.
  await page.getByTestId("db-tab-spatial-places").click();
  if (await defaults.isVisible()) await defaults.click();
  const places = [];
  for (const plan of plans.filter((p) => p.id === "twin-falls-river-village" || p.series === "concept")) {
    const id = `${plan.id}-place-${plan.width}x${plan.height}`;
    const rows = await page.evaluate(async (id2) => {
      const { preloadAllRegionReferences, readRegionReference } = await import("/src/project/regionReferenceSnapshots.ts"); await preloadAllRegionReferences();
      const lower = [];
      for (let row = 0; row !== null;) { const r = readRegionReference(id2, row, 16); lower.push(...r.map.lowerTiles); row = r.map.nextRow; }
      return lower;
    }, id);
    assert.deepEqual(rows, JSON.parse(fs.readFileSync(`public/assets/region-references/${plan.id}.oprn.json`)).maps[plan.id].lowerTiles);
    await page.getByTestId(`spatial-card-region-reference:${id}`).click();
    await page.screenshot({ path: `${out}/${plan.id}-place.png` });
    places.push({ id, aiRowsExact: true, card: true });
  }
  assert.equal(await page.evaluate(async () => JSON.stringify((await import("/src/project/store.ts")).store.getCurrent())), baseline);
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/region-browser-proof.json`, JSON.stringify({ regions: proof, places, activeProjectUnchanged: true, errors }, null, 2));
  console.log(proof);
} finally {
  await browser.close();
}
