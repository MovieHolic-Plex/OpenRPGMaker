import { expect, test, type Page } from "@playwright/test";

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible().catch(() => false)) {
    await guest.click();
  }
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

test.describe("glm-5.2-ultrafast as default model", () => {
  test("settings show glm default, apiKey mode, and chat routes to gateway", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    let capturedRequest: { url: string; body: string } | null = null;
    let capturedResponse: { status: number; body: string } | null = null;
    page.on("request", (req) => {
      if (req.url().includes("/chat/completions")) {
        capturedRequest = { url: req.url(), body: req.postData() ?? "" };
      }
    });
    page.on("response", async (res) => {
      if (res.url().includes("/chat/completions")) {
        try {
          capturedResponse = { status: res.status(), body: await res.text() };
        } catch {
          capturedResponse = { status: res.status(), body: "(unreadable)" };
        }
      }
    });

    await page.addInitScript(() => {
      localStorage.removeItem("rpg-zzu:ai-config");
      localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    });
    await page.setViewportSize({ width: 1600, height: 920 });
    await page.goto("/?glmDefaultVerify=1");
    await dismissLogin(page);
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });

    const restore = page.getByTestId("ai-collapsed-restore");
    if (await restore.isVisible().catch(() => false)) {
      await restore.click();
    }

    await expect(page.getByTestId("ai-settings-toggle")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("ai-settings-toggle").click();
    await expect(page.getByTestId("ai-settings-modal")).toBeVisible();

    await expect(page.getByTestId("ai-config-model")).toHaveValue("z-ai/glm-5.2-ultrafast");
    await expect(page.getByTestId("ai-auth-api-key")).toHaveClass(/is-active/);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ai-settings-modal")).toBeHidden();

    const input = page.getByTestId("ai-input");
    await expect(input).toBeVisible();
    await input.fill("1+1은?");
    await page.getByTestId("ai-send").click();

    await expect.poll(() => capturedRequest !== null, { timeout: 30_000 }).toBe(true);

    expect(capturedRequest!.url).toContain("/api/ai");
    const body = JSON.parse(capturedRequest!.body);
    expect(body.model).toBe("z-ai/glm-5.2-ultrafast");

    await expect.poll(() => capturedResponse !== null, { timeout: 30_000 }).toBe(true);

    console.log("=== LLM Gateway Response ===");
    console.log("URL:", capturedRequest!.url);
    console.log("Model:", body.model);
    console.log("Status:", capturedResponse!.status);
    console.log("Body preview:", capturedResponse!.body.slice(0, 500));
    console.log("Console errors:", consoleErrors.slice(0, 5));

    expect([200, 429, 400, 401, 403]).toContain(capturedResponse!.status);
  });
});
