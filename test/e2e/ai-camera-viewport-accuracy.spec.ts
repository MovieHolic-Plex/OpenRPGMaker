/**
 * 조수 뷰포트 스냅샷 + 카메라 초점의 실픽셀 증거 스펙 (실제 에디터 표면).
 *
 * 무엇을 증명하나:
 *  - 조수가 읽는 MapViewportSnapshot 중심 타일은 기본 줌 2에서 유리 도크가 가리지 않는
 *    캔버스 사각형 안에 있고, 그 사각형 중심으로부터 가로·세로 각각 25% 이내다.
 *  - 조수가 쓰는 requestEditorCameraFocus 채널로 300ms 팬을 요청한 뒤에도 대상 타일이 같은
 *    가시 사각형 안·중앙 25% 이내에 오며, 팬 프레임마다 게시되는 스냅샷도 대상을 따라간다.
 *
 * 왜 픽셀로 재나: Phaser 3.60+ 에서 scrollX/Y 는 줌 2의 worldView 좌상단이 아니다. 예전 계산은
 * 실측 캔버스 1133x700에서 중심을 18타일 왼쪽·11타일 위로 보고했다. 이 스펙은 계산식을 복제하지
 * 않고 씬의 worldView 기반 훅으로 월드 타일을 실제 클라이언트 픽셀에 투영한다.
 *
 * 실행:
 *   DEV_SERVER_PORT=9841 npx playwright test test/e2e/ai-camera-viewport-accuracy.spec.ts --project=chromium --reporter=line
 */
