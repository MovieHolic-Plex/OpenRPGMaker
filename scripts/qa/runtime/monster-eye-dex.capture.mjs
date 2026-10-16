// 몬스터 눈 점검 — 도감 목록·상세에서 하네스 몬스터 15종이 보이는 모습을 출하 원본 해상도(480x320 기본)로 찍는다.
//   unshare -rn sh -c "ip link set lo up && node scripts/qa/runtime/monster-eye-dex.capture.mjs <campaign.json> <outDir>"
// 캠페인: `bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <out.json>` (모델 없이).
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 디버그 쓰기: 15종을 「발견」 처리(session.switches.mx_seen_<종>)해 도감 상세가 열리게 한다(report.debugWrites).
// 산출: <out>/dex-list-<n>.png, dex-<하네스종>.png (상세), report.json
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-eye-dex.capture.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/monster-eye-dex");
const project = JSON.parse(await readFile(resolve(projectArg), "utf8"));
const seed = JSON.parse(await readFile(resolve("harness-data/monster-collect-species/seed.json"), "utf8"));
const out = resolve(outArg ?? "qa-runs/monster-eye-dex");
await mkdir(out, { recursive: true });
const report = { debugWrites: ["mx_seen_<campaignSpecies> = true for the 15 harness species"], shots: [], errors: [] };
const [VW, VH] = (process.env.VP ?? "480x320").split("x").map(Number);
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier"] });
const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: Number(process.env.DSF ?? 1) })).newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:monster-eye-dex", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 240000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 240000 });
  // 오프닝·대화가 끝날 때까지 Enter — 한순간 비어 보이는 전환 틈에 속지 않도록 연속 3번 비어야 끝낸다.
  let quiet = 0;
  for (let i = 0; i < 120 && quiet < 3; i++) {
    const busy = (await present("cinematic-sequence")) || (await present("dialogue-box")) || (await present("title-screen"));
    quiet = busy ? 0 : quiet + 1;
    if (busy) await page.keyboard.press("Enter");
    await page.waitForTimeout(busy ? 250 : 400);
  }
  const campaignIds = seed.species.map((s) => s.campaignSpeciesId);
  await page.evaluate((ids) => { const s = window.__oprnHooksScene.session; for (const id of ids) s.switches[`mx_seen_${id}`] = true; }, campaignIds);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await page.keyboard.press("Enter"); // 첫 항목 = 도감
  await page.waitForTimeout(900);
  // 도감 줄 번호(001~)를 글자에서 읽어, 커서를 그 줄까지 내려 Enter 로 상세를 연다(보이지 않는 ??? 줄도 커서 칸을 차지한다).
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid^="campaign-dex-"]:not([data-testid*="-art-"]):not([data-testid="campaign-dex-meter"])')].map((n) => ({ id: n.dataset.testid.replace(/^campaign-dex-/, ""), no: Number((n.textContent.match(/^\s*(\d{3})/) ?? [])[1]) })));
  report.rows = rows;
  await page.screenshot({ path: join(out, "dex-list-0.png") });
  let cursor = 1;
  for (const row of rows.filter((r) => Number.isFinite(r.no)).sort((x, y) => x.no - y.no)) {
    const hit = seed.species.find((sp) => sp.campaignSpeciesId === row.id);
    if (!hit) continue;
    while (cursor < row.no) { await page.keyboard.press("ArrowDown"); cursor += 1; await page.waitForTimeout(90); }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
    const file = `dex-${hit.id}.png`;
    await page.screenshot({ path: join(out, file) });
    report.shots.push({ file, species: hit.id, campaignSpecies: row.id, no: row.no });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  await page.screenshot({ path: join(out, "error.png") }).catch(() => {});
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  await browser.close();
  await server.close();
}
console.log(report.errors.length ? "ERRORS:\n" + report.errors.join("\n") : `no page errors, ${report.shots.length} shots`);
