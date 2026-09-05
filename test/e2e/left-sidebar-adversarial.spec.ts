import { expect, test, type Locator, type Page } from "@playwright/test";

// Explicit screenshots are the evidence; avoid tracing every tile DOM node on each action.
test.use({ trace: "off" });

async function hitVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth
      && node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}

async function mode(page: Page, value: string): Promise<void> {
  await page.getByTestId("workspace-panels-button").click();
  await page.getByTestId(`workspace-ui-mode-${value}`).click();
  await expect(page.locator("body")).toHaveClass(new RegExp(`editor-ui-${value}`));
}

test("three sidebar modes retain focus, reachable controls and usable map space", async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
  for (const persona of ["expert", "standard", "beginner"]) {
    if (persona !== "expert") await mode(page, persona);
    for (const [width, height] of [[1440, 900], [1280, 800], [1024, 768]]) {
      await page.setViewportSize({ width, height });
      await page.getByTestId("tool-erase").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("tool-erase")).toBeFocused();
      await expect(page.locator("body")).toHaveAttribute("data-editor-tool", "erase");
      for (const id of ["tool-paint", "tool-fill", "tool-event", "layer-lower", "layer-upper", "layer-event"]) {
        await hitVisible(page.getByTestId(id));
      }
      if (persona !== "beginner") {
        await hitVisible(page.getByTestId("oprn-tool-overflow"));
        const list = page.locator(".map-tree-list");
        // Three rows can be compared without repeatedly scrolling a one-row slit.
        await expect.poll(() => list.evaluate(e => e.clientHeight), { timeout: 30_000 }).toBeGreaterThanOrEqual(108);
        await list.evaluate(e => { e.scrollTop = e.scrollHeight; });
        await hitVisible(list.locator(".map-item").last());
        await list.evaluate(e => { e.scrollTop = 0; });
      } else {
        expect(await page.locator(".left-panel").evaluate(e => e.getBoundingClientRect().width)).toBe(72);
        expect(await page.locator(".canvas-area").evaluate(e => e.getBoundingClientRect().left)).toBeLessThanOrEqual(80);
        await hitVisible(page.getByTestId("basic-rail-toggle-tiles"));
        await hitVisible(page.getByTestId("basic-rail-toggle-maps"));
      }
      await page.screenshot({ path: testInfo.outputPath(`${persona}-${width}.png`) });
    }
    if (persona !== "beginner") {
      const search = page.getByTestId("tile-search-input");
      await search.fill("ab");
      await page.keyboard.press("Home");
      await page.keyboard.type("x");
      await expect(search).toHaveValue("xab");
      expect(await search.evaluate(e => (e as HTMLInputElement).selectionStart)).toBe(1);
      await search.fill("");
    }
    await page.getByTestId("layer-event").click();
    await expect(page.getByTestId("layer-event")).toHaveAttribute("aria-current", "true");
    await page.getByTestId("layer-lower").click();
    await expect(page.getByTestId("layer-lower")).toHaveAttribute("aria-current", "true");
  }
  await page.getByTestId("basic-rail-toggle-tiles").click();
  const sheet = page.getByTestId("basic-tile-grid");
  await expect(sheet.locator(".chipset-tile")).not.toHaveCount(48);
  expect(await sheet.locator(".chipset-tile").count()).toBeGreaterThan(48);
  expect(await sheet.locator('.chipset-tile[tabindex="0"]').count()).toBe(1);
  await page.getByTestId("basic-flyout-pin").click();
  const cells = sheet.locator(".chipset-tile");
  await cells.first().focus();
  await page.keyboard.press("End");
  await expect(cells.last()).toBeFocused();
  await hitVisible(cells.last());
  await page.keyboard.press("Enter");
  await expect(cells.last()).toBeFocused();
  await expect(cells.last()).toHaveAttribute("aria-pressed", "true");
  expect(await sheet.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
  const selected = await cells.last().getAttribute("data-tile-index");
  await page.getByTestId("basic-tile-search").fill(selected!);
  await expect(page.getByTestId("basic-tile-search")).toBeFocused();
  await expect(page.getByTestId(`basic-tile-${selected}`)).toBeVisible();
  await page.getByTestId("basic-tile-search").fill("");
  await page.screenshot({ path: testInfo.outputPath("beginner-tiles.png") });
  await page.getByTestId("basic-flyout-close").click();
  await expect(page.getByTestId("basic-rail-toggle-tiles")).toBeFocused();
  await page.getByTestId("basic-rail-toggle-maps").click();
  await page.screenshot({ path: testInfo.outputPath("beginner-maps.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("basic-rail-flyout")).toHaveCount(0);
  // Returning to beginner keeps the selected tool but never resurrects a flyout.
  await mode(page, "expert");
  await mode(page, "beginner");
  await expect(page.getByTestId("basic-rail-flyout")).toHaveCount(0);
  await expect(page.getByTestId("tool-paint")).toHaveAttribute("aria-current", "true");
});
