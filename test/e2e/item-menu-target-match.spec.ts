import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { openTestPlayWindow, seedDefaultProject } from "./rm2k3PlayerStatusMenuHelpers";

const EVIDENCE_DIR = "evidence/browser-screenshots/item-menu-target-match";

test("item menu matches the target detail-and-target-preview structure", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1932, height: 1448 });
  await seedDefaultProject(page);
  await openTestPlayWindow(page);
  await page.getByTestId("test-play-window").getByTestId("title-new-game").click();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });

  await page.keyboard.press("X");
  await page.getByTestId("status-menu-command-items").click();
  await expect(page.getByTestId("status-menu-classic-items")).toBeVisible();

  await expect(page.getByTestId("status-menu-item-list-panel")).toBeVisible();
  await expect(page.getByTestId("status-menu-item-detail-panel")).toBeVisible();
  await expect(page.getByTestId("status-menu-item-target-preview")).toBeVisible();
  await expect(page.getByTestId("status-menu-item-filter-all")).toHaveText("전체");
  await expect(page.getByTestId("status-menu-item-detail-name")).toHaveText("회복약");
  await expect(page.getByTestId("status-menu-item-detail-target")).toContainText("아군 1명");
  await expect(page.getByTestId("status-menu-item-target-row-actor_hero")).toContainText("주인공");
  await expect(page.getByTestId("status-menu-item-target-row-actor_hero")).toContainText("HP");
  await expect(page.getByTestId("status-menu-item-target-row-actor_hero")).toContainText("MP");
  await expect(page.getByTestId("status-menu-item-target-row-actor_hero")).toContainText("514 / 514");
  await expect(page.getByTestId("status-menu-classic-item-grid").locator("[data-testid^='status-menu-item-']")).toHaveCount(6);
  expect(await semanticIconMismatches(page)).toEqual([]);
  expect(await targetMeterLayoutFailures(page)).toEqual([]);
  expect(await targetFaceCropFailures(page)).toEqual([]);
  expect(await importantTextFits(page)).toEqual([]);

  await page.getByTestId("main-menu").screenshot({ path: `${EVIDENCE_DIR}/item-menu-target-match.png` });
});

async function importantTextFits(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>("[data-testid='status-menu-classic-items']");
    if (!root) return ["missing status-menu-classic-items"];
    const selectors = [
      ".status-menu-classic-item-name",
      ".status-menu-classic-item-count",
      ".status-menu-entry-effect",
      ".status-menu-entry-performance",
      ".status-menu-item-detail-copy",
      ".status-menu-item-target-row span",
      ".status-menu-item-bar-label",
      ".status-menu-item-filter",
    ];
    return Array.from(root.querySelectorAll<HTMLElement>(selectors.join(",")))
      .filter((node) => node.offsetParent !== null && node.textContent?.trim())
      .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
      .map((node) => node.textContent?.trim() ?? node.className);
  });
}

async function targetFaceCropFailures(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const failures: string[] = [];
    const faces = Array.from(document.querySelectorAll<HTMLElement>(".status-menu-item-target-row .status-menu-classic-face"));
    if (faces.length < 4) failures.push(`only ${faces.length} target faces visible`);
    for (const face of faces) {
      const rowName = face.closest(".status-menu-item-target-row")?.querySelector(".status-menu-item-target-name")?.textContent?.trim() ?? "unknown";
      const tileWidth = face.offsetWidth;
      const tileHeight = face.offsetHeight;
      const [bgWidth, bgHeight] = getComputedStyle(face).backgroundSize
        .split(/\s+/)
        .map((part) => Number.parseFloat(part));
      if (Math.abs(bgWidth - tileWidth * 4) > 1 || Math.abs(bgHeight - tileHeight * 4) > 1) {
        failures.push(`${rowName}: face sheet ${Math.round(bgWidth)}x${Math.round(bgHeight)} for ${Math.round(tileWidth)}x${Math.round(tileHeight)} tile`);
      }
    }
    return failures;
  });
}

