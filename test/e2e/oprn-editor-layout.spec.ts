import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const COMPACT_SHELL_VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

const COMPACT_SHELL_MODES = ["basic", "expert"] as const;
const COMPACT_SHELL_EVIDENCE_DIR = process.env.SHELL_EVIDENCE_DIR;

type CompactShellMode = (typeof COMPACT_SHELL_MODES)[number];
type CompactShellViewport = (typeof COMPACT_SHELL_VIEWPORTS)[number];
type CompactShellMetric = {
  readonly mode: CompactShellMode;
  readonly viewport: CompactShellViewport;
  readonly bodyWidth: number;
  readonly documentWidth: number;
  readonly regions: Readonly<Record<string, { readonly bottom: number; readonly left: number; readonly right: number; readonly top: number }>>;
  // Beginner icon rail computed style — runtime contract migrated from the
  // editor-ui-modes.css regex pin (overflow visible / z-index var(--z-rail) / 72px width).
  readonly leftPanelRail:
    | {
        readonly overflow: string;
        readonly overflowX: string;
        readonly overflowY: string;
        readonly zIndex: string;
        readonly width: number;
      }
    | null;
};

async function expectNoDocumentHorizontalOverflow(page: Page): Promise<void> {
  await expect.poll(async () =>
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
  ).toBe(true);
}

async function expectCenterClickable(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { state: "visible" });
  const receivesPointer = await page.evaluate((targetSelector) => {
    const node = document.querySelector(targetSelector);
    if (!(node instanceof HTMLElement)) return false;
    node.scrollIntoView({ block: "nearest", inline: "nearest" });
    const box = node.getBoundingClientRect();
    const x = Math.floor(box.left + box.width / 2);
    const y = Math.floor(box.top + box.height / 2);
    const target = document.elementFromPoint(x, y);
    return target === node || Boolean(target?.closest(targetSelector));
  }, selector);
  expect(receivesPointer).toBe(true);
}

async function readCompactShellMetric(page: Page, mode: CompactShellMode, viewport: CompactShellViewport): Promise<CompactShellMetric> {
  return page.evaluate(({ expectedMode, expectedViewport }) => {
    const regionSelectors = {
      canvas: '[data-testid="edit-canvas"]',
      editorRoot: '[data-testid="editor-layout"]',
      leftPanel: ".left-panel",
      saveBanner: '[data-testid="save-skip-banner"]',
      topbar: ".topbar",
    };
    const longKoreanName = "달빛이 머무는 아주 긴 한국어 프로젝트와 지도 이름".repeat(4);
    const title = document.querySelector<HTMLElement>(".oprn-toolbar .title");
    if (title) title.textContent = longKoreanName;

    const regions = Object.fromEntries(
      Object.entries(regionSelectors).map(([name, selector]) => {
        const node = document.querySelector<HTMLElement>(selector);
        if (!node) throw new Error(`missing compact-shell region: ${name}`);
        const box = node.getBoundingClientRect();
        return [name, { bottom: box.bottom, left: box.left, right: box.right, top: box.top }];
      })
    );
    const leftPanelNode = document.querySelector<HTMLElement>(".left-panel");
    const leftPanelStyle = leftPanelNode ? getComputedStyle(leftPanelNode) : null;
    return {
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      mode: expectedMode,
      regions,
      viewport: expectedViewport,
      leftPanelRail: leftPanelStyle && leftPanelNode
        ? {
            overflow: leftPanelStyle.overflow,
            overflowX: leftPanelStyle.overflowX,
            overflowY: leftPanelStyle.overflowY,
            zIndex: leftPanelStyle.zIndex,
            width: leftPanelNode.getBoundingClientRect().width,
          }
        : null,
    };
  }, { expectedMode: mode, expectedViewport: viewport });
}

