import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const EVIDENCE_DIR = path.resolve("evidence");

async function getCamera(page: Page): Promise<{ scrollX: number; scrollY: number; width: number; height: number; zoom: number }> {
  return page.evaluate(() => {
    const fn = (window as any).__rpgzzuEditCamera;
    if (typeof fn !== "function") throw new Error("__rpgzzuEditCamera not available");
    return fn();
  });
}

test("mode switch basic↔expert preserves camera center", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1601, height: 900 });
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1&m1MapEditor=1");

  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__rpgzzuEditCamera === "function", { timeout: 20_000 });
  await page.waitForTimeout(500);

  const expertCam = await getCamera(page);
  const expertCenter = {
    x: expertCam.scrollX + expertCam.width / 2,
    y: expertCam.scrollY + expertCam.height / 2,
  };

  await page.evaluate(() => { (window as any).__rpgzzuEditorUiMode?.set("basic"); });
  await page.waitForTimeout(1000);

  const basicCam = await getCamera(page);
  const basicCenter = {
    x: basicCam.scrollX + basicCam.width / 2,
    y: basicCam.scrollY + basicCam.height / 2,
  };

  await page.evaluate(() => { (window as any).__rpgzzuEditorUiMode?.set("expert"); });
  await page.waitForTimeout(1000);

  const expertCam2 = await getCamera(page);
  const expertCenter2 = {
    x: expertCam2.scrollX + expertCam2.width / 2,
    y: expertCam2.scrollY + expertCam2.height / 2,
  };

  const report = JSON.stringify({ expertCam, basicCam, expertCam2, expertCenter, basicCenter, expertCenter2 }, null, 2);
  console.log("REPORT_START", report, "REPORT_END");

  expect(Math.abs(basicCenter.x - expertCenter.x)).toBeLessThan(3);
  expect(Math.abs(basicCenter.y - expertCenter.y)).toBeLessThan(3);
  expect(Math.abs(expertCenter2.x - expertCenter.x)).toBeLessThan(3);
  expect(Math.abs(expertCenter2.y - expertCenter.y)).toBeLessThan(3);

  await page.screenshot({ path: path.join(EVIDENCE_DIR, "mode-switch-camera-stability.png"), fullPage: false });
});
