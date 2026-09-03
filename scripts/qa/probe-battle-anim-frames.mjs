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
/** 이펙트가 끝난 뒤에도 시계를 밀며 연출 표식이 바뀔 때마다 한 장씩 찍는다(넉백·펀치·격파 조각·적 예고·전진).
 *  라운드는 파티 전원이 명령을 넣은 뒤 풀리므로 프롬프트가 보이면 확인키로 「공격」→첫 대상을 고른다. --beats=1 로 켠다. */
const BEATS = arg("beats", "") === "1";
/** --beats 가 관찰하는 시계 시간 상한(ms). 4인 공격 + 적 턴까지 담으려면 12초쯤 필요하다. */
const BEATS_CLOCK_MS = Number(arg("beats-ms", "12000")) || 12000;
/** --beats 한 번에 찍는 최대 장수. 4인 공격 + 적 턴은 60장 안쪽이다. */
const BEATS_MAX_SHOTS = Number(arg("beats-shots", "60")) || 60;
/** --beats 동안 자동으로 넣는 「공격」 명령 횟수. 기본 4 = 파티 전원 한 번씩. 그 뒤엔 손을 놓아야 게이지 흐름에서 적의 턴이 온다. */
const BEATS_CONFIRMS = Number(arg("beats-confirms", "4")) || 4;
/** 적 최대 HP 를 이 배수로 키워 막타 대신 여러 세기의 타격·적의 턴을 본다(예: --enemy-hp=6). */
const ENEMY_HP_SCALE = Number(arg("enemy-hp", "1")) || 1;
/** 적 민첩을 이 배수로 키워 게이지 흐름에서 적의 턴이 먼저/자주 오게 한다(예: --enemy-agi=8). */
const ENEMY_AGI_SCALE = Number(arg("enemy-agi", "1")) || 1;
/** 전투 흐름 강제(system.battleFlow: gauge | strict). strict 는 파티 전원 명령 뒤 라운드가 한 번에 풀려 적의 턴이 바로 온다. */
const FLOW = arg("flow", "");
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
// page.evaluate 로 넘어가는 함수는 브라우저에서 홀로 실행된다 — 다른 상수를 참조하면 ReferenceError(실측).
const IN_TARGET_STEP = () => (document.querySelector("[data-testid='battle-scene']")?.dataset.battleDirectorStep ?? "") === "target";
const NOT_IN_TARGET_STEP = () => (document.querySelector("[data-testid='battle-scene']")?.dataset.battleDirectorStep ?? "") !== "target";

/**
 * 「공격」→ 첫 대상 확정. targetable 속성은 이전 명령의 잔재가 남을 수 있어(실측: 확인키가 대상 메뉴가
 * 붙기 전에 떨어져 라운드가 target 단계에 멈췄다) 디렉터 단계(target 진입 → 이탈)로 기다린다.
 */
async function confirmAttackOnFirstTarget(page) {
  await page.keyboard.press("Enter");
  await advanceUntil(page, IN_TARGET_STEP, "대상 선택 단계", 120);
  await page.clock.runFor(STEP_MS);
  await page.keyboard.press("Enter");
  await advanceUntil(page, NOT_IN_TARGET_STEP, "대상 확정", 120);
}

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

