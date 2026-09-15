// 구름 그림자 비전 QA — 출하 player.html 을 띄워 «정말 그려지고, 정말 흘러가는가» 를 판정한다.
//
//   node scripts/qa/runtime/cloud-shadows.probe.mjs
//
// 판정 축 세 개(하나라도 실패하면 exit 1):
//   1. 배선 — 맵 설정이 레이어로 도달했는가(__oprnCloudShadows: 켜짐·덩어리 수·깊이·알파·텍스처).
//   2. 흐름 — 스프라이트 월드 좌표의 중앙값 변위가 설정한 방향·속도와 일치하는가.
//   3. 렌더 — 같은 화면을 두 시각에 찍어 «달라진 픽셀» 이 있는가. 그리고 그 변화가
//      구름을 끈 대조 실행의 변화보다 확실히 큰가(다른 애니메이션과 구분).
//
// 대조군이 픽셀 판정의 핵심이다: 구름을 끈 같은 픽스처를 같은 시간 동안 돌려 «배경 잡음» 을
// 먼저 재고, 켠 쪽이 그보다 유의하게 큰 변화를 내야 통과다. 결과는
// verify-shots/runtime-qa/cloud-shadows/{SUMMARY.md,*.png}.
import { chromium } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";
import { writeCloudShadowFixture } from "./cloud-shadows-fixture.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = join(REPO_ROOT, `verify-shots/runtime-qa/cloud-shadows${process.env.CLOUD_SHADOW_QA_PRESET === "default" ? "-default" : ""}`);
const FIXTURE_DIR = join(REPO_ROOT, "verify-shots/runtime-qa/_fixtures");
const PROJECT_URL = "/__qa/cloud-shadows-project.json";
const VIEWPORT = { width: 960, height: 720 };
/** 기본 프리셋은 «제작자가 체크만 했을 때» 의 모습을 그대로 재현한다. */
const SETTINGS = process.env.CLOUD_SHADOW_QA_PRESET === "default"
  ? { opacity: 0.34, speed: 26, angleDeg: 28, scale: 1 }
  : { opacity: 0.4, speed: 52, angleDeg: 200, scale: 1.5 };
const MIN_DRIFT_PX = 55;
const DRIFT_TIMEOUT_MS = 25_000;
const ANGLE_TOLERANCE_DEG = 12;
const SPEED_TOLERANCE_RATIO = 0.2;
const MIN_CHANGED_RATIO = 0.02;
const CONTROL_MULTIPLE = 3;
const CONTROL_FLOOR = 0.01;

const failures = [];
const lines = [];
const checks = [];
const record = (ok, label, detail) => {
  checks.push({ ok, label, detail });
  lines.push(`- ${ok ? "PASS" : "FAIL"} — ${label}: ${detail}`);
  if (!ok) failures.push(`${label}: ${detail}`);
};

