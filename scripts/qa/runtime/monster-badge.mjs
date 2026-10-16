// 몬스터 수집 캠페인 「체육관 클리어 → 배지 획득 연출 → 배지 화면」 실플레이 QA — 출하 플레이어(player.html, export shim).
//
//   node scripts/qa/runtime/monster-badge.mjs <project.json> [outDir]
//
// 타이틀 → 새 게임 → 교수에게 스타터 → 1관 관장을 실제 입력으로 이기고, 승리 직후의 배지 획득 연출을 **프레임 연속 캡처**한다
// (frames/frame-NNN.png + frames.json: 그림 슬롯 상태·시각). 이어서 ESC 메뉴 「배지·목표」 화면을 찍는다.
// 디버그 쓰기는 SUMMARY 에 적는다: 맵 사이 이동(teleport), 관장전 직전 퍼즐 스위치·리더 레벨 맞춤(체육관 퍼즐·수련은 자동 플레이가 증명).
// 시작 마을→연구소→관장은 monster-journey.mjs 와 같은 입력 훅(__oprnInput)·전투 버튼(Enter)만 쓴다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-badge.mjs <project.json> [outDir]");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg ?? "verify-shots/runtime-qa/monster-badge");
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
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:monster-badge", qaInstrumentation: true };
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

/** 배지 연출 프레임 연속 캡처 — 그림 슬롯(medal·halo)의 위치·불투명도와 화면 PNG 를 같이 남긴다. */
const captured = { stop: false, task: null };
function startFrameCapture(t0) {
  captured.stop = false;
  captured.task = (async () => {
    for (let n = 0; !captured.stop && n < 600; n++) {
      const info = await page.evaluate(() => {
        const pics = window.__oprnHooksScene?.session?.pictures ?? {};
        const slot = (id) => { const p = pics[id]; if (!p) return null; const node = document.querySelector(`[data-picture-id="${id}"]`); const r = node?.getBoundingClientRect(); return { x: p.x, y: p.y, scale: p.scale, opacity: Number(node ? getComputedStyle(node).opacity : p.opacity), rect: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null }; };
        return { medal: slot("mx_badge_medal"), halo: slot("mx_badge_halo"), dialogue: !!document.querySelector('[data-testid="dialogue-box"]'),
          line: (document.querySelector('[data-testid="dialogue-box"]')?.textContent ?? "").trim().slice(0, 60) };
      }).catch(() => null);
      const file = `frames/frame-${String(n).padStart(3, "0")}.png`;
      await page.screenshot({ path: join(out, file) }).catch(() => {});
      report.frames.push({ n, ms: Date.now() - t0, file, ...info });
      await page.waitForTimeout(40);
    }
  })();
}
const stopFrameCapture = async () => { captured.stop = true; await captured.task; };

