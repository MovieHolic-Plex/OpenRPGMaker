// 포켓몬 라이크 육성·전투 규칙 시각 QA (poke-sys-battle).
//   node scripts/qa/runtime/poke-battle-sys.probe.mjs [outDir] [scene,scene…]
// 전제: `npx vite-node --script scripts/qa/runtime/pokemon-reference-fixture.mts` 로 fixture.json 을 먼저 만든다.
// 출하 player.html(export shim) 경로. 전투는 실제 scene.playBattle 로 시작하고, 입력은 실제 키보드만 쓴다.
// 세션 준비(파티 구성·레벨·PP)는 디버그 쓰기이며 SUMMARY.json 에 적는다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.argv[2] ?? "verify-shots/poke-sys-battle");
const only = process.argv[3]?.split(",");
await mkdir(out, { recursive: true });
// POKE_FIXTURE: 기본은 에메랄드풍 출하 캠페인(`node scripts/content/build-monster-expedition.mjs /tmp/pk-exp /tmp/pk-exp-priv` 로 만든 project.json).
// 스카록시 포켓몬 스킨 비교용은 pokemon-reference-fixture.mts 의 fixture.json(POKE_KIND=scar).
const fixturePath = process.env.POKE_FIXTURE ?? "/tmp/pk-exp/project.json";
const KIND = process.env.POKE_KIND ?? (fixturePath.includes("pokemon-reference") ? "scar" : "exp");
const projectJson = await readFile(resolve(fixturePath), "utf8");

export const report = { fixture: fixturePath, scenes: [], errors: [], debugWrites: [] };
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });

export async function boot(viewport = { width: 960, height: 720 }, patch = undefined) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(120000); page.setDefaultNavigationTimeout(280000);
  page.on("pageerror", (e) => report.errors.push(String(e?.message ?? e)));
  page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text()); });
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    window.__OPENRPG_BOOT__ = { projectUrl: "/__poke/project.json", saveNamespace: "poke-sys-battle", qaInstrumentation: true };
  });
  let body = projectJson;
  {
    // 시작 맵의 자동 대사(mx_intro_page)는 전투 중에도 돌아 전투 HUD 위에 문장 상자를 겹친다 — 프로브 인공물이라 대사 내용만 비운다(디버그 쓰기).
    const draft = JSON.parse(projectJson);
    let emptied = 0;
    const walk = (node) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node && typeof node === "object") {
        if (node.id === "mx_intro_page" && Array.isArray(node.commands)) { node.commands = []; emptied++; }
        Object.values(node).forEach(walk);
      }
    };
    walk(draft);
    if (patch) { patch(draft); report.debugWrites.push("project patch: " + patch.toString().slice(0, 160)); }
    body = JSON.stringify(draft);
    report.debugWrites.push("mx_intro_page commands emptied x" + emptied);
  }
  await page.route("**/__poke/project.json", (route) => route.fulfill({ contentType: "application/json", body }));
  await page.goto(server.url + "/player.html?e2eVitals=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 280000 });
  // 부하가 낮으면 제목 화면이 입력을 받기 전에 Enter 가 지나간다 — 입력 준비를 기다리며 다시 누른다.
  await page.waitForTimeout(2500);
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.keyboard.press("Enter");
    const started = await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 9000 }).then(() => true, () => false);
    if (started) break;
  }
  await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 120000 });
  // 시작 칸 앞에 QA 이벤트(ev_qa_*)가 있다 — 전투 중 z 가 필드 「조사」로도 새지 않게 이벤트 없는 칸으로 옮긴다.
  if (KIND === "exp") {
    // 출하 캠페인의 시작 연출(박사 소개·조작 안내 대사)은 Esc 로 건너뛴다 — 실제 입력. 대사 상자가 2초 동안 안 보일 때까지.
    let quiet = 0;
    for (let i = 0; i < 80 && quiet < 5; i++) {
      const open = await page.evaluate(() => Boolean(document.querySelector('[data-testid="dialogue-box"], [data-testid="cinematic-sequence"], .dialogue-box, .cinematic-skip')));
      quiet = open ? 0 : quiet + 1;
      if (open) await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
  }
  const spot = KIND === "scar" ? ["map_pkmn_route", 6, 6] : ["mx_map_home", 10, 12];
  await page.evaluate((spot) => window.__oprnDebug.teleport(...spot), spot);
  await page.waitForFunction((spot) => { const s = window.__oprnDebug.readState(); return s.currentMapId === spot[0] && s.x === spot[1] && s.y === spot[2]; }, spot, { timeout: 30000 });
  report.debugWrites.push("teleport " + spot.join(","));
  await page.waitForTimeout(500);
  return { page, context };
}