/** 지금 화면에 켜진 연출 표식 — 바뀔 때만 찍어 라운드 전체를 수십 장 안쪽으로 담는다. */
function readBeatMarkers() {
  const scene = document.querySelector("[data-testid='battle-scene']");
  const root = scene ? [...scene.classList].filter((c) => /battle-(field-punch|screen-shake|hit-stop|flash-)/.test(c)) : [];
  const nodes = [...document.querySelectorAll(".battle-enemy, .battle-actor")];
  // 적 testid 에 ':' 가 들어가므로(enemy_x:0) 구분자는 '#'.
  const motion = nodes.flatMap((n) => [...n.classList].filter((c) => /battle-motion-(windup|lunge|knockback|return)|^defeated$/.test(c)).map((c) => `${n.dataset.testid ?? n.dataset.recordId}#${c}`));
  const shards = document.querySelector(".battle-death-shards") ? ["shards"] : [];
  const popup = document.querySelector(".battle-damage-popup") ? ["popup"] : [];
  const followUp = document.querySelector(".battle-animation-followup:not([data-playback-finished='true'])") ? ["followup"] : [];
  const anim = document.querySelector("[data-testid='battle-animation']:not([data-playback-finished='true'])") ? ["fx"] : [];
  const step = scene?.dataset.battleDirectorStep ?? "";
  const intensity = scene?.dataset.hitIntensity ?? "";
  return {
    key: [step, intensity, ...root, ...motion, ...shards, ...popup, ...followUp, ...anim].join("|"),
    label: [step, intensity, ...root.map((c) => c.replace("battle-", "")), ...motion.map((m) => m.slice(m.indexOf("#") + 1).replace("battle-motion-", "")), ...shards, ...popup, ...followUp, ...anim].filter(Boolean).join("+"),
    classes: nodes.map((n) => `${n.dataset.testid ?? n.dataset.recordId}: ${[...n.classList].join(" ")}`),
    done: document.querySelector(".battle-result-panel") !== null,
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
  await advanceUntil(page, IN_TARGET_STEP, "대상 선택");
  await shoot(page, join(outDir, "01-target.png"));
  await page.clock.runFor(STEP_MS);
  await page.keyboard.press("Enter");
  await advanceUntil(page, NOT_IN_TARGET_STEP, "대상 확정", 120);
  // strict 흐름은 파티 전원의 명령이 모여야 라운드가 풀린다 — 프롬프트가 곧바로 돌아오면 남은 아군의
  // 명령도 넣는다. gauge 흐름은 첫 명령이 즉시 애니메이션으로 이어져 이 루프에 들어오지 않는다.
  for (let extra = 0; extra < 3; extra += 1) {
    let prompted = false;
    for (let step = 0; step < 12; step += 1) {
      if (await page.evaluate(HAS_ANIMATION)) break;
      if (await page.evaluate(HAS_ATTACK)) {
        prompted = true;
        break;
      }
      await page.clock.runFor(STEP_MS);
    }
    if (!prompted) break;
    await confirmAttackOnFirstTarget(page);
  }
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

  if (BEATS) {
    let lastKey = "";
    let shots = 0;
    let confirmsLeft = BEATS_CONFIRMS;
    const beatDir = join(outDir, "beats");
    const beatLog = [];
    await mkdir(beatDir, { recursive: true });
    for (let step = 0; step < BEATS_CLOCK_MS / STEP_MS && shots < BEATS_MAX_SHOTS; step += 1) {
      // 프롬프트가 돌아오면 다음 아군의 명령을 넣어 라운드를 굴린다. 횟수를 다 쓰면 손을 놓고 적의 턴을 기다린다.
      if (confirmsLeft > 0 && (await page.evaluate(HAS_ATTACK))) {
        await confirmAttackOnFirstTarget(page).catch((error) => log(`자동 명령 실패: ${error.message}`));
        confirmsLeft -= 1;
      }
      const markers = await page.evaluate(readBeatMarkers);
      if (markers.key !== lastKey) {
        lastKey = markers.key;
        const stamp = String(step * STEP_MS).padStart(5, "0");
        await shoot(page, join(beatDir, `${String(shots).padStart(2, "0")}-${stamp}ms-${markers.label.replace(/[^a-zA-Z0-9+_-]/g, "").slice(0, 70) || "idle"}.png`));
        shots += 1;
        beatLog.push({ ms: step * STEP_MS, label: markers.label, classes: markers.classes });
        log(`${animationId} beat ${stamp}ms ${markers.label || "(none)"}`);
      }
      if (markers.done && step > 8) break;
      await page.clock.runFor(STEP_MS);
    }
    await writeFile(join(beatDir, "beats.json"), JSON.stringify(beatLog, null, 2));
  }

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
if (FLOW) fixture.system.battleFlow = FLOW;
if (ENEMY_HP_SCALE !== 1 || ENEMY_AGI_SCALE !== 1) {
  for (const enemy of fixture.database.enemies) {
    enemy.stats.maxHp = Math.round(enemy.stats.maxHp * ENEMY_HP_SCALE);
    enemy.stats.agility = Math.round(enemy.stats.agility * ENEMY_AGI_SCALE);
  }
}
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
