import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`event editor window lifecycle at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "standard"));
    await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
    // Select the mode through its real surface, independent of storage migrations.
    await page.getByTestId("workspace-panels-button").click();
    await page.getByTestId("workspace-ui-mode-standard").click();
    await page.getByTestId("layer-event").click();
    const canvas = page.getByTestId("edit-canvas").locator("canvas").last();
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error("Missing event canvas geometry");
    await canvas.dblclick({ position: { x: canvasBox.width / 2, y: canvasBox.height / 2 } });
    const modal = page.getByTestId("event-editor-modal");
    const windowEl = modal.locator(".event-editor-modal-window");
    const name = modal.getByTestId("event-editor-name");
    const minimize = modal.getByTestId("event-editor-window-minimize");
    const fullscreen = modal.getByTestId("event-editor-window-fullscreen");
    const close = modal.getByTestId("event-editor-modal-close");
    await expect(modal).toBeVisible();
    const ids = await modal.evaluate(element => {
      if (!(element instanceof HTMLElement) || !element.dataset.mapId || !element.dataset.eventId) {
        throw new Error("Missing event editor identity");
      }
      return { mapId: element.dataset.mapId, eventId: element.dataset.eventId };
    });
    let normal = await windowEl.boundingBox();
    if (!normal) throw new Error("Missing normal geometry");
    expect(normal.x).toBeGreaterThan(0);
    expect(normal.y).toBeGreaterThan(0);
    expect(normal.width).toBeLessThan(viewport.width);
    expect(normal.height).toBeLessThan(viewport.height);
    for (const control of [minimize, fullscreen, close]) {
      const bounds = await control.boundingBox();
      if (!bounds) throw new Error("Missing window control");
      expect(bounds.width).toBeGreaterThanOrEqual(32);
      expect(bounds.height).toBeGreaterThanOrEqual(32);
    }
    const closeBox = await close.boundingBox();
    if (!closeBox) throw new Error("Missing close geometry");
    expect(normal.x + normal.width - closeBox.x - closeBox.width).toBeLessThanOrEqual(24);
    await page.screenshot({ path: testInfo.outputPath("normal.png") });

    const headerBox = await modal.getByTestId("event-editor-titlebar").boundingBox();
    if (!headerBox) throw new Error("Missing titlebar geometry");
    // The top inset is titlebar chrome, outside its native inputs/buttons.
    const dragX = headerBox.x + headerBox.width / 2;
    const dragY = headerBox.y + 3;
    await page.mouse.move(dragX, dragY);
    await page.mouse.down();
    await page.mouse.move(dragX + 12, dragY + 8);
    await page.mouse.up();
    const dragged = await windowEl.boundingBox();
    if (!dragged) throw new Error("Missing dragged geometry");
    expect(dragged.x).toBeCloseTo(normal.x + 12, 1);
    expect(dragged.y).toBeCloseTo(normal.y + 8, 1);
    expect(dragged.width).toBe(normal.width);
    expect(dragged.height).toBe(normal.height);
    normal = dragged;
    await page.screenshot({ path: testInfo.outputPath("dragged.png") });

    await name.fill("Window draft pending");
    await name.evaluate(element => {
      if (!(element instanceof HTMLInputElement)) throw new Error("Expected input");
      element.setSelectionRange(7, 12);
    });
    await minimize.click();
    await expect(modal).toBeHidden();
    const restore = page.getByTestId("event-editor-window-restore");
    await expect(restore).toBeVisible();
    await expect(restore).toBeFocused();
    expect(await page.evaluate(() => document.body.classList.contains("event-editor-modal-open"))).toBe(false);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("app-confirm-modal")).toHaveCount(0);
    await page.getByTestId("layer-lower").click();
    await expect(page.getByTestId("layer-lower")).toHaveAttribute("aria-current", "true");
    await page.keyboard.press("F7");
    await expect(page.getByTestId("layer-event")).toHaveAttribute("aria-current", "true");
    await expect(modal).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("minimized.png") });
    await restore.press("Enter");
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("Window draft pending");
    expect(await name.evaluate(element => element instanceof HTMLInputElement ? [element.selectionStart, element.selectionEnd] : null)).toEqual([7, 12]);

    await fullscreen.click();
    await expect(fullscreen).toHaveAttribute("aria-pressed", "true");
    const maximized = await windowEl.boundingBox();
    if (!maximized) throw new Error("Missing maximized geometry");
    expect(maximized.width).toBeGreaterThan(normal.width);
    expect(maximized.height).toBeGreaterThan(normal.height);
    await page.screenshot({ path: testInfo.outputPath("maximized.png") });
    await minimize.click();
    // Actual map event-list reopening must resume even a new unsaved event.
    const eventRow = page.getByTestId(`event-list-row-${ids.eventId}`);
    await eventRow.click();
    await eventRow.dblclick();
    await expect(modal).toHaveAttribute("data-event-id", ids.eventId);
    await expect(modal).toBeVisible();
    await expect(fullscreen).toHaveAttribute("aria-pressed", "true");
    await expect(name).toHaveValue("Window draft pending");
    await expect(page.getByTestId("app-confirm-modal")).toHaveCount(0);
    await name.press("Alt+Enter");
    await expect(fullscreen).toHaveAttribute("aria-pressed", "false");
    expect(await windowEl.boundingBox()).toEqual(normal);

    const grip = modal.getByTestId("event-editor-modal-resize-handle");
    await grip.focus();
    await grip.press("ArrowLeft");
    const resized = await windowEl.boundingBox();
    if (!resized) throw new Error("Missing resized geometry");
    expect(resized.width).toBeLessThan(normal.width);
    await minimize.click();
    await restore.click();
    expect(await windowEl.boundingBox()).toEqual(resized);
    await close.focus();
    const focusOutline = await close.evaluate(element => getComputedStyle(element).outlineWidth);
    expect(Number.parseFloat(focusOutline)).toBeGreaterThanOrEqual(2);
    await close.press("Enter");
    await expect(page.getByTestId("app-confirm-modal")).toBeVisible();
    await page.getByTestId("app-modal-cancel").click();
    await expect(modal).toBeVisible();
    await name.fill("Saved after restore");
    await name.press("Tab");
    await modal.getByTestId("event-editor-save").click();
    await expect(modal).toHaveCount(0);
    await eventRow.click();
    await page.getByTestId("event-editor-open").click();
    await expect(modal).toHaveAttribute("data-map-id", ids.mapId);
    await expect(modal).toHaveAttribute("data-event-id", ids.eventId);
    await expect(name).toHaveValue("Saved after restore");
    await expect(modal.getByTestId("event-editor-draft-status")).toHaveAttribute("data-state", "session");
    // Reopening starts a clean edit session; closing it must not ask to discard.
    await close.click();
    await expect(modal).toHaveCount(0);
    await expect(page.getByTestId("app-confirm-modal")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("saved.png") });
  });
}
