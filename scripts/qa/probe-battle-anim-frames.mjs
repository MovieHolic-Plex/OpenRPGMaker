// 전투 이펙트 프레임 캡처 프로브 — 실제 전투 화면(DOM+CSS)에서 애니메이션을 한 프레임씩 찍는다.
//
//   node scripts/qa/probe-battle-anim-frames.mjs --anims=anim_gen_fire_burst,anim_gen_slash_steel \
//        --label=before [--troop=troop_slime_pair] [--out=verify-shots/battle-anim-overhaul] [--skin=ff]
//   --skin 은 system.battleUiStyle 을 덮는다. 아군 48px 시트 스프라이트는 sideview 스킨(ff·octopath·bravely·
//   goldensun)에서만 필드에 서므로, 영웅 배틀러를 보려면 --skin=ff 로 찍고 party-zoom.png(3배 확대)을 본다.
//
// 왜 가짜 시계인가: 이펙트는 75ms 간격 setInterval 로 프레임을 넘기고 스크린샷 한 장은 그보다
// 오래 걸린다. 실시간으로 찍으면 프레임을 건너뛰고, 배속 노브는 1.0 아래로 내려가지 않는다.
// `page.clock` 으로 타이머·rAF 를 손으로 밀면 프레임마다 정확히 한 장씩 결정적으로 찍힌다.
// (CSS 애니메이션 — 플래시·흔들림 — 은 문서 타임라인이라 시계에 안 잡힌다. 셀 그림만 본다.)
//
// 하네스는 qa-back-battler.html(`src/qa/backBattlerHarness.ts`) 을 그대로 쓴다 — 맵 주행 없이
// `mountBattleScene()` 직접 호출. 산출물: <out>/<label>/<anim>/frame-NN.png(이펙트 주변 크롭),
// scene-NN.png(전체 화면, 충격 프레임 근처 2장), frames.png(크롭 이어붙인 콘택트 시트), metrics.json.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIXTURE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");

