// 모바일 조작감 측정(2026-10-24) — 출하 플레이어(player.html)를 휴대폰 에뮬레이션(isMobile·hasTouch)으로 띄우고
// CDP Input.dispatchTouchEvent 로 진짜 터치를 보낸다. 합성 PointerEvent 가 아니라 브라우저 터치 파이프라인을 탄다.
//
//   OPRN_ASSUME_ALL_BGM_INSTALLED=1 npx tsx scripts/content/bake-flagship-demos.mts --out /tmp/mf --only chrono-bell
//   node scripts/qa/runtime/mobile-feel.probe.mjs --project /tmp/mf/demos/chrono-bell.play.json --out /tmp/mf/before [--devices iphone15,iphone15-land,fold,fold-open] [--video]
//
// 결과: <out>/<기기>/result.json (지연·패드·단추·메뉴·브라우저 설정) + <out>/summary.json, --video 면 <기기>/walk.webm
import { chromium, devices } from "@playwright/test";
import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const DEVICES = {
  iphone15: devices["iPhone 15"],
  "iphone15-land": devices["iPhone 15 landscape"],
  fold: devices["Galaxy Z Fold 6 Cover"],
  "fold-open": devices["Galaxy Z Fold 6"],
  "fold-open-land": devices["Galaxy Z Fold 6 landscape"],
};

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const projectPath = resolve(arg("project", "/tmp/mf/demos/chrono-bell.play.json"));
const outRoot = resolve(arg("out", "/tmp/mf/probe"));
const deviceIds = arg("devices", "iphone15,iphone15-land,fold,fold-open").split(",");
const wantVideo = process.argv.includes("--video");
const only = arg("only", null)?.split(",") ?? null;

const CHECKPOINT = {
  id: "mobile-feel-plaza",
  label: "왕도 광장 — 자유 걷기",
  mapId: "fs_hub",
  x: 40,
  y: 27,
  facing: "down",
  switches: { sw_fs_valen_marched: true, sw_fs_main_started: true },
  party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }],
};

