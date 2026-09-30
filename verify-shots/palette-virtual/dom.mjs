import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto("http://127.0.0.1:9863/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate(() => window.__oprnEditorStore.update((d) => { d.maps[d.startMapId].tilesetId = "beodeul_city"; }));
await page.waitForSelector("[data-testid^='chipset-tile-']", { timeout: 60000 });
await page.waitForTimeout(8000);
console.log(await page.evaluate(() => {
  const root = document.querySelector("[data-testid='left-palette-root']");
  const out = {};
  const pal = document.querySelector("[data-testid='tile-palette']");
  for (const ch of root.querySelectorAll("*")) { if (pal.contains(ch)) continue; }
  const walk = (e, d) => { const n = e.querySelectorAll("*").length; if (n > 300 && d < 6) { out[(e.dataset.testid || e.className || e.tagName).toString().slice(0,50) + "@" + d] = n; for (const c of e.children) walk(c, d + 1); } };
  walk(root, 0);
  return JSON.stringify(out);
}));
await b.close();
