// 폰 화면 UI 감사/캡처 — 출하 플레이어(player.html)를 터치 기기로 띄워 상태별 스크린샷을 남긴다.
// 사용: node scripts/qa/mobile-play.capture.mjs --tag before --play /tmp/mp/demos/chrono-bell.play.json \
//          [--device iphone13,android] [--states title,dialogue,field,menu,shop,battle,defeat] [--netns]
// 결과: <out>/<tag>/<기기>-<세로|가로>-<상태>.png (기본 out=/tmp/mp/shots). 한 부팅에서 세로→가로로 뷰포트만 바꿔 둘 다 찍는다.
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
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
const TAG = arg("tag", "before");
const PLAY = arg("play", "/tmp/mp/demos/chrono-bell.play.json");
const OUT = join(arg("out", "/tmp/mp/shots"), TAG);
const DEVICES = { iphone13: { w: 390, h: 844, ua: "iPhone" }, android: { w: 360, h: 640, ua: "Android" } };
const devices = arg("device", "iphone13,android").split(",");
const states = arg("states", "title,dialogue,field,menu,shop,battle").split(",");
mkdirSync(OUT, { recursive: true });

const cps = JSON.parse(readFileSync(join(REPO, "scripts/qa/runtime/checkpoints/fallen-star.json"), "utf8")).checkpoints;
const cp = (id) => cps.find((c) => c.id === id);
const SHOP = { ...cp("hub-start"), id: "shop-apothecary", mapId: "fs_apothecary", x: 15, y: 14, facing: "up", items: { item_potion: 2 } };
const BOOT = { title: null, dialogue: cp("hub-start"), field: cp("forest-entry"), menu: cp("forest-entry"), shop: SHOP, battle: cp("boss"), defeat: cp("defeat") };

const launch = () => chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tap(page, testid) {
  const box = await page.locator(`[data-testid="${testid}"]`).first().boundingBox();
  if (!box) throw new Error(`no ${testid}`);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}
const has = (page, testid) => page.evaluate((t) => !!document.querySelector(`[data-testid="${t}"]`), testid);
async function waitTid(page, testid, ms = 20000) { await page.waitForSelector(`[data-testid="${testid}"]`, { timeout: ms }).catch(() => {}); }
async function key(page, k, n = 1) { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await sleep(250); } }

async function shotBoth(page, dev, name, d) {
  for (const [orient, w, h] of [["portrait", d.w, d.h], ["landscape", d.h, d.w]]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(900);
    await page.screenshot({ path: join(OUT, `${dev}-${orient}-${name}.png`) });
  }
}
// 한 상태를 두 방향으로 — 상태를 만드는 단계가 방향에 따라 달라질 수 있어 단계는 세로에서 하고 가로는 같은 상태를 다시 찍는다.
async function runState(browser, server, dev, d, state, log) {
  const ctx = await browser.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e.message ?? e).slice(0, 120)));
  const checkpoint = BOOT[state];
  await page.addInitScript(([url, cpt]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: url, saveNamespace: "mobile-qa", qaInstrumentation: true, ...(cpt ? { qaCheckpoint: cpt } : {}) };
  }, ["/__mp/project.json", checkpoint]);
  await page.route("**/__mp/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", path: PLAY }));
  const t0 = Date.now();
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
  if (state === "title") {
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 240000 });
    await sleep(1500);
    await shotBoth(page, dev, "title", d);
  } else {
    await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 300000 });
    await sleep(1500);
    if (state === "dialogue") { await waitTid(page, "dialogue-box"); await sleep(1200); await shotBoth(page, dev, "dialogue", d); }
    else if (state === "field") { for (let i = 0; i < 6 && (await has(page, "dialogue-box")); i++) await key(page, "Enter"); await sleep(600); await shotBoth(page, dev, "field", d); }
    else if (state === "menu") {
      for (let i = 0; i < 6 && (await has(page, "dialogue-box")); i++) await key(page, "Enter");
      await sleep(400); await tap(page, "touch-action-b"); await waitTid(page, "main-menu", 8000); await sleep(800);
      await shotBoth(page, dev, "menu", d);
    } else if (state === "shop") {
      await key(page, "Enter"); await waitTid(page, "dialogue-box", 8000); await sleep(800);
      await shotBoth(page, dev, "shop-talk", d);
      for (let i = 0; i < 8 && !(await has(page, "shop-scene") || await has(page, "shop-window")); i++) await key(page, "Enter");
      await sleep(900); await shotBoth(page, dev, "shop", d);
    } else if (state === "battle") {
      await key(page, "Enter"); await waitTid(page, "dialogue-box", 8000);
      for (let i = 0; i < 30 && !(await has(page, "battle-scene")); i++) await key(page, "Enter");
      await sleep(3000); await shotBoth(page, dev, "battle", d);
    } else if (state === "defeat") {
      await page.evaluate(() => { for (const id of window.__oprnDebug.readState().partyActorIds) window.__oprnSetActorVitals?.(id, 1, 999); });
      await key(page, "Enter"); await waitTid(page, "dialogue-box", 8000);
      for (let i = 0; i < 30 && !(await has(page, "battle-scene")); i++) await key(page, "Enter");
      await sleep(2500); await shotBoth(page, dev, "battle-weak", d);
    }
  }
  const mobile = await page.evaluate(() => document.querySelector(".play-viewport")?.dataset.mobileUi ?? "none").catch(() => "?");
  log.push(`${dev} ${state} ok ${Math.round((Date.now() - t0) / 1000)}s mobileUi=${mobile} errs=${errs.length}${errs[0] ? " " + errs[0] : ""}`);
  await ctx.close();
}

const server = await startPlayerQaServer();
const browser = await launch();
const log = [];
try {
  for (const dev of devices) for (const state of states) {
    try { await runState(browser, server, dev, DEVICES[dev], state, log); }
    catch (e) { log.push(`${dev} ${state} FAIL ${String(e.message ?? e).slice(0, 160)}`); }
    console.log(log.at(-1));
  }
} finally { await browser.close(); await server.close(); }
console.log("done", OUT);