async function recordCompactShellEvidence(page: Page, metric: CompactShellMetric): Promise<void> {
  if (!COMPACT_SHELL_EVIDENCE_DIR) return;
  await mkdir(COMPACT_SHELL_EVIDENCE_DIR, { recursive: true });
  const fileStem = `${metric.viewport.width}x${metric.viewport.height}-${metric.mode}`;
  await page.screenshot({ path: join(COMPACT_SHELL_EVIDENCE_DIR, `${fileStem}.png`) });
  await appendFile(join(COMPACT_SHELL_EVIDENCE_DIR, "metrics.ndjson"), `${JSON.stringify(metric)}\n`, "utf8");
}

function byteDistance(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length);
  let diff = Math.abs(a.length - b.length);
  for (let i = 0; i < length; i++) {
    diff += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  }
  return diff;
}

async function findCanvasPointByCursor(
  page: Page,
  predicate: (cursor: { readonly lower: string; readonly upper: string; readonly position: string }) => boolean
): Promise<{ readonly x: number; readonly y: number }> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const fractions = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75];
  for (const fy of fractions) {
    for (const fx of fractions) {
      const point = { x: Math.floor(box.x + box.width * fx), y: Math.floor(box.y + box.height * fy) };
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(30);
      const position = await page.getByTestId("cursor-position").textContent() ?? "";
      const lower = await page.getByTestId("cursor-lower").textContent() ?? "";
      const upper = await page.getByTestId("cursor-upper").textContent() ?? "";
      if (predicate({ lower, upper, position })) return point;
    }
  }
  throw new Error("missing matching canvas point");
}

test("editor shell contains Basic and Expert regions at every supported viewport", async ({ page }) => {
  // 2 modes × 3 viewports, each a full app boot — well beyond the 30s default.
  test.setTimeout(120_000);
  if (COMPACT_SHELL_EVIDENCE_DIR) {
    await mkdir(COMPACT_SHELL_EVIDENCE_DIR, { recursive: true });
    await writeFile(join(COMPACT_SHELL_EVIDENCE_DIR, "metrics.ndjson"), "", "utf8");
  }
  for (const mode of COMPACT_SHELL_MODES) {
    const modePage = await page.context().newPage();
    const browserIssues: string[] = [];
    modePage.on("console", (message) => {
      const isOptionalBridgeRefusal = message.text() === "Failed to load resource: net::ERR_CONNECTION_REFUSED";
      if (message.type() === "error" && !isOptionalBridgeRefusal) browserIssues.push(`console: ${message.text()}`);
    });
    modePage.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));
    modePage.on("requestfailed", (request) => {
      const errorText = request.failure()?.errorText ?? "unknown";
      if (!request.url().includes("127.0.0.1:17831") && errorText !== "net::ERR_ABORTED") browserIssues.push(`requestfailed: ${request.url()} ${errorText}`);
    });
    await modePage.addInitScript((editorUiMode) => localStorage.setItem("oprn:editor-ui-mode", editorUiMode), mode);
    for (const viewport of COMPACT_SHELL_VIEWPORTS) {
      await modePage.setViewportSize(viewport);
      await modePage.goto(`/?freshProject=1&layoutContract=${viewport.width}`);
      await expect(modePage.getByTestId("edit-canvas")).toBeVisible();
      await expect(modePage.locator("body")).toHaveClass(new RegExp(`editor-ui-${mode === "basic" ? "beginner" : mode}`));
      const metric = await readCompactShellMetric(modePage, mode, viewport);
      await recordCompactShellEvidence(modePage, metric);
      expect(metric.documentWidth).toBeLessThanOrEqual(viewport.width);
      expect(metric.bodyWidth).toBeLessThanOrEqual(viewport.width);
      for (const region of Object.values(metric.regions)) {
        expect(region.left).toBeGreaterThanOrEqual(0);
        expect(region.right).toBeLessThanOrEqual(viewport.width);
        expect(region.top).toBeGreaterThanOrEqual(0);
        expect(region.bottom).toBeLessThanOrEqual(viewport.height);
      }
      if (mode === "basic") {
        // Beginner 72px icon rail contract (migrated from the editor-ui-modes.css regex pin):
        // flyouts spill right over the map, so the panel must stay unclipped (overflow visible),
        // float above the canvas (z-index: var(--z-rail) → 50), and keep its measured 72px width.
        expect(metric.leftPanelRail).not.toBeNull();
        expect(metric.leftPanelRail?.overflow).toBe("visible");
        expect(metric.leftPanelRail?.overflowX).toBe("visible");
        expect(metric.leftPanelRail?.overflowY).toBe("visible");
        expect(metric.leftPanelRail?.zIndex).toBe("50");
        expect(metric.leftPanelRail?.width).toBe(72);
      }
    }
    expect(browserIssues).toEqual([]);
    await modePage.close();
  }

  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto("/?freshProject=1&layoutContract=clickability");
  await expectCenterClickable(page, "[data-testid='toolbar-database']");
  await expectCenterClickable(page, "[data-testid='tool-pan']");
  await expectCenterClickable(page, "[data-testid='layer-event']");
  await page.getByTestId("toolbar-database").click();
  await expectCenterClickable(page, "[data-testid='db-tab-enemies']");
  await page.getByTestId("database-modal-close").click();
  await page.getByTestId("toolbar-resource-manager").click();
  await expectCenterClickable(page, "[data-testid='resource-kind-select']");
  await page.getByTestId("resource-modal-close").click();
  await expectCenterClickable(page, "[data-testid='edit-canvas'] canvas");
  await expectNoDocumentHorizontalOverflow(page);
});

