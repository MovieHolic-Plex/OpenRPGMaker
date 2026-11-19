import { expect, test } from "@playwright/test";
import { openAdvancedAiSettings, openTopbarAiSettings } from "./topbarNavigation";

test("edit mode restores existing chrome, removes the bottom bar, and exposes scrollable AI settings", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/?freshProject=1");

  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  // 맵 메뉴(2026-08-26)·게임 메뉴·클래식 툴바 행·작업 칩(2026-09-03)은 없다.
  // 2026-11 톱바 개편: 세계관·보기·명령 팔레트 칩·랜덤 전투는 ⌘K 로, 도움말·AI 설정은 ⋯ 안으로 옮겼다.
  for (const testId of [
    "menu-project",
    "toolbar-save",
    "toolbar-database",
    "toolbar-resource-manager",
    "topbar-assistant",
    "topbar-test-play",
  ]) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }
  await expect(page.getByTestId("menu-more-tools")).toHaveCount(0);
  for (const moved of ["toolbar-world", "workspace-panels-button", "workspace-command-palette-button", "topbar-battle-test"]) {
    await expect(page.getByTestId(moved)).toHaveCount(0);
  }

  for (const testId of [
    "editor-statusbar",
    "db-connection-status",
    "ai-connection-chip",
    "toggle-layout-bboxes",
    "ai-connection-status",
    "ai-settings-toggle",
    "ai-settings-command-bar",
  ]) {
    await expect(page.getByTestId(testId)).toHaveCount(0);
  }

  await openTopbarAiSettings(page);
  await expect(page.getByTestId("ai-settings-modal")).toBeVisible();
  await expect(page.getByTestId("ai-settings-modal")).toHaveCSS("position", "fixed");
  await expect(page.getByTestId("ai-settings-modal")).toHaveCSS("display", "grid");
  await expect(page.locator(".ai-settings-window")).toHaveCSS("display", "grid");
  await expect(page.getByTestId("ai-settings-rail").getByRole("button")).toHaveCount(2);
  await expect(page.getByTestId("ai-settings-advanced")).toBeHidden();
  await openAdvancedAiSettings(page);

  // The folded role controls must still fit when the sheet is opened on a narrow window.
  await page.setViewportSize({ width: 490, height: 720 });
  await page.getByTestId("ai-settings-model-progress").locator("summary").click();
  await page.getByTestId("ai-settings-model-screen").locator("summary").click();
  const content = page.locator(".ai-settings-sheet-body");
  const paneRight = await content.evaluate(element => element.getBoundingClientRect().left + element.clientWidth);
  for (const role of ["ultrabrain", "vision", "writer", "deep", "build"]) {
    const effort = page.locator(`[data-custom-select-for="ai-config-${role}-reasoning"]`);
    await expect(effort).toBeVisible();
    const box = await effort.boundingBox();
    expect(box, role).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0), role).toBeLessThanOrEqual(paneRight + 0.5);
  }

  await expect(page.getByTestId("ai-settings-body")).toHaveCSS("overflow-y", "hidden");
  await expect(content).toHaveCSS("overflow-y", "auto");
  const scroll = await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return {
      top: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
  expect(scroll.top).toBeGreaterThan(0);
  // 수동 「지금 저장」은 없다 — 푸터는 자동 저장 상태만 보여 준다.
  await expect(page.getByTestId("ai-config-saved-hint")).toBeVisible();

  // The assistant is mounted during editor bootstrap, before database.css is
  // lazy-loaded. Its first paint still needs a real flex workspace instead of
  // a block-flow panel below the canvas.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("ai-settings-open-advanced")).toBeFocused();
  await page.getByTestId("ai-settings-close").click();
  await page.setViewportSize({ width: 1024, height: 768 });
  const aiPanel = page.locator(".ai-chat-panel").first();
  await expect(aiPanel).toHaveCSS("display", "flex");
  await expect(aiPanel).toHaveCSS("position", "relative");
  const aiPanelBox = await aiPanel.boundingBox();
  expect(aiPanelBox).not.toBeNull();
  expect(aiPanelBox?.width ?? 0).toBeGreaterThan(0);
  expect(aiPanelBox?.height ?? 0).toBeGreaterThan(0);
});

test("ChatGPT sign-in and quality share the settings connection and role controls", async ({ page }) => {
  let signedIn = false;
  const actions: string[] = [];
  await page.route("**/auth/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const provider = url.searchParams.get("provider");
    if (provider === "openai-codex" && request.method() === "POST") {
      if (url.pathname === "/auth/login") { signedIn = true; actions.push("login"); }
      if (url.pathname === "/auth/logout") { signedIn = false; actions.push("logout"); }
    }
    const connected = provider === "openai-codex" && signedIn;
    await route.fulfill({ json: { connected, accountEmail: connected ? "you@example.com" : undefined, endpoints: [] } });
  });
  await page.goto("/?freshProject=1&lang=en");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.locator("body").press("Control+K");
  const search = page.getByTestId("command-palette-search");
  await search.fill("AI settings");
  await page.getByTestId("command-palette-item-command-topbar-ai-settings").click();
  const modal = page.getByTestId("ai-settings-modal");
  const alternatives = modal.getByText("Other ways to connect", { exact: true });
  const google = modal.getByTestId("ai-auth-quick-google-antigravity");
  await expect(google).toBeHidden();
  await modal.getByRole("button", { name: "Sign in with ChatGPT" }).click();
  await expect(modal.getByTestId("ai-settings-chatgpt-account")).toContainText("you@example.com");
  await alternatives.click();
  await expect(google).toBeVisible();
  await alternatives.click();

  const balanced = modal.getByRole("radio", { name: "Balanced" });
  const best = modal.getByRole("radio", { name: "Best quality" });
  await expect(balanced).toBeChecked();
  await balanced.press("ArrowRight");
  await expect(best).toBeChecked();
  await expect(best).toBeFocused();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("oprn:ai-config") ?? "{}"));
  expect(saved.roleModels.deep).toMatchObject({ model: "gpt-6.2-sol", thinkingLevel: "high" });

  await modal.getByRole("button", { name: "Behavior" }).click();
  const polish = modal.getByRole("switch", { name: "Polish dialogue after building" });
  await polish.press("Space");
  await expect(polish).not.toBeChecked();
  await polish.press("Space");
  await expect(polish).toBeChecked();

  await openAdvancedAiSettings(page);
  await modal.getByTestId("ai-settings-model-screen").locator("summary").click();
  await modal.getByTestId("ai-config-vision-model").fill("gpt-6.2-astra");
  await modal.getByTestId("ai-settings-advanced-done").click();
  await modal.getByRole("button", { name: "Connection" }).click();
  await expect(modal.getByText("Models are customized by role in Advanced.")).toBeVisible();
  await expect(balanced).not.toBeChecked();
  await expect(best).not.toBeChecked();
  await modal.getByRole("button", { name: "Sign out of ChatGPT" }).click();
  await expect(modal.getByRole("button", { name: "Sign in with ChatGPT" })).toBeVisible();
  expect(actions).toEqual(["login", "logout"]);
});
