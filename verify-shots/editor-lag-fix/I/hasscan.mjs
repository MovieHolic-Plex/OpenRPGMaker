import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto((process.env.QA_BASE_URL ?? "http://127.0.0.1:9850") + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(2000);
console.log(await page.evaluate(() => {
  const btn = document.querySelector("[data-testid='layer-upper']");
  const out = [];
  const walk = (rules) => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && r.selectorText.includes(":has(")) {
    for (const part of r.selectorText.split(/,(?![^()]*\))/)) { if (!part.includes(":has(")) continue;
      const m = part.match(/^(.*?):has\(/); const anchor = m ? m[1].trim().split(/\s+/).pop() : "";
      let hit = false; try { hit = btn.closest(part.replace(/:has\(.*$/, "").trim() || "*") !== null && /:has\(/.test(part); } catch {}
      if (hit && /is-active|aria-current|tabindex|layer|active/.test(part)) out.push(part.trim().slice(0, 200)); } } } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
  return [...new Set(out)].slice(0, 40).join("\n");
}));
await b.close();
