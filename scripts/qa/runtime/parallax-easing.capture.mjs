// 맵 배경 원근(cameraFollow) · 연출 이징 캡처 — 실제 플레이어(player.html, 출하 shim 경로)에서 찍는다.
//
// A. 원근(PR #1646 의 층별 cameraFollow — 출하 경로에서 이징과 같이 확인): 하늘 창(파노라마 창 타일)이 위 2/3 를 차지하는 72×15 맵에서 주인공을 오른쪽으로 걷게 하고,
//    같은 프레임 간격으로 화면을 찍는다. 배경은 CraftPix 「언덕」 7장 스택(cover) — 바위산이 하늘 창 안에 들어오는 세트.
//    before = 모든 레이어 cameraFollow 0(화면 고정), after = 세트 기본 깊이(0 → 0.7).
//    프레임은 QA 프레임 제어(pauseFrames/stepFrames)로 굴려 두 런의 걸음이 같다.
// B. 이징: 얼굴 그림 4장을 같은 시각에 같은 거리로 옮기되 곡선만 다르게 준다. 그림 트윈은
//    rAF 시계라 프레임 제어가 안 먹으므로 페이지 안에서 rAF 로 위치를 샘플링한다.
//
// 사용: node scripts/qa/runtime/parallax-easing.capture.mjs --out /tmp/parallax-easing
//       python3 scripts/qa/runtime/parallax-easing-viz.py /tmp/parallax-easing ~/claude-viz/parallax-easing.html
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import {
  pauseRuntimeFrames,
  performObservedFrames,
  startPlayerQaServer,
} from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const SOURCE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";
const MAP_ID = "map_parallax_demo";
const WIDTH = 72;
const HEIGHT = 15;
const SKY_ROWS = 12;
const WINDOW_TILE = 233; // combined_town 파노라마 창(완전 투명) — 이 칸에서만 배경이 보인다.
const GROUND_TILE = 240; // 풀밭
const START = { x: 4, y: 13 };

const CLIFF_LAYERS = [
  "oga-craftpix-hills-layer-sky",
  "oga-craftpix-hills-layer-clouds2",
  "oga-craftpix-hills-layer-clouds4",
  "oga-craftpix-hills-layer-rocks1",
  "oga-craftpix-hills-layer-clouds3",
  "oga-craftpix-hills-layer-rocks2",
  "oga-craftpix-hills-layer-clouds1",
];

/** 레이어 세트 기본 깊이 — `defaultLayerCameraFollow`(src/project/mapBackground.ts)와 같은 식(아래 0 → 위 0.7). */
function followFor(index, count) {
  if (count <= 1 || index <= 0) return 0;
  return Math.round((Math.min(index, count - 1) / (count - 1)) * 0.7 * 20) / 20;
}

function background(withDepth) {
  const layers = CLIFF_LAYERS.map((imageId, index) => ({
    imageId,
    fit: "cover",
    ...(withDepth && followFor(index, CLIFF_LAYERS.length) > 0 ? { cameraFollow: followFor(index, CLIFF_LAYERS.length) } : {}),
  }));
  const [base, ...extra] = layers;
  return { ...base, layers: extra };
}

function picture(pictureId, x, y, extra = {}) {
  return { kind: "showPicture", pictureId, resourceId: "easyrpg-faceset-actor1-07", x, y, scale: 100, opacity: 255, rotation: 0, ...extra };
}

const EASINGS = ["linear", "easeIn", "easeOut", "easeInOut"];
const LANE_Y = (index) => 18 + index * 52;
const FROM_X = 12;
const TO_X = 252;
const MOVE_MS = 1600;

function easingEvent() {
  const commands = [
    ...EASINGS.map((_, index) => picture(`pic${index + 1}`, FROM_X, LANE_Y(index))),
    { kind: "wait", ms: 600 },
    ...EASINGS.map((easing, index) => picture(`pic${index + 1}`, TO_X, LANE_Y(index), {
      durationMs: MOVE_MS,
      ...(easing === "linear" ? {} : { easing }),
      ...(index === EASINGS.length - 1 ? { waitForPicture: true } : {}),
    })),
    { kind: "wait", ms: 600_000 },
  ];
  return {
    id: "ev_easing_demo",
    name: "이징 데모",
    x: START.x,
    y: START.y,
    trigger: { kind: "auto" },
    commands: [],
    pages: [{
      id: "ev_easing_demo-page",
      name: "이징 데모",
      conditions: [],
      trigger: { kind: "auto" },
      graphic: { transparent: true },
      movement: { type: "fixed", speed: 3, frequency: 3 },
      priority: "same",
      overlapForbidden: false,
      commands,
    }],
  };
}

async function buildProject({ withDepth, withEasing }) {
  const project = JSON.parse(await readFile(SOURCE, "utf8"));
  const template = project.maps.map_lantern_village;
  const lowerTiles = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) lowerTiles.push(y < SKY_ROWS ? WINDOW_TILE : GROUND_TILE);
  }
  project.maps[MAP_ID] = {
    ...template,
    id: MAP_ID,
    name: "원근 데모",
    width: WIDTH,
    height: HEIGHT,
    lowerTiles,
    upperTiles: lowerTiles.map(() => -1),
    events: withEasing ? [easingEvent()] : [],
    background: background(withDepth),
  };
  project.startMapId = MAP_ID;
  project.startPos = { ...START };
  return JSON.stringify(project);
}