import { expect, test, type Page } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import { createConnection } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.DEV_SERVER_PORT ?? "9841");
const ORIGIN = `http://127.0.0.1:${PORT}`;
const EVIDENCE = path.resolve(".omo/evidence/ai-camera-viewport");
const TILE_SIZE = 16;
const CENTER_TOLERANCE_RATIO = 0.25;
const OVERLAY_TEST_ID = "ai-camera-viewport-proof";

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface CameraState {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

interface MapViewportSnapshot {
  readonly mapId: string;
  readonly centerX: number;
  readonly centerY: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface VisibleArea {
  readonly canvas: Rect;
  readonly unoccluded: Rect;
  readonly worldView: Rect;
  readonly zoom: number;
}

interface Measurement {
  readonly expectedCenter: Point;
  readonly actualPoint: Point;
  readonly deltaPx: Point;
  readonly deltaTiles: Point;
  readonly tolerancePx: Point;
  readonly unoccluded: Rect;
  readonly zoom: number;
}

interface EditorWindow {
  readonly __oprnEditCamera?: () => CameraState;
  readonly __oprnEditWorldToClient?: (worldX: number, worldY: number) => Point;
  readonly __oprnEditMapViewport?: () => MapViewportSnapshot | null;
  readonly __oprnEditVisibleArea?: () => VisibleArea | null;
}

let startedServer: { pid: number } | null = null;
const measurementReceipt: string[] = [];

mkdirSync(EVIDENCE, { recursive: true });

// ── 서버 수명주기 ───────────────────────────────────────────────────────────
function listening(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: PORT });
    const done = (value: boolean): void => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1_000, () => done(false));
  });
}

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await listening()) {
      const response = await fetch(ORIGIN).catch(() => null);
      if (response?.ok) return;
    }
    if (Date.now() > deadline) throw new Error(`dev server did not answer on ${ORIGIN} within ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

/** 포트를 LISTEN 중인 PID 목록 — 재사용한 서버까지 끝에서 닫아 포트 해제를 증명한다. */
function listenerPids(): readonly number[] {
  if (process.platform !== "win32") {
    const out = execFileSync("bash", ["-lc", `lsof -ti tcp:${PORT} -s TCP:LISTEN || true`], { encoding: "utf8" });
    return out.split(/\s+/u).flatMap((token) => (token.trim() === "" ? [] : [Number(token)]));
  }
  const out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
  const pids = new Set<number>();
  for (const line of out.split(/\r?\n/u)) {
    if (!line.includes(`:${PORT} `) || !line.includes("LISTENING")) continue;
    const pid = Number(line.trim().split(/\s+/u).at(-1));
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

function killTree(pid: number): void {
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // 이미 죽었으면 통과 — 포트 연결 여부가 최종 영수증이다.
    }
    return;
  }
  // lsof PID는 보통 vite 자식이라 프로세스 그룹과 리스너 자체를 모두 닫아야 한다.
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, "SIGKILL");
    } catch {
      // 이미 죽었거나 그룹이 없으면 통과.
    }
  }
}

test.beforeAll(async () => {
  if (await listening()) return;
  const child = spawn("npm", ["run", "dev:worktree"], {
    cwd: process.cwd(),
    env: { ...process.env, DEV_SERVER_PORT: String(PORT), DEV_SERVER_NO_TLS: "1" },
    detached: process.platform !== "win32",
    shell: process.platform === "win32",
    stdio: "ignore",
  });
  child.unref();
  startedServer = { pid: child.pid ?? 0 };
  await waitForServer(90_000);
});

test.afterAll(async () => {
  const pids = new Set<number>([...listenerPids(), ...(startedServer?.pid ? [startedServer.pid] : [])]);
  for (const pid of pids) killTree(pid);
  let closed = false;
  for (let attempt = 0; attempt < 25 && !closed; attempt += 1) {
    closed = !(await listening());
    if (!closed) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const receipt = [
    ...measurementReceipt,
    `dev server port: ${PORT}`,
    `killed pids: ${[...pids].join(", ") || "(none found)"}`,
    `port accepts connections after kill: ${String(!closed)}`,
  ].join("\n");
  writeFileSync(path.join(EVIDENCE, "measurements-and-cleanup.txt"), `${receipt}\n`, "utf8");
  console.log(`\n[측정·정리 영수증]\n${receipt}`);
  expect(closed, `포트 ${PORT}가 정리 뒤에도 연결을 받는다`).toBe(true);
});

// ── 실제 에디터 부팅·측정 ──────────────────────────────────────────────────
async function bootEditor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ agentMode: "chat" }));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("ai-panel")).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => page.evaluate(() => {
      const w = window as unknown as EditorWindow;
      return Boolean(w.__oprnEditCamera && w.__oprnEditWorldToClient && w.__oprnEditMapViewport?.() && w.__oprnEditVisibleArea?.());
    }), { timeout: 30_000, intervals: [100, 200] })
    .toBe(true);
}

async function readGeometry(page: Page): Promise<{
  readonly camera: CameraState;
  readonly snapshot: MapViewportSnapshot;
  readonly area: VisibleArea;
}> {
  const geometry = await page.evaluate(() => {
    const w = window as unknown as EditorWindow;
    return {
      camera: w.__oprnEditCamera?.() ?? null,
      snapshot: w.__oprnEditMapViewport?.() ?? null,
      area: w.__oprnEditVisibleArea?.() ?? null,
    };
  });
  expect(geometry.camera, "에디터 카메라 훅이 사라졌다").not.toBeNull();
  expect(geometry.snapshot, "조수 뷰포트 스냅샷이 아직 게시되지 않았다").not.toBeNull();
  expect(geometry.area, "가림 제외 캔버스 기하학을 읽지 못했다").not.toBeNull();
  return geometry as { camera: CameraState; snapshot: MapViewportSnapshot; area: VisibleArea };
}

async function tileClientPoint(page: Page, tileX: number, tileY: number): Promise<Point> {
  const point = await page.evaluate(({ x, y, tileSize }) => {
    const toClient = (window as unknown as EditorWindow).__oprnEditWorldToClient;
    if (!toClient) return null;
    return toClient((x + 0.5) * tileSize, (y + 0.5) * tileSize);
  }, { x: tileX, y: tileY, tileSize: TILE_SIZE });
  expect(point, "월드→클라이언트 투영 훅이 사라졌다").not.toBeNull();
  return point as Point;
}

function measure(point: Point, area: VisibleArea): Measurement {
  const expectedCenter = {
    x: area.unoccluded.x + area.unoccluded.width / 2,
    y: area.unoccluded.y + area.unoccluded.height / 2,
  };
  const deltaPx = { x: point.x - expectedCenter.x, y: point.y - expectedCenter.y };
  return {
    expectedCenter,
    actualPoint: point,
    deltaPx,
    deltaTiles: {
      x: deltaPx.x / (TILE_SIZE * area.zoom),
      y: deltaPx.y / (TILE_SIZE * area.zoom),
    },
    tolerancePx: {
      x: area.unoccluded.width * CENTER_TOLERANCE_RATIO,
      y: area.unoccluded.height * CENTER_TOLERANCE_RATIO,
    },
    unoccluded: area.unoccluded,
    zoom: area.zoom,
  };
}

function formatMeasurement(label: string, value: Measurement): string {
  const f = (n: number): string => n.toFixed(2);
  return [
    `${label}: 기대 중심=(${f(value.expectedCenter.x)}, ${f(value.expectedCenter.y)})px`,
    `실제 점=(${f(value.actualPoint.x)}, ${f(value.actualPoint.y)})px`,
    `델타=(${f(value.deltaPx.x)}, ${f(value.deltaPx.y)})px / (${f(value.deltaTiles.x)}, ${f(value.deltaTiles.y)})타일`,
    `25% 허용=(${f(value.tolerancePx.x)}, ${f(value.tolerancePx.y)})px`,
    `가시 사각형=(${f(value.unoccluded.x)}, ${f(value.unoccluded.y)}, ${f(value.unoccluded.width)}x${f(value.unoccluded.height)})px`,
    `줌=${f(value.zoom)}`,
  ].join("; ");
}

function assertVisibleAndCentered(label: string, value: Measurement): void {
  const rect = value.unoccluded;
  const point = value.actualPoint;
  const detail = formatMeasurement(label, value);
  const inside =
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height;
  expect(inside, `${detail}; 실제 점이 가림 제외 사각형 밖이다`).toBe(true);
  expect(Math.abs(value.deltaPx.x) <= value.tolerancePx.x, `${detail}; 가로 델타가 가시 폭의 25%를 넘었다`).toBe(true);
  expect(Math.abs(value.deltaPx.y) <= value.tolerancePx.y, `${detail}; 세로 델타가 가시 높이의 25%를 넘었다`).toBe(true);
}

/** 가시 사각형(청록)과 실측 점(빨강)을 클라이언트 픽셀 그대로 얹어 PNG에 남긴다. */
async function screenshotWithMeasurement(page: Page, area: VisibleArea, point: Point, filename: string): Promise<void> {
  await page.evaluate(({ rect, measured, testId }) => {
    document.querySelectorAll(`[data-testid="${testId}"]`).forEach((node) => node.remove());
    const outline = document.createElement("div");
    outline.dataset.testid = testId;
    Object.assign(outline.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "2147483646",
      left: `${rect.x + window.scrollX}px`,
      top: `${rect.y + window.scrollY}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      boxSizing: "border-box",
      border: "4px solid #00f5d4",
      background: "rgba(0, 245, 212, 0.04)",
      boxShadow: "inset 0 0 0 1px #061826, 0 0 0 1px #061826",
    });
    const marker = document.createElement("div");
    marker.dataset.testid = testId;
    marker.textContent = "+";
    Object.assign(marker.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "2147483647",
      left: `${measured.x + window.scrollX - 12}px`,
      top: `${measured.y + window.scrollY - 12}px`,
      width: "24px",
      height: "24px",
      color: "white",
      background: "#f72585",
      border: "3px solid white",
      borderRadius: "50%",
      boxSizing: "border-box",
      font: "bold 18px/17px monospace",
      textAlign: "center",
      boxShadow: "0 0 0 2px #061826, 0 2px 8px rgba(0,0,0,.7)",
    });
    document.body.append(outline, marker);
  }, { rect: area.unoccluded, measured: point, testId: OVERLAY_TEST_ID });
  try {
    await page.screenshot({ path: path.join(EVIDENCE, filename), animations: "disabled" });
  } finally {
    await page.evaluate((testId) => {
      document.querySelectorAll(`[data-testid="${testId}"]`).forEach((node) => node.remove());
    }, OVERLAY_TEST_ID);
  }
}