// 페이지 안 계측: 프레임마다 주인공 위치, 키·터치 이벤트 시각, 터치 표시(영상용).
const INSTRUMENT = `(() => {
  const log = { frames: [], keys: [], touches: [], receipts: [] };
  const watch = () => new MutationObserver((records) => { for (const r of records) if (r.attributeName === "data-pointer-move") log.receipts.push({ t: performance.now(), v: r.target.dataset.pointerMove }); })
    .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-pointer-move"] });
  if (document.documentElement) watch(); else document.addEventListener("DOMContentLoaded", watch);
  window.__mf = log;
  const now = () => performance.now();
  for (const type of ["keydown", "keyup"]) window.addEventListener(type, (e) => { if (!e.repeat) log.keys.push({ t: now(), type, key: e.key }); }, true);
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
    window.addEventListener(type, (e) => {
      if (type !== "touchmove") log.touches.push({ t: now(), type, n: e.touches.length, prevented: e.defaultPrevented });
      draw(e);
    }, { capture: true, passive: true });
  }
  const dots = new Map();
  function draw(e) {
    const layer = document.getElementById("mf-touch-layer") || (() => {
      const d = document.createElement("div");
      d.id = "mf-touch-layer";
      d.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
      document.documentElement.append(d);
      return d;
    })();
    const live = new Set();
    for (const t of e.touches) {
      live.add(t.identifier);
      let dot = dots.get(t.identifier);
      if (!dot) {
        dot = document.createElement("div");
        dot.style.cssText = "position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #ff3b6b;background:rgba(255,59,107,.28);box-shadow:0 0 0 2px #fff";
        layer.append(dot);
        dots.set(t.identifier, dot);
      }
      dot.style.left = t.clientX + "px";
      dot.style.top = t.clientY + "px";
    }
    for (const [id, dot] of dots) if (!live.has(id)) { dot.remove(); dots.delete(id); }
  }
  const tick = () => {
    const s = window.__oprnPlayerSprite ? window.__oprnPlayerSprite() : null;
    if (s) log.frames.push({ t: now(), x: s.x, y: s.y, moving: s.moving });
    if (log.frames.length > 20000) log.frames.splice(0, 10000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(browser, deviceId, outDir) {
  const descriptor = DEVICES[deviceId];
  const context = await browser.newContext({
    ...descriptor,
    ...(wantVideo ? { recordVideo: { dir: outDir, size: descriptor.viewport } } : {}),
  });
  const page = await context.newPage();
  const projectJson = await readFile(projectPath, "utf8");
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.addInitScript(([cp]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "mobile-feel", qaInstrumentation: true, qaCheckpoint: cp };
  }, [CHECKPOINT]);
  await page.addInitScript(INSTRUMENT);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 360_000 });
  await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 360_000 });
  await sleep(1500);
  await settle(page);
  const cdp = await context.newCDPSession(page);
  return { context, page, cdp, errors };
}

/** 체크포인트 직후 자동 컷신(포고·행진)이 끝나 자유롭게 걸을 때까지: 대사는 Enter, 컷신은 Esc 두 번, 걸어서 확인. */
async function settle(page) {
  const deadline = Date.now() + 240_000;
  const SPOTS = [[28, 33], [30, 33], [36, 27], [33, 31], [26, 23], [44, 30]];
  let spot = -1;
  while (Date.now() < deadline) {
    const ui = await page.evaluate(() => ({ dialogue: !!document.querySelector('[data-testid="dialogue-box"]'), menu: !!document.querySelector('[data-testid="main-menu"]') }));
    if (ui.menu) { await page.keyboard.press("Escape"); await sleep(400); continue; }
    if (ui.dialogue) { await page.keyboard.press("Enter"); await sleep(400); continue; }
    spot = (spot + 1) % SPOTS.length;
    await page.evaluate(([x, y]) => window.__oprnDebug.teleport("fs_hub", x, y), SPOTS[spot]);
    await sleep(400);
    const before = await page.evaluate(() => window.__oprnPlayerSprite?.());
    for (const d of ["up", "right", "down", "left"]) {
      await page.evaluate((dir) => window.__oprnInput.dir(dir), d);
      await sleep(300);
      await page.evaluate(() => window.__oprnInput.dir(null));
      await sleep(350);
      const after = await page.evaluate(() => window.__oprnPlayerSprite?.());
      if (before && after && (before.x !== after.x || before.y !== after.y)) {
        if (process.env.MF_SCAN) await scanOpen(page);
        return true;
      }
    }
    if (process.env.MF_DEBUG) { await page.screenshot({ path: `/tmp/mf/settle-${Date.now()}.png` }); console.log(JSON.stringify({ before, after, st: await page.evaluate(() => { const s = window.__oprnDebug.readState(); return [s.currentMapId, s.x, s.y]; }) })); }
    // 컷신은 건너뛰지 않고 끝나기를 기다린다(Esc 두 번 건너뛰기는 카메라를 행렬 쪽에 남긴다 — 2026-10-24 관찰).
    await sleep(1500);
  }
  throw new Error("settle: 자유 걷기 상태에 들어가지 못했다");
}

/** 디버그: 줄마다 오른쪽으로 몇 칸 걸어지는지 잰다(시험 자리 고르기). */
async function scanOpen(page) {
  for (const [x, y] of [[30, 33], [28, 33], [32, 31], [36, 27], [38, 29], [30, 29], [34, 35], [20, 27], [26, 23], [44, 30], [40, 31], [30, 37]]) {
    await page.evaluate(([x, y]) => { window.__oprnDebug.teleport("fs_hub", x, y); }, [x, y]);
    await sleep(300);
    const res = {};
    for (const d of ["right", "up", "left", "down"]) {
      await page.evaluate(([x, y]) => { window.__oprnDebug.teleport("fs_hub", x, y); }, [x, y]);
      await sleep(200);
      await page.evaluate((dir) => window.__oprnInput.dir(dir), d);
      await sleep(1100);
      await page.evaluate(() => window.__oprnInput.dir(null));
      await sleep(400);
      const s = await page.evaluate(() => { const s = window.__oprnDebug.readState(); return [s.x, s.y]; });
      res[d] = Math.abs(s[0] - x) + Math.abs(s[1] - y);
    }
    console.log(JSON.stringify({ x, y, ...res }));
  }
}

function touchApi(cdp) {
  const send = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x, y, id = 0]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
  return {
    start: (pts) => send("touchStart", pts),
    move: (pts) => send("touchMove", pts),
    end: (pts = []) => send("touchEnd", pts),
    async tap(x, y, holdMs = 60) { await send("touchStart", [[x, y]]); await sleep(holdMs); await send("touchEnd", []); },
    async drag(from, to, steps = 8, stepMs = 16, id = 0, others = []) {
      for (let i = 1; i <= steps; i += 1) {
        const x = from[0] + ((to[0] - from[0]) * i) / steps;
        const y = from[1] + ((to[1] - from[1]) * i) / steps;
        await send("touchMove", [...others, [x, y, id]]);
        await sleep(stepMs);
      }
    },
  };
}

async function resetLog(page) {
  await page.evaluate(() => { window.__mf.frames.length = 0; window.__mf.keys.length = 0; window.__mf.touches.length = 0; window.__mf.receipts.length = 0; });
}
const readLog = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__mf)));
const state = (page) => page.evaluate(() => { const s = window.__oprnDebug.readState(); return { mapId: s.mapId ?? s.currentMapId, x: s.x, y: s.y, facing: s.facing }; });

async function geometry(page) {
  return page.evaluate(() => {
    const rect = (sel) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      if (r.width === 0 || cs.display === "none" || cs.visibility === "hidden") return { hidden: true };
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const css = (sel) => {
      const n = document.querySelector(sel);
      if (!n) return null;
      const cs = getComputedStyle(n);
      return { touchAction: cs.touchAction, userSelect: cs.userSelect || cs.webkitUserSelect, callout: cs.webkitTouchCallout ?? null, overscroll: cs.overscrollBehavior, pointerEvents: cs.pointerEvents };
    };
    const cam = window.__oprnCamera?.();
    const sprite = window.__oprnPlayerSprite?.();
    const canvas = document.querySelector(".play-stage canvas, canvas");
    let hero = null;
    if (cam && sprite && canvas) {
      const r = canvas.getBoundingClientRect();
      const sx = r.width / cam.width;
      const wvx = cam.scrollX + (cam.width * (1 - 1 / cam.zoom)) / 2;
      const wvy = cam.scrollY + (cam.height * (1 - 1 / cam.zoom)) / 2;
      hero = { x: Math.round(r.left + (sprite.x - wvx) * cam.zoom * sx), y: Math.round(r.top + (sprite.y - wvy) * cam.zoom * sx), scale: +(cam.zoom * sx).toFixed(3) };
    }
    const meta = document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null;
    return {
      viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
      layout: document.querySelector(".play-viewport")?.dataset.touchLayout ?? null,
      touchUi: document.querySelector(".play-viewport")?.dataset.touchUi ?? null,
      stage: rect(".play-stage"),
      canvas: rect(".play-stage canvas"),
      zone: rect(".touch-stick-zone"),
      stick: rect(".touch-dpad-base"),
      a: rect('[data-testid="touch-action-a"]'),
      b: rect('[data-testid="touch-action-b"]'),
      menu: rect('[data-testid="touch-menu"]'),
      run: rect('[data-testid="touch-run"]'),
      fullscreen: rect(".play-fullscreen-toggle"),
      dialogue: rect(".dialogue-box"),
      hero,
      meta,
      css: { html: css("html"), body: css("body"), layout: css(".player-layout"), viewport: css(".play-viewport"), canvas: css(".play-stage canvas"), zone: css(".touch-stick-zone"), a: css('[data-testid="touch-action-a"]') },
      scroll: { x: scrollX, y: scrollY, docH: document.documentElement.scrollHeight },
    };
  });
}

function center(r) { return [r.x + r.w / 2, r.y + r.h / 2]; }

/** 프레임 기록에서: 누름 시각 이후 첫 위치 변화, 뗀 시각 이후 마지막 위치 변화. */
function analyzeMove(log, pressT, releaseT, tile = 16) {
  const frames = log.frames;
  const before = [...frames].reverse().find((f) => f.t <= pressT) ?? frames[0];
  const firstMove = frames.find((f) => f.t > pressT && (Math.abs(f.x - before.x) > 0.01 || Math.abs(f.y - before.y) > 0.01));
  const atRelease = [...frames].reverse().find((f) => f.t <= releaseT) ?? before;
  let lastChange = null;
  for (let i = 1; i < frames.length; i += 1) {
    if (frames[i].t <= releaseT) continue;
    if (Math.abs(frames[i].x - frames[i - 1].x) > 0.01 || Math.abs(frames[i].y - frames[i - 1].y) > 0.01) lastChange = frames[i];
  }
  const end = frames[frames.length - 1];
  const frameMs = frames.length > 10 ? (frames[frames.length - 1].t - frames[0].t) / (frames.length - 1) : 16.7;
  const firstKey = log.keys.find((k) => k.t >= pressT - 5 && k.type === "keydown" && k.key.startsWith("Arrow"));
  return {
    pressToKeyMs: firstKey ? +(firstKey.t - pressT).toFixed(1) : null,
    pressToMoveMs: firstMove ? +(firstMove.t - pressT).toFixed(1) : null,
    pressToMoveFrames: firstMove ? Math.round((firstMove.t - pressT) / frameMs) : null,
    releaseToStopMs: lastChange ? +(lastChange.t - releaseT).toFixed(1) : 0,
    overshootTiles: +((Math.hypot(end.x - atRelease.x, end.y - atRelease.y)) / tile).toFixed(2),
    totalTiles: +((Math.hypot(end.x - before.x, end.y - before.y)) / tile).toFixed(2),
    stillMovingAfter: end.moving,
    frameMs: +frameMs.toFixed(2),
  };
}

async function pressHold(page, touch, point, holdMs) {
  await resetLog(page);
  await sleep(150);
  // 누름과 뗌 사이에 페이지 왕복을 넣지 않는다(부하 중 evaluate 한 번이 200ms 를 넘어 누름이 길어졌다). 시각은 페이지 기록에서 읽는다.
  await touch.start([point]);
  await sleep(holdMs);
  await touch.end([]);
  await sleep(900);
  const log = await readLog(page);
  const pressT = log.touches.find((x) => x.type === "touchstart")?.t ?? 0;
  const releaseT = [...log.touches].reverse().find((x) => x.type === "touchend")?.t ?? pressT;
  return { pressT, releaseT, heldMs: +(releaseT - pressT).toFixed(0), log };
}

async function runDevice(browser, deviceId) {
  const outDir = join(outRoot, deviceId);
  await mkdir(outDir, { recursive: true });
  const { context, page, cdp, errors } = await boot(browser, deviceId, outDir);
  const touch = touchApi(cdp);
  const result = { device: deviceId, steps: {} };
  const step = async (name, fn) => {
    if (only && !only.includes(name)) return;
    try { result.steps[name] = await fn(); } catch (e) { result.steps[name] = { error: String(e?.message ?? e) }; }
  };
  const teleport = async (x, y, facing = "down") => {
    await page.evaluate(([x, y, f]) => { window.__oprnDebug.teleport("fs_hub", x, y); window.__oprnInput.face(f); }, [x, y, facing]);
    await sleep(500);
  };
  const g0 = await geometry(page);
  result.geometry = g0;
  await page.screenshot({ path: join(outDir, "field.png") });
  const stick = g0.stick && !g0.stick.hidden ? g0.stick : null;
  const sc = stick ? center(stick) : null;
  const r = stick ? stick.w / 2 : 0;

  // 1) 지연·멈춤: 오른쪽 600ms 누름 × 3, 짧은 탭 × 2
  await step("latency", async () => {
    const trials = [];
    for (let i = 0; i < 3; i += 1) {
      await teleport(28, 33, "down");
      const h = await pressHold(page, touch, [sc[0] + r * 0.6, sc[1]], 600);
      trials.push({ heldMs: h.heldMs, ...analyzeMove(h.log, h.pressT, h.releaseT), keys: h.log.keys.map((k) => `${k.type}:${k.key}@${(k.t - h.pressT).toFixed(0)}`) });
    }
    const taps = [];
    for (let i = 0; i < 2; i += 1) {
      await teleport(28, 33, "down");
      const h = await pressHold(page, touch, [sc[0] + r * 0.6, sc[1]], 70);
      taps.push({ heldMs: h.heldMs, ...analyzeMove(h.log, h.pressT, h.releaseT), keys: h.log.keys.map((k) => `${k.type}:${k.key}@${(k.t - h.pressT).toFixed(0)}`), trace: h.log.frames.filter((f) => f.t >= h.pressT - 40 && f.t <= h.pressT + 500).map((f) => `${(f.t - h.pressT).toFixed(0)}:${f.x},${f.y}${f.moving ? "m" : ""}`).join(" ") });
    }
    return { trials, taps };
  });

  // 1b) 떠다니는 조이스틱: 조이스틱 밖(영역 안) 첫 누름이 바로 방향을 내는가
  await step("offBaseFirstTouch", async () => {
    await teleport(28, 33, "down");
    const zone = g0.zone;
    // 조이스틱 오른쪽 위 빈자리(영역 안)를 엄지로 누르고 600ms 버틴다 — 손가락은 안 움직인다.
    const p = [Math.min(zone.x + zone.w - 10, sc[0] + r * 1.4), sc[1] - r * 0.2];
    const h = await pressHold(page, touch, p, 600);
    return { point: p.map(Math.round), ...analyzeMove(h.log, h.pressT, h.releaseT) };
  });

  // 2) 패드: 데드존·대각선·밀어 바꾸기·바깥으로 끌기·멀티터치
  await step("deadzone", async () => {
    await resetLog(page);
    const out = [];
    for (const d of [4, 8, 12, 16, 24]) {
      await touch.start([[sc[0] + d, sc[1]]]);
      await sleep(80);
      const keys = await page.evaluate(() => window.__mf.keys.filter((k) => k.type === "keydown").map((k) => k.key));
      await touch.end([]);
      await sleep(120);
      await resetLog(page);
      out.push({ px: d, keys });
    }
    return out;
  });
  await step("diagonal", async () => {
    await teleport(28, 33, "down");
    const p = [sc[0] + r * 0.5, sc[1] + r * 0.5];
    const h = await pressHold(page, touch, p, 700);
    const s = await state(page);
    return { keys: h.log.keys.filter((k) => k.type === "keydown").map((k) => k.key), ...analyzeMove(h.log, h.pressT, h.releaseT), end: s };
  });
  await step("slide", async () => {
    await teleport(28, 33, "down");
    await resetLog(page);
    const right = [sc[0] + r * 0.6, sc[1]];
    const up = [sc[0], sc[1] - r * 0.6];
    await touch.start([right]);
    await sleep(500);
    const mid = await state(page);
    await touch.drag(right, up, 6, 16);
    await sleep(600);
    await touch.end([]);
    await sleep(700);
    const s = await state(page);
    const log = await readLog(page);
    return { mid, end: s, keys: log.keys.map((k) => `${k.type}:${k.key}`), turnedUp: s.y < mid.y };
  });
  await step("drift", async () => {
    await teleport(28, 33, "down");
    await resetLog(page);
    const start = [sc[0] + r * 0.6, sc[1]];
    await touch.start([start]);
    await sleep(300);
    // 엄지가 패드 밖으로 미끄러진다(오른쪽 위로 크게).
    const far = [Math.min(g0.viewport.w - 4, sc[0] + r * 3.2), sc[1] - r * 1.6];
    await touch.drag(start, far, 10, 16);
    const keysHeld = await page.evaluate(() => {
      const held = new Set();
      for (const k of window.__mf.keys) { if (k.type === "keydown") held.add(k.key); else held.delete(k.key); }
      return [...held];
    });
    const s1 = await state(page);
    await sleep(500);
    const s2 = await state(page);
    // 다시 왼쪽으로 돌아오면 바로 왼쪽인가
    const back = [sc[0] - r * 0.6, sc[1]];
    await touch.drag(far, back, 10, 16);
    await sleep(500);
    const heldBack = await page.evaluate(() => {
      const held = new Set();
      for (const k of window.__mf.keys) { if (k.type === "keydown") held.add(k.key); else held.delete(k.key); }
      return [...held];
    });
    await touch.end([]);
    await sleep(600);
    return { farPoint: far.map(Math.round), keysHeldFar: keysHeld, movedWhileFar: s2.x !== s1.x || s2.y !== s1.y, keysAfterReturnLeft: heldBack };
  });
  await step("multitouch", async () => {
    await teleport(28, 33, "down");
    await resetLog(page);
    const dir = [sc[0] + r * 0.6, sc[1]];
    const a = center(g0.a);
    await touch.start([[...dir, 0]]);
    await sleep(400);
    const s1 = await state(page);
    await touch.start([[...dir, 0], [...a, 1]]);
    await sleep(80);
    await touch.end([[...dir, 0]]);
    await sleep(400);
    const s2 = await state(page);
    await touch.end([]);
    await sleep(600);
    const log = await readLog(page);
    return { keys: log.keys.map((k) => `${k.type}:${k.key}`), enterSeen: log.keys.some((k) => k.key === "Enter"), keptMoving: s2.x > s1.x };
  });

  // 2b) 각도 훑기: 0~90° 를 3° 간격으로 반지름 0.6 에 눌러 어떤 키가 나오는가 → 대각선 비율
  await step("sweep", async () => {
    const out = [];
    for (let deg = 0; deg <= 90; deg += 3) {
      await resetLog(page);
      const rad = (deg * Math.PI) / 180;
      await touch.start([[sc[0] + Math.cos(rad) * r * 0.6, sc[1] + Math.sin(rad) * r * 0.6]]);
      await sleep(60);
      const keys = await page.evaluate(() => window.__mf.keys.filter((k) => k.type === "keydown").map((k) => k.key));
      await touch.end([]);
      await sleep(60);
      out.push({ deg, diagonal: keys.includes("ArrowRight") && keys.includes("ArrowDown") });
    }
    const diag = out.filter((o) => o.diagonal).map((o) => o.deg);
    return { diagonalShare: +(diag.length / out.length).toFixed(2), diagonalFrom: diag[0] ?? null, diagonalTo: diag[diag.length - 1] ?? null };
  });
  // 2c) 떨림: 오른쪽 축에서 ±22° 로 흔들며 걸을 때 키가 몇 번 바뀌는가
  await step("jitter", async () => {
    await teleport(28, 33, "down");
    await resetLog(page);
    const at = (deg) => [sc[0] + Math.cos((deg * Math.PI) / 180) * r * 0.6, sc[1] + Math.sin((deg * Math.PI) / 180) * r * 0.6];
    await touch.start([at(0)]);
    for (let i = 0; i < 24; i += 1) { await touch.move([at(i % 2 ? 22 : -22)]); await sleep(40); }
    await touch.end([]);
    await sleep(600);
    const log = await readLog(page);
    const s = await state(page);
    return { keyChanges: log.keys.length, endY: s.y, startY: 33 };
  });
  // 2d) 달리기 단추
  await step("run", async () => {
    if (!g0.run || g0.run.hidden) return { available: false };
    const rb = center(g0.run);
    await touch.tap(rb[0], rb[1], 60);
    await sleep(300);
    await teleport(28, 33, "down");
    const h = await pressHold(page, touch, [sc[0] + r * 0.6, sc[1]], 600);
    await touch.tap(rb[0], rb[1], 60);
    await sleep(300);
    return { available: true, ...analyzeMove(h.log, h.pressT, h.releaseT), heldMs: h.heldMs };
  });
  // 6b) 문·사람 탭: 멀리서 잠긴 문을 탭하면 곁으로 걸어가 말을 거는가
  await step("tapInteract", async () => {
    // 광장 길(28,33)에서 2~6칸 떨어진 사람(이벤트)을 하나 골라 탭한다 → 곁으로 걸어가 말을 거는가.
    await teleport(28, 33, "down");
    // 앞서 뜬 대사(마을 사람 혼잣말 등)를 다 닫고 1.5초 조용할 때까지
    for (let quiet = 0, i = 0; quiet < 6 && i < 80; i += 1) {
      const open = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]'));
      if (open) { quiet = 0; await page.keyboard.press("Enter"); } else quiet += 1;
      await sleep(250);
    }
    const here = await state(page);
    const snap = () => page.evaluate(() => window.__oprnCharacterSprites?.()?.events ?? {});
    const first = await snap();
    await sleep(800);
    const second = await snap();
    const target = (() => {
      const list = Object.entries(second)
        .filter(([id, v]) => v.alpha > 0.5 && first[id] && Math.abs(first[id].x - v.x) < 2 && Math.abs(first[id].y - v.y) < 2)
        .map(([id, v]) => ({ id, px: v.x, py: v.y, x: Math.floor(v.x / 16), y: Math.round(v.y / 16) - 1 }));
      const d = (v) => Math.abs(v.x - here.x) + Math.abs(v.y - here.y);
      list.sort((a, b) => d(a) - d(b));
      return list.find((v) => d(v) >= 2 && d(v) <= 16) ?? null;
    })();
    if (!target) return { error: "no nearby event", here, sample: Object.entries(second).slice(0, 12).map(([id, v]) => [id, v.x, v.y, v.alpha, first[id]?.x, first[id]?.y]) };
    const g = await geometry(page);
    const tilePx = 16 * g.hero.scale;
    // 사람 그림의 가운데(발에서 12px 위)를 탭한다 — 손가락이 실제로 누르는 곳.
    const p = [g.hero.x + tilePx * (target.x - here.x), g.hero.y + tilePx * (target.y - here.y) - 12 * g.hero.scale];
    const idleOverlay = await page.evaluate(() => [...document.querySelectorAll(".dialogue-overlay")].map((o) => ({ cls: o.className, kids: o.children.length, box: o.querySelector(".dialogue-box")?.outerHTML.slice(0, 300) ?? null, vis: getComputedStyle(o).display + "/" + getComputedStyle(o).visibility + "/" + getComputedStyle(o).opacity })));
    await resetLog(page);
    await touch.tap(p[0], p[1], 60);
    let dialogue = false;
    for (let i = 0; i < 24 && !dialogue; i += 1) { await sleep(250); dialogue = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]')); }
    const s = await state(page);
    const receipt = await page.evaluate(() => document.querySelector("[data-pointer-move]")?.dataset.pointerMove ?? null);
    if (dialogue) { await page.screenshot({ path: join(outDir, "tap-interact.png") }); for (let i = 0; i < 6; i += 1) { await page.keyboard.press("Enter"); await sleep(300); } }
    await page.screenshot({ path: join(outDir, "tap-interact-dbg.png") });
    const dbg = await page.evaluate(() => ({ cam: window.__oprnCamera?.(), sprite: window.__oprnPlayerSprite?.(), canvas: (() => { const r = document.querySelector(".play-stage canvas").getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })() }));
    const lg = await readLog(page);
    return { start: here, target, idleOverlay, receipts: lg.receipts.map((x) => x.v), keys: lg.keys.map((k) => `${k.type}:${k.key}`), receipt, dialogue, end: s, tapped: p.map(Math.round), hero: g.hero, dbg };
  });

  // 6) 맵 탭으로 걷기: 주인공 오른쪽 3칸을 탭
  await step("tapToMove", async () => {
    await teleport(28, 33, "down");
    await sleep(1200);
    const g = await geometry(page);
    const s0 = await state(page);
    const tilePx = 16 * g.hero.scale;
    const p = [g.hero.x + tilePx * 3, g.hero.y - tilePx * 0.3];
    await touch.tap(p[0], p[1], 60);
    await sleep(1600);
    const s1 = await state(page);
    // 걷는 중 다시 탭하면 목적지가 바뀌는가(왼쪽 2칸)
    const g2 = await geometry(page);
    const rc = () => page.evaluate(() => document.querySelector("[data-pointer-move]")?.dataset.pointerMove ?? null);
    await touch.tap(g2.hero.x + tilePx * 3, g2.hero.y, 60);
    await sleep(250);
    const r1 = await rc();
    const g3 = await geometry(page);
    await touch.tap(g3.hero.x - tilePx * 2, g3.hero.y, 60);
    await sleep(100);
    const r2 = await rc();
    await sleep(1800);
    const s2 = await state(page);
    // 주인공 자신 탭 = 조사
    const g4 = await geometry(page);
    await touch.tap(g4.hero.x, g4.hero.y, 60);
    await sleep(150);
    const r3 = await rc();
    const receipt = await page.evaluate(() => document.querySelector("[data-pointer-move]")?.dataset.pointerMove ?? null);
    return { from: s0, to: s1, tapped: p.map(Math.round), receipt, moved: s1.x !== s0.x || s1.y !== s0.y, retarget: { from: s1, end: s2, receipts: [r1, r2, r3] } };
  });

  // 3) 단추·겹침은 geometry 로. 5) 브라우저: 패드 끌기 중 페이지 스크롤·길게 누름·두 번 탭 확대.
  await step("browser", async () => {
    const before = await page.evaluate(() => ({ y: scrollY, scale: visualViewport?.scale ?? 1 }));
    await touch.start([[sc[0], sc[1]]]);
    await touch.drag([sc[0], sc[1]], [sc[0], sc[1] - 200], 10, 16);
    await touch.end([]);
    // 화면 위쪽 빈 곳 두 번 탭
    const [cx, cy] = center(g0.stage);
    await touch.tap(cx, cy, 40); await sleep(80); await touch.tap(cx, cy, 40);
    await sleep(400);
    // 길게 누르기(문맥 메뉴·글자 선택)
    let ctxMenu = 0;
    await page.exposeFunction("__mfCtx", () => { ctxMenu += 1; }).catch(() => {});
    await page.evaluate(() => window.addEventListener("contextmenu", (e) => { if (!e.defaultPrevented) window.__mfCtx?.(); }, true));
    await touch.start([[cx, cy]]); await sleep(900); await touch.end([]);
    await sleep(300);
    const after = await page.evaluate(() => ({ y: scrollY, scale: visualViewport?.scale ?? 1, selection: String(getSelection?.() ?? "") }));
    return { before, after, unpreventedContextMenu: ctxMenu };
  });

  // 4) 대사: 표지판(잠긴 문) 대사 — 화면 아무 데나 탭해 넘기는가
  await step("dialogue", async () => {
    await teleport(7, 12, "up");
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForSelector('[data-testid="dialogue-box"]', { timeout: 8000 });
    await sleep(900);
    const g = await geometry(page);
    await page.screenshot({ path: join(outDir, "dialogue.png") });
    const [cx] = center(g.stage);
    const tapY = g.stage.y + g.stage.h * 0.25;
    let taps = 0;
    for (; taps < 8; taps += 1) {
      const open = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]'));
      if (!open) break;
      await touch.tap(cx, tapY, 50);
      await sleep(500);
    }
    const closed = await page.evaluate(() => !document.querySelector('[data-testid="dialogue-box"]'));
    return { dialogueRect: g.dialogue, stage: g.stage, closedAfterTaps: closed ? taps : null };
  });

  // 4b) 메뉴: 메뉴 단추 → 첫 줄이 아닌 줄을 탭 → 무엇이 일어나는가, 목록 끌어 스크롤
  await step("menu", async () => {
    await teleport(28, 33, "down");
    const m = center(g0.menu);
    await touch.tap(m[0], m[1], 60);
    await sleep(900);
    const open = await page.evaluate(() => !!document.querySelector('[data-testid="main-menu"]'));
    await page.screenshot({ path: join(outDir, "menu.png") });
    const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="main-menu"] :is(button,[role="menuitem"],li)')].filter((n) => n.getBoundingClientRect().height > 0).slice(0, 12).map((n) => { const r = n.getBoundingClientRect(); return { text: (n.textContent || "").trim().slice(0, 16), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), sel: n.matches(".selected,[aria-current='true'],[aria-selected='true']") }; }));
    let tapRow = null;
    let afterOne = null;
    let afterTwo = null;
    const target = rows.find((row) => !row.sel && /아이템|Item|소지|도구/.test(row.text)) ?? rows.find((row) => !row.sel);
    if (target) {
      const p = [target.x + target.w / 2, target.y + target.h / 2];
      tapRow = target;
      await touch.tap(p[0], p[1], 60); await sleep(500);
      afterOne = await page.evaluate(() => ({ sel: document.querySelector('[data-testid="main-menu"] .selected, [data-testid="main-menu"] [aria-current="true"]')?.textContent?.trim().slice(0, 16) ?? null, testids: [...document.querySelectorAll('[data-testid="main-menu"] [data-testid]')].map((n) => n.dataset.testid).slice(0, 8) }));
      await touch.tap(p[0], p[1], 60); await sleep(700);
      afterTwo = await page.evaluate(() => ({ sel: document.querySelector('[data-testid="main-menu"] .selected, [data-testid="main-menu"] [aria-current="true"]')?.textContent?.trim().slice(0, 16) ?? null, html: document.querySelector('[data-testid="main-menu"]')?.className ?? null }));
      await page.screenshot({ path: join(outDir, "menu-item.png") });
    }
    // 닫기: B 두어 번
    for (let i = 0; i < 4; i += 1) { const b = center(g0.b); await touch.tap(b[0], b[1], 50); await sleep(300); }
    const closed = await page.evaluate(() => !document.querySelector('[data-testid="main-menu"]'));
    return { open, rows, tapRow, afterOne, afterTwo, closed };
  });

  result.errors = errors.slice(0, 10);
  await writeFile(join(outDir, "result.json"), JSON.stringify(result, null, 2));
  const video = page.video();
  await context.close();
  if (video) {
    const path = await video.path();
    await rename(path, join(outDir, "probe.webm")).catch(() => {});
  }
  return result;
}

// 영상용 걷기(따로): 마을에서 오른쪽 → 아래 → 미끄러뜨려 위 → 맵 탭
async function recordWalk(browser, deviceId) {
  const outDir = join(outRoot, deviceId);
  await mkdir(outDir, { recursive: true });
  const descriptor = DEVICES[deviceId];
  const { context, page, cdp } = await boot(browser, deviceId, outDir);
  const touch = touchApi(cdp);
  await page.evaluate(() => { window.__oprnDebug.teleport("fs_hub", 28, 33); window.__oprnInput.face("down"); });
  await sleep(800);
  const g = await geometry(page);
  const sc = center(g.stick);
  const r = g.stick.w / 2;
  const R = [sc[0] + r * 0.6, sc[1]];
  const D = [sc[0], sc[1] + r * 0.6];
  const U = [sc[0], sc[1] - r * 0.6];
  await touch.start([R]); await sleep(900);
  await touch.drag(R, D, 6, 16); await sleep(700);
  await touch.drag(D, U, 8, 16); await sleep(900);
  await touch.end([]); await sleep(600);
  // 짧은 탭 셋
  for (let i = 0; i < 3; i += 1) { await touch.start([R]); await sleep(80); await touch.end([]); await sleep(350); }
  // 맵 탭: 오른쪽 4칸 → 걷는 중 왼쪽 위로 바꿔 탭
  let g2 = await geometry(page);
  let t = 16 * g2.hero.scale;
  await touch.tap(g2.hero.x + t * 4, g2.hero.y - t * 0.5, 60);
  await sleep(500);
  g2 = await geometry(page);
  await touch.tap(g2.hero.x - t * 2, g2.hero.y - t * 1.5, 60);
  await sleep(1800);
  // 서 있는 사람 하나를 탭 → 곁으로 걸어가 말 걸기
  const here = await state(page);
  const snap = () => page.evaluate(() => window.__oprnCharacterSprites?.()?.events ?? {});
  const first = await snap();
  await sleep(600);
  const second = await snap();
  const d = (v) => Math.abs(v.x - here.x) + Math.abs(v.y - here.y);
  const npc = Object.entries(second).filter(([id, v]) => v.alpha > 0.5 && first[id] && Math.abs(first[id].x - v.x) < 2 && Math.abs(first[id].y - v.y) < 2)
    .map(([id, v]) => ({ id, x: Math.floor(v.x / 16), y: Math.round(v.y / 16) - 1 })).sort((a, b) => d(a) - d(b)).find((v) => d(v) >= 2 && d(v) <= 12);
  if (npc) {
    g2 = await geometry(page);
    t = 16 * g2.hero.scale;
    await touch.tap(g2.hero.x + t * (npc.x - here.x), g2.hero.y + t * (npc.y - here.y) - 12 * g2.hero.scale, 60);
    for (let i = 0; i < 24; i += 1) { await sleep(250); if (await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]'))) break; }
    await sleep(1500);
    // 대사는 화면 아무 데나 탭해서 넘긴다
    for (let i = 0; i < 6; i += 1) {
      if (!(await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]')))) break;
      await touch.tap(g2.stage.x + g2.stage.w * 0.5, g2.stage.y + g2.stage.h * 0.3, 50);
      await sleep(900);
    }
  }
  await sleep(800);
  void descriptor;
  const video = page.video();
  await context.close();
  if (video) await rename(await video.path(), join(outDir, "walk.webm")).catch(() => {});
}

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const summary = {};
try {
  for (const id of deviceIds) {
    if (process.argv.includes("--walk-only")) { await recordWalk(browser, id); continue; }
    console.log(`[mobile-feel] ${id}`);
    summary[id] = await runDevice(browser, id);
    if (wantVideo) await recordWalk(browser, id);
  }
} finally {
  await browser.close();
  await server.close();
}
await writeFile(join(outRoot, "summary.json"), JSON.stringify(summary, null, 2));
console.log(`[mobile-feel] → ${outRoot}/summary.json`);
void readdir;