test("left mode tabs never resize the editor workspace frame", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1&leftFrameInvariant=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible();

  const reference = await editorWorkspaceFrame(page);
  for (const testId of ["layer-lower", "layer-upper", "layer-event"] as const) {
    await page.getByTestId(testId).click();
    const current = await editorWorkspaceFrame(page);
    expect(Math.abs(current.canvasWidth - reference.canvasWidth), `${testId} canvas width`).toBeLessThanOrEqual(1);
    expect(Math.abs(current.canvasHeight - reference.canvasHeight), `${testId} canvas height`).toBeLessThanOrEqual(1);
    expect(Math.abs(current.leftWidth - reference.leftWidth), `${testId} left panel width`).toBeLessThanOrEqual(1);
    expect(Math.abs(current.leftHeight - reference.leftHeight), `${testId} left panel height`).toBeLessThanOrEqual(1);
  }
});

async function editorWorkspaceFrame(page: Page): Promise<{
  readonly canvasHeight: number;
  readonly canvasWidth: number;
  readonly leftHeight: number;
  readonly leftWidth: number;
}> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>("[data-testid='edit-canvas']");
    const left = document.querySelector<HTMLElement>(".left-panel");
    if (!canvas || !left) throw new Error("missing editor workspace frame");
    const canvasRect = canvas.getBoundingClientRect();
    const leftRect = left.getBoundingClientRect();
    return {
      canvasHeight: Math.round(canvasRect.height),
      canvasWidth: Math.round(canvasRect.width),
      leftHeight: Math.round(leftRect.height),
      leftWidth: Math.round(leftRect.width),
    };
  });
}

test("chipset palette exposes category-only vertical scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto("/?freshProject=1&paletteVerticalCategoryScroll=1");

  const palette = page.getByTestId("tile-palette");
  await expect(palette).toBeVisible();
  await page.getByTestId("chipset-band-a3").click();
  await expect(page.getByTestId("chipset-band-a3")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("chipset-band-a1")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("chipset-tile-0")).toHaveCount(0);
  await expect.poll(async () => page.locator("[data-testid^='chipset-tile-']").count()).toBeGreaterThan(0);
  const initialMetrics = await palette.evaluate((node) => ({
    clientWidth: node.clientWidth,
    clientHeight: node.clientHeight,
    scrollLeft: node.scrollLeft,
    scrollTop: node.scrollTop,
    scrollWidth: node.scrollWidth,
    scrollHeight: node.scrollHeight,
  }));
  expect(initialMetrics.scrollWidth).toBeLessThanOrEqual(initialMetrics.clientWidth);
  expect(initialMetrics.scrollLeft).toBe(0);
  expect(initialMetrics.scrollTop).toBe(0);

  await palette.evaluate((node) => {
    node.scrollTop = 120;
  });
  await expect.poll(() => palette.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByTestId("chipset-scroll-right")).toHaveCount(0);
});

