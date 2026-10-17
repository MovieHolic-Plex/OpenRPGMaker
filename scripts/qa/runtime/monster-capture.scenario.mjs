// 포획 연출 시각 QA — 볼 던지기 → 흔들림 → 성공(점멸·도감 등록 문장·결과)/실패(탈출)를 실제 입력으로 프레임 연속 캡처한다.
//
//   MODE=success|fail|both(기본) SHAKES=0|1|2|3(실패 때 원하는 흔들림, 기본 아무거나) \
//   unshare -rn sh -c "ip link set lo up && node scripts/qa/runtime/monster-capture.scenario.mjs <campaign.json> <outDir>"
//
// 캠페인: `bun src/harnesses/assistant-capability/node/buildMonsterFixture.ts <out.json>` (모델 없이, 또는 /tmp/pk-field/base.json 사본).
// 디버그 쓰기(report.debugWrites 에 남는다): 파티에 몬스터를 직접 넣고 볼을 인벤토리에 넣는다(스타터 흐름은 이 시나리오의 대상이 아니다),
//   야생의 포획률을 정한다(성공=마스터 볼, 실패=낮은 포획률+일반 볼). 출하 코드 경로는 그대로 — 던지기는 실제 가방 버튼(키보드 Enter)으로 한다.
// 캡처: <outDir>/<mode>-NN-<label>.png (포획 연출 구간은 배틀 필드만 잘라 50ms 간격으로 찍는다) + <mode>-trace.json(프레임별 볼 위치·크기·클래스).
// 진단 전용 — 저장소 콘텐츠를 바꾸지 않는다. 게이트·vitest 아님.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const [projectArg, outArg] = process.argv.slice(2);
if (!projectArg) throw new Error("usage: monster-capture.scenario.mjs <project.json> <outDir>");
process.env.VITE_CACHE_DIR ??= resolve(".vite-cache/monster-capture");
const MODE = process.env.MODE ?? "both";
const WANT_SHAKES = process.env.SHAKES === undefined ? undefined : Number(process.env.SHAKES);
const out = resolve(outArg ?? "verify-shots/runtime-qa/monster-capture");
await mkdir(out, { recursive: true });
const baseProject = JSON.parse(await readFile(resolve(projectArg), "utf8"));
const report = { steps: [], errors: [], debugWrites: [], runs: [] };
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=NetworkChangeNotifier"] });

const step = (id, ok, detail) => { report.steps.push({ id, ok, detail }); console.log(ok ? "✓" : "✗", id, detail); };

