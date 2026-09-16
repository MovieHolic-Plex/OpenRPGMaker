import { expect, test, type Page } from "@playwright/test";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import fixture from "../fixtures/projects/system-shell-v3.json" with { type: "json" };
import { gotoWithRetry } from "../../scripts/lib/goto-retry.mjs";

// 진단 스펙 — 큰 맵에서 편집기 렌더 경로별 프레임 비용을 잰다.
// 실행: npx playwright test test/e2e/_large-map-perf.spec.ts (경로 지목이므로 testIgnore 무시)
// 크기 선택: PERF_SIZES=48,96 (기본 48,96,192,256)
//
// 재는 것:
//  1. ctrl+휠 줌 1단계 — 줌이 타일 전체 재생성을 돌리던 경로(ZoomSteps 는 그 디스패치의 동기 밖시계).
//     레벨 상한에 닿은 뒤 단계는 set 이 무변화로 무시되므로 ~0ms — 내부 대조군이 된다.
//  2. 좌드래그 페인트 — 증분 cells 렌더 + tileLayer.sort("depth") 전체 정렬 경로.
//  3. 정지 — 아무 입력 없을 때 프레임 간격.
// ground truth: 줌은 window.__oprnEditCamera().zoom 값 변화로, 페인트는 스트로크 전후 PNG 로
// "실제로 적용됐는가"를 검증한다. 숫자는 swiftshader 헤드리스라 실제 GPU 환경보다 느리다 —
// 크기 간 상대 증가를 본다. 결과: verify-shots/editor-large-map-perf/

type AnyRecord = Record<string, any>;

test.setTimeout(600_000);

function buildProject(size: number): AnyRecord {
  const project = JSON.parse(JSON.stringify(fixture)) as AnyRecord;
  const map: AnyRecord = Object.values(project.maps)[0] as AnyRecord;
  map.width = size;
  map.height = size;
  map.lowerTiles = new Array<number>(size * size).fill(0);
  map.upperTiles = new Array<number>(size * size).fill(-1);
  for (let i = 0; i < size * size; i += 13) map.upperTiles[i] = 0;
  map.events = [];
  return project;
}

/**
 * 픽스처를 그대로 심으면 부팅이 죽는다 — 참조 검증이 정규화된 모양을 전제한다
 * (system-shell-v3 는 initialEquipment·learnedSkills 없는 원본이다). 앱이 쓰는 정규화기를
 * 페이지 안에서 그대로 태운다: dev 서버가 /src 모듈을 서빙하므로 스펙이 정규화 규칙을
 * 복제하지 않아도 되고, 시드 파일을 저장소에 넣지 않아도 된다.
 */
async function normalizeSeed(page: Page, project: AnyRecord): Promise<AnyRecord> {
  await gotoWithRetry(page, "/");
  return page.evaluate(async (input) => {
    // 변수 지정자는 TS 가 정적 해석하지 않게 한다 — 이 모듈은 브라우저(vite dev 서버)만 안다.
    const modulePath = "/src/project/io/shape.ts";
    const mod = (await import(/* @vite-ignore */ modulePath)) as {
      validateProjectV4: (value: unknown) => unknown;
    };
    return mod.validateProjectV4(input);
  }, project) as Promise<AnyRecord>;
}

async function seedAndBoot(page: Page, project: AnyRecord): Promise<{ pageErrors: string[]; consoleErrors: string[] }> {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript((seed) => {
    window.__OPRN_E2E_PROJECT__ = seed;
    window.localStorage.clear();
    const gaps: number[] = [];
    let last = performance.now();
    const loop = (t: number) => {
      gaps.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    (window as unknown as { __frameGaps: number[] }).__frameGaps = gaps;
  }, project);
  await gotoWithRetry(page, "/");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: Number(process.env.E2E_BOOT_TIMEOUT_MS ?? 30000) });
  try {
    await page.waitForFunction(() => typeof (window as unknown as { __oprnEditCamera?: unknown }).__oprnEditCamera === "function", undefined, { timeout: 20000 });
  } catch {
    // 훅 미등록은 그 자체가 진단 단서다 — 예외로 터뜨리지 않고 기록한다.
  }
  return { pageErrors, consoleErrors };
}

async function resetProbes(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __frameGaps: number[] }).__frameGaps.length = 0;
  });
}

type FrameStats = { avg: number; max: number; samples: number };

