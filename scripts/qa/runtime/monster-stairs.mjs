// 몬스터 캠페인 실내 층계 QA — 출하 플레이어(player.html, export shim)에서 집·센터 1층 계단을 실제로 걸어 올라가
// 2층에 서고, 2층 내려가는 계단을 걸어 내려와 1층 계단 앞에 서는지 본다. 층마다 화면을 찍는다.
//
//   node scripts/qa/runtime/monster-stairs.mjs <project.json> [outDir]   (unshare -rn 로 감싸 돌린다)
//
// 계단은 원래 막힌 소품이라 1층 계단을 밟을 수도, 2층에 갈 수도 없었다(2026-10-07 사용자 「계단도 통행도 안 되고 2층도」).
// 디버그 쓰기는 층계 앞으로 옮기는 teleport 뿐이고, 오르내림은 실제 방향 입력이다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-stairs.mjs <project.json> [outDir]");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg ?? "verify-shots/runtime-qa/monster-stairs");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const report = { project: projectArg, steps: [], errors: [], debugWrites: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 720 } })).newPage();
page.on("pageerror", (error) => report.errors.push(String(error?.message ?? error)));
page.on("console", (message) => { if (message.type() === "error") report.errors.push(`console: ${message.text()}`); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:monster-stairs", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

const step = (id, ok, detail, image) => { report.steps.push({ id, ok, detail, image }); console.log(ok ? "✓" : "✗", id, detail); };
const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.png`) }); return `${name}.png`; };
const present = (testid) => page.locator(`[data-testid="${testid}"]`).count().then((n) => n > 0);
const liveState = () => page.evaluate(() => window.__oprnDebug.readLive());
const pressEnterUntil = async (done, max = 80) => {
  for (let i = 0; i < max; i++) {
    if (await done()) { await page.waitForTimeout(800); if (await done()) return true; }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
  }
  return done();
};
const teleport = async (mapId, x, y) => {
  report.debugWrites.push(`teleport ${mapId} (${x},${y})`);
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(700);
};
/** 위로 걸어 맵이 바뀔 때까지(최대 몇 걸음) — 바뀐 맵과 자리를 돌려준다. */
const walkUpUntilMapChanges = async (from) => {
  for (let k = 0; k < 4; k++) {
    await page.evaluate(() => window.__oprnInput.dir("up"));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__oprnInput.dir(null));
    try { await page.waitForFunction((m) => window.__oprnDebug.readLive().currentMapId !== m, from, { timeout: 2500 }); break; } catch { /* 한 걸음 더 */ }
  }
  await page.waitForTimeout(900);
  return liveState();
};

const stairs = Object.values(project.maps).flatMap((map) => map.events.filter((e) => /_stairs_/.test(e.id)).map((e) => ({ map, e })));
// 위층으로 가는 계단(1층 쪽)만 출발점으로 — 짝 하나에 하나(왼쪽 발치 칸).
const ups = stairs.filter(({ map, e }) => !/_2f$/.test(map.id) && /_0$/.test(e.id));

try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await pressEnterUntil(async () => !(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen")));
  step("boot", true, `계단 짝 ${ups.length}개`);
  for (const { map, e } of ups) {
    const go = e.pages[0].commands.find((c) => c.kind === "transfer");
    const upper = project.maps[go.mapId];
    const name = map.id.replace(/^mx_map_/, "");
    await teleport(map.id, e.x, e.y + 1);
    const at1 = await shot(`${name}-1f`);
    const s1 = await walkUpUntilMapChanges(map.id);
    const okUp = s1.currentMapId === upper.id && s1.x === go.x && s1.y === go.y;
    step(`${name}:up`, okUp, `${map.id} (${e.x},${e.y + 1}) ↑ → ${s1.currentMapId} (${s1.x},${s1.y}) 기대 ${upper.id} (${go.x},${go.y})`, at1);
    const at2 = await shot(`${name}-2f`);
    if (!okUp) continue;
    const s2 = await walkUpUntilMapChanges(upper.id);
    const okDown = s2.currentMapId === map.id && s2.x === e.x && s2.y === e.y + 1;
    step(`${name}:down`, okDown, `${upper.id} ↑(내려가는 계단) → ${s2.currentMapId} (${s2.x},${s2.y}) 기대 ${map.id} (${e.x},${e.y + 1})`, at2);
  }
} catch (error) {
  report.failure = String(error?.stack ?? error);
  await shot("failure").catch(() => {});
  console.error(report.failure);
} finally {
  const failed = report.steps.filter((s) => !s.ok);
  report.ok = !report.failure && failed.length === 0 && report.errors.length === 0;
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(out, "SUMMARY.md"), [
    `# monster-stairs — ${report.ok ? "통과" : "실패"}`, "",
    ...report.steps.map((s) => `- ${s.ok ? "✓" : "✗"} ${s.id}: ${s.detail}${s.image ? ` (${s.image})` : ""}`), "",
    `즉시 확인: ${failed.map((s) => s.image).filter(Boolean).join(", ") || "home_house-2f.png, home_center-2f.png"}`, "",
    `디버그 쓰기: ${report.debugWrites.length}회 teleport(층계 앞)`, "",
    report.failure ? `예외: ${report.failure}` : "", ...report.errors.slice(0, 15).map((e) => `- 오류: ${e}`),
  ].join("\n"));
  await browser.close();
  await server.close();
}
process.exit(report.ok ? 0 : 1);
