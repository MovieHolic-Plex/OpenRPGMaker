import { expect, test, type Page } from "@playwright/test";

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) {
    await guest.click();
  }
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

test.describe("region task live with glm-5.2-ultrafast", () => {
  test("diagnose region task state", async ({ page }) => {
    test.setTimeout(120_000);
    const consoleMsgs: string[] = [];
    page.on("console", (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));

    let requestCount = 0;
    page.on("request", (req) => {
      if (req.url().includes("/chat/completions")) {
        requestCount++;
        console.log("LLM request #" + requestCount + " sent");
      }
    });
    page.on("response", (res) => {
      if (res.url().includes("/chat/completions")) {
        console.log("LLM response status:", res.status());
      }
    });

    await page.addInitScript(() => {
      localStorage.removeItem("oprn:ai-config");
      localStorage.setItem("oprn:editor-ui-mode", "expert");
    });
    await page.setViewportSize({ width: 1600, height: 920 });
    await page.goto("/?regionLiveVerify=1");
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });

    const mapId = await page.evaluate(() => (window as any).__rpgzzuRegionTaskHarness?.currentMapId());

    await page.evaluate(([mid]) => {
      (window as any).__rpgzzuRegionTaskHarness.openModal(mid, { x: 5, y: 5, width: 10, height: 10 });
    }, [mapId]);

    await expect(page.getByTestId("region-task-modal")).toBeVisible({ timeout: 5_000 });

    const input = page.getByTestId("region-task-input");
    await input.fill("나무 3개 배치해");
    await page.getByTestId("region-task-run").click();

    await page.waitForTimeout(45_000);

    const state = await page.evaluate(() => {
      const summary = document.querySelector("[data-testid='region-task-summary']")?.textContent?.trim() ?? "(no summary)";
      const log = (window as any).__rpgzzuRegionTaskLog;
      const logExists = !!log;
      const modalVisible = !!document.querySelector("[data-testid='region-task-modal']");
      const runBtn = document.querySelector("[data-testid='region-task-run']") as HTMLButtonElement;
      const runBtnDisabled = runBtn?.disabled;
      const applyBtn = document.querySelector("[data-testid='region-task-apply']");
      const discardBtn = document.querySelector("[data-testid='region-task-discard']");
      const regionLog = document.querySelector("[data-testid='region-task-log']")?.textContent?.trim().slice(0, 500) ?? "";
      return { summary, logExists, logResult: log?.result, modalVisible, runBtnDisabled, hasApply: !!applyBtn, hasDiscard: !!discardBtn, regionLog };
    });

    console.log("=== Page State After 45s ===");
    console.log("summary:", state.summary);
    console.log("logExists:", state.logExists);
    console.log("logResult:", JSON.stringify(state.logResult, null, 2));
    console.log("modalVisible:", state.modalVisible);
    console.log("runBtnDisabled:", state.runBtnDisabled);
    console.log("hasApply:", state.hasApply);
    console.log("hasDiscard:", state.hasDiscard);
    console.log("regionLog:", state.regionLog);
    console.log("total LLM requests:", requestCount);
    console.log("console msgs:", consoleMsgs.filter(m => !m.includes("ERR_CONNECTION_REFUSED")).slice(0, 10));

    expect(state).toBeDefined();
  });
});
