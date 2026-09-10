// 영역 작업 창 모노크롬·모던 검증 — 실패 우선(failing-first) 스펙.
// 현재(미수정) UI 는 컬러 픽토그램·텍스트 글리프를 쓰므로 이 스펙은 RED 로 떨어진다.
// 이후 노드가 아이콘 매핑(모노크롬 svg)·A/B 프리뷰·쿨 스크림 backdrop 를 구현하면 GREEN 이 되어야 한다.
// 실제 LLM 없이 하네스 목업(writes/events)으로 모달을 견인한다 — region-task-redesign.spec.ts 의 부트 레시피를 그대로 따른다.
import { expect, test, type Page } from "@playwright/test";

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
const EVIDENCE = ".omo/evidence/region-task-modern";

// 서로 떨어진 두 덩어리(청크 2개) + 추가 이벤트 하나 → 검토 단계에서 변경 목록·마커가 렌더된다.
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

test.beforeEach(async ({ page }) => {
  await page.goto("/?freshProject=1");
  await page.waitForFunction(() => Boolean(window.__oprnRegionTaskHarness));
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible();
});

async function openModal(
  page: Page,
  writesOrEvents?: { writes?: typeof WRITES; events?: unknown[] },
): Promise<void> {
  const writes = writesOrEvents?.writes === undefined ? WRITES : writesOrEvents.writes;
  const events = writesOrEvents?.events;
  await page.evaluate(
    ([region, w, ev]) => {
      const harness = window.__oprnRegionTaskHarness!;
      if (ev) harness.openModal(harness.currentMapId(), region as never, w as never, ev as never);
      else harness.openModal(harness.currentMapId(), region as never, w as never);
    },
    [REGION, writes, events] as const,
  );
}

test("compose 단계에 컬러 픽토그램이 없다", async ({ page }) => {
  // writes 없이 열면 autoRun 이 걸리지 않아 data-stage 는 compose 에 머문다.
  await openModal(page, { writes: [] });

  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-stage", "compose");

  const innerText = (await modal.innerText()) ?? "";
  await modal.screenshot({ path: `${EVIDENCE}/c2-compose.png` });

  // 모노크롬 창: 컬러 이모지(Extended_Pictographic)가 하나도 없어야 한다.
  const pictographMatches = innerText.match(/\p{Extended_Pictographic}/gu) ?? [];
  expect(pictographMatches, "compose 단계에서 컬러 픽토그램이 발견됨").toEqual([]);

  // 지정된 치환 글리프들도 텍스트로 남아 있으면 안 된다.
  for (const glyph of ["✦", "▦", "🟦", "⚠"]) {
    expect(innerText.includes(glyph), `compose 단계에서 '${glyph}' 글리프가 발견됨`).toBe(false);
  }
});

test("추천 칩이 모노크롬 svg 아이콘을 쓴다", async ({ page }) => {
  await openModal(page, { writes: [] });
  await expect(page.getByTestId("region-task-modal")).toBeVisible();

  // 계열 소제목 검사는 「모두 보기」 시트와 함께 사라졌다 — 진입 화면에 계열이 없다.
  // 남은 아이콘 표면은 추천 칩 3개다.

  const suggestChips = page.locator(".region-task-suggest-chip");
  await expect(suggestChips.first()).toBeVisible();
  const suggestSvg = suggestChips.locator("svg");
  expect(await suggestSvg.count(), "추천 칩 svg 가 4개 미만").toBeGreaterThanOrEqual(4);
  for (const svg of await suggestSvg.all()) {
    expect(await svg.getAttribute("stroke"), "추천 칩 svg 가 currentColor 가 아님").toBe("currentColor");
  }
});

test("review 단계도 픽토그램 없이 아이콘으로 말한다", async ({ page }) => {
  await openModal(page, { writes: WRITES, events: EVENTS });

  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 20_000 });
  await modal.screenshot({ path: `${EVIDENCE}/c2-review.png` });

  const innerText = (await modal.innerText()) ?? "";
  const pictographMatches = innerText.match(/\p{Extended_Pictographic}/gu) ?? [];
  expect(pictographMatches, "review 단계에서 컬러 픽토그램이 발견됨").toEqual([]);

  // 변경 목록의 각 행 아이콘은 텍스트 글리프가 아니라 svg 여야 한다.
  const changeIcons = page.locator(".region-task-change-icon");
  await expect(changeIcons.first()).toBeVisible();
  for (const icon of await changeIcons.all()) {
    expect(await icon.locator("svg").count(), "변경 행 아이콘이 svg 가 아님").toBeGreaterThanOrEqual(1);
  }

  // 적용 버튼은 ✓ 글리프가 없어야 한다 — "적용" 으로 시작해야 한다.
  const applyText = (await page.getByTestId("region-task-apply").innerText()) ?? "";
  expect(applyText, "적용 버튼에 ✓ 글리프가 남아 있음").toMatch(/^적용/);

  // 이벤트 마커는 이모지가 아니라 행에 keying 되는 숫자를 그려야 한다.
  const markers = page.locator(".region-task-event-marker");
  await expect(markers.first()).toBeVisible();
  for (const marker of await markers.all()) {
    expect(await marker.getAttribute("data-marker-index"), "마커에 data-marker-index 없음").not.toBeNull();
    expect((await marker.textContent()) ?? "", "마커가 숫자가 아님").toMatch(/^\d+$/);
  }
});

test("프리뷰는 한 장 + A/B 토글이다", async ({ page }) => {
  await openModal(page, { writes: WRITES, events: EVENTS });
  await expect(page.getByTestId("region-task-modal")).toHaveAttribute("data-stage", "review", { timeout: 20_000 });

  const preview = page.getByTestId("region-task-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-ab-view", "after");

  // 기본값은 "이후" 장만 보인다.
  await expect(page.getByTestId("region-task-after")).toBeVisible();
  await expect(page.getByTestId("region-task-before")).toBeHidden();

  // before 토글을 누르면 "이전" 장으로 뒤집힌다.
  await page.getByTestId("region-task-preview-ab-before").click();
  await expect(preview).toHaveAttribute("data-ab-view", "before");
  await expect(page.getByTestId("region-task-before")).toBeVisible();
  await expect(page.getByTestId("region-task-after")).toBeHidden();
});

test("액션 줄은 스크롤 없이 보인다", async ({ page }) => {
  await openModal(page, { writes: WRITES, events: EVENTS });
  await expect(page.getByTestId("region-task-modal")).toHaveAttribute("data-stage", "review", { timeout: 20_000 });

  // 모던 계약: 액션 줄은 전용 testid 를 가져야 한다(현재는 class 만 있다).
  const actions = page.getByTestId("region-task-compare-actions");
  await expect(actions).toBeVisible({ timeout: 10_000 });
  const box = await actions.boundingBox();
  expect(box, "액션 줄 bounding box 없음").not.toBeNull();
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  expect(box!.y, "액션 줄이 뷰포트 위로 넘침").toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, "액션 줄이 뷰포트 아래로 넘침").toBeLessThanOrEqual(viewport.height);
});

test("backdrop 은 쿨 스크림 토큰을 쓴다", async ({ page }) => {
  // stage 는 무관 — backdrop 는 모달이 열리면 항상 존재한다.
  await openModal(page, { writes: [] });
  await expect(page.getByTestId("region-task-modal")).toBeVisible();

  const color = await page.getByTestId("region-task-backdrop").evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(color, "backdrop 색이 쿨 스크림 토큰이 아님").toBe("rgba(15, 23, 42, 0.4)");
});
