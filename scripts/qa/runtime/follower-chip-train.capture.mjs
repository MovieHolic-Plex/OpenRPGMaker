// 몬스터 하네스 걷기 칩(따라다니기) 실화면 캡처 — 출하 플레이어(player.html + export shim) 한정.
//   bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <campaign.json>
//   node scripts/qa/runtime/follower-chip-train.capture.mjs <campaign.json> <outDir>
// 캠페인 종 중 걷기 칩이 있는 종(fieldGraphic.sprite.id 가 harness 시트)을 6마리씩 열차로 세워 네 방향으로 걷고,
// 맵 이동·탈것 탑승(동료 숨김)·하차(복귀)까지 찍는다. 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 게이트·vitest 아님.
// 열차 구성은 세션 followers 를 직접 써서 만든다(디버그 쓰기, 보고서에 기록).
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: follower-chip-train.capture.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/follower-chip-train");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg ?? "qa-runs/follow-chips/out");
await mkdir(out, { recursive: true });
const withChip = project.database.monsterSpecies.filter((s) => /harness_monster/.test(s.graphic?.fieldGraphic?.sprite?.id ?? ""));
const batches = []; for (let i = 0; i < withChip.length; i += 6) batches.push(withChip.slice(i, i + 6));
const report = { species: withChip.map((s) => s.id), shots: [], errors: [], debugWrites: [] };

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text()); });
await page.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:follower-chip-train", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

const shot = async (name) => { const file = join(out, name + ".png"); await page.screenshot({ path: file }); report.shots.push(name); };
const teleport = async (mapId, x, y) => {
  report.debugWrites.push(`teleport ${mapId} (${x},${y})`);
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(600);
};
const walk = async (dir, ms) => { await page.evaluate((d) => window.__oprnInput.dir(d), dir); await page.waitForTimeout(ms); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(350); };
const setTrain = (speciesList) => page.evaluate((list) => {
  const s = window.__oprnHooksScene.session;
  s.followers = list.map((sp, i) => ({ id: `monster:qa${i}`, name: sp.name, graphic: { ...sp.graphic.fieldGraphic }, kind: "monster", monsterInstanceId: `qa${i}` }));
  s.followerTrail = [];
}, speciesList);
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);

try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 180000 });
  // 오프닝 대사·컷신이 모두 닫힐 때까지(연속 4번 없음) Enter.
  let quiet = 0;
  for (let i = 0; i < 160 && quiet < 4; i++) {
    const busy = (await present("cinematic-sequence")) || (await present("dialogue-box")) || (await present("title-screen")) || (await page.locator(".dialogue-box").count()) > 0;
    quiet = busy ? 0 : quiet + 1;
    if (busy) await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }
  report.debugWrites.push(`opening dismissed quiet=${quiet}`);
  const home = await page.evaluate(() => window.__oprnDebug.readLive());
  const start = { x: home.x, y: home.y };
  const homeMap = home.currentMapId;
  report.debugWrites.push(`start ${homeMap} (${start.x},${start.y})`);
  for (const [bi, batch] of batches.entries()) {
    await teleport(homeMap, start.x, start.y);
    await setTrain(batch);
    report.debugWrites.push(`followers batch${bi + 1}: ${batch.map((s) => s.id).join(",")}`);
    await walk("right", 1300); await shot(`train${bi + 1}-right`);
    await walk("down", 900); await shot(`train${bi + 1}-down`);
    await walk("left", 1300); await shot(`train${bi + 1}-left`);
    await walk("up", 900); await shot(`train${bi + 1}-up`);
  }
  // 맵 이동: 마지막 열차 그대로 다른 맵으로(순간이동 = 궤적 초기화 후 다시 모임).
  await page.evaluate(() => window.__oprnDebug.teleport("mx_map_meadow", 10, 28)).catch(() => {});
  await page.waitForTimeout(1200);
  await walk("right", 1500); await shot("mapmove-after");
  // 탈것: 탑승하면 동료를 그리지 않고, 내리면 돌아온다.
  report.debugWrites.push("session.vehicle.boardedId = airship (비행선은 충돌을 무시해 육지에서도 걷는다) / cleared");
  await page.evaluate(() => { window.__oprnHooksScene.session.vehicle = { ...(window.__oprnHooksScene.session.vehicle ?? {}), boardedId: "airship" }; });
  await walk("left", 900);
  report.boardedFollowerSprites = await page.evaluate(() => window.__oprnHooksScene.followerSprites?.size ?? null);
  await shot("vehicle-boarded");
  await page.evaluate(() => { const v = window.__oprnHooksScene.session.vehicle; delete v.boardedId; });
  await walk("right", 900);
  report.landedFollowerSprites = await page.evaluate(() => window.__oprnHooksScene.followerSprites?.size ?? null);
  await shot("vehicle-landed");
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ boarded: report.boardedFollowerSprites, landed: report.landedFollowerSprites, shots: report.shots.length, errors: report.errors.slice(0, 5) }));
  await browser.close();
  await server.close();
}
