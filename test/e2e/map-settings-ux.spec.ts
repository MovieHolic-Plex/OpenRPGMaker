import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const OUT = join(process.cwd(), "output/evidence/map-settings-ux");
const sections = ["general", "background", "bgm", "battle", "restrictions", "encounter", "spawns", "minimap"];

async function openSettings(page: Page, mode = "standard"): Promise<void> {
  await page.addInitScript((mode) => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", mode);
    localStorage.setItem("oprn:editor-ui-mode", mode);
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  }, mode);
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
  if (mode === "beginner") await page.getByTestId("basic-rail-toggle-maps").click();
  await page.locator('[data-testid^="map-tree-node-"]').first().dblclick();
  await expect(page.getByRole("dialog", { name: "맵 설정", exact: true })).toBeVisible();
}

async function currentMap(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store } = await import(/* @vite-ignore */ path);
    const project = store.getCurrent();
    return project.maps[project.startMapId];
  });
}

for (const mode of ["beginner", "expert"]) {
  for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
    test(`map settings remain readable and reachable: ${mode} ${width}x${height}`, async ({ page }) => {
      test.setTimeout(180_000);
      await mkdir(OUT, { recursive: true });
      await page.setViewportSize({ width: width!, height: height! });
      await openSettings(page, mode);
      const dialog = page.getByRole("dialog", { name: "맵 설정", exact: true });
      const header = dialog.locator(".event-subdialog-header");
      const headerBox = (await header.boundingBox())!;
      const subtitleBox = (await header.locator("p").boundingBox())!;
      expect(subtitleBox.y + subtitleBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);
      await page.screenshot({ path: join(OUT, `after-${mode}-${width}-general.png`) });
      for (const section of sections) {
        const nav = page.getByTestId(`map-props-tab-${section}`);
        await nav.click();
        await expect(nav).toHaveAttribute("aria-current", "location");
        const body = dialog.locator(".map-props-body");
        const metrics = await body.evaluate((node) => ({
          overflow: node.scrollWidth - node.clientWidth,
          outerScroll: node.parentElement!.parentElement!.scrollTop,
        }));
        expect(metrics.overflow, `${section} horizontal overflow`).toBeLessThanOrEqual(1);
        expect(metrics.outerScroll, `${section} nested scrolling`).toBe(0);
        await expect(page.getByTestId(`map-props-section-${section}`).locator("h2")).toBeInViewport();
      }
      const tiny = await dialog.evaluate((root) => Array.from(root.querySelectorAll("label, .map-props-hint, .map-props-tab, summary"))
        .filter((node) => node.getClientRects().length && parseFloat(getComputedStyle(node).fontSize) < 13)
        .map((node) => node.textContent));
      expect(tiny).toEqual([]);
      await page.getByTestId("map-props-tab-encounter").click();
      await page.screenshot({ path: join(OUT, `after-${mode}-${width}-encounter.png`) });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    });
  }
}

