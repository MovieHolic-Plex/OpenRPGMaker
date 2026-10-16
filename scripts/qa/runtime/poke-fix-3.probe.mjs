// 포켓몬 라이크 3차 감사(D29~D35) 수리 확인 — 출하 플레이어(player.html) 경로, 480x320 원본 캡처.
//   node scripts/qa/runtime/poke-fix-3.probe.mjs <project.json> <outDir> <case>
// case: d30 (파티 0 트레이너 시야) | d29 (수동 저장 후 불러오기·이어하기) | d31 (패배 블랙아웃) | d32 (가방) | d34 (연구소 박사 칩) | d35 (관장전)
// 입력은 __oprnInput(방향·조사)과 키보드만 쓴다. 디버그 쓰기(teleport·파티 비우기·레벨 맞춤)는 report.debugWrites 에 적는다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg, caseId] = process.argv.slice(2);
if (!projectArg || !outArg || !caseId) throw new Error("usage: poke-fix-3.probe.mjs <project.json> <outDir> <case>");
const projectJson = await readFile(resolve(projectArg), "utf8");
const project = JSON.parse(projectJson);
const out = resolve(outArg);
await mkdir(out, { recursive: true });

const report = { case: caseId, steps: [], errors: [], debugWrites: [], console: [] };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 480, height: 320 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(String(error?.message ?? error)));
page.on("console", (message) => {
  const text = message.text();
  if (message.type() === "error") report.errors.push(`console: ${text}`);
  if (/event battle failed|BattleAdmission/.test(text)) report.console.push(text.slice(0, 120));
});
if (caseId.startsWith("d29")) process.env.KEEP_STORAGE = "1";
await page.addInitScript((keepStorage) => {
  if (!keepStorage) { try { localStorage.clear(); } catch { /* ignore */ } }
  window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:poke-fix-3", qaInstrumentation: true };
}, process.env.KEEP_STORAGE === "1");
await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));