function arg(name, fallback) {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const ANIMS = arg("anims", "anim_gen_fire_burst").split(",").map((s) => s.trim()).filter(Boolean);
const LABEL = arg("label", "probe");
const TROOP = arg("troop", "troop_slime_pair");
/** 전투 스킨 id(system.battleUiStyle). 비우면 픽스처 기본(rm2003). 아군 스프라이트를 보려면 sideview 스킨(ff 등). */
const SKIN = arg("skin", "");
const OUT_ROOT = join(REPO_ROOT, arg("out", "verify-shots/battle-anim-overhaul"), LABEL);
const VIEWPORT = { width: 1280, height: 960 };
const STEP_MS = 25;
const MAX_STEPS = 400;

const log = (msg) => console.log(`${new Date().toISOString()} [anim-probe] ${msg}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 가짜 시계를 STEP_MS 씩 밀면서 조건이 참이 될 때까지 기다린다. 실시간 폴링이 아니다. */
async function advanceUntil(page, predicate, what, maxSteps = MAX_STEPS) {
  for (let step = 0; step < maxSteps; step += 1) {
    if (await page.evaluate(predicate)) return;
    await page.clock.runFor(STEP_MS);
  }
  throw new Error(`시계를 ${maxSteps * STEP_MS}ms 밀어도 ${what} 가 나오지 않았다`);
}

const HAS_ATTACK = () => document.querySelector("[data-testid='actor-command-attack']") !== null;
const HAS_TARGETABLE = () => document.querySelector(".battle-enemy[data-battle-targetable='true']") !== null;
const HAS_ANIMATION = () => document.querySelector("[data-testid='battle-animation']") !== null;

function readAnimationState() {
  const anim = document.querySelector("[data-testid='battle-animation']");
  if (!anim) return null;
  const cells = [...anim.querySelectorAll(".battle-animation-cell")];
  const visibleCell = cells.find((cell) => !cell.closest(".battle-animation-frame")?.hidden) ?? cells[0];
  const targetId = anim.dataset.animationTargetId;
  // battleFieldDom.findBattlerNode 와 같은 순서로 대상 노드를 찾는다.
  const targetNode = targetId
    ? (document.querySelector(`[data-testid="${targetId}"]`)
      ?? document.querySelector(`[data-testid="battle-actor-${targetId}"]`)
      ?? document.querySelector(`.battle-enemy[data-record-id="${targetId}"]`))
    : null;
  const sprite = targetNode?.querySelector(".battle-enemy-image, .battle-actor-sprite, .battle-actor-image") ?? null;
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };
  const scene = document.querySelector("[data-testid='battle-scene']");
  return {
    frame: Number(anim.dataset.currentFrame),
    frameCount: Number(anim.dataset.animationFrameCount),
    finished: anim.dataset.playbackFinished === "true",
    rendered: cells.filter((c) => c.dataset.rendered === "true").length,
    cellCount: cells.length,
    anchor: anim.dataset.animationAnchor ?? null,
    anchorWhy: anim.dataset.animationAnchorWhy ?? null,
    animRect: rect(anim),
    cellRect: rect(visibleCell),
    cellSource: visibleCell ? { width: visibleCell.width, height: visibleCell.height } : null,
    cellRendering: visibleCell ? getComputedStyle(visibleCell).imageRendering : null,
    spriteRect: rect(sprite),
    spriteNatural: sprite instanceof HTMLImageElement ? { width: sprite.naturalWidth, height: sprite.naturalHeight } : null,
    stageScale: scene?.dataset.battleStageScale ?? null,
    resourceId: anim.dataset.animationResourceId ?? null,
  };
}

function union(a, b, pad) {
  const boxes = [a, b].filter(Boolean);
  const left = Math.min(...boxes.map((r) => r.left)) - pad;
  const top = Math.min(...boxes.map((r) => r.top)) - pad;
  const right = Math.max(...boxes.map((r) => r.left + r.width)) + pad;
  const bottom = Math.max(...boxes.map((r) => r.top + r.height)) + pad;
  return {
    x: Math.max(0, Math.floor(left)),
    y: Math.max(0, Math.floor(top)),
    width: Math.min(VIEWPORT.width, Math.ceil(right)) - Math.max(0, Math.floor(left)),
    height: Math.min(VIEWPORT.height, Math.ceil(bottom)) - Math.max(0, Math.floor(top)),
  };
}

/**
 * CDP 로 직접 찍는다. `page.screenshot` 은 내부에서 rAF 를 기다리는데 그 rAF 가 가짜 시계에
 * 잡혀 있어 시계가 한 프레임만큼 더 밀리고 셀 프레임이 건너뛰어졌다(실측: 10장 중 6번이 빠짐).
 * CDP `Page.captureScreenshot` 은 페이지 스크립트를 건드리지 않는다.
 */
async function shoot(page, path, clip) {
  const cdp = page.__cdp ?? (page.__cdp = await page.context().newCDPSession(page));
  const params = { format: "png", fromSurface: true };
  if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 };
  const { data } = await cdp.send("Page.captureScreenshot", params);
  await writeFile(path, Buffer.from(data, "base64"));
}

async function contactSheet(paths, outPath) {
  const images = await Promise.all(
    paths.map(async (p) => PNG.sync.read(await readFile(p)))
  );
  const gap = 4;
  const width = images.reduce((sum, img) => sum + img.width, 0) + gap * (images.length - 1);
  const height = Math.max(...images.map((img) => img.height));
  const sheet = new PNG({ width, height });
  sheet.data.fill(0);
  let x = 0;
  for (const img of images) {
    for (let y = 0; y < img.height; y += 1) {
      img.data.copy(sheet.data, (y * width + x) * 4, y * img.width * 4, (y + 1) * img.width * 4);
    }
    x += img.width + gap;
  }
  await writeFile(outPath, PNG.sync.write(sheet));
}

/** 아군 스프라이트 무리를 3배로 확대해 찍는다 — 시트 해상도 차이는 무대 배율 1.5 에서 눈으로 안 보인다. */
async function shootParty(page, path) {
  const rect = await page.evaluate(() => {
    const group = document.querySelector(".battle-actor-group");
    if (!group) return null;
    const boxes = [...group.querySelectorAll(".battle-actor-sprite, .battle-actor-image")].map((n) => n.getBoundingClientRect());
    if (boxes.length === 0) return null;
    const left = Math.min(...boxes.map((b) => b.left));
    const top = Math.min(...boxes.map((b) => b.top));
    const right = Math.max(...boxes.map((b) => b.right));
    const bottom = Math.max(...boxes.map((b) => b.bottom));
    return { x: left - 8, y: top - 8, width: right - left + 16, height: bottom - top + 16 };
  });
  if (!rect) return false;
  const cdp = page.__cdp ?? (page.__cdp = await page.context().newCDPSession(page));
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    clip: { x: Math.max(0, rect.x), y: Math.max(0, rect.y), width: rect.width, height: rect.height, scale: 3 },
  });
  await writeFile(path, Buffer.from(data, "base64"));
  return true;
}

async function captureAnimation(page, projectJson, animationId) {
  const outDir = join(OUT_ROOT, animationId);
  await mkdir(outDir, { recursive: true });

  await page.goto(`${page.__baseUrl}/qa-back-battler.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__qaBattle?.ready === true, null, { timeout: 120_000 });
  // 마운트 **전에** 시계를 잡는다 — 전투가 만드는 타이머·rAF 가 전부 가짜 시계로 간다.
  await page.clock.install();
  // install 만 하면 시계가 실시간으로 계속 간다(Playwright 기본). 멈춰 두고 runFor 로만 민다.
  await page.clock.pauseAt(Date.now());
  const mounted = await page.evaluate(
    ([json, troop, anim]) =>
      window.__qaBattle.mount({ projectJson: json, troopId: troop, ensureBundledAnimations: true, attackAnimationId: anim }),
    [projectJson, TROOP, animationId],
  );
  if (!mounted.ok) throw new Error(`mount 실패(${animationId}): ${mounted.error}`);

  await advanceUntil(page, HAS_ATTACK, "공격 명령");
  // 배틀러 그림이 실제로 도착한 뒤에 찍는다(실시간 네트워크는 시계와 무관).
  await page.waitForFunction(
    () => [...document.querySelectorAll(".battle-enemy-image")].every((img) => img.complete && img.naturalWidth > 0),
    null,
    { timeout: 30_000, polling: 100 },
  );
  await shoot(page, join(outDir, "00-command.png"));
  if (await shootParty(page, join(outDir, "party-zoom.png"))) log(`${animationId} party-zoom.png (아군 스프라이트 3배)`);

  // 클릭은 명령 그리드의 히트테스트에 가로막힌다(실측). 커서가 「공격」에 있으니 확인키로 고른다.
  await page.keyboard.press("Enter");
  await advanceUntil(page, HAS_TARGETABLE, "대상 선택");
  await shoot(page, join(outDir, "01-target.png"));
  await page.keyboard.press("Enter");
  await advanceUntil(page, HAS_ANIMATION, "애니메이션 엘리먼트");

  // 시트 이미지 디코드는 실시간이다. 셀 캔버스가 전부 그려질 때까지 실시간으로 기다린다.
  for (let tries = 0; tries < 60; tries += 1) {
    const state = await page.evaluate(readAnimationState);
    if (state && state.cellCount > 0 && state.rendered === state.cellCount) break;
    await sleep(50);
  }
  // 앵커 재측정은 rAF(가짜) 라 살짝 밀어서 승격시킨다.
  await page.clock.runFor(1);

  const frames = [];
  const clips = [];
  let lastFrame = -1;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const state = await page.evaluate(readAnimationState);
    if (!state || state.finished) break;
    if (state.frame !== lastFrame) {
      lastFrame = state.frame;
      const clip = union(state.animRect, state.spriteRect, 24);
      const clipPath = join(outDir, `frame-${String(state.frame).padStart(2, "0")}.png`);
      await shoot(page, clipPath, clip);
      clips.push(clipPath);
      if (state.frame === Math.floor(state.frameCount / 2) || state.frame === Math.floor(state.frameCount * 0.35)) {
        await shoot(page, join(outDir, `scene-${String(state.frame).padStart(2, "0")}.png`));
      }
      frames.push(state);
      log(`${animationId} frame ${state.frame}/${state.frameCount} anchor=${state.anchor} cell=${state.cellRect?.width}x${state.cellRect?.height} rendering=${state.cellRendering}`);
    }
    await page.clock.runFor(STEP_MS);
  }
  if (clips.length > 0) await contactSheet(clips, join(outDir, "frames.png"));

  const first = frames[0];
  const metrics = first
    ? {
        animationId,
        resourceId: first.resourceId,
        frameCount: first.frameCount,
        capturedFrames: frames.length,
        stageScale: first.stageScale,
        anchor: first.anchor,
        anchorWhy: first.anchorWhy,
        cellRendering: first.cellRendering,
        // 밀도 = 원본 px / 화면 CSS px. 1 이면 화면 픽셀과 1:1, 0.25 면 한 원본 픽셀이 4 픽셀 굵기.
        effect: first.cellSource && first.cellRect
          ? { sourcePx: first.cellSource, screenCssPx: first.cellRect, density: first.cellSource.width / first.cellRect.width }
          : null,
        monster: first.spriteNatural && first.spriteRect
          ? { sourcePx: first.spriteNatural, screenCssPx: first.spriteRect, density: first.spriteNatural.width / first.spriteRect.width }
          : null,
      }
    : { animationId, capturedFrames: 0, error: "애니메이션 프레임을 하나도 못 읽었다" };
  await writeFile(join(outDir, "metrics.json"), JSON.stringify(metrics, null, 2));
  return metrics;
}

