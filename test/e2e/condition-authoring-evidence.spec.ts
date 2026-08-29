import { expect, test } from "@playwright/test";
import { openCommandPicker, openMapEventEditor, openPickerTab, pickerGrid } from "./eventStoryboardPicker";

// 새 프로젝트 시드만 15~30초를 먹으므로 기본 30초 예산에서는 통과가 부하 운에 달린다
// (oprn-modern-event-commands.spec.ts 가 같은 이유로 예산을 올려 둔다). 줄이지 말 것.
test.setTimeout(180_000);

const EVIDENCE = ".omo/evidence/event-conditions";
const FORBIDDEN_TOKENS = ["AND(", "OR(", "timer1", "timer2", "abandoned"] as const;

test("조건 저작 표면: 페이지 조건 레일과 조건 분기 폼을 실제 브라우저에서 캡처한다", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);

  await editor.getByTestId("evt-rail-group-when").click();
  const rows = editor.locator(".event-condition-row");
  await expect(rows.first()).toBeVisible();
  const rowCount = await rows.count();
  await editor.screenshot({ path: `${EVIDENCE}/01-page-condition-rail.png` });

  await rows.first().locator("input[type=checkbox]").check();
  const polarity = editor.getByTestId("event-page-switch-condition-value");
  await expect(polarity).toBeVisible();
  await polarity.selectOption("off");
  await editor.screenshot({ path: `${EVIDENCE}/02-switch-off-polarity.png` });

  const picker = await openCommandPicker(page, "storyboard-cta");
  await openPickerTab(picker, 1);
  const forkButton = pickerGrid(picker).getByRole("button", { name: /조건 분기/ }).first();
  await expect(forkButton).toBeEnabled();
  await forkButton.click();

  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  const mode = dialog.getByTestId("event-condition-mode");
  await expect(mode).toBeVisible();
  await dialog.screenshot({ path: `${EVIDENCE}/03-fork-condition-form.png` });

  await mode.selectOption("friendshipAtLeast");
  await dialog.screenshot({ path: `${EVIDENCE}/04-fork-friendship-hint.png` });

  await mode.selectOption("timer");
  await dialog.screenshot({ path: `${EVIDENCE}/05-fork-timer-undetermined.png` });

  await mode.selectOption("all");
  await dialog.screenshot({ path: `${EVIDENCE}/06-fork-nested-group.png` });

  const renderedText = `${await editor.innerText()}\n${await dialog.innerText()}`;
  for (const token of FORBIDDEN_TOKENS) {
    expect(renderedText, `렌더된 조건 표면에 내부 토큰 ${token} 가 보이면 안 된다`).not.toContain(token);
  }
  expect(rowCount, "조건 행은 비활성이어도 자리를 남겨야 한다(D09 회귀 방지)").toBeGreaterThanOrEqual(10);
});
