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
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
const get = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
for (const [name, css] of Object.entries(variants)) {
  await page.evaluate((css) => { document.getElementById("exp")?.remove(); if (css) { const s = document.createElement("style"); s.id = "exp"; s.textContent = css; document.head.append(s); } }, css);
  await page.waitForTimeout(1000);
  const out = [];
  for (let i = 0; i < 3; i++) {
    const a = await get();
    if (process.env.SPEED) await page.evaluate(async (sp) => { const sh = document.querySelector("[data-testid='tile-palette']"); sh.scrollTop = 0; const t0 = performance.now(); await new Promise(res => { const st = () => { sh.scrollTop += sp; if (performance.now() - t0 > 3000) res(); else requestAnimationFrame(st); }; st(); }); }, Number(process.env.SPEED));
    else await page.waitForTimeout(3000);
    const c = await get();
    const f = (k) => Math.round((c[k] - a[k]) * 1000 / 3);
    out.push(`task ${f("TaskDuration")} lay ${f("LayoutDuration")} sty ${f("RecalcStyleDuration")} js ${f("ScriptDuration")} ms/s`);
  }
  console.log(name, out.join(" | "));
}
await b.close();
