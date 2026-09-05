import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const { firefox } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright-core");
const url = process.env.CATALOG_QA_URL ?? "http://127.0.0.1:29843";
const evidence = "output/evidence/inventory-catalog";
mkdirSync(evidence, { recursive: true });
const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
// The shared QA host also runs full repository gates; await actions, not fixed delays.
page.setDefaultTimeout(90000);
const errors = [], measurements = [];
page.on("pageerror", (error) => errors.push(error.message));
async function openSlotManager() {
  if (!(await page.getByTestId("db-equipment-slot-manager").evaluate((node) => node.open))) {
    await page.getByTestId("db-equipment-slot-manage").click();
  }
}
try {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto(`${url}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 90000 });
  for (const id of ["login-guest", "standard-welcome-start", "coach-mark-skip"]) {
    if (await page.getByTestId(id).isVisible()) await page.getByTestId(id).click();
  }
  await page.getByTestId("toolbar-database").click();
  const party = page.getByTestId("db-tab-group-party");
  if (!(await page.getByTestId("db-tab-items").isVisible())) await party.click();
  await page.getByTestId("db-tab-items").click();
  await page.getByTestId("db-inventory-catalog").waitFor();
  assert.equal(await page.getByTestId("db-tab-equipment").count(), 0);
  const initialCount = Number(await page.getByTestId("db-catalog-count").getAttribute("data-total-count"));
  const rows = page.locator(".db-catalog-rows [data-record-id]");
  assert.equal(await rows.count(), initialCount);
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: width === 1024 ? 768 : width === 1280 ? 800 : 900 });
    const modalBefore = await page.getByTestId("database-modal").boundingBox();
    for (const collection of ["items", "equipment"]) {
      await page.getByTestId(`db-catalog-filter-${collection}`).click();
      await page.locator(`.db-catalog-rows [data-collection="${collection}"]`).first().click();
      const geometry = await page.evaluate(({ width, collection }) => {
        const selectors = [".db-inventory-catalog", ".db-catalog-rows", ".db-catalog-detail", ".db-catalog-detail .db-ws-detail-body"];
        return { width, collection, documentOverflow: document.documentElement.scrollWidth > innerWidth,
          panes: selectors.map((selector) => {
            const node = document.querySelector(selector), rect = node.getBoundingClientRect();
            return { selector, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
              clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight,
              overflowY: getComputedStyle(node).overflowY };
          }) };
      }, { width, collection });
      assert.equal(geometry.documentOverflow, false);
      for (const pane of geometry.panes) {
        assert.ok(pane.width > 0 && pane.height > 100, JSON.stringify(geometry));
        assert.ok(pane.scrollWidth <= pane.clientWidth + 1, JSON.stringify(geometry));
      }
      assert.deepEqual(await page.getByTestId("database-modal").boundingBox(), modalBefore);
      measurements.push(geometry);
      await page.screenshot({ path: `${evidence}/${collection}-${width}.png` });
    }
  }
  console.log("Desktop geometry matrix passed");
  // Cross-collection search and keyboard focus are exercised through the actual controls.
  for (const collection of ["items", "equipment"]) {
    await page.getByTestId(`db-catalog-add-${collection}`).click();
    await page.getByTestId("db-field-name").fill(`공유 검색 ${collection}`);
  }
  await page.getByTestId("db-field-equipment-slot").selectOption("shield");
  assert.equal(await page.getByTestId("db-field-equipment-two-handed").count(), 0);
  await page.getByTestId("db-field-equipment-slot").selectOption("weapon");
  assert.equal(await page.getByTestId("db-field-equipment-two-handed").count(), 1);
  await page.getByTestId("db-field-equipment-two-handed").check();
  await openSlotManager();
  await page.getByTestId("db-equipment-slot-new-label").fill("신발");
  await page.getByTestId("db-equipment-slot-add").click();
  const slotId = await page.getByTestId("db-field-equipment-slot").inputValue();
  assert.ok(slotId.startsWith("slot_"));
  assert.equal(await page.getByTestId("db-field-equipment-two-handed").count(), 0);
  await openSlotManager();
  await page.getByTestId(`db-equipment-slot-label-${slotId}`).fill("발 보호구");
  await page.getByTestId(`db-equipment-slot-label-${slotId}`).press("Tab");
  assert.equal(await page.getByTestId("db-field-equipment-slot").inputValue(), slotId);
  assert.equal(await page.getByTestId("db-catalog-subtype").locator(`option[value="equipment:${slotId}"]`).innerText(), "장비 · 발 보호구");
  await openSlotManager();
  assert.equal(await page.getByTestId(`db-equipment-slot-remove-${slotId}`).isDisabled(), true);
  await page.screenshot({ path: `${evidence}/custom-slot-1440.png` });
  await page.getByTestId("db-equipment-slot-manage").click();
  const search = page.getByTestId("db-catalog-search");
  await search.fill("공유 검색");
  assert.equal(await rows.count(), 2);
  assert.equal(await search.evaluate((node) => document.activeElement === node), true);
  await page.getByTestId("db-catalog-filter-items").focus();
  await page.keyboard.press("Enter");
  assert.equal(await rows.count(), 1);
  assert.equal(await page.getByTestId("db-field-name").inputValue(), "공유 검색 equipment");
  await page.getByTestId("db-catalog-reveal-selection").click();
  assert.equal(await rows.count(), initialCount + 2);
  await page.getByTestId("db-view-toggle-gallery").click();
  assert.equal(await page.locator(".db-catalog-gallery .db-gallery-card").count(), initialCount + 2);
  await page.screenshot({ path: `${evidence}/gallery-1440.png` });
  await page.getByTestId("db-view-toggle-list").click();
  await page.getByTestId("db-catalog-duplicate").click();
  assert.equal(await rows.count(), initialCount + 3);
  await page.getByTestId("db-delete-selected").click();
  assert.equal(await rows.count(), initialCount + 3);
  await page.getByTestId("db-delete-selected").click();
  assert.equal(await rows.count(), initialCount + 2);
  console.log("Search, keyboard, gallery and guarded CRUD passed");
  await page.getByTestId("db-ai-generate-open").click();
  await page.getByTestId("db-ai-generate-dialog-item").waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${evidence}/ai-item-dialog.png` });
  assert.deepEqual(errors, []);
  writeFileSync(`${evidence}/measurements.json`, JSON.stringify({ measurements, errors, result: "pass" }, null, 2));
  console.log(JSON.stringify({ result: "pass", initialCount, evidence }));
} catch (error) {
  console.error(JSON.stringify({ errors, text: (await page.locator("body").innerText()).slice(-7000) }));
  await page.screenshot({ path: `${evidence}/failure.png` });
  throw error;
} finally { await browser.close(); }
