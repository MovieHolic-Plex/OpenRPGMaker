/* 최종 after 스크린샷 세트. CI 제외(_접두사). */
import { test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
const SHOT_DIR = "verify-shots/event-editor-hostile/after";
mkdirSync(SHOT_DIR, { recursive: true });
const TILE = 16;

async function openApp(page: Page, mode = "standard", w = 1440, h = 1000) {
  await page.addInitScript((m) => localStorage.setItem("oprn:editor-ui-mode", m), mode);
  await page.setViewportSize({ width: w, height: h });
  await seedProjectFromSupabaseCanonical(page, createModernNocturneProject(), "/?e2eVitals=1");
  await page.waitForFunction(() => typeof (window as any).__rpgzzuEditWorldToClient === "function", undefined, { timeout: 20_000 });
  await page.waitForTimeout(600);
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(300); }
}
async function dblclickTile(page: Page, tx: number, ty: number) {
  await page.waitForFunction(() => typeof (window as any).__rpgzzuEditWorldToClient === "function", undefined, { timeout: 15_000 });
  const pt = await page.evaluate(([x, y]) => (window as any).__rpgzzuEditWorldToClient(x, y), [tx * TILE + 8, ty * TILE + 8]);
  await page.getByTestId("tool-event").click().catch(() => {});
  await page.waitForTimeout(300);
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1400);
}

test("final shots", async ({ page }) => {
  test.setTimeout(300_000);
  await openApp(page);
  await dblclickTile(page, 17, 16);
  await page.screenshot({ path: `${SHOT_DIR}/FINAL-1-standard-list.png` });
  await page.getByTestId("event-editor-modal").getByTestId("event-view-toggle-storyboard").click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOT_DIR}/FINAL-2-storyboard-pills.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  // 새 이벤트 pristine 상태
  await dblclickTile(page, 14, 12);
  await page.screenshot({ path: `${SHOT_DIR}/FINAL-3-new-event.png` });
});
