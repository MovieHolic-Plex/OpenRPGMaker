// 전신 초상 크기 조절 — 자료집 「대화창 → 전신 초상」과 얼굴 표시 명령의 「장면 크기」.
// 둘 다 무대 견본이 슬라이더를 따라 커지고 줄어야 하며, 값은 store 에 남아야 한다.
import { expect, test, type Page } from "@playwright/test";
import { gotoWithRetry } from "../../scripts/lib/goto-retry.mjs";
import { openCommandPicker, openMapEventEditor } from "./eventStoryboardPicker";

test.describe.configure({ timeout: 180_000 });

const SHOTS = "verify-shots/dialogue-full-portrait-size";
const FULL_ID = "shared-people1-girl-expressions-full-base";

// UI 계약만 보므로 빈 프로젝트(저장 없음)로 충분하다.
async function openBlankEditor(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await gotoWithRetry(page, "/?blankProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 45_000 });
}

async function figureHeight(page: Page, stageTestid: string): Promise<number> {
  const figure = page.getByTestId(stageTestid).getByTestId("full-portrait-stage-figure");
  await expect(figure).toBeVisible();
  return (await figure.boundingBox())?.height ?? 0;
}

async function setStepper(page: Page, testid: string, value: number): Promise<void> {
  const input = page.getByTestId(testid);
  await input.fill(String(value));
  await input.dispatchEvent("change");
}

test("자료집 대화창의 전신 초상 크기·내림이 견본과 저장값을 바꾼다", async ({ page }) => {
  await openBlankEditor(page);
  await page.evaluate(async () => {
    const path = "/src/editor/panels/databaseModal.ts";
    const { openDatabaseModal } = await import(path);
    openDatabaseModal("system");
  });
  await page.getByTestId("db-system-nav-dialogue").click();
  const stage = page.getByTestId("db-system-dialogue-full-stage");
  await stage.scrollIntoViewIfNeeded();
  const before = await figureHeight(page, "db-system-dialogue-full-stage");
  await stage.locator("xpath=..").screenshot({ path: `${SHOTS}/db-default.png` });

  await setStepper(page, "db-system-dialogue-full-height-stepper", 80);
  await setStepper(page, "db-system-dialogue-full-drop-stepper", 0);
  const after = await figureHeight(page, "db-system-dialogue-full-stage");
  expect(after).toBeLessThan(before * 0.7);
  await stage.locator("xpath=..").screenshot({ path: `${SHOTS}/db-80-drop0.png` });

  const saved = await page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store } = await import(path);
    return store.getCurrent().system.dialogueFullPortrait;
  });
  expect(saved).toEqual({ height: 80, drop: 0 });
});

test("얼굴 표시 명령의 장면 크기가 전신일 때만 보이고 견본을 키운다", async ({ page }) => {
  await openBlankEditor(page);
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await openMapEventEditor(page);
  const picker = await openCommandPicker(page, "toolbar-add");
  await picker.getByRole("button", { name: "얼굴 바꾸기...", exact: true }).first().click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  const form = dialog.getByTestId("event-command-face-editor");
  await expect(form).toBeVisible();
  await expect(form.getByTestId("event-command-face-full-scale-section")).toBeHidden();

  const resource = form.getByTestId("event-command-face-resource");
  await resource.fill(FULL_ID);
  await resource.dispatchEvent("change");
  await expect(form.getByTestId("event-command-face-full-scale-section")).toBeVisible();
  const before = await figureHeight(page, "event-command-face-full-stage-preview");

  await setStepper(page, "event-command-face-full-scale", 150);
  const after = await figureHeight(page, "event-command-face-full-stage-preview");
  expect(after).toBeGreaterThan(before * 1.4);
  await form.getByTestId("event-command-face-full-scale-section").screenshot({ path: `${SHOTS}/command-150.png` });
  await dialog.screenshot({ path: `${SHOTS}/command-dialog.png` });
});