test("chipset palette keeps its scroll position when selecting a visible scrolled tile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 520 });
  await page.goto("/?freshProject=1&paletteSelectKeepsScroll=1");

  const palette = page.getByTestId("tile-palette");
  const paletteRoot = page.getByTestId("left-palette-root");
  const visibleTileTestId = await palette.evaluate((node) => {
    node.scrollTop = 120;
    const sheetBox = node.getBoundingClientRect();
    const cells = Array.from(node.querySelectorAll("[data-testid^='chipset-tile-']"));
    const visibleCell = cells.find((cell) => {
      if (!(cell instanceof HTMLElement)) return false;
      const box = cell.getBoundingClientRect();
      return box.top >= sheetBox.top && box.bottom <= sheetBox.bottom;
    });
    return visibleCell instanceof HTMLElement ? visibleCell.dataset.testid ?? "" : "";
  });
  const beforeClick = await palette.evaluate((node) => node.scrollTop);
  const beforeRootScroll = await paletteRoot.evaluate((node) => node.scrollTop);
  expect(beforeClick).toBeGreaterThan(0);
  expect(visibleTileTestId).toContain("chipset-tile-");

  await page.getByTestId(visibleTileTestId).click();
  await expect(page.getByTestId("selected-tile-status")).not.toContainText("없음");
  await expect.poll(() => page.getByTestId("tile-palette").evaluate((node) => node.scrollTop)).toBe(beforeClick);
  await expect.poll(() => page.getByTestId("left-palette-root").evaluate((node) => node.scrollTop)).toBe(beforeRootScroll);
});

test("chipset palette routes vertical wheel scrolling while hovering tiles", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?freshProject=1&paletteVerticalWheel=1");

  const palette = page.getByTestId("tile-palette");
  const paletteRoot = page.getByTestId("left-palette-root");
  await expect(palette).toBeVisible();

  const box = await palette.boundingBox();
  if (!box) throw new Error("missing tile palette");
  await page.mouse.move(Math.floor(box.x + box.width / 2), Math.floor(box.y + box.height / 2));

  const before = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="left-palette-root"]');
    const sheet = document.querySelector('[data-testid="tile-palette"]');
    if (!(root instanceof HTMLElement) || !(sheet instanceof HTMLElement)) return 0;
    return root.scrollTop + sheet.scrollTop;
  });
  await page.mouse.wheel(0, 500);
  await expect.poll(async () => {
    return page.evaluate(() => {
      const root = document.querySelector('[data-testid="left-palette-root"]');
      const sheet = document.querySelector('[data-testid="tile-palette"]');
      if (!(root instanceof HTMLElement) || !(sheet instanceof HTMLElement)) return 0;
      return root.scrollTop + sheet.scrollTop;
    });
  }).toBeGreaterThan(before);
  await expect(paletteRoot).toBeVisible();
});