/** 세션 편집 — monsterInstances 를 직접 지정. */
export async function setParty(page, instances) {
  report.debugWrites.push("setParty " + JSON.stringify(instances.map((i) => [i.speciesId, i.level])));
  await page.evaluate((list) => {
    const s = window.__oprnHooksScene.session;
    s.monsterInstances = {}; s.monsterParty = []; s.monsterBox = [];
    list.forEach((inst, i) => {
      const id = "monster_" + (i + 1);
      s.monsterInstances[id] = { instanceId: id, friendship: 70, exp: 0, caughtAt: { mapId: s.currentMapId, x: 1, y: 1 }, ...inst };
      s.monsterParty.push(id);
    });
  }, instances);
}

/** 필드 대사(오프닝 자동 이벤트)가 끝날 때까지 확인키로 넘긴다 — 대사가 뜬 채 전투를 열면 문장 상자가 전투 HUD 위에 겹쳐 찍힌다(프로브 인공물). */
export async function settleField(page) {
  let quiet = 0;
  for (let i = 0; i < 60 && quiet < 6; i++) {
    const open = await page.evaluate(() => Boolean(document.querySelector('[data-testid="dialogue-box"], [data-testid="cinematic-sequence"], .dialogue-box, .cinematic-skip, [data-testid="dialogue-corner"], .dialogue-ambient-body')));
    quiet = open ? 0 : quiet + 1;
    if (open) await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
}

export async function startBattle(page, troopId, extra = {}) {
  await settleField(page);
  await page.evaluate(([troopId, extra]) => {
    window.__battleResult = null;
    void window.__oprnHooksScene.playBattle({ kind: "battleProcessing", troopId, canEscape: true, canLose: true, ...extra }).then((v) => { window.__battleResult = v ?? "null"; });
  }, [troopId, extra]);
  await page.waitForSelector('[data-testid="battle-scene"]', { timeout: 60000 });
  waitIdle.seen = false; waitIdle.requireIntro = true;
  await waitIdle(page);
}

export async function waitIdle(page, prompt = "무엇을 할까", ms = 45000) {
  // 입장 연출(약 3초, swiftshader)이 끝나기 전에도 busy=false 인 프레임이 있다 — 프롬프트 문구가 뜨고
  // 두 번 연달아 한가할 때만 「준비됨」으로 본다.
  const until = Date.now() + ms;
  let calm = 0;
  while (Date.now() < until) {
    const ui = await menuState(page);
    // 입장 연출은 바깥 전환 막 뒤에서 시작한다 — 한 번이라도 busy 를 본 뒤에만 「준비됨」을 인정한다.
    if (ui.busy === "true") waitIdle.seen = true;
    const ok = (waitIdle.seen || !waitIdle.requireIntro) && ui.busy === "false" && (!prompt || ui.text.includes(prompt));
    calm = ok ? calm + 1 : 0;
    if (calm >= 2) { await page.waitForTimeout(250); return true; }
    await page.waitForTimeout(250);
  }
  return false;
}

export async function shot(page, name, scale = 1) {
  const path = join(out, name + ".png");
  if (await page.locator('[data-testid="battle-scene"]').count()) await page.locator('[data-testid="battle-scene"]').screenshot({ path, timeout: 8000 }).catch(() => page.screenshot({ path }));
  else await page.screenshot({ path });
  return path;
}

export async function menuState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="battle-scene"]');
    const buttons = [...document.querySelectorAll("button.battle-command")].filter((n) => !n.disabled);
    return {
      phase: root?.dataset.battlePhase, busy: root?.dataset.battleSequenceBusy,
      menu: buttons.map((n) => n.dataset.testid),
      cursor: buttons.findIndex((n) => n.dataset.battleCommandCursor === "true"),
      text: [...document.querySelectorAll(".battle-message-line")].map((n) => n.textContent.trim()).join(" / "),
    };
  });
}

