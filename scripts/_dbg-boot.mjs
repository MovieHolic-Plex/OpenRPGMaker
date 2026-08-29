import { chromium } from "playwright";
import { gotoWithRetry } from "./lib/goto-retry.mjs";

const BASE = process.env.DBG_BASE ?? "http://127.0.0.1:9173/";
const b = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
// 저장된 접힘 선호가 없는 "첫 방문" 상태를 재현한다.
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p = await ctx.newPage();
p.setDefaultTimeout(60000);
await p.addInitScript(() => {
  localStorage.setItem("oprn:editor-ui-mode", "expert");
  localStorage.removeItem("oprn:database.navCollapsed");
});
for (let i = 0; i < 4; i += 1) {
  try {
    await gotoWithRetry(p, BASE + "?freshProject=1", { waitUntil: "domcontentloaded", timeout: 120000, attempts: 3 });
    await p.waitForSelector('[data-testid="edit-canvas"]', { state: "visible", timeout: 45000 });
    break;
  } catch { await p.waitForTimeout(1500); }
}
await p.getByTestId("toolbar-database").click();
await p.waitForSelector('[data-testid="database-modal"]', { state: "visible" });
await p.waitForTimeout(900);

const probe = await p.evaluate(() => {
  const ids = ["db-tab-crops", "db-tab-common-events", "db-tab-terms", "db-tab-items", "db-tab-variables", "db-tab-tilesets"];
  const rail = document.querySelector(".database-modal-body .db-tabs");
  const out = ids.map((id) => {
    const n = document.querySelector(`[data-testid="${id}"]`);
    if (!(n instanceof HTMLElement)) return { id, missing: true };
    const r = n.getBoundingClientRect();
    return { id, display: getComputedStyle(n).display, box: `${Math.round(r.width)}x${Math.round(r.height)}` };
  });
  const hidden = Array.from(document.querySelectorAll(".db-tab")).filter((n) => n.getBoundingClientRect().width === 0).length;
  return { tabs: out, totalTabs: document.querySelectorAll(".db-tab").length, zeroBoxTabs: hidden, railScroll: rail ? `${rail.scrollHeight}/${rail.clientHeight}` : "?" };
});
console.log(JSON.stringify(probe, null, 1));

// 첫 방문에서 Playwright 가 실제로 탭을 클릭할 수 있는지(강제 없이) 확인한다.
try {
  await p.getByTestId("db-tab-crops").click({ timeout: 8000 });
  console.log("REAL CLICK on db-tab-crops: OK");
} catch (err) {
  console.log("REAL CLICK on db-tab-crops: FAILED —", String(err).slice(0, 120));
}
await b.close();
