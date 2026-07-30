// 영역 작업 패널 재설계 검증 — 제안 검토 단계에서 무엇이 보이고 무엇이 숨는가.
// 실제 LLM 없이 하네스 목업(writes)으로 모달을 검토 단계까지 몰아 검사한다.
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __rpgzzuRegionTaskHarness?: {
      currentMapId: () => string;
      openModal: (
        mapId: string,
        region: { x: number; y: number; width: number; height: number },
        writes?: { x: number; y: number; layer: "lower" | "upper"; tile: number }[],
        events?: unknown[],
      ) => void;
    };
  }
}

const REGION = { x: 2, y: 2, width: 8, height: 6 };
const OUT = "evidence/region-task-redesign";

// 서로 떨어진 두 덩어리 — 부분 적용 UI 가 의미를 갖는(청크 2개) 조건.
const WRITES = [
  { x: 3, y: 3, layer: "lower" as const, tile: 342 },
  { x: 4, y: 3, layer: "lower" as const, tile: 342 },
  { x: 3, y: 4, layer: "lower" as const, tile: 342 },
  { x: 8, y: 6, layer: "lower" as const, tile: 342 },
];

test.beforeEach(async ({ page }) => {
  await page.goto("/?freshProject=1");
  await page.waitForFunction(() => Boolean(window.__rpgzzuRegionTaskHarness));
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible();
});

test("검토 단계: 미리보기·변경칸 하이라이트가 보이고 입력창과 로그는 접힌다", async ({ page }) => {
  await page.evaluate(
    ([region, writes]) => {
      const harness = window.__rpgzzuRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never);
    },
    [REGION, WRITES] as const,
  );

  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 20_000 });

  // 결정에 필요한 것: 미리보기 두 장 + 변경 칸 하이라이트 + 적용 버튼(칸 수 포함).
  await expect(page.getByTestId("region-task-before")).toBeVisible();
  await expect(page.getByTestId("region-task-after")).toBeVisible();
  await expect(page.getByTestId("region-task-change-overlay")).toBeVisible();
  await expect(page.getByTestId("region-task-apply")).toContainText("4칸");
  await expect(page.getByTestId("region-task-retry")).toBeVisible();

  // 타일만 바뀌는 제안에서는 변경 목록을 띄우지 않는다 — 「적용 · 4칸」과 같은 말이 된다.
  await expect(page.getByTestId("region-task-change-list")).toBeHidden();

  // 결정에 필요 없는 것: 입력창 묶음과 고급(로그·부분적용·스탬프)은 접혀 있어야 한다.
  await expect(page.getByTestId("region-task-prompt")).toBeHidden();
  await expect(page.getByTestId("region-task-log")).toBeHidden();
  await expect(page.getByTestId("region-task-recap-text")).toContainText("둥근 호수");

  await modal.screenshot({ path: `${OUT}/01-review.png` });

  // 로그 본문에 깨진 JSON 이 노출되지 않는다(예전 결함).
  await page.getByTestId("region-task-advanced-toggle").click();
  await expect(page.getByTestId("region-task-log")).toBeVisible();
  const logText = (await page.getByTestId("region-task-log").innerText()) ?? "";
  expect(logText).not.toContain("{");
  await modal.screenshot({ path: `${OUT}/02-advanced-open.png` });
});

test("NPC 를 놓으면 변경 목록에 줄로 선다 — 지형 아닌 변경도 보여야 한다", async ({ page }) => {
  // 예전에는 미리보기(타일 스냅샷)와 "이벤트 N건" 숫자뿐이라, 상인을 배치해도
  // before/after 그림이 거의 같아 "아무것도 안 했다"로 읽혔다.
  await page.evaluate(
    ([region, writes]) => {
      const harness = window.__rpgzzuRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never, [
        {
          id: "shop_merchant_mock",
          x: 5,
          y: 5,
          trigger: "action",
          commands: [],
          pages: [{ name: "잡화점 주인", trigger: "action", priority: "same", commands: [], conditions: [] }],
        },
      ] as never);
    },
    [REGION, WRITES] as const,
  );
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 20_000 });

  const list = page.getByTestId("region-task-change-list");
  await expect(list).toBeVisible();
  await expect(page.getByTestId("region-task-change-row-tiles")).toContainText("타일");
  const npcRow = page.getByTestId("region-task-change-row-event-shop_merchant_mock");
  await expect(npcRow).toBeVisible();
  await expect(npcRow).toContainText("잡화점 주인");
  await expect(npcRow).toContainText("(5,5)");
  await expect(npcRow).toContainText("새로 놓임");
  // 이 목업은 프로젝트 전역을 건드리지 않으므로 영역 밖 경고는 없어야 한다.
  await expect(page.locator("[data-testid^='region-task-change-row-outside-']")).toHaveCount(0);
  await modal.screenshot({ path: `${OUT}/06-change-list.png` });
});

