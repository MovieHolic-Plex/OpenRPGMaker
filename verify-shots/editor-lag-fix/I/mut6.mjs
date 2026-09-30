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
  const del = (r) => { const p = r.parentRule ?? r.parentStyleSheet; if (!p) return false; const arr = [...p.cssRules]; const i = arr.indexOf(r); if (i >= 0) p.deleteRule(i); return i >= 0; };
  const rulesAll = rules.slice();
  let cur = t();
  // 이분: 규칙 집합을 절반씩 지워 원인 규칙을 찾는다
  const found = [];
  let pool = rulesAll.slice();
  for (let round = 0; round < 8 && cur > 5; round++) {
    let lo = 0, hi = pool.length, chosen = null;
    // 후보를 하나씩 지우며(누적) 처음으로 크게 떨어지는 지점 = 그 규칙이 원인
    for (let k = 0; k < pool.length; k++) { del(pool[k]); if (k % 8 === 7 || k === pool.length - 1) { const v = t(); if (v < cur - 6) { // 이 블록 안에 원인
          chosen = k; cur = v; break; } } }
    if (chosen === null) break;
    found.push(pool.slice(Math.max(0, chosen - 7), chosen + 1).map((r) => r.selectorText.slice(0, 160)));
    pool = pool.slice(chosen + 1);
  }
  out.push("blocks:\n" + found.map((f) => f.join("\n  ")).join("\n----\n"));
  return out.join("\n");
}));
await b.close();
