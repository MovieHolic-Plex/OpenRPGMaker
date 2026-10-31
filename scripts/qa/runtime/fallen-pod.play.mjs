// 폴른 스타 1막 추락지 — 떨어진 별(은빛 관)에 사방에서 말을 걸 수 있는가. 출하 플레이어(player.html)로 실제 조사 단추를 누른다.
//   FS_FIXTURE=dist/demos/chrono-bell.play.json node scripts/qa/runtime/fallen-pod.play.mjs
// 결과: $QA_OUT_DIR/{facts.json, full.webm, native-*.png}. 이야기 상태 넷 × 관 둘레 칸마다 「대사가 떴나」를 적는다.
// 사용자 신고(2026-11-01, 1.26): 「그 운석 ..? 그 관이라고해야하나 그거 말을 걸수가 없는데」.
import { mkdir, readFile, writeFile, readdir, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/fallen-pod");
await mkdir(out, { recursive: true });
const fixture = JSON.parse(await readFile(resolve(process.env.FS_FIXTURE ?? "dist/demos/chrono-bell.play.json"), "utf8"));
const project = fixture.project ?? fixture;
const log = (...a) => console.error("[pod]", ...a);
const facts = { states: {}, errors: [], marks: {} };
const MAP = "fs_forest";
const STATES = {
  // 브람에게 아직 말을 안 건 때(주 퀘스트는 시작됨) — 예전엔 관에 쪽이 없어 아무 일도 없었다.
  before: { sw_fs_main_started: true, sw_fs_valen_marched: true },
  // 브람이 「알을 살펴봐」라고 한 뒤 — 퍼즐.
  active: { sw_fs_main_started: true, sw_fs_valen_marched: true, sw_fs_main_step0: true },
  // 이리스가 깨어난 뒤.
  after: { sw_fs_main_started: true, sw_fs_valen_marched: true, sw_fs_main_step0: true, sw_fs_main_step1: true, sw_fs_iris_awake: true, sw_fs_iris_joined: true },
};
const ONLY = process.env.POD_STATES ? process.env.POD_STATES.split(",") : Object.keys(STATES);

const state = (page) => page.evaluate(() => { const s = window.__oprnDebug.readState(); return { map: s.currentMapId, x: s.x, y: s.y }; });
async function settle(page) {
  for (let i = 0; i < 200; i++) {
    const info = await page.evaluate(() => ({ running: window.__oprnHooksScene?.running === true, box: !!document.querySelector('[data-testid="dialogue-box"]'), choice: !!document.querySelector('[data-testid="runtime-choices"], [data-testid="choice-list"], [data-testid="dialogue-choice-frame"]') }));
    if (!info.running && !info.box) return i;
    if (info.choice) await page.keyboard.press("Escape", { delay: 120 });
    else if (info.box) await page.keyboard.press("Enter", { delay: 120 });
    await page.waitForTimeout(300);
  }
  return -1;
}
async function walkTo(page, x, y, dir) {
  // 이웃 칸 넷 가운데 하나에서 걸어 들어와 그 칸에 실제로 설 수 있는지 본다(텔레포트는 막힌 칸에도 세운다).
  const approaches = [["up", 0, 1], ["down", 0, -1], ["left", 1, 0], ["right", -1, 0]];
  approaches.sort((p, q) => (q[0] === dir) - (p[0] === dir));
  for (const [step, bx, by] of approaches) {
    const key = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[step];
    await settle(page);
    await page.evaluate(([m, px, py, d]) => { window.__oprnInput.face(d); window.__oprnDebug.teleport(m, px, py); }, [MAP, x + bx, y + by, step]);
    await page.waitForTimeout(500);
    await page.keyboard.press(key, { delay: 90 });
    await page.waitForTimeout(550);
    const at = await state(page);
    if (at.map === MAP && at.x === x && at.y === y) {
      await page.evaluate((d) => window.__oprnInput.face(d), dir);
      await page.waitForTimeout(200);
      return at;
    }
  }
  return state(page);
}
async function pressAndRead(page) {
  await page.evaluate(() => window.__oprnInput.action());
  await page.waitForTimeout(700);
  const text = await page.evaluate(() => document.querySelector('[data-testid="dialogue-box"]')?.innerText?.replace(/\s+/g, " ").trim() ?? null);
  return text;
}

const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
let t0 = 0;
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, recordVideo: { dir: out, size: { width: 960, height: 540 } } });
  t0 = Date.now();
  const page = await context.newPage();
  page.on("pageerror", (e) => facts.errors.push(String(e)));
  const first = STATES[ONLY[0]];
  const CHECKPOINT = { id: "fs-pod", mapId: MAP, x: 15, y: 10, facing: "up", switches: first, variables: { var_fs_main_progress: 1 },
    party: [{ actorId: "actor_hero", level: 6 }, { actorId: "actor_fs_elena", level: 6 }] };
  await page.addInitScript(([projectUrl, ns, qaCheckpoint]) => { localStorage.clear(); window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: ns, qaInstrumentation: true, qaCheckpoint }; },
    ["/__runtime-qa/project.json", `fs-pod-${Date.now()}`, CHECKPOINT]);
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(`${server.url}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(() => !!window.__oprnDebug && !!document.querySelector('[data-testid="runtime-state-json"]'), null, { timeout: 600_000 });
  await page.waitForTimeout(2500);
  await settle(page);
  facts.bootS = +((Date.now() - t0) / 1000).toFixed(1);
  const pod = project.maps[MAP].events.find((e) => e.id === "ev_fs_main_inspect1");
  const px = pod.x, py = pod.y;
  // 관 그림은 이벤트 칸 위 3×2(px-1..px+1, py-2..py-1). 둘레: 아래·왼쪽·오른쪽·위.
  const ring = [
    [px, py + 1, "up"], [px - 1, py + 1, "up"], [px + 1, py + 1, "up"],
    [px - 2, py, "right"], [px - 2, py - 1, "right"], [px - 2, py - 2, "right"],
    [px + 2, py, "left"], [px + 2, py - 1, "left"], [px + 2, py - 2, "left"],
    [px - 1, py - 3, "down"], [px, py - 3, "down"], [px + 1, py - 3, "down"],
    [px - 1, py, "right"], [px + 1, py, "left"],
    // 관 그림 위 칸 — 설 수 있으면 관 위를 걷는 것이다(통행 확인용, 서면 발밑 조사).
    [px, py - 1, "up"], [px - 1, py - 2, "up"], [px + 1, py - 1, "up"],
  ];
  for (const name of ONLY) {
    const sw = STATES[name];
    const all = new Set(Object.values(STATES).flatMap((s) => Object.keys(s)));
    await settle(page);
    await page.evaluate(([ids, on]) => { for (const id of ids) window.__oprnDebug.setSwitch(id, !!on[id]); }, [[...all], sw]);
    await page.waitForTimeout(1500);
    await settle(page);
    const rows = [];
    facts.marks[`${name}_start`] = +((Date.now() - t0) / 1000).toFixed(2);
    for (const [x, y, dir] of ring) {
      const at = await walkTo(page, x, y, dir);
      if (at.map !== MAP || at.x !== x || at.y !== y) { rows.push({ x, y, dir, reach: false, at }); log(name, x, y, "unreached, at", JSON.stringify(at)); continue; }
      const text = await pressAndRead(page);
      if (rows.filter((r) => r.text).length === 0 && text) await page.screenshot({ path: resolve(out, `native-${name}-${x}-${y}.png`) });
      rows.push({ x, y, dir, reach: true, text });
      log(name, x, y, dir, text?.slice(0, 40) ?? "—");
      await settle(page);
    }
    facts.marks[`${name}_end`] = +((Date.now() - t0) / 1000).toFixed(2);
    facts.states[name] = rows;
  }
  // 영상용(1배) — 브람에게 말을 걸기 전, 관 왼쪽 옆에서 관을 보고 누른다(예전엔 두 겹으로 막혔다: 쪽 없음 + 옆은 조사 칸 밖).
  {
    const all = new Set(Object.values(STATES).flatMap((s) => Object.keys(s)));
    await settle(page);
    await page.evaluate(([ids, on]) => { for (const id of ids) window.__oprnDebug.setSwitch(id, !!on[id]); }, [[...all], STATES.before]);
    await page.waitForTimeout(1200);
    await settle(page);
  }
  await walkTo(page, px - 2, py - 1, "right");
  facts.marks.demo_start = +((Date.now() - t0) / 1000).toFixed(2);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__oprnInput.action());
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(1500); await page.keyboard.press("Enter", { delay: 120 }); }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: resolve(out, "native-demo-choice.png") });
  await page.waitForTimeout(800);
  facts.marks.demo_end = +((Date.now() - t0) / 1000).toFixed(2);
  await context.close();
} finally {
  await browser.close();
  await server.close?.();
}
const vids = (await readdir(out)).filter((f) => f.endsWith(".webm") && f !== "full.webm");
if (vids.length) await rename(resolve(out, vids[0]), resolve(out, "full.webm"));
await writeFile(resolve(out, "facts.json"), JSON.stringify(facts, null, 1));
const bad = Object.entries(facts.states).flatMap(([n, rows]) => rows.filter((r) => r.reach && !r.text).map((r) => `${n} (${r.x},${r.y}) ${r.dir}`));
console.log(JSON.stringify({ bootS: facts.bootS, errors: facts.errors.length, silent: bad }, null, 1));
