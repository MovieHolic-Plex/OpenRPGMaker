import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto((process.env.QA_BASE_URL ?? "http://127.0.0.1:9850") + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const ctx = document.querySelector(".ai-deck-rail-ctx");
  const probe = () => { const r = []; for (let i = 0; i < 5; i++) { document.body.offsetHeight; ctx.firstChild.data = "b" + i + Math.random(); const t0 = performance.now(); document.body.offsetHeight; r.push(performance.now() - t0); } return +Math.min(...r).toFixed(1); };
  const rules = [];
  const walk = (list) => { for (const r of list) { if (r.selectorText !== undefined) { if (/:has\(/.test(r.selectorText)) rules.push(r); } else if (r.cssRules) walk(r.cssRules); } };
  for (const s of document.styleSheets) { try { walk(s.cssRules); } catch {} }
  const fam = (r) => r.selectorText.split(",")[0].trim().split(/[\s>+~]/)[0].replace(/:.*/, "");
  const groups = {};
  for (const r of rules) (groups[fam(r)] ??= []).push(r);
  const out = { base: probe(), total: rules.length, fams: {} };
  const remove = (r) => { const p = r.parentRule ?? r.parentStyleSheet; if (!p) return; const i = [...p.cssRules].indexOf(r); if (i >= 0) p.deleteRule(i); };
  // per family: delete cumulatively
  for (const [f, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    for (const r of list) remove(r);
    out.fams[f + "(" + list.length + ")"] = probe();
  }
  return JSON.stringify(out, null, 1);
}));
await b.close();
