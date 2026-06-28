import { expect, type Page } from "@playwright/test";

export async function seedProjectFromSupabaseCanonical(page: Page, project: unknown, path = "/"): Promise<void> {
  await page.addInitScript((seed) => {
    window.__RPG_ZZU_E2E_PROJECT__ = seed;
    window.localStorage.clear();
  }, project);
  await page.goto(path);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15000 });
}
