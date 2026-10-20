// 『폴른 스타』 제1막 보스(발렌+수호상) 실플레이 프로브 — 출하 플레이어로 전략별로 끝까지 싸운다.
// battle-play10.probe.mjs 의 커맨드 루프를 그대로 쓰고, 보스 앞까지는 실제 이벤트(금속 관 세 단계 → 이리스 합류)를
// 밟은 뒤 스위치만 디버그로 세운다(화로 퍼즐은 fallen-audit 시나리오가 따로 본다).
// 전략: 공격만 / 스킬 섞기 / 아이템 / 방어 섞기 / 저HP 패배 → 물러섬 대사 → 다시 말 걸어 재도전.
//
//   FS_FIXTURE=.omo/fs/v11.json node scripts/qa/runtime/fallen-boss.probe.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/fallen-boss");
const fixture = JSON.parse(await readFile(resolve(process.env.FS_FIXTURE ?? ".omo/fs/v11.json"), "utf8"));
const project = fixture.project ?? fixture;
// 보스 앞 파티 = 카엘·엘레나·이리스(관에서 깨어난 뒤). 이리스 합류 이벤트는 fallen-audit 이 밟으니 여기선 처음부터 넣는다.
if (!project.system.startActorIds.includes("actor_fs_iris")) project.system.startActorIds.push("actor_fs_iris");

const RUNS = [
  { id: "attack", seed: 11, plan: "attack" },
  { id: "attack-b", seed: 222, plan: "attack" },
  { id: "skill-mix", seed: 88, plan: "skillMix" },
  { id: "skill", seed: 44, plan: "skill" },
  { id: "item", seed: 110, plan: "itemThenAttack", items: { item_potion: 3 } },
  { id: "defend-mix", seed: 33, plan: "defendFirst2" },
  { id: "lose-retry", seed: 77, plan: "attack", vitals: { hp: 30 }, retry: true },
];
const RUN_DEADLINE_MS = Number(process.env.FS_DEADLINE ?? 300_000);
const LOOP_MAX = 800;

async function readUi(page) {
  return await page.evaluate(() => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    // 전투 메뉴의 선택지 버튼(커맨드·스킬·아이템·대상·뒤로 전부 .battle-command).
    const buttons = [...document.querySelectorAll("button.battle-command")]
      .filter((n) => !n.disabled && n.dataset.previewOnly !== "true");
    const cursor = buttons.findIndex((n) => n.dataset.battleCommandCursor === "true");
    const state = window.__oprnDebug?.readState?.() ?? null;
    const cue = document.querySelector('[data-testid="battle-command-scroll-cue"]');
    const cueVisible = cue ? !cue.hidden : null;
    return {
      scrollCue: cueVisible,
      title: !!document.querySelector('[data-testid="title-screen"]'),
      scene: !!scene,
      busy: scene?.dataset.battleSequenceBusy === "true",
      directorStep: scene?.dataset.battleDirectorStep ?? null,
      targetPrompt: !!document.querySelector('[data-testid="battle-target-prompt"]'),
      menu: buttons.map((n) => n.dataset.testid),
      cursor,
      resultConfirm: !!document.querySelector('[data-testid="battle-result-confirm"]'),
      resultPanel: !!document.querySelector('[data-testid="battle-result-panel"]'),
      messageWindow: !!document.querySelector('[data-testid="battle-message-window"]'),
      gameOver: !!document.querySelector('[data-testid="game-over-screen"]'),
      dialogue: !!document.querySelector('[data-testid="dialogue-box"]'),
      battleResult: state?.battleResult ?? null,
    };
  });
}

// 가상 커서를 wanted 까지 화살표로 이동. 메뉴가 재렌더되면 커서 위치를 매번 다시 읽는다.
async function moveCursorTo(page, wanted) {
  for (let i = 0; i < 20; i++) {
    const ui = await readUi(page);
    const cur = ui.cursor;
    const wantIdx = ui.menu.indexOf(wanted);
    if (wantIdx < 0) return false;
    if (cur === wantIdx) return true;
    await page.keyboard.press(cur < 0 || wantIdx > cur ? "ArrowDown" : "ArrowUp");
    await page.waitForTimeout(50);
  }
  return false;
}

