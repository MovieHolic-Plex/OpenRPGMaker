// test/e2e/_region-task-ui-audit-shots.spec.ts
// 2026-08-30 영역 작업 UI 감사 — 수정 후 상태 증거 캡처(진단 스펙, 기본 스위트 제외).
// 실제 LLM 없이 __oprnRegionTaskHarness 목업으로 모달을 검토 단계까지 몰아 찍는다.
// 출력: reports/region-task-ui/shots-after/*.png (감사 리포트 HTML 이 이 파일들을 싣는다).
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

// `declare global` 로 Window 를 넓히면 같은 프로퍼티를 다르게 선언한 다른 스펙
// (region-task-monochrome.spec.ts)과 TS2717 로 충돌한다 — 지역 타입 + 캐스팅으로 둔다.
type HarnessWindow = {
  __oprnRegionTaskHarness?: {
    currentMapId: () => string;
    setSelection?: (
      selection: { mapId: string; x: number; y: number; width: number; height: number } | null,
    ) => void;
    openModal: (
      mapId: string,
      region: { x: number; y: number; width: number; height: number },
      writes?: { x: number; y: number; layer: "lower" | "upper"; tile: number }[],
      events?: unknown[],
    ) => void;
  };
};

const OUT = path.resolve("reports/region-task-ui/shots-after");
const REGION = { x: 2, y: 2, width: 8, height: 6 };

// 서로 떨어진 두 덩어리 — 부분 적용(구역 고르기)이 의미를 갖는 조건.
const WRITES = [
  { x: 3, y: 3, layer: "lower" as const, tile: 342 },
  { x: 4, y: 3, layer: "lower" as const, tile: 342 },
  { x: 3, y: 4, layer: "lower" as const, tile: 342 },
  { x: 8, y: 6, layer: "lower" as const, tile: 342 },
];

const EVENTS = [
  {
    id: "chest_gold_mock",
    x: 5,
    y: 5,
    trigger: "action",
    commands: [],
    pages: [{ name: "보물상자", trigger: "action", priority: "same", commands: [], conditions: [] }],
  },
];

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
}

async function shotOf(page: Page, testid: string, name: string): Promise<void> {
  await page.getByTestId(testid).screenshot({ path: path.join(OUT, name) });
}

async function openCompose(page: Page): Promise<void> {
  await page.evaluate((region) => {
    const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
    harness.openModal(harness.currentMapId(), region as never);
  }, REGION);
  await expect(page.getByTestId("region-task-modal")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.goto("/?freshProject=1");
  await page.waitForFunction(() => Boolean((window as unknown as HarnessWindow).__oprnRegionTaskHarness));
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible();
});

test("지시 단계 — 카테고리·전체 추천 칩·초안 만들기·자동완성", async ({ page }) => {
  test.setTimeout(120_000);
  await shot(page, "01-editor.png");

  await openCompose(page);
  await shotOf(page, "region-task-modal", "03-modal-compose.png");

  // 카테고리 필터: 「전체 추천」 칩이 함께 뜨고 명령이 2개 이상 남는다.
  await page.getByTestId("region-category-polish").click();
  await expect(page.getByTestId("region-suggest-reset")).toBeVisible();
  await shotOf(page, "region-task-modal", "04-modal-category.png");

  // `/` 자동완성 — 켜진 카테고리 안에서만 찾는다.
  const input = page.getByTestId("region-task-input");
  await input.click();
  await input.fill("/");
  await expect(page.getByTestId("region-task-autocomplete")).toBeVisible();
  await shotOf(page, "region-task-modal", "06-modal-autocomplete.png");
  await input.fill("");

  // AI 없이 실내 초안 — 제목과 버튼이 다른 말을 한다.
  await page.getByTestId("region-task-direct-disclosure").locator("summary").click();
  await expect(page.getByTestId("region-task-direct-room")).toBeVisible();
  await shotOf(page, "region-task-modal", "05-modal-direct-open.png");
});

test("선택 칩 바 — AI 작업 라벨 + 지우기 확인", async ({ page }) => {
  test.setTimeout(120_000);
  // 선택 도구는 전문가 밀도에서만 도구막대에 있다 — canvas-fill-selection-chips.spec.ts 와 같은 준비.
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "0");
  });
  await page.goto("/?freshProject=1&m1MapEditor=1");
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible();

  const selectTool = page.getByTestId("tool-select").or(page.getByTestId("toolbar-select-area"));
  await expect(selectTool.first()).toBeVisible();
  await selectTool.first().click();

  // 선택은 훅으로 넣는다. 합성 마우스 드래그로 만드는 선택은 이 저장소에서 이미 깨져 있다 —
  // 기존 스펙 canvas-fill-selection-chips.spec.ts 도 같은 자리(selection 폴링)에서 실패한다.
  await page.waitForFunction(() => Boolean((window as unknown as HarnessWindow).__oprnRegionTaskHarness?.setSelection));
  await page.evaluate((region) => {
    const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
    harness.setSelection!({
      mapId: harness.currentMapId(),
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    });
  }, REGION);

  const chips = page.getByTestId("selection-action-chips");
  await expect(chips).toBeVisible();
  await shotOf(page, "selection-action-chips", "08-selection-chips.png");

  // 넓은 영역 지우기는 한 번 더 물어본다.
  await page.getByTestId("selection-chip-clear").click();
  await expect(page.getByTestId("selection-chip-clear")).toContainText("지울까요?");
  await shotOf(page, "selection-action-chips", "08b-selection-chips-armed.png");
});

test("검토 단계 — 부분 적용 본문 노출·지표 칩·결정 대기", async ({ page }) => {
  test.setTimeout(120_000);
  await page.evaluate(
    ([region, writes, events]) => {
      const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never, events as never);
    },
    [REGION, WRITES, EVENTS] as const,
  );
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 20_000 });

  // 부분 적용(구역 고르기)이 접힌 「고급」 이 아니라 검토 본문에 보인다.
  await expect(page.getByTestId("region-task-chunk-tree")).toBeVisible();
  await shotOf(page, "region-task-modal", "10-review-modal.png");

  // 진단 펼침 — 지표 칩 + 「내 결정 대기」 체크포인트.
  await page.getByTestId("region-task-verdict").click();
  await expect(page.getByTestId("region-task-review-metrics")).toBeVisible();
  await shotOf(page, "region-task-modal", "11-review-diagnostics.png");

  // 고급(실행 로그)까지 펼친 상태.
  await page.getByTestId("region-task-advanced-toggle").click();
  await shotOf(page, "region-task-modal", "12-review-advanced.png");

  // 전체 화면 — 모달 위에 겹치는 코치 카드가 없다.
  await shot(page, "09-review-page.png");
  await expect(page.getByTestId("standard-welcome-card")).toHaveCount(0);
});
