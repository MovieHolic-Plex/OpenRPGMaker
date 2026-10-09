import { expect, test, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { seedProjectForEditor } from "./projectSeed";

test.setTimeout(60_000);

/** 상점 단일 목록의 «판매 중» 그룹 행들. 담김/빼기 상태를 읽는 유일한 표면이다. */
function saleListRows(page: Page) {
  return page.locator('[data-testid="shop-sale-list"] [data-testid^="shop-item-row-"]');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-editor-trust-loop");
  });
});

test("event editor draft, validation, picker, and runtime test form one trustworthy loop", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const project = createBlankProject();
  await seedProjectForEditor(page, project, "/?freshProject=1");
  const ids = await openNewEventEditor(page, project.startMapId);
  const editor = page.getByTestId("event-editor-modal");

  await expect(editor).toBeVisible();
  await expect(editor.getByTestId("event-command-empty-experience")).toBeVisible();
  for (const testId of [
    "event-template-talking-npc",
    "event-template-treasure-chest",
    "event-template-transfer",
    "event-template-shop",
    "event-template-battle",
    "event-template-empty-search",
  ]) {
    await expect(editor.getByTestId(testId), testId).toBeVisible();
  }
  await expect(editor.getByTestId("event-editor-draft-status")).toContainText("취소 시 삭제");
  await expect(editor.getByTestId("event-editor-draft-status")).toContainText("자동 저장");
  await expect(editor.getByTestId("event-editor-remote-status")).toContainText("임시 세션");

  await editor.getByTestId("event-template-transfer").click();
  await expect(page.getByTestId("event-transfer-player-dialog")).toBeVisible();
  await page.getByTestId("event-command-edit-cancel").click();

  await editor.getByTestId("event-template-shop").click();
  await expect(page.getByTestId("event-command-edit-dialog")).toBeVisible();
  // 상점 서식은 진열을 미리 채워 준다 — 판매 중 그룹에 행이 있어야 한다.
  await expect(saleListRows(page)).not.toHaveCount(0);
  await page.getByTestId("event-command-edit-cancel").click();

  await editor.getByTestId("event-template-battle").click();
  await expect(page.getByTestId("event-command-edit-dialog")).toBeVisible();
  await expect(page.getByTestId("battle-processing-troop-select")).not.toHaveValue("");
  await page.getByTestId("event-command-edit-cancel").click();

  await editor.getByTestId("event-template-talking-npc").click();
  const textBody = page.getByTestId("event-command-text-body");
  await expect(textBody).toHaveValue("안녕하세요.");
  await textBody.fill("브라우저 신뢰 루프");
  await page.getByTestId("event-command-edit-ok").click();
  await expect(editor.getByTestId("event-command-text")).toBeVisible();
  expect(await eventDraftExists(page, ids)).toBe(true);

  await page.keyboard.press("Control+K");
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  const pickerSearch = picker.getByTestId("event-command-picker-search");
  await expect(pickerSearch).toBeFocused();
  await page.keyboard.type("대기");
  await expect(pickerSearch).toHaveValue("대기");
  await pickerSearch.fill("");
  const firstTab = picker.getByTestId("event-command-picker-tab-1");
  const secondTab = picker.getByTestId("event-command-picker-tab-2");
  await expect(firstTab).toHaveAttribute("tabindex", "0");
  await expect(secondTab).toHaveAttribute("tabindex", "-1");
  await firstTab.press("ArrowRight");
  await expect(secondTab).toHaveAttribute("aria-selected", "true");
  await expect(secondTab).toHaveAttribute("tabindex", "0");
  await picker.getByTestId("event-command-picker-cancel").click();
  expect(await eventDraftExists(page, ids)).toBe(true);

  await editor.getByTestId("event-command-text").locator(".cmd-head").press("Delete");
  await expect(editor.getByTestId("event-command-empty-experience")).toBeVisible();
  await editor.getByTestId("event-template-shop").click();
  // 체크 해제가 유일한 빼기 경로다. 해제하면 행이 안 담음 그룹으로 옮겨 가므로
  // 매번 판매 중 그룹을 다시 조회해야 한다(목록이 통째로 재빌드된다).
  const rows = saleListRows(page);
  for (let guard = 0; guard < 20 && (await rows.count()) > 0; guard += 1) {
    await rows.first().locator('input[type="checkbox"]').uncheck();
  }
  await expect(rows).toHaveCount(0);
  await page.getByTestId("event-command-edit-ok").click();
  await expect(editor.getByTestId("event-command-shop")).toBeVisible();

  await editor.getByTestId("event-editor-apply").click();
  await expect(editor).toBeVisible();
  const validation = editor.getByTestId("event-draft-validation");
  await validation.locator(":scope > summary").click();
  await expect(validation).toHaveAttribute("open", "");
  const issue = editor.locator('[data-issue-code="shop.items.empty"]');
  await expect(issue).toBeVisible();
  await issue.click();
  await expect(editor.getByTestId("event-command-shop")).toHaveClass(/selected/);
  await page.screenshot({ path: testInfo.outputPath("validation-navigation.png"), fullPage: true });

  await editor.getByTestId("event-command-shop").locator(".cmd-head").press("Delete");
  await expect(editor.getByTestId("event-command-empty-experience")).toBeVisible();
  await editor.getByTestId("event-template-talking-npc").click();
  await textBody.fill("실제 런타임 경로");
  await page.getByTestId("event-command-edit-ok").click();
  await expect(editor.getByTestId("event-command-text")).toBeVisible();

  await editor.getByTestId("event-editor-test").click();
  const testWindow = page.getByTestId("test-play-window");
  await expect(testWindow).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("test-play-window-title")).toContainText("이벤트 테스트");
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: testInfo.outputPath("selected-event-runtime.png"), fullPage: true });
  await page.getByTestId("test-play-window-close").click();
  await expect(testWindow).toBeHidden();
  await expect(editor).toBeVisible();

  await editor.getByTestId("event-editor-cancel").click();
  await page.getByRole("button", { name: "버리고 닫기" }).click();
  await expect(editor).toBeHidden();
  expect(await eventDraftExists(page, ids)).toBe(false);
});

async function openNewEventEditor(
  page: Page,
  mapId: string,
): Promise<{ readonly mapId: string; readonly eventId: string }> {
  const eventId = await page.evaluate(async (activeMapId) => {
    const modalModule = await import("/src/editor/panels/eventEditor/modal.ts");
    return modalModule.openNewEventEditorModal(activeMapId, 3, 3);
  }, mapId);
  return { mapId, eventId };
}

async function eventDraftExists(
  page: Page,
  ids: { readonly mapId: string; readonly eventId: string },
): Promise<boolean> {
  return await page.evaluate(async ({ mapId, eventId }) => {
    const { checkpointEventDraft } = await import("/src/editor/eventDraftActions.ts");
    return checkpointEventDraft(mapId, eventId);
  }, ids);
}