export async function choose(page, id) {
  for (let i = 0; i < 24; i++) {
    const ui = await menuState(page);
    if (ui.busy === "true" || !ui.menu.includes(id)) { await page.waitForTimeout(200); continue; }
    const want = ui.menu.indexOf(id);
    if (ui.cursor === want) { await page.keyboard.press("z"); return true; }
    // 루트 메뉴는 2×2(싸운다 가방 / 몬스터 도망) — 행 먼저, 그다음 열. 목록형은 위아래만.
    const grid = ui.menu.length === 4 && ui.menu[0] === "actor-command-fight";
    const from = Math.max(0, ui.cursor);
    let key;
    if (grid && (from >> 1) === (want >> 1)) key = want > from ? "ArrowRight" : "ArrowLeft";
    else if (grid) key = (want >> 1) > (from >> 1) ? "ArrowDown" : "ArrowUp";
    else key = ui.cursor < 0 || want > ui.cursor ? "ArrowDown" : "ArrowUp";
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
  }
  return false;
}

/** 문장에 re 가 나타나는 순간 찍는다(없으면 false). */
export async function shotWhen(page, name, re, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const t = (await menuState(page)).text;
    if (re.test(t)) { await shot(page, name); return t; }
    await page.waitForTimeout(120);
  }
  return false;
}

export async function finish() { await browser.close(); await server.close(); await writeFile(join(out, "SUMMARY.json"), JSON.stringify(report, null, 2)); }


// ── 장면 ────────────────────────────────────────────────────────────────────
const M = (speciesId, level, extra = {}) => ({ speciesId, level, ...extra });

/** 레벨 구간 맨 위(한 방 더 맞으면 레벨업) 경험치. */
export async function expJustBelowNext(page, speciesId, level) {
  const species = JSON.parse(projectJson).database.monsterSpecies.find((record) => record.id === speciesId);
  return page.evaluate(async ([species, level]) => {
    const mod = await import("/src/project/monsterCollection.ts");
    return mod.monsterExpInLevelBand(species, level, 1e9);
  }, [species, level]);
}

export async function fightMove(page, index = 0) {
  if (!(await choose(page, "actor-command-fight"))) return false;
  await page.waitForTimeout(250);
  const ids = (await menuState(page)).menu.filter((id) => id.startsWith("actor-skill-"));
  return choose(page, ids[index] ?? ids[0]);
}

export async function untilPrompt(page, ms = 60000) {
  // 메시지를 결정 키로 넘기며 다음 「무엇을 할까」 또는 결과창까지.
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const ui = await menuState(page);
    const result = await page.evaluate(() => Boolean(document.querySelector(".battle-result-panel")));
    if (result) return "result";
    if (ui.busy === "false" && ui.text.includes("무엇을 할까")) return "prompt";
    await page.waitForTimeout(300);
  }
  return "timeout";
}

const SPR = "mx_species_spriglet", COAL = "mx_species_coalbit";
const FOUR = ["mx_skill_normal_1", "mx_skill_grass_1", "mx_skill_grass_2", "mx_skill_grass_6"];

