import { expect, test, type Page } from "@playwright/test";

const LAYOUT_KEY = "oprn:editor-layout:v4";
const COACH_KEY = "oprn:coachmarks-basic-v1";
const WELCOME_KEY = "oprn:standard-welcome-seen";

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

async function bootDock(page: Page, dock: "glass" | "side" | "float"): Promise<void> {
  await page.addInitScript(({ layoutKey, coachKey, welcomeKey, selectedDock }) => {
    localStorage.setItem(layoutKey, JSON.stringify({ chatDock: selectedDock }));
    localStorage.setItem(coachKey, "1");
    localStorage.setItem(welcomeKey, "1");
    localStorage.setItem("oprn:ai-conversations", JSON.stringify([{
      id: `dock-reset-${selectedDock}`,
      title: "reset marker",
      model: "e2e",
      savedAt: Date.now(),
      projectContextKey: "local:이슬 장터 — 30분::map_village_30_100x100",
      entries: [
        { kind: "user", text: `reset marker ${selectedDock}` },
        { kind: "assistant", text: "seeded reply" },
      ],
    }]));
  }, { layoutKey: LAYOUT_KEY, coachKey: COACH_KEY, welcomeKey: WELCOME_KEY, selectedDock: dock });
  await page.goto("/?freshProject=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
}

for (const dock of ["glass", "side", "float"] as const) {
  test(`새 대화 control is visible and clickable in ${dock}`, async ({ page }) => {
    test.setTimeout(120_000);
    await bootDock(page, dock);
    await expect(page.getByTestId("ai-chat-log")).toContainText("reset marker");
    const newChat = page.getByTestId("ai-new-chat");
    await expect(newChat).toBeVisible();
    await expect(newChat).toHaveAttribute("title", "새 대화");
    await expect(newChat).toHaveAttribute("aria-label", "새 대화 시작");
    await newChat.click();
    await expect(page.getByTestId("ai-status")).toHaveText("새 대화");
    await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-ai-conversation", "empty");
  });
}
