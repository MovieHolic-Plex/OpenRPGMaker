// 화면 왜곡(물결·모자이크·기울기) 캡처 — 출하 플레이어(player.html)에서 이벤트 명령 「화면 효과」 를 실제로 돌린다.
//
// 시작 맵에 자동 이벤트 하나를 심는다: 효과를 하나씩 켜고 끄며 사이사이 기다린다. 캡처는 세션의
// `m2Runtime.screen.distortion` 이 목표 값이 된 뒤(+전환 시간) 찍는다 — 벽시계 sleep 으로 추측하지 않는다.
//
// 사용: node scripts/qa/runtime/screen-distortion.capture.mjs --out /tmp/screen-distortion
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SOURCE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";
const SCREEN_EFFECT = "m2-202-screen-effect";

const effect = (name, value, durationMs) => ({
  kind: "m2Command",
  commandId: SCREEN_EFFECT,
  fields: { effect: name, value: value === undefined ? "" : String(value), durationMs },
});

/** 단계마다: 이벤트가 거는 명령들, 캡처 조건(세션 값), 찍을 장수·간격. */
const STEPS = [
  { id: "plain", label: "효과 없음", commands: [], expect: { wave: 0, mosaic: 0, rotate: 0 }, shots: 1 },
  { id: "wave", label: "물결 왜곡 6px (수중·꿈)", commands: [effect("wave", 6, 600)], expect: { wave: 6 }, shots: 4 },
  { id: "mosaic", label: "모자이크 8px (장면 전환·기억 흐림)", commands: [effect("clearDistortion", undefined, 0), effect("mosaic", 8, 600)], expect: { mosaic: 8, wave: 0 }, shots: 1 },
  { id: "rotate", label: "화면 기울기 12° (시간 왜곡)", commands: [effect("clearDistortion", undefined, 0), effect("rotate", 12, 600)], expect: { rotate: 12, mosaic: 0 }, shots: 1 },
  { id: "combo", label: "겹치기: 물결 4 + 모자이크 4 + 기울기 -6°", commands: [effect("clearDistortion", undefined, 0), effect("wave", 4, 600), effect("mosaic", 4, 600), effect("rotate", -6, 600)], expect: { wave: 4, mosaic: 4, rotate: -6 }, shots: 3 },
  { id: "clear", label: "왜곡 모두 끄기", commands: [effect("clearDistortion", undefined, 600)], expect: { wave: 0, mosaic: 0, rotate: 0 }, shots: 1 },
];
const HOLD_MS = 2600;

async function buildProject() {
  const project = JSON.parse(await readFile(SOURCE, "utf8"));
  const map = project.maps[project.startMapId];
  const commands = [{ kind: "wait", ms: 1200 }];
  for (const step of STEPS.slice(1)) commands.push(...step.commands, { kind: "wait", ms: HOLD_MS });
  commands.push({ kind: "wait", ms: 600_000 });
  map.events = [...map.events, {
    id: "ev_distortion_demo",
    name: "왜곡 데모",
    x: project.startPos.x,
    y: project.startPos.y,
    trigger: { kind: "parallel" },
    commands: [],
    pages: [{
      id: "ev_distortion_demo-page", name: "왜곡 데모", conditions: [], trigger: { kind: "parallel" },
      graphic: { transparent: true }, movement: { type: "fixed", speed: 3, frequency: 3 }, priority: "below",
      overlapForbidden: false, commands,
    }],
  }];
  return JSON.stringify(project);
}

const outArg = process.argv.indexOf("--out");
const outDir = resolve(outArg >= 0 ? process.argv[outArg + 1] : "/tmp/screen-distortion");
await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const report = { steps: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  page.on("pageerror", (error) => report.errors.push(String(error?.message ?? error)));
  page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") report.errors.push(`console.${message.type()}: ${message.text()}`); });
  const projectJson = await buildProject();
  await page.addInitScript(([projectUrl]) => {
    try { localStorage.clear(); } catch { /* 그대로 */ }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "screen-distortion", qaInstrumentation: true };
  }, [PROJECT_URL]);
  await page.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean(window.__oprnDebug?.readState?.()?.currentMapId), null, { timeout: 120_000 });
  await page.waitForTimeout(600);
  for (const step of STEPS) {
    await page.waitForFunction((expect) => {
      const d = window.__oprnHooksScene?.session?.m2Runtime?.screen?.distortion ?? { wave: 0, mosaic: 0, rotate: 0 };
      return Object.entries(expect).every(([key, value]) => (d[key] ?? 0) === value);
    }, step.expect, { timeout: 30_000, polling: 50 });
    await page.waitForTimeout(800); // 600ms 전환이 끝난 뒤
    const files = [];
    for (let index = 0; index < step.shots; index += 1) {
      const file = `${step.id}-${index}.png`;
      await page.screenshot({ path: join(outDir, file) });
      files.push(file);
      if (index < step.shots - 1) await page.waitForTimeout(180);
    }
    const shown = await page.evaluate(() => {
      const scene = window.__oprnHooksScene;
      const camera = scene.cameras.main;
      return {
        rotationDeg: Math.round((camera.rotation * 180) / Math.PI * 100) / 100,
        postPipelines: (camera.postPipelines ?? []).map((p) => p.name),
        renderer: scene.renderer?.type,
        worldView: [camera.worldView.width, camera.worldView.height], zoom: camera.zoom, canvas: [scene.scale.width, scene.scale.height],
        drawBuffer: [scene.game.canvas.width, scene.game.canvas.height], rendererSize: [scene.renderer.width, scene.renderer.height],
        targets: (camera.postPipelines ?? []).map((p) => ({ name: p.name, rt: (p.renderTargets ?? []).map((t) => [t.width, t.height]), ff: p.fullFrame1 ? [p.fullFrame1.width, p.fullFrame1.height] : null, block: [p.blockX, p.blockY], amp: p.amp })),
        cameraViewport: [camera.x, camera.y, camera.width, camera.height],
      };
    });
    report.steps.push({ ...step, commands: undefined, files, shown });
  }
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outDir, steps: report.steps.map((s) => ({ id: s.id, shown: s.shown })), errors: report.errors }, null, 1));
} finally {
  await browser.close();
  await server.close();
}
