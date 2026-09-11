// 10판 실플레이 프로브 — 출하 플레이어(player.html)로 전투를 처음부터 끝까지 10번 돌린다.
// 각 판은 독립 페이지(새 브라우저 컨텍스트)로 부팅하고, 시드와 전략을 바꿔가며
// 공격/방어/스킬/도주/취소/빈 아이템/저HP 패배 경로를 실제 키보드 입력으로 밟는다.
//
// 왜 마우스 클릭이 아니라 키보드인가: 전투 커맨드 버튼은 포커스가 있어도 Enter 네이티브
// click 을 발행하지 않고(battleDom.ts 실측 주석), 커서는 data-battle-command-cursor 로
// 추적되는 가상 커서다. 시나리오 파일들이 쓰는 ArrowDown + z 경로가 유일하게 증명된 경로다.
//
//   node scripts/qa/runtime/battle-play10.probe.mjs
//
// 결과: verify-shots/runtime-qa/battle-play10/ 에 판별 스크린샷 + results.json + SUMMARY.md.
// 이 프로브는 게이트가 아니라 적대적 리뷰용 증거 수집기다 — 실패해도 판 데이터를 남긴다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/battle-play10");
const project = JSON.parse(
  await readFile(new URL("../../../test/fixtures/projects/editor-authored-demo-v3.json", import.meta.url), "utf8"),
);

// 판별 전략. plan 은 "커맨드 단계에서 무엇을 고를지"의 규칙이다.
const RUNS = [
  { id: "run-01-attack", seed: 11, plan: "attack" },
  { id: "run-02-attack", seed: 222, plan: "attack" },
  { id: "run-03-defend2", seed: 33, plan: "defendFirst2" },
  { id: "run-04-skill", seed: 44, plan: "skill" },
  { id: "run-05-last-target", seed: 55, plan: "lastTarget" },
  { id: "run-06-escape", seed: 66, plan: "escape" },
  { id: "run-07-lowhp", seed: 77, plan: "attack", vitals: { hp: 8 } },
  { id: "run-08-skill-mix", seed: 88, plan: "skillMix" },
  { id: "run-09-cancel-spam", seed: 99, plan: "cancelOnce" },
  { id: "run-10-item-empty", seed: 110, plan: "item" },
  // 전원 방어만 고르고 HP 를 낮춰 둔다 — 적 행동(독침/수면 안개의 턴 조건 패턴)과
  // 패배→게임오버 경로, 방어 지속 의미론을 강제로 관측하기 위한 판.
  { id: "run-11-defend-all", seed: 121, plan: "defendAll", vitals: { hp: 120 } },
];

const RUN_DEADLINE_MS = 180_000;
const LOOP_MAX = 800;

async function readUi(page) {
  return await page.evaluate(() => {
    const scene = document.querySelector('[data-testid="battle-scene"]');
    // 전투 메뉴의 선택지 버튼(커맨드·스킬·아이템·대상·뒤로 전부 .battle-command).
    const buttons = [...document.querySelectorAll("button.battle-command")]
      .filter((n) => !n.disabled && n.dataset.previewOnly !== "true");
    const cursor = buttons.findIndex((n) => n.dataset.battleCommandCursor === "true");
    const state = window.__oprnDebug?.readState?.() ?? null;
    return {
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
    default:
      return "actor-command-attack";
  }
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
      window.__OPENRPG_BOOT__ = {
        projectUrl: "/__battle-play10/project.json",
        saveNamespace: "battle-play10-qa",
        qaInstrumentation: true,
      };
    });
    await page.route("**/__battle-play10/project.json", (route) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
    // e2eVitals=1 이어야 __oprnSetActorVitals 훅이 설치된다(playSceneTestHooks.ts:339).
    await page.goto(`${serverUrl}/player.html?e2eVitals=1`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 60_000 });
    await page.evaluate((seed) => window.__oprnDebug.setSeed(seed), run.seed);
    if (run.vitals) {
      await page.evaluate((hp) => {
        for (const id of window.__oprnDebug.readState().partyActorIds) window.__oprnSetActorVitals(id, hp, 999);
      }, run.vitals.hp);
    }
    await page.evaluate(() => window.__oprnDebug.teleport("map_moonwell_forest", 14, 3));
    await page.waitForFunction(
      () => {
        const s = window.__oprnDebug.readState();
        return s.currentMapId === "map_moonwell_forest" && s.x === 14 && s.y === 3;
      }, undefined, { timeout: 15_000 });
    await page.evaluate(() => { window.__oprnInput.face("up"); window.__oprnInput.action(); });

    const ctx = { decisions: 0, cancels: 0, shotCommand: false, shotTarget: false, shotResult: false, sawScene: false };
    for (let i = 0; i < LOOP_MAX && Date.now() - startedAt < RUN_DEADLINE_MS; i++) {
      const ui = await readUi(page);
      if (ui.gameOver) {
        record.outcome = "gameover";
        break;
      }
      if (ui.scene) ctx.sawScene = true;
      // 씬을 한 번 본 뒤에만 "사라짐 = 종료"로 읽는다 — 대사 중 필드 프레임을 종료로 오독하지 않게.
      if (ctx.sawScene && !ui.scene && !ui.title) {
        record.outcome = record.resultAtPanel ?? ui.battleResult ?? "field";
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
        await page.keyboard.press("z");
        continue;
      }
      if (ui.dialogue) {
        await page.keyboard.press("z");
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
        await page.keyboard.press("z");
        continue;
      }
      // 서브메뉴(스킬/아이템 행이 보임): 첫 행을 고른다.
      const submenu = ui.menu.filter((id) => id.startsWith("actor-skill-") || id.startsWith("actor-item-"));
      if (submenu.length > 0 && !ui.busy) {
        if (await moveCursorTo(page, submenu[0])) await page.keyboard.press("z");
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
          if (await moveCursorTo(page, pick)) await page.keyboard.press("z");
          ctx.decisions += 1;
          continue;
        }
        await page.keyboard.press("z");
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
      await page.keyboard.press("z");
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
