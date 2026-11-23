import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Command, Project } from "@/project/types";
import { EVENT_DOCK_ID, eventDockProject, mockDockModel, openEventDockFixture } from "./eventAiDockFixture";

/**
 * 「조수로 명령 만들기」 도크가 **보기 방식과 무관하게** 초안을 보여야 한다는 계약.
 *  1) 스토리에서 초안을 검토하고 패널을 접거나 취소하면 스토리로 돌아온다.
 *  2) 생성 도중 스토어가 갱신돼 본문이 다시 그려져도 초안이 보인다(명령 영역이 비지 않는다).
 */
const EXISTING_COMMANDS: readonly Command[] = [
  { kind: "text", body: "나무 상자를 열어본다.", speaker: "" } as Command,
  { kind: "text", body: "잠겨 있다.", speaker: "" } as Command,
];

const MOCK_FINAL: readonly Command[] = [
  ...EXISTING_COMMANDS,
  { kind: "text", body: "상자가 열렸다.", speaker: "" } as Command,
  { kind: "setSelfSwitch", key: "A", value: true } as Command,
];

test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-ai-dock-defects");
    window.localStorage.setItem("oprn:editor-ui-mode", "standard");
  });
});

async function openDock(page: Page, project: Project): Promise<Locator> {
  await openEventDockFixture(page, project);
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  await editor.getByTestId("event-command-quick-ai").click();
  await expect(editor.getByTestId("ai-event-input")).toBeVisible();
  return editor;
}

test("스토리 보기의 초안을 같은 명령 영역에서 검토하고 접기와 취소 뒤 돌아간다", async ({ page }) => {
  await mockDockModel(page, MOCK_FINAL);
  const project = eventDockProject(EXISTING_COMMANDS);
  const editor = await openDock(page, project);

  await editor.getByTestId("event-view-toggle-storyboard").click();
  await expect(editor.getByTestId("event-storyboard-host")).toBeVisible();

  await editor.getByTestId("ai-event-input").fill("상자가 열리면 기억 A를 켜 줘");
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.getByTestId("ai-event-result")).toBeVisible();

  const stagedHost = editor.getByTestId("ai-event-staged-host");
  await expect(stagedHost).toBeVisible();
  await expect(stagedHost.getByTestId("ai-event-staged")).toBeVisible();
  await expect(stagedHost.locator("[data-testid^='ai-event-staged-row-']").first()).toBeVisible();
  await expect(editor.getByTestId("event-storyboard-host")).toBeHidden();
  await editor.getByTestId("ai-event-assist-summary").click();
  await expect(stagedHost).toBeHidden();
  await expect(editor.getByTestId("event-storyboard-host")).toBeVisible();
  await editor.getByTestId("event-command-quick-ai").click();
  await expect(stagedHost).toBeVisible();
  await editor.getByTestId("ai-event-discard").click();
  await expect(stagedHost).toBeHidden();
  await expect(editor.getByTestId("event-storyboard-host")).toBeVisible();
});

test("생성 중 본문이 다시 그려져도 초안이 보인다", async ({ page }) => {
  let release: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await mockDockModel(page, MOCK_FINAL, () => gate);
  const project = eventDockProject(EXISTING_COMMANDS);
  const editor = await openDock(page, project);
  await editor.getByTestId("event-view-toggle-list").click();

  await editor.getByTestId("ai-event-input").fill("상자가 열리면 기억 A를 켜 줘");
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.getByTestId("ai-event-status")).toHaveClass(/busy/);

  const dock = editor.getByTestId("ai-event-assist");
  const previousDockId = await dock.getAttribute("id");
  await page.evaluate(async ({ mapId, eventId }) => {
    const { store } = await import("/src/project/store.ts");
    const event = store.getCurrent().maps[mapId].events.find(candidate => candidate.id === eventId);
    if (!event) throw new Error("Missing event in fixture");
    // Publish an equivalent revision so the editor rerenders during generation.
    // An unrelated content change would trip the assistant's scoped draft check.
    store.replaceEvent(mapId, eventId, event);
  }, EVENT_DOCK_ID);
  await expect(dock).not.toHaveAttribute("id", previousDockId!);
  await expect(editor.getByTestId("ai-event-stop")).toBeVisible();
  await expect(editor.locator(".ai-event-elapsed")).toHaveText(/^[1-9]\d*초$/);
  release!();

  const stagedHost = editor.getByTestId("ai-event-staged-host");
  await expect(stagedHost).toBeVisible();
  await expect(stagedHost.getByTestId("ai-event-staged")).toBeVisible();
  await expect(stagedHost.locator("[data-testid^='ai-event-staged-row-']").first()).toBeVisible();
});