test("left sidebar keeps an RM2000-style compact palette over map tree", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&leftSidebarReference=1");

  const leftPanel = page.locator(".left-panel");
  const paletteRoot = page.getByTestId("left-palette-root");
  const mapRoot = page.getByTestId("left-map-root");
  const chipset = page.getByTestId("tile-palette");

  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await expect(leftPanel).toBeVisible();
  await expect(paletteRoot).toBeVisible();
  await expect(mapRoot).toBeVisible();
  await expect(chipset).toBeVisible();

  const metrics = await page.evaluate(() => {
    const panel = document.querySelector(".left-panel");
    const palette = document.querySelector('[data-testid="left-palette-root"]');
    const map = document.querySelector('[data-testid="left-map-root"]');
    // 구 quick-tile-toggle(「찾기」 탭 버튼)은 좌패널 1면 통합으로 사라졌다 —
    // 이제 검색은 상시 노출되는 필터 바다. (2026-08-21)
    const filterBar = document.querySelector('[data-testid="palette-filter-bar"]');
    const chipsetPalette = document.querySelector('[data-testid="tile-palette"]');
    const chipsetGrid = document.querySelector('[data-testid="chipset-sheet"]');
    const firstChipsetTile = document.querySelector("[data-testid^='chipset-tile-']");
    if (
      !(panel instanceof HTMLElement) ||
      !(palette instanceof HTMLElement) ||
      !(map instanceof HTMLElement) ||
      !(filterBar instanceof HTMLElement) ||
      !(chipsetPalette instanceof HTMLElement) ||
      !(chipsetGrid instanceof HTMLElement) ||
      !(firstChipsetTile instanceof HTMLElement)
    ) {
      return null;
    }
    const panelBox = panel.getBoundingClientRect();
    const paletteBox = palette.getBoundingClientRect();
    const mapBox = map.getBoundingClientRect();
    const filterBarBox = filterBar.getBoundingClientRect();
    const gridBox = chipsetGrid.getBoundingClientRect();
    const cellBox = firstChipsetTile.getBoundingClientRect();
    const cellStyle = getComputedStyle(firstChipsetTile);
    const paletteStyle = getComputedStyle(chipsetPalette);
    return {
      atlasColumns: Number.parseFloat(paletteStyle.getPropertyValue("--chipset-cols")),
      cellBackgroundWidth: Number.parseFloat(cellStyle.backgroundSize),
      cellHeight: cellBox.height,
      cellWidth: cellBox.width,
      gridContentWidth: gridBox.width - 4,
      panelWidth: panelBox.width,
      paletteTopOffset: filterBarBox.top - paletteBox.top,
      paletteHeight: paletteBox.height,
      mapHeight: mapBox.height,
      chipsetColumnCount: getComputedStyle(chipsetGrid).gridTemplateColumns.split(" ").length,
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics?.panelWidth).toBeLessThanOrEqual(268);
  expect(metrics?.chipsetColumnCount).toBe(6);
  expect(metrics?.cellWidth).toBeGreaterThan(34);
  expect(Math.abs((metrics?.cellWidth ?? 0) - (metrics?.cellHeight ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((metrics?.cellWidth ?? 0) * 6 + 5 - (metrics?.gridContentWidth ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((metrics?.cellBackgroundWidth ?? 0) - (metrics?.cellWidth ?? 0) * (metrics?.atlasColumns ?? 0))).toBeLessThanOrEqual(2);
  expect(metrics?.paletteTopOffset).toBeLessThanOrEqual(220);
  expect(metrics?.paletteHeight).toBeGreaterThan(metrics?.mapHeight ?? 0);
  expect(metrics?.mapHeight).toBeGreaterThanOrEqual(150);
});

// 좌패널 1면 통합(2026-08-21). 예전 이름은 "quick tile picker" — 「찾기」 탭이 별개
// 그리드(quick-tile-*)로 타일셋을 두 번째로 그렸고, 거기서 고른 타일은 그 자리에서
// 칠할 수 없었다(그리기 툴바가 「칠하기」 탭에만 있었다). 이제 검색·분류는 상시 노출
// 필터 바이고 **본 팔레트(chipset-tile-*)** 를 직접 걸러낸다.
test("검색·분류 필터가 본 팔레트를 직접 걸러낸다 (별개 그리드 없음)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await page.goto("/?freshProject=1&quickTilePicker=1");

  // 별개 그리드는 더 이상 존재하지 않는다.
  await expect(page.getByTestId("quick-tile-picker")).toHaveCount(0);
  await expect(page.getByTestId("quick-tile-toggle")).toHaveCount(0);
  // 작업 탭도 사라졌다.
  await expect(page.getByTestId("palette-work-tab-paint")).toHaveCount(0);
  await expect(page.getByTestId("palette-work-tab-props")).toHaveCount(0);

  // 필터 바는 탭을 누르지 않아도 처음부터 보인다.
  await expect(page.getByTestId("palette-filter-bar")).toBeVisible();
  await expect(page.getByTestId("layer-selector")).toContainText("3단 레이어");
  await expect(page.getByTestId("layer-lower")).toContainText("바닥");
  await expect(page.getByTestId("layer-upper")).toContainText("상위");
  await expect(page.getByTestId("layer-event")).toContainText("이벤트");

  // 그리기 툴바가 팔레트와 같은 면에 있다 — 고른 타일을 탭 전환 없이 칠할 수 있다.
  await expect(page.getByTestId("tile-palette")).toBeVisible();
  await expect(page.getByTestId("tool-paint")).toBeVisible();

  const paletteRoot = page.getByTestId("left-palette-root");
  const visibleChipsetTiles = () => page.locator("[data-testid^='chipset-tile-']").count();
  const unfilteredCount = await visibleChipsetTiles();
  expect(unfilteredCount).toBeGreaterThan(20);

  // 검색은 팔레트 자체를 줄인다.
  await page.getByTestId("tile-search-input").fill("132");
  await expect(page.getByTestId("chipset-tile-132")).toBeVisible();
  await expect.poll(visibleChipsetTiles).toBeLessThan(unfilteredCount);
  await expect(page.getByTestId("palette-filter-status")).toBeVisible();

  await page.getByTestId("chipset-tile-132").click();
  await expect(page.getByTestId("selected-tile-status")).toContainText("132");

  // 번호 오버레이 토글 — 셀이 400개를 넘어 span 대신 CSS(::before)로 그린다.
  await expect(page.getByTestId("tile-palette")).not.toHaveClass(/show-index/);
  await page.getByTestId("tile-number-toggle").click();
  await expect(page.getByTestId("tile-palette")).toHaveClass(/show-index/);

  // 필터 해제로 전량 복귀.
  await page.getByTestId("palette-filter-clear").click();
  await expect(page.getByTestId("palette-filter-status")).toHaveCount(0);
  await expect.poll(visibleChipsetTiles).toBe(unfilteredCount);

  // 타일을 골라도 팔레트 스크롤이 튀지 않는다 (기존 계약 유지).
  await paletteRoot.evaluate((node) => {
    node.scrollTop = node.scrollHeight - node.clientHeight;
  });
  const beforeSelectScroll = await paletteRoot.evaluate((node) => node.scrollTop);
  await page.getByTestId("chipset-tile-379").click();
  await expect(page.getByTestId("selected-tile-status")).toContainText("379");
  await expect.poll(() => paletteRoot.evaluate((node) => node.scrollTop)).toBe(beforeSelectScroll);
});

test("left sidebar tool buttons use visible icons with accessible names", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&leftSidebarIcons=1");

  // 2026-07-18: 구 tool-grid 8버튼 섹션은 통합 툴바(oprn-tile-toolbar)로 흡수됨.
  // testid는 승계, 아이콘은 rm-tool-icon(CSS) → SVG.
  const expectedTools = [
    { testId: "tool-paint", label: "칠하기" },
    { testId: "tool-fill", label: "채우기" },
    { testId: "tool-eyedropper", label: "타일 집기" },
    { testId: "tool-pan", label: "이동" },
    { testId: "tool-select", label: "영역 선택" },
    { testId: "tool-collision", label: "통행" },
    { testId: "tool-event", label: "이벤트" },
    { testId: "tool-erase", label: "지우기" },
  ] as const;

  for (const tool of expectedTools) {
    const button = page.getByTestId(tool.testId);
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-label", tool.label);
    await expect(button.locator("svg")).toBeVisible();
  }

  await expect(page.getByTestId("tool-grid")).not.toContainText("타일 집기");
});

test("map tree uses an RM2K3-style tree box with context menu actions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&mapTreeTileComfort=1");

  const mapTree = page.getByTestId("map-tree");
  await expect(mapTree).toHaveClass(/map-tree-panel/);
  await expect(mapTree.locator("[data-testid^='map-add-child-']")).toHaveCount(0);
  await expect(mapTree.locator("[data-testid^='map-delete-']")).toHaveCount(0);
  await expect(mapTree.locator(".oprn-icon-folder")).toBeVisible();

  const beforeNodeCount = await mapTree.locator("[data-testid^='map-tree-node-']").count();
  await mapTree.locator("[data-testid^='map-tree-node-']").first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "하위 맵 추가" })).toBeVisible();
  await page.getByRole("menuitem", { name: "하위 맵 추가" }).click();
  await page.getByTestId("map-create-confirm").click();
  await expect.poll(async () => mapTree.locator("[data-testid^='map-tree-node-']").count()).toBe(beforeNodeCount + 1);
  await expect(mapTree.locator(".oprn-icon-map-node").first()).toBeVisible();
  const rowToggle = mapTree.locator("[data-testid^='map-toggle-']:not([data-testid='map-toggle-all'])").first();
  await expect(rowToggle).toHaveAttribute("aria-expanded", "true");
  await rowToggle.click();
  await expect.poll(async () => mapTree.locator("[data-testid^='map-tree-node-']").count()).toBe(1);
  await rowToggle.click();
  await expect.poll(async () => mapTree.locator("[data-testid^='map-tree-node-']").count()).toBe(beforeNodeCount + 1);
  await expect(mapTree.locator("[data-testid^='map-tree-node-']").nth(1)).toHaveAttribute("draggable", "false");
  await expect(mapTree.locator("[data-testid^='map-drag-']").first()).toHaveAttribute("draggable", "true");
});

