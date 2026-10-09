import { mkdir } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import { mockupProject } from "./mockupProbeSeeds";
import { seedProjectForEditor } from "./projectSeed";

/** AC10: open aux chip must not fully cover the command list (cmd-list height stays usable). */
const CMD_LIST_MIN_HEIGHT_PX = 48;

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-event-aux-non-occlusion");
  });
});

test("event editor aux chip leaves command list geometry usable (AC10)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const project = createBlankProject();
  await seedProjectForEditor(page, project);

  const editor = await openEventEditor(page, project.startMapId);
  await editor.getByTestId("event-view-toggle-list").click();
  const cmdList = editor.locator(".event-contents-fieldset .cmd-list");
  await expect(cmdList).toBeVisible();

  const closedBox = await cmdList.boundingBox();
  if (!closedBox) throw new Error("cmd-list geometry was not measurable before aux open");
  expect(closedBox.height).toBeGreaterThan(CMD_LIST_MIN_HEIGHT_PX);

  const auxChip = await openAuxChip(editor);
  await expect(auxChip).toHaveJSProperty("open", true);

  const openBox = await cmdList.boundingBox();
  if (!openBox) throw new Error("cmd-list geometry was not measurable while aux open");
  expect(openBox.height).toBeGreaterThan(CMD_LIST_MIN_HEIGHT_PX);
});

test("event editor preset and toolbar do not overlap the command list", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1180 });
  const project = createBlankProject();
  await seedProjectForEditor(page, project);

  const editor = await openEventEditor(page, project.startMapId);
  const cmdList = editor.locator(".event-contents-fieldset .cmd-list");
  const toolbar = editor.locator(".event-editor-command-toolbar");
  const presetBar = editor.getByTestId("follower-preset-bar");
  const viewSwitcher = editor.getByTestId("event-view-toggle");
  const storyboard = editor.locator(".event-storyboard");
  const graph = editor.locator(".event-graph-placeholder");

  await editor.getByTestId("event-view-toggle-storyboard").click();
  await expect(storyboard).toBeVisible();
  await expect(cmdList).toBeHidden();
  await expect(graph).toBeHidden();
  await editor.getByTestId("event-view-toggle-list").click();

  await expect(cmdList).toBeVisible();
  await expect(storyboard).toBeHidden();
  await expect(graph).toBeHidden();
  await editor.getByTestId("event-editor-aux-tools").locator(":scope > summary").click();
  await expect(toolbar).toBeVisible();
  await expect(presetBar).toBeVisible();
  await expect(viewSwitcher).toBeVisible();

  const [cmdListBox, toolbarBox, presetBox, viewSwitcherBox] = await Promise.all([
    cmdList.boundingBox(),
    toolbar.boundingBox(),
    presetBar.boundingBox(),
    viewSwitcher.boundingBox(),
  ]);
  if (!cmdListBox || !toolbarBox || !presetBox || !viewSwitcherBox) {
    throw new Error("event editor command geometry was not measurable");
  }

  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(cmdListBox.y);
  const presetOverlapsList =
    presetBox.y < cmdListBox.y + cmdListBox.height &&
    presetBox.y + presetBox.height > cmdListBox.y;
  expect(presetOverlapsList).toBe(false);
  expect(viewSwitcherBox.y + viewSwitcherBox.height).toBeLessThanOrEqual(cmdListBox.y);
});

