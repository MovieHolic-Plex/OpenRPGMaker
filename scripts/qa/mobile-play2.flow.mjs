// 폰 터치 전 구간 점검(2026-10-24) — 타이틀 → 걷기 → 대사 → 기록 열고 닫기 → 선택지 → 메뉴·장비 → 상점 → 전투.
// 입력은 터치뿐이다: 탭은 page.touchscreen.tap, 조이스틱 끌기는 크로뮴 CDP Input.dispatchTouchEvent(진짜 터치).
// 웹킷에는 터치 이동 API 가 없어 끌기만 합성 PointerEvent 로 한다(보고서에 적는다).
// 사용:
//   node scripts/qa/mobile-play2.flow.mjs --netns --device "iPhone 15" [--landscape] [--frame] [--video] [--out /tmp/mp2/run] [--only title,field]
//   --url <https://play.openrpgmaker.com/games/fallen-star/play> 이면 운영 페이지(iframe)를 그대로 연다(체크포인트 없이 타이틀·새 게임만).
import { chromium, webkit, devices } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
if (process.argv.includes("--netns") && process.env.OPRN_QA_IN_NETNS !== "1") {
  const inner = process.argv.slice(1).filter((a) => a !== "--netns").map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(" ");
  const r = spawnSync("unshare", ["-rn", "bash", "-c", `ip link set lo up && exec ${JSON.stringify(process.execPath)} ${inner}`], { stdio: "inherit", env: { ...process.env, OPRN_QA_IN_NETNS: "1" } });
  process.exit(r.status ?? 1);
}
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const flag = (name) => process.argv.includes(`--${name}`);
const DEVICE = arg("device", "iPhone 15");
const LANDSCAPE = flag("landscape");
const FRAME = flag("frame");
const VIDEO = flag("video");
const URL_ = arg("url", "");
const PLAY = arg("play", "/tmp/mp/demos/chrono-bell.play.json");
const OUT = arg("out", `/tmp/mp2/run-${DEVICE.replace(/\W+/g, "_")}${LANDSCAPE ? "-land" : ""}${FRAME ? "-frame" : ""}`);
const ONLY = (arg("only", "") || "").split(",").filter(Boolean);
mkdirSync(OUT, { recursive: true });
const dev = DEVICE === "Desktop" ? { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } : devices[LANDSCAPE ? `${DEVICE} landscape` : DEVICE];
if (!dev) throw new Error(`no device ${DEVICE}`);
const isWebkit = dev.defaultBrowserType === "webkit";
const cps = JSON.parse(readFileSync(join(REPO, "scripts/qa/runtime/checkpoints/fallen-star.json"), "utf8")).checkpoints;
const cp = (id) => cps.find((c) => c.id === id);
const SHOP = { ...cp("hub-start"), id: "shop-apothecary", mapId: "fs_apothecary", x: 15, y: 14, facing: "up", items: { item_potion: 2 }, gold: 500 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const note = (seg, step, ok, detail = "") => { results.push({ seg, step, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${seg}/${step} ${detail}`); };

function gameFrame(page) {
  return page.frames().find((f) => f !== page.mainFrame() && /player\.html|index\.html|games-kr|:18322/.test(f.url())) ?? page.mainFrame();
}
async function box(page, sel) {
  const loc = gameFrame(page).locator(sel).first();
  if ((await loc.count().catch(() => 0)) === 0) return null; // 없는 요소에 30초씩 기다리지 않는다
  return loc.boundingBox({ timeout: 3000 }).catch(() => null);
}
async function tapAt(page, x, y, wait = 700) { await page.touchscreen.tap(x, y); await sleep(wait); }
async function tapSel(page, sel, wait = 700) {
  const b = await box(page, sel);
  if (!b) return false;
  await tapAt(page, b.x + b.width / 2, b.y + b.height / 2, wait);
  return true;
}
const has = (page, sel) => gameFrame(page).evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; }, sel).catch(() => false);
async function tapText(page, re) {
  const pt = await gameFrame(page).evaluate((src) => {
    const rx = new RegExp(src, "i");
    for (const el of document.querySelectorAll("button, [role=button], [role=menuitem], li, .status-menu-command, [data-testid]")) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || getComputedStyle(el).visibility === "hidden") continue;
      if ([...el.children].some((c) => rx.test(c.textContent || "") && c.getBoundingClientRect().width > 8)) continue;
      if (rx.test((el.textContent || "").trim()) && (el.textContent || "").length < 40) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, re.source).catch(() => null);
  if (!pt) return false;
  const off = await frameOffset(page);
  await tapAt(page, pt.x + off.x, pt.y + off.y, 800);
  return true;
}
async function tapCommand(page, label) {
  const pt = await gameFrame(page).evaluate((label) => {
    for (const el of document.querySelectorAll(".status-menu-command, [role=menuitem], button")) {
      const r = el.getBoundingClientRect();
      if (r.width > 8 && (el.textContent || "").trim().replace(/\s+/g, "") === label) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, label).catch(() => null);
  if (!pt) return false;
  const off = await frameOffset(page);
  await tapAt(page, pt.x + off.x, pt.y + off.y, 900);
  return true;
}
async function frameOffset(page) {
  const f = gameFrame(page);
  if (f === page.mainFrame()) return { x: 0, y: 0 };
  const b = await (await f.frameElement()).boundingBox();
  return { x: b?.x ?? 0, y: b?.y ?? 0 };
}

/** 조작 넷(조이스틱 영역·A·B·메뉴)이 보이고, 화면 안에 있고, 그 자리를 누르면 그 단추가 받는지. */
async function padCheck(page, seg, step) {
  const r = await gameFrame(page).evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const out = {};
    for (const [k, sel] of [["stick", "[data-testid='touch-dpad'] .touch-dpad-base"], ["a", "[data-testid='touch-action-a']"], ["b", "[data-testid='touch-action-b']"], ["menu", "[data-testid='touch-menu']"]]) {
      const el = document.querySelector(sel);
      if (!el) { out[k] = "missing"; continue; }
      const rc = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || rc.width < 10) { out[k] = "hidden"; continue; }
      if (rc.left < 0 || rc.top < 0 || rc.right > vw + 0.5 || rc.bottom > vh + 0.5) { out[k] = `clipped ${Math.round(rc.top)}..${Math.round(rc.bottom)}/${vh}`; continue; }
      const hit = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
      out[k] = hit && (el === hit || el.contains(hit) || hit.contains(el)) ? "ok" : `covered by ${hit?.className || hit?.tagName}`;
    }
    const stage = document.querySelector(".play-stage")?.getBoundingClientRect();
    out.stage = stage ? `${Math.round(stage.left)},${Math.round(stage.top)} ${Math.round(stage.width)}x${Math.round(stage.height)}` : "none";
    out.vp = `${vw}x${vh}`;
    out.owner = document.querySelector(".player-layout")?.dataset.playInputOwner;
    out.touchLayout = document.querySelector(".play-viewport")?.dataset.touchLayout ?? null;
    return out;
  }).catch((e) => ({ error: String(e).slice(0, 80) }));
  const ok = ["stick", "a", "b", "menu"].every((k) => r[k] === "ok");
  note(seg, `pad@${step}`, ok, JSON.stringify(r));
  return ok;
}

/** 열린 창(메뉴·상점)의 행: 글자·선택 여부·화면 글자 크기. */
async function dumpRows(page, rootSel = "[data-testid='main-menu'], .runtime-shop-overlay") {
  return gameFrame(page).evaluate((rootSel) => {
    const root = document.querySelector(rootSel);
    if (!root) return { rows: [], fonts: {} };
    const rows = [];
    for (const el of root.querySelectorAll("button, [role=menuitem], [role=option]")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const fsCss = parseFloat(getComputedStyle(el).fontSize);
      const k = r.height / (el.offsetHeight || r.height);
      rows.push({ t: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24), cur: el.matches(".selected, [aria-current='true'], [aria-selected='true']"), fs: +(fsCss * k).toFixed(1), y: Math.round(r.y), h: Math.round(r.height) });
    }
    const fonts = {};
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement; if (!el || !(n.textContent || "").trim()) continue;
      const r = el.getBoundingClientRect(); if (r.width < 2) continue;
      const k = r.height / (el.offsetHeight || r.height);
      const fs = Math.round(parseFloat(getComputedStyle(el).fontSize) * k * 10) / 10;
      fonts[fs] = (fonts[fs] || 0) + (n.textContent || "").trim().length;
    }
    return { rows, fonts };
  }, rootSel);
}
async function curText(page) {
  return gameFrame(page).evaluate(() => [...document.querySelectorAll("[data-testid='main-menu'] :is(.selected, [aria-current='true'])")].map((e) => (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 20)));
}

/** 목록 줄(버튼·메뉴 항목)을 공백 뺀 글자로 찾아 가운데를 탭한다. */
async function tapRowText(page, re) {
  const pt = await gameFrame(page).evaluate((src) => {
    const rx = new RegExp(src);
    for (const el of document.querySelectorAll("button, [role=menuitem], [role=option], li")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || getComputedStyle(el).visibility === "hidden") continue;
      if (rx.test((el.textContent || "").replace(/\s+/g, ""))) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, re.source).catch(() => null);
  if (!pt) return false;
  const off = await frameOffset(page);
  await tapAt(page, pt.x + off.x, pt.y + off.y, 300);
  return true;
}
/** 글자가 맞는 목록 줄이 선택 표시를 달고 있는가. */
async function rowSelected(page, re) {
  return gameFrame(page).evaluate((src) => {
    const rx = new RegExp(src);
    return [...document.querySelectorAll(".selected, [aria-current='true'], [aria-selected='true']")].some((el) => rx.test((el.textContent || "").replace(/\s+/g, "")));
  }, re.source);
}
/** 줄 탭 규칙: 첫 탭은 커서만(화면 그대로), 두 번째 탭이 결정. 결과 문자열을 note 로 남긴다. */
async function tapRowTwice(page, seg, step, re, screenSig) {
  const sig0 = await screenSig();
  const already = await rowSelected(page, re);
  const hit = await tapRowText(page, re);
  await sleep(700);
  const sig1 = await screenSig();
  if (already) {
    note(seg, `${step}-tap-selected-confirms`, hit && sig1 !== sig0, `screen ${sig0} -> ${sig1}`);
    return sig1 !== sig0;
  }
  const moved = await rowSelected(page, re);
  note(seg, `${step}-first-tap-moves`, hit && moved && sig0 === sig1, `hit=${hit} selected=${moved} screen ${sig0} -> ${sig1}`);
  await tapRowText(page, re);
  await sleep(900);
  const sig2 = await screenSig();
  note(seg, `${step}-second-tap-confirms`, sig2 !== sig1, `screen ${sig1} -> ${sig2}`);
  return sig2 !== sig1;
}
async function shot(page, seg, name) {
  await page.screenshot({ path: join(OUT, `${seg}-${name}.png`), scale: "css" });
}

/** 조이스틱 끌기: 영역 안 한 점을 누르고 dx,dy 로 끌어 ms 동안 쥐고 뗀다. */
async function drag(page, cdp, dx, dy, ms) {
  const zone = await box(page, "[data-testid='touch-dpad'] .touch-dpad-base");
  if (!zone) return false;
  const x = zone.x + zone.width / 2, y = zone.y + zone.height / 2;
  if (cdp) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 7 }] });
    for (let i = 1; i <= 5; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * i / 5, y: y + dy * i / 5, id: 7 }] }); await sleep(30); }
    await sleep(ms);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } else {
    // 웹킷: 터치 이동 API 가 없다 — 같은 좌표로 PointerEvent 를 합성한다(끌기만).
    const off = await frameOffset(page);
    await gameFrame(page).evaluate(async ([x, y, dx, dy, ms]) => {
      const zone = document.querySelector("[data-testid='touch-stick-zone']");
      const fire = (type, px, py) => zone.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: "touch", clientX: px, clientY: py, bubbles: true, cancelable: true, isPrimary: true }));
      fire("pointerdown", x, y);
      for (let i = 1; i <= 5; i++) { fire("pointermove", x + dx * i / 5, y + dy * i / 5); await new Promise((r) => setTimeout(r, 30)); }
      await new Promise((r) => setTimeout(r, ms));
      fire("pointerup", x + dx, y + dy);
    }, [x - off.x, y - off.y, dx, dy, ms]);
  }
  await sleep(400);
  return true;
}
const playerPos = (page) => gameFrame(page).evaluate(() => { try { const s = window.__oprnDebug?.readState?.(); return s ? `${s.mapId ?? s.currentMapId}:${s.x},${s.y}` : null; } catch { return null; } }).catch(() => null);

async function advanceDialogue(page, seg, until, max = 25) {
  for (let i = 0; i < max; i++) {
    if (await until()) return true;
    if (await has(page, ".choices-active")) return "choices";
    if (await has(page, "[data-testid='dialogue-box']")) await tapSel(page, "[data-testid='dialogue-box']", 900);
    else await sleep(700);
  }
  return until();
}

async function openPage(browser, seg, checkpoint) {
  const dir = join(OUT, `v-${seg}`);
  const ctx = await browser.newContext({ ...dev, locale: "ko-KR", ...(VIDEO ? { recordVideo: { dir, size: dev.viewport } } : {}) });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 240)));
  if (process.env.MP_REQ_DEBUG) {
    const open = new Map();
    page.on("request", (r) => open.set(r, Date.now()));
    page.on("requestfinished", (r) => open.delete(r));
    page.on("requestfailed", (r) => { console.log("REQFAIL", r.url().slice(0, 160), r.failure()?.errorText); open.delete(r); });
    setInterval(() => { const now = Date.now(); for (const [r, t] of open) if (now - t > 20000) { console.log("REQSTUCK", Math.round((now - t) / 1000), r.url().slice(0, 160)); open.delete(r); } }, 5000).unref();
  }
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 240)); });
  if (flag("fine")) {
    // 펜 디지타이저가 있는 안드로이드(갤럭시 폴드 등)는 `(pointer: fine)` 으로 보고한다 — 그 상태를 흉내 낸다.
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      const fake = (q, matches) => ({ matches, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
      window.matchMedia = (q) => /\(pointer:\s*fine\)/.test(q) ? fake(q, true) : /\((any-)?pointer:\s*coarse\)/.test(q) ? fake(q, false) : /\(hover:\s*none\)/.test(q) ? fake(q, false) : original(q);
    });
  }
  if (!URL_) {
    await page.addInitScript(([url, cpt, nodock]) => {
      // 「이 기기는 터치」 기억(첫 터치 승격)은 남긴다 — 지우면 승격 뒤 다시 읽기가 끝없이 돈다.
      try { const t = localStorage.getItem("oprn-touch-input"); localStorage.clear(); if (t) localStorage.setItem("oprn-touch-input", t); if (nodock) localStorage.setItem("oprn-dialogue-dock", "0"); } catch {}
      window.__OPENRPG_BOOT__ = { projectUrl: url, saveNamespace: "mobile-play2", qaInstrumentation: true, ...(cpt ? { qaCheckpoint: cpt } : {}) };
    }, ["/__mp/project.json", checkpoint, flag("nodock")]);
    await page.route("**/__mp/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", path: PLAY }));
    if (FRAME) {
      // 스토어 플레이 화면 흉내: 위 막대 + 남는 높이 전부를 iframe 으로(운영 sandbox·allow 그대로).
      await page.route("**/__mp/store.html", (route) => route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0;height:100%;background:#000}.shell{position:fixed;inset:0;display:flex;flex-direction:column;height:100dvh;padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box}.bar{height:44px;background:#14161c;color:#ddd;font:14px system-ui;display:flex;align-items:center;padding:0 12px}iframe{flex:1;border:0;width:100%}</style><div class=shell><div class=bar>폴른 스타 · 스토어 플레이</div><iframe src="/player.html" sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-orientation-lock" allow="fullscreen; autoplay; gamepad; screen-wake-lock"></iframe></div>` }));
      await page.goto(`${server.url}/__mp/store.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
    } else {
      await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
    }
  } else {
    const overrides = arg("store-overrides", "");
    if (overrides) {
      // 스토어 저장소 작업 트리의 app.css·game.js 와 플레이 페이지 틀 변경(sandbox·viewport)을 운영 페이지에 덧입혀 미리 본다.
      await page.route(/\/static\/(app\.css|game\.js)/, (route) => {
        const name = new URL(route.request().url()).pathname.endsWith(".css") ? "app.css" : "game.js";
        return route.fulfill({ status: 200, contentType: name.endsWith(".css") ? "text/css" : "text/javascript", path: join(overrides, "public", name) });
      });
      await page.route((u) => u.href === URL_, async (route) => {
        const res = await route.fetch();
        let html = await res.text();
        html = html.replace('content="width=device-width,initial-scale=1"', 'content="width=device-width,initial-scale=1,viewport-fit=cover"')
          .replace('sandbox="allow-scripts allow-same-origin allow-pointer-lock"', 'sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-orientation-lock"');
        return route.fulfill({ response: res, body: html });
      });
    }
    await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 120000 });
  }
  return { ctx, page, dir };
}
async function closePage(ctx, seg, dir) {
  await ctx.close();
  if (!VIDEO) return;
  const f = readdirSync(dir).find((x) => x.endsWith(".webm"));
  if (f) renameSync(join(dir, f), join(OUT, `seg-${seg}.webm`));
}
async function waitBoot(page, checkpoint) {
  for (let i = 0; i < 300; i++) {
    const f = gameFrame(page);
    const st = await f.evaluate(() => ({ title: !!document.querySelector("[data-testid='title-screen']") && !document.querySelector("[data-testid='boot-loader']"), state: !!(window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]')), start: [...document.querySelectorAll("button")].find((b) => /시작하기|Start/.test(b.textContent || "")) ? true : false })).catch(() => ({}));
    if (checkpoint ? st.state : st.title) return true;
    if (st.start) { if (!(await tapSel(page, "[data-testid='boot-loader-start']", 1500))) await tapText(page, /시작하기|Start/); }
    await sleep(1000);
  }
  return false;
}

const SEGMENTS = {
  async title(browser) {
    const { ctx, page, dir } = await openPage(browser, "title", null);
    note("title", "boot", await waitBoot(page, null));
    await sleep(2500);
    await shot(page, "title", "1-title");
    await padCheck(page, "title", "title");
    // 버튼이 아닌 게임 바탕(무대 위쪽)을 탭 → 확인 = 새 게임.
    const st = await box(page, ".play-stage");
    if (st) await tapAt(page, st.x + st.width * 0.5, st.y + st.height * 0.12, 1500);
    let started = false;
    for (let i = 0; i < 12 && !started; i++) { started = !(await has(page, "[data-testid='title-screen']")); await sleep(500); }
    note("title", "tap-backdrop-starts-game", started);
    await sleep(3000);
    await shot(page, "title", "2-after-tap");
    await closePage(ctx, "title", dir);
  },
  async field(browser) {
    const hub = cp("hub-start");
    const { ctx, page, dir } = await openPage(browser, "field", { ...hub, items: { ...(hub.items ?? {}), equip_iron_sword: 1 } });
    note("field", "boot", await waitBoot(page, true));
    await sleep(2500);
    const cdp = isWebkit ? null : await ctx.newCDPSession(page);
    // 포고 자동 이벤트(대사)가 곧 돈다 — 대사가 뜨면 대사 상태 점검부터.
    for (let i = 0; i < 10 && !(await has(page, "[data-testid='dialogue-box']")); i++) await sleep(600);
    if (await has(page, "[data-testid='dialogue-box']")) {
      await shot(page, "field", "1-dialogue");
      await padCheck(page, "field", "dialogue");
      // 기록: 폰에는 기록 단추가 없다(실수로 열리지 않게). 열기는 메뉴의 대화 기록·키 L — 여기서는 L 로 열고 닫기는 터치로만.
      await gameFrame(page).evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "l", code: "KeyL", bubbles: true })));
      await sleep(700);
      const logOpen = await has(page, "[data-testid='dialogue-log'], [data-testid='dialogue-backlog']");
      note("field", "log-open", logOpen);
      if (logOpen) {
        await shot(page, "field", "2-log");
        await padCheck(page, "field", "log");
        const closeSel = (await has(page, "[data-testid='dialogue-log-close']")) ? "[data-testid='dialogue-log-close']" : "[data-testid='dialogue-backlog-close']";
        note("field", "log-close-visible", await has(page, closeSel), closeSel);
        // 바탕 탭으로 닫기
        const lb = await box(page, "[data-testid='dialogue-log'], [data-testid='dialogue-backlog']");
        await tapAt(page, lb.x + lb.width * 0.5, lb.y + lb.height * 0.6, 800);
        note("field", "log-closed-by-tap", !(await has(page, "[data-testid='dialogue-log'], [data-testid='dialogue-backlog']")));
        // 다시 열고 닫기 단추로
        await gameFrame(page).evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "l", code: "KeyL", bubbles: true })));
        await sleep(700);
        await tapSel(page, closeSel, 800);
        note("field", "log-closed-by-button", !(await has(page, "[data-testid='dialogue-log'], [data-testid='dialogue-backlog']")));
      }
      // 대사 넘기기: 게임 바탕 탭(대사창 밖) 한 번, 나머지는 대사창 탭.
      const st = await box(page, ".play-stage");
      const before = await gameFrame(page).evaluate(() => document.querySelector("[data-testid='dialogue-box']")?.textContent?.slice(0, 40));
      await tapAt(page, st.x + st.width * 0.5, st.y + st.height * 0.25, 1200);
      const after = await gameFrame(page).evaluate(() => document.querySelector("[data-testid='dialogue-box']")?.textContent?.slice(0, 40));
      note("field", "tap-backdrop-advances", before !== after, `${before} -> ${after}`);
      const r = await advanceDialogue(page, "field", async () => !(await has(page, "[data-testid='dialogue-box']")), 30);
      if (r === "choices") {
        await shot(page, "field", "3-choices");
        await padCheck(page, "field", "choices");
        const ok = await tapSel(page, ".choices-active [role='menuitem'], .choices-active li, .choices-active button", 1000);
        note("field", "choice-tap", ok);
        await advanceDialogue(page, "field", async () => !(await has(page, "[data-testid='dialogue-box']")), 30);
      }
    }
    // 자동 이벤트(컷신)가 끝나 조작이 돌아올 때까지: 대사가 있으면 넘기고, 없으면 조이스틱을 끌어 본다.
    const p0 = await playerPos(page);
    let p1 = p0;
    for (let i = 0; i < 25 && p1 === p0; i++) {
      if (await has(page, ".choices-active")) { await tapSel(page, ".choices-active [role='menuitem'], .choices-active li, .choices-active button", 900); continue; }
      if (await has(page, "[data-testid='dialogue-box']")) { await tapSel(page, "[data-testid='dialogue-box']", 900); continue; }
      await drag(page, cdp, i % 2 ? 60 : 0, i % 2 ? 0 : 60, 700);
      p1 = await playerPos(page);
      if (flag("debug")) console.log("walk try", i, p1, await gameFrame(page).evaluate(() => ({ held: document.activeElement?.tagName, zone: document.querySelector("[data-testid='touch-stick-zone']")?.dataset.active ?? null })));
    }
    note("field", "joystick-walks", p0 !== p1, `${p0} -> ${p1}${isWebkit ? " (webkit: synthesized drag)" : " (CDP touch)"}`);
    await shot(page, "field", "4-walk");
    await padCheck(page, "field", "field");
    // 메뉴 단추 → 메뉴 → 장비
    let menuOpen = false;
    for (let i = 0; i < 20 && !menuOpen; i++) {
      if (await has(page, "[data-testid='dialogue-box']")) { await tapSel(page, "[data-testid='dialogue-box']", 900); continue; }
      await tapSel(page, "[data-testid='touch-menu']", 1200);
      menuOpen = await has(page, "[data-testid='main-menu']");
    }
    note("field", "menu-button-opens-menu", menuOpen);
    await shot(page, "field", "5-menu");
    await padCheck(page, "field", "menu");
    if (menuOpen) {
      const eq = await tapText(page, /^장비$/) || await tapCommand(page, "장비");
      note("field", "menu-equip-tap", eq);
      await sleep(800);
      await shot(page, "field", "6-equip");
      // 줄 탭으로 장착하는 확인은 windows 구간(첫 탭 = 커서, 두 번째 = 결정)이 맡는다.
      const sig = await gameFrame(page).evaluate(() => document.querySelector("[data-testid='main-menu']")?.textContent?.replace(/\s+/g, " ").slice(0, 160));
      note("field", "equip-screen", /장비|무기|방어|머리|몸|장신/.test(sig ?? ""), sig);
      for (let i = 0; i < 5 && (await has(page, "[data-testid='main-menu']")); i++) await tapSel(page, "[data-testid='touch-action-b']", 700);
      note("field", "menu-closed-by-B", !(await has(page, "[data-testid='main-menu']")));
    }
    await closePage(ctx, "field", dir);
  },
  async choice(browser) {
    const { ctx, page, dir } = await openPage(browser, "choice", cp("hanel-h1"));
    note("choice", "boot", await waitBoot(page, true));
    await sleep(2500);
    let r = false;
    for (let i = 0; i < 6 && r !== "choices"; i++) {
      await tapSel(page, "[data-testid='touch-action-a']", 1000);
      r = await advanceDialogue(page, "choice", () => has(page, ".choices-active"), 20);
      if (await has(page, ".choices-active")) r = "choices";
    }
    note("choice", "choices-shown", r === "choices" || r === true);
    await shot(page, "choice", "1-choices");
    await padCheck(page, "choice", "choices");
    // 선택 안 된 선택지를 한 번 탭 = 커서만, 한 번 더 = 결정.
    const pick = await gameFrame(page).evaluate(() => {
      const rows = [...document.querySelectorAll(".choices-active button, .choices-active [role='menuitem']")];
      const i = rows.findIndex((r) => !r.matches(".selected, [aria-current='true'], [aria-selected='true']"));
      return i < 0 ? null : (rows[i].textContent || "").replace(/\s+/g, "");
    });
    if (pick) {
      const re = new RegExp(pick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      await tapRowText(page, re); await sleep(700);
      note("choice", "choice-first-tap-moves", (await has(page, ".choices-active")) && (await rowSelected(page, re)), pick);
      await tapRowText(page, re); await sleep(1200);
    }
    note("choice", "choice-tapped-closes", !(await has(page, ".choices-active")));
    await shot(page, "choice", "2-after-choice");
    await closePage(ctx, "choice", dir);
  },
  async windows(browser) {
    const { ctx, page, dir } = await openPage(browser, "windows", { ...SHOP, items: { item_potion: 2, equip_iron_sword: 1 } });
    note("windows", "boot", await waitBoot(page, true));
    await sleep(2500);
    for (let i = 0; i < 6 && !(await has(page, "[data-testid='main-menu']")); i++) await tapSel(page, "[data-testid='touch-menu']", 1200);
    const menu = await has(page, "[data-testid='main-menu']");
    note("windows", "menu-open", menu);
    await shot(page, "windows", "1-menu");
    const d0 = await dumpRows(page);
    console.log("MENU", JSON.stringify(d0));
    console.log("DIAG", JSON.stringify(await gameFrame(page).evaluate(() => {
      const m = document.querySelector("[data-testid='main-menu']"); const st = document.querySelector(".play-stage");
      const cs = getComputedStyle(m); const ss = getComputedStyle(st);
      const row = m.querySelector(".status-menu-command"); 
      return { cls: m.className, pos: cs.position, inset: [cs.top, cs.right, cs.bottom, cs.left], w: cs.width, h: cs.height, rect: m.getBoundingClientRect().toJSON(), stageOverflow: ss.overflow, stageRect: st.getBoundingClientRect().toJSON(), ff: row && getComputedStyle(row).fontFamily, skin: m.dataset.menuSkin, vars: ["--play-scale", "--mobile-ui-k", "--touch-band-top", "--touch-controls-y", "--touch-stick"].map((v) => getComputedStyle(document.querySelector(".play-viewport")).getPropertyValue(v)), parent: m.parentElement.className };
    })));
    // 첫 탭은 커서만, 두 번째 탭이 결정. 화면 서명 = 메뉴 화면 이름 + 선택 줄 + 본문 앞부분.
    const sig = () => gameFrame(page).evaluate(() => {
      const m = document.querySelector("[data-testid='main-menu']");
      if (!m) return "closed";
      return `${m.dataset.statusMenuScreen}|${(m.querySelector(".status-menu-detail-title")?.textContent || "").replace(/\s+/g, "")}|${[...m.querySelectorAll(".status-menu-detail-list > *")].map((e) => (e.textContent || "").replace(/\s+/g, "").slice(0, 6)).join(",")}`;
    });
    if (flag("diag")) { await closePage(ctx, "windows", dir); return; }
    await tapRowTwice(page, "windows", "rail-equip", /^장비$/, sig);
    await shot(page, "windows", "2-equip");
    // 장비: 배우 → 무기 칸 → 철 검. 줄마다 같은 규칙.
    await tapRowTwice(page, "windows", "equip-actor", /^카엘/, sig);
    await shot(page, "windows", "3-equip-slots");
    console.log("SLOTS", JSON.stringify(await dumpRows(page)));
    await tapRowTwice(page, "windows", "equip-slot", /^무기/, sig);
    await shot(page, "windows", "4-equip-candidates");
    console.log("CANDS", JSON.stringify(await dumpRows(page)));
    if (flag("tree")) console.log("TREE", await gameFrame(page).evaluate(() => {
      const out = [];
      const walk = (el, d) => { if (d > 5) return; const r = el.getBoundingClientRect(); if (r.width < 2) return; const cs = getComputedStyle(el);
        out.push(`${"  ".repeat(d)}${el.tagName.toLowerCase()}.${[...el.classList].join(".")} ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} pos=${cs.position} ov=${cs.overflow} disp=${cs.display}`);
        if (el.matches("button, [role=menuitem]")) return; for (const c of el.children) walk(c, d + 1); };
      walk(document.querySelector("[data-testid='main-menu']"), 0); return out.join("\n"); }));
    await tapRowTwice(page, "windows", "equip-iron", /철검/, sig);
    await shot(page, "windows", "5-equipped");
    const eqText = await gameFrame(page).evaluate(() => (document.querySelector("[data-testid='main-menu']")?.textContent || "").replace(/\s+/g, ""));
    note("windows", "iron-sword-equipped", /무기철검/.test(eqText), eqText.match(/무기.{0,8}/)?.[0] ?? "");
    console.log("EQUIP", JSON.stringify(await dumpRows(page)));
    // 아이템 창 
    for (let i = 0; i < 4 && (await sig()) !== "closed" && !/^main/.test(await sig()); i++) await tapSel(page, "[data-testid='touch-action-b']", 700);
    await tapRowTwice(page, "windows", "rail-items", /^아이템$/, sig);
    await shot(page, "windows", "6-items");
    console.log("ITEMS", JSON.stringify(await dumpRows(page)));
    for (let i = 0; i < 4 && !/^main/.test(await sig()); i++) await tapSel(page, "[data-testid='touch-action-b']", 700);
    // 기록 ▸ → 저장 → 칸 목록: 둘째 칸 한 번 탭 = 커서만.
    await tapRowTwice(page, "windows", "rail-record", /^기록/, sig);
    await shot(page, "windows", "7-record");
    console.log("RECORD", JSON.stringify(await dumpRows(page)));
    await closePage(ctx, "windows", dir);
  },
  async matrix(browser) {
    // 기기 비교판(2026-10-24): 같은 장면(대사 → 선택지 → 메뉴)을 찍고, 대사 상자·메뉴를 게임 px 로 잰다.
    const { ctx, page, dir } = await openPage(browser, "matrix", cp("hanel-h1"));
    note("matrix", "boot", await waitBoot(page, true));
    await sleep(2500);
    const touch = await has(page, "[data-testid='touch-stick-zone']");
    const key = async (k) => { if (FRAME) await gameFrame(page).evaluate((k) => { const t = document.activeElement && document.activeElement !== document.body ? document.activeElement : document; t.dispatchEvent(new KeyboardEvent("keydown", { key: k, code: k, bubbles: true })); t.dispatchEvent(new KeyboardEvent("keyup", { key: k, code: k, bubbles: true })); }, k); else await page.keyboard.press(k); await sleep(700); };
    const advance = async () => { if (touch) await tapSel(page, "[data-testid='dialogue-box']", 800); else await key("Enter"); };
    const geo = () => gameFrame(page).evaluate(() => {
      const st = document.querySelector(".play-stage"); const vp = document.querySelector(".play-viewport");
      if (!st) return null;
      const sr = st.getBoundingClientRect(); const s = sr.width / st.offsetWidth;
      const g = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round((r.x - sr.x) / s), Math.round((r.y - sr.y) / s), Math.round(r.width / s), Math.round(r.height / s), +(r.width).toFixed(0)]; };
      const fsOf = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return +(parseFloat(getComputedStyle(e).fontSize) * (r.height / (e.offsetHeight || r.height))).toFixed(1); };
      return { vp: `${innerWidth}x${innerHeight}`, scale: +s.toFixed(3), dock: vp?.dataset.dialogueDock === "true", stage: [Math.round(sr.x), Math.round(sr.y), Math.round(sr.width), Math.round(sr.height)], box: g("[data-testid='dialogue-box']"), boxFont: fsOf("[data-testid='dialogue-box'] .dialogue-text, [data-testid='dialogue-box']"), choices: g(".choices-active .dialogue-choices, .choices-active [role='menu'], .choices-active ul"), menu: g("[data-testid='main-menu']"), menuFont: fsOf("[data-testid='main-menu'] .status-menu-command, [data-testid='main-menu'] button") };
    });
    // 하넬에게 말 걸기(A / Enter) — 대사가 뜰 때까지.
    for (let i = 0; i < 6 && !(await has(page, "[data-testid='dialogue-box']")) && !(await has(page, ".choices-active")); i++) {
      if (touch) await tapSel(page, "[data-testid='touch-action-a']", 1000); else await key("Enter");
      for (let j = 0; j < 6 && !(await has(page, "[data-testid='dialogue-box']")); j++) await sleep(400);
    }
    await sleep(800);
    if (flag("diag")) console.log("BOXDIAG", JSON.stringify(await gameFrame(page).evaluate(() => {
      const out = []; let e = document.querySelector("[data-testid='dialogue-box']");
      for (let i = 0; e && i < 4; i++, e = e.parentElement) { const c = getComputedStyle(e); out.push({ cls: e.className.slice(0, 80), pos: c.position, l: c.left, r: c.right, w: c.width, ml: c.marginLeft, mr: c.marginRight, mw: c.maxWidth, inl: e.getAttribute("style")?.slice(0, 120) }); }
      return out; })));
    if (!(await has(page, ".choices-active"))) {
      await shot(page, "matrix", "1-dialogue");
      note("matrix", "dialogue", true, JSON.stringify(await geo()));
    }
    for (let i = 0; i < 20 && !(await has(page, ".choices-active")); i++) { if (await has(page, "[data-testid='dialogue-box']")) await advance(); else await sleep(500); }
    const ch = await has(page, ".choices-active");
    if (ch) { await shot(page, "matrix", "2-choice"); }
    note("matrix", "choice", ch, JSON.stringify(await geo()));
    if (ch) { if (touch) { await tapSel(page, ".choices-active button, .choices-active [role='menuitem']", 600); await tapSel(page, ".choices-active button, .choices-active [role='menuitem']", 900); } else await key("Enter"); }
    for (let i = 0; i < 30 && ((await has(page, "[data-testid='dialogue-box']")) || (await has(page, ".choices-active"))); i++) { if (await has(page, ".choices-active")) { if (touch) await tapSel(page, ".choices-active button", 900); else await key("Enter"); } else await advance(); }
    let menu = false;
    for (let i = 0; i < 6 && !menu; i++) { if (touch) await tapSel(page, "[data-testid='touch-menu']", 1200); else await key("Escape"); menu = await has(page, "[data-testid='main-menu']"); }
    if (menu) { await sleep(600); await shot(page, "matrix", "3-menu"); }
    note("matrix", "menu", menu, JSON.stringify(await geo()));
    await closePage(ctx, "matrix", dir);
  },
  async kbwindows(browser) {
    // 키보드(데스크톱)로 메뉴 → 장비 → 무기 후보 → 아이템 화면을 찍는다 — 같은 창이 데스크톱 배율에서 어떻게 보이는지.
    const { ctx, page, dir } = await openPage(browser, "kbwindows", { ...SHOP, items: { item_potion: 2, equip_iron_sword: 1 } });
    note("kbwindows", "boot", await waitBoot(page, true));
    await sleep(2500);
    const k = async (key, ms = 600) => { await page.keyboard.press(key); await sleep(ms); };
    await k("Escape", 1200);
    note("kbwindows", "menu", await has(page, "[data-testid='main-menu']"));
    await shot(page, "kbwindows", "1-menu");
    await k("ArrowDown"); await k("ArrowDown"); await k("Enter", 900);
    await shot(page, "kbwindows", "2-equip");
    await k("Enter", 900); await shot(page, "kbwindows", "3-equip-slots");
    await k("Enter", 900); await shot(page, "kbwindows", "4-equip-candidates");
    await k("Escape"); await k("Escape"); await k("Escape"); await k("ArrowUp"); await k("ArrowUp"); await k("Enter", 900);
    await shot(page, "kbwindows", "6-items");
    await closePage(ctx, "kbwindows", dir);
  },
  async shop(browser) {
    const { ctx, page, dir } = await openPage(browser, "shop", SHOP);
    note("shop", "boot", await waitBoot(page, true));
    await sleep(2500);
    if (DEVICE === "Desktop") {
      // 데스크톱(키보드): 말 걸기 → 대사 넘기기 → 상점 → 「구입」 목록을 찍는다(배치 비교용).
      const isShop = () => has(page, ".runtime-shop-overlay");
      for (let i = 0; i < 25 && !(await isShop()); i++) { await page.keyboard.press("Enter"); await sleep(800); }
      note("shop", "shop-open", await isShop());
      await shot(page, "shop", "1-shop");
      await page.keyboard.press("Enter"); await sleep(1200);
      await shot(page, "shop", "2-bought");
      await closePage(ctx, "shop", dir);
      return;
    }
    await tapSel(page, "[data-testid='touch-action-a']", 1200);
    const r = await advanceDialogue(page, "shop", () => has(page, "[data-testid='shop-scene'], .runtime-shop-overlay"), 12);
    if (r === "choices") {
      await shot(page, "shop", "0-choices");
      await padCheck(page, "shop", "choices");
      await tapSel(page, ".choices-active [role='menuitem'], .choices-active li, .choices-active button", 1200);
      await advanceDialogue(page, "shop", () => has(page, "[data-testid='shop-scene'], .runtime-shop-overlay"), 8);
    }
    const open = await has(page, "[data-testid='shop-scene'], .runtime-shop-overlay");
    note("shop", "shop-open", open);
    await sleep(1000);
    await shot(page, "shop", "1-shop");
    await padCheck(page, "shop", "shop");
    if (open) {
      await tapSel(page, "[data-testid='shop-mode-buy']", 1200);
      const goldStart = await gameFrame(page).evaluate(() => document.querySelector(".runtime-shop-overlay")?.textContent?.match(/(\d[\d,]*)\s*(G|골드)/)?.[1]);
      const shopRows = () => gameFrame(page).evaluate(() => [...document.querySelectorAll(".runtime-shop-item-row")].map((r) => `${(r.textContent || "").replace(/\s+/g, "").slice(0, 5)}${r.matches(".selected, [aria-current='true'], [aria-selected='true']") ? "*" : ""}`).join(" "));
      if (flag("debug")) console.log("SHOP0", await shopRows());
      await tapSel(page, ".runtime-shop-item-row", 1000);
      if (flag("debug")) console.log("SHOP1", await shopRows(), await gameFrame(page).evaluate(() => document.querySelector(".runtime-shop-overlay")?.dataset.shopStage ?? document.querySelector(".runtime-shop-overlay")?.className));
      await tapSel(page, ".runtime-shop-item-row", 1000);
      if (flag("debug")) console.log("SHOP2", await shopRows(), await gameFrame(page).evaluate(() => document.querySelector(".runtime-shop-overlay")?.className));
      const gold0 = await gameFrame(page).evaluate(() => document.querySelector(".runtime-shop-overlay")?.textContent?.match(/(\d[\d,]*)\s*(G|골드)/)?.[1]);
      await tapSel(page, "[data-testid='shop-confirm'], [data-testid='shop-qty-confirm'], .runtime-shop-confirm", 1500);
      const gold1 = await gameFrame(page).evaluate(() => document.querySelector(".runtime-shop-overlay")?.textContent?.match(/(\d[\d,]*)\s*(G|골드)/)?.[1]);
      note("shop", "buy", goldStart !== gold1 || gold0 !== gold1, `${goldStart} -> ${gold0} -> ${gold1}`);
      if (flag("diag")) console.log("SHOPDIAG", await gameFrame(page).evaluate(() => { const o = document.querySelector(".runtime-shop-overlay"); const sh = o?.querySelector(".runtime-shop-items-shell"); return JSON.stringify({ fit: document.querySelector(".play-viewport")?.dataset.shopFit, cls: o?.className, cols: sh && getComputedStyle(sh).gridTemplateColumns, side: [...(sh?.children ?? [])].map((c) => `${c.className.split(" ")[0]}:${getComputedStyle(c).display}:${Math.round(c.getBoundingClientRect().width)}`), font: o && getComputedStyle(o.querySelector(".runtime-shop-item-row") ?? o).fontSize, ow: o && o.offsetWidth, oh: o && o.offsetHeight, tf: o && getComputedStyle(o).transform, scopes: [...document.styleSheets].flatMap((ss) => { const all = []; const walk = (rs) => { for (const r of rs) { all.push(r); if (r.cssRules) walk(r.cssRules); } }; try { walk(ss.cssRules); } catch {} return all; }).filter((r) => r.constructor.name === "CSSScopeRule").map((r) => `${r.start}|${r.cssRules.length}|${o?.matches(r.start)}`) }); }));
      await shot(page, "shop", "2-bought");
      for (let i = 0; i < 6 && (await has(page, ".runtime-shop-overlay")); i++) await tapSel(page, "[data-testid='touch-action-b']", 800);
      note("shop", "shop-closed-by-B", !(await has(page, ".runtime-shop-overlay")));
    }
    await closePage(ctx, "shop", dir);
  },
  async battle(browser) {
    const { ctx, page, dir } = await openPage(browser, "battle", cp("boss"));
    note("battle", "boot", await waitBoot(page, true));
    await sleep(2500);
    await tapSel(page, "[data-testid='touch-action-a']", 1000);
    await advanceDialogue(page, "battle", () => has(page, "[data-testid='battle-scene']"), 40);
    await sleep(3500);
    const inBattle = await has(page, "[data-testid='battle-scene']");
    note("battle", "battle-open", inBattle);
    await shot(page, "battle", "1-battle");
    await padCheck(page, "battle", "battle");
    if (inBattle) {
      for (let i = 0; i < 20 && !(await has(page, "[data-testid='actor-command-attack']")); i++) await sleep(500);
      const atk = await tapSel(page, "[data-testid='actor-command-attack']", 1200);
      note("battle", "attack-tap", atk);
      const tgt = await tapSel(page, "[data-testid^='battle-target-']", 1200);
      if (!tgt) await tapSel(page, "[data-testid='touch-action-a']", 1200);
      await sleep(4000);
      await shot(page, "battle", "2-after-attack");
      const log = await gameFrame(page).evaluate(() => document.querySelector("[data-testid='battle-scene']")?.textContent?.replace(/\s+/g, " ").slice(0, 160));
      note("battle", "turn-ran", true, log);
    }
    await closePage(ctx, "battle", dir);
  },
};

const server = URL_ ? null : await startPlayerQaServer();
const engine = isWebkit ? webkit : chromium;
const browser = await engine.launch({ headless: true, args: isWebkit ? [] : ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const names = URL_ ? ["title"] : Object.keys(SEGMENTS);
  for (const name of names.filter((n) => (ONLY.length ? ONLY.includes(n) : n !== "matrix" && n !== "kbwindows"))) {
    try { await SEGMENTS[name](browser); } catch (e) { note(name, "crash", false, String(e.message ?? e).slice(0, 200)); }
  }
} finally {
  await browser.close();
  await server?.close();
}
writeFileSync(join(OUT, "results.json"), JSON.stringify({ device: DEVICE, landscape: LANDSCAPE, frame: FRAME, url: URL_ || null, results }, null, 1));
console.log(`done ${OUT}  pass ${results.filter((r) => r.ok).length}/${results.length}`);
