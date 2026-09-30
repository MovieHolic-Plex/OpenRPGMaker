// 사용법: node reload-bench.mjs <url> <label> [reloads=4] [outFile]
// 영구 프로필(HTTP 캐시 유지) Playwright 로 편집기 로드→상호작용 가능까지를 잰다.
//  - 1회차 = 콜드(캐시 없음), 이후 = 새로고침(캐시 따뜻).
//  - 「상호작용 가능」 = #oprn-boot-loader 가 사라지고 편집기 캔버스(canvas)가 있는 시점.
//  - 단계 표식: 로더 문구가 바뀌는 시각을 MutationObserver 로 기록(prepare/shared/project/editor).
//  - 전송량: performance resource entries 에서 JS/JSON(fetch·xhr)을 종류별로 합산.
import { chromium } from "playwright";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, label, reloadsArg, outFile] = process.argv.slice(2);
const reloads = Number(reloadsArg ?? 4);
const profile = mkdtempSync(join(tmpdir(), "f-bench-profile-"));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: true,
  viewport: { width: 1600, height: 900 },
  args: ["--disable-features=NetworkChangeNotifier", "--disable-background-networking"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });

await page.addInitScript(() => {
  window.__stages = [];
  const start = () => {
    const attach = () => {
      const loader = document.getElementById("oprn-boot-loader");
      if (!loader) return false;
      let last = "";
      const note = () => {
        const t = loader.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (t !== last) { last = t; window.__stages.push([Math.round(performance.now()), t.slice(0, 40)]); }
      };
      new MutationObserver(note).observe(loader, { subtree: true, childList: true, characterData: true });
      note();
      return true;
    };
    if (!attach()) {
      const mo = new MutationObserver(() => { if (attach()) mo.disconnect(); });
      const root = document.documentElement || document;
      mo.observe(root, { childList: true, subtree: true });
    }
  };
  start();
});

const rows = [];
for (let i = 0; i < reloads; i += 1) {
  const t0 = Date.now();
  if (i === 0) await page.goto(url, { waitUntil: "commit" });
  else await page.reload({ waitUntil: "commit" });
  await page.waitForFunction(() => !document.getElementById("oprn-boot-loader") && document.querySelector("canvas"), null, { timeout: 180000, polling: 100 });
  const readyMs = await page.evaluate(() => Math.round(performance.now()));
  const wall = Date.now() - t0;
  const info = await page.evaluate(() => {
    const res = performance.getEntriesByType("resource");
    let js = 0, jsn = 0, jsonCount = 0, jsCount = 0;
    const big = [];
    for (const r of res) {
      const isJs = /\.js(\?|$)/.test(r.name);
      const isApi = r.initiatorType === "fetch" || r.initiatorType === "xmlhttprequest";
      const size = r.transferSize || 0;
      const decoded = r.decodedBodySize || 0;
      if (isJs) { js += size; jsCount += 1; big.push([decoded, r.name.split("/").pop()]); }
      else if (isApi) { jsn += size; jsonCount += 1; big.push([decoded, r.name.replace(location.origin, "").slice(0, 60)]); }
    }
    big.sort((a, b) => b[0] - a[0]);
    const nav = performance.getEntriesByType("navigation")[0];
    return { jsTransfer: js, jsCount, fetchTransfer: jsn, fetchCount: jsonCount, top: big.slice(0, 5), stages: window.__stages, domInteractive: Math.round(nav?.domInteractive ?? 0) };
  });
  rows.push({ run: i + 1, readyMs, wall, ...info });
  console.log(`[${label}] run ${i + 1}: ready=${readyMs}ms wall=${wall}ms jsTransfer=${info.jsTransfer} fetchTransfer=${info.fetchTransfer} stages=${JSON.stringify(info.stages)} top=${JSON.stringify(info.top)}`);
  await page.waitForTimeout(1500);
}
console.log(`[${label}] errors: ${JSON.stringify(errors.slice(0, 5))}`);
if (outFile) writeFileSync(outFile, JSON.stringify({ label, url, rows, errors: errors.slice(0, 10) }, null, 1));
await ctx.close();
rmSync(profile, { recursive: true, force: true });
