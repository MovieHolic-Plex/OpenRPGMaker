import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

type DebugState = {
  project: {
    startMapId: string;
    maps: Record<string, { width: number; height: number }>;
  };
  editor: {
    currentMapId: string | null;
    selection: { mapId: string; x: number; y: number; width: number; height: number } | null;
    tool: string;
    zoom: number;
  };
};

const EVIDENCE_DIR = path.resolve("output/evidence/canvas-chip-fix");

async function debugState(page: Page): Promise<DebugState> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  return JSON.parse(text) as DebugState;
}

/** 드래그를 수행하고 **놓은 점의 뷰포트 좌표**를 돌려준다 — 칩 바 위치 단정이 이걸 쓴다. */
async function dragMapFromVisiblePoint(
  page: Page,
  dxTiles: number,
  dyTiles: number,
): Promise<{ readonly x: number; readonly y: number }> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const state = await debugState(page);
  const zoom = state.editor.zoom || 2;
  const tilePx = 16 * zoom;
  const start = { x: Math.floor(box.width * 0.4), y: Math.floor(box.height * 0.4) };
  const end = {
    x: start.x + Math.round(dxTiles * tilePx),
    y: start.y + Math.round(dyTiles * tilePx),
  };
  await page.mouse.move(box.x + start.x, box.y + start.y);
  await page.mouse.down();
  await page.mouse.move(box.x + end.x, box.y + end.y, { steps: 8 });
  await page.mouse.up();
  return { x: box.x + end.x, y: box.y + end.y };
}

