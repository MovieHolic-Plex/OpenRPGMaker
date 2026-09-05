import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const evidence = resolve("output/evidence/battle-animation-ux");
const sizes = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }];
test.setTimeout(240_000);

async function openAnimations(page: Page): Promise<void> {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname.endsWith("supabase.co") && !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
      throw new Error(`Unexpected remote write: ${request.method()} ${url.origin}`);
    }
    if (url.port === (process.env.DEV_SERVER_PORT ?? "9173") && request.method() === "GET") {
      await route.fulfill({ response: await route.fetch({ maxRetries: 2 }) });
    } else await route.continue();
  });
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 60_000 });
  const welcome = page.getByTestId("standard-welcome-start");
  if (await welcome.isVisible()) await welcome.click();
  await page.clock.install({ time: new Date("2026-09-05T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-05T13:00:00Z"));
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("db-tab-search").fill("애니메이션");
  await page.getByTestId("db-tab-animations").click();
  await expect(page.getByTestId("db-animation-play")).toHaveAttribute("aria-pressed", "true");
}

async function geometry(control: Locator) {
  return control.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
    for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const bounds = ancestor.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
      if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
    }
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      clipped: rect.left < left - 1 || rect.right > right + 1 || rect.top < top - 1 || rect.bottom > bottom + 1,
      hit: hit === node || (hit !== null && node.contains(hit)), font: getComputedStyle(node).fontSize, background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color };
  });
}

async function currentGraphic(page: Page): Promise<{ id: string; name: string }> {
  return page.evaluate(`Promise.all([import('/src/project/store.ts'), import('/src/editor/panels/databaseResourcePickerDialog.ts')]).then(([{store}, {listDatabaseResourceOptions}]) => {
    const id = document.querySelector('[data-testid="db-field-animation-resource"]').value;
    return listDatabaseResourceOptions('battle', store.getCurrent()).find(entry => entry.id === id);
  })`);
}

async function position(page: Page): Promise<string> {
  return page.getByTestId("db-animation-stage-target").evaluate((node) => getComputedStyle(node).backgroundPosition);
}

test("preview-first graphic, transport, authoring and desktop geometry", async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  await page.setViewportSize(sizes[1]);
  await openAnimations(page);
  const form = page.getByTestId("db-detail-form");
  const play = page.getByTestId("db-animation-play");
  const choose = page.getByTestId("db-field-animation-resource-set");
  const name = form.locator(".db-resource-picker-inline-name");
  const initial = await currentGraphic(page);
  await expect(name).toHaveText(initial.name);
  await expect(page.getByTestId("db-animation-transport").locator("button")).toHaveCount(1);
  await expect(page.getByTestId("db-animation-sheet-preview").locator(".db-animation-command-grid")).toHaveCount(0);
  await expect(page.getByTestId("db-animation-pattern-strip").locator("button")).toHaveCount(0);
  const measurements = [];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await form.evaluate((node) => { node.scrollTop = 0; });
    const stage = await geometry(page.getByTestId("db-animation-sheet-preview-surface"));
    const controls = { choose: await geometry(choose), play: await geometry(play), name: await geometry(name) };
    measurements.push({ viewport: size, stage, controls });
    await writeFile(resolve(evidence, "p2-geometry.json"), JSON.stringify(measurements, null, 2));
    // The unchanged global rail/list leave 394px at the 1024px desktop floor.
    expect.soft(stage.width).toBeGreaterThan(size.width === 1024 ? 380 : 500);
    expect(stage.height).toBeGreaterThanOrEqual(280);
    expect.soft(stage.clipped).toBe(false);
    for (const control of Object.values(controls)) {
      expect.soft(control.clipped).toBe(false);
      expect.soft(control.hit).toBe(true);
      expect.soft(parseFloat(control.font)).toBeGreaterThanOrEqual(13);
    }
    expect(controls.choose.background).toBe(controls.play.background);
    expect(await form.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: resolve(evidence, `p2-desktop-${size.width}.png`) });
  }
  const before = await position(page);
  await page.screenshot({ path: resolve(evidence, "p2-motion-start.png") });
  await page.clock.runFor(67);
  const after = await position(page);
  expect(after).not.toBe(before);
  await page.screenshot({ path: resolve(evidence, "p2-motion-next.png") });
  await play.focus();
  await page.keyboard.press("Space");
  await expect(play).toHaveAttribute("aria-pressed", "false");
  const stopped = await position(page);
  await page.clock.runFor(67 * 3);
  expect(await position(page)).toBe(stopped);
  await page.screenshot({ path: resolve(evidence, "p2-keyboard-stop.png") });
  const focus = await play.evaluate((node) => ({ focused: document.activeElement === node, outlineWidth: getComputedStyle(node).outlineWidth, outlineColor: getComputedStyle(node).outlineColor }));
  expect(focus.focused).toBe(true);
  expect(parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("Enter");
  await expect(play).toHaveAttribute("aria-pressed", "true");

  const prefix = "db-field-animation-resource-dialog";
  await choose.click();
  await page.getByTestId(`${prefix}-search`).fill("generated-battle-anim-arcane-nova");
  const option = page.getByTestId(`${prefix}-option-generated-battle-anim-arcane-nova`);
  await option.click();
  await page.screenshot({ path: resolve(evidence, "p2-picker.png") });
  await page.getByTestId(`${prefix}-cancel`).click();
  await expect(name).toHaveText(initial.name);
  await expect(page.getByTestId("db-field-animation-resource")).toHaveValue(initial.id);
  await choose.click();
  await page.getByTestId(`${prefix}-search`).fill("generated-battle-anim-arcane-nova");
  await option.click();
  await page.getByTestId(`${prefix}-ok`).click();
  await expect(page.getByTestId("db-animation-preview-status")).toHaveAttribute("data-state", "ready");
  const selected = await currentGraphic(page);
  expect(selected.id).toBe("generated-battle-anim-arcane-nova");
  await expect(name).toHaveText(selected.name);
  await page.screenshot({ path: resolve(evidence, "p2-selected.png") });
  await choose.click();
  await page.getByTestId(`${prefix}-clear`).click();
  await expect(page.getByTestId("db-field-animation-resource")).toHaveValue("");
  await expect(page.getByTestId("db-animation-preview-status")).toHaveAttribute("data-state", "empty");
  await expect(play).toBeDisabled();
  await expect(form.locator(".db-animation-stage-cell")).toHaveCount(0);
  await choose.focus();
  await page.screenshot({ path: resolve(evidence, "p2-empty.png") });
  await page.keyboard.press("Enter");
  await expect(page.getByTestId(prefix)).toBeVisible();
  await page.getByTestId(`${prefix}-cancel`).click();
  await page.getByTestId("db-animation-cell-x-0").fill("23");
  const storedX = await page.evaluate<number>(`import('/src/project/store.ts').then(({store}) => store.getCurrent().database.battleAnimations[0].frames[0].cells[0].x)`);
  expect(storedX).toBe(23);
  await page.getByTestId("db-animation-cell-add").click();
  await expect(page.getByTestId("db-animation-cell-x-0")).toHaveValue("23");
  await expect(page.getByTestId("db-animation-cell-x-1")).toBeVisible();
  await page.screenshot({ path: resolve(evidence, "p2-authoring.png") });
  await writeFile(resolve(evidence, "p2-browser-data.json"), JSON.stringify({ measurements, motion: { before, after, stopped }, focus, initial, selected, storedX }, null, 2));
});