test("map tree context menu is accessible from mouse, keyboard, and action button", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&mapTreeContextMenu=1");

  const mapTree = page.getByTestId("map-tree");
  const rootNode = mapTree.locator("[data-testid^='map-tree-node-']").first();
  await rootNode.click({ button: "right" });
  await page.getByRole("menuitem", { name: "하위 맵 추가" }).click();
  await page.getByTestId("map-create-confirm").click();
  const beforeNodeCount = await mapTree.locator("[data-testid^='map-tree-node-']").count();

  await rootNode.click({ button: "right" });
  const menu = page.getByRole("menu", { name: /맵 메뉴/ });
  await expect(menu).toBeVisible();
  await expect(rootNode).toHaveClass(/active/);
  await expect(page.getByRole("menuitem", { name: "맵 설정" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "하위 맵 추가" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "복제" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "삭제 Del" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "맵 밀기" })).toBeVisible();
  await page.getByRole("menuitem", { name: "맵 설정" }).click();
  await expect(page.locator("[data-testid^='map-properties-modal-']")).toBeVisible();
  await page.locator("[data-testid^='map-properties-modal-'] .event-subdialog-close").click();

  await rootNode.click({ button: "right" });
  await page.getByRole("menuitem", { name: "맵 밀기" }).click();
  await expect(page.locator("[data-testid^='map-shift-modal-']")).toBeVisible();
  await page.locator("[data-testid^='map-shift-modal-'] .event-subdialog-close").click();

  await rootNode.click({ button: "right" });
  await expect(page.getByRole("menu", { name: /맵 메뉴/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: /맵 메뉴/ })).toHaveCount(0);

  await rootNode.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu", { name: /맵 메뉴/ })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: /맵 메뉴/ })).toHaveCount(0);

  await mapTree.locator("[data-testid^='map-context-trigger-']").first().click();
  await expect(page.getByRole("menu", { name: /맵 메뉴/ })).toBeVisible();
  await page.getByRole("menuitem", { name: "복제" }).click();
  await expect.poll(async () => mapTree.locator("[data-testid^='map-tree-node-']").count()).toBe(beforeNodeCount + 1);

  await mapTree.locator("[data-testid^='map-context-trigger-']").first().click();
  await expect(page.getByRole("menu", { name: /맵 메뉴/ })).toBeVisible();
  await page.mouse.click(600, 120);
  await expect(page.getByRole("menu", { name: /맵 메뉴/ })).toHaveCount(0);
});

