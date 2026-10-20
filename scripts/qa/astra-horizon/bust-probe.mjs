// 대화 흉상(bust)의 GBA 맞춤 확인 + 전투 HUD 상태 배지(PAR) 겹침 확인. 480x320 실제 플레이어.
//   node scripts/qa/astra-horizon/bust-probe.mjs <project.json> <outDir>
// 대화 상자에 흉상이 새로 뜰 때마다 <outDir>/bust-<순번>-<id>.png 를 찍는다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = resolve(outArg);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
await page.addInitScript(() => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:astra-bust", qaInstrumentation: true }; });
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const seen = new Set();
let n = 0;
let lastDlg = "";
const bustShot = async () => {
  const t = await page.evaluate(() => (document.querySelector("[data-testid='dialogue-box']")?.innerText ?? "").replace(/\s+/g, " ").slice(0, 60) + " | bust=" + !!document.querySelector(".dialogue-face-bust"));
  if (t !== lastDlg && !t.startsWith(" | ")) { lastDlg = t; console.log("dlg", t); }
  const info = await page.evaluate(() => {
    const f = document.querySelector(".dialogue-face-bust");
    if (!f) return null;
    const m = /cast\/([a-z]+)\/(bust|full)-([a-z]+)/.exec(f.dataset.bustSrc || f.style.backgroundImage) ?? [];
    const b = f.getBoundingClientRect(), d = document.querySelector("[data-testid='dialogue-box']")?.getBoundingClientRect();
    return { key: `${m[1] ?? "?"}-${m[3] ?? "?"}`, box: [b.x, b.y, b.width, b.height].map(Math.round), dlg: d ? [d.x, d.y, d.width, d.height].map(Math.round) : null, cls: document.querySelector("[data-testid='dialogue-box']")?.className };
  });
  if (!info || seen.has(info.key)) return;
  seen.add(info.key);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, `bust-${String(++n).padStart(2, "0")}-${info.key}.png`) });
  console.log("bust", JSON.stringify(info));
};
const teleport = async (m, x, y) => {
  await page.evaluate(([a, b, c]) => window.__oprnDebug.teleport(a, b, c), [m, x, y]);
  await page.waitForFunction(([a, b, c]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === a && s.x === b && s.y === c; }, [m, x, y], { timeout: 15000 });
  await page.waitForTimeout(700);
};
const advance = async (max = 60, until = () => false) => {
  for (let i = 0; i < max; i++) {
    await bustShot();
    if (await until()) return;
    if (!(await present("dialogue-box")) && !(await present("cinematic-sequence")) && !(await present("runtime-choices"))) { await page.waitForTimeout(500); if (!(await present("dialogue-box")) && !(await present("cinematic-sequence"))) return; }
    await page.keyboard.press("Enter"); await page.waitForTimeout(350);
  }
};
const talk = async (dir) => { for (let i = 0; i < 5; i++) { await page.evaluate((d) => window.__oprnInput.face(d), dir); await page.evaluate(() => window.__oprnInput.action()); await page.waitForTimeout(700); if (await present("dialogue-box") || await present("battle-scene")) return; } };
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  console.log("started");
  await advance(120);
  await teleport("mx_map_lab", 7, 6);
  await talk("up");
  await advance(80, async () => (await page.evaluate(() => (window.__oprnHooksScene.session.monsterParty ?? []).length)) > 0 && !(await present("dialogue-box")) && !(await present("runtime-choices")));
  console.log("party", await page.evaluate(() => window.__oprnHooksScene.session.monsterParty.length));
  await page.evaluate(() => window.__oprnDebug.heal?.());
  // 간호사
  await teleport("mx_map_home_center", 7, 5);
  await talk("up");
  await advance(40);
  // 라이벌 전투
  await teleport("mx_map_lab", 12, 6);
  await talk("up");
  await advance(60, () => present("battle-scene"));
  console.log("battle?", await present("battle-scene"));
  await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 60000 }).catch(() => {});
  await page.screenshot({ path: join(out, "battle-clean.png") });
  await page.evaluate(() => {
    const add = () => { for (const c of document.querySelectorAll(".battle-status-icons")) { if (c.querySelector(".battle-status-icon-paralysis")) continue; const s = document.createElement("span"); s.className = "battle-status-icon battle-status-icon-paralysis"; s.dataset.statusIcon = "paralysis"; c.append(s); } };
    add(); new MutationObserver(add).observe(document.body, { childList: true, subtree: true });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, "battle-par-injected.png") });
  console.log("done");
} finally { await browser.close(); await server.close(); }
