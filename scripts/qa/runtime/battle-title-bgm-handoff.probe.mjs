// 타이틀 복귀 오디오 사다리 계측 프로브 (2026-09-15).
// Phaser 의 Game.destroy() 는 다음 프레임에 실제로 파괴되고, 그 시점의 PlayScene destroy 이
// 공유 오디오 엔진을 통째로 멈춘다. renderTitle 이 그 전에 타이틀 BGM 을 켜면 새 트랙이
// 쓸려 사라진다(패배 → 타이틀 복귀가 무음). 이 프로브는 그 트랙의 생사를 100ms 간격으로 본다.
//
//   node scripts/qa/runtime/battle-title-bgm-handoff.probe.mjs
//
// 판정: 타이틀 화면이 뜬 뒤 2.5초 동안 audio[data-oprn-audio] 트랙이 살아 있으면 통과.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/battle-title-bgm-handoff");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const project = JSON.parse(
  await readFile(new URL("../../../test/fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"),
);
// 이 픽스처의 타이틀에는 음악이 저작돼 있지 않다. 이 프로젝트에 실제로 있는 music 리소스를 꽂는다.
const TITLE_TRACK = "cc0-bgm-field";
project.system.titleScreen = { ...(project.system.titleScreen ?? {}), musicResourceId: TITLE_TRACK };
// 패배 직전 맵에 필드곡을 저작해 둔다 — 게임 오버 아래에서 그 곡이 다시 돌면 그게 결함이다.
const mapList = Array.isArray(project.maps) ? project.maps : Object.values(project.maps ?? {});
const defeatMap = mapList.find((m) => m.id === "map_old_copper_mine");
if (defeatMap) defeatMap.bgm = { mode: "custom", resourceId: "cc0-bgm-field" };

const SAMPLE_AUDIO = `(() => {
  const nodes = [...document.querySelectorAll("audio[data-oprn-audio]")];
  return nodes.map((a) => ({
    src: (a.currentSrc || a.src || "").split("/").pop(),
    paused: a.paused,
    volume: Number(a.volume.toFixed(2)),
    readyState: a.readyState,
  }));
})()`;

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--autoplay-policy=no-user-gesture-required"] });
const server = await startPlayerQaServer();
const report = { titleTrack: TITLE_TRACK, timeline: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  page.on("pageerror", (e) => report.errors.push(String(e)));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__title-bgm/project.json", saveNamespace: "title-bgm-qa", qaInstrumentation: true };
  });
  await page.route("**/__title-bgm/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(server.url + "/player.html?e2eVitals=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 60_000 });

  await page.evaluate(() => window.__oprnDebug.teleport("map_old_copper_mine", 27, 15));
  await page.waitForFunction(() => {
    const s = window.__oprnDebug.readState();
    return s.currentMapId === "map_old_copper_mine" && s.x === 27 && s.y === 15;
  }, undefined, { timeout: 15_000 });
  await page.evaluate(() => {
    for (const id of window.__oprnDebug.readState().partyActorIds) window.__oprnSetActorVitals(id, 0, 0);
  });
  await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });
  for (let i = 0; i < 40; i += 1) {
    if (await page.locator('[data-testid="game-over-screen"]').count()) break;
    await page.keyboard.press("z");
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: resolve(out, "01-game-over.png") });
  report.reachedGameOver = await page.locator('[data-testid="game-over-screen"]').count();
  // 게임 오버 화면에서 실제로 재생 중인 트랙. 종국 패배(canLose=false)는 필드를 되돌리지 않는다.
  report.atGameOver = await page.evaluate(SAMPLE_AUDIO);

  // 누가 오디오 엘리먼트를 제거하는지 잡는다(스택 기록).
  await page.evaluate(() => {
    const original = Element.prototype.remove;
    Element.prototype.remove = function (...args) {
      if (this.matches && this.matches("audio[data-oprn-audio]")) window.__audioRemovalStack = String(new Error().stack);
      return original.apply(this, args);
    };
  });
  const t0 = Date.now();
  await page.evaluate(() => document.querySelector('[data-testid="return-title"]')?.click());
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 30_000 });
  report.titleShownAt = Date.now() - t0;
  for (let i = 0; i < 26; i += 1) {
    report.timeline.push({ t: Date.now() - t0, tracks: await page.evaluate(SAMPLE_AUDIO) });
    if (i === 2) await page.screenshot({ path: resolve(out, "02-title-just-shown.png") });
    await page.waitForTimeout(100);
  }
  await page.screenshot({ path: resolve(out, "03-title-after-2s.png") });
  report.removalStack = await page.evaluate(() => window.__audioRemovalStack ?? null);
  report.aliveAtEnd = report.timeline.at(-1)?.tracks.filter((track) => !track.paused) ?? [];
} finally {
  await browser.close();
  await server.close();
}
await writeFile(resolve(out, "result.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