// 커맨드 단계에서 plan 에 맞는 testid 를 고른다.
function pickCommand(ui, run, ctx) {
  const usable = ui.menu.filter((id) => id !== "actor-command-back");
  const has = (id) => usable.includes(id);
  if (ctx.preferAttack) return "actor-command-attack";
  switch (run.plan) {
    case "defendFirst2":
      return ctx.decisions < 2 && has("actor-command-defend") ? "actor-command-defend" : "actor-command-attack";
    case "defendAll":
      return has("actor-command-defend") ? "actor-command-defend" : "actor-command-attack";
    case "skill":
    case "skillMix": {
      const wantSkill = run.plan === "skill" || ctx.decisions % 2 === 0;
      if (wantSkill && has("actor-command-skill")) return "actor-command-skill";
      if (wantSkill) {
        const direct = usable.find((id) => id.startsWith("actor-command-skill-"));
        if (direct) return direct;
      }
      return "actor-command-attack";
    }
    case "escape":
      return has("actor-command-escape") ? "actor-command-escape" : "actor-command-attack";
    case "item":
      return has("actor-command-item") ? "actor-command-item" : "actor-command-attack";
    case "itemThenAttack":
      return ctx.decisions < 3 && has("actor-command-item") ? "actor-command-item" : "actor-command-attack";
    default:
      return "actor-command-attack";
  }
}

async function drainDialogue(page, max = 60) {
  for (let i = 0; i < max; i++) {
    const open = await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]') && !document.querySelector('[data-testid="runtime-choices"]'));
    if (!open) { await page.waitForTimeout(400); if (!(await page.evaluate(() => !!document.querySelector('[data-testid="dialogue-box"]')))) return; continue; }
    await page.keyboard.press("Enter"); await page.waitForTimeout(250);
  }
}
async function chooseOption(page, index) {
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => !!document.querySelector('[data-testid="runtime-choices"]'))) break;
    await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  }
  await page.waitForTimeout(300);
  for (let i = 0; i < index; i++) { await page.keyboard.press("ArrowDown"); await page.waitForTimeout(80); }
  await page.keyboard.press("Enter"); await page.waitForTimeout(500);
}