const present = (testid) => page.locator(`[data-testid="${testid}"]`).count().then((n) => n > 0);
const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.png`) }); return `${name}.png`; };
const step = (id, ok, detail, image) => { report.steps.push({ id, ok, detail, image }); console.log(ok ? "✓" : "✗", id, detail); };
const live = () => page.evaluate(() => window.__oprnDebug.readLive());
const sess = () => page.evaluate(() => {
  const s = window.__oprnHooksScene.session;
  return { map: s.currentMapId, x: s.x, y: s.y, gold: s.gold, party: (s.monsterParty ?? []).length, box: (s.monsterBox ?? []).length, switches: Object.keys(s.switches).filter((k) => s.switches[k]).length };
});
const settled = async (done) => { for (let k = 0; k < 4; k++) { if (!(await done())) return false; await page.waitForTimeout(250); } return true; };
const pressEnterUntil = async (done, max = 40) => {
  for (let i = 0; i < max; i++) { if (await settled(done)) return true; await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
  return settled(done);
};
const teleport = async (mapId, x, y) => {
  report.debugWrites.push(`teleport ${mapId} (${x},${y})`);
  await page.evaluate(([m, tx, ty]) => window.__oprnDebug.teleport(m, tx, ty), [mapId, x, y]);
  await page.waitForFunction(([m, tx, ty]) => { const s = window.__oprnDebug.readLive(); return s.currentMapId === m && s.x === tx && s.y === ty; }, [mapId, x, y], { timeout: 15000 });
  await page.waitForTimeout(700);
};
const newGame = async () => {
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
  await page.waitForTimeout(1500);
};
const startNewGame = async () => {
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 120000 });
  await pressEnterUntil(async () => !(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen")), 80);
  await page.waitForTimeout(500);
};
const closeDialogue = () => pressEnterUntil(async () => !(await present("dialogue-box")), 40);


const eventOf = (mapId, test) => project.maps[mapId].events.find((event) => test.test(event.id));
const present2 = present;
const free = (mapId, x, y) => !project.maps[mapId].events.some((event) => event.x === x && event.y === y);
const besideOf = (mapId, event) => [[0, 1, "up"], [-1, 0, "right"], [1, 0, "left"], [0, -1, "down"]]
  .map(([dx, dy, dir]) => ({ x: event.x + dx, y: event.y + dy, dir })).find((p) => free(mapId, p.x, p.y));
const face = (dir) => page.evaluate((d) => window.__oprnInput.face(d), dir);
const talk = async (dir) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    await face(dir); await page.evaluate(() => window.__oprnInput.action());
    await page.waitForTimeout(700);
    if (await present("dialogue-box") || await present("battle-scene")) return true;
  }
  return false;
};
const liveFull = () => page.evaluate(() => {
  const s = window.__oprnHooksScene.session;
  return { map: s.currentMapId, x: s.x, y: s.y, gold: s.gold, party: (s.monsterParty ?? []).map((id) => ({ id, ...s.monsterInstances[id] })), box: s.monsterBox ?? [], switches: s.switches, inventory: s.inventory };
});
/** 연구소 박사에게 스타터를 받는다(디버그: 연구소로 순간이동만). */
const getStarter = async () => {
  const lab = Object.values(project.maps).find((map) => map.events.some((event) => /professor/.test(event.id)));
  const professor = lab.events.find((event) => /professor/.test(event.id));
  const spot = besideOf(lab.id, professor);
  await teleport(lab.id, spot.x, spot.y);
  await talk(spot.dir);
  await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 });
  await pressEnterUntil(async () => (await liveFull()).party.length > 0 && !(await present("dialogue-box")), 80);
  return { lab, professor, spot };
};
const openMenu = async () => { await page.keyboard.press("x"); await page.waitForSelector("[data-testid='main-menu']", { timeout: 8000 }); await page.waitForTimeout(300); };

const cases = {
  async d34() {
    await newGame(); await startNewGame();
    const lab = Object.values(project.maps).find((map) => map.events.some((event) => /professor/.test(event.id)));
    const professor = lab.events.find((event) => /professor/.test(event.id));
    const spot = besideOf(lab.id, professor);
    const far = [3, 4, 2].map((dy) => ({ x: professor.x, y: professor.y + dy })).find((p) => free(lab.id, p.x, p.y)) ?? spot;
    await teleport(lab.id, far.x, far.y);
    await page.waitForTimeout(800);
    await shot("01-lab");
    await teleport(lab.id, spot.x, spot.y);
    await page.waitForTimeout(500);
    const g = professor.pages[0].graphic;
    step("professor-chip", true, `박사 칩 ${g.sprite?.id} pattern ${g.pattern}`);
    await talk(spot.dir);
    await page.waitForSelector("[data-testid='dialogue-box']", { timeout: 15000 });
    await page.waitForTimeout(600);
    await shot("02-talk");
  },

  async d35() {
    await newGame(); await startNewGame(); await getStarter();
    const gym = Object.values(project.maps).find((map) => /_gym$/.test(map.id) && map.events.some((e) => /_leader$/.test(e.id)));
    const leader = gym.events.find((e) => /_leader$/.test(e.id));
    report.debugWrites.push("setSwitch mx_gym_1_puzzle");
    await page.evaluate(() => window.__oprnDebug.setSwitch("mx_gym_1_puzzle", true));
    const spot = besideOf(gym.id, leader);
    await teleport(gym.id, spot.x, spot.y);
    await talk(spot.dir);
    await shot("01-talk");
    const began = await pressEnterUntil(() => present("battle-scene"), 40);
    step("battle-began", began, `관장 ${leader.id}`);
    await page.waitForTimeout(3500);
    await shot("02-battle");
    const troop = project.database.troops.find((t) => t.id === `mx_troop_${gym.id}_leader`);
    step("party", true, troop.enemyIds.map((id) => { const e = project.database.enemies.find((x) => x.id === id); return `${e.name} Lv${e.level}`; }).join(", "));
  },

  async d32() {
    await newGame(); await startNewGame(); await getStarter();
    await openMenu();
    await page.locator('[data-testid="status-menu-command-items"]').click();
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowRight"); await page.waitForTimeout(500);
    await shot("01-bag-balls");
    const dom = await page.evaluate(() => {
      const menu = document.querySelector('[data-testid="main-menu"]');
      const out = [];
      for (const n of menu.querySelectorAll("*")) {
        if (n.children.length) continue;
        const t = (n.textContent ?? "").trim(); if (!t) continue;
        const r = n.getBoundingClientRect(); const cs = getComputedStyle(n);
        if (r.width === 0 || cs.visibility === "hidden" || cs.display === "none") continue;
        out.push(`${n.className.toString().split(" ")[0]}|${n.dataset.testid ?? ""}|y${Math.round(r.top)}-${Math.round(r.bottom)} x${Math.round(r.left)}-${Math.round(r.right)}|${cs.textOverflow}|${t.slice(0, 40)}`);
      }
      return out;
    });
    console.log(dom.join("\n"));
    const desc = dom.filter((l) => /약해진/.test(l));
    step("description-copies", desc.length <= 1, `「약해진…」 보이는 곳 ${desc.length}곳: ${desc.join(" // ")}`);
  },

  async d31() {
    await newGame(); await startNewGame();
    const { lab } = await getStarter();
    const startPos = project.startPos, startMap = project.startMapId;
    // 마을 회복 센터 직원에게 말을 건다 → 체크포인트(센터 입구)가 찍힌다.
    const center = Object.values(project.maps).find((map) => map.events.some((e) => /_center_nurse$/.test(e.id)) && map.id.startsWith(startMap));
    const nurse = center.events.find((e) => /_center_nurse$/.test(e.id));
    const nspot = besideOf(center.id, nurse);
    if (process.env.NO_NURSE !== "1") {
    await teleport(center.id, nspot.x, nspot.y);
    await talk(nspot.dir);
    await pressEnterUntil(async () => !(await present("dialogue-box")), 40);
    }
    // 센터 직원의 회복 의식(연출)이 끝나 입력이 돌아올 때까지.
    for (let w = 0; w < 40; w++) {
      if (!(await page.evaluate(() => window.__oprnHooksScene.running))) break;
      if (await present("dialogue-box")) await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }
    const beforeGold = (await liveFull()).gold;
    step("nurse", process.env.NO_NURSE !== "1", `${process.env.NO_NURSE === "1" ? "(센터에 들르지 않음) " : ""}센터 ${center.id} (${nspot.x},${nspot.y}) 에서 쉬었다. 골드 ${beforeGold}`);
    // 1번길 트레이너에게 지도록 — 동료를 Lv1·HP1 로(디버그 쓰기) 만든 뒤 실제 전투 입력.
    const meadow = project.maps.mx_map_meadow;
    const trainer = meadow.events.find((e) => e.id === "mx_map_meadow_trainer_0");
    const near = { x: 4, y: 9, dir: "up" };
    await teleport(meadow.id, near.x, near.y);
    report.debugWrites.push("lead Lv1 HP1");
    await page.evaluate(() => { const s = window.__oprnHooksScene.session; const m = s.monsterInstances[s.monsterParty[0]]; m.level = 1; m.exp = 0; m.currentHp = 1; });
    step("scene", true, await page.evaluate(() => { const sc = window.__oprnHooksScene; return JSON.stringify({ running: sc.running, input: sc.inputEnabled, moving: sc.moving, tile: [sc.tileX, sc.tileY], dlg: !!document.querySelector("[data-testid=dialogue-box]") }); }));
    // 시야선 트레이너는 스스로 걸어와 말을 건다 — 대사가 뜰 때까지 기다린다(안 뜨면 조사).
    for (let w = 0; w < 6 && !(await present("dialogue-box")); w++) {
      await page.waitForTimeout(2500);
      step("wait", true, await page.evaluate(() => { const sc = window.__oprnHooksScene; const ev = sc.eventPositions?.get?.("mx_map_meadow_trainer_0") ?? null; return JSON.stringify({ running: sc.running, ev, player: [sc.tileX, sc.tileY] }); }));
    }
    if (!(await present("dialogue-box"))) await talk(near.dir);
    await shot("09-talk");
    step("talk", await present("dialogue-box"), `트레이너 ${trainer.id} (${trainer.x},${trainer.y}) 시야 ${near.x},${near.y}`);
    // 전투가 시작될 때까지 대사를 넘긴다.
    const began = await pressEnterUntil(() => present("battle-scene"), 30);
    step("battle-began", began, "전투 화면");
    await page.waitForTimeout(2500);
    for (let turn = 0; turn < 12; turn++) {
      if (!(await present("battle-scene"))) break;
      if (await present("battle-result-panel")) { await page.keyboard.press("Enter"); await page.waitForTimeout(400); continue; }
      const fight = page.locator('[data-testid="actor-command-fight"]');
      if (!(await fight.count())) { await page.keyboard.press("Enter"); await page.waitForTimeout(400); continue; }
      await page.waitForFunction(() => document.querySelector('[data-testid="battle-scene"]')?.dataset.battleDirectorStep === "command", undefined, { timeout: 30000 }).catch(() => {});
      await fight.focus(); await page.keyboard.press("Enter");
      const sk = page.locator('[data-testid^="actor-skill-"]:not([disabled])');
      await sk.first().waitFor({ timeout: 10000 }).catch(() => {});
      await sk.first().focus(); await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
      const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
      if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
      await page.waitForTimeout(2500);
    }
    // 패배 대사(「눈앞이 캄캄해졌다…」)를 넘겨 블랙아웃 화면이 뜰 때까지.
    for (let i = 0; i < 40 && !(await present("game-over-screen")); i++) {
      if (await present("dialogue-box")) await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }
    let n = 0;
    for (let i = 0; i < 24 && n < 7 && await present("game-over-screen"); i++) {
      await shot(`10-defeat-${n++}`);
      await page.waitForTimeout(450);
    }
    const msgInfo = await page.evaluate(() => {
      const n = document.querySelector(".blackout-message"); if (!n) return null;
      const cs = getComputedStyle(n); const r = n.getBoundingClientRect();
      const t = document.querySelector(".blackout-title");
      return { text: n.textContent, font: cs.fontFamily.slice(0, 40), size: cs.fontSize, w: Math.round(r.width), title: t?.textContent ?? null };
    });
    step("blackout-message-style", true, JSON.stringify(msgInfo));
    // 복귀 후
    await page.waitForFunction(() => !document.querySelector("[data-testid='game-over-screen']"), undefined, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const after = await liveFull();
    await shot("11-recovered");
    step("recover-position", after.map.startsWith(center.id.slice(0, 7)) && after.map === center.id, `복귀 맵 ${after.map} (${after.x},${after.y}) — 센터 ${center.id} (${nspot.x},${nspot.y}), 시작 ${startMap} (${startPos.x},${startPos.y}); 골드 ${beforeGold} → ${after.gold}; 파티 HP ${after.party.map((m) => m.currentHp ?? "full").join(",")}`);
  },

  async d29() {
    await newGame();
    await page.evaluate(() => localStorage.clear());
    await startNewGame();
    const { lab } = await getStarter();
    await page.waitForTimeout(1200);
    const keys = () => page.evaluate(() => Object.keys(localStorage).filter((k) => /save|auto/i.test(k)));
    const stamps = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => /save|auto/i.test(k)).map((k) => { try { const v = JSON.parse(localStorage.getItem(k)); return [k.slice(-12), `${v.savedAt?.slice(11, 19)} party=${v.monsterSummary?.partyCount ?? v.partyCount ?? "?"} by=${v.savedBy ?? "manual"}`]; } catch { return [k.slice(-12), "?"]; } })));
    step("autosave-before-manual", true, JSON.stringify(await stamps()));
    // 5초 디바운스 뒤에도 같은 맵이면 자동 저장은 스타터 이전 상태로 남는다 — 수동 저장은 스타터 뒤.
    await page.waitForTimeout(1500);
    await openMenu();
    await page.locator('[data-testid="status-menu-command-save"]').click();
    await page.waitForSelector('[data-testid="save-slot-1"]', { timeout: 8000 });
    await page.locator('[data-testid="save-slot-1"]').click();
    await page.waitForTimeout(800);
    step("manual-save", true, JSON.stringify(await stamps()), await shot("01-saved"));
    const before = await liveFull();
    // 새로고침 → 타이틀. 타이틀 「이어하기」·「불러오기」 패널을 연다.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
    await page.waitForTimeout(1500);
    const titleLabels = await page.evaluate(() => [...document.querySelectorAll("[data-testid^='title-']")].map((n) => `${n.dataset.testid}:${n.textContent.trim()}`));
    step("title", true, titleLabels.join(" | "), await shot("02-title"));
    // (a) 불러오기 패널 — 첫 포커스
        await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await page.waitForTimeout(300); await page.keyboard.press("Enter");
    await page.waitForSelector('[data-testid="player-load-window"]', { timeout: 8000 });
    await page.waitForTimeout(500);
    const focus = await page.evaluate(() => {
      const items = [...document.querySelectorAll('[data-testid^="save-slot-"]')].filter((n) => n.tagName === "BUTTON");
      const sel = items.find((n) => n.classList.contains("selected") || n === document.activeElement || n.getAttribute("aria-current") === "true");
      return { all: items.map((n) => n.dataset.testid), selected: sel?.dataset.testid ?? null };
    });
    step("load-panel-focus", focus.selected === "save-slot-1", `포커스=${focus.selected} 칸=${focus.all.join(",")}`, await shot("03-load-panel"));
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 60000 });
    await pressEnterUntil(async () => !(await present("title-screen")), 20);
    await page.waitForTimeout(1500);
    const afterLoad = await liveFull();
    step("load-restores-manual-save", afterLoad.party.length === before.party.length && before.party.length === 1, `파티 ${before.party.length} → ${afterLoad.party.length}, 골드 ${before.gold} → ${afterLoad.gold}`, await shot("04-after-load"));
    // (b) 이어하기
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 120000 });
    await page.waitForTimeout(1500);
    const resume = page.locator('[data-testid="title-resume-game"]');
    step("resume-visible", (await resume.count()) > 0, "타이틀 이어하기 항목");
    if (await resume.count()) {
      await page.keyboard.press("ArrowDown"); await page.waitForTimeout(300); await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 60000 });
      await page.waitForTimeout(1800);
      const afterResume = await liveFull();
      step("resume-restores-manual-save", afterResume.party.length === 1, `이어하기 뒤 파티 ${afterResume.party.length}, 맵 ${afterResume.map}`, await shot("05-after-resume"));
    }
  },
  async dump() {
    await newGame(); await startNewGame(); await getStarter();
    await openMenu(); await shot('m0-menu');
    const ids = await page.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((n) => n.dataset.testid).filter((t) => /menu|save|rail/.test(t)).slice(0, 60));
    console.log(JSON.stringify(ids));
  },
  // 변형: 트레이너가 다가와 말을 건 뒤 대사를 닫고, 조사(Enter)를 계속 눌러 대는 감사 하네스 동작을 재현한다.
  async d30mash() {
    await newGame(); await startNewGame();
    await teleport("mx_map_meadow", 4, 9);
    await page.waitForTimeout(3500);
    const log0 = report.console.length;
    await closeDialogue();
    await page.evaluate(() => window.__oprnInput.face("up"));
    let last = "";
    for (let i = 0; i < 60; i++) {
      await page.evaluate(() => window.__oprnInput.action());
      await page.waitForTimeout(60);
      if (i === 8) await shot("m1-mash-8");
      last = await page.evaluate(() => document.querySelector('[data-testid="runtime-error"]')?.textContent?.slice(0, 20) ?? document.querySelector('[data-testid="dialogue-box"]')?.textContent?.slice(0, 20) ?? "");
    }
    step("mash-action", true, `조사 60회(≈4초) 동안 입장 거부 로그 ${report.console.length - log0}회 (log0=${log0}) last=${last}`, await shot("m2-mash-end"));
  },
  async d30() {
    await newGame(); await startNewGame();
    step("start", true, JSON.stringify(await sess()), await shot("01-start"));
    // 파티 0 그대로(스타터 안 받음) 1번길 첫 트레이너(4,6, 아래를 봄) 시야 4칸 안으로.
    await teleport("mx_map_meadow", 4, 9);
    for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); if (i === 2) await shot("02-after-0.75s"); }
    await shot("03-after-3s");
    const count1 = report.console.length;
    await page.waitForTimeout(2000);
    const count2 = report.console.length;
    step("no-refire", count2 === count1, `콘솔 입장 거부 로그 ${count1} → ${count2} (3초 뒤 2초간 추가 ${count2 - count1})`);
    step("total-logs", report.console.length <= 2, `입장 거부 로그 총 ${report.console.length}회`);
    const toast = await page.evaluate(() => ({ overlay: !!document.querySelector('[data-testid="runtime-error"]'), dialogue: !!document.querySelector('[data-testid="dialogue-box"]'), text: document.querySelector('[data-testid="dialogue-box"]')?.textContent?.trim().slice(0, 80) ?? null }));
    step("surface", true, `시스템 토스트=${toast.overlay} 대사창=${toast.dialogue} 문장=${toast.text}`);
    // 문장을 하나씩 넘기며 보이는 문장마다 캡처한다(트레이너 도발 → 입장 거부 안내).
    const seenTexts = [];
    for (let i = 0; i < 12 && await present("dialogue-box"); i++) {
      const t = await page.evaluate(() => document.querySelector('[data-testid="dialogue-box"]')?.textContent?.trim().slice(0, 40) ?? "");
      if (t && !seenTexts.includes(t)) { seenTexts.push(t); await shot(`04-line-${seenTexts.length}`); }
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);
    }
    step("lines", true, `보인 문장: ${seenTexts.join(" / ")}`);
    await closeDialogue();
    await page.waitForTimeout(800);
    await shot("04-after-dismiss");
    const after = report.console.length;
    await page.waitForTimeout(1500);
    step("no-refire-after-dismiss", report.console.length === after, `닫은 뒤 1.5초 추가 로그 ${report.console.length - after}`, await shot("05-final"));
    step("controls", await page.evaluate(() => !document.querySelector('[data-testid="dialogue-box"]')), "대사창 닫힘 — 입력 복귀 확인");
    // 확인키를 눌러 대고(감사 하네스의 Enter 연타) 걸어 보며 재발동 여부를 센다.
    const base = report.console.length;
    const texts = new Set();
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
      const t = await page.evaluate(() => document.querySelector('[data-testid="dialogue-box"]')?.textContent?.trim().slice(0, 30) ?? "");
      if (t) texts.add(t);
    }
    step("mash-enter", report.console.length - base <= 1, `Enter 연타 24회(약 3초) 동안 추가 입장 거부 ${report.console.length - base}회, 본 대사 ${[...texts].join(" | ") || "없음"}`, await shot("06-mash"));
    const walk = await live();
    for (const d of ["down", "down", "down"]) { await page.evaluate((x) => window.__oprnInput.dir(x), d); await page.waitForTimeout(250); await page.evaluate(() => window.__oprnInput.dir(null)); await page.waitForTimeout(250); }
    const walked = await live();
    step("walks", walked.y !== walk.y || walked.x !== walk.x, `걷기 ${walk.x},${walk.y} → ${walked.x},${walked.y}`, await shot("07-walked"));
  },
};
try {
  if (!cases[caseId]) throw new Error(`unknown case ${caseId}`);
  await cases[caseId]();
} catch (error) {
  step("probe-error", false, String(error?.stack ?? error).slice(0, 400), await shot("zz-error").catch(() => undefined));
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
}
console.log("errors:", report.errors.length, report.errors.slice(0, 4));
