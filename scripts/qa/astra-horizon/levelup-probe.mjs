// 상대 HP 상자 탐침 — 상대 몬스터가 서 있는 동안 상자가 늘 불투명하게 제자리에 있는가(에메랄드 스킨 1대1).
//   node scripts/qa/astra-horizon/levelup-probe.mjs <project.json> <outDir>
// 연구소 라이벌전(보통) · 1번 도로 트레이너 0(내 몬스터 HP 1 → 쓰러짐) · 트레이너 2(두 마리 → 교체)를 돌며
// 50ms 마다 상대 그림·상자를 잰다. 「보이는 상대(쓰러지지 않음) 하나마다 그 상자 유효 불투명도 1」이 아니면 위반이다.
// 상대가 처음 보인 뒤 300ms 는 의도된 등장 연출로 본다. 상자가 둘 이상 동시에 보여도 위반이다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg || !outArg) throw new Error("usage: levelup-probe.mjs <project.json> <outDir>");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg);
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "frames"), { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks"] });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:astra-hud", qaInstrumentation: true };
  const effOpacity = (node, stop) => { let o = 1; for (let n = node; n && n !== stop.parentElement; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const shown = (node, scene) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden" ? effOpacity(node, scene) : 0;
  const probe = { samples: [], violations: [], firstSeen: {}, label: "" };
  window.__hudProbe = probe;
  setInterval(() => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    if (!scene) { probe.firstSeen = {}; return; }
    const now = performance.now();
    const msg = [...scene.querySelectorAll(".battle-message-line")].map((n) => (n.textContent ?? "").trim()).filter(Boolean).join(" / ");
    const sprites = [...scene.querySelectorAll(".battle-enemy")].map((n) => ({ id: n.dataset.testid ?? "", defeated: n.classList.contains("defeated"), o: shown(n, scene) }));
    const rows = [...scene.querySelectorAll(".battle-enemy-list-row")].map((n) => ({ id: n.dataset.enemyId ?? "", defeated: n.classList.contains("defeated"), o: shown(n, scene) }));
    const sample = { t: Math.round(now), label: probe.label, step: scene.dataset.battleDirectorStep, intro: scene.dataset.emeraldTrainerIntro ?? "", msg, sprites, rows };
    probe.samples.push(sample);
    const visibleRows = rows.filter((r) => r.o > 0.05);
    for (const s of sprites) {
      if (s.defeated || s.o < 0.5) continue;
      probe.firstSeen[s.id] ??= now;
      if (now - probe.firstSeen[s.id] <= 300) continue;
      const row = rows.find((r) => r.id === s.id);
      if (!row || row.o < 0.99) probe.violations.push({ ...sample, why: `상대 ${s.id} 보임(o=${s.o.toFixed(2)}) · 상자 ${row ? `o=${row.o.toFixed(2)}` : "없음"}` });
    }
    if (visibleRows.length > 1) probe.violations.push({ ...sample, why: `상자 ${visibleRows.length}개 동시` });
  }, 50);
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
const live = () => page.evaluate(() => { const s = window.__oprnHooksScene.session; return { party: (s.monsterParty ?? []).map((id) => ({ id, ...s.monsterInstances[id] })) }; });
let frame = 0;
const frames = [];
let shooting = false;
// 전투 동안 250ms 마다 한 장 — 띠 그림 재료.
const shooter = setInterval(async () => {
  if (shooting) return; shooting = true;
  try {
    if (await present("battle-scene")) {
      const name = `f${String(frame++).padStart(4, "0")}.png`;
      await page.screenshot({ path: join(out, "frames", name) });
      const info = await page.evaluate(() => { const p = window.__hudProbe, s = p.samples.at(-1); return s ? { label: p.label, t: s.t, msg: s.msg } : null; });
      frames.push({ name, ...info });
    }
  } catch { /* page busy */ } finally { shooting = false; }
}, 250);

const teleport = async (mapId, x, y) => {
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(700);
};
const talk = async (dir) => {
  for (let i = 0; i < 6; i++) {
    await page.evaluate((d) => window.__oprnInput.face(d), dir);
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(700);
    if (await present("dialogue-box") || await present("battle-scene")) return true;
  }
  return false;
};
const untilBattle = async () => {
  for (let i = 0; i < 40; i++) { if (await present("battle-scene")) return true; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  return present("battle-scene");
};
const label = (l) => page.evaluate((v) => { window.__hudProbe.label = v; }, l);
/** 전투가 끝날 때까지 첫 기술만 쓴다. 강제 교체면 남은 동료. */
async function fight() {
  for (let turn = 0; turn < 40; turn++) {
    if (!(await present("battle-scene"))) break;
    if (await present("battle-result-panel")) { for (let i = 0; i < 30 && await present("battle-scene"); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(300); } break; }
    if (!(await page.locator('[data-testid="actor-command-fight"]').count())) {
      const forced = page.locator('[data-testid^="actor-switch-"]');
      if (await forced.count()) { await forced.first().focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(800); continue; }
      await page.keyboard.press("Enter"); await page.waitForTimeout(300); continue;
    }
    await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
    await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
    const skills = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
    await skills.first().waitFor({ timeout: 10000 });
    await skills.last().focus(); await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]') || document.querySelector('[data-testid="battle-result-panel"]')
      || document.querySelector('[data-testid="actor-command-fight"]') || document.querySelector('[data-testid^="actor-switch-"]'), undefined, { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]'), undefined, { timeout: 30000 }).catch(() => {});
  for (let i = 0; i < 20; i++) { if (!(await present("dialogue-box")) && !(await page.evaluate(() => Boolean(window.__oprnHooksScene?.running)))) break; await page.keyboard.press("Enter"); await page.waitForTimeout(300); }
  await page.waitForTimeout(500);
}
const boost = (level) => page.evaluate((lv) => { const s = window.__oprnHooksScene.session; for (const id of s.monsterParty) { s.monsterInstances[id].level = lv; delete s.monsterInstances[id].currentHp; } }, level);
/** 풀숲 칸에서 좌우로 걸어 야생 조우를 부른다. */
async function wildEncounter(mapId) {
  const map = project.maps[mapId], ts = project.tilesets[map.tilesetId], loc = map.locations[0];
  // 지형 번호는 database.terrains 의 1부터 센 순번이다(0 = 없음).
  const grassNo = (project.database.terrains ?? []).findIndex((t) => t.id === "terrain_grass") + 1;
  const grass = (x, y) => ts?.terrain?.[map.lowerTiles[y * map.width + x]] === grassNo;
  const blocked = (x, y) => map.events.some((e) => e.x === x && e.y === y);
  for (let y = loc.y; y < loc.y + loc.h; y++) for (let x = loc.x; x < loc.x + loc.w - 1; x++) {
    if (!grass(x, y) || !grass(x + 1, y) || blocked(x, y) || blocked(x + 1, y)) continue;
    await teleport(mapId, x, y);
    for (let i = 0; i < 60; i++) {
      await page.evaluate((d) => window.__oprnInput.dir(d), i % 2 ? "left" : "right");
      await page.waitForTimeout(260);
      await page.evaluate(() => window.__oprnInput.dir(null));
      if (await present("battle-scene")) return true;
      const here = await page.evaluate(() => window.__oprnDebug.readLive());
    }
  }
  return false;
}
const setHp = (hp) => page.evaluate((v) => { const s = window.__oprnHooksScene.session; for (const id of s.monsterParty) s.monsterInstances[id].currentHp = v; }, hp);


const report = { shots: [], errors };
// 결과 패널이 뜨는 동안 레벨업 상자가 보이면 한 장씩 찍는다.
const shotLevelup = async () => {
  for (let i = 0; i < 80 && (await present("battle-scene")); i++) {
    const info = await page.evaluate(() => {
      const box = document.querySelector('.battle-levelup-stats');
      if (!box || !box.getClientRects().length) return null;
      const r = box.getBoundingClientRect();
      const ally = document.querySelector('.battle-ally-hud, [data-testid="battle-ally-hud"], .battle-actor-row');
      return { box: [r.x, r.y, r.width, r.height].map(Math.round), scroll: [box.scrollWidth, box.clientWidth], text: box.textContent };
    });
    if (info) { const n = `levelup-${report.shots.length}.png`; await page.screenshot({ path: join(out, n) }); report.shots.push({ n, ...info }); if (report.shots.length >= 4) return; }
    await page.keyboard.press("Enter"); await page.waitForTimeout(350);
  }
};
try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  for (let i = 0; i < 80; i++) {
    if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break;
    await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  }
  await teleport("mx_map_lab", 7, 6);
  await talk("up");
  for (let i = 0; i < 80; i++) {
    if ((await live()).party.length && !(await present("dialogue-box")) && !(await present("runtime-choices"))) break;
    await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  }
  console.log("party", JSON.stringify((await live()).party.map((m) => m.speciesId)));
  await page.evaluate(() => window.__oprnDebug.heal());
  // 한 번 이겨도 오르도록 레벨을 낮추고 경험치를 비운다.
  await page.evaluate(([exp, lv]) => { const s = window.__oprnHooksScene.session; for (const id of s.monsterParty) { s.monsterInstances[id].level = Number(lv); s.monsterInstances[id].exp = exp; delete s.monsterInstances[id].currentHp; } }, [Number(process.env.LU_EXP ?? 200), Number(process.env.LU_LV ?? 4)]);
  await page.evaluate(() => window.__oprnDebug.heal());
  const started = await wildEncounter("mx_map_meadow");
  console.log("started", started);
  if (started) {
    // 기술을 쓰며 결과 패널까지 간다.
    for (let turn = 0; turn < 40 && (await present("battle-scene")); turn++) {
      if (await present("battle-result-panel")) { await shotLevelup(); break; }
      if (!(await page.locator('[data-testid="actor-command-fight"]').count())) { await page.keyboard.press("Enter"); await page.waitForTimeout(300); continue; }
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
      await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
      const skills = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
      await skills.first().waitFor({ timeout: 10000 });
      await skills.last().focus(); await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]') || document.querySelector('[data-testid="battle-result-panel"]') || document.querySelector('[data-testid="actor-command-fight"]'), undefined, { timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.shots), "errors", errors.length);
  await browser.close();
  await server.close();
}
