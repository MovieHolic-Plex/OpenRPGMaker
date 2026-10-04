import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto((process.env.QA_BASE_URL ?? "http://127.0.0.1:9850") + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const ctx = document.querySelector(".ai-deck-rail-ctx");
  const probe = () => { const r = []; for (let i = 0; i < 6; i++) { document.body.offsetHeight; ctx.firstChild ? (ctx.firstChild.data = "b" + i + Math.random()) : (ctx.textContent = "x" + i); const t0 = performance.now(); document.body.offsetHeight; r.push(performance.now() - t0); } return Math.min(...r).toFixed(1); };
  const out = { base: probe() };
  const rules = [];
  const walk = (list, sheet) => { for (const r of list) { if (r.cssRules && r.selectorText === undefined) walk(r.cssRules, r); else if (r.selectorText) rules.push([r, sheet]); } };
  for (const s of document.styleSheets) { try { walk(s.cssRules, s); } catch {} }
  const kinds = { bodyHas: /(^|,)\s*body:has\(/, deckHas: /\.ai-[a-z-]*[^,{]*:has\(/, anyBodyStar: /:has\(/ };
  const del = (re) => { let n = 0; for (let k = rules.length - 1; k >= 0; k--) { const [r] = rules[k]; if (!re.test(r.selectorText)) continue; const p = r.parentRule ?? r.parentStyleSheet; if (!p) continue; const i = [...p.cssRules].indexOf(r); if (i < 0) continue; p.deleteRule(i); n++; } return n; };
  out.bodyHasDeleted = del(kinds.bodyHas); out.afterBodyHas = probe();
  out.deckHasDeleted = del(/(^|[\s,>])\.ai-[^,]*:has\(|:is\(\.ai-deck[^)]*\)[^,]*:has\(/); out.afterAiHas = probe();
  return JSON.stringify(out);
}));
await b.close();