async function openGame(browser, server, projectJson, saveNamespace) {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.message ?? error)));
  await page.addInitScript(([projectUrl, namespace]) => {
    try { localStorage.clear(); } catch { /* 접근 불가면 그대로 */ }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: namespace, qaInstrumentation: true };
  }, [PROJECT_URL, saveNamespace]);
  await page.route(PROJECT_ROUTE, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => {
    const state = window.__oprnDebug?.readState?.();
    return Boolean(state && state.currentMapId);
  }, null, { timeout: 120_000 });
  return { page, errors };
}

async function captureWalk(browser, server, outDir, withDepth) {
  const label = withDepth ? "after" : "before";
  const { page, errors } = await openGame(browser, server, await buildProject({ withDepth, withEasing: false }), `parallax-${label}`);
  // 배경 그림 7장이 실릴 시간을 준다(로드는 프레임 제어 밖이다).
  await page.waitForTimeout(2500);
  await pauseRuntimeFrames(page);
  await performObservedFrames(page, { frames: 30, deltaMs: 17 });
  const backgroundProbe = await page.evaluate(() => {
    const scene = window.__oprnHooksScene;
    const camera = scene.cameras.main;
    return {
      camera: { zoom: camera.zoom, width: camera.width, height: camera.height },
      background: scene.map?.background,
      sprites: (scene.mapBackgroundSprites ?? []).map((sprite) => ({
        key: sprite.texture.key, visible: sprite.visible, alpha: sprite.alpha,
        w: sprite.width, h: sprite.height, tileScaleX: sprite.tileScaleX, x: sprite.x, y: sprite.y,
        source: (() => { const img = scene.textures.get(sprite.texture.key).getSourceImage(); return [img.width, img.height]; })(),
      })),
    };
  });
  await page.evaluate(() => window.__oprnInput.dir("right"));
  const frames = [];
  for (let index = 0; index < 40; index += 1) {
    await performObservedFrames(page, { frames: 10, deltaMs: 17 });
    const file = `${label}-${String(index).padStart(2, "0")}.png`;
    await page.screenshot({ path: join(outDir, file) });
    const state = await page.evaluate(() => window.__oprnDebug.readState());
    frames.push({ file, x: state.x, y: state.y });
  }
  await page.close();
  return { frames, errors, backgroundProbe };
}

async function captureEasing(browser, server, outDir) {
  const { page, errors } = await openGame(browser, server, await buildProject({ withDepth: true, withEasing: true }), "easing");
  await page.waitForSelector("[data-testid='picture-pic4']", { timeout: 30_000 });
  // 이동 시작(=첫 left 변화)부터 끝까지 rAF 마다 4장의 left 를 적는다.
  const samplesPromise = page.evaluate(([ids, from, to]) => new Promise((resolveSamples) => {
    const read = () => ids.map((id) => parseFloat(document.querySelector(`[data-testid='picture-${id}']`)?.style.left ?? "NaN"));
    const samples = [];
    let start = 0;
    const tick = (now) => {
      const xs = read();
      if (!start && xs.some((x) => x > from + 0.01)) start = now;
      if (start) samples.push({ t: now - start, xs });
      if (start && xs.every((x) => Math.abs(x - to) < 0.01)) {
        resolveSamples(samples);
        return;
      }
      if (now > 30_000 && !start) {
        resolveSamples(samples);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), [["pic1", "pic2", "pic3", "pic4"], FROM_X, TO_X]);
  // 같은 시간에 필름 스트립을 찍는다(이동 시작 대기 후 200ms 간격).
  await page.waitForFunction((from) => parseFloat(document.querySelector("[data-testid='picture-pic1']")?.style.left ?? "0") > from + 0.01, FROM_X, { timeout: 30_000, polling: 5 });
  const strip = [];
  for (let index = 0; index < 9; index += 1) {
    const file = `easing-${index}.png`;
    await page.screenshot({ path: join(outDir, file) });
    strip.push(file);
    await page.waitForTimeout(200);
  }
  const samples = await samplesPromise;
  await page.close();
  return { samples, strip, errors };
}

const outArg = process.argv.indexOf("--out");
const outDir = resolve(outArg >= 0 ? process.argv[outArg + 1] : "/tmp/parallax-easing");
await mkdir(outDir, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
try {
  const before = await captureWalk(browser, server, outDir, false);
  const after = await captureWalk(browser, server, outDir, true);
  const easing = await captureEasing(browser, server, outDir);
  const report = {
    easings: EASINGS,
    moveMs: MOVE_MS,
    fromX: FROM_X,
    toX: TO_X,
    follow: CLIFF_LAYERS.map((id, index) => ({ id, followX: followFor(index, CLIFF_LAYERS.length) })),
    before,
    after,
    easing,
  };
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outDir, beforeFrames: before.frames.length, afterFrames: after.frames.length, samples: easing.samples.length, errors: [...before.errors, ...after.errors, ...easing.errors] }));
} finally {
  await browser.close();
  await server.close();
}
