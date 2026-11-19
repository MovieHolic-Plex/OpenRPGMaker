import { expect, test } from "@playwright/test";

test("the launcher chip and menu open the shared AI form and keep local programs under Other ways", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:ai-config", JSON.stringify({ providerId: "openai-codex", model: "gpt-6.2-sol" }));
    Object.defineProperty(window, "oprn", { configurable: true, value: { start: { recentProjects: async () => [] } } });
  });
  await page.route("**/auth/**", route => {
    const url = new URL(route.request().url());
    const connected = url.pathname === "/auth/status" && url.searchParams.get("provider") === "openai-codex";
    return route.fulfill({ json: { connected, accountEmail: connected ? "builder@example.invalid" : undefined, endpoints: [] } });
  });
  await page.route("**/v1/local-agents*", route => route.fulfill({
    json: { clis: ["claude", "codex", "gemini"].map(id => ({ id, state: "not-installed", install: { url: "" } })) },
  }));
  await page.goto("/start-screen.html?lang=en");

  const chip = page.getByTestId("first-run-ai-status");
  const settings = page.getByTestId("start-settings");
  await chip.click();
  await expect(settings.getByTestId("ai-settings-chatgpt-account")).toContainText("builder@example.invalid");
  await expect(settings.getByRole("radio", { name: "Balanced" })).toBeChecked();
  const programs = settings.getByTestId("ai-settings-local-programs");
  await expect(programs).toBeHidden();
  await settings.getByTestId("ai-settings-other-ways").click();
  await programs.locator("summary").first().click();
  await expect(programs.getByTestId("start-settings-engine-codex")).toHaveAttribute("data-state", "not-installed");
  await expect(settings.getByTestId("ai-settings-chatgpt-account")).toBeVisible();
  await settings.getByTestId("ai-settings-tab-behavior").click();
  await settings.getByTestId("ai-settings-open-advanced").click();
  await expect(settings.getByTestId("ai-settings-advanced-done")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(settings.getByTestId("ai-settings-open-advanced")).toBeFocused();

  const aiTab = settings.getByTestId("start-settings-tab-ai");
  await aiTab.press("ArrowRight");
  await expect(settings.getByTestId("start-locale-select")).toBeVisible();
  await expect(settings.getByTestId("start-settings-tab-general")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(settings.getByTestId("start-settings-tab-about")).toHaveAttribute("aria-selected", "true");
  await expect(settings.getByText("Credits", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(chip).toBeFocused();

  await page.getByTestId("first-run-more").click();
  await page.getByTestId("first-run-more-settings").click();
  await expect(aiTab).toHaveAttribute("aria-selected", "true");
  await expect(settings.getByTestId("ai-settings-chatgpt-account")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("first-run-more")).toBeFocused();
});
