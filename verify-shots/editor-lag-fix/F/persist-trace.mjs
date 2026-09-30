// 사용법: node persist-trace.mjs <url> <project.sqlite> [waitSaveSec=150]
// 마이그 결과가 저장돼 다음 로드가 빠른 길을 타는지: 로드 -> 준비 -> (지연 저장이 끝날 때까지 revision 폴링) -> 새로고침 -> 준비 시간 비교.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, sqlite, waitArg] = process.argv.slice(2);
const waitSec = Number(waitArg ?? 150);
const q = (sql) => execFileSync("sqlite3", ["-readonly", sqlite, sql], { encoding: "utf8" }).trim();
const state = () => q("select revision||'|'||length(current_json)||'|'||current_sha256 from project; select count(*) from assets; select count(*) from tileset_blobs;").split("\n").join(" / ");

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "f-persist-")), { headless: true, viewport: { width: 1600, height: 900 }, args: ["--disable-features=NetworkChangeNotifier", "--disable-background-networking"] });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const logs = [];
page.on("console", (m) => { const t = m.text(); if (/정규화|분리|저장|save|migrat|asset/i.test(t)) logs.push(t.slice(0, 160)); });

const ready = async (i) => {
  const t0 = Date.now();
  if (i === 0) await page.goto(url, { waitUntil: "commit" }); else await page.reload({ waitUntil: "commit" });
  await page.waitForFunction(() => !document.getElementById("oprn-boot-loader") && document.querySelector("canvas"), null, { timeout: 240000, polling: 100 });
  return Date.now() - t0;
};

console.log("시작 상태:", state());
const out = [];
for (let round = 0; round < 3; round += 1) {
  const ms = await ready(round);
  const at = state();
  // 저장이 revision 을 올릴 때까지 기다린다(지연 자동저장).
  const start = Date.now();
  const rev0 = Number(at.split("|")[0]);
  let saved = false;
  while (Date.now() - start < waitSec * 1000) {
    await new Promise((r) => setTimeout(r, 2000));
    if (Number(state().split("|")[0]) > rev0) { saved = true; break; }
    if (round > 0 && Date.now() - start > 20000) break; // 이미 저장된 뒤 라운드는 20초만 본다
  }
  const after = state();
  out.push({ round, readyMs: ms, stateAtReady: at, savedAfterReady: saved, waitedSec: Math.round((Date.now() - start) / 1000), stateAfter: after });
  console.log(JSON.stringify(out.at(-1)));
}
console.log(JSON.stringify({ logs: logs.slice(0, 20) }, null, 1));
await ctx.close();