const server = await startPlayerQaServer();
let browser;
try {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });

  const on = await runCase({ enabled: true });
  record(on.state.enabled === true, "구름 켬", `enabled=${on.state.enabled}`);
  record(on.state.layoutCount === 12, "배치 구름 수", `layout=${on.state.layoutCount}`);
  record(
    on.state.visibleCount >= 4,
    "화면에 뜬 덩어리",
    `보이는 ${on.state.visibleCount}개 / 풀 ${on.state.blobs.length}개 (배치 ${on.state.layoutCount}개 중 화면과 겹치는 것)`,
  );
  record(
    on.state.blobs.length >= on.state.visibleCount,
    "풀 정합",
    `풀 ${on.state.blobs.length}개 ≥ 보이는 ${on.state.visibleCount}개 (풀은 줄지 않는다 — 안 보이는 칸은 감춰 둔다)`,
  );
  record(on.state.depth === 700_000, "깊이", `depth=${on.state.depth}`);
  record(on.state.textureReady === true, "텍스처", `ready=${on.state.textureReady}`);
  record(
    Math.abs(on.state.opacity - SETTINGS.opacity) < 1e-6,
    "알파가 설정값과 같다",
    `opacity=${on.state.opacity} (설정 ${SETTINGS.opacity})`,
  );

  record(
    on.drift.matched >= 3,
    "위상 매칭",
    `${on.drift.matched}개가 두 관측 사이에서 같은 위상으로 이어졌다`,
  );
  const elapsedSeconds = (on.drift.elapsedClockMs ?? 0) / 1000;
  const measuredSpeed = elapsedSeconds > 0 ? on.drift.medianPx / elapsedSeconds : 0;
  const measuredAngle = (Math.atan2(on.drift.deltaY, on.drift.deltaX) * 180) / Math.PI;
  const angleError = Math.abs(((measuredAngle - SETTINGS.angleDeg + 540) % 360) - 180);
  record(
    on.drift.medianPx >= MIN_DRIFT_PX,
    "흐름 감지",
    `중앙값 변위 ${on.drift.medianPx.toFixed(1)}px / 클럭 ${elapsedSeconds.toFixed(2)}초 (실시간 ${(on.drift.elapsedWallMs / 1000).toFixed(2)}초, 연속 ${on.drift.matched}개)`,
  );
  record(
    angleError <= ANGLE_TOLERANCE_DEG,
    "흐르는 방향",
    `측정 ${measuredAngle.toFixed(1)}° vs 설정 ${SETTINGS.angleDeg}° (오차 ${angleError.toFixed(1)}°, 허용 ${ANGLE_TOLERANCE_DEG}°)`,
  );
  record(
    Math.abs(measuredSpeed - SETTINGS.speed) <= SETTINGS.speed * SPEED_TOLERANCE_RATIO,
    "흐르는 속도",
    `측정 ${measuredSpeed.toFixed(1)}px/초 vs 설정 ${SETTINGS.speed} (허용 ±${SPEED_TOLERANCE_RATIO * 100}%)`,
  );

  const off = await runCase({ enabled: false, clockWindowMs: on.drift.elapsedClockMs });
  if (off.state.missing) {
    lines.push(`- 참고 — 대조군 페이지에서 관측 훅이 사라져 «켜짐/보임» 축은 재지 못했다(픽셀 대조는 유효). 진단: ${JSON.stringify(off.diagnostics.slice(-4))}`);
  } else {
    record(off.state.enabled === false, "구름 끔", `enabled=${off.state.enabled}`);
    record(off.state.visibleCount === 0, "끔 = 안 그린다", `visible=${off.state.visibleCount}`);
  }
  record(
    on.lattice.onLattice === on.lattice.visible && on.lattice.visible > 0,
    "스프라이트가 모델 위상 위에 있다",
    `보이는 ${on.lattice.visible}개 중 위상 위 ${on.lattice.onLattice}개`,
  );

  record(
    on.pixels.changedRatio >= MIN_CHANGED_RATIO,
    "화면이 실제로 달라진다",
    `변한 픽셀 ${(on.pixels.changedRatio * 100).toFixed(2)}% (하한 ${(MIN_CHANGED_RATIO * 100).toFixed(2)}%), 평균 |Δ휘도| ${on.pixels.meanAbs.toFixed(2)}`,
  );
  lines.push(`- 참고 — «같은 순간 두 컷» 은 진짜 정지 쌍이 아니다: 스크린샷 자체가 게임 루프를 멈춰 세우므로 두 컷 사이에도 구름이 흐른다(실측 ${(on.noise.changedRatio * 100).toFixed(2)}%). 배경 잡음의 기준은 구름을 끈 대조 실행이다.`);
  record(
    on.pixels.changedRatio >= CONTROL_MULTIPLE * off.pixels.changedRatio + CONTROL_FLOOR,
    "변화가 대조군(구름 끔)보다 크다",
    `켬 ${(on.pixels.changedRatio * 100).toFixed(2)}% vs 끔 ${(off.pixels.changedRatio * 100).toFixed(2)}% (배수 ≥ ${CONTROL_MULTIPLE}, 하한 ${CONTROL_FLOOR})`,
  );

  lines.push("", "## 측정값", "", "```json", JSON.stringify({
    on: {
      ...on.state,
      pixels: on.pixels,
      noise: on.noise,
      attempt: on.attempt,
      diagnostics: on.diagnostics,
      drift: { ...on.drift, blobs: undefined },
    },
    off: { ...off.state, pixels: off.pixels, noise: off.noise, attempt: off.attempt, diagnostics: off.diagnostics, drift: null },
  }, null, 2), "```");
} catch (error) {
  record(false, "probe 완주", String(error?.stack ?? error).split("\n").slice(0, 4).join(" | "));
} finally {
  if (browser) await browser.close();
  await server.close();
  await rm(FIXTURE_DIR, { recursive: true, force: true });
}

