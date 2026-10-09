// OPRN-OUT-013 — 출하 플레이어(Test Play) 도착·실패 증거.
//
// 왜 유닛 테스트로 충분하지 않은가: 씬 하네스는 프레임 디스패처를 진짜로 돌리지만
// **출하 경로**(player.html + exportProjectStoreShim)를 타지 않는다. 저장소 하드 룰상
// 게임 화면 QA 는 전용 하네스로 한다(AGENTS.md).
//
// 조작은 키보드만. 런타임 훅(`__oprnDebug.readState`)은 **관찰**에만 쓴다.
// Usage: npx tsx scripts/prepare-coordinate-move-qa.mts && node scripts/qa-coordinate-move.mjs
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { startPlayerQaServer, runRuntimeQa } from "./lib/runtimeQaRun.mjs";

const id = "coordinate-move";
const out = `verify-shots/runtime-qa/${id}`;
const fixture = ".omo/evidence/oprn-013/runtime-project.json";

// 저작 계약: coordinateDestination.MOVEMENT_RESULT_CODES.
const CODE = { arrived: 0, invalidInput: 1, missingTarget: 2, outOfBounds: 3, blocked: 4, unreachable: 5, interrupted: 6 };

const server = await startPlayerQaServer();
const browser = await chromium.launch({
  headless: process.env.RUNTIME_QA_HEADED !== "1",
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebRTC"],
});
const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await context.newPage();
const errors = [];
const checks = [];
const observations = {};
const expectedWarnings = [];

const state = () => page.evaluate(() => window.__oprnDebug.readState());
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

async function line(text) {
  await page.waitForFunction(
    (t) => document.querySelector('[data-testid="dialogue-box"].page-ready .body')?.textContent.includes(t),
    text,
    { timeout: 30_000 },
  );
  checks.push(text);
  console.log(text);
}

/** 다음 대사가 뜨기 전까지 좌표를 표본한다 — 「걸어갔다」와 「순간이동했다」를 구별한다. */
async function samplePositions() {
  await page.evaluate(() => {
    window.__qaPositions = [];
    window.__qaTimer = setInterval(() => {
      const s = window.__oprnDebug.readState();
      window.__qaPositions.push({ x: s.x, y: s.y });
    }, 40);
  });
}
async function takePositions() {
  return page.evaluate(() => {
    clearInterval(window.__qaTimer);
    return window.__qaPositions;
  });
}