async function readStats(page: Page): Promise<FrameStats> {
  return page.evaluate(() => {
    const gaps = (window as unknown as { __frameGaps: number[] }).__frameGaps.slice(1);
    const avg = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : -1;
    return { avg: Math.round(avg * 10) / 10, max: gaps.length ? Math.round(Math.max(...gaps) * 10) / 10 : -1, samples: gaps.length };
  });
}

/** .phaser-container(testid) 안의 실제 Phaser canvas 원소를 되돌린다. */
async function resolveCanvas(page: Page): Promise<{ box: { x: number; y: number; width: number; height: number }; tag: string }> {
  return page.evaluate(() => {
    const host = document.querySelector("[data-testid='edit-canvas']");
    const canvas = (host?.querySelector("canvas") ?? host) as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    return { box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, tag: canvas.tagName };
  });
}

/** ctrl+휠 한 단계를 canvas 에 보내고, 그 디스패치의 동기 벽시계(전체 재렌더 포함)를 되돌린다. */
async function zoomStep(page: Page, direction: "in" | "out"): Promise<number> {
  return page.evaluate((dir) => {
    const host = document.querySelector("[data-testid='edit-canvas']");
    const canvas = (host?.querySelector("canvas") ?? host) as HTMLElement;
    const rect = canvas.getBoundingClientRect();
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: rect.x + rect.width / 2,
      clientY: rect.y + rect.height / 2,
      deltaY: dir < 0 ? -120 : 120,
      ctrlKey: true,
    });
    const started = performance.now();
    canvas.dispatchEvent(event);
    return Math.round((performance.now() - started) * 10) / 10;
  }, direction === "in" ? -1 : 1);
}

async function cameraZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const cam = (window as unknown as { __oprnEditCamera?: () => { zoom: number } }).__oprnEditCamera?.();
    return cam ? cam.zoom : -1;
  });
}

/** 왼쪽 1/4 지점(패널에 안 가리는 곳)에서 드래그 페인트. 적용 여부는 전후 PNG 비교로 판정. */
async function paintStroke(page: Page, moves: number): Promise<{ wallMs: number }> {
  const { box } = await resolveCanvas(page);
  const startX = box.x + box.width * 0.22;
  const startY = box.y + box.height * 0.5;
  await page.screenshot({ path: `verify-shots/editor-large-map-perf/paint-before.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, 800), height: Math.min(box.height, 600) } });
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const started = Date.now();
  for (let i = 1; i <= moves; i += 1) {
    await page.mouse.move(startX + i * 8, startY, { steps: 1 });
  }
  await page.mouse.up();
  const wallMs = Date.now() - started;
  await page.screenshot({ path: `verify-shots/editor-large-map-perf/paint-after.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, 800), height: Math.min(box.height, 600) } });
  return { wallMs };
}

const SIZES = (process.env.PERF_SIZES ?? "48,96,192,256").split(",").map((v) => Number.parseInt(v, 10)).filter(Number.isFinite);

for (const size of SIZES) {
  test(`large-map perf ${size}x${size}`, async ({ page }) => {
    const boot = await seedAndBoot(page, await normalizeSeed(page, buildProject(size)));

    await resetProbes(page);
    await page.waitForTimeout(1200);
    const idle = await readStats(page);

    const zoomBefore = await cameraZoom(page);
    const zoomSteps: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      await resetProbes(page);
      zoomSteps.push(await zoomStep(page, "in"));
      await page.waitForTimeout(100);
    }
    const zoomAfter = await cameraZoom(page);
    const zoomFrames = await readStats(page);

    await resetProbes(page);
    const paint = await paintStroke(page, 40);
    const paintFrames = await readStats(page);

    const record = { size, bootErrors: boot.pageErrors.slice(0, 5), bootConsoleErrors: boot.consoleErrors.slice(0, 5), canvasTag: (await resolveCanvas(page)).tag, idle, zoomBefore, zoomSteps, zoomAfter, zoomFrames, paint, paintFrames };
    mkdirSync("verify-shots/editor-large-map-perf", { recursive: true });
    appendFileSync("verify-shots/editor-large-map-perf/results.jsonl", JSON.stringify(record) + "\n");
    console.log(`[${size}] ${JSON.stringify(record)}`);
    writeFileSync(`verify-shots/editor-large-map-perf/${size}.json`, JSON.stringify(record, null, 2));
  });
}
