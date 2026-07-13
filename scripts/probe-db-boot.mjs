import { chromium } from "playwright";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("dialog", (d) => d.accept());

console.log("boot / without freshProject…");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);

const required = page.getByTestId("db-required-panel");
const canvas = page.getByTestId("edit-canvas");
const db = page.getByTestId("db-connection-status");

if (await required.isVisible().catch(() => false)) {
  const msg = await required.innerText();
  console.log("STILL DB REQUIRED:\n", msg.slice(0, 500));
  await page.screenshot({ path: "output/evidence/kingdom-legacy/13-db-required-after-fix.png", fullPage: true });
} else if (await canvas.isVisible().catch(() => false)) {
  console.log("EDITOR OPENED");
  console.log("DB badge:", await db.textContent().catch(() => null), await db.getAttribute("title").catch(() => null));
  const state = JSON.parse(await page.getByTestId("project-export-json").textContent());
  console.log("loaded project meta:", state.project.meta?.title, "startMap:", state.project.startMapId);
  await page.screenshot({ path: "output/evidence/kingdom-legacy/13-db-boot-ok.png", fullPage: true });
} else {
  console.log("UNKNOWN STATE body:", (await page.locator("body").innerText()).slice(0, 400));
  await page.screenshot({ path: "output/evidence/kingdom-legacy/13-db-unknown.png", fullPage: true });
}

await browser.close();