test("right click picks the tile under the cursor and layer mode is visually distinct", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?devProject=1&logCabinShowcase=1&focusX=4&focusY=1&rightClickEyedropper=1");

  await page.getByTestId("layer-upper").click();
  await expect(page.getByTestId("layer-upper")).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("layer-selector")).toContainText("3단 레이어");
  const roofTile = await findCanvasPointByCursor(page, ({ lower, upper }) => lower === "374" || upper === "374");
  const clip = { x: roofTile.x - 80, y: roofTile.y - 80, width: 160, height: 160 };
  const upperLayerView = await page.screenshot({ clip });

  await page.mouse.click(roofTile.x, roofTile.y, { button: "right" });
  await expect(page.getByTestId("selected-tile-status")).toContainText("374");

  await page.getByTestId("layer-lower").click();
  await expect(page.getByTestId("layer-lower")).toHaveAttribute("aria-current", "true");
  await expect.poll(async () => byteDistance(upperLayerView, await page.screenshot({ clip }))).toBeGreaterThan(24);
});

test("right click picks the visible upper tile even when lower layer is active", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?devProject=1&logCabinShowcase=1&focusX=4&focusY=1&rightClickVisibleTop=1");

  await page.getByTestId("layer-lower").click();
  await expect(page.getByTestId("layer-lower")).toHaveAttribute("aria-current", "true");
  const target = await findCanvasPointByCursor(page, ({ lower, upper }) => upper !== "-1" && upper !== "" && upper !== lower);

  const upperTile = await page.getByTestId("cursor-upper").textContent() ?? "";
  await page.mouse.click(target.x, target.y, { button: "right" });

  await expect(page.getByTestId("selected-tile-status")).toContainText(upperTile);
  await expect(page.getByTestId("editor-statusbar")).toHaveCount(0);
});

