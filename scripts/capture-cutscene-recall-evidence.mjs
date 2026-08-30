// 회상 컷신 근거 캡처 — 2026-08-30.
//
// 실행 중인 dev 서버에 붙어 (1) AI 패널에 회상 요청이 들어간 상태, (2) 에디터의 컷신 제어 명령
// 편집창, (3) 평상시 플레이 화면, (4) 회상 컷신이 **실제로 도는 동안**의 화면(HUD 억제 적용/미적용)
// 을 찍는다. 포트는 CAP_PORT 로 바꿀 수 있다(기본 9631) — 다른 세션의 dev 서버를 재사용하지 않는다.
//
// playwright 는 이 워크트리의 공유 node_modules 에 없다. 워크트리 로컬 node_modules 는
// phaser 심볼릭 링크 때문에 필요하지만(vite 가 /node_modules/phaser 를 그리로 찾는다),
// playwright 는 본 저장소 것을 절대 경로로 import 한다.
import playwrightPkg from "/home/main/z-project/rpg-zzu/node_modules/playwright/index.js";
import fs from "node:fs";
import path from "node:path";

const { chromium } = playwrightPkg;

const PORT = process.env.CAP_PORT ?? "9631";
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve("reports/shots/cutscene-recall-2026-08-30");
fs.mkdirSync(OUT, { recursive: true });

const log = (...args) => console.log("[cap]", ...args);
const shot = async (page, name, locator) => {
  await (locator ?? page).screenshot({ path: path.join(OUT, `${name}.png`) });
  log("shot", name);
};

/** 컷신 무성 구간(대사 없는 tint/wait 비트)의 길이. 캡처 여유를 위해 길게 잡는다. */
const SILENT_MS = 6000;

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 200)));

/** 플레이 화면은 테스트 플레이 창 안에 있다 — 창만 잘라 찍어야 보고서 이미지가 읽힌다. */
const playWindow = () => page.getByTestId("test-play-window");

/**
 * 제품이 실제로 쓰는 경로(메뉴 → 테스트 플레이 창)로 플레이에 들어간다.
 * `enterMode("play")` 를 직접 부르면 play-stage 는 DOM 에 생기지만 테스트 플레이 창 밖이라
 * 화면에 아무것도 그려지지 않는다(첫 시도에서 검은 화면만 찍혔다).
 */
async function openPlay() {
  await page.evaluate(() => {
    document.querySelectorAll(".coach-mark, .coach-mark-backdrop, [data-testid^='coach-']").forEach((n) => n.remove());
  });
  await page.getByTestId("menu-game").click();
  await page.getByTestId("menu-game-play").click();
  await page.waitForTimeout(400);
  if (!(await playWindow().isVisible().catch(() => false))) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
  }
  await playWindow().waitFor({ timeout: 30_000 });
  if (await page.getByTestId("title-new-game").count()) {
    await page.getByTestId("title-new-game").click().catch(() => {});
  }
  await page.getByTestId("play-stage").waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
}