async function runOne(mode) {
  const project = structuredClone(baseProject);
  const troop = project.database.troops.find((t) => t.id === "mx_troop_mx_map_meadow_wild_0");
  const foe = project.database.enemies.find((e) => e.id === troop.members[0].enemyId);
  const species = project.database.monsterSpecies.find((r) => r.id === foe.speciesId);
  // 첫 포획이어야 도감 등록 문장이 뜬다 — 이 종을 캠페인 도감에 이미 잡은 것으로 두지 않는다(기본 상태).
  foe.stats = { ...foe.stats, maxHp: 400, attack: 1, defense: 40, mind: 40, agility: 20 };
  // 실패 경로의 흔들림 수는 포획률로 고른다(기본 상태 HP 가득, 일반 볼): 0→포획률 0, 1→0.6, 2→1.0. 3→낮은 HP+강화 볼(싸워서 깎는다).
  const failRate = { 0: 0, 1: 0.6, 2: 1, 3: 0.6 }[WANT_SHAKES ?? 2];
  species.captureRate = mode === "success" ? 1 : failRate;
  if (mode === "fail" && WANT_SHAKES === 3) { foe.stats = { ...foe.stats, maxHp: 90, defense: 1 }; }
  report.debugWrites.push(`[${mode}] wild ${foe.speciesId} maxHp 400 attack 1 captureRate ${species.captureRate}`);
  const pageBorn = Date.now();
  const videoDir = join(out, `${mode}-video`);
  const page = await (await browser.newContext({ viewport: { width: 960, height: 720 }, ...(process.env.VIDEO === "1" ? { recordVideo: { dir: videoDir, size: { width: 960, height: 720 } } } : {}) })).newPage();
  page.on("pageerror", (e) => report.errors.push(`[${mode}] ${String(e?.message ?? e)}`));
  page.on("console", (m) => { if (m.type() === "error") report.errors.push(`[${mode}] console: ${m.text()}`); });
  await page.addInitScript(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:monster-capture", qaInstrumentation: true };
    // 프레임마다 볼·적 그림·메시지를 기록한다 — 눈으로 본 것을 숫자로 뒷받침.
    const trace = []; window.__capTrace = trace;
    const t0 = performance.now();
    const rect = (n) => { if (!n) return null; const r = n.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
    // 전투 문장창의 모든 변화를 시각과 함께 남긴다(연출 구간 밖의 문장도 놓치지 않게).
    const msgLog = []; window.__capMsgLog = msgLog;
    setInterval(() => {
      const win = document.querySelector('[data-testid="battle-message-window"]');
      const text = (win?.innerText ?? "").replace(/\s+/g, " ").trim();
      const orb = !!document.querySelector('[data-testid="battle-capture-orb"]');
      const key = (win?.dataset.messageKey ?? "").replace(/\u0002/g, " // ") + " @" + (win?.dataset.battleDirectorStep ?? "");
      if (text && (msgLog.length === 0 || msgLog[msgLog.length - 1].key !== key)) msgLog.push({ t: Math.round(performance.now() - t0), text, key, orb });
    }, 40);
    const tick = () => {
      const field = document.querySelector(".battle-field");
      const orb = document.querySelector('[data-testid="battle-capture-orb"]');
      if (field && orb) {
        const enemy = document.querySelector(".battle-enemy .battle-enemy-image, .battle-enemy .battle-actor-image");
        const lines = [...document.querySelectorAll(".battle-message-line")].filter((n) => n.getClientRects().length).map((n) => (n.textContent ?? "").trim());
        trace.push({ t: Math.round(performance.now() - t0), orb: rect(orb), cls: orb.className.replace("battle-capture-orb", "").trim(), rock: orb.dataset.rock ?? null, enemy: rect(enemy), enemyScale: enemy ? getComputedStyle(enemy).transform : null, lines });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(project) }));
  const present = (id) => page.locator(`[data-testid="${id}"]`).count().then((n) => n > 0);
  const shot = (name, clip) => page.screenshot({ path: join(out, `${mode}-${name}.png`), ...(clip ? { clip } : {}) });
  const waitCmd = () => page.waitForFunction(() => { const r = document.querySelector('[data-testid="battle-scene"]'); return r?.dataset.battleDirectorStep === "command" && r.dataset.battleSequenceBusy === "false"; }, undefined, { timeout: 60000 }).then(() => true, () => false);
  const lines = () => page.evaluate(() => {
    const own = [...document.querySelectorAll(".battle-message-line")].filter((n) => n.getClientRects().length > 0).map((n) => (n.textContent ?? "").trim()).filter(Boolean);
    if (own.length) return own;
    const win = document.querySelector('[data-testid="battle-message-window"]');
    const text = (win?.innerText ?? "").replace(/\s+/g, " ").trim();
    return text ? [text] : [];
  });
  try {
    await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector("[data-testid='title-screen']", { timeout: 180000 });
    await page.waitForTimeout(1500);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__oprnDebug?.readState?.()?.currentMapId, undefined, { timeout: 180000 });
    // 오프닝 연출·대사가 모두 끝날 때까지(연속 8번 비어 있어야 끝난 것 — 대사 사이 틈에서 멈추면 대사창이 전투 위에 남는다).
    for (let i = 0, calm = 0; i < 120 && calm < 8; i++) { const busy = (await present("cinematic-sequence")) || (await present("dialogue-box")) || (await present("title-screen")); calm = busy ? 0 : calm + 1; if (busy) await page.keyboard.press("Enter"); await page.waitForTimeout(250); }
    const moves = ["mx_skill_normal_1", "mx_skill_normal_2", "mx_skill_normal_3", "mx_skill_poison_6"];
    const ballId = mode === "success" ? "item_gen_master_orb" : WANT_SHAKES === 3 ? "item_gen_net_trap" : "item_capture_orb";
    report.debugWrites.push(`[${mode}] party monster coalbit Lv30 injected; inventory ${ballId} x9`);
    await page.evaluate(([moves, ballId]) => {
      const s = window.__oprnHooksScene.session;
      const id = "qa_mon_1";
      s.monsterInstances = { ...(s.monsterInstances ?? {}), [id]: { instanceId: id, speciesId: "mx_species_coalbit", level: 30, exp: 0, skillIds: moves, skillPp: Object.fromEntries(moves.map((m) => [m, 30])), friendship: 70, caughtAt: { mapId: s.currentMapId, x: 1, y: 1 } } };
      s.monsterParty = [id];
      s.inventory = { ...(s.inventory ?? {}), [ballId]: 9 };
    }, [moves, ballId]);
    await page.evaluate(() => { void window.__oprnHooksScene.playBattle({ kind: "battleProcessing", troopId: "mx_troop_mx_map_meadow_wild_0", canEscape: true, canLose: true }); });
    await page.getByTestId("battle-scene").waitFor({ timeout: 60000 });
    step(`${mode}:battle-open`, await waitCmd(), "command prompt reached");
    await shot("01-start");
    report[`${mode}Geometry`] = await page.evaluate(() => {
      const r = (n) => { if (!n) return null; const b = n.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
      const f = document.querySelector(".battle-field");
      return { field: r(f), fieldOffset: f ? [f.offsetWidth, f.offsetHeight] : null, actorGroup: r(document.querySelector(".battle-actor-group")), actor: r(document.querySelector(".battle-actor-group .battle-actor")), actorImg: r(document.querySelector(".battle-actor-group .battle-actor-image")), enemy: r(document.querySelector(".battle-enemy")), enemyImg: r(document.querySelector(".battle-enemy .battle-enemy-image")), party: r(document.querySelector(".battle-party")), skin: document.querySelector("[data-testid='battle-scene']")?.dataset.battleSkin, ui: document.querySelector("[data-testid='battle-scene']")?.dataset.battleUiStyle };
    });
    const field = await page.locator(".battle-field").first().boundingBox();
    const clip = field ? { x: Math.max(0, Math.floor(field.x)), y: Math.max(0, Math.floor(field.y)), width: Math.ceil(field.width), height: Math.ceil(field.height) } : undefined;
    report[`${mode}Clip`] = clip;
    if (mode === "fail" && WANT_SHAKES === 3) {
      // 적 HP 를 30% 아래로(싸운다 → 첫 기술) — 마지막 한 칸이 3번 흔들리는 포획의 조건이다.
      for (let i = 0; i < 8; i++) {
        if (!(await waitCmd())) break;
        const ratio = await page.evaluate(() => { for (const n of document.querySelectorAll('[data-testid^="battle-enemy-hp-"]')) { const [hp, max] = (n.textContent ?? "").split("/").map(Number); if (max > 0 && hp > 0) return hp / max; } return null; });
        if (ratio !== null && ratio <= 0.3) break;
        await page.locator('[data-testid="actor-command-fight"]').focus(); await page.keyboard.press("Enter");
        const sk = page.locator('[data-testid^="actor-skill-"]:not([disabled])'); await sk.first().waitFor({ timeout: 10000 });
        await sk.first().focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
        const tg = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
        if (await tg.count()) { await tg.first().focus(); await page.keyboard.press("Enter"); }
        await page.waitForTimeout(500);
      }
      await shot("01b-hp-lowered");
    }
    let throwNo = 0; let finalShakes = null; let caught = false;
    for (; throwNo < 9; throwNo++) {
      if (!(await waitCmd())) break;
      await page.locator('[data-testid="actor-command-item"]').focus(); await page.keyboard.press("Enter");
      const btn = page.locator(`[data-testid="actor-capture-${ballId}"]`);
      await btn.waitFor({ timeout: 10000 });
      if (throwNo === 0) await shot("02-ball-list");
      await btn.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(250);
      const target = page.locator('button[data-testid^="battle-target-"]:not([data-testid="battle-target-cancel"])');
      if (await target.count()) { await target.first().focus(); await page.keyboard.press("Enter"); }
      (report.marks ??= []).push({ mode, throwNo, videoSec: (Date.now() - pageBorn) / 1000 });
      // 연출 구간: orb 가 나타나면 50ms 간격으로 배틀 필드를 잘라 찍는다(최대 ~9초).
      const frames = [];
      const t0 = Date.now(); let orbSeen = false; let n = 0;
      const seenLines = [];
      while (Date.now() - t0 < 12000) {
        const hasOrb = await present("battle-capture-orb");
        const ls = await lines(); for (const l of ls) if (!seenLines.includes(l)) seenLines.push(l);
        if (hasOrb) {
          orbSeen = true;
          const info = await page.evaluate(() => { const o = document.querySelector('[data-testid="battle-capture-orb"]'); return o ? { cls: o.className.replace("battle-capture-orb", "").trim(), rock: o.dataset.rock ?? "0", shakes: o.dataset.shakes } : null; });
          if (info) { finalShakes = Number(info.shakes); frames.push(info); await page.screenshot({ path: join(out, `${mode}-t${throwNo}-f${String(n++).padStart(2, "0")}-${info.cls.replace(/\s+/g, "+") || "throw"}-r${info.rock}.png`), ...(clip ? { clip } : {}) }); }
        } else if (orbSeen) break; // 연출 끝
        else await page.waitForTimeout(20);
        if (n > 40) break;
      }
      step(`${mode}:throw${throwNo}-orb`, orbSeen, `${frames.length} frames; shakes=${finalShakes}; lines=${JSON.stringify(seenLines)}`);
      // 연출 직후 문장(실패 문구·도감 등록 …)을 바뀔 때마다 한 장씩.
      for (let w = 0, prev = ""; w < 24; w++) {
        const now = (await lines()).join(" | ");
        if (now && now !== prev) { prev = now; seenLines.push(now); await shot(`t${throwNo}-line${String(seenLines.length).padStart(2, "0")}`); }
        await page.waitForTimeout(120);
      }
      report.runs.push({ mode, throwNo, shakes: finalShakes, frames: frames.length, lines: seenLines });
      const nowLines = await lines();
      await shot(`t${throwNo}-after`);
      if (!(await present("battle-scene")) || (await present("battle-result-panel"))) { caught = true; break; }
      // 성공이면 전투가 끝난다(결과 창). 실패면 한 번 더 — 원하는 흔들림이 아니면 계속, 맞으면 멈춘다.
      if (mode === "fail" && finalShakes !== null && (WANT_SHAKES === undefined || finalShakes === WANT_SHAKES)) { step("fail:wanted-shakes", true, `shakes=${finalShakes}`); break; }
      void nowLines;
    }
    if (mode === "success") {
      // 연출이 끝난 뒤 문장(도감 등록 → 새 동료 …)을 차례로 넘기며 새 문장마다 한 장씩 찍는다.
      const seen = []; let k = 0;
      for (let i = 0; i < 80 && (await present("battle-scene")); i++) {
        const ls = await lines(); const key = ls.join("|");
        if (key && !seen.includes(key)) { seen.push(key); await shot(`r${String(k++).padStart(2, "0")}-msg`); }
        await page.keyboard.press("Enter"); await page.waitForTimeout(350);
      }
      report.successMessages = seen;
      step("success:messages", seen.length > 0, JSON.stringify(seen));
      await page.waitForTimeout(1200);
      const inst = await page.evaluate(() => Object.values(window.__oprnHooksScene.session.monsterInstances).map((m) => ({ id: m.instanceId, species: m.speciesId, ball: m.caughtBallId ?? null })));
      report.instances = inst;
      step("success:party-gained", inst.length >= 2, JSON.stringify(inst));
    }
    void caught;
    const trace = await page.evaluate(() => window.__capTrace);
    await writeFile(join(out, `${mode}-trace.json`), JSON.stringify(trace));
    report[`${mode}MsgLog`] = await page.evaluate(() => window.__capMsgLog);
  } catch (error) {
    report.errors.push(`[${mode}] ${String(error?.stack ?? error)}`);
    await page.screenshot({ path: join(out, `${mode}-error.png`) }).catch(() => {});
  } finally {
    await page.context().close();
  }
}
try {
  if (MODE === "success" || MODE === "both") await runOne("success");
  if (MODE === "fail" || MODE === "both") await runOne("fail");
} finally {
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
  await browser.close();
  await server.close();
}
console.log(`\nerrors: ${report.errors.length}`);
if (report.errors.length) console.log(report.errors.slice(0, 5).join("\n"));
