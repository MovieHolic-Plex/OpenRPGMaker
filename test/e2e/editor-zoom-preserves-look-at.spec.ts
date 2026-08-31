/**
 * 줌만 바꿀 때 편집 카메라가 맵 한가운데로 붙지 않는지 실측한다.
 *
 * 버그: applyCameraView 가 줌 변경마다 centerOn(mapW/2, mapH/2) 해서, 조수가 fit 줌을
 * 제안하거나 사용자가 +/- 를 누르면 화면이 중앙으로 튕긴 뒤 팬이 출발했다.
 *
 * 실행 (이 워크트리 서버를 재사용):
 *   DEV_SERVER_PORT=19841 npx playwright test test/e2e/editor-zoom-preserves-look-at.spec.ts --project=chromium --headed
 */
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";

const EVIDENCE = path.resolve(".omo/evidence/editor-zoom-look-at");
const TILE_SIZE = 16;

interface CameraState {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

interface VisibleArea {
  readonly canvas: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly unoccluded: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly worldView: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly zoom: number;
}

interface MapViewportSnapshot {
  readonly mapId: string;
  readonly centerX: number;
  readonly centerY: number;
}

interface EditorWindow {
  readonly __oprnEditCamera?: () => CameraState;
  readonly __oprnEditMapViewport?: () => MapViewportSnapshot | null;
  readonly __oprnEditVisibleArea?: () => VisibleArea | null;
}

mkdirSync(EVIDENCE, { recursive: true });

/** Phaser 3.60+ 에서 scrollX/Y 는 줌 2의 화면 중심이 아니다. worldView 사각형 중심을 쓴다. */
function lookAtWorld(area: VisibleArea): { x: number; y: number } {
  return {
    x: area.worldView.x + area.worldView.width / 2,
    y: area.worldView.y + area.worldView.height / 2,
  };
}

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
  await expect
    .poll(() => page.evaluate(() => {
      const w = window as unknown as EditorWindow;
      return Boolean(w.__oprnEditCamera && w.__oprnEditMapViewport?.() && w.__oprnEditVisibleArea?.());
    }), { timeout: 30_000, intervals: [100, 200] })
    .toBe(true);
}

async function readGeometry(page: Page): Promise<{ camera: CameraState; area: VisibleArea; snapshot: MapViewportSnapshot }> {
  const geometry = await page.evaluate(() => {
    const w = window as unknown as EditorWindow;
    return {
      camera: w.__oprnEditCamera?.() ?? null,
      area: w.__oprnEditVisibleArea?.() ?? null,
      snapshot: w.__oprnEditMapViewport?.() ?? null,
    };
  });
  expect(geometry.camera, "에디터 카메라 훅이 없다").not.toBeNull();
  expect(geometry.area, "가시 영역 훅이 없다").not.toBeNull();
  expect(geometry.snapshot, "뷰포트 스냅샷이 없다").not.toBeNull();
  return geometry as { camera: CameraState; area: VisibleArea; snapshot: MapViewportSnapshot };
}