async function press(page, key, wait = 350) { await page.keyboard.press(key); await page.waitForTimeout(wait); }

export const scenes = {
  async auditRoot(page) {
    await setParty(page, [M(SPR, 16, { skillIds: FOUR, skillPp: { mx_skill_normal_1: 30, mx_skill_grass_1: 7, mx_skill_grass_2: 0, mx_skill_grass_6: 10 } }), M(COAL, 9)]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0");
    await shot(page, "au1-root");
    await press(page, "z", 600); await shot(page, "au2-fight-4moves");
    await press(page, "ArrowRight"); await press(page, "ArrowDown"); await shot(page, "au3-fight-cursor4");
    await press(page, "x", 500); await press(page, "ArrowDown"); await press(page, "ArrowRight");
    report.rootMenu = await menuState(page);
  },
  async auditTrainer(page) {
    await setParty(page, [M(SPR, 12)]);
    await startBattle(page, "mx_troop_mx_map_meadow_trainer_0", { canEscape: false });
    await shot(page, "at1-trainer-root");
    report.trainerRun = await page.evaluate(() => { const b = document.querySelector('[data-testid="actor-command-run"]'); return b ? { disabled: b.disabled, aria: b.getAttribute("aria-disabled") } : null; });
    await press(page, "ArrowDown"); await press(page, "ArrowRight"); await press(page, "z", 900);
    await shot(page, "at2-trainer-run-pressed");
    report.trainerRunText = (await menuState(page)).text;
  },
  async auditFlee(page) {
    await setParty(page, [M(SPR, 5)]);
    await startBattle(page, "mx_troop_mx_map_forest_wild_0");
    report.flee = [];
    for (let i = 0; i < 3; i++) {
      if (!(await choose(page, "actor-command-run"))) break;
      await page.waitForTimeout(1200);
      await shot(page, "af" + (i + 1) + "-flee-try");
      const r = await untilPrompt(page, 25000);
      report.flee.push({ i, r, text: (await menuState(page)).text });
      if (r !== "prompt") break;
    }
  },
  async auditLevelUp(page) {
    const exp = await expJustBelowNext(page, SPR, 15);
    await setParty(page, [M(SPR, 15, { exp, skillIds: FOUR })]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0");
    for (let t = 0; t < 6; t++) {
      if (!(await fightMove(page, 2))) break;
      if ((await untilPrompt(page, 90000)) === "result") break;
    }
    await page.waitForTimeout(1200);
    for (let k = 0; k < 9; k++) {
      await shot(page, "al" + (k + 1) + "-result");
      report["al" + (k + 1)] = (await menuState(page)).text;
      await press(page, "z", 1400);
      if (!(await page.locator('[data-testid="battle-scene"]').count())) break;
    }
    await page.waitForTimeout(1500);
    report.afterBattle = await page.evaluate(() => Object.values(window.__oprnHooksScene.session.monsterInstances).map((m) => ({ id: m.instanceId, level: m.level, skillIds: m.skillIds, pending: m.pendingSkillIds })));
    await shot(page, "al-final");
  },
  // PR A: 칸이 가득 찬 몬스터가 레벨업으로 새 기술을 배울 때 「잊게 할까?」 장면. pick: "replace2" | "decline"
  async learnForget(page, pick = process.env.LEARN_PICK ?? "replace2") {
    const exp = await expJustBelowNext(page, SPR, 15);
    await setParty(page, [M(SPR, 15, { exp, skillIds: FOUR })]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_0");
    for (let t = 0; t < 6; t++) {
      if (!(await fightMove(page, 2))) break;
      if ((await untilPrompt(page, 90000)) === "result") break;
    }
    await page.waitForTimeout(1200);
    report.learnSteps = [];
    for (let k = 0; k < 30; k++) {
      const menu = await page.evaluate(() => { const m = document.querySelector('[data-testid="emerald-movelearn-menu"]'); if (!m || m.hidden) return null; return [...m.querySelectorAll(".emerald-movelearn-row")].map((r) => r.textContent); });
      const text = await page.evaluate(() => document.querySelector('[data-testid="emerald-movelearn"] .battle-message-line')?.textContent ?? document.querySelector('[data-testid="battle-scene"] .battle-message-line')?.textContent ?? "");
      await shot(page, "pa" + String(k + 1).padStart(2, "0"));
      report.learnSteps.push({ k, text, menu });
      if (menu && menu.length === 2) { if (pick !== "decline") await page.keyboard.press("ArrowUp"); await press(page, "z", 900); continue; }
      if (menu && menu.length > 2) { if (pick === "replace2") await page.keyboard.press("ArrowDown"); await press(page, "z", 900); continue; }
      await press(page, "z", 1100);
      if (!(await page.locator('[data-testid="battle-scene"]').count()) && !(await page.locator('[data-testid="emerald-movelearn"]').count())) break;
    }
    await page.waitForTimeout(1500);
    report.afterLearn = await page.evaluate(() => Object.values(window.__oprnHooksScene.session.monsterInstances).map((m) => ({ id: m.instanceId, level: m.level, skillIds: m.skillIds, pending: m.pendingSkillIds })));
    await shot(page, "pa-final");
  },
  async auditStatus(page) {
    await setParty(page, [M(SPR, 16, { skillIds: FOUR, currentHp: 6, stateIds: ["state_paralysis"], skillPp: { mx_skill_normal_1: 4, mx_skill_grass_1: 3, mx_skill_grass_2: 25, mx_skill_grass_6: 10 } }), M(COAL, 9)]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_3");
    await shot(page, "as1-status-lowhp");
    await press(page, "z", 600); await shot(page, "as2-fight-lowpp");
  },
  async auditEffect(page) {
    await setParty(page, [M(SPR, 16, { skillIds: FOUR })]);
    await startBattle(page, "mx_troop_mx_map_meadow_wild_3");
    await fightMove(page, 1);
    report.effectText = await shotWhen(page, "ae1-effective", /굉장|별로|효과가 없/, 30000);
    report.afterText = [];
    for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); report.afterText.push((await menuState(page)).text); }
    await shot(page, "ae2-after");
  },
  async auditDouble(page) {
    await setParty(page, [M(SPR, 12), M(COAL, 12)]);
    await startBattle(page, "mx_troop_mx_map_meadow_trainer_2");
    await shot(page, "ad1-double-attempt");
    report.double = await page.evaluate(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return { actors: [...r.querySelectorAll(".battle-actor-status")].length, enemies: [...r.querySelectorAll(".battle-enemy")].length }; });
  },
};
export const patches = {
  auditDouble: (project) => { project.system.activeSlots = 2; const t = project.database.troops.find((x) => x.id === "mx_troop_mx_map_meadow_trainer_2"); t.activeSlots = 2; },
};

if (process.argv[1]?.endsWith("poke-battle-sys.probe.mjs")) {
  const names = only ?? Object.keys(scenes);
  for (const name of names) {
    let booted;
    for (let attempt = 0; attempt < 3 && !booted; attempt++) {
      try { booted = await boot(undefined, patches[name]); } catch (e) { report.errors.push("boot retry: " + String(e?.message ?? e).slice(0, 120)); }
    }
    if (!booted) { report.scenes.push({ name, ok: false, error: "boot failed" }); continue; }
    const { page, context } = booted;
    const row = { name, started: new Date().toISOString() };
    try { await scenes[name](page); row.ok = true; } catch (e) { row.ok = false; row.error = String(e?.message ?? e).slice(0, 400); try { await shot(page, name + "-ERROR"); } catch { /* */ } }
    report.scenes.push(row);
    await context.close();
  }
  await finish();
  console.log(JSON.stringify({ scenes: report.scenes, errors: report.errors.slice(0, 5) }, null, 1));
}
