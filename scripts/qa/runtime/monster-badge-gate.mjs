// 몬스터 수집 캠페인 「배지 N개 게이트 문지기」와 「복종 레벨 상한 거부 전투」 실플레이 QA — 출하 플레이어(player.html, export shim).
//
//   bun src/harnesses/assistant-capability/node/buildMonsterBadgeGateFixture.ts /tmp/g.json
//   node scripts/qa/runtime/monster-badge-gate.mjs /tmp/g.json [outDir]
//
// A) 게이트: 새 게임 → 문지기 앞 → 배지 0개로 말 걸기(막힘 대사) → 배지 3개를 켜고 다시 말 걸기(열림 대사, 문지기가 비킴) → 그 칸을 걸어 지나간다.
// B) 복종: 교수에게 스타터 → 선두 레벨을 14 로 맞춤(디버그) → 1관 관장전에서 기술을 고르면 상한(배지 0개 Lv8)을 넘어 거부 문장이 뜬다.
// 디버그 쓰기는 SUMMARY 에 적는다: 맵 텔레포트·배지 스위치·퍼즐 스위치·선두 레벨.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-badge-gate.mjs <project.json> [outDir]");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg ?? "verify-shots/runtime-qa/monster-badge-gate");
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "frames"), { recursive: true });

const report = { project: projectArg, steps: [], errors: [], debugWrites: [], frames: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(String(error?.message ?? error)));
page.on("console", (message) => { if (message.type() === "error") report.errors.push(`console: ${message.text()}`); });
await page.addInitScript(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:monster-badge-gate", qaInstrumentation: true };
});
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

