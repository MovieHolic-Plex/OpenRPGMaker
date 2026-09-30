// 사용법: node boot-profile.mjs <url> <outJson> [warmups=1]
// CDP Profiler 로 부팅 CPU 프로필을 뜬다(워밍업 로드 후 새로고침 1회를 측정). 자기 시간(self) 상위 함수·파일별 합계를 낸다.
import { chromium } from "playwright";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, outFile, warmArg] = process.argv.slice(2);
const warm = Number(warmArg ?? 1);
const profile = mkdtempSync(join(tmpdir(), "f-prof-"));
const ctx = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1600, height: 900 }, args: ["--disable-features=NetworkChangeNotifier"] });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const ready = () => page.waitForFunction(() => !document.getElementById("oprn-boot-loader") && document.querySelector("canvas"), null, { timeout: 240000, polling: 100 });
await page.goto(url, { waitUntil: "commit" });
await ready();
for (let i = 0; i < warm; i += 1) { await page.reload({ waitUntil: "commit" }); await ready(); }
const cdp = await ctx.newCDPSession(page);
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
await cdp.send("Profiler.start");
const t0 = Date.now();
await page.reload({ waitUntil: "commit" });
await ready();
const wall = Date.now() - t0;
const { profile: prof } = await cdp.send("Profiler.stop");
const nodes = new Map(prof.nodes.map((n) => [n.id, n]));
const self = new Map();
const dt = prof.timeDeltas;
for (let i = 0; i < prof.samples.length; i += 1) self.set(prof.samples[i], (self.get(prof.samples[i]) ?? 0) + (dt[i] ?? 0));
const byFn = new Map();
const byFile = new Map();
let total = 0;
for (const [id, us] of self) {
  const n = nodes.get(id);
  const cf = n.callFrame;
  const file = (cf.url || "(native)").split("/").pop();
  const key = `${cf.functionName || "(anon)"} ${file}:${cf.lineNumber}`;
  byFn.set(key, (byFn.get(key) ?? 0) + us);
  byFile.set(file, (byFile.get(file) ?? 0) + us);
  total += us;
}
const top = (m, k) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, us]) => [n, Math.round(us / 1000)]);
const out = { url, wallMs: wall, totalCpuMs: Math.round(total / 1000), topFn: top(byFn, 40), topFile: top(byFile, 12) };
// inclusive 시간(자식 포함) 상위 — 정규화기 이름 위주로 보기 위해
const parent = new Map();
for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const incl = new Map();
for (const [id, us] of self) {
  const seen = new Set();
  for (let cur = id; cur; cur = parent.get(cur)) {
    const cf = nodes.get(cur).callFrame;
    const key = `${cf.functionName || "(anon)"} ${(cf.url || "").split("/").pop()}:${cf.lineNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    incl.set(key, (incl.get(key) ?? 0) + us);
  }
}
out.topInclusive = top(incl, 60);
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(`wall=${wall}ms cpu=${out.totalCpuMs}ms`);
console.log("file", JSON.stringify(out.topFile));
console.log("self", JSON.stringify(out.topFn.slice(0, 15)));
await ctx.close();
rmSync(profile, { recursive: true, force: true });
