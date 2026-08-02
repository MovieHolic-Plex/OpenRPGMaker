/**
 * 전투 캡처 하네스 — 전투의 처음부터 끝까지를 반복 가능하게 재생하고,
 * 정해진 비트(beat)마다 스크린샷과 상태를 남긴다.
 *
 * 적대적 검증 게이트가 이 산출물을 입력으로 쓴다. 사람이 매번 손으로 전투를
 * 띄워 눈으로 보는 대신, 같은 조건에서 같은 프레임이 나오게 하는 것이 목적이다.
 *
 *   node scripts/battle-harness.mjs
 *   node scripts/battle-harness.mjs --out .omo/battle-runs/run-02 --runs 3
 *   node scripts/battle-harness.mjs --url "https://localhost:9999/?project=..." --manual
 *
 * 옵션
 *   --url <URL>     에디터 주소 (기본: 아래 DEFAULT_URL)
 *   --out <DIR>     산출 디렉터리 (기본: .omo/battle-runs/latest)
 *   --runs <N>      연속 전투 횟수 (기본 1). 적 조합이 랜덤이라 N>1 로 표본을 늘린다.
 *   --manual        자동 전투(A) 대신 키보드로 커맨드를 직접 진행
 *   --speed <N>     대기 배수 (기본 1). 느린 머신에서 2 정도로 올린다.
 *   --headed        브라우저 창을 띄워서 눈으로 보며 실행
 *
 * 산출물
 *   <out>/<run>/NN-<beat>.png     비트별 스크린샷 (battle-scene 영역만)
 *   <out>/<run>/state.json        비트별 DOM/런타임 상태 스냅샷
 *   <out>/manifest.json           전체 실행 요약 + 콘솔 에러
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_URL =
  "https://localhost:9999/?project=rpg-zzu-house-template-gallery"
  + "&name=Scarloxy+%EB%AA%AC%EC%8A%A4%ED%84%B0+%EC%B4%88%EC%9B%90+%EB%8D%B0%EB%AA%A8"
  + "&map=map_scarloxy_ruins";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

const URL_ = String(arg("url", DEFAULT_URL));
const OUT = String(arg("out", ".omo/battle-runs/latest"));
const RUNS = Number(arg("runs", 1)) || 1;
const MANUAL = Boolean(arg("manual", false));
const SPEED = Number(arg("speed", 1)) || 1;
const HEADED = Boolean(arg("headed", false));

const ms = (n) => new Promise((r) => setTimeout(r, n * SPEED));

/** 전투 씬에서 뽑는 상태. 적대적 리뷰가 근거로 삼는 값들이다. */
const READ_STATE = () => {
  const scene = document.querySelector(".battle-scene");
  if (!scene) return { missing: "battle-scene" };
  const q = (sel) => document.querySelector(sel);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      rect: `${Math.round(r.width)}x${Math.round(r.height)}`,
      vis: cs.visibility, op: cs.opacity, display: cs.display,
    };
  };
  const backdrop = q(".battle-backdrop");
  const panel = q(".battle-result-panel");
  return {
    phase: scene.dataset.battlePhase,
    step: scene.dataset.battleDirectorStep,
    skin: scene.dataset.battleSkin,
    uiStyle: scene.dataset.battleUiStyle,
    busy: scene.dataset.battleSequenceBusy,
    message: (q(".battle-message-window")?.textContent || "").replace(/\s+/g, " ").trim(),
    commands: Array.from(document.querySelectorAll("button.battle-command"))
      .map((b) => ({
        label: (b.textContent || "").replace(/\s+/g, " ").trim(),
        disabled: b.disabled || b.getAttribute("aria-disabled") === "true",
        cursor: b.dataset.battleCommandCursor === "true",
        rect: (() => { const r = b.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; })(),
      })),
    enemies: Array.from(document.querySelectorAll(".battle-enemy")).map((e) => ({
      id: e.dataset.battleTargetId,
      text: (e.textContent || "").replace(/\s+/g, " ").trim(),
      pose: e.dataset.battlePose,
      x: e.style.getPropertyValue("--battle-node-x"),
      y: e.style.getPropertyValue("--battle-node-y"),
    })),
    allySprites: document.querySelectorAll(".battle-actor-group .battle-actor, .battle-actor-sprite").length,
    damagePopups: Array.from(document.querySelectorAll(".battle-damage-popup"))
      .map((p) => ({ text: p.textContent, targetId: p.dataset.targetId })),
    animationChildren: q(".battle-animation-layer")?.childElementCount ?? -1,
    backdrop: {
      ...box(backdrop),
      hasImageUrl: backdrop ? /url\(/.test(getComputedStyle(backdrop).backgroundImage) : null,
      inlineHasUrl: backdrop ? /url\(/.test(backdrop.style.backgroundImage) : null,
    },
    party: box(q(".battle-party")),
    field: box(q(".battle-field")),
    result: panel
      ? {
          revealStage: panel.dataset.resultRevealStage,
          rewardRows: panel.querySelectorAll(".battle-result-reward-row").length,
          hiddenRows: panel.querySelectorAll(".battle-result-reward-row[hidden]").length,
          text: (panel.textContent || "").replace(/\s+/g, " ").trim(),
        }
      : null,
  };
};

async function captureRun(page, runDir, errors) {
  await mkdir(runDir, { recursive: true });
  const beats = [];
  let n = 0;

  const shoot = async (beat) => {
    const state = await page.evaluate(READ_STATE);
    const file = `${String(n).padStart(2, "0")}-${beat}.png`;
    try {
      await page.locator(".battle-scene").screenshot({ path: path.join(runDir, file), timeout: 4000 });
    } catch {
      // 씬이 이미 내려갔으면 프레임 없이 상태만 남긴다.
    }
    beats.push({ n, beat, file, state });
    n += 1;
    return state;
  };

  await shoot("encounter");           // 전투 시작 직후 — 등장 연출
  await shoot("command-menu");        // 커맨드 창

  if (MANUAL) {
    await page.keyboard.press("Enter");   // 첫 커맨드 확정
    await ms(900);
    await shoot("target-select");
    await page.keyboard.press("Enter");   // 타깃 확정
    await ms(700);
    await shoot("action-start");
  } else {
    await page.keyboard.press("a");       // 자동 전투
    await ms(600);
    await shoot("auto-engaged");
  }

  // 액션 도중 — 애니메이션/데미지 팝업이 살아있는 순간을 노려 여러 장
  for (let i = 0; i < 6; i++) {
    const s = await page.evaluate(READ_STATE);
    if (s.damagePopups?.length || s.animationChildren > 0) {
      await shoot(`impact-${i}`);
      break;
    }
    await ms(220);
  }
  await shoot("mid-action");

  // 결과까지 대기
  let reached = false;
  for (let i = 0; i < 60; i++) {
    const s = await page.evaluate(READ_STATE);
    if (s.result) { reached = true; break; }
    await ms(320);
  }
  if (reached) {
    await shoot("result-open");
    await ms(1400);
    await shoot("result-revealed");
    await ms(1600);
    await shoot("result-settled");
  } else {
    await shoot("timeout-no-result");
  }

  await writeFile(path.join(runDir, "state.json"), JSON.stringify(beats, null, 2), "utf8");
  return { beats: beats.map(({ n, beat, file, state }) => ({ n, beat, file, phase: state.phase, step: state.step })), reachedResult: reached };
}

async function openBattle(page) {
  await page.locator("[aria-label='랜덤 전투 테스트']").first().click({ timeout: 30000 });
  await page.waitForSelector(".battle-scene", { timeout: 30000 });
  await ms(3500);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (t.includes("ERR_CONNECTION_REFUSED")) return;   // 로컬 보조 서비스 잡음
    errors.push(t.slice(0, 300));
  });

  await page.goto(URL_, { waitUntil: "domcontentloaded", timeout: 90000 });
  await ms(9000);

  const runs = [];
  for (let r = 0; r < RUNS; r++) {
    const runDir = path.join(OUT, `run-${String(r + 1).padStart(2, "0")}`);
    await openBattle(page);
    const summary = await captureRun(page, runDir, errors);
    runs.push({ run: r + 1, dir: runDir, ...summary });
    console.log(`  run-${r + 1}: 비트 ${summary.beats.length}개, 결과도달=${summary.reachedResult}`);
    // 다음 전투를 위해 결과 화면을 닫는다.
    await page.keyboard.press("Enter");
    await ms(2500);
  }

  const manifest = { url: URL_, runs, errors: [...new Set(errors)], capturedAt: new Date().toISOString() };
  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`  산출: ${OUT}/manifest.json`);
  if (errors.length) console.log(`  콘솔 에러 ${new Set(errors).size}종`);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
