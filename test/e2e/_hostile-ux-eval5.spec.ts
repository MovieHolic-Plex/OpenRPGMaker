/* 적대적 UX 평가 5차 — ESC가 컨텍스트 메뉴만 닫는지. CI 제외(_접두사). */
import { expect, test } from "@playwright/test";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
const TILE = 16;

test("Q. ESC with context menu open", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "standard"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, createModernNocturneProject(), "/?e2eVitals=1");
  await page.waitForFunction(() => typeof (window as any).__oprnEditWorldToClient === "function", undefined, { timeout: 20_000 });
  await page.waitForTimeout(600);
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(300); }
  const pt = await page.evaluate(([x, y]) => (window as any).__oprnEditWorldToClient(x, y), [17 * TILE + 8, 16 * TILE + 8]);
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1200);
  await page.getByTestId("event-editor-modal").getByTestId("event-view-toggle-list").click();
  await page.waitForTimeout(600);
  const row = await page.evaluate(() => {
    const m = document.querySelector<HTMLElement>("[data-testid='event-editor-modal']")!;
    const cands = Array.from(m.querySelectorAll<HTMLElement>("*")).filter((el) => /문장 표시: 윤서/.test(el.innerText ?? ""));
    const leaf = cands[cands.length - 1];
    const r = leaf.getBoundingClientRect();
    return { x: r.x + 40, y: r.y + r.height / 2 };
  });
  await page.mouse.click(row.x, row.y, { button: "right" });
  await page.waitForTimeout(500);
  const menuBefore = await page.locator("[data-testid='event-command-context-menu']").isVisible().catch(() => false);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({
    menu: !!document.querySelector("[data-testid='event-command-context-menu']"),
    modal: !!document.querySelector("[data-testid='event-editor-modal']"),
  }));
  console.log("ESC_MENU " + JSON.stringify({ menuBefore, after: st }));
  await page.screenshot({ path: "verify-shots/event-editor-hostile/Q01-esc-with-menu.png" });
  expect(true).toBe(true);
});
