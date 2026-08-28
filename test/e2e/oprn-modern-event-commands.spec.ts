import { expect, test, type Locator } from "@playwright/test";
import { openCommandPicker, openMapEventEditor, openPickerTab, pickerGrid } from "./eventStoryboardPicker";

/**
 * 모던(m2 200번대) 명령의 발견성 계약.
 *
 * 탭 3 헤딩은 카탈로그 분류명(`화면 효과`)이 아니라 저작면 이름(`화면 연출`)이다.
 * 탭 번호는 재분류(picker-ia) 이후 **실제 소속**을 따른다: 카메라 제어는 연출이라 탭3,
 * 고급 대화는 「문장 표시」로 통합된 은퇴 행이라 어느 탭에도 없어야 하고, UI 명령·데이터 조회는
 * 시스템·도구라 탭4다.
 * 탭4 버튼 24개 같은 고정 개수 단언은 카탈로그 드리프트라 폐기했다.
 */

// 탭 스직 4×4 회 · 새 프로젝트 시드를 한 테스트에서 돌린다 — 기본 30초 예산은 머싱 상황에
// 따라 갈리므로(우리 맵 시드만 15–30초) 통과가 운에 달리지 않게 새로 잡는다.
test.setTimeout(120_000);

const MODERN_COMMAND_TABS = [
  { label: "카메라 제어...", tab: 3, group: "화면 연출" },
  { label: "UI 명령...", tab: 4, group: "도구" },
  { label: "데이터 조회...", tab: 4, group: "도구" },
] as const satisfies readonly { readonly label: string; readonly tab: 1 | 2 | 3 | 4; readonly group: string }[];

/** 「문장 표시」로 통합된 은퇴 행 — 어느 탭에도 새로 고를 경로가 없어야 한다. */
const DEPRECATED_COMMAND_LABELS = ["고급 대화..."] as const;

test("modern commands live on their own IA tab and are reachable from the storyboard CTA", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  await openMapEventEditor(page);
  const picker = await openCommandPicker(page, "storyboard-cta");

  for (const modern of MODERN_COMMAND_TABS) {
    await openPickerTab(picker, modern.tab);
    const button = pickerGrid(picker).getByRole("button", { name: modern.label, exact: true });
    await expect(button, `${modern.label} 는 탭 ${modern.tab} 에 있어야 한다`).toBeEnabled();
    await expect(groupHeadingOf(button)).toHaveText(modern.group);
    // 다른 탭에서는 보이지 않는다 — 중복 노출은 IA 실패다.
    for (const otherTab of [1, 2, 3, 4] as const) {
      if (otherTab === modern.tab) continue;
      await openPickerTab(picker, otherTab);
      await expect(pickerGrid(picker).getByRole("button", { name: modern.label, exact: true })).toHaveCount(0);
    }
  }

  // 은퇴한 행은 어느 탭에도 없다 — 통합했다면 새로 저작하는 경로도 사라지는 것이 계약이다.
  for (const label of DEPRECATED_COMMAND_LABELS) {
    for (const tab of [1, 2, 3, 4] as const) {
      await openPickerTab(picker, tab);
      await expect(
        pickerGrid(picker).getByRole("button", { name: label, exact: true }),
        `${label} 는 탭 ${tab} 에도 없어야 한다`
      ).toHaveCount(0);
    }
  }

  // 전 탭 검색은 탭 칩으로 소속을 알려 준다.
  await picker.getByTestId("event-command-picker-search").fill("데이터 조회");
  const searchHit = pickerGrid(picker).locator(".event-command-picker-command-wrap", { hasText: "데이터 조회..." });
  await expect(searchHit.locator(".event-command-picker-page-chip")).toHaveText("시스템 · 도구");
  await picker.getByTestId("event-command-picker-search").fill("");
});

test("camera control opens guided m2 controls and lands on the storyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1478, height: 926 });
  await page.goto("/?freshProject=1");

  const editor = await openMapEventEditor(page);
  const picker = await openCommandPicker(page, "quick-next");
  await openPickerTab(picker, 3);

  await picker.getByTestId("command-picker-add-m2-201-camera-control").click();
  const commandDialog = page.getByTestId("event-command-edit-dialog");
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog).toContainText("카메라 제어");
  await expect(commandDialog.locator("select[data-command-kind-select='true']")).toHaveCount(0);
  await expect(commandDialog).not.toContainText("M2/현대 명령");
  await expect(commandDialog.getByTestId("m2-command-mode-option-select")).toBeVisible();
  await expect(commandDialog.getByTestId("m2-command-target-option-select")).toBeVisible();
  await expect(commandDialog.getByTestId("m2-command-x-input")).toBeVisible();
  await expect(commandDialog.getByTestId("m2-command-note-input")).toHaveCount(0);

  await commandDialog.getByTestId("m2-command-x-input").fill("12");
  await commandDialog.getByTestId("m2-command-y-input").fill("8");
  await commandDialog.getByTestId("event-command-edit-ok").click();

  await expect(picker).toBeHidden();
  await expect(editor.getByTestId("event-storyboard-card-0")).toContainText("카메라 제어");
  // 사라진 `event-command-header` 칩 대신 실제 산출법을 재엔다: 스토리부드에 카드 하나.
  await expect(editor.locator("[data-testid^='event-storyboard-card-']")).toHaveCount(1);
});

/** 명령 버튼이 속한 그룹 헤딩 — 그리드는 헤딩 → 버튼 순서의 평면 목록이다. */
function groupHeadingOf(button: Locator): Locator {
  return button.locator(
    "xpath=ancestor::div[contains(@class,'event-command-picker-command-wrap')]"
      + "/preceding-sibling::div[contains(@class,'event-command-picker-group-heading')][1]"
  );
}