const state = () => page.evaluate(() => window.__oprnDebug.readState());
const live = () => page.evaluate(() => {
  const s = window.__oprnHooksScene.session;
  return { map: s.currentMapId, x: s.x, y: s.y, party: (s.monsterParty ?? []).map((id) => ({ id, ...s.monsterInstances[id] })), switches: s.switches };
});
const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.png`) }); return `${name}.png`; };
const step = (id, ok, detail, image) => { report.steps.push({ id, ok, detail, image }); console.log(ok ? "✓" : "✗", id, detail); };
const present = (testid) => page.locator(`[data-testid="${testid}"]`).count().then((n) => n > 0);
const settled = async (done) => {
  for (let k = 0; k < 4; k++) {
    if (!(await done())) return false;
    await page.waitForTimeout(250);
  }
  return true;
};
const pressEnterUntil = async (done, max = 40) => {
  for (let i = 0; i < max; i++) {
    if (await settled(done)) return true;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
  }
  return settled(done);
};
const teleport = async (mapId, x, y) => {
  report.debugWrites.push(`teleport ${mapId} (${x},${y})`);
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(600);
};
const face = (dir) => page.evaluate((d) => window.__oprnInput.face(d), dir);
const talk = async (dir) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    await face(dir); await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(700);
    if (await present("dialogue-box") || await present("battle-scene")) return true;
  }
  return false;
};
const free = (mapId, x, y) => !project.maps[mapId].events.some((event) => event.x === x && event.y === y);
const besideOf = (mapId, event) => [[0, 1, "up"], [-1, 0, "right"], [1, 0, "left"], [0, -1, "down"]]
  .map(([dx, dy, dir]) => ({ x: event.x + dx, y: event.y + dy, dir })).find((p) => free(mapId, p.x, p.y));

/** 전투가 끝날 때까지 가장 강한 기술로 싸운다(journey 의 fight 와 같은 입력). */
async function fight() {
  const log = [];
  for (let turn = 0; turn < 40; turn++) {
    if (!(await present("battle-scene"))) break;
    if (await present("battle-result-panel")) { await pressEnterUntil(async () => !(await present("battle-scene")), 30); break; }
    const forced = page.locator('[data-testid^="actor-switch-"]');
    if (!(await page.locator('[data-testid="actor-command-fight"]').count())) {
      if (await forced.count()) { await forced.first().focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(800); continue; }
      const pkmn = page.locator('[data-testid="actor-command-pkmn"]');
      if (await pkmn.count()) { await pkmn.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(500); continue; }
    }
    if (!(await page.locator('[data-testid="actor-command-fight"]').count())) { await page.keyboard.press("Enter"); await page.waitForTimeout(300); continue; }
    await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
    await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
    const skills = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
    await skills.first().waitFor({ timeout: 10000 });
    log.push(`turn ${turn}: ${await skills.last().getAttribute("data-testid")}`);
    await skills.last().focus(); await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
    if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
    await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]')
      || document.querySelector('[data-testid="battle-result-panel"]')
      || document.querySelector('[data-testid="actor-command-fight"]')
      || document.querySelector('[data-testid^="actor-switch-"]'), undefined, { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => !document.querySelector('[data-testid="battle-scene"]'), undefined, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  return log;
}


const hold = async (dir, ms) => { await page.evaluate((d) => window.__oprnInput.dir(d), dir); await page.waitForTimeout(ms); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(250); };
const gateInfo = JSON.parse(await readFile(`${resolve(projectArg)}.gate.json`, "utf8"));
const gateCell = gateInfo.cells[0];
const dialogueText = () => page.evaluate(() => (document.querySelector('[data-testid="dialogue-box"]')?.textContent ?? "").trim());
/** 글자가 한 자씩 나오는 대사 상자 — 마지막 문장 부호까지 나올 때까지 기다린 뒤 읽는다. */
const dialogueFull = async () => { let last = "", same = 0; for (let i = 0; i < 80; i++) { const t = await dialogueText(); same = t && t === last ? same + 1 : 0; if (same >= 5) return t; last = t; await page.waitForTimeout(150); } return last; };
const REFUSE = /말을 듣지|제멋대로|딴청|지시를 따르지/;
const bodyText = () => page.evaluate(() => document.body.innerText);

try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await pressEnterUntil(async () => !(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen")), 80);
  step("new-game", (await state()).currentMapId === project.startMapId, `${project.startMapId}`, await shot("01-start"));

  // ── A) 배지 게이트 ──
  // 문지기 곁의 비어 있는 칸(아래·왼·오른쪽 순)에 선다 — 다른 이벤트(주민) 위에 겹쳐 서지 않는다.
  const approach = [[0, 1, "up"], [-1, 0, "right"], [1, 0, "left"]].map(([dx, dy, dir]) => ({ x: gateCell.x + dx, y: gateCell.y + dy, dir })).find((p) => free(gateInfo.mapId, p.x, p.y));
  await teleport(gateInfo.mapId, approach.x, approach.y);
  await face(approach.dir);
  await page.waitForTimeout(500);
  await shot("10-gate-closed-approach");
  const talked1 = await talk(approach.dir);
  const closedLine = talked1 ? await dialogueFull() : "";
  await page.waitForTimeout(500);
  step("gate-closed-line", talked1 && /배지를 3개/.test(closedLine), `배지 0개: 「${closedLine.replace(/\s+/g, " ")}」`, await shot("11-gate-closed-dialogue"));
  await pressEnterUntil(async () => !(await present("dialogue-box")), 20);
  await page.waitForTimeout(400);
  // 막힘 상태에서 문지기 칸으로 걸어 들어가 봐도 못 지나간다.
  const before = await live();
  await hold(approach.dir, 700);
  const blocked = await live();
  step("gate-blocks-walk", blocked.x === before.x && blocked.y === before.y, `(${before.x},${before.y}) → (${blocked.x},${blocked.y})`);

  await page.evaluate(() => { for (const id of ["mx_badge_1", "mx_badge_2", "mx_badge_3"]) window.__oprnDebug.setSwitch(id, true); });
  report.debugWrites.push("switches mx_badge_1..3 on (게이트 열림 검증)");
  await page.waitForTimeout(500);
  const talked2 = await talk(approach.dir);
  const openLine = talked2 ? await dialogueFull() : "";
  await page.waitForTimeout(500);
  step("gate-open-line", talked2 && /지나가라/.test(openLine), `배지 3개: 「${openLine.replace(/\s+/g, " ")}」`, await shot("12-gate-open-dialogue"));
  await pressEnterUntil(async () => !(await present("dialogue-box")), 20);
  await page.waitForTimeout(1200);
  await shot("13-gate-open-cleared");
  const gateGone = await page.evaluate(([mapId, id]) => {
    const s = window.__oprnHooksScene.session;
    return { selfA: s.selfSwitches?.[id]?.A, x: s.x, y: s.y };
  }, [gateInfo.mapId, gateInfo.eventIds[0]]);
  await hold(approach.dir, 1400);
  const after = await live();
  step("gate-open-walk", Math.abs(after.x - approach.x) + Math.abs(after.y - approach.y) >= 2 || (after.x === gateCell.x && after.y === gateCell.y), `문지기 칸 (${gateCell.x},${gateCell.y}) 쪽으로 걸음: (${approach.x},${approach.y}) → (${after.x},${after.y}) (셀프스위치 A=${gateGone.selfA})`, await shot("14-gate-open-walked"));

  // ── B) 복종 레벨 상한 거부 전투 ──
  await page.evaluate(() => { for (const id of ["mx_badge_1", "mx_badge_2", "mx_badge_3"]) window.__oprnDebug.setSwitch(id, false); });
  report.debugWrites.push("switches mx_badge_1..3 off (배지 0개 = 상한 Lv8)");
  const lab = Object.values(project.maps).find((map) => map.events.some((event) => /professor/.test(event.id)));
  const professor = lab.events.find((event) => /professor/.test(event.id));
  const spot = besideOf(lab.id, professor);
  await teleport(lab.id, spot.x, spot.y);
  await talk(spot.dir);
  await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 });
  await pressEnterUntil(async () => (await live()).party.length > 0 && !(await present("dialogue-box")), 80);
  const gym = Object.values(project.maps).find((map) => map.events.some((event) => /_leader$/.test(event.id)) && /gym/.test(map.id));
  const leader = gym.events.find((event) => /_leader$/.test(event.id));
  const gymSwitches = [...new Set(JSON.stringify(leader.pages).match(/mx_gym_\d+_puzzle/g) ?? [])];
  await page.evaluate((ids) => { for (const id of ids) window.__oprnDebug.setSwitch(id, true); }, gymSwitches);
  await page.evaluate(() => {
    const s = window.__oprnHooksScene.session;
    const lead = s.monsterInstances[s.monsterParty[0]];
    lead.level = 14; lead.exp = Math.max(lead.exp ?? 0, 2744); lead.currentHp = undefined;
  });
  report.debugWrites.push(`switches ${gymSwitches.join(",")} on; lead level = 14 (상한 8 초과)`);
  let talkedLeader = false;
  for (const [dx, dy, dir] of [[0, 1, "up"], [0, 2, "up"], [-1, 0, "right"], [1, 0, "left"]]) {
    const at = { x: leader.x + dx, y: leader.y + dy };
    if (!free(gym.id, at.x, at.y)) continue;
    try { await teleport(gym.id, at.x, at.y); } catch { continue; }
    await page.waitForTimeout(2000);
    if (await talk(dir)) { talkedLeader = true; break; }
  }
  const started = talkedLeader && await pressEnterUntil(() => present("battle-scene"), 40);
  if (started) await page.waitForTimeout(2500);
  step("battle-start", !!started, started ? "관장전 시작" : "관장전을 못 시작함", await shot("20-battle-start"));

  // 첫 턴: 싸운다 → 기술. 그 뒤 거부 문장이 뜰 때까지 프레임을 계속 찍는다.
  let refusalSeen = "";
  if (started) {
    await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
    await shot("21-battle-command");
    await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
    const skills = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
    await skills.first().waitFor({ timeout: 10000 });
    await skills.last().focus(); await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
    if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
    const t0 = Date.now();
    let lastShot = 0;
    for (let n = 0; n < 400 && !refusalSeen; n++) {
      const text = await bodyText();
      const match = text.split("\n").find((line) => REFUSE.test(line));
      if (match && /(않는다|있다|피운다)/.test(match)) {
        refusalSeen = match.trim();
        await page.waitForTimeout(350);
        await page.screenshot({ path: join(out, "22-battle-refusal.png") });
        report.frames.push({ n, ms: Date.now() - t0, file: "22-battle-refusal.png", line: refusalSeen });
        break;
      }
      if (Date.now() - lastShot > 300) { lastShot = Date.now(); const file = `frames/frame-${String(report.frames.length).padStart(3, "0")}.png`; await page.screenshot({ path: join(out, file) }).catch(() => {}); report.frames.push({ n, ms: Date.now() - t0, file, line: match?.trim() ?? "" }); }
      await page.waitForTimeout(30);
    }
    if (refusalSeen) { await page.waitForTimeout(1200); await shot("23-battle-after-refusal"); }
  }
  step("obedience-refusal", !!refusalSeen, refusalSeen ? `거부 문장: 「${refusalSeen}」` : "거부 문장이 뜨지 않음");
} catch (error) {
  report.failure = String(error?.stack ?? error);
  await shot("failure").catch(() => {});
  console.error(report.failure);
} finally {
  const failed = report.steps.filter((s) => !s.ok);
  report.ok = !report.failure && failed.length === 0 && report.errors.length === 0;
  const { frames, ...rest } = report;
  await writeFile(join(out, "report.json"), JSON.stringify({ ...rest, frameCount: frames.length }, null, 2));
  await writeFile(join(out, "frames.json"), JSON.stringify(frames, null, 2));
  await writeFile(join(out, "SUMMARY.md"), [
    `# monster-badge-gate — ${report.ok ? "통과" : "실패"}`, "",
    ...report.steps.map((s) => `- ${s.ok ? "✓" : "✗"} ${s.id}: ${s.detail}${s.image ? ` (${s.image})` : ""}`), "",
    "즉시 확인: 10~14(게이트 전/후), 20~23(복종 거부 전투)", "",
    `디버그 쓰기: ${report.debugWrites.join(" · ")}`, "",
    report.failure ? `예외: ${report.failure}` : "", ...report.errors.slice(0, 15).map((e) => `- 오류: ${e}`),
  ].join("\n"));
  await context.close();
  await browser.close();
  await server.close();
}
process.exit(report.ok ? 0 : 1);