try {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await pressEnterUntil(async () => !(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen")), 80);
  const start = await state();
  step("new-game", start.currentMapId === project.startMapId, `${start.currentMapId} (${start.x},${start.y})`, await shot("01-start"));

  if (!process.env.BADGE_QA_MENU_ONLY) {
  // 교수에게 첫 동료.
  const lab = Object.values(project.maps).find((map) => map.events.some((event) => /professor/.test(event.id)));
  const professor = lab.events.find((event) => /professor/.test(event.id));
  const spot = besideOf(lab.id, professor);
  await teleport(lab.id, spot.x, spot.y);
  await talk(spot.dir);
  await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 });
  await pressEnterUntil(async () => (await live()).party.length > 0 && !(await present("dialogue-box")), 80);
  const afterStarter = await live();
  step("starter", afterStarter.party.length === 1, afterStarter.party.map((m) => `${m.speciesId} Lv${m.level}`).join(", "));

  // 1관 관장 — 퍼즐 스위치와 리더 레벨은 디버그로 맞춘다.
  const gym = Object.values(project.maps).find((map) => map.events.some((event) => /_leader$/.test(event.id)) && /gym/.test(map.id));
  const leader = gym.events.find((event) => /_leader$/.test(event.id));
  const gymSwitches = [...new Set(JSON.stringify(leader.pages).match(/mx_gym_\d+_puzzle/g) ?? [])];
  await page.evaluate((ids) => { for (const id of ids) window.__oprnDebug.setSwitch(id, true); }, gymSwitches);
  await page.evaluate(() => {
    const s = window.__oprnHooksScene.session;
    const lead = s.monsterInstances[s.monsterParty[0]];
    lead.level = Math.max(lead.level, 14); lead.exp = Math.max(lead.exp ?? 0, 2800); lead.currentHp = undefined;
  });
  report.debugWrites.push(`switches ${gymSwitches.join(",")} on; lead level ≥14`);
  const badgeId = (JSON.stringify(leader.pages).match(/mx_badge_\d+/) ?? ["?"])[0];
  let talked = false;
  for (const [dx, dy, dir] of [[0, 1, "up"], [0, 2, "up"], [-1, 0, "right"], [1, 0, "left"]]) {
    const at = { x: leader.x + dx, y: leader.y + dy };
    if (!free(gym.id, at.x, at.y)) continue;
    try { await teleport(gym.id, at.x, at.y); } catch { continue; }
    await page.waitForTimeout(2000);
    if (await talk(dir)) { talked = true; break; }
  }
  const started = talked && await pressEnterUntil(() => present("battle-scene"), 40);
  if (started) await page.waitForTimeout(2500);
  const fightLog = started ? await fight() : [];
  step("gym-fight", started && (await state()).battleResult === "victory", `${leader.id}: ${fightLog.length}턴 → ${(await state()).battleResult}`, await shot("02-after-fight"));

  // 승리 직후 — 관장 대사를 넘기며 배지 연출을 프레임 연속 캡처. 연출 그림이 떠 있는 동안은 대사를 바로 넘기지 않고 ≥2.2초 보여 준다.
  const t0 = Date.now();
  startFrameCapture(t0);
  let medalSince = 0, sawMedal = false;
  for (let i = 0; i < 120 && !(await page.evaluate((id) => window.__oprnHooksScene.session.switches[id] === true && !window.__oprnHooksScene.session.pictures?.mx_badge_medal && document.querySelector('[data-testid="dialogue-box"]') === null && window.__badgeCeremonySeen === true, badgeId)); i++) {
    const hasMedal = await page.evaluate(() => !!window.__oprnHooksScene.session.pictures?.mx_badge_medal);
    if (hasMedal) { sawMedal = true; await page.evaluate(() => { window.__badgeCeremonySeen = true; }); medalSince ||= Date.now(); }
    if (await present("dialogue-box")) {
      if (!hasMedal || Date.now() - medalSince > 2200) { await page.keyboard.press("Enter"); if (hasMedal) medalSince = Date.now(); }
    }
    await page.waitForTimeout(350);
  }
  await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
  await stopFrameCapture();
  const withMedal = report.frames.filter((f) => f.medal);
  const rise = withMedal.map((f) => f.medal.rect?.[1] ?? 0);
  const peakHalo = Math.max(0, ...report.frames.map((f) => f.halo?.opacity ?? 0));
  step("badge-ceremony", sawMedal && withMedal.length >= 4 && Math.min(...rise) < Math.max(...rise), `프레임 ${report.frames.length}장 · 배지 떠 있는 ${withMedal.length}장 · 배지 화면 y ${Math.max(...rise, 0)}→${Math.min(...rise, 0)} · 빛 최대 ${peakHalo.toFixed(2)}`);
  const finalState = await state();
  step("badge-switch", finalState.switches[badgeId] === true, `${badgeId}=${finalState.switches[badgeId]}`, await shot("03-after-ceremony"));

  } else {
    report.debugWrites.push("MENU_ONLY: mx_badge_1 switch on (연출·전투 생략)");
    await page.evaluate(() => window.__oprnDebug.setSwitch("mx_badge_1", true));
  }

  // ESC 메뉴 → 배지·목표(키 입력만 — 메뉴 항목은 키보드 전용 레이아웃이라 포인터가 막힌다).
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  await shot("04-menu");
  let atBadge = false;
  for (let i = 0; i < 14 && !atBadge; i++) {
    atBadge = ((await page.locator('[data-testid="status-menu-command-campaign-progress"]').getAttribute("class")) ?? "").includes("selected");
    if (!atBadge) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(120); }
  }
  let badgeScreen = false;
  if (atBadge) { await page.keyboard.press("Enter"); await page.waitForTimeout(900); badgeScreen = await present(`campaign-badge-${project.system.monsterCampaign.badges[0].id}`); }
  step("badge-screen", badgeScreen, badgeScreen ? "배지·목표 화면" : "배지·목표 항목을 못 찾음", await shot("05-badge-screen"));
  if (process.env.BADGE_QA_DUMP) {
    const dump = await page.evaluate(() => {
      const pick = (el) => { if (!el) return null; const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return { tag: el.tagName, cls: el.className, display: c.display, font: c.font, lineHeight: c.lineHeight, w: Math.round(r.width), h: Math.round(r.height), maxH: c.maxHeight + "|h=" + c.height + "|contain=" + c.contain + "|minH=" + c.minHeight + "|zoom=" + c.zoom + "|tf=" + c.transform + "|autoRows=" + c.gridAutoRows + "|ac=" + c.alignContent, pad: c.padding, top: Math.round(r.top), overflow: c.overflow, gridRows: c.gridTemplateRows, gridCols: c.gridTemplateColumns }; };
      const row = document.querySelector('[data-testid="campaign-next-objective"]');
      return { row: pick(row), kids: row ? [...row.querySelectorAll("*")].map(pick) : [], html: row?.outerHTML.slice(0, 900), list: pick(document.querySelector(".status-menu-detail-list")), detail: pick(document.querySelector(".campaign-menu-detail")) };
    });
    await writeFile(join(out, "dump.json"), JSON.stringify(dump, null, 2));
  }
  const badgeRow = badgeScreen ? await page.locator(`[data-testid="campaign-badge-${project.system.monsterCampaign.badges[0].id}"]`).getAttribute("data-badge-acquired") : null;
  step("badge-acquired-row", badgeRow === "true", `1번 배지 행 data-badge-acquired=${badgeRow}`);
} catch (error) {
  report.failure = String(error?.stack ?? error);
  await shot("failure").catch(() => {});
  console.error(report.failure);
} finally {
  captured.stop = true;
  const failed = report.steps.filter((s) => !s.ok);
  report.ok = !report.failure && failed.length === 0 && report.errors.length === 0;
  await writeFile(join(out, "frames.json"), JSON.stringify(report.frames, null, 2));
  const { frames, ...rest } = report;
  await writeFile(join(out, "report.json"), JSON.stringify({ ...rest, frameCount: frames.length }, null, 2));
  await writeFile(join(out, "SUMMARY.md"), [
    `# monster-badge — ${report.ok ? "통과" : "실패"}`, "",
    ...report.steps.map((s) => `- ${s.ok ? "✓" : "✗"} ${s.id}: ${s.detail}${s.image ? ` (${s.image})` : ""}`), "",
    `즉시 확인: frames/ 연속 캡처(frames.json 의 medal·halo 로 떠오름·빛 구간 고른다), 03-after-ceremony.png, 05-badge-screen.png`, "",
    `디버그 쓰기: ${report.debugWrites.join(" · ")}`, "",
    report.failure ? `예외: ${report.failure}` : "", ...report.errors.slice(0, 15).map((e) => `- 오류: ${e}`),
  ].join("\n"));
  await context.close();
  await browser.close();
  await server.close();
}
process.exit(report.ok ? 0 : 1);
