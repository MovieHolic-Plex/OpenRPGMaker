import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const OUT = join(process.cwd(), "output", "evidence", "map-tree-ux-2026-08-20");

test("capture map tree UX shots for the result report", async ({ page }) => {
  test.setTimeout(90_000);
  await mkdir(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "standard");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?freshProject=1");

  const mapTree = page.getByTestId("map-tree");
  await expect(mapTree).toBeVisible();
  await expect(page.getByTestId("map-tree-filter")).toBeVisible();
  await page.getByTestId("left-map-root").screenshot({ path: join(OUT, "01-tree-panel.png") });

  const rows = mapTree.locator("[data-testid^='map-tree-node-']");
  await rows.first().click({ button: "right" });
  await expect(page.getByRole("menu", { name: /맵 메뉴/ })).toBeVisible();
  await page.screenshot({ path: join(OUT, "02-context-menu-korean.png") });
  await page.getByRole("menuitem", { name: "하위 맵 추가" }).click();
  await page.getByTestId("map-create-confirm").click();

  await rows.first().click();
  await rows.first().press("F2");
  const rename = page.locator("[data-testid^='map-rename-']");
  await expect(rename).toBeVisible();
  await page.getByTestId("left-map-root").screenshot({ path: join(OUT, "03-inline-rename.png") });
  await rename.press("Escape");

  await page.getByTestId("map-tree-filter").fill("맵");
  await page.getByTestId("left-map-root").screenshot({ path: join(OUT, "04-filter.png") });
  await page.getByTestId("map-tree-filter").fill("");

  await page.screenshot({ path: join(OUT, "05-editor-shell-map-tab.png") });
});
