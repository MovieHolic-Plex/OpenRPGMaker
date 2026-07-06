import { expect, test, type Page } from "@playwright/test";

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

test("editor sidebars avoid document overflow and keep key controls clickable", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 820 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/?freshProject=1&layoutContract=${viewport.width}`);
    await expectNoDocumentHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto("/?freshProject=1&layoutContract=clickability");
  await expectCenterClickable(page, "[data-testid='toolbar-left-panel']");
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

// 지형 템플릿은 DB → 타일셋 → 구성 탭으로 이사했다(2026-07-05). 툴바 "템플릿" 버튼이 그 탭을 연다.
test("template toolbar button opens the tileset compose tab with the terrain template section", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.goto("/?freshProject=1&toolbarSurfaceSplit=1");

  await page.getByTestId("toolbar-title-screen").click();
  await expect(page.getByTestId("database-modal")).toBeVisible();
  await expect(page.getByTestId("db-tab-tilesets")).toHaveClass(/active/);
  await expect(page.getByTestId("tileset-section-tab-compose")).toHaveClass(/active/);
  await expect(page.getByTestId("terrain-template-modal")).toHaveCount(0);

  const terrainTemplateStyles = await page.getByTestId("terrain-template-section").evaluate((node) => {
    const chip = node.querySelector(".terrain-template-tile-chip");
    const swatch = node.querySelector(".terrain-template-tile-swatch");
    if (!(chip instanceof HTMLElement) || !(swatch instanceof HTMLElement)) return null;
    const chipBox = chip.getBoundingClientRect();
    const swatchBox = swatch.getBoundingClientRect();
    return {
      chipDisplay: getComputedStyle(chip).display,
      chipHeight: chipBox.height,
      swatchHeight: swatchBox.height,
      swatchWidth: swatchBox.width,
    };
  });
  expect(terrainTemplateStyles).toEqual({
    chipDisplay: "grid",
    chipHeight: 32,
    swatchHeight: 32,
    swatchWidth: 32,
  });
});

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
    const quickToggle = document.querySelector('[data-testid="quick-tile-toggle"]');
    const chipsetPalette = document.querySelector('[data-testid="tile-palette"]');
    const chipsetGrid = document.querySelector('[data-testid="chipset-sheet"]');
    const firstChipsetTile = document.querySelector("[data-testid^='chipset-tile-']");
    if (
      !(panel instanceof HTMLElement) ||
      !(palette instanceof HTMLElement) ||
      !(map instanceof HTMLElement) ||
      !(quickToggle instanceof HTMLElement) ||
      !(chipsetPalette instanceof HTMLElement) ||
      !(chipsetGrid instanceof HTMLElement) ||
      !(firstChipsetTile instanceof HTMLElement)
    ) {
      return null;
    }
    const panelBox = panel.getBoundingClientRect();
    const paletteBox = palette.getBoundingClientRect();
    const mapBox = map.getBoundingClientRect();
    const quickToggleBox = quickToggle.getBoundingClientRect();
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
      paletteTopOffset: quickToggleBox.top - paletteBox.top,
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

test("quick tile picker filters AI-labeled tiles without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await page.goto("/?freshProject=1&quickTilePicker=1");

  await expect(page.getByTestId("quick-tile-picker")).toBeHidden();
  await page.getByTestId("quick-tile-toggle").click();
  await expect(page.getByTestId("quick-tile-picker")).toBeVisible();
  await expect(page.getByTestId("layer-selector")).toContainText("3단 레이어");
  await expect(page.getByTestId("layer-lower")).toContainText("하위");
  await expect(page.getByTestId("layer-upper")).toContainText("상위");
  await expect(page.getByTestId("layer-event")).toContainText("이벤트");
  await page.getByTestId("tile-category-house").click();
  await page.getByTestId("tile-search-input").fill("132");
  await expect(page.getByTestId("quick-tile-132")).toBeVisible();
  await page.getByTestId("quick-tile-132").click();
  await expect(page.getByTestId("selected-tile-status")).toContainText("132");
  await page.waitForTimeout(80);

  const paletteRoot = page.getByTestId("left-palette-root");
  await paletteRoot.evaluate((node) => {
    node.scrollTop = node.scrollHeight - node.clientHeight;
  });
  const beforeRootScroll = await paletteRoot.evaluate((node) => node.scrollTop);
  expect(beforeRootScroll).toBeGreaterThan(0);

  await page.getByTestId("tile-category-fence").click();
  await page.getByTestId("tile-search-input").fill("379");
  await expect(page.getByTestId("quick-tile-379")).toBeVisible();
  await expect(page.getByTestId("quick-tile-379").locator(".quick-tile-index")).toBeHidden();
  await page.getByTestId("tile-number-toggle").click();
  await expect(page.getByTestId("quick-tile-379").locator(".quick-tile-index")).toBeVisible();
  const beforeSelectScroll = await paletteRoot.evaluate((node) => node.scrollTop);
  await page.getByTestId("quick-tile-379").click();
  await expect(page.getByTestId("selected-tile-status")).toContainText("379");
  await expect.poll(() => page.getByTestId("left-palette-root").evaluate((node) => node.scrollTop)).toBe(beforeSelectScroll);
});

test("left sidebar tool buttons use visible pixel icons with accessible names", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&leftSidebarIcons=1");

  const expectedTools = [
    { testId: "tool-paint", label: "연필" },
    { testId: "tool-fill", label: "채우기" },
    { testId: "tool-eyedropper", label: "스포이트" },
    { testId: "tool-pan", label: "이동" },
    { testId: "tool-select", label: "선택" },
    { testId: "tool-collision", label: "통행" },
    { testId: "tool-event", label: "이벤트" },
    { testId: "tool-erase", label: "지우개" },
  ] as const;

  for (const tool of expectedTools) {
    const button = page.getByTestId(tool.testId);
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-label", tool.label);
    await expect(button.locator(".rm-tool-icon")).toBeVisible();
  }

  await expect(page.getByTestId("tool-grid")).not.toContainText("스포이트");
});

test("map tree uses an RM2K3-style tree box with context menu actions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&mapTreeTileComfort=1");

  const mapTree = page.getByTestId("map-tree");
  await expect(mapTree).toHaveClass(/map-tree-panel/);
  await expect(mapTree.locator("[data-testid^='map-add-child-']").first()).toBeHidden();
  await expect(mapTree.locator("[data-testid^='map-set-start-']").first()).toBeHidden();
  await expect(mapTree.locator("[data-testid^='map-delete-']").first()).toBeHidden();
  await expect(mapTree.locator(".rm-tool-icon-folder")).toBeVisible();

  const beforeNodeCount = await mapTree.locator("[data-testid^='map-tree-node-']").count();
  await mapTree.locator("[data-testid^='map-tree-node-']").first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "New Map" })).toBeVisible();
  await page.getByRole("menuitem", { name: "New Map" }).click();
  await expect.poll(async () => mapTree.locator("[data-testid^='map-tree-node-']").count()).toBe(beforeNodeCount + 1);
  await expect(mapTree.locator(".rm-tool-icon-map-node").first()).toBeVisible();
  await expect(mapTree.locator("[data-testid^='map-toggle-']").first()).toHaveAttribute("aria-expanded", "true");
  await mapTree.locator("[data-testid^='map-toggle-']").first().click();
  await expect.poll(async () => mapTree.locator("[data-testid^='map-tree-node-']").count()).toBe(beforeNodeCount);
  await mapTree.locator("[data-testid^='map-toggle-']").first().click();
  await expect.poll(async () => mapTree.locator("[data-testid^='map-tree-node-']").count()).toBe(beforeNodeCount + 1);
  await expect(mapTree.locator("[data-testid^='map-tree-node-']").nth(1)).toHaveAttribute("draggable", "true");

  await expect(page.getByTestId("brush-size-control")).toBeHidden();
  await expect(page.getByTestId("quick-tile-toggle")).toBeVisible();
  await expect(page.getByTestId("tile-number-toggle")).toBeVisible();

  for (const testId of ["undo-button", "redo-button", "copy-button", "paste-button"] as const) {
    const button = page.getByTestId(testId);
    await expect(button).toBeHidden();
  }
});

test("map tree context menu is accessible from mouse, keyboard, and action button", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1&mapTreeContextMenu=1");

  const mapTree = page.getByTestId("map-tree");
  const rootNode = mapTree.locator("[data-testid^='map-tree-node-']").first();
  await rootNode.click({ button: "right" });
  await page.getByRole("menuitem", { name: "New Map" }).click();
  const beforeNodeCount = await mapTree.locator("[data-testid^='map-tree-node-']").count();

  await rootNode.click({ button: "right" });
  const menu = page.getByRole("menu", { name: /map actions/i });
  await expect(menu).toBeVisible();
  await expect(rootNode).toHaveClass(/active/);
  await expect(page.getByRole("menuitem", { name: "Map Properties..." })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "New Map" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "New Area..." })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Generate Dungeon" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("menuitem", { name: "Copy Ctrl+C" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Paste Ctrl+V" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("menuitem", { name: "Delete Del" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Shift... Ctrl+H" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Map Properties..." }).click();
  await expect(page.locator("[data-testid^='map-properties-modal-']")).toBeVisible();
  await page.locator("[data-testid^='map-properties-modal-'] .event-subdialog-close").click();

  await rootNode.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Shift... Ctrl+H" }).click();
  await expect(page.locator("[data-testid^='map-shift-modal-']")).toBeVisible();
  await page.locator("[data-testid^='map-shift-modal-'] .event-subdialog-close").click();

  await rootNode.click({ button: "right" });
  await expect(page.getByRole("menu", { name: /map actions/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: /map actions/i })).toHaveCount(0);

  await rootNode.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu", { name: /map actions/i })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: /map actions/i })).toHaveCount(0);

  await mapTree.locator("[data-testid^='map-context-trigger-']").first().click();
  await expect(page.getByRole("menu", { name: /map actions/i })).toBeVisible();
  await page.getByRole("menuitem", { name: "Copy Ctrl+C" }).click();
  await expect.poll(async () => mapTree.locator("[data-testid^='map-tree-node-']").count()).toBe(beforeNodeCount + 1);

  await mapTree.locator("[data-testid^='map-context-trigger-']").first().click();
  await expect(page.getByRole("menu", { name: /map actions/i })).toBeVisible();
  await page.mouse.click(600, 120);
  await expect(page.getByRole("menu", { name: /map actions/i })).toHaveCount(0);
});

test("right click picks the tile under the cursor and layer mode is visually distinct", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?devProject=1&logCabinShowcase=1&focusX=4&focusY=1&rightClickEyedropper=1");

  await page.getByTestId("layer-upper").click();
  await expect(page.getByTestId("layer-upper")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("layer-selector")).toContainText("3단 레이어");
  const roofTile = await findCanvasPointByCursor(page, ({ lower, upper }) => lower === "374" || upper === "374");
  const clip = { x: roofTile.x - 80, y: roofTile.y - 80, width: 160, height: 160 };
  const upperLayerView = await page.screenshot({ clip });

  await page.mouse.click(roofTile.x, roofTile.y, { button: "right" });
  await expect(page.getByTestId("selected-tile-status")).toContainText("374");

  await page.getByTestId("layer-lower").click();
  await expect(page.getByTestId("layer-lower")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => byteDistance(upperLayerView, await page.screenshot({ clip }))).toBeGreaterThan(24);
});

test("right click picks the visible upper tile even when lower layer is active", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?devProject=1&logCabinShowcase=1&focusX=4&focusY=1&rightClickVisibleTop=1");

  await page.getByTestId("layer-lower").click();
  await expect(page.getByTestId("layer-lower")).toHaveAttribute("aria-pressed", "true");
  const target = await findCanvasPointByCursor(page, ({ lower, upper }) => upper !== "-1" && upper !== "" && upper !== lower);

  const upperTile = await page.getByTestId("cursor-upper").textContent() ?? "";
  await page.mouse.click(target.x, target.y, { button: "right" });

  await expect(page.getByTestId("selected-tile-status")).toContainText(upperTile);
  await expect(page.getByTestId("editor-statusbar")).toContainText(upperTile);
});

test("middle mouse drag pans the map without changing the selected layer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?logCabinShowcase=1&middleMousePan=1&focusX=16&focusY=13");

  await page.getByTestId("layer-upper").click();
  await expect(page.getByTestId("layer-upper")).toHaveAttribute("aria-pressed", "true");

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
  await expect(page.getByTestId("layer-upper")).toHaveAttribute("aria-pressed", "true");
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