const verdict = failures.length === 0 ? "통과" : "실패";
const report = [
  "# 구름 그림자 비전 QA",
  "",
  `판정: **${verdict}**`,
  "",
  `시나리오: 시작 맵에 구름 그림자를 켠 픽스처와, 같은 픽스처에서 끈 대조 실행을 같은 시간 창으로 비교.`,
  `설정: opacity ${SETTINGS.opacity}, speed ${SETTINGS.speed}px/s, angleDeg ${SETTINGS.angleDeg}, scale ${SETTINGS.scale}`,
  "",
  "## 판정",
  "",
  ...lines,
  "",
  "## 실패",
  "",
  ...(failures.length === 0 ? ["- 없음"] : failures.map((failure) => `- ${failure}`)),
  "",
  "## 증거 파일",
  "",
  "- `cloud-on-t0.png` / `cloud-on-t1.png` — 구름 켬, 관측 시작/이동 후",
  "- `cloud-off-t0.png` / `cloud-off-t1.png` — 구름 끔 대조군(같은 시간 창)",
].join("\n");

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "SUMMARY.md"), `${report}\n`, "utf8");
await writeFile(join(OUT, "checks.json"), `${JSON.stringify(checks, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  qaCleanup: "browser and server closed",
  qaPort: server.port,
  fixtureCleanup: `rm -rf ${FIXTURE_DIR}`,
}));
console.log(report);
process.exit(failures.length > 0 ? 1 : 0);

async function runCase({ enabled, clockWindowMs }) {
  const tag = enabled ? "on" : "off";
  const fixturePath = await writeCloudShadowFixture({ enabled, settings: SETTINGS });
  const projectJson = await readFile(fixturePath, "utf8");
  const diagnostics = [];
  let lastError = null;
  /**
   * 페이지가 측정 중에 다시 로드되면(개발 서버의 의존성 재최적화가 HMR 전체 리로드를 낼 수 있다)
   * 클럭과 풀이 초기화되어 두 표본을 이어 붙일 수 없다. 고정 대기 대신 «새 페이지로 다시
   * 시도» 한다 — 시도 자체가 복구 조건이다. 진단 줄은 리포트에 남긴다.
   */
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const page = await browser.newPage();
    const caseLog = [];
    page.on("pageerror", (error) => caseLog.push(`pageerror: ${String(error?.message ?? error).split("\n")[0]}`));
    page.on("console", (message) => {
      if (message.type() === "error") caseLog.push(`console: ${message.text()}`);
    });
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) caseLog.push(`navigated: ${frame.url()}`);
    });
    try {
      await page.setViewportSize(VIEWPORT);
      await page.addInitScript(([projectUrl, namespace]) => {
        try {
          localStorage.clear();
        } catch {
          // 접근 불가 환경이면 그대로 진행한다.
        }
        window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: namespace, qaInstrumentation: true };
      }, [PROJECT_URL, `runtime-qa:cloud-shadows-${tag}`]);
      await page.route(`**${PROJECT_URL}`, (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
      await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
      await page.keyboard.press("Enter");
      await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 90_000 });
      await page.waitForFunction(() => typeof window.__oprnCloudShadows === "function", undefined, { timeout: 90_000 });
      await waitForStableViewport(page);

      const first = await sample(page, `cloud-${tag}-t0.png`);
      if (enabled && first.state.missing) throw new Error(`구름 그림자 훅이 사라졌다: ${JSON.stringify(first.state)}`);
      // 같은 순간을 한 번 더 찍어 «배경 잡음» 을 잰다 — 시간이 거의 흐르지 않았는데도
      // 달라지는 픽셀. 구름 이동이 이 잡음보다 확실히 큰 변화를 내야 통과다.
      const still = await sample(page, `cloud-${tag}-t0b.png`);
      const lattice = enabled ? await spriteOnLattice(page) : { visible: 0, onLattice: 0 };
      const drift = enabled
        ? await waitForDrift(page, MIN_DRIFT_PX, DRIFT_TIMEOUT_MS)
        : await waitForWallWindow(page, clockWindowMs ?? 1200, DRIFT_TIMEOUT_MS);
      if (enabled && !drift) throw new Error(`구름이 ${MIN_DRIFT_PX}px 흐르지 않았다`);
      const second = await sample(page, `cloud-${tag}-t1.png`);
      if (first.session !== second.session) throw new Error("측정 중 페이지가 다시 로드되어 표본을 이을 수 없다");
      return {
        state: second.state,
        first,
        second,
        drift,
        lattice,
        noise: pixelDelta(first.png, still.png),
        pixels: pixelDelta(first.png, second.png),
        attempt,
        diagnostics: caseLog,
      };
    } catch (error) {
      lastError = error;
      diagnostics.push(`시도 ${attempt}: ${String(error?.message ?? error).split("\n")[0]}`);
      diagnostics.push(...caseLog.slice(-6));
    } finally {
      await page.close();
    }
  }
  throw new Error(`${tag} 실행 실패: ${String(lastError?.message ?? lastError)} | ${diagnostics.slice(-8).join(" / ")}`);
}

/** 표본이 «같은 문서» 에서 찍렸는지 판별하는 이름. 다시 로드되면 값이 바뀔다. */
async function sample(page, fileName) {
  const state = await page.evaluate(() => {
    const snapshot = typeof window.__oprnCloudShadows === "function" ? window.__oprnCloudShadows() : null;
    const session = `${performance.timeOrigin}|${location.href}`;
    if (!snapshot) {
      return {
        missing: true,
        session,
        readyState: document.readyState,
        titleScreen: document.querySelector("[data-testid='title-screen']") !== null,
        canvas: document.querySelector("canvas") !== null,
        boot: "__OPENRPG_BOOT__" in window,
        cameraHook: typeof window.__oprnCamera,
        eventHook: typeof window.__oprnDebug,
      };
    }
    return { ...snapshot, missing: false, session };
  });
  const png = await page.screenshot();
  await writeFile(join(OUT, fileName), png);
  return { state, png, session: state.session };
}

/**
 * 카메라가 플레이어 추적을 멈춰 화면이 안정될 때까지 기다린다. 여기서 고정 시간을 쓰지 않는
 * 이유: 안정되기 전에 찍은 두 프레임은 «카메라 이동» 만큼 화면이 달라져 픽셀 판정이 거짓이 된다.
 */
async function waitForStableViewport(page) {
  const ok = await page.evaluate(async () => {
    const camera = window.__oprnCamera;
    if (!camera) return false;
    let stable = 0;
    let previous = camera();
    const deadline = performance.now() + 10_000;
    while (performance.now() < deadline) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const current = camera();
      const moved = Math.abs(current.scrollX - previous.scrollX) + Math.abs(current.scrollY - previous.scrollY);
      stable = moved < 0.01 ? stable + 1 : 0;
      previous = current;
      if (stable >= 8) return true;
    }
    return false;
  });
  if (!ok) throw new Error("카메라가 안정되지 않아 픽셀 판정을 할 수 없다");
}

/**
 * 덩어리들이 «설정한 만큼» 흐를 때까지 기다린다(고정 대기 금지 — 조건 대기).
 *
 * 변위는 스프라이트가 아니라 **위상**으로 잰다. 화면에 보이는 스프라이트는 화면을 드나들며
 * 풀 순서가 바뀌므로 인덱스로 짝지으면 서로 다른 구름을 빼서 엉뚱한 변위가 나온다(실측
 * 173px/0.68s — 방향만 우연히 맞았다). 위상은 배치 순서가 고정이라 같은 구름을 정확히 잇는다.
 * «스프라이트가 위상 위에 있는가» 는 호출자가 따로 단정한다(모델과 화면의 연결).
 */
async function waitForDrift(page, minPx, timeoutMs) {
  return await page.evaluate(async ([min, timeout]) => {
    const read = () => window.__oprnCloudShadows();
    const start = read();
    const startedWallMs = performance.now();
    const period = start.period;
    const wrapDelta = (value) => (((value % period) + period * 1.5) % period) - period / 2;
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = read();
      const deltas = [];
      const count = Math.min(start.anchors.length, now.anchors.length);
      for (let index = 0; index < count; index += 1) {
        deltas.push({
          dx: wrapDelta(now.anchors[index].x - start.anchors[index].x),
          dy: wrapDelta(now.anchors[index].y - start.anchors[index].y),
        });
      }
      if (deltas.length === 0) continue;
      const magnitudes = deltas.map((delta) => Math.hypot(delta.dx, delta.dy)).sort((a, b) => a - b);
      const medianPx = magnitudes[Math.floor(magnitudes.length / 2)];
      if (medianPx >= min) {
        const median = (values) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
        return {
          medianPx,
          matched: deltas.length,
          elapsedClockMs: now.clockMs - start.clockMs,
          elapsedWallMs: performance.now() - startedWallMs,
          deltaX: median(deltas.map((delta) => delta.dx)),
          deltaY: median(deltas.map((delta) => delta.dy)),
        };
      }
    }
    return null;
  }, [minPx, timeoutMs]);
}

/** 스프라이트가 모델 위상 위에 놓였는가 — 그림이 계산을 따라가는지 보는 축. */
async function spriteOnLattice(page) {
  return await page.evaluate(() => {
    const state = window.__oprnCloudShadows();
    const period = state.period;
    const phase = (x, y) => `${Math.round((((x % period) + period) % period) * 10)}|${Math.round((((y % period) + period) % period) * 10)}`;
    const lattice = new Set(state.anchors.map((anchor) => phase(anchor.x, anchor.y)));
    const visible = state.blobs.filter((blob) => blob.visible);
    return { visible: visible.length, onLattice: visible.filter((blob) => lattice.has(phase(blob.x, blob.y))).length };
  });
}

/**
 * 대조군용 «같은 길이의 시간 창». 관측 훅에 기대지 않는다 — 대조군의 일은 «구름이 없을 때
 * 화면이 얼마나 변하는가» 를 재는 것뿐이고, 훅이 사라져도 그 측정은 계속돼야 한다.
 */
async function waitForWallWindow(page, ms, timeoutMs) {
  return await page.evaluate(async ([window, timeout]) => {
    const start = performance.now();
    const deadline = start + timeout;
    while (performance.now() < deadline) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (performance.now() - start >= window) return { elapsedWallMs: performance.now() - start, medianPx: null };
    }
    return null;
  }, [ms, timeoutMs]);
}

/** 두 PNG 의 휘도 차이. «변한 픽셀 비율» 과 평균 |Δ휘도| 를 돌려준다. */
function pixelDelta(a, b) {
  const first = PNG.sync.read(a);
  const second = PNG.sync.read(b);
  if (first.width !== second.width || first.height !== second.height) {
    throw new Error(`스크린샷 크기가 다르다: ${first.width}x${first.height} vs ${second.width}x${second.height}`);
  }
  let changed = 0;
  let total = 0;
  let sumAbs = 0;
  for (let offset = 0; offset < first.data.length; offset += 4) {
    const lumaA = 0.299 * first.data[offset] + 0.587 * first.data[offset + 1] + 0.114 * first.data[offset + 2];
    const lumaB = 0.299 * second.data[offset] + 0.587 * second.data[offset + 1] + 0.114 * second.data[offset + 2];
    const delta = Math.abs(lumaA - lumaB);
    sumAbs += delta;
    total += 1;
    if (delta > 8) changed += 1;
  }
  return {
    changedRatio: total === 0 ? 0 : changed / total,
    meanAbs: total === 0 ? 0 : sumAbs / total,
    width: first.width,
    height: first.height,
  };
}
