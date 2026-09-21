import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults";
import { openCommandPicker, openMapEventEditor } from "./eventStoryboardPicker";
import { seedProjectForEditor } from "./projectSeed";

const DIR = "output/evidence/face-section-qa";

test("얼굴 바꾸기 상태별 증거", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(DIR, { recursive: true });
  const dialog = await openCommand(page, "얼굴 바꾸기...");
  const summary: Record<string, unknown> = {};

  summary.chip = await snap(page, dialog, "FIX-chip");
  await dialog.getByTestId("event-command-face-position").selectOption("right");
  await dialog.getByTestId("event-command-face-flip-horizontal").check();
  summary.chipRightFlipped = await snap(page, dialog, "FIX-chip-right-flipped");
  await dialog.getByTestId("event-command-face-bust-preset").click();
  summary.bust = await snap(page, dialog, "FIX-bust");
  await dialog.getByTestId("event-command-face-full-preset").click();
  summary.full = await snap(page, dialog, "FIX-full");
  await dialog.getByTestId("event-command-face-resource-clear").click();
  summary.cleared = await snap(page, dialog, "FIX-cleared");

  await writeFile(`${DIR}/fixed.json`, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
});

test("공용 미리보기 대화창을 쓰는 이웃 명령 증거", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(DIR, { recursive: true });
  for (const label of ["문장 표시...", "문장 표시 설정...", "선택지 표시..."]) {
    const dialog = await openCommand(page, label);
    await dialog.screenshot({ path: `${DIR}/FIX-neighbour-${label.replace(/[.\s]/g, "")}.png` });
    await dialog.getByTestId("event-command-edit-cancel").click().catch(() => {});
    await page.reload();
  }
});

async function snap(page: Page, dialog: Locator, name: string): Promise<unknown> {
  await dialog.screenshot({ path: `${DIR}/${name}.png` });
  return page.evaluate(() => {
    const boxes = [...document.querySelectorAll<HTMLElement>(".faceset-crop-box")];
    const doubled = boxes.filter(
      (box) =>
        getComputedStyle(box).backgroundImage !== "none"
        && box.querySelector("img.faceset-crop-sheet") !== null
    );
    const options = document.querySelector<HTMLElement>(".event-command-face-options");
    return {
      faceBoxes: boxes.length,
      doublePainted: doubled.length,
      optionsColumns: options === null ? null : getComputedStyle(options).gridTemplateColumns,
      optionsFields: options?.children.length ?? null,
    };
  });
}

async function openCommand(page: Page, label: string): Promise<Locator> {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await seedProjectForEditor(page, createBlankProject());
  const skip = page.getByTestId("coach-mark-skip");
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await openMapEventEditor(page);
  const picker = await openCommandPicker(page);
  await picker.getByRole("button", { name: label, exact: true }).first().click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}
