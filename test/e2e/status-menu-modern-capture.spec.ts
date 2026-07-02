import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { openTestPlayWindow, seedDefaultProject } from "./rm2k3PlayerStatusMenuHelpers";

test("captures modern equipment and item menu evidence", async ({ page }) => {
  await mkdir("evidence/browser-screenshots/status-menu-modern-mock", { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedDefaultProject(page);
  await openTestPlayWindow(page);
  await page.getByTestId("test-play-window").getByTestId("title-new-game").click();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
  await page.keyboard.press("X");

  await page.getByTestId("status-menu-command-equipment").click();
  await page.getByTestId("status-menu-equipment-actor-actor_hero").click();
  await expect(page.getByTestId("status-menu-classic-equipment-detail")).toBeVisible();
  expect(await importantTextFits(page, "status-menu-classic-equipment-detail")).toEqual([]);
  await page.getByTestId("main-menu").screenshot({
    path: "evidence/browser-screenshots/status-menu-modern-mock/equipment-detail.png",
  });

  await page.keyboard.press("X");
  await page.getByTestId("status-menu-command-items").click();
  await expect(page.getByTestId("status-menu-classic-items")).toBeVisible();
  expect(await importantTextFits(page, "status-menu-classic-items")).toEqual([]);
  await page.getByTestId("main-menu").screenshot({
    path: "evidence/browser-screenshots/status-menu-modern-mock/items.png",
  });
});

async function importantTextFits(page: import("@playwright/test").Page, testId: string): Promise<readonly string[]> {
  return page.evaluate((id) => {
    const root = document.querySelector<HTMLElement>(`[data-testid='${id}']`);
    if (!root) return [`missing ${id}`];
    const selectors = [
      ".status-menu-classic-equipment-item > span",
      ".status-menu-classic-equipment-slot-name",
      ".status-menu-classic-item-name",
      ".status-menu-classic-item-count",
      ".status-menu-entry-effect",
      ".status-menu-entry-performance",
    ];
    return Array.from(root.querySelectorAll<HTMLElement>(selectors.join(",")))
      .filter((node) => node.offsetParent !== null && node.textContent?.trim())
      .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
      .map((node) => node.textContent?.trim() ?? node.className);
  }, testId);
}
