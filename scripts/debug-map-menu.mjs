import { chromium } from "playwright";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:4173";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("dialog", (d) => d.accept());
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
await page.waitForTimeout(1000);

await page.getByTestId("menu-project").click();
await page.getByTestId("menu-project-new").click();
await page.waitForTimeout(1000);

await page.getByTestId("map-add").click();
await page.waitForTimeout(800);

const testid = await page.locator(".map-item.active").getAttribute("data-testid");
const mapId = testid.replace("map-tree-node-", "");
console.log("mapId", mapId);

const row = page.getByTestId(testid);
await row.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
console.log("row box", await row.boundingBox());

const trigger = page.getByTestId(`map-context-trigger-${mapId}`);
await trigger.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
console.log("trigger box", await trigger.boundingBox());

// click with real mouse at center of trigger
const box = await trigger.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(200);

let settings = page.getByTestId(`map-settings-${mapId}`);
console.log("settings count", await settings.count());
if ((await settings.count()) === 0) {
  // retry evaluate click
  await page.evaluate((id) => {
    document.querySelector(`[data-testid="map-context-trigger-${id}"]`)?.click();
  }, mapId);
  await page.waitForTimeout(200);
  settings = page.getByTestId(`map-settings-${mapId}`);
  console.log("settings count2", await settings.count());
}

if ((await settings.count()) > 0) {
  // click settings before scroll can fire - use force
  await settings.click({ force: true, noWaitAfter: true });
  await page.waitForTimeout(400);
  console.log("name visible", await page.getByTestId("map-name-input").isVisible().catch(() => false));
}

await page.screenshot({ path: "output/evidence/kingdom-legacy/debug-menu5.png", fullPage: true });
await browser.close();
