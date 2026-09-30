import { chromium } from "playwright";
const b = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { localStorage.setItem("oprn:standard-welcome-seen", "1"); localStorage.setItem("oprn:ai-panel-collapsed", "1"); });
await page.goto((process.env.QA_BASE_URL ?? "http://127.0.0.1:9850") + "/?freshProject=1", { waitUntil: "domcontentloaded" });
await page.getByTestId("edit-canvas").waitFor({ timeout: 90000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => {
  const out = [];
  const walk = (rules) => { for (const r of rules) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && r.selectorText.includes(":has(")) {
    // full selector must match some element right now, or subject must be an ancestor of rail-ctx/panel
    let m = 0; try { m = document.querySelectorAll(r.selectorText).length; } catch {}
    for (const part of r.selectorText.split(/,(?![^()]*\))/)) { if (!part.includes(":has(")) continue;
      // the element carrying :has: strip trailing descendant part after the last ")" of :has
      const idx = part.indexOf(":has("); let depth = 0, j = idx + 5; for (; j < part.length; j++) { if (part[j] === "(") depth++; else if (part[j] === ")") { if (depth === 0) break; depth--; } }
      const subj = part.slice(0, j + 1).trim();
      let n = 0; try { n = document.querySelectorAll(subj).length; } catch {}
      if (n > 0) out.push(`${n}\t${subj.slice(0, 220)}`); } } } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch {} }
  return [...new Set(out)].join("\n");
}));
await b.close();