test("같은 타일로 된 두 덩어리를 위치와 하이라이트로 구분한다", async ({ page }) => {
  await page.evaluate(
    ([region, writes]) => {
      const harness = window.__rpgzzuRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never);
    },
    [REGION, WRITES] as const,
  );
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 20_000 });
  await page.getByTestId("region-task-advanced-toggle").click();

  // 두 덩어리 모두 같은 타일(Stone floor)이라 이름만으로는 겹친다 — 위치가 붙어야 구분된다.
  const labels = page.locator(".region-task-chunk-label");
  await expect(labels).toHaveCount(2);
  const texts = await labels.allInnerTexts();
  expect(texts[0]).not.toBe(texts[1]);
  expect(texts.join(" ")).toContain("좌상단");
  expect(texts.join(" ")).toContain("우하단");

  // 마우스를 올리면 그 덩어리만 살아나고 나머지는 물러난다.
  const overlay = page.getByTestId("region-task-change-overlay");
  await expect(overlay).not.toHaveClass(/is-isolating/);
  await labels.first().hover();
  await expect(overlay).toHaveClass(/is-isolating/);
  await expect(overlay.locator(".region-task-change-cell.is-focus")).toHaveCount(3);
  await modal.screenshot({ path: `${OUT}/04-chunk-hover.png` });

  // 체크를 풀면 그 덩어리 칸이 미리보기에서 빠진 것으로 보인다.
  await page.locator(".region-task-chunk-cb").last().uncheck();
  await expect(overlay.locator(".region-task-change-cell.is-excluded")).toHaveCount(1);
  await expect(page.getByTestId("region-task-partial-apply")).toContainText("3칸");
});

test("캔버스 우클릭 드래그는 영역 작업 창을 바로 띄운다", async ({ page }) => {
  // 예전에는 선택 칩 바만 떠서 그 안의 「AI」를 한 번 더 눌러야 이 창이 나왔다.
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스 없음");

  // 실제 포인터 이벤트가 처리되는지 먼저 확인(Phaser create() 완료 신호).
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => page.getByTestId("cursor-position").textContent()).not.toBe("outside");

  await page.mouse.move(box.x + 200, box.y + 180);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + 380, box.y + 300, { steps: 14 });
  await page.mouse.up({ button: "right" });

  const popover = page.getByTestId("region-task-popover");
  await expect(popover).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("region-task-input")).toBeVisible();
  // 칩 바와 동시에 뜨지 않는다 — 창이 열려 있는 동안 오버레이는 숨는다.
  await expect(page.getByTestId("selection-action-chips")).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/05-right-drag-popover.png` });

  // 닫으면 선택이 남아 칩 바가 돌아온다(복사/붙여넣기/지우기 경로 보존).
  await page.getByTestId("region-task-close").click();
  await expect(popover).toHaveCount(0);
  await expect(page.getByTestId("selection-action-chips")).toBeVisible({ timeout: 10_000 });
});

test("지시 수정을 누르면 입력 단계로 돌아간다", async ({ page }) => {
  await page.evaluate(
    ([region, writes]) => {
      const harness = window.__rpgzzuRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never);
    },
    [REGION, WRITES] as const,
  );
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 20_000 });

  await page.getByTestId("region-task-recap-edit").click();
  await expect(modal).toHaveAttribute("data-stage", "compose");
  await expect(page.getByTestId("region-task-prompt")).toBeVisible();
  await expect(page.getByTestId("region-task-input")).toBeEnabled();
  await modal.screenshot({ path: `${OUT}/03-compose.png` });
});

test("이벤트만 놓은 제안도 미리보기에 마커가 뜨고, 목록 hover 로 지목된다", async ({ page }) => {
  // 상인만 놓으면 타일 변경이 0이다. 예전 오버레이는 타일 변경이 없으면 아예 만들어지지
  // 않았으므로, 정작 이 기능이 필요한 경우에 마커가 없었다.
  await page.evaluate(
    (region) => {
      const harness = window.__rpgzzuRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, [] as never, [
        {
          id: "chest_gold_mock",
          x: 4,
          y: 4,
          trigger: "action",
          commands: [],
          pages: [{ name: "보물상자", trigger: "action", priority: "same", commands: [], conditions: [] }],
        },
      ] as never);
    },
    REGION,
  );
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 20_000 });

  const overlay = page.getByTestId("region-task-change-overlay");
  await expect(overlay).toBeVisible();
  const marker = overlay.locator(".region-task-event-marker");
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveText("🎁"); // id 에 chest → 상자 아이콘

  const row = page.getByTestId("region-task-change-row-event-chest_gold_mock");
  await expect(row).toBeVisible();
  await expect(overlay).not.toHaveClass(/is-isolating/);
  await row.hover();
  await expect(overlay).toHaveClass(/is-isolating/);
  await expect(overlay.locator(".region-task-event-marker.is-focus")).toHaveCount(1);
  await modal.screenshot({ path: `${OUT}/07-event-marker.png` });
});

test("추천 칩 카테고리 — 누르면 그 계열 명령으로 바뀌고 다시 누르면 돌아온다", async ({ page }) => {
  await page.evaluate(
    (region) => {
      const harness = window.__rpgzzuRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never);
    },
    REGION,
  );
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();

  // 카테고리 줄이 항상 보인다 — "무엇을 시킬 수 있나"가 UI 로 드러나야 한다.
  const categories = page.getByTestId("region-task-categories");
  await expect(categories).toBeVisible();
  const chips = categories.locator(".region-task-category-chip");
  expect(await chips.count()).toBeGreaterThanOrEqual(5);
  const labels = (await chips.allInnerTexts()).join(" ");
  expect(labels).toContain("타일");
  expect(labels).toContain("NPC");
  await modal.screenshot({ path: `${OUT}/08-categories.png` });

  const before = await page.getByTestId("region-task-suggestions").innerText();
  const npcChip = chips.filter({ hasText: "NPC" }).first();
  await npcChip.click();
  await expect(npcChip).toHaveClass(/is-active/);
  const afterNpc = await page.getByTestId("region-task-suggestions").innerText();
  expect(afterNpc).not.toBe(before);
  await modal.screenshot({ path: `${OUT}/09-category-npc.png` });

  // 같은 칩을 다시 누르면 선택 해제 → 문맥 추천으로 복귀.
  await npcChip.click();
  await expect(npcChip).not.toHaveClass(/is-active/);
  expect(await page.getByTestId("region-task-suggestions").innerText()).toBe(before);
});
