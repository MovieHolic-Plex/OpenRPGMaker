// 폰 터치 전용 1배 클립 — 타이틀 → 대화 → 상점 구매 → 전투 한 턴. 키보드 입력 없이 touchscreen.tap 만 쓴다.
// 사용: node scripts/qa/mobile-play.clip.mjs --netns [--out /tmp/mp/clip] [--play ...]  → <out>/seg-*.webm
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync } from "node:fs";
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
const PLAY = arg("play", "/tmp/mp/demos/chrono-bell.play.json");
const OUT = arg("out", "/tmp/mp/clip");
const W = 844, H = 390;
mkdirSync(OUT, { recursive: true });
const cps = JSON.parse(readFileSync(join(REPO, "scripts/qa/runtime/checkpoints/fallen-star.json"), "utf8")).checkpoints;
const cp = (id) => cps.find((c) => c.id === id);
const SHOP = { ...cp("hub-start"), id: "shop-apothecary", mapId: "fs_apothecary", x: 15, y: 14, facing: "up", items: { item_potion: 2 }, gold: 500 };
const SEGS = [["1-title", null], ["2-dialogue", cp("hub-start")], ["3-shop", SHOP], ["4-battle", cp("boss")]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const has = (page, sel) => page.evaluate((s) => !!document.querySelector(s), sel);

async function tapSel(page, sel, label = sel) {
  const box = await page.locator(sel).first().boundingBox().catch(() => null);
  if (!box) { console.log("  no", label); return false; }
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(700);
  return true;
}
// 화면 아무 곳(대화 상자 아래쪽)을 탭 — 터치 사용자가 하는 진행 동작
const tapStage = async (page) => { await page.touchscreen.tap(W / 2, H - 70); await sleep(900); };
// 보이는 버튼 중 글자가 맞는 것을 탭
async function tapText(page, re, scope = "button, [role=button], li, .status-menu-command, .shop-row, [data-testid]") {
  const pt = await page.evaluate(([src, sc]) => {
    const rx = new RegExp(src, "i");
    for (const el of document.querySelectorAll(sc)) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || getComputedStyle(el).visibility === "hidden") continue;
      if ([...el.children].some((c) => rx.test(c.textContent || "") && c.getBoundingClientRect().width > 8)) continue;
      if (rx.test((el.textContent || "").trim()) && (el.textContent || "").length < 40) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, [re.source, scope]);
  if (!pt) { console.log("  no text", re); return false; }
  await page.touchscreen.tap(pt.x, pt.y); await sleep(800); return true;
}

async function padA(page) {
  for (let i = 0; i < 4 && !(await has(page, "[data-testid='dialogue-box']")); i++) await tapSel(page, "[data-testid='touch-action-a']", "pad A");
  await sleep(900);
}

async function seg(browser, server, name, checkpoint) {
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, recordVideo: { dir, size: { width: W, height: H } } });
  const page = await ctx.newPage();
  await page.addInitScript(([url, cpt]) => {
    try { localStorage.clear(); } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: url, saveNamespace: "mobile-clip", qaInstrumentation: true, ...(cpt ? { qaCheckpoint: cpt } : {}) };
  }, ["/__mp/project.json", checkpoint]);
  await page.route("**/__mp/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", path: PLAY }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 240000 });
  if (!checkpoint) {
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 240000 });
    await sleep(2500);
    await page.waitForSelector("[data-testid='title-new-game']", { timeout: 60000 }).catch(() => {});
    await sleep(1200);
    await tapSel(page, "[data-testid='title-new-game']", "new game");
    await sleep(3000);
  } else {
    await page.waitForFunction(() => window.__oprnDebug && document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 300000 });
    await sleep(2000);
    if (name !== "1-title") await padA(page);
    if (name === "2-dialogue") { for (let i = 0; i < 4; i++) { if (await has(page, "[data-testid='dialogue-box']")) await tapSel(page, "[data-testid='dialogue-box']", "dialogue"); await sleep(900); } }
    if (name === "3-shop") {
      await tapSel(page, "[data-testid='dialogue-box']", "dialogue");
      for (let i = 0; i < 8 && !(await has(page, "[data-testid='shop-scene']")); i++) await tapSel(page, "[data-testid='dialogue-box']", "dialogue");
      await sleep(1200);
      console.log("shop ids:", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("[data-testid^='shop-']")].map((e) => e.dataset.testid).slice(0, 30))));
      await sleep(1500);
      const ids = async () => JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("[data-testid^='shop-'], .runtime-shop-item-row")].filter((e) => e.getBoundingClientRect().width > 4).map((e) => e.dataset.testid || e.className).slice(0, 24)));
      console.log("shop rows:", await ids());
      await tapSel(page, "[data-testid='shop-mode-buy']", "buy tab"); await sleep(1500);
      console.log("after buy tab:", await ids());
      await tapSel(page, ".runtime-shop-item-row", "row"); await sleep(1000);
      console.log("after row:", await ids());
      await tapSel(page, ".runtime-shop-item-row", "row again"); await sleep(1200);
      console.log("after row2:", await ids());
      await tapSel(page, "[data-testid='shop-confirm'], [data-testid='shop-qty-confirm'], .runtime-shop-confirm", "confirm"); await sleep(1500);
    }
    if (name === "4-battle") {
      await tapSel(page, "[data-testid='dialogue-box']", "dialogue");
      for (let i = 0; i < 30 && !(await has(page, "[data-testid='battle-scene']")); i++) await tapSel(page, "[data-testid='dialogue-box']", "dialogue");
      await sleep(3500);
      console.log("battle cmds:", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("[data-testid^='battle-']")].map((e) => e.dataset.testid).slice(0, 30))));
      await tapSel(page, "[data-testid='actor-command-attack']", "attack"); await sleep(1200);
      await tapSel(page, "[data-testid^='battle-target-']", "target"); await sleep(5000);
    }
  }
  await sleep(1200);
  await ctx.close();
  const f = readdirSync(dir).find((x) => x.endsWith(".webm"));
  if (f) renameSync(join(dir, f), join(OUT, `seg-${name}.webm`));
  console.log("seg", name, "done");
}
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try { for (const [n, c] of SEGS.filter(([n]) => !arg("only", "") || arg("only", "").split(",").includes(n))) { try { await seg(browser, server, n, c); } catch (e) { console.log("seg", n, "FAIL", String(e.message ?? e).slice(0, 160)); } } }
finally { await browser.close(); await server.close(); }
console.log("done", OUT);
