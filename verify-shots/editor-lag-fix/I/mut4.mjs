import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto((process.env.QA_BASE_URL ?? "http://127.0.0.1:9850") + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const ctx = document.querySelector(".ai-deck-rail-ctx");
  const t = () => { const r = []; for (let i = 0; i < 4; i++) { document.body.offsetHeight; ctx.textContent = "x" + i + Math.random(); const t0 = performance.now(); document.body.offsetHeight; r.push(performance.now() - t0); } return Math.min(...r); };
  const out = [`base ${t().toFixed(1)}`];
  const rules = [];
  const walk = (rs) => { for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && r.selectorText.includes(":has(")) rules.push(r); } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
  // group delete: body:has rules
  const del = (r) => { const p = r.parentRule ?? r.parentStyleSheet; const arr = [...p.cssRules]; const i = arr.indexOf(r); if (i >= 0) p.deleteRule(i); return i >= 0; };
  const cand = rules.filter((r) => /^(body|html)/.test(r.selectorText) || /(^|,\s*)body:has/.test(r.selectorText));
  out.push(`body-has rules ${cand.length}`);
  for (const r of cand) { const sel = r.selectorText.slice(0, 120); del(r); out.push(`after del [${sel}] ${t().toFixed(1)}`); }
  return out.join("\n");
}));
await b.close();
