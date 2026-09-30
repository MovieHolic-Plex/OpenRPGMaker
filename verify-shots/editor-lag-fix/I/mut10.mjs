import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto((process.env.QA_BASE_URL ?? "http://127.0.0.1:9850") + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const out = {};
  const t = (name, el) => { const r = []; for (let i = 0; i < 5; i++) { document.body.offsetHeight; const s = document.createElement("i"); el.append(s); s.textContent = "x"; const t0 = performance.now(); document.body.offsetHeight; r.push(performance.now() - t0); s.remove(); } out[name] = +Math.min(...r).toFixed(1); };
  const ctx = document.querySelector(".ai-deck-rail-ctx");
  t("ctx", ctx);
  let chain = []; for (let e = ctx; e; e = e.parentElement) chain.push(e);
  chain.forEach((e) => t((e.className?.toString().split(" ")[0] || e.tagName) + "@" + chain.indexOf(e), e));
  t("leftpanel", document.querySelector(".left-panel") ?? document.body);
  t("canvasArea", document.querySelector(".canvas-area") ?? document.body);
  return JSON.stringify(out, null, 1);
}));
await b.close();
