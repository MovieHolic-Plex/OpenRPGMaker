import { expect, type Page } from "@playwright/test";
import { gotoWithRetry } from "../../scripts/lib/goto-retry.mjs";

export async function seedProjectForEditor(page: Page, project: unknown, path = "/"): Promise<void> {
  await page.addInitScript((seed) => {
    window.__OPRN_E2E_PROJECT__ = seed;
    // 시드의 역할은 프로젝트 주입뿐 — 앞선 init 스크립트(beforeEach)가 정한 UI 모드는 보존한다.
    const uiMode = window.localStorage.getItem("oprn:editor-ui-mode");
    window.localStorage.clear();
    if (uiMode !== null) window.localStorage.setItem("oprn:editor-ui-mode", uiMode);
  }, project);
  await gotoWithRetry(page, path);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: Number(process.env.E2E_BOOT_TIMEOUT_MS ?? 15000) });
}
