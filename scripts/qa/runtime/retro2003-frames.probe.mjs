// 실행: node scripts/qa/runtime/retro2003-frames.probe.mjs
// Phaser 시계는 멈추지 않는다. CSS/DOM 움직임은 실시간 PNG와 동일 시점의 rect로 검토한다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { createRetro2003Fixture } from "./retro2003-fixture.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/retro2003-frames");
await mkdir(out, { recursive: true });
const fixture = createRetro2003Fixture();
const report = { skin: "retro2003", intervalMs: 100, frameCount: 16, beats: [], sequences: {}, errors: [] };
let server;
let browser;
let page;
const testid = (id) => `[data-testid="${id}"]`;

// PNG는 촬영 뒤 합성한다. 합성 시간이 프레임 간격에 끼어들지 않게 한다.
async function contactSheet(directory, frames) {
  const width = 512, height = 384;
  const sheet = new PNG({ width: width * 4, height: height * Math.ceil(frames.length / 4) });
  for (const [index, frame] of frames.entries()) {
    const source = PNG.sync.read(await readFile(join(directory, frame.file)));
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const from = (Math.floor(y * source.height / height) * source.width + Math.floor(x * source.width / width)) * 4;
      const to = ((Math.floor(index / 4) * height + y) * sheet.width + (index % 4) * width + x) * 4;
      source.data.copy(sheet.data, to, from, from + 4);
    }
  }
  await writeFile(join(directory, "contact-sheet.png"), PNG.sync.write(sheet));
}

async function measure() {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="battle-scene"]');
    const read = (node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const image = node.querySelector(".battle-enemy-image, .battle-actor-sprite, .battle-actor-image");
      const imageRect = image?.getBoundingClientRect();
      return {
        id: node.dataset.testid, recordId: node.dataset.recordId,
        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        pose: node.dataset.battlePose ?? null, acting: node.classList.contains("battle-acting"),
        opacity: style.opacity, filter: style.filter, transform: style.transform,
        image: image ? { x: imageRect.x, y: imageRect.y, opacity: getComputedStyle(image).opacity, filter: getComputedStyle(image).filter } : null,
      };
    };
    const actors = [...document.querySelectorAll(".battle-actor-group .battle-actor")].map(read);
    return {
      browserTimeMs: performance.now(), directorStep: root?.dataset.battleDirectorStep ?? null,
      phase: root?.dataset.battlePhase ?? null, busy: root?.dataset.battleSequenceBusy ?? null,
      actingActor: actors.find((actor) => actor.acting) ?? null, actors,
      enemies: [...document.querySelectorAll(".battle-enemy-group .battle-enemy")].map(read),
      message: root?.querySelector(".battle-message-line")?.textContent ?? "",
      result: root?.querySelector('[data-testid="battle-result-panel"]')?.getAttribute("data-battle-result") ?? null,
    };
  });
}

async function captureSequence(name) {
  const directory = join(out, name);
  await mkdir(directory, { recursive: true });
  const frames = [];
  report.sequences[name] = frames;
  const start = performance.now();
  for (let i = 0; i < report.frameCount; i += 1) {
    const remaining = start + i * report.intervalMs - performance.now();
    if (remaining > 0) await page.waitForTimeout(remaining);
    const frame = { file: `${String(i).padStart(2, "0")}.png`, elapsedMs: performance.now() - start, ...(await measure()) };
    // animations:"disabled"는 유한 애니메이션을 끝으로 보내므로 절대 쓰지 않는다.
    await page.screenshot({ path: join(directory, frame.file), animations: "allow" });
    frame.screenshotEndMs = performance.now() - start;
    frames.push(frame);
  }
  await writeFile(join(directory, "frames.json"), JSON.stringify(frames, null, 2));
  report.beats.push({ id: name, passed: frames.length === 16, durationMs: performance.now() - start });
}

async function shot(id) {
  await page.screenshot({ path: join(out, `${id}.png`), animations: "allow" });
  report.beats.push({ id, passed: true, ...(await measure()) });
}

