import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto((process.env.QA_BASE_URL ?? "http://127.0.0.1:9850") + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const btn = document.querySelector("[data-testid='layer-upper']");
  const measure = () => { const r = []; for (let i = 0; i < 4; i++) { document.body.offsetHeight; btn.classList.toggle("is-active"); const t0 = performance.now(); document.body.offsetHeight; r.push(performance.now() - t0); document.body.offsetHeight; } return Math.min(...r).toFixed(1); };
  const before = measure(); let del = 0;
  const walk = (rules) => { for (let i = rules.length - 1; i >= 0; i--) { const r = rules[i]; if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && r.selectorText.includes(":has(") && r.selectorText.includes("map-tree-facet")) { (r.parentRule ?? r.parentStyleSheet).deleteRule(i); del++; } } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
  return `before ${before} deleted ${del} after ${measure()}`;
}));
await b.close();
