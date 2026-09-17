// NPC 자율 이동 probe — 배회 NPC가 실제로 움직이는지 스프라이트 좌표로 판정한다.
//
// 픽스처 test/fixtures/projects/npc-movement-qa.json:
//   ev_lantern_healer(10,18) / roam-kid(12,17) / roam-dog(16,19) / ev_lantern_scout(18,18)
//   — 전부 movement random. 시드 7 고정 → 12초 실시간 진행 → 스프라이트 좌표가
//   초기와 달라졌는지 확인. 하나라도 움직였으면 pass.
//
//   node scripts/qa/runtime/npc-movement.probe.mjs
//
// 결과: verify-shots/runtime-qa/npc-movement/ 에 샷 + results.json + SUMMARY.md.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/npc-movement");
const projectJson = await readFile(
  new URL("../../../test/fixtures/projects/npc-movement-qa.json", import.meta.url), "utf8");
const ROAMERS = ["ev_lantern_healer", "roam-kid", "roam-dog", "ev_lantern_scout"];

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const server = await startPlayerQaServer();
let page;
const results = { seed: 7, waitMs: 12000, before: {}, after: {}, moved: {}, pass: false, errors: [] };
try {
  await mkdir(out, { recursive: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (err) => results.errors.push(`pageerror: ${err.message}`));
  await page.route("**/__runtime-qa/project.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* noop */ }
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:npc-movement", qaInstrumentation: true };
  });
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug && window.__oprnCharacterSprites, null, { timeout: 30000 });
  await page.evaluate(() => window.__oprnDebug.setSeed(7));
  await page.waitForTimeout(800);
  const snap = () => page.evaluate((ids) => {
    const sprites = window.__oprnCharacterSprites();
    const state = window.__oprnDebug.readState();
    const npcs = {};
    for (const id of ids) npcs[id] = sprites.events[id] ? { x: sprites.events[id].x, y: sprites.events[id].y } : null;
    return { npcs, player: { x: state.x, y: state.y, map: state.currentMapId } };
  }, ROAMERS);
  const before = await snap();
  results.before = before.npcs;
  results.player = before.player;
  await page.screenshot({ path: `${out}/before.png` });
  await page.waitForTimeout(results.waitMs);
  const after = await snap();
  results.after = after.npcs;
  await page.screenshot({ path: `${out}/after.png` });
  for (const id of ROAMERS) {
    const b = before.npcs[id], a = after.npcs[id];
    results.moved[id] = Boolean(b && a && (Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1));
  }
  results.pass = Object.values(results.moved).some(Boolean);
} catch (err) {
  results.errors.push(String(err?.stack ?? err));
} finally {
  await page?.close().catch(() => {});
  await browser.close().catch(() => {});
  await server.close?.().catch(() => {});
}
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
const lines = [
  "# npc-movement probe",
  "",
  `- seed: ${results.seed}, realtime wait: ${results.waitMs}ms`,
  `- pass: ${results.pass ? "PASS — 최소 1명의 배회 NPC가 이동" : "FAIL — 아무도 움직이지 않음"}`,
  "",
  "## NPC별 이동 여부",
  "",
  ...ROAMERS.map((id) => `- ${id}: ${results.moved[id] ? "이동" : "정지"} (before=${JSON.stringify(results.before[id])} after=${JSON.stringify(results.after[id])})`),
  "",
  "## 즉시 확인",
  "",
  "- before.png: 시작 배치",
  "- after.png: 12초 후 배치",
  ...(results.errors.length > 0 ? ["", "## 오류", "", ...results.errors.map((e) => `- ${e}`)] : []),
  "",
];
await writeFile(`${out}/SUMMARY.md`, lines.join("\n"));
console.log(JSON.stringify({ pass: results.pass, moved: results.moved, errors: results.errors }, null, 2));
process.exit(results.pass ? 0 : 1);