try {
  await fs.mkdir(out, { recursive: true });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // 이 계약은 실패를 **일부러** 만들므로 런타임의 실패 경고는 증거이지 오류가 아니다.
    // 버리지 않고 따로 모아 report.json 에 남긴다 — 실패 진단이 실제로 나왔는지도 증거다.
    const text = m.text();
    if (m.type() === "warning" && /\[player\] pathfind|\[m2\] Pathfind Move|GPU stall/.test(text)) {
      expectedWarnings.push(text);
      return;
    }
    if (["error", "warning"].includes(m.type())) errors.push(text);
  });

  const boot = await runRuntimeQa(page, {
    id,
    projectFixture: fixture,
    beats: [{ id: "title", expect: { visibleText: { "title-screen": "Coordinate move contract" } }, shot: true }],
  }, { serverUrl: server.url });
  assert.deepEqual(boot.errors, []);
  assert.deepEqual(boot.beats[0].failures, []);

  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !!window.__oprnDebug?.readState().currentMapId, null, { timeout: 120_000 });

  // ── 1) 변수 좌표로 실제 보행 → 도착 ─────────────────────────────────────────
  await line("STAGE 1 VARIABLE");
  const start = await state();
  await samplePositions();
  await page.keyboard.press("Enter");
  await line("STAGE 1 ARRIVED");
  observations.stage1Positions = await takePositions();
  {
    const s = await state();
    assert.equal(s.x, 6, "변수 X 가 목적지가 되어야 한다");
    assert.equal(s.y, 5, "변수 Y 가 목적지가 되어야 한다");
    assert.equal(s.variables.cm_result, CODE.arrived, "결과 변수는 도착(0)");
    assert.equal(s.switches.cm_arrived, true, "도착 스위치가 켜져야 한다");
    const walked = observations.stage1Positions.filter(
      (p) => !(p.x === start.x && p.y === start.y) && !(p.x === 6 && p.y === 5),
    );
    assert(walked.length > 0, "중간 칸을 지나며 걸어야 한다 — 순간이동이 아니다");
    checks.push(`stage1 arrived by walking (${observations.stage1Positions.length} samples)`);
  }
  await shot("01-variable-arrival");

  // ── 2) 맵 밖 변수 값 → outOfBounds(3), (0,0) 아님, 대기 풀림 ─────────────────
  await page.keyboard.press("Enter");
  await line("STAGE 2 OUT OF BOUNDS");
  await page.keyboard.press("Enter");
  await line("STAGE 2 CONTINUED");
  {
    const s = await state();
    assert.equal(s.variables.cm_result, CODE.outOfBounds, "맵 밖은 outOfBounds(3)");
    assert.equal(s.switches.cm_arrived, false, "도착 스위치는 꺼져야 한다");
    assert.deepEqual({ x: s.x, y: s.y }, { x: 6, y: 5 }, "무효한 목적지는 (0,0) 으로 데려가지 않는다");
    checks.push("stage2 outOfBounds without (0,0) landing; waiting command terminated");
  }
  await shot("02-out-of-bounds");

  // ── 3) 길이 없는 목적지 → 대기 풀림 + 실패 결과 ────────────────────────────
  await page.keyboard.press("Enter");
  await line("STAGE 3 WALLED");
  await page.keyboard.press("Enter");
  await line("STAGE 3 CONTINUED");
  {
    const s = await state();
    observations.stage3Result = s.variables.cm_result;
    assert(
      [CODE.blocked, CODE.unreachable].includes(s.variables.cm_result),
      `막힌 목적지는 blocked(4)/unreachable(5) 여야 한다 — 실제 ${s.variables.cm_result}`,
    );
    assert.equal(s.switches.cm_arrived, false);
    assert.deepEqual({ x: s.x, y: s.y }, { x: 6, y: 5 }, "갈 수 없으면 제자리다");
    checks.push(`stage3 blocked/unreachable = ${s.variables.cm_result}; waiting command terminated`);
  }
  await shot("03-walled");

  // ── 4) 없는 변수 + 「실패하면 중단」 → invalidInput(1), 뒤 명령 안 돔 ────────
  await page.keyboard.press("Enter");
  await line("STAGE 4 MISSING VARIABLE");
  await page.keyboard.press("Enter");
  // 「중단」이면 뒤 대사가 아예 안 뜬다 — 그것을 **없음**으로 단정한다.
  await page.waitForFunction(
    () => window.__oprnDebug.readState().variables.cm_result === 1,
    null,
    { timeout: 20_000 },
  );
  {
    const s = await state();
    assert.equal(s.variables.cm_result, CODE.invalidInput, "없는 변수는 invalidInput(1)");
    assert.equal(s.switches.cm_stage_done, true, "중단 전 명령은 실행됐다");
    assert.notEqual(s.switches.cm_after_stop, true, "「실패하면 중단」 뒤 명령은 실행되지 않는다");
    const leaked = await page.evaluate(() =>
      document.querySelector('[data-testid="dialogue-box"] .body')?.textContent ?? "");
    assert(!leaked.includes("SHOULD NOT APPEAR"), "중단 뒤 대사가 떴다");
    checks.push("stage4 invalidInput stopped the event; trailing command never ran");
  }
  await shot("04-stop-on-failure");

  // 이벤트가 끝난 뒤에도 키보드 조작이 살아 있다(대기가 입력을 붙잡고 있지 않다).
  const before = await state();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction((y) => window.__oprnDebug.readState().y === y + 1, before.y, { timeout: 10_000 });
  checks.push("keyboard movement restored after the stopped event");
  await shot("05-input-restored");

  assert(
    expectedWarnings.some((text) => text.includes("좌표 값 오류")),
    "무효한 변수의 실패 진단이 콘솔에 남아야 한다",
  );
  checks.push(`expected runtime diagnostics observed (${expectedWarnings.length})`);
  assert.deepEqual(errors, []);
} catch (e) {
  errors.push(e.stack || e.message);
  process.exitCode = 1;
  await shot("failure").catch(() => {});
  console.error(e.message);
} finally {
  const finalState = await state().catch(() => null);
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/report.json`, JSON.stringify({ checks, errors, expectedWarnings, observations, finalState }, null, 2));
  await fs.writeFile(`${out}/SUMMARY.md`,
    `# Coordinate destination movement — shipping-player QA (OPRN-OUT-013)\n\n` +
    `Result: ${errors.length ? "FAIL" : "PASS"}\n\n` +
    `Keyboard input only; \`__oprnDebug.readState\` used for observation. Test-only fixture,\n` +
    `no authored content and no remote persistence.\n\n` +
    `Checks: ${checks.join("; ")}\n\n` +
    `즉시 확인: ${errors.length ? "failure.png" : "01-variable-arrival.png, 02-out-of-bounds.png, 03-walled.png, 04-stop-on-failure.png"}\n\n` +
    `${errors.join("\n")}\n`);
  await context.close();
  await browser.close();
  await server.close();
}