try {
  server = await startPlayerQaServer();
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  page = await browser.newPage({ viewport: { width: 1024, height: 768 }, reducedMotion: "no-preference" });
  page.on("pageerror", (error) => report.errors.push(String(error)));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__retro2003/project.json", saveNamespace: "retro2003-frames", qaInstrumentation: true };
  });
  await page.route("**/__retro2003/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(fixture.project) }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(testid("title-screen"), { timeout: 120000 });
  await shot("title");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean(window.__oprnDebug?.readState?.().currentMapId), null, { timeout: 120000 });
  await page.evaluate(() => { window.__oprnDebug.setSeed(1); window.__oprnDebug.teleport("map_moonwell_forest", 14, 3); });
  await page.waitForFunction(() => {
    const state = window.__oprnDebug.readState();
    return state.currentMapId === "map_moonwell_forest" && state.x === 14 && state.y === 3;
  });
  await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });
  await page.waitForSelector(testid("dialogue-box"));
  for (let i = 0; i < 24 && !await page.locator(testid("battle-scene")).count(); i += 1) {
    await page.keyboard.press("z");
    await page.waitForTimeout(180);
  }
  await page.waitForSelector(testid("battle-actor-sprites"), { timeout: 30000 });
  await shot("intro");
  await page.waitForSelector(testid("actor-command-attack"), { timeout: 30000 });
  await page.waitForSelector('.battle-scene[data-battle-sequence-busy="false"]');
  const root = page.locator(testid("battle-scene"));
  if (await root.getAttribute("data-battle-skin") !== "retro2003" || await root.getAttribute("data-battle-flow") !== "gauge") throw new Error("스킨/시간 게이지 계약 불일치");
  await shot("command");
  await page.keyboard.press("z");
  // 유리 계열은 대상 안내를 숨기고 적 위 선택 표식으로 대신한다.
  await page.waitForSelector(testid("battle-target-prompt"), { state: "attached" });
  await page.keyboard.press("z");
  await captureSequence("ally-attack");

  // 적 행동 대사의 첫 줄을 본다. 피해 대상 이름이 들어간 둘째 줄로 오인하지 않는다.
  // 대기 중 아군 차례는 방어로 넘겨 적을 죽이지 않고 첫 적 행동을 기다린다.
  const enemyNames = fixture.project.database.enemies.map((enemy) => enemy.name);
  const deadline = performance.now() + 90000;
  let enemyObserved = false;
  while (performance.now() < deadline) {
    const state = await measure();
    if (["acting", "approach", "impact"].includes(state.directorStep)
      && enemyNames.some((name) => state.message.startsWith(name))
      && /공격|사용/.test(state.message)) { enemyObserved = true; break; }
    if (state.result) break;
    // 전투 입력은 키보드 전용이다(명령 버튼은 포인터를 통과시킨다) — 커서를 방어로 옮겨 확정한다.
    if (state.busy === "false" && await page.locator(testid("actor-command-defend")).isVisible()) {
      for (let step = 0; step < 8; step += 1) {
        if (await page.locator(testid("actor-command-defend")).getAttribute("data-battle-command-cursor") === "true") break;
        await page.keyboard.press("ArrowDown");
      }
      await page.keyboard.press("z");
    }
    await page.waitForTimeout(30);
  }
  if (!enemyObserved) throw new Error("90초 안에 적 행동을 관측하지 못함");
  await captureSequence("enemy-attack");
  await page.waitForSelector('.battle-scene[data-battle-sequence-busy="false"]', { timeout: 30000 });
  // F는 자동과 1.8배속을 함께 켠다. 연속 프레임 촬영을 끝낸 뒤에만 사용한다.
  await page.keyboard.press("f");
  await page.waitForSelector(testid("battle-result-panel"), { timeout: 120000 });
  await shot("result");
  const result = await measure();
  report.beats.push({ id: "victory-pose", passed: result.result === "victory" && result.actors.some((actor) => actor.pose === "victory") });
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  if (page) await page.screenshot({ path: join(out, "failure.png") }).catch(() => {});
} finally {
  try { await browser?.close(); } finally { await server?.close(); fixture.cleanup(); }
  for (const [name, frames] of Object.entries(report.sequences)) {
    if (frames.length) await contactSheet(join(out, name), frames);
  }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  const failed = report.errors.length > 0 || report.beats.some((beat) => !beat.passed);
  await writeFile(join(out, "SUMMARY.md"), [
    "# retro2003 실시간 프레임 프로브", "",
    `- 실행: ${failed ? "실패" : "통과"}. 연출 품질은 별도 시각 검토가 필요하다.`,
    "- 목표 간격 100ms / 구간별 16장. 실제 간격은 frames.json의 elapsedMs로 확인한다.",
    ...report.beats.map((beat) => `- ${beat.id}: ${beat.passed ? "통과" : "실패"}`),
    ...Object.keys(report.sequences).map((name) => `- 즉시 확인: ${name}/contact-sheet.png (왼쪽→오른쪽, 위→아래)`),
    ...report.errors.map((error) => `- 오류: ${error}`), "",
  ].join("\n"));
  console.log(JSON.stringify({ out, beats: report.beats.map(({ id, passed }) => ({ id, passed })), errors: report.errors }));
  process.exitCode = failed ? 1 : 0;
}
