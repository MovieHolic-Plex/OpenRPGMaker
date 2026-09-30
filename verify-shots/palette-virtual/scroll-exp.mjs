import { chromium } from "playwright";
const variants = JSON.parse(process.argv[2] || '{"base":""}');
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1600, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto("http://127.0.0.1:9863/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate((t) => window.__oprnEditorStore.update((d) => { d.maps[d.startMapId].tilesetId = t; }), process.env.TS || "beodeul_city");
await page.waitForSelector("[data-testid^='chipset-tile-']", { timeout: 60000 });
await page.waitForTimeout(4000);
for (const [name, css] of Object.entries(variants)) {
  await page.evaluate((s) => { window.__speed = s; }, Number(process.env.SPEED || 60)); await page.evaluate((css) => { document.getElementById("exp")?.remove(); const s = document.createElement("style"); s.id = "exp"; s.textContent = css; document.head.append(s); }, css);
  const rs = [];
  for (let i = 0; i < 3; i++) rs.push(await page.evaluate(async () => {
    const sheet = document.querySelector("[data-testid='tile-palette']"); sheet.scrollTop = 0; await new Promise(r => setTimeout(r, 400));
    const d = []; let last = performance.now(); const start = last;
    await new Promise((res) => { const step = () => { const n = performance.now(); d.push(n - last); last = n; sheet.scrollTop += Number(window.__speed || 60); if (n - start < 1500) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    d.shift(); d.sort((a, b) => a - b);
    return [d[Math.floor(d.length * .5)], d[Math.floor(d.length * .95)], d[d.length - 1]].map(x => Math.round(x * 10) / 10);
  }));
  console.log(name, JSON.stringify(rs), "cells", await page.evaluate(() => document.querySelectorAll(".chipset-tile").length));
}
await b.close();
