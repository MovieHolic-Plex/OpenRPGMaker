// 영역 작업 패널 재설계 검증 — 제안 검토 단계에서 무엇이 보이고 무엇이 숨는가.
// 실제 LLM 없이 하네스 목업(writes)으로 모달을 검토 단계까지 몰아 검사한다.
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __oprnRegionTaskHarness?: {
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
  await page.waitForFunction(() => Boolean(window.__oprnRegionTaskHarness));
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible();
});

test("검토 단계: 미리보기·변경칸 하이라이트가 보이고 입력창과 로그는 접힌다", async ({ page }) => {
  await page.evaluate(
    ([region, writes]) => {
      const harness = window.__oprnRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never);
    },
    [REGION, WRITES] as const,
  );

  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 20_000 });

  // 결정에 필요한 것: 단일 A/B 미리보기(기본 after 노출, before 숨김, 토글 시 flip) + 변경 칸 하이라이트 + 적용 버튼(칸 수 포함).
  const preview = page.getByTestId("region-task-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-ab-view", "after");
  await expect(page.getByTestId("region-task-after")).toBeVisible();
  await expect(page.getByTestId("region-task-before")).toBeHidden();
  await page.getByTestId("region-task-preview-ab-before").click();
  await expect(preview).toHaveAttribute("data-ab-view", "before");
  await expect(page.getByTestId("region-task-before")).toBeVisible();
  await expect(page.getByTestId("region-task-after")).toBeHidden();
  await page.getByTestId("region-task-preview-ab-after").click();
  await expect(preview).toHaveAttribute("data-ab-view", "after");
  await expect(page.getByTestId("region-task-after")).toBeVisible();
  await expect(page.getByTestId("region-task-before")).toBeHidden();
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
      const harness = window.__oprnRegionTaskHarness!;
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
      const harness = window.__oprnRegionTaskHarness!;
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
  // 적용 버튼은 하나뿐이고 체크 상태를 따라간다 — 예전에는 전량 버튼과 부분 버튼이 따로
  // 있어서, 체크를 풀고 아래 큰 버튼을 누르면 의도와 반대로 전부 적용됐다.
  await expect(page.getByTestId("region-task-partial-apply")).toHaveCount(0);
  await expect(page.getByTestId("region-task-apply")).toContainText("3칸");
});

test("캔버스 우클릭 드래그는 영역을 잡고 액션 바를 띄운다 — 창은 「AI 작업」이 연다", async ({ page }) => {
  // **의도적으로 뒤집은 계약.** 한동안 우클릭 드래그가 영역 작업 창을 곧바로 열었는데,
  // 그러면 복사·붙여넣기·지우기·구조물 저장이 전부 창 뒤로 밀려 Esc(취소 어포던스)를
  // 거쳐야 닿았고, 실수로 드래그해도 큰 창이 떴다. 제스처는 **영역을 잡는 동작**이고
  // AI 는 그 위의 선택지 하나다.
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

  // 창은 뜨지 않는다. 놓은 자리에 액션 바가 뜨고, 선택 사각형 옆에 W×H 배지가 붙는다.
  const chips = page.getByTestId("selection-action-chips");
  await expect(chips).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("region-task-popover")).toHaveCount(0);
  const badge = page.getByTestId("region-size-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toContainText(/^\d+×\d+$/);
  // 「AI 작업」이 첫 버튼이다 — 주 진입점이 눈에 먼저 들어와야 한다.
  await expect(chips.locator("button").first()).toHaveAttribute("data-testid", "selection-chip-ai");
  await page.screenshot({ path: `${OUT}/05-right-drag-chips.png` });

  // 그 버튼이 창을 연다. 창이 열리면 칩 바는 물러난다(같은 자리에 겹치지 않게).
  await page.getByTestId("selection-chip-ai").click();
  const popover = page.getByTestId("region-task-popover");
  await expect(popover).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("region-task-input")).toBeVisible();
  await expect(chips).toHaveCount(0);
  await page.screenshot({ path: `${OUT}/05b-right-drag-popover.png` });

  // 닫으면 선택이 남아 칩 바가 돌아온다(복사/붙여넣기/지우기 경로 보존).
  await page.getByTestId("region-task-close").click();
  await expect(popover).toHaveCount(0);
  await expect(chips).toBeVisible({ timeout: 10_000 });
});

