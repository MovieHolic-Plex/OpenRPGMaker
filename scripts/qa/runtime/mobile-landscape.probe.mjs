// 휴대폰 가로 화면 크기 측정(2026-10-25 「모바일 가로 화면이 너무 작게 나온다」) — 출하 플레이어(player.html)를
// 휴대폰 에뮬레이션으로 띄우고 무대(게임 그림)가 화면을 얼마나 채우는지, 조작이 어디에 앉는지 잰다.
//
//   node scripts/qa/runtime/mobile-landscape.probe.mjs --project /tmp/mf/demos/chrono-bell.play.json --out /tmp/mf/land-after
//
// 결과: <out>/summary.json(기기별 화면·무대·조작 크기) + <out>/<기기>-field.png, <기기>-dialogue.png
import { chromium, devices } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const iphone = devices["iPhone 15 landscape"];
const DEVICES = {
  // 사파리 주소창·도구 막대가 보이는 가로(플레이라이트 기본값).
  "iphone15-land": iphone,
  // 진짜 아이폰 사파리처럼 Fullscreen API 를 지운 판(크로미움 에뮬레이션에는 API 가 있다) — 「홈 화면에 추가」 안내 확인용.
  "iphone15-land-noapi": { ...iphone, noFullscreenApi: true },
  // 홈 화면 앱(주소창 없음): 화면 전체 852×393.
  "iphone15-land-home": { ...iphone, viewport: { width: 852, height: 393 } },
  "galaxy-s24-land": devices["Galaxy S24 landscape"],
  "fold-cover-land": devices["Galaxy Z Fold 6 Cover landscape"],
  "fold-open-land": devices["Galaxy Z Fold 6 landscape"],
};

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
}
const projectPath = resolve(arg("project", "/tmp/mf/demos/chrono-bell.play.json"));
const outRoot = resolve(arg("out", "/tmp/mf/land"));
const deviceIds = arg("devices", Object.keys(DEVICES).join(",")).split(",");
const CHECKPOINT = {
  id: "mobile-landscape-plaza", label: "왕도 광장", mapId: "fs_hub", x: 30, y: 33, facing: "left",
  switches: { sw_fs_valen_marched: true, sw_fs_main_started: true },
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }],
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function quiet(page) {
  for (let calm = 0, i = 0; calm < 6 && i < 160; i += 1) {
    const open = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"], [data-testid="main-menu"]'));
    if (open) { calm = 0; const menu = await page.evaluate(() => !!document.querySelector('[data-testid="main-menu"]')); await page.keyboard.press(menu ? "Escape" : "Enter"); } else calm += 1;
    await sleep(300);
  }
}

/** 체크포인트 뒤 자동 컷신(행진, 영화 띠)이 끝나 손으로 걸을 수 있을 때까지. */
async function settle(page) {
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    await quiet(page);
    await page.evaluate(() => window.__oprnDebug.teleport("fs_hub", 30, 33));
    await sleep(400);
    const before = await page.evaluate(() => window.__oprnPlayerSprite?.());
    await page.evaluate(() => window.__oprnInput.dir("right"));
    await sleep(350);
    await page.evaluate(() => window.__oprnInput.dir(null));
    await sleep(500);
    const after = await page.evaluate(() => window.__oprnPlayerSprite?.());
    if (before && after && before.x !== after.x) return;
    await sleep(1500);
  }
  throw new Error("settle: 자유 걷기 상태에 들어가지 못했다");
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null; };
    const vp = document.querySelector(".play-viewport");
    const stage = rect(".play-stage canvas") ?? rect(".play-stage");
    const view = { w: innerWidth, h: innerHeight };
    return {
      viewport: view,
      dpr: devicePixelRatio,
      touchLayout: vp?.dataset.touchLayout ?? null,
      overlay: vp?.dataset.touchOverlay === "true",
      scale: Number(vp?.dataset.scale ?? 0),
      stage,
      fillH: stage ? +(stage.h / view.h).toFixed(3) : 0,
      fillW: stage ? +(stage.w / view.w).toFixed(3) : 0,
      fillArea: stage ? +((stage.w * stage.h) / (view.w * view.h)).toFixed(3) : 0,
      stick: rect(".touch-dpad-base"),
      a: rect('[data-testid="touch-action-a"]'),
      b: rect('[data-testid="touch-action-b"]'),
      menu: rect('[data-testid="touch-menu"]') ?? rect(".touch-menu-btn"),
      run: rect('[data-testid="touch-run"]'),
      fullscreen: rect(".play-fullscreen-toggle"),
      fullscreenKind: document.querySelector(".play-fullscreen-toggle")?.dataset.hint ?? (document.querySelector(".play-fullscreen-toggle") ? "fullscreen-api" : null),
      dialogue: rect('[data-testid="dialogue-box"]'),
    };
  });
}

await mkdir(outRoot, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const summary = {};
const projectJson = await readFile(projectPath, "utf8");
try {
  for (const id of deviceIds) {
    const { noFullscreenApi, ...descriptor } = DEVICES[id];
    const context = await browser.newContext(descriptor);
    const page = await context.newPage();
    await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
    await page.addInitScript(([cp]) => {
      try { localStorage.clear(); } catch {}
      window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "mobile-landscape", qaInstrumentation: true, qaCheckpoint: cp };
    }, [CHECKPOINT]);
    if (noFullscreenApi) await page.addInitScript(() => { delete Element.prototype.requestFullscreen; delete Document.prototype.exitFullscreen; });
    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 360_000 });
    await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
    await sleep(3000);
    await settle(page);
    await quiet(page);
    await page.evaluate(() => window.__oprnDebug.teleport("fs_hub", 30, 33));
    await sleep(800);
    const field = await measure(page);
    await page.screenshot({ path: join(outRoot, `${id}-field.png`) });
    // 대사 창이 조작에 가리는지: 장로(28,33) 옆에서 말 걸기.
    await page.evaluate(() => window.__oprnDebug.teleport("fs_hub", 29, 33));
    await sleep(500);
    await page.evaluate(() => window.__oprnInput.face?.("left"));
    await sleep(300);
    await page.keyboard.press("Enter");
    await sleep(1800);
    const dialogue = await measure(page);
    await page.screenshot({ path: join(outRoot, `${id}-dialogue.png`) });
    let hint = null;
    if (field.fullscreenKind === "home-screen") {
      await page.keyboard.press("Enter").catch(() => {});
      await quiet(page);
      await page.tap(".play-fullscreen-toggle");
      await sleep(500);
      hint = await page.evaluate(() => document.querySelector('[data-testid="play-home-screen-hint"]')?.textContent ?? null);
      await page.screenshot({ path: join(outRoot, `${id}-hint.png`) });
    }
    summary[id] = { field, dialogue: dialogue.dialogue, hint };
    console.log(id, JSON.stringify({ vp: field.viewport, scale: field.scale, stage: field.stage, fillH: field.fillH, fillArea: field.fillArea, overlay: field.overlay, fs: field.fullscreenKind }));
    await context.close();
  }
} finally {
  await writeFile(join(outRoot, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  await server.close();
}
