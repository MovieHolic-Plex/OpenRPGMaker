import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto((process.env.QA_BASE_URL ?? "http://127.0.0.1:9850") + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const btn = document.querySelector("[data-testid='layer-upper']");
  const measure = () => { const r = []; for (let i = 0; i < 3; i++) { document.body.offsetHeight; btn.classList.toggle("is-active"); const t0 = performance.now(); document.body.offsetHeight; r.push(performance.now() - t0); document.body.offsetHeight; } return Math.min(...r); };
  const cands = [];
  const walk = (rules, parent) => { for (let i = 0; i < rules.length; i++) { const r = rules[i]; if (r.cssRules && !r.selectorText) walk(r.cssRules, r); else if (r.selectorText && /is-active/.test(r.selectorText)) cands.push({ r, parent: parent ?? r.parentStyleSheet, sel: r.selectorText }); if (r.styleSheet) { try { walk(r.styleSheet.cssRules, r.styleSheet); } catch {} } } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules, null); } catch {} }
  return cands.map(c=>c.sel.slice(0,230)).filter(x=>/:has|:not|:is|:where|~|\+/.test(x)).join('\n');
}));
await b.close();