test("창이 열려 있어도 캔버스는 살아 있다 — 팬이 먹고, 다시 드래그하면 영역이 바뀐다", async ({ page }) => {
  // 팝오버가 `inset:0` 백드롭으로 캔버스를 덮던 동안은 자기가 바꿀 대상을 볼 수도, 영역을
  // 다시 잡을 수도 없었다(바깥 클릭은 곧 폐기였다). 팝오버 변형은 비모달이다.
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스 없음");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => page.getByTestId("cursor-position").textContent()).not.toBe("outside");

  await page.mouse.move(box.x + 200, box.y + 180);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + 330, box.y + 280, { steps: 12 });
  await page.mouse.up({ button: "right" });
  await page.getByTestId("selection-chip-ai").click();
  const popover = page.getByTestId("region-task-popover");
  await expect(popover).toBeVisible({ timeout: 10_000 });
  const firstRegion = await page.getByTestId("region-task-chip").innerText();

  // 캔버스가 포인터를 받는다 — 창 위가 아닌 자리에서 커서 좌표가 갱신된다.
  await page.mouse.move(box.x + 120, box.y + 120);
  await expect.poll(async () => page.getByTestId("cursor-position").textContent()).not.toBe("outside");

  // 지시문을 적어 둔 뒤 다시 잡는다 — 재지정이 입력을 버리지 않는다는 것도 같이 잰다.
  await page.getByTestId("region-task-input").fill("여기에 길을 깔아줘");

  // 창이 떠 있는 채로 다시 우클릭 드래그 → **창이 새 영역으로 갈아 끼워진다.**
  // 칩 바를 기대하지 않는다: 창이 열려 있는 동안 칩 바는 물러나 있고(같은 자리 겹침 방지),
  // 여기서 중요한 건 창이 들고 있는 대상이 바뀌는 것이다. 선택만 바뀌고 창이 옛 영역을
  // 들고 있으면 「적용」이 화면에 보이는 선택과 다른 곳을 고친다.
  await page.mouse.move(box.x + 120, box.y + 120);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + 260, box.y + 240, { steps: 12 });
  await page.mouse.up({ button: "right" });
  await expect(popover).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(async () => page.getByTestId("region-task-chip").innerText(), { timeout: 10_000 })
    .not.toBe(firstRegion);
  // 적어 둔 지시문이 새 창으로 따라온다.
  await expect(page.getByTestId("region-task-input")).toHaveValue("여기에 길을 깔아줘");
  await page.screenshot({ path: `${OUT}/05c-nonmodal-redrag.png` });

  // 창을 닫으면 새 영역의 칩 바가 돌아온다 — 선택은 재지정된 쪽으로 살아 있다.
  await page.getByTestId("region-task-close").click();
  await expect(page.getByTestId("selection-action-chips")).toBeVisible({ timeout: 10_000 });
});

test("지시 수정을 누르면 입력 단계로 돌아간다", async ({ page }) => {
  await page.evaluate(
    ([region, writes]) => {
      const harness = window.__oprnRegionTaskHarness!;
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
      const harness = window.__oprnRegionTaskHarness!;
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
  // 마카는 이모지가 아니라 변경 목록 행에 keying 되는 번호다(모노톰롬 계약).
  await expect(marker).toHaveText("1");
  await expect(marker).toHaveAttribute("data-marker-index", "1");

  const row = page.getByTestId("region-task-change-row-event-chest_gold_mock");
  await expect(row).toBeVisible();
  await expect(overlay).not.toHaveClass(/is-isolating/);
  await row.hover();
  await expect(overlay).toHaveClass(/is-isolating/);
  await expect(overlay.locator(".region-task-event-marker.is-focus")).toHaveCount(1);
  await modal.screenshot({ path: `${OUT}/07-event-marker.png` });
});

test("진입 화면은 칩 3개 + 입력 + 버튼 하나다 — 「모두 보기」 시트는 없다", async ({ page }) => {
  await page.evaluate(
    (region) => {
      const harness = window.__oprnRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, []);
    },
    REGION,
  );
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();

  // 예전에는 카테고리 필터 칩 8개가 가로 스크롤러로 상주했고, 그 뒤에는 「모두 보기 (+19)」
  // 접이식 시트가 있었다. 둘 다 같은 값을 노렸다 — "추천이 전부가 아니다" 를 알리기.
  // 진입 화면에서 스물두 개를 펼쳐 보여 주면 고르는 일이 읽는 일이 된다. 이제 그 사실은
  // 입력창 안내 한 줄이 말하고, 전체 목록은 `/` 자동완성이 같은 코퍼스로 낸다.
  await expect(page.getByTestId("region-task-browse-all")).toHaveCount(0);
  await expect(page.getByTestId("region-task-categories")).toHaveCount(0);
  await expect(page.getByTestId("region-task-mode-switch")).toHaveCount(0);

  const suggestions = page.getByTestId("region-task-suggestions");
  expect(await suggestions.locator("button").count()).toBe(3);
  const input = page.getByTestId("region-task-input");
  await expect(input).toHaveAttribute("placeholder", /\/ 로 전체 \d+개/);
  await modal.screenshot({ path: `${OUT}/08-compose.png` });

  // `/` 를 치면 전체 목록이 나온다 — 시트가 하던 일을 여기서 한다.
  await input.click();
  await input.fill("/");
  const list = page.getByTestId("region-task-autocomplete");
  await expect(list).toBeVisible();
  expect(await list.locator("button").count()).toBeGreaterThanOrEqual(10);
  await modal.screenshot({ path: `${OUT}/09-autocomplete.png` });
});