async function semanticIconMismatches(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const expected = new Map<string, string>([
      ["회복약", "potion-red"],
      ["마력약", "ether-blue"],
      ["해독초", "antidote-green"],
      ["각성초", "wake-herb"],
      ["귀환 두루마리", "old-key-scroll"],
      ["상급 회복약", "potion-red"],
    ]);
    const grid = document.querySelector<HTMLElement>("[data-testid='status-menu-classic-item-grid']");
    if (!grid) return ["missing item grid"];
    return Array.from(grid.querySelectorAll<HTMLElement>("[data-testid^='status-menu-item-']"))
      .map((node) => {
        const name = node.querySelector<HTMLElement>(".status-menu-classic-item-name")?.textContent?.trim() ?? "";
        const src = node.querySelector<HTMLImageElement>("[data-testid='status-menu-entry-icon']")?.src ?? "";
        const expectedFragment = expected.get(name);
        if (!expectedFragment) return `${name}: unexpected item name`;
        return src.includes(expectedFragment) ? "" : `${name}: ${src}`;
      })
      .filter((entry) => entry.length > 0);
  });
}

async function targetMeterLayoutFailures(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const failures: string[] = [];
    const rows = Array.from(document.querySelectorAll<HTMLElement>(".status-menu-item-target-row"));
    for (const row of rows) {
      const rowName = row.querySelector(".status-menu-item-target-name")?.textContent?.trim() ?? "unknown";
      for (const meter of Array.from(row.querySelectorAll<HTMLElement>(".status-menu-item-meter"))) {
        const label = meter.querySelector<HTMLElement>(".status-menu-item-bar-label");
        const value = meter.querySelector<HTMLElement>(".status-menu-item-bar-value");
        const track = meter.querySelector<HTMLElement>(".status-menu-item-bar-track");
        if (!label || !value || !track) {
          failures.push(`${rowName}: missing meter part`);
          continue;
        }
        const labelRect = label.getBoundingClientRect();
        const valueRect = value.getBoundingClientRect();
        const trackRect = track.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const containerRect = row.closest<HTMLElement>(".status-menu-item-target-preview")?.getBoundingClientRect() ?? rowRect;
        const valueText = value.textContent?.trim() ?? "";
        const trackStyle = getComputedStyle(track);
        if (!valueText.includes("/")) failures.push(`${rowName}: ${label.textContent} value lacks max`);
        if (trackRect.width < 20) failures.push(`${rowName}: ${label.textContent} bar too short`);
        if (trackRect.height < 3) failures.push(`${rowName}: ${label.textContent} bar too thin`);
        if (trackStyle.visibility === "hidden" || Number(trackStyle.opacity) === 0) failures.push(`${rowName}: ${label.textContent} bar hidden`);
        if (labelRect.left < containerRect.left - 1 || trackRect.right > containerRect.right + 3) {
          failures.push(`${rowName}: ${label.textContent} meter escapes target panel (${Math.round(labelRect.left - containerRect.left)}, ${Math.round(trackRect.right - containerRect.right)})`);
        }
        if (labelRect.right > valueRect.left - 1) failures.push(`${rowName}: ${label.textContent} label overlaps value`);
        if (valueRect.right > containerRect.right + 3) failures.push(`${rowName}: ${label.textContent} value escapes target panel`);
        if (valueRect.bottom > trackRect.top + 1) failures.push(`${rowName}: ${label.textContent} value overlaps bar`);
      }
    }
    const visibleRows = rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      const containerRect = row.closest<HTMLElement>(".status-menu-item-target-preview")?.getBoundingClientRect() ?? rect;
      return rect.top >= containerRect.top - 1 && rect.bottom <= containerRect.bottom + 1;
    });
    if (visibleRows.length < 4) failures.push(`only ${visibleRows.length} target rows fully visible`);
    return failures;
  });
}
