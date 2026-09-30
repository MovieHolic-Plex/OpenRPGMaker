// 사용법: node net-trace.mjs <url> [waitMs=25000]  부팅 뒤 POST/PUT 요청(저장 경로)과 응답 상태·크기를 나열한다.
import { chromium } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [url, waitArg] = process.argv.slice(2);
const wait = Number(waitArg ?? 25000);
const profile = mkdtempSync(join(tmpdir(), "f-nt-"));
const ctx = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1600, height: 900 }, args: ["--disable-features=NetworkChangeNotifier"] });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const t0 = Date.now();
const counts = new Map();
page.on("request", (r) => {
  if (r.method() === "GET") return;
  const u = r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 80);
  const size = r.postDataBuffer()?.length ?? 0;
  const key = `${r.method()} ${u.replace(/[0-9a-f]{40,}/g, "<sha>")}`;
  const c = counts.get(key) ?? { n: 0, bytes: 0, first: Date.now() - t0 };
  c.n += 1; c.bytes += size; counts.set(key, c);
});
page.on("response", async (r) => {
  if (r.request().method() === "GET") return;
  const u = r.url().replace(/^https?:\/\/[^/]+/, "");
  if (/assets|blob/.test(u)) return;
  let body = "";
  try { body = (await r.text()).slice(0, 300); } catch {}
  console.log(`[${Date.now() - t0}ms] ${r.request().method()} ${u.slice(0, 80)} -> ${r.status()} ${body}`);
});
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: "commit" });
await page.waitForFunction(() => !document.getElementById("oprn-boot-loader") && document.querySelector("canvas"), null, { timeout: 240000, polling: 100 });
console.log("ready", Date.now() - t0);
await page.waitForTimeout(wait);
for (const [k, v] of counts) console.log(k, v);
await ctx.close();
rmSync(profile, { recursive: true, force: true });
