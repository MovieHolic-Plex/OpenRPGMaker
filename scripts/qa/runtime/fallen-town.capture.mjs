// 폴른 스타 마을 손질 확인(2026-10-24 story2 · A·B·C·D·2·3) — 체크포인트에서 바로 부팅해 장면 하나씩 1배로 남긴다. (진단 전용 · 게이트 아님)
//   node scripts/qa/runtime/fallen-town.capture.mjs <play.json> <outDir> <scene>
//   scene: smith(로한 흉상 대사 → 상점 목록) · kids(광장 술래잡기 8초) · necklace(골목 끝 이끼 상자) ·
//          bridge(강가 다리 — 발렌이 숲으로 간 뒤 마을에 남아 있지 않은가) · lisa(리사 흉상·분노 표정) · knight(초소 상자·리노)
// 결과: <outDir>/<scene>/video.webm, report.json, frames/*.png
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg, scene] = process.argv.slice(2);
if (!projectArg || !scene) throw new Error("usage: fallen-town.capture.mjs <play.json> <outDir> <scene>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/fallen-story2");
const projectJson = await readFile(resolve(projectArg), "utf8");
const out = join(resolve(outArg ?? "tmp/fs-town"), scene);
const party = (lv) => [{ actorId: "actor_hero", level: lv }, { actorId: "actor_fs_elena", level: lv }, { actorId: "actor_fs_iris", level: lv }];
const marched = { sw_fs_valen_marched: true, sw_fs_knight_marched: true, ...Object.fromEntries("abcdefgh".split("").map((k) => [`sw_fs_escort_${k}_marched`, true])) };
const SCENES = {
  smith: { mapId: "fs_smithy", x: 10, y: 8, facing: "up", switches: { ...marched, sw_fs_main_started: true, sw_fs_q_spear_met: true, sw_fs_q_spear_done: true, sw_fs_iris_joined: true }, party: party(6), gold: 3000 },
  kids: { mapId: "fs_hub", x: 24, y: 31, facing: "down", switches: { ...marched, sw_fs_main_started: true }, party: party(6).slice(0, 2) },
  necklace: { mapId: "fs_hub", x: 35, y: 19, facing: "up", switches: { ...marched, sw_fs_main_started: true }, party: party(6).slice(0, 2) },
  bridge: { mapId: "fs_hub", x: 21, y: 26, facing: "up", switches: { ...marched, sw_fs_main_started: true }, party: party(6).slice(0, 2) },
  oden: { mapId: "fs_apothecary", x: 15, y: 14, facing: "up", switches: { ...marched, sw_fs_main_started: true }, party: party(6).slice(0, 2) },
};
const cp = { id: `town-${scene}`, selfSwitches: { ev_fs_event: { A: true } }, ...SCENES[scene] };
if (!SCENES[scene]) throw new Error(`unknown scene ${scene}`);

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const report = { errors: [], segments: [], lines: [] };
await (await import("node:fs/promises")).rm(out, { recursive: true, force: true });
await mkdir(join(out, "frames"), { recursive: true });
const context = await browser.newContext({ viewport: { width: 480, height: 270 }, recordVideo: { dir: join(out, "raw"), size: { width: 480, height: 270 } } });
const t0 = Date.now();
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
await page.addInitScript(([c]) => { try { localStorage.clear(); } catch {} window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:fallen-town", qaInstrumentation: true, qaCheckpoint: c }; }, [cp]);
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const text = () => page.evaluate(() => document.querySelector('[data-testid="dialogue-box"]')?.textContent?.replace(/\s+/g, " ").trim() ?? "");
let n = 0;
const shot = (tag) => page.screenshot({ path: join(out, "frames", `${String(n++).padStart(3, "0")}-${tag}.png`) });
const mark = (name) => report.segments.push({ name, atMs: Date.now() - t0 });
const read = async ({ quietNeeded = 4, maxRounds = 60, stopAt } = {}) => {
  let quiet = 0;
  for (let i = 0; i < maxRounds && quiet < quietNeeded; i++) {
    if (stopAt && (await stopAt())) return;
    if (await present("runtime-choices")) { quiet = 0; await page.waitForTimeout(700); await shot("choice"); await page.keyboard.press("Enter"); }
    else if (await present("dialogue-box")) {
      quiet = 0;
      await page.waitForTimeout(1400);
      const t = await text();
      if (t && report.lines.at(-1) !== t) {
        report.lines.push(t);
        const expr = await page.evaluate(() => document.querySelector('[data-testid="dialogue-box"]')?.getAttribute("data-dialogue-expression") ?? "");
        await shot(`line${expr ? "-" + expr : ""}`);
      }
      await page.keyboard.press("Enter");
    } else quiet++;
    await page.waitForTimeout(300);
  }
};
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
try {
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 420000 });
  await page.waitForTimeout(2500);
  await shot("arrive");
  mark("start");
  if (scene === "smith") {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
    await read({ stopAt: () => present("shop-window").then(async (a) => a || (await page.locator('[data-testid^="shop"]').count()) > 0) });
    await page.waitForTimeout(1200);
    await shot("shop");
    await page.keyboard.press("Enter"); // 구입
    await page.waitForTimeout(1200);
    await shot("buy");
    for (let i = 0; i < 24; i++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(160); if ([9, 11, 13, 17, 22].includes(i)) await shot(`shop-${i + 1}`); }
    report.shopText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  } else if (scene === "kids") {
    await page.waitForTimeout(8000);
    await shot("kids");
  } else if (scene === "necklace") {
    await hold("ArrowUp", 900);
    await page.waitForTimeout(500);
    await shot("corner");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
    await read();
    report.state = await page.evaluate(() => { const s = window.__oprnDebug.readState(); return { necklace: s.inventory?.equip_fs_dawnwell_necklace ?? s.equipmentInventory?.equip_fs_dawnwell_necklace }; });
  } else if (scene === "bridge") {
    await hold("ArrowUp", 1300);
    await page.waitForTimeout(800);
    await shot("bridge");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(600);
    await read({ quietNeeded: 3 });
    await hold("ArrowLeft", 700);
    await page.waitForTimeout(1500);
    await shot("bridge2");
  } else if (scene === "oden") {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
    await read();
  }
  mark("end");
} catch (e) {
  report.errors.push(String(e?.stack ?? e).slice(0, 400));
  await shot("error").catch(() => {});
} finally {
  const video = page.video();
  await context.close();
  const p = await video?.path();
  if (p) await rename(p, join(out, "video.webm"));
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ scene, errors: report.errors.slice(0, 3), lines: report.lines.slice(0, 12), segments: report.segments, state: report.state }, null, 1));
  await browser.close();
  await server.close();
}
