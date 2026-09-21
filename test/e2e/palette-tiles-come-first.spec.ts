import { expect, test } from "@playwright/test";
import { createSampleAdventureProject } from "@/project/defaults/defaultProject";
import { seedProjectForEditor } from "./projectSeed";

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

test("칠하기 탭은 타일 팔레트를 구조물 선반보다 먼저·넓게 보여준다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await seedProjectForEditor(page, createSampleAdventureProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("layer-lower").first().click({ force: true });
  await expect(page.getByTestId("palette-work-pane-paint")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("tile-palette")).toBeVisible({ timeout: 15_000 });

  const geom = await page.evaluate(() => {
    const box = (testid: string) => {
      const node = document.querySelector(`[data-testid='${testid}']`);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { y: Math.round(rect.y), height: Math.round(rect.height) };
    };
    return { palette: box("tile-palette"), shelf: box("structure-kit-shelf") };
  });

  expect(geom.palette, "타일 팔레트가 없다").not.toBeNull();
  const palette = geom.palette!;

  if (geom.shelf) {
    const shelf = geom.shelf;
    expect(palette.y, `팔레트(y=${palette.y})가 구조물 선반(y=${shelf.y}) 아래로 밀렸다`)
      .toBeLessThan(shelf.y);
    expect(palette.height, "타일 팔레트가 구조물 선반보다 좁다").toBeGreaterThan(shelf.height);
  }

  expect(palette.height, `타일 팔레트가 ${palette.height}px 로 너무 좁다`).toBeGreaterThan(260);
});