test.describe("줌만 바꿀 때 look-at 보존", () => {
  test.describe.configure({ timeout: 90_000 });

  test("팬으로 중앙을 벗어난 뒤 확대해도 맵 한가운데로 붙지 않는다", async ({ page }) => {
    await bootEditor(page);
    const beforePan = await readGeometry(page);
    expect(beforePan.camera.zoom, "기본 줌 2에서 실측한다").toBe(2);

    const mapInfo = await page.evaluate(async () => {
      const w = window as unknown as EditorWindow;
      const snapshot = w.__oprnEditMapViewport?.();
      if (!snapshot) return null;
      const storeModule = await import(/* @vite-ignore */ "/src/project/store.ts") as {
        store: { getCurrent: () => { maps: Record<string, { width: number; height: number }> } };
      };
      const map = storeModule.store.getCurrent().maps[snapshot.mapId];
      return map
        ? { mapId: snapshot.mapId, width: map.width, height: map.height, centerX: snapshot.centerX, centerY: snapshot.centerY }
        : null;
    });
    expect(mapInfo, "현재 맵 크기를 읽지 못했다").not.toBeNull();
    const map = mapInfo as NonNullable<typeof mapInfo>;

    const target = {
      mapId: map.mapId,
      tileX: Math.max(1, Math.min(map.width - 2, 2)),
      tileY: Math.max(1, Math.min(map.height - 2, 2)),
      onlyIfOffscreen: false,
    };
    const mapCenterTile = { x: map.width / 2, y: map.height / 2 };
    expect(
      Math.hypot(target.tileX + 0.5 - mapCenterTile.x, target.tileY + 0.5 - mapCenterTile.y) > 3,
      `대상 (${target.tileX},${target.tileY})이 맵 중앙 (${mapCenterTile.x},${mapCenterTile.y})과 너무 가깝다`,
    ).toBe(true);

    await page.evaluate(async (focusTarget) => {
      const module = await import(/* @vite-ignore */ "/src/editor/editorCameraFocus.ts") as {
        requestEditorCameraFocus: (value: typeof focusTarget) => void;
      };
      module.requestEditorCameraFocus(focusTarget);
    }, target);

    await expect
      .poll(async () => {
        const { snapshot } = await readGeometry(page);
        return Math.hypot(snapshot.centerX - target.tileX, snapshot.centerY - target.tileY);
      }, { timeout: 10_000, intervals: [50, 100] })
      .toBeLessThan(4);

    const afterPan = await readGeometry(page);
    const lookAfterPan = lookAtWorld(afterPan.area);
    await page.screenshot({ path: path.join(EVIDENCE, "01-after-pan.png"), animations: "disabled" });

    await page.getByTestId("editor-zoom-next").click();
    await expect.poll(async () => (await readGeometry(page)).camera.zoom, { timeout: 5_000 }).toBeGreaterThan(beforePan.camera.zoom);

    const afterZoom = await readGeometry(page);
    const lookAfterZoom = lookAtWorld(afterZoom.area);
    await page.screenshot({ path: path.join(EVIDENCE, "02-after-zoom.png"), animations: "disabled" });

    const lookDeltaTiles = Math.hypot(
      (lookAfterZoom.x - lookAfterPan.x) / TILE_SIZE,
      (lookAfterZoom.y - lookAfterPan.y) / TILE_SIZE,
    );
    const distanceToMapCenterTiles = Math.hypot(
      lookAfterZoom.x / TILE_SIZE - mapCenterTile.x,
      lookAfterZoom.y / TILE_SIZE - mapCenterTile.y,
    );

    expect(
      lookDeltaTiles,
      `줌 뒤 look-at 이 ${lookDeltaTiles.toFixed(2)}타일 움직였다 (팬 후 ${lookAfterPan.x.toFixed(1)},${lookAfterPan.y.toFixed(1)} → ${lookAfterZoom.x.toFixed(1)},${lookAfterZoom.y.toFixed(1)})`,
    ).toBeLessThan(1.5);
    expect(
      distanceToMapCenterTiles,
      `줌 뒤 look-at 이 맵 중앙 (${mapCenterTile.x},${mapCenterTile.y})에서 ${distanceToMapCenterTiles.toFixed(2)}타일 — 예전 버그는 여기로 붙었다`,
    ).toBeGreaterThan(3);

    console.log(JSON.stringify({
      map,
      target,
      lookAfterPan,
      lookAfterZoom,
      zoomBefore: afterPan.camera.zoom,
      zoomAfter: afterZoom.camera.zoom,
      lookDeltaTiles,
      distanceToMapCenterTiles,
      unoccluded: afterZoom.area.unoccluded,
      canvas: afterZoom.area.canvas,
    }, null, 2));
  });

  test("기록을 펼치면 가시 사각형이 캔버스 전체와 같지 않다", async ({ page }) => {
    await bootEditor(page);
    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) await restore.click();
    await expect(page.getByTestId("ai-command-bar")).toBeVisible();

    await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('[data-testid="ai-panel"]');
      if (!panel) return;
      panel.classList.remove("is-assistant-idle", "is-collapsed");
      panel.classList.add("is-assistant-log-open");
      panel.style.setProperty("--ai-float-log-height", "280px");
      const log = panel.querySelector<HTMLElement>('[data-testid="ai-chat-log"]')
        ?? panel.querySelector<HTMLElement>('[data-testid="ai-chat-body"]');
      if (log && log.childElementCount === 0) {
        const filler = document.createElement("div");
        filler.style.minHeight = "240px";
        filler.textContent = "기록";
        log.append(filler);
      }
    });

    await expect
      .poll(async () => page.evaluate(() => {
        const area = (window as unknown as EditorWindow).__oprnEditVisibleArea?.();
        const body = document.querySelector<HTMLElement>('[data-testid="ai-chat-body"]');
        if (!area || !body) return 0;
        const bodyBox = body.getBoundingClientRect();
        if (bodyBox.height < 80) return 0;
        const dw = Math.abs(area.canvas.width - area.unoccluded.width);
        const dh = Math.abs(area.canvas.height - area.unoccluded.height);
        const dx = Math.abs(area.canvas.x - area.unoccluded.x);
        const dy = Math.abs(area.canvas.y - area.unoccluded.y);
        return Math.max(dw, dh, dx, dy);
      }), { timeout: 15_000, intervals: [250, 250] })
      .toBeGreaterThan(40);

    const area = await page.evaluate(() => (window as unknown as EditorWindow).__oprnEditVisibleArea?.() ?? null);
    await page.screenshot({ path: path.join(EVIDENCE, "03-log-open-occlusion.png"), animations: "disabled" });
    console.log(JSON.stringify({ canvas: area?.canvas, unoccluded: area?.unoccluded }, null, 2));
    expect(area?.unoccluded.width ?? 0, "가림을 뺀 폭이 캔버스와 같다 — 오른쪽 기록 카드를 못 뺐다").toBeLessThan((area?.canvas.width ?? 0) - 20);
  });
});