test("middle mouse drag pans the map without changing the selected layer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?logCabinShowcase=1&middleMousePan=1&focusX=16&focusY=13");

  await page.getByTestId("layer-upper").click();
  await expect(page.getByTestId("layer-upper")).toHaveAttribute("aria-current", "true");

  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const before = await canvas.screenshot();
  const start = { x: Math.floor(box.x + box.width * 0.62), y: Math.floor(box.y + box.height * 0.52) };
  const end = { x: start.x - 220, y: start.y };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up({ button: "middle" });

  await expect.poll(async () => byteDistance(before, await canvas.screenshot())).toBeGreaterThan(1000);
  await expect(page.getByTestId("layer-upper")).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("tool-paint")).toHaveAttribute("aria-pressed", "true");
});

test("selected tile is previewed on map hover before placement", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&tileHoverPreview=1");

  await page.getByTestId("chipset-band-a3").click();
  await page.getByTestId("chipset-tile-132").click();
  await expect(page.getByTestId("selected-tile-status")).toContainText("132");

  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const target = await findCanvasPointByCursor(page, ({ lower, position, upper }) =>
    /^\d+,\d+$/.test(position) && lower !== "132" && upper === "-1"
  );
  const away = {
    x: Math.floor(target.x > box.x + box.width / 2 ? box.x + 40 : box.x + box.width - 40),
    y: Math.floor(target.y > box.y + box.height / 2 ? box.y + 40 : box.y + box.height - 40),
  };
  const clip = { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.floor(box.width), height: Math.floor(box.height) };
  await page.mouse.move(away.x, away.y);
  await page.waitForTimeout(50);
  const before = await page.screenshot({ clip });

  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.waitForTimeout(50);
  await expect.poll(async () => byteDistance(before, await page.screenshot({ clip }))).toBeGreaterThan(24);
});
