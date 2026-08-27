/* 맵 이벤트 호버 말풍선 — 네이티브 title 툴팁이 사라졌고, 카드가 타일 우상단에 붙는지 실제 브라우저로 증명한다. */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createModernNocturneProject, MODERN_MAP } from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const SHOT_DIR = "output/evidence/event-hover-bubble";
mkdirSync(SHOT_DIR, { recursive: true });

test("event marker hover shows a bubble at the tile's top-right and no native title", async ({ page }) => {
  test.setTimeout(120_000);
  const project = createModernNocturneProject();
  const map = project.maps[MODERN_MAP.city];
  const target = map.events[0];
  expect(target, "city map must ship at least one event").toBeTruthy();
  const tileSize = map.tileSize || 16;

  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedProjectFromSupabaseCanonical(page, project, "/");
  await page.waitForFunction(() => typeof (window as never as { __oprnEditWorldToClient?: unknown }).__oprnEditWorldToClient === "function", undefined, { timeout: 20_000 });
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) await skip.click();

  await page.getByTestId("tool-event").click().catch(() => {});

  const worldToClient = async (worldX: number, worldY: number) =>
    page.evaluate(
      ([x, y]) => (window as never as { __oprnEditWorldToClient: (a: number, b: number) => { x: number; y: number } }).__oprnEditWorldToClient(x, y),
      [worldX, worldY],
    );

  const topLeft = await worldToClient(target.x * tileSize, target.y * tileSize);
  const bottomRight = await worldToClient((target.x + 1) * tileSize, (target.y + 1) * tileSize);
  const center = { x: (topLeft.x + bottomRight.x) / 2, y: (topLeft.y + bottomRight.y) / 2 };

  await page.mouse.move(center.x - 40, center.y - 40);
  await page.mouse.move(center.x, center.y);

  const tooltip = page.getByTestId("event-marker-tooltip");
  await expect(tooltip).toBeVisible({ timeout: 5_000 });
  const box = (await tooltip.boundingBox())!;
  const nativeTitle = await page.evaluate(() => document.querySelector("canvas")?.getAttribute("title") ?? "");

  await page.screenshot({ path: `${SHOT_DIR}/hover-bubble.png` });
  console.log(`HOVER-EVIDENCE ${JSON.stringify({ event: target.id, tile: { x: topLeft.x, y: topLeft.y, right: bottomRight.x, bottom: bottomRight.y }, box, nativeTitle })}`);

  expect(nativeTitle).toBe("");
  expect(box.x).toBeGreaterThanOrEqual(bottomRight.x - 2);
  expect(box.y + box.height).toBeLessThanOrEqual(bottomRight.y + 2);
  await expect(tooltip).toHaveClass(/tip-anchor-/);
});
