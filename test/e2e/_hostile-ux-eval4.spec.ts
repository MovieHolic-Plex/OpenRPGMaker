/* 적대적 UX 평가 4차 — 삭제된 AI 승인 모달이 입력을 막지 않는지 확인. CI 제외(_접두사). */
import { expect, test } from "@playwright/test";
import { createModernNocturneProject } from "@/project/defaults/modernNocturneGame";
import { seedProjectForEditor } from "./projectSeed";
const TILE = 16;

test("P. 삭제된 승인 모달 없이 편집기 입력이 통한다", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "standard"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedProjectForEditor(page, createModernNocturneProject(), "/?e2eVitals=1");
  await page.waitForFunction(() => typeof (window as any).__oprnEditWorldToClient === "function", undefined, { timeout: 20_000 });
  await page.waitForTimeout(600);
  const skip = page.getByText("건너뛰기", { exact: true }).first();
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await page.waitForTimeout(300); }
  const pt = await page.evaluate(([x, y]) => (window as any).__oprnEditWorldToClient(x, y), [17 * TILE + 8, 16 * TILE + 8]);
  await page.mouse.click(pt.x, pt.y, { clickCount: 2, delay: 60 });
  await page.waitForTimeout(1200);
  await page.getByTestId("event-editor-modal").locator("[data-testid='event-page-name-input']").fill("백드롭테스트");
  await page.getByTestId("event-editor-ok").click();
  await page.waitForTimeout(900);

  await expect(page.locator(".ai-proposal-modal-backdrop, .ai-proposal-modal")).toHaveCount(0);
  await page.getByTestId("tool-paint").click({ timeout: 3000 });
  await expect(page.getByTestId("tool-paint")).toHaveClass(/is-active/u);
  await page.screenshot({ path: "verify-shots/event-editor-hostile/P01-after-ok-no-approval-modal.png" });
});