async function playRun(browser, serverUrl, run) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  const record = { id: run.id, plan: run.plan, seed: run.seed, pageErrors, consoleErrors, shots: [] };
  const startedAt = Date.now();
  try {
    await page.addInitScript(() => {
      window.__OPENRPG_BOOT__ = { projectUrl: "/__fs-boss/project.json", saveNamespace: "fs-boss-qa", qaInstrumentation: true };
    });
    await page.route("**/__fs-boss/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
    await page.goto(`${serverUrl}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForSelector('[data-testid="title-screen"]', { timeout: 180_000 });
    await page.keyboard.press("Enter");
    // 오프닝 건너뛰기.
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => !!window.__oprnDebug?.readState?.().currentMapId && !document.querySelector('[data-testid="cinematic-sequence"]'))) break;
      await page.keyboard.press("Escape"); await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    await drainDialogue(page);
    record.partyBeforeBoss = await page.evaluate(() => window.__oprnDebug.readState().partyActorIds);
    await page.evaluate(() => { for (const id of ["sw_fs_main_started", "sw_fs_main_step0"]) window.__oprnDebug.setSwitch(id, true); });
    if (run.items) await page.evaluate((items) => { for (const [id, n] of Object.entries(items)) window.__oprnDebug.giveItem(id, n); }, run.items);
    await page.evaluate(() => { window.__oprnDebug.setSwitch("sw_fs_main_step1", true); window.__oprnDebug.teleport("fs_vault", 25, 25); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__oprnDebug.setSeed(0), 0);
    await page.evaluate((seed) => window.__oprnDebug.setSeed(seed), run.seed);
    if (run.vitals) {
      await page.evaluate((hp) => { for (const id of window.__oprnDebug.readState().partyActorIds) window.__oprnSetActorVitals(id, hp, 999); }, run.vitals.hp);
    }
    await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });
    record.rounds = [];
    const ctx = { decisions: 0, cancels: 0, shotCommand: false, shotTarget: false, shotResult: false, sawScene: false };
    for (let i = 0; i < LOOP_MAX && Date.now() - startedAt < RUN_DEADLINE_MS; i++) {
      const ui = await readUi(page);
      if (i % 40 === 0) (record.trace ??= []).push({ i, ...ui, menu: ui.menu.slice(0, 6), pos: await page.evaluate(() => { const s = window.__oprnDebug.readState(); return [s.currentMapId, s.x, s.y, s.switches.sw_fs_main_step0, s.switches.sw_fs_main_step1, s.switches.sw_fs_main_started]; }) });
      if (ui.gameOver) {
        record.outcome = "gameover";
        break;
      }
      if (ui.scene) ctx.sawScene = true;
      // 씬을 한 번 본 뒤에만 "사라짐 = 종료"로 읽는다 — 대사 중 필드 프레임을 종료로 오독하지 않게.
      if (ctx.sawScene && !ui.scene && !ui.title) {
        const outcome = record.resultAtPanel ?? ui.battleResult ?? "field";
        record.rounds.push({ outcome, decisions: ctx.decisions, ms: Date.now() - startedAt });
        if (run.retry && record.rounds.length === 1 && outcome !== "victory") {
          // 물러섬 대사 → 회복됐는지 → 다시 말 걸어 재도전.
          await page.waitForTimeout(600);
          const shot = `${run.id}-retreat.png`;
          await page.screenshot({ path: resolve(out, shot) }); record.shots.push(shot);
          await drainDialogue(page);
          record.afterRetreat = await page.evaluate(() => { const s = window.__oprnDebug.readState(); return { map: s.currentMapId, x: s.x, y: s.y, inventory: s.inventory }; });
          await page.evaluate(() => { window.__oprnDebug.teleport("fs_vault", 25, 25); });
          await page.waitForTimeout(800);
          await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });
          ctx.sawScene = false; ctx.shotResult = false; ctx.decisions = 0; delete record.resultAtPanel;
          continue;
        }
        record.outcome = outcome;
        break;
      }
      if (ui.resultPanel && !ctx.shotResult) {
        ctx.shotResult = true;
        const shot = `${run.id}-result.png`;
        await page.screenshot({ path: resolve(out, shot) });
        record.shots.push(shot);
        record.resultAtPanel = ui.battleResult;
      }
      if (ui.resultConfirm) {
        await page.keyboard.press("Enter");
        continue;
      }
      if (ui.dialogue) {
        await page.keyboard.press("Enter");
        continue;
      }
      if (ui.targetPrompt) {
        if (!ctx.shotTarget) {
          ctx.shotTarget = true;
          const shot = `${run.id}-target.png`;
          await page.screenshot({ path: resolve(out, shot) });
          record.shots.push(shot);
        }
        if (run.plan === "cancelOnce" && ctx.cancels === 0) {
          ctx.cancels += 1;
          await page.keyboard.press("x"); // 대상 선택 취소 → 커맨드로 회귀하는지가 관전 포인트
          continue;
        }
        const targets = ui.menu.filter((id) => id.startsWith("battle-target-") && id !== "battle-target-cancel");
        const target = run.plan === "lastTarget" ? targets.at(-1) : targets[0];
        if (!target) { await page.keyboard.press("x"); continue; }
        // 대상 메뉴에는 data-battle-command-cursor 가 없다 — 선택 대상은 aria-pressed 가 나르고
        // 이동은 ← → 로 한다(프롬프트 문구 "← →로 대상 변경"가 실측과 일치).
        for (let m = 0; m < targets.length + 2; m++) {
          const selected = await page.evaluate(() =>
            document.querySelector('[data-testid^="battle-target-"][aria-pressed="true"]')?.dataset.testid ?? null);
          if (selected === target) break;
          await page.keyboard.press("ArrowRight");
          await page.waitForTimeout(60);
        }
        await page.keyboard.press("Enter");
        continue;
      }
      // 서브메뉴(스킬/아이템 행이 보임): 첫 행을 고른다.
      const submenu = ui.menu.filter((id) => id.startsWith("actor-skill-") || id.startsWith("actor-item-"));
      if (submenu.length > 0 && !ui.busy) {
        if (await moveCursorTo(page, submenu[0])) await page.keyboard.press("Enter");
        ctx.decisions += 1;
        continue;
      }
      // 루트 커맨드 카드.
      const rootCommands = ui.menu.filter((id) => id.startsWith("actor-command-"));
      if (rootCommands.length > 0 && !ui.busy) {
        if (!ctx.shotCommand) {
          ctx.shotCommand = true;
          const shot = `${run.id}-command.png`;
          await page.screenshot({ path: resolve(out, shot) });
          record.shots.push(shot);
          record.scrollCueAtCommand = ui.scrollCue;
        }
        const usable = rootCommands.filter((id) => id !== "actor-command-back");
        if (usable.length === 0) {
          // "뒤로"만 있다 = 빈 서브메뉴(빈 소지품 등). 닫고 이후 공격으로 강등.
          ctx.preferAttack = true;
          await page.keyboard.press("x");
          continue;
        }
        let pick = pickCommand(ui, run, ctx);
        if (!usable.includes(pick)) pick = "actor-command-attack";
        if (usable.includes(pick)) {
          if (await moveCursorTo(page, pick)) await page.keyboard.press("Enter");
          ctx.decisions += 1;
          continue;
        }
        await page.keyboard.press("Enter");
        continue;
      }
      // 중간 관측샷 — 적이 실제로 행동해 파티 HP/상태 배지가 변한 프레임을 잡는다.
      if (ui.scene && !ctx.shotMid && i > 25) {
        ctx.shotMid = true;
        const shot = `${run.id}-mid.png`;
        await page.screenshot({ path: resolve(out, shot) });
        record.shots.push(shot);
      }
      // charging / 전이 / 메시지 — 텍스트 진행용으로 z 한 번.
      await page.keyboard.press("Enter");
      await page.waitForTimeout(120);
    }
    record.decisions = ctx.decisions;
    record.outcome ??= "timeout-or-stall";
    const endShot = `${run.id}-end.png`;
    await page.screenshot({ path: resolve(out, endShot) });
    record.shots.push(endShot);
    record.finalState = await page.evaluate(() => {
      const s = window.__oprnDebug?.readState?.();
      return s ? { mapId: s.currentMapId, x: s.x, y: s.y, gold: s.gold, battleResult: s.battleResult ?? null } : null;
    });
  } catch (error) {
    record.failure = String(error);
    try { await page.screenshot({ path: resolve(out, `${run.id}-failure.png`) }); } catch { /* noop */ }
  } finally {
    record.durationMs = Date.now() - startedAt;
    await page.close();
  }
  return record;
}

await mkdir(out, { recursive: true });
const server = await startPlayerQaServer();
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const report = { runs: [] };
try {
  const wanted = process.env.QA_RUNS ? new Set(process.env.QA_RUNS.split(",")) : null;
  for (const run of RUNS.filter((r) => !wanted || wanted.has(r.id))) {
    const record = await playRun(browser, server.url, run);
    report.runs.push(record);
    console.log(JSON.stringify({
      id: run.id, outcome: record.outcome, decisions: record.decisions,
      ms: record.durationMs, failure: record.failure ?? null, pageErrors: record.pageErrors,
    }));
  }
} finally {
  await browser.close();
  await server.close();
}
await writeFile(resolve(out, "results.json"), JSON.stringify(report, null, 2));
await writeFile(resolve(out, "SUMMARY.md"), [
  "# battle-play10 — 10판 실플레이 증거",
  "",
  "| 판 | 전략 | 시드 | 결과 | 결정 수 | ms | 페이지 에러 |",
  "|---|---|---|---|---|---|---|",
  ...report.runs.map((r) =>
    `| ${r.id} | ${r.plan} | ${r.seed} | ${r.outcome ?? "미종료"}${r.failure ? ` ⚠ ${r.failure.slice(0, 80)}` : ""} | ${r.decisions ?? "-"} | ${r.durationMs ?? "-"} | ${r.pageErrors.length} |`),
  "",
].join("\n"));
const failed = report.runs.filter((r) => r.failure || r.pageErrors.length > 0 || r.outcome === "timeout-or-stall");
console.log(JSON.stringify({ out, outcomes: report.runs.map((r) => r.outcome), failures: failed.map((r) => r.id) }));