test("settings changes preserve drafts, focus, expanded conditions, and independent flags", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openSettings(page);
  await page.getByLabel("가로 (칸)", { exact: true }).fill("96");
  await page.getByTestId("map-props-tab-background").click();
  await page.getByLabel("맵 배경 사용", { exact: true }).check();
  await expect(page.getByTestId("map-bg-enable")).toBeFocused();
  await expect(page.getByLabel("가로 (칸)", { exact: true })).toHaveValue("96");
  await page.getByLabel("가로 스크롤 속도", { exact: true }).fill("2");
  await page.getByLabel("세로 스크롤 속도", { exact: true }).fill("3");
  await page.getByTestId("map-props-tab-spawns").click();
  const spawns = page.getByTestId("map-props-section-spawns");
  await spawns.locator("summary").click();
  await page.getByTestId("map-field-spawns-input").fill('[\n  { "unfinished":');
  await page.getByTestId("map-props-tab-minimap").click();
  await page.getByTestId("map-minimap-enable").check();
  await expect(page.getByTestId("map-minimap-enable")).toBeFocused();
  const preview = page.getByTestId("map-minimap-preview-canvas");
  await expect(preview).toHaveCSS("height", "180px", { timeout: 15_000 });
  await page.screenshot({ path: join(OUT, "after-minimap.png") });
  await expect(page.getByTestId("map-field-spawns-input")).toHaveValue('[\n  { "unfinished":');
  await expect(spawns.locator("details")).toHaveAttribute("open", "");
  await page.getByTestId("map-props-tab-restrictions").click();
  for (const flag of ["save", "teleport", "escape"]) await page.getByTestId(`map-disable-${flag}`).check();
  const flags = await currentMap(page);
  expect([flags.disableSave, flags.disableTeleport, flags.disableEscape]).toEqual([true, true, true]);
  expect(flags.background).toMatchObject({ scrollX: 2, scrollY: 3 });
  await page.getByTestId("map-props-tab-encounter").click();
  await page.getByTestId("map-encounter-rate-input").fill("90");
  await page.getByTestId("map-encounter-row-add").click();
  await expect(page.getByTestId("map-encounter-rate-slider")).toHaveValue("90");
  const advanced = page.getByTestId("map-props-section-encounter").locator(".map-encounter-advanced");
  await advanced.locator("summary").click();
  await page.getByTestId("map-encounter-table-input").fill("[ unfinished draft");
  await page.getByTestId("map-encounter-row-add").click();
  await expect(advanced).toHaveAttribute("open", "");
  await expect(page.getByTestId("map-encounter-table-input")).toHaveValue("[ unfinished draft");
  await page.getByTestId("map-encounter-conditions-0").click();
  await page.locator('[data-custom-select-for="map-encounter-season-0"]').click();
  await page.getByRole("option", { name: "겨울", exact: true }).click();
  await expect(page.locator('[data-custom-select-for="map-encounter-season-0"]')).toBeFocused();
  await expect(page.getByTestId("map-encounter-row-0").locator("details")).toHaveAttribute("open", "");
  expect((await currentMap(page)).encounterTable[0].conditions.season).toBe("winter");
  await page.screenshot({ path: join(OUT, "after-encounter-conditions.png") });
  await page.getByTestId("map-props-tab-general").click();
  await page.getByLabel("이름", { exact: true }).fill("가독성 확인용 맵 이름");
  await page.getByTestId("map-resize-apply").click();
  await expect(page.getByRole("dialog", { name: "맵 설정", exact: true }).locator(".event-subdialog-header p")).toHaveText("가독성 확인용 맵 이름");
  await expect(page.getByTestId("app-confirm-modal")).toBeVisible();
  await page.getByTestId("app-modal-cancel").click();
  expect((await currentMap(page)).width).toBe(100);
  await expect(page.getByTestId("map-resize-apply")).toBeFocused();
});

test("background picker provides preview, commits selection, and returns keyboard focus", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openSettings(page);
  await page.getByTestId("map-props-tab-battle").click();
  await page.getByTestId("map-battle-bg-set").click();
  const picker = page.getByTestId("map-battle-bg-dialog");
  await expect(picker.locator("header")).toHaveCSS("font-size", "18px");
  expect((await page.getByTestId("map-battle-bg-dialog-ok").boundingBox())!.height).toBeGreaterThanOrEqual(36);
  const option = page.locator('[data-testid^="map-battle-bg-dialog-option-"]').first();
  await option.click();
  const id = await option.getAttribute("data-resource-id");
  await expect(page.getByTestId("map-battle-bg-dialog-preview")).toBeVisible();
  await page.screenshot({ path: join(OUT, "after-background-picker.png") });
  await page.getByTestId("map-battle-bg-dialog-ok").click();
  expect((await currentMap(page)).battleBackground).toBe(id);
  await expect(page.getByTestId("map-battle-bg-set")).toBeFocused();
  await expect(page.getByTestId("map-battle-bg")).not.toHaveText("선택한 리소스 없음");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "맵 설정", exact: true })).toBeHidden();
});


test("populated encounter rows keep troop, weight, share and delete controls inside the card", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await openSettings(page);
  await page.getByTestId("map-props-tab-encounter").click();
  await page.getByTestId("map-encounter-row-add").click();
  await page.getByTestId("map-encounter-row-add").click();
  await page.getByTestId("map-encounter-conditions-0").click();
  const row = page.getByTestId("map-encounter-row-0");
  const metrics = await row.evaluate((node) => {
    const main = node.querySelector<HTMLElement>(".map-encounter-row-main")!;
    const bounds = main.getBoundingClientRect();
    const controls = Array.from(main.children).map((child) => child.getBoundingClientRect());
    return {
      overflow: main.scrollWidth - main.clientWidth,
      troopWidth: controls[0]!.width,
      weightWidth: controls[1]!.width,
      outside: controls.filter((box) => box.left < bounds.left - 1 || box.right > bounds.right + 1).length,
    };
  });
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.outside).toBe(0);
  expect(metrics.troopWidth).toBeGreaterThan(180);
  expect(metrics.weightWidth).toBeLessThanOrEqual(90);
  await page.getByTestId("map-encounter-remove-0").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("map-encounter-remove-0")).toBeInViewport();
  await page.screenshot({ path: join(OUT, "after-encounter-conditions.png") });
  await page.getByTestId("map-encounter-remove-0").click();
  expect((await currentMap(page)).encounterTable).toHaveLength(1);
});