async function closePlay() {
  await page.getByTestId("test-play-window-close").click().catch(() => {});
  await playWindow().waitFor({ state: "detached", timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);
}

/** HUD 구성원의 존재/표시 상태를 실제 계산된 스타일로 읽는다. */
const measure = (tag) =>
  page.evaluate((label) => {
    const stage = document.querySelector(".play-stage");
    const read = (selector) => {
      const node = stage?.querySelector(selector) ?? document.querySelector(selector);
      if (!node) return { present: false, display: null };
      return { present: true, display: getComputedStyle(node).display };
    };
    return {
      tag: label,
      stageClass: stage?.className ?? null,
      hudHiddenClass: stage?.classList.contains("cutscene-hud-hidden") ?? false,
      minimap: read(".minimap-root"),
      handSlot: read(".hand-slot"),
      timeHud: read(".runtime-time-hud"),
      dialogueChildren: stage?.querySelector(".dialogue-overlay")?.childElementCount ?? 0,
    };
  }, tag);

// ── 1. 에디터 부팅 ────────────────────────────────────────────────────────────
await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForTimeout(9000);
await shot(page, "00-editor-boot");

// ── 2. AI 패널에 회상 요청을 넣은 상태 (결함이 신고된 표면) ─────────────────────
const composer = page.getByTestId("ai-input").first();
if (await composer.count()) {
  await composer.fill("회상 장면 하나 넣어줘. 플레이어는 아무것도 못 하고 보기만 하게.");
  await page.waitForTimeout(500);
  await shot(page, "01-ai-panel-recall-request");
} else {
  log("ai-input 없음 — AI 패널 캡처 생략");
}

// ── 3. 평상시 플레이 화면 (컷신을 심기 전 — HUD 가 떠 있는 기준 컷) ──────────────
// 미니맵을 먼저 켠다. 기본값이 false 라 켜지 않으면 "컷신 중에 숨었다"를 보여줄 대상이 없다.
const minimapOn = await page.evaluate(async () => {
  const { store } = await import("/src/project/store.ts");
  const project = structuredClone(store.getCurrent());
  const mapId = project.startMapId ?? Object.keys(project.maps)[0];
  project.maps[mapId].minimap = { enabled: true, corner: "topRight" };
  store.replaceProject(project, { scope: "project" });
  return { mapId, minimap: project.maps[mapId].minimap };
});
log("minimap:", JSON.stringify(minimapOn));

await openPlay();
// HUD 는 스테이지보다 몇백 ms 늦게 붙는다. 기다리지 않으면 스크린샷에는 미니맵이 찍히는데
// measurements.json 만 present:false 로 남아 근거가 서로 어긋난다.
// `.first()` 가 필요하다 — 에디터와 테스트 플레이 창에 `.play-stage` 가 둘 있어서
// 맨손 locator 는 strict mode 위반으로 터진다(그 예외가 조용히 30초를 잡아먹고 있었다).
await playWindow().locator(".minimap-root").first().waitFor({ timeout: 30_000 }).catch(() => log("경고: 미니맵 미관측"));
const fieldNormal = await measure("field-normal-no-cutscene");
log("measure field-normal:", JSON.stringify(fieldNormal));
await shot(page, "03-field-hud-normal", playWindow());
await closePlay();

// ── 4. 회상 컷신을 시작 맵에 심는다 (script_cutscene 툴을 실제로 실행) ──────────
// trigger: "auto" — 맵에 들어서면 스스로 시작한다(오프닝/회상 관례).
const seeded = await page.evaluate(async (silentMs) => {
  const tools = await import("/src/editor/tools/index.ts");
  const { store } = await import("/src/project/store.ts");
  const project = structuredClone(store.getCurrent());
  const mapId = project.startMapId ?? Object.keys(project.maps)[0];
  const start = project.startPos ?? { x: 5, y: 5 };
  const ctx = { project };
  const result = tools.runTool(ctx, "script_cutscene", {
    mapId,
    eventId: "ev_recall_demo",
    x: start.x,
    y: start.y,
    trigger: "auto",
    skippable: true,
    beats: [
      { kind: "tint", color: "#1a2030", durationMs: 600, wait: true },
      // 대사가 없는 긴 구간 — 옛 동작에서 HUD 가 그대로 떠 있던 바로 그 구간이다.
      // 카메라 팬을 이 뒤로 미룬 이유: 수정 전/후 두 컷을 **카메라가 멈춘 같은 프레임**에서
      // 찍어야 비교 이미지에서 HUD 차이만 남는다(팬 중에 찍으면 배경까지 달라진다).
      { kind: "wait", ms: silentMs },
      { kind: "camera", mode: "pan", x: start.x + 3, y: Math.max(0, start.y - 2), durationMs: 900, wait: true },
      { kind: "say", speaker: "나", text: "그날의 빛이 아직 남아 있다." },
      { kind: "wait", ms: 400 },
      { kind: "say", speaker: "나", text: "돌아갈 수 없다는 것만 분명했다." },
      { kind: "camera", mode: "return", durationMs: 400, wait: true },
    ],
  });
  store.replaceProject(ctx.project, { scope: "project" });
  const event = ctx.project.maps[mapId]?.events?.find((e) => e.id === "ev_recall_demo");
  return {
    mapId,
    at: event ? { x: event.x, y: event.y } : null,
    commandCount: event?.pages?.at(-1)?.commands?.length ?? null,
    commandKinds: (event?.pages?.at(-1)?.commands ?? []).map((c) => c.kind),
    summary: result?.summary ?? null,
    warnings: result?.warnings ?? [],
  };
}, SILENT_MS);
log("seed:", JSON.stringify(seeded));

// ── 5. 컷신 제어 명령 편집창 (수동 저작 표면) ──────────────────────────────────
const dialog = await page.evaluate(async () => {
  try {
    document.querySelectorAll(".event-subdialog-backdrop").forEach((n) => n.remove());
    const mod = await import("/src/editor/panels/eventEditor/commandEditDialog.ts");
    mod.openEventCommandEditDialog({
      initial: { kind: "cutsceneControl", mode: "begin", skippable: true },
      lockKind: true,
      onApply: () => {},
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
log("dialog:", JSON.stringify(dialog));
if (dialog.ok) {
  await page.waitForTimeout(800);
  await shot(page, "02-cutscene-control-command");
  const win = page.locator("section.event-subdialog-window").last();
  // locator 를 넘겨야 창만 잘린다 — 안 넘기면 전체 페이지가 또 한 장 나온다(첫 판이 그랬다).
  if (await win.count()) await shot(page, "02b-cutscene-control-command-only", win);
  await page.evaluate(() => document.querySelectorAll(".event-subdialog-backdrop").forEach((n) => n.remove()));
}

// ── 6. 컷신이 도는 동안 ───────────────────────────────────────────────────────
await openPlay();

// 컷신 잠금이 실제로 걸리는 것을 기다린다 — 우리가 손으로 세우지 않는다.
await page
  .locator(".play-stage.cutscene-hud-hidden")
  .waitFor({ timeout: 60_000 })
  .catch(() => log("경고: 컷신 억제 클래스가 관측되지 않았다"));
await page.waitForTimeout(1200); // tint(600ms) 가 끝나고 무성 wait 구간 안쪽으로 들어갈 때까지

const afterFix = await measure("cutscene-silent-beat-fixed");
log("measure fixed:", JSON.stringify(afterFix));
await shot(page, "04-cutscene-hud-hidden-fixed", playWindow());

// ── 7. 옛 동작 재현: 새 CSS 규칙만 무력화한다 ──────────────────────────────────
// 클래스는 그대로 붙어 있고(런타임은 매 프레임 다시 붙인다) 규칙만 죽인 상태 = 수정 이전.
const overrideHandle = await page.addStyleTag({
  content: `.play-stage.cutscene-hud-hidden .minimap-root,
.play-stage.cutscene-hud-hidden .hand-slot,
.play-stage.cutscene-hud-hidden .action-hud,
.play-stage.cutscene-hud-hidden .runtime-timer-hud,
.play-stage.cutscene-hud-hidden .runtime-time-hud,
.play-stage.cutscene-hud-hidden .touch-pad { display: revert !important; }`,
});
await page.waitForTimeout(500);
const beforeFix = await measure("cutscene-silent-beat-old-behavior");
log("measure old:", JSON.stringify(beforeFix));
await shot(page, "05-cutscene-hud-visible-old-behavior", playWindow());
await overrideHandle.evaluate((node) => node.remove());
await page.waitForTimeout(400);

// ── 8. 대사 비트 (대사가 떠도 HUD 는 계속 숨어 있다) ──────────────────────────
await page
  .getByTestId("dialogue-box")
  .waitFor({ timeout: 30_000 })
  .catch(() => log("경고: 대사 비트를 못 잡았다"));
await page.waitForTimeout(600);
await shot(page, "06-cutscene-say-beat", playWindow());
const sayBeat = await measure("cutscene-say-beat");
log("measure say:", JSON.stringify(sayBeat));

fs.writeFileSync(
  path.join(OUT, "measurements.json"),
  JSON.stringify(
    {
      port: PORT,
      minimapOn,
      seeded,
      dialog,
      silentMs: SILENT_MS,
      pageErrors,
      measurements: [fieldNormal, afterFix, beforeFix, sayBeat],
    },
    null,
    2,
  ),
);
log("wrote measurements.json");
log("pageErrors:", pageErrors.length);

await browser.close();
log("done →", OUT);