const fixture = JSON.parse(await readFile(FIXTURE, "utf8"));
if (SKIN) fixture.system.battleUiStyle = SKIN;
const projectJson = JSON.stringify(fixture);
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: VIEWPORT });
page.__baseUrl = server.url;
page.on("pageerror", (error) => log(`pageerror: ${error.message}`));

const summary = [];
try {
  for (const anim of ANIMS) {
    try {
      summary.push(await captureAnimation(page, projectJson, anim));
    } catch (error) {
      log(`${anim} 실패: ${error.message}`);
      summary.push({ animationId: anim, error: error.message });
    }
  }
} finally {
  await mkdir(OUT_ROOT, { recursive: true });
  await writeFile(join(OUT_ROOT, "summary.json"), JSON.stringify(summary, null, 2));
  await browser.close();
  await server.close();
}
for (const entry of summary) {
  if (entry.error) {
    console.log(`  ✗ ${entry.animationId}: ${entry.error}`);
    continue;
  }
  const e = entry.effect ? `effect ${entry.effect.sourcePx.width}px→${Math.round(entry.effect.screenCssPx.width)}css (density ${entry.effect.density.toFixed(2)})` : "effect ?";
  const m = entry.monster ? `monster ${entry.monster.sourcePx.width}px→${Math.round(entry.monster.screenCssPx.width)}css (density ${entry.monster.density.toFixed(2)})` : "monster ?";
  console.log(`  ✓ ${entry.animationId}: ${entry.capturedFrames}/${entry.frameCount} frames, ${e}, ${m}, rendering=${entry.cellRendering}`);
}
console.log(`\n[done] ${OUT_ROOT}`);