test("AI 명령 도크는 명령 목록을 덮지 않고 모달 안에 머밃다", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 900 });
  const { project, eventId } = mockupProject();
  await seedProjectForEditor(page, project);
  await page.evaluate(async ({ mapId, id }) => {
    const modalModule = await import("/src/editor/panels/eventEditor/modal.ts");
    modalModule.openEventEditorModal(mapId, id);
  }, { mapId: project.startMapId, id: eventId });

  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  await editor.getByTestId("event-view-toggle-list").click();
  await editor.locator(".cmd-item .cmd-head").first().click();
  await expect(editor.getByTestId("event-editor-inspector")).toBeVisible();

  // 단일 진입점: 툴바 AI 버튼 하나로 도크가 열린다(도구 팝오버 경유 없이).
  await editor.getByTestId("event-command-quick-ai").click();
  const ai = editor.getByTestId("ai-event-assist");
  await expect(ai).toHaveJSProperty("open", true);
  await expect(editor.getByTestId("event-editor-aux-tools")).toHaveJSProperty("open", false);
  const card = ai.locator(".ai-event-assist-body");
  await expect(card).toBeVisible();
  await expect(editor.getByTestId("ai-event-input")).toBeFocused();

  const probe = await card.evaluate((body) => {
    const cardRect = body.getBoundingClientRect();
    const modalRect = body.closest<HTMLElement>('[role="dialog"]')?.getBoundingClientRect();
    const listRect = body.closest<HTMLElement>(".event-editor-commands-column")
      ?.querySelector<HTMLElement>(".event-contents-fieldset .cmd-list")
      ?.getBoundingClientRect();
    const input = body.querySelector<HTMLElement>(".ai-event-input");
    const inputStyle = input ? getComputedStyle(input) : null;
    const overlapWidth = listRect
      ? Math.max(0, Math.min(listRect.right, cardRect.right) - Math.max(listRect.left, cardRect.left))
      : 0;
    const overlapHeight = listRect
      ? Math.max(0, Math.min(listRect.bottom, cardRect.bottom) - Math.max(listRect.top, cardRect.top))
      : 0;

    return {
      cardWithinModal: Boolean(
        modalRect &&
          cardRect.left >= modalRect.left - 1 &&
          cardRect.right <= modalRect.right + 1 &&
          cardRect.top >= modalRect.top - 1 &&
          cardRect.bottom <= modalRect.bottom + 1
      ),
      listOverlapArea: Math.round(overlapWidth * overlapHeight),
      listHeight: listRect ? Math.round(listRect.height) : 0,
      inputLineHeight: Number.parseFloat(inputStyle?.lineHeight ?? "0"),
      inputHeight: input?.getBoundingClientRect().height ?? 0,
    };
  });

  expect(probe.cardWithinModal).toBe(true);
  // 오버레이 시절의 결함: 작업 카드가 자기가 명령을 넣을 목록을 덮었다(실직 46%).
  expect(probe.listOverlapArea).toBe(0);
  expect(probe.listHeight).toBeGreaterThan(CMD_LIST_MIN_HEIGHT_PX);
  expect(probe.inputLineHeight).toBeGreaterThanOrEqual(21);
  expect(probe.inputHeight).toBeGreaterThanOrEqual(66);

  // Escape 는 도크만 닫는다 — 이벤트 에디터가 함까 닫힐가 모든 입력을 사라지게 하면 안 된다.
  await page.keyboard.press("Escape");
  await expect(ai).toHaveJSProperty("open", false);
  await expect(editor).toBeVisible();

  await mkdir("output/evidence/event-ai-assist-ux", { recursive: true });
  await editor.screenshot({ path: "output/evidence/event-ai-assist-ux/960x900-compact.png" });
});

async function openEventEditor(page: Page, mapId: string): Promise<Locator> {
  await page.evaluate(async (activeMapId) => {
    const modalModule = await import("/src/editor/panels/eventEditor/modal.ts");
    modalModule.openNewEventEditorModal(activeMapId, 3, 3);
  }, mapId);

  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  return editor;
}

/**
 * 겹침 검사용 보조 칩을 하나 연다.
 *
 * 예전 1순위였던 `event-script-flowchart` 는 이 목록에 없다 — 플로우는 도구 팝오버
 * 아코디언에서 「이 페이지가 하는 일」 칼럼의 네 번째 보기 방식으로 승격됐고,
 * 그러면서 겹칠 수 있는 오버레이 자체를 그만뒀다.
 */
async function openAuxChip(editor: Locator): Promise<Locator> {
  const shell = editor.getByTestId("event-editor-aux-tools");
  const shellOpen = await shell.evaluate((node) => node instanceof HTMLDetailsElement && node.open);
  if (!shellOpen) await shell.locator(":scope > summary").click();

  const candidates = [
    "ai-event-assist",
  ] as const;

  for (const testId of candidates) {
    const chip = editor.getByTestId(testId);
    if ((await chip.count()) === 0) continue;
    await expect(chip).toBeVisible();
    const isOpen = await chip.evaluate((node) => node instanceof HTMLDetailsElement && node.open);
    if (!isOpen) {
      await chip.locator("summary").first().click();
    }
    await expect
      .poll(async () => chip.evaluate((node) => node instanceof HTMLDetailsElement && node.open))
      .toBe(true);
    return chip;
  }

  throw new Error("no event-editor aux chip found for AC10 non-occlusion check");
}