test("canvas fills chrome-safe area and selection chips overlay without reflow", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1601, height: 769 });
  // Expert density so side AI dock + dense chrome match the reported layout.
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    // AI dock starts collapsed by design — pin it open so the docked layout is measured.
    localStorage.setItem("oprn:ai-panel-collapsed", "0");
  });
  await page.goto("/?freshProject=1&m1MapEditor=1");

  await expect(page.getByTestId("edit-canvas")).toBeVisible();
  await expect(page.getByTestId("editor-canvas-scroll-shell")).toBeVisible();
  await expect(page.getByTestId("editor-statusbar")).toHaveCount(0);
  // Phaser creates the canvas a beat after the container — wait for the real node.
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const area = document.querySelector(".canvas-area") as HTMLElement | null;
    const shell = document.querySelector("[data-testid='editor-canvas-scroll-shell']") as HTMLElement | null;
    const host = document.querySelector("[data-testid='edit-canvas']") as HTMLElement | null;
    const canvas = host?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!area || !shell || !host || !canvas) throw new Error("missing layout nodes");
    const areaRect = area.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const hostStyle = getComputedStyle(host);
    return {
      area: { w: areaRect.width, h: areaRect.height },
      shell: { w: shellRect.width, h: shellRect.height, top: shellRect.top - areaRect.top, bottomGap: areaRect.bottom - shellRect.bottom },
      host: { w: hostRect.width, h: hostRect.height, display: hostStyle.display, position: hostStyle.position },
      canvas: { w: canvasRect.width, h: canvasRect.height, attrW: canvas.width, attrH: canvas.height },
      fillRatioW: canvasRect.width / shellRect.width,
      fillRatioH: canvasRect.height / shellRect.height,
      bodyClasses: document.body.className,
    };
  });

  // Phaser canvas should nearly fill the scroll shell (not a tiny fixed box).
  expect(metrics.fillRatioW).toBeGreaterThan(0.92);
  expect(metrics.fillRatioH).toBeGreaterThan(0.92);
  // With the bottom statusbar retired, the scroll shell reaches the canvas-area edge.
  expect(metrics.shell.bottomGap).toBeLessThanOrEqual(2);
  expect(metrics.host.display).toBe("block");

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "01-canvas-fill.png"),
    fullPage: true,
  });
  await page.screenshot({ path: testInfo.outputPath("01-canvas-fill.png"), fullPage: true });

  // Select-area drag → selection chips overlay.
  const selectTool = page.getByTestId("tool-select").or(page.getByTestId("toolbar-select-area"));
  await expect(selectTool.first()).toBeVisible();
  await selectTool.first().click();
  const release = await dragMapFromVisiblePoint(page, 4, 3);

  await expect.poll(async () => {
    const sel = (await debugState(page)).editor.selection;
    return sel ? sel.width * sel.height : 0;
  }).toBeGreaterThanOrEqual(4);

  const chips = page.getByTestId("selection-action-chips");
  await expect(chips).toBeVisible();
  await expect(page.getByTestId("selection-chip-ai")).toBeVisible();

  const chipMetrics = await page.evaluate(() => {
    const host = document.querySelector("[data-testid='edit-canvas']") as HTMLElement | null;
    const canvas = host?.querySelector("canvas") as HTMLCanvasElement | null;
    const chipsEl = document.querySelector("[data-testid='selection-action-chips']") as HTMLElement | null;
    if (!host || !canvas || !chipsEl) throw new Error("missing chips nodes");
    const hostRect = host.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const chipRect = chipsEl.getBoundingClientRect();
    const style = getComputedStyle(chipsEl);
    return {
      position: style.position,
      zIndex: style.zIndex,
      left: chipsEl.style.left,
      top: chipsEl.style.top,
      chip: { x: chipRect.left, y: chipRect.top, w: chipRect.width, h: chipRect.height },
      canvas: { x: canvasRect.left, y: canvasRect.top, w: canvasRect.width, h: canvasRect.height },
      host: { w: hostRect.width, h: hostRect.height },
      // After absolute overlay, host size should still track canvas (~full shell).
      hostMatchesCanvasW: Math.abs(hostRect.width - canvasRect.width) < 8,
      hostMatchesCanvasH: Math.abs(hostRect.height - canvasRect.height) < 8,
      chipsInsideHost:
        chipRect.left >= hostRect.left - 2 &&
        chipRect.top >= hostRect.top - 2 &&
        chipRect.right <= hostRect.right + 2 &&
        chipRect.bottom <= hostRect.bottom + 2,
    };
  });

  expect(["absolute", "fixed"]).toContain(chipMetrics.position);
  expect(Number(chipMetrics.zIndex)).toBeGreaterThanOrEqual(30);
  expect(chipMetrics.hostMatchesCanvasW).toBe(true);
  expect(chipMetrics.hostMatchesCanvasH).toBe(true);
  // fixed 는 host overflow 밖 좌표일 수 있어 insideHost 검사는 완화.

  // 칩 바는 **드래그를 놓은 자리**에 붙는다(우하단 고정 FAB 이 아니다). 고정 FAB 단정은
  // 우클릭 제스처가 영역을 잡는 동작으로 되돌아온 뒤(181c2570) 실제 동작과 어긋난 채 남아
  // 있었다 — 정확한 앵커 계약은 test/e2e/right-drag-chips-anchored.spec.ts 가 맡고, 여기서는
  // 레이아웃 스펙의 관심사인 "오버레이가 캔버스 안에 놓이고 놓은 점을 따라간다"만 본다.
  const anchor = await page.evaluate(() => {
    const chipsEl = document.querySelector("[data-testid='selection-action-chips']") as HTMLElement | null;
    const canvas = document.querySelector("[data-testid='edit-canvas'] canvas") as HTMLCanvasElement | null;
    if (!chipsEl || !canvas) throw new Error("missing chips/canvas nodes");
    const chip = chipsEl.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    return {
      midX: (chip.left + chip.right) / 2,
      midY: (chip.top + chip.bottom) / 2,
      insideCanvas:
        chip.left >= c.left - 2 && chip.right <= c.right + 2 && chip.top >= c.top - 2 && chip.bottom <= c.bottom + 2,
    };
  });
  expect(anchor.insideCanvas).toBe(true);
  expect(Math.abs(anchor.midY - release.y)).toBeLessThan(120);
  expect(Math.abs(anchor.midX - release.x)).toBeLessThan(320);

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "02-selection-chips.png"),
    fullPage: true,
  });
  await page.screenshot({ path: testInfo.outputPath("02-selection-chips.png"), fullPage: true });

  // Side AI dock should not look like a free-floating canvas card when docked side.
  const aiDock = await page.evaluate(() => {
    const panel = document.querySelector(".ai-chat-panel") as HTMLElement | null;
    if (!panel) return null;
    const style = getComputedStyle(panel);
    const rect = panel.getBoundingClientRect();
    return {
      classes: panel.className,
      position: style.position,
      width: rect.width,
      height: rect.height,
      isSide: panel.classList.contains("chat-dock-side"),
      isFloat: panel.classList.contains("chat-dock-float"),
    };
  });
  expect(aiDock).toBeTruthy();
  if (aiDock?.isSide) {
    expect(aiDock.position).toBe("relative");
    expect(aiDock.width).toBeGreaterThan(200);
  }

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, "03-ai-dock.png"),
    fullPage: true,
  });

  // Persist metrics for review.
  await page.evaluate((payload) => {
    const pre = document.createElement("pre");
    pre.dataset.testid = "canvas-chip-fix-metrics";
    pre.textContent = JSON.stringify(payload, null, 2);
    pre.hidden = true;
    document.body.append(pre);
  }, { metrics, chipMetrics, aiDock });
});
