import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:4173";
const project = JSON.parse(await readFile("output/evidence/kingdom-legacy/project-export.json", "utf8"));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("dialog", (d) => d.accept());

// Normal boot → remote DB healthy first
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
await page.waitForTimeout(1000);
console.log("DB:", await page.getByTestId("db-connection-status").textContent());

// Replace in-memory project via import path: use FileChooser with the export JSON
const [chooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.getByTestId("menu-project").click().then(async () => {
    await page.getByTestId("menu-project-import").click();
  }),
]);
await chooser.setFiles({
  name: "왕국의_유산.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(project), "utf8"),
});
await page.waitForTimeout(1500);

const state = JSON.parse(await page.getByTestId("project-export-json").textContent());
const mapId = state.project.startMapId;
const map = state.project.maps[mapId];
console.log("after import:", {
  title: state.project.system?.titleScreen?.title,
  meta: state.project.meta?.title,
  map: map?.name,
  events: map?.events?.length,
  startMapId: mapId,
});

await page.getByTestId(`map-tree-node-${mapId}`).scrollIntoViewIfNeeded().catch(() => {});
await page.getByTestId(`map-tree-node-${mapId}`).click().catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: "output/evidence/kingdom-legacy/14-import-with-db-healthy.png", fullPage: true });

await page.getByTestId("mode-play").click();
if (await page.getByTestId("title-new-game").isVisible({ timeout: 5000 }).catch(() => false)) {
  await page.getByTestId("title-new-game").click();
}
await page.waitForTimeout(1000);
const first = map?.events?.[0];
if (first) {
  const marker = page.getByTestId(`event-${first.id}`);
  if (await marker.isVisible().catch(() => false)) {
    await marker.click({ force: true });
    await page.waitForTimeout(500);
    console.log("dialogue:", (await page.getByTestId("dialogue-box").textContent().catch(() => "")).slice(0, 100));
  }
}
await page.screenshot({ path: "output/evidence/kingdom-legacy/15-play-imported-kingdom.png" });
await browser.close();
console.log("done");