/** 두 연속 animation frame의 scroll이 같고 출발점에서는 실제로 벗어났을 때만 팬 완료로 친다. */
async function waitForCameraToSettle(page: Page, before: CameraState): Promise<void> {
  await expect
    .poll(() => page.evaluate(async (start) => {
      const read = (window as unknown as EditorWindow).__oprnEditCamera;
      if (!read) return false;
      const first = read();
      const second = await new Promise<CameraState>((resolve) => {
        requestAnimationFrame(() => resolve(read()));
      });
      const stable = Math.abs(second.scrollX - first.scrollX) < 0.01 && Math.abs(second.scrollY - first.scrollY) < 0.01;
      const moved = Math.abs(second.scrollX - start.scrollX) > 1 || Math.abs(second.scrollY - start.scrollY) > 1;
      return stable && moved;
    }, before), { timeout: 10_000, intervals: [16, 32, 50] })
    .toBe(true);
}

test.describe("조수 카메라·뷰포트 실픽셀 정확도", () => {
  test.describe.configure({ timeout: 120_000 });

  test("A — 조수 스냅샷 중심이 사용자가 보는 가시 캔버스 중앙부다", async ({ page }) => {
    await bootEditor(page);
    const booted = await readGeometry(page);

    // 기본 줌 2에서 예전 오차가 가로 18타일까지 커졌으므로 다른 줌으로 우연히 통과시키지 않는다.
    expect(booted.camera.zoom, "이 실측은 에디터 기본 줌 2에서 돌아야 한다").toBe(2);
    expect(booted.area.zoom, "가시 기하학과 실제 카메라 줌이 달라졌다").toBe(2);

    // 유리 도크는 **접힌 입력줄로 시작**하므로(2026-08-30 progressive disclosure) 부팅 직후에는
    // 가릴 것이 거의 없다. 가림 보정을 진짜로 재려면 카드를 펼쳐야 한다 — 실제 사용에서도 첫 AI
    // 턴이 expandForAiWork → unfoldGlass 로 이 상태를 만든다. 그래서 여기서 셰브론을 눌러 펼친 뒤
    // 기하학이 그 폭을 실제로 빼는지 확인하고, 그 상태의 스냅샷을 잰다.
    await page.getByTestId("ai-collapse").click();
    await expect
      .poll(() => page.evaluate(() => {
        const readArea = (window as unknown as EditorWindow).__oprnEditVisibleArea;
        const value = readArea?.();
        if (!value) return 0;
        return value.canvas.width - value.unoccluded.width;
      }), { timeout: 15_000, intervals: [100, 200] })
      .toBeGreaterThan(200);

    const { snapshot, area } = await readGeometry(page);
    expect(area.unoccluded.x, "왼쪽 조수 glass 카드를 가시 사각형에서 빼지 못했다").toBeGreaterThan(area.canvas.x);
    expect(area.unoccluded.width, "조수 glass 카드를 뺀 폭이 캔버스 전체 폭과 같다").toBeLessThan(area.canvas.width);

    const point = await tileClientPoint(page, snapshot.centerX, snapshot.centerY);
    const result = measure(point, area);
    const detail = formatMeasurement("시나리오 A", result);
    measurementReceipt.push(detail);
    console.log(`\n[실측] ${detail}`);

    assertVisibleAndCentered("시나리오 A", result);
    const snapshotContainsCenter =
      snapshot.centerX >= snapshot.x &&
      snapshot.centerX < snapshot.x + snapshot.w &&
      snapshot.centerY >= snapshot.y &&
      snapshot.centerY < snapshot.y + snapshot.h;
    expect(
      snapshotContainsCenter,
      `스냅샷 사각형 (${snapshot.x},${snapshot.y},${snapshot.w}x${snapshot.h})이 중심 (${snapshot.centerX},${snapshot.centerY})을 포함하지 않는다`,
    ).toBe(true);

    await screenshotWithMeasurement(page, area, point, "01-snapshot-center.png");
  });

  test("B — 조수 카메라 팬이 대상 타일을 사용자가 보는 가시 캔버스 중앙부로 옮긴다", async ({ page }) => {
    await bootEditor(page);
    const initial = await readGeometry(page);
    expect(initial.camera.zoom, "카메라 팬 실측도 기본 줌 2에서 돌아야 한다").toBe(2);

    const mapSize = await page.evaluate(async (mapId) => {
      // ai-editor-reach와 같은 Vite live-module import다. 앱이 구독한 ESM 인스턴스와 동일하다.
      const load = async (specifier: string): Promise<Record<string, unknown>> =>
        (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
      const storeModule = await load("/src/project/store.ts");
      const store = storeModule.store as { getCurrent: () => { maps: Record<string, { width: number; height: number }> } };
      const map = store.getCurrent().maps[mapId];
      return map ? { width: map.width, height: map.height } : null;
    }, initial.snapshot.mapId);
    expect(mapSize, `현재 맵 ${initial.snapshot.mapId}의 크기를 store에서 읽지 못했다`).not.toBeNull();

    const target = {
      mapId: initial.snapshot.mapId,
      tileX: Math.min((mapSize?.width ?? 1) - 1, initial.snapshot.centerX + 25),
      tileY: Math.min((mapSize?.height ?? 1) - 1, initial.snapshot.centerY + 25),
      onlyIfOffscreen: false,
    };
    expect(
      Math.abs(target.tileX - initial.snapshot.centerX) > 2 || Math.abs(target.tileY - initial.snapshot.centerY) > 2,
      `팬 대상 (${target.tileX},${target.tileY})이 출발 중심 (${initial.snapshot.centerX},${initial.snapshot.centerY})에서 충분히 멀지 않다`,
    ).toBe(true);

    await page.evaluate(async (focusTarget) => {
      const load = async (specifier: string): Promise<Record<string, unknown>> =>
        (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
      const module = await load("/src/editor/editorCameraFocus.ts");
      const requestEditorCameraFocus = module.requestEditorCameraFocus as (value: typeof focusTarget) => void;
      requestEditorCameraFocus(focusTarget);
    }, target);
    await waitForCameraToSettle(page, initial.camera);

    const after = await readGeometry(page);
    const point = await tileClientPoint(page, target.tileX, target.tileY);
    const result = measure(point, after.area);
    const detail = formatMeasurement("시나리오 B", result);
    measurementReceipt.push(
      `${detail}; 요청 타일=(${target.tileX}, ${target.tileY}); 게시 중심=(${after.snapshot.centerX}, ${after.snapshot.centerY})`,
    );
    console.log(`\n[실측] ${detail}; 요청 타일=(${target.tileX}, ${target.tileY}); 게시 중심=(${after.snapshot.centerX}, ${after.snapshot.centerY})`);

    assertVisibleAndCentered("시나리오 B", result);
    expect(
      Math.abs(after.snapshot.centerX - target.tileX) <= 2,
      `팬 뒤 게시 중심 X=${after.snapshot.centerX}, 요청 X=${target.tileX}; 차이 ${Math.abs(after.snapshot.centerX - target.tileX).toFixed(2)}타일`,
    ).toBe(true);
    expect(
      Math.abs(after.snapshot.centerY - target.tileY) <= 2,
      `팬 뒤 게시 중심 Y=${after.snapshot.centerY}, 요청 Y=${target.tileY}; 차이 ${Math.abs(after.snapshot.centerY - target.tileY).toFixed(2)}타일`,
    ).toBe(true);

    await screenshotWithMeasurement(page, after.area, point, "02-after-pan.png");
  });
});
