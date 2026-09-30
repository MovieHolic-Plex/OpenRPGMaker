// 사용법: node probe-state.mjs <url> [expr]
// 부팅 뒤 로그·오류·저장 상태·타일셋별 참고문서 수를 읽는다.
import { chromium } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [url, expr] = process.argv.slice(2);
const profile = mkdtempSync(join(tmpdir(), "f-ps-"));
const ctx = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1600, height: 900 }, args: ["--disable-features=NetworkChangeNotifier"] });
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("[console]", m.type(), m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: "commit" });
await page.waitForFunction(() => !document.getElementById("oprn-boot-loader") && document.querySelector("canvas"), null, { timeout: 240000, polling: 100 });
await page.waitForTimeout(8000);
const out = await page.evaluate((e) => {
  const store = window.__oprnEditorStore;
  const cur = store?.getCurrent?.();
  const ts = cur ? Object.entries(cur.tilesets).map(([id, t]) => [id, (t.referenceDocuments ?? []).length]) : null;
  const res = { logs: JSON.stringify(window.__oprnLogs ?? null)?.slice(0, 2500), errors: JSON.stringify(window.__oprnErrors ?? null)?.slice(0, 1500), ts, storeKeys: store ? Object.getOwnPropertyNames(Object.getPrototypeOf(store)).slice(0, 80) : null };
  if (e) res.eval = String(eval(e));
  return res;
}, expr ?? null);
console.log(JSON.stringify(out, null, 1));
await ctx.close();
rmSync(profile, { recursive: true, force: true });
