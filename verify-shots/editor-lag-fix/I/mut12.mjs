import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto((process.env.QA_BASE_URL ?? "http://127.0.0.1:9850") + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const out = {};
  const ctx = document.querySelector(".ai-deck-rail-ctx");
  const probe = () => { const r = []; for (let i = 0; i < 5; i++) { document.body.offsetHeight; ctx.firstChild.data = "b" + i + Math.random(); const t0 = performance.now(); document.body.offsetHeight; r.push(performance.now() - t0); } return +Math.min(...r).toFixed(1); };
  out.base = probe();
  const bd = document.querySelector(".database-modal-backdrop.is-parked");
  bd.style.contentVisibility = "hidden";
  out.contentVisHidden = probe();
  // show it again and time the reveal
  bd.style.contentVisibility = ""; document.body.offsetHeight;
  const t0 = performance.now(); bd.classList.remove("is-parked"); bd.style.visibility = ""; document.body.offsetHeight; out.reveal = +(performance.now() - t0).toFixed(1);
  return JSON.stringify(out, null, 1);
}));
await b.close();
