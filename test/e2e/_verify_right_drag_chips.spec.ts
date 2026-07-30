import { expect, test } from "@playwright/test";

// 우클릭 드래그 → 선택 칩 바가 드래그 놓은 자리 근처에 뜨는지 (우하단 고정 아님) 검증.
// 기존: fixedSelectionChipsPosition → 캔버스 우하단 고정.
// 변경: anchoredSelectionChipsPosition → 놓은 점(context-menu 처럼) 또는 선택 rect 옆.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
});

test("우클릭 드래그 놓은 자리에 선택 칩이 뜬다 (우하단 고정 아님)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20000 });
  const canvas = page.getByTestId("edit-canvas").locator("canvas");

  // 캔버스 크기 확보
  await canvas.waitForElementState("stable");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas bounding box missing");

  // 캔버스 중앙 근처에서 우클릭 드래그: (cx-60, cy-40) → (cx+60, cy+40)
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const x0 = cx - 60, y0 = cy - 40, x1 = cx + 60, y1 = cy + 40;

  await page.mouse.move(x0, y0);
  await page.mouse.down({ button: "right" });
  // 드래그 중 이동 (moved=true 유도)
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(x0 + (x1 - x0) * (i / 6), y0 + (y1 - y0) * (i / 6));
    await page.waitForTimeout(20);
  }
  await page.mouse.up({ button: "right" });

  // 선택 칩 바가 뜬다
  const chips = page.getByTestId("selection-action-chips");
  await expect(chips).toBeVisible({ timeout: 5000 });

  // 칩 바 위치: 드래그 놓은 점(캔버스 중앙 근처)에 가까워야 한다.
  // 기존 우하단 고정이었다면 chips y는 canvas y+height-근처(~하단) 여야 함.
  // 이제 놓은 점 근처 → chips top 은 드래그 놓은 점(cy) ± 60 이내.
  const chipBox = await chips.boundingBox();
  if (!chipBox) throw new Error("chips bounding box missing");
  console.log("CANVAS center y=", cy, "height=", box.height);
  console.log("CHIPS box:", JSON.stringify(chipBox));
  console.log("DRAG release point:", x1, y1);

  // 핵심 단언: 칩 바의 중앙 y 가 드래그 놓은 점(y1=cy+40) 근처(±80px) 에 있다.
  // 우하단 고정이었다면 chips y ≈ box.y + box.height - 40 - chipHeight ≈ cy + box.height/2 - 40.
  // 드래그 놓은 점은 cy+40 이고, 우하단은 cy + box.height/2 - 40 이다 — box.height 가 충분히 크면
  // 두 값의 차이가 80px 보다 훨씬 크다 (구별 가능).
  const chipCenterY = chipBox.y + chipBox.height / 2;
  expect(Math.abs(chipCenterY - y1)).toBeLessThan(120);

  // 복사/AI 버튼이 칩 바에 존재
  await expect(page.getByTestId("selection-chip-copy")).toBeVisible();
  await expect(page.getByTestId("selection-chip-ai")).toBeVisible();

  // 스크린샷 증거
  await page.screenshot({ path: "output/evidence/right-drag-chips-anchored.png", fullPage: false });
});
