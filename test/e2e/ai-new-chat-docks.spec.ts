// 「새 대화」 컨트롤이 실제로 보이고 눌리고 대화를 비우는지.
//
// 2026-08-31: 파일 이름의 `docks` 는 유래다. 원래는 glass / side / float 세 도크마다
// 같은 검사를 한 번씩 돌렸다(같은 컨트롤이 도크에 따라 다른 부모에 마운트됐으므로).
// 도크 축이 삭제돼 마운트 지점이 하나뿐이라 케이스도 하나로 줄었다.
import { expect, test, type Page } from "@playwright/test";

const LAYOUT_KEY = "oprn:editor-layout:v4";
const COACH_KEY = "oprn:coachmarks-basic-v1";
const WELCOME_KEY = "oprn:standard-welcome-seen";

async function dismissLogin(page: Page): Promise<void> {
  const guest = page.getByTestId("login-guest");
  if (await guest.isVisible({ timeout: 5_000 }).catch(() => false)) await guest.click();
  await expect(page.getByTestId("login-modal")).toBeHidden({ timeout: 10_000 });
}

/** 복원할 대화를 심고 편집기를 띄운다 — 「새 대화」가 비울 대상이 있어야 한다. */
async function bootWithSeededConversation(page: Page): Promise<void> {
  await page.addInitScript(({ layoutKey, coachKey, welcomeKey }) => {
    localStorage.setItem(layoutKey, JSON.stringify({ leftWidth: 280, mapTreeHeight: 220 }));
    localStorage.setItem(coachKey, "1");
    localStorage.setItem(welcomeKey, "1");
    localStorage.setItem("oprn:ai-conversations", JSON.stringify([{
      id: "new-chat-reset",
      title: "reset marker",
      model: "e2e",
      savedAt: Date.now(),
      projectContextKey: "local:이슬 장터 — 30분::map_village_30_100x100",
      entries: [
        { kind: "user", text: "reset marker" },
        { kind: "assistant", text: "seeded reply" },
      ],
    }]));
  }, { layoutKey: LAYOUT_KEY, coachKey: COACH_KEY, welcomeKey: WELCOME_KEY });
  await page.goto("/?freshProject=1");
  await dismissLogin(page);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  const restore = page.getByTestId("ai-collapsed-restore");
  if (await restore.isVisible().catch(() => false)) await restore.click();
}

test("「새 대화」 컨트롤이 보이고, 누르면 대화가 비워진다", async ({ page }) => {
  test.setTimeout(120_000);
  await bootWithSeededConversation(page);

  await expect(page.getByTestId("ai-chat-log")).toContainText("reset marker");
  const newChat = page.getByTestId("ai-new-chat");
  await expect(newChat).toBeVisible();
  await expect(newChat).toHaveAttribute("title", "새 대화");
  await expect(newChat).toHaveAttribute("aria-label", "새 대화 시작");

  await newChat.click();

  await expect(page.getByTestId("ai-status")).toHaveText("새 대화");
  await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-ai-conversation", "empty");
  // 배치는 언제나 입력줄 하나다.
  await expect(page.getByTestId("ai-panel")).toHaveAttribute("data-chat-dock", "float");
});
