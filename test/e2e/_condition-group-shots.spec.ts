/* 진단·증거용(`_` 접두사로 기본 스위트 제외). 묶음 조건 편집기와 겹침·통행 그룹 실화면 캡처. */
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { mockupProject } from "./mockupProbeSeeds";
import { seedProjectForEditor } from "./projectSeed";
import { openSeededEventEditor } from "./eventStoryboardPicker";

const DIR = "output/evidence/condition-groups";

test.setTimeout(180_000);

/** 이벤트 목록 경유로 편집기를 연다(맵 캔버스 hover 는 좌표 의존이라 잘 깨진다). */
async function openEditor(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1440, height: 900 });
  const seed = mockupProject();
  await seedProjectForEditor(page, seed.project);
  const eventLayer = page.getByTestId("layer-event");
  if (await eventLayer.count()) await eventLayer.click();
  const row = page.getByTestId(`event-list-row-${seed.eventId}`);
  if (await row.count()) {
    await row.click();
    await page.getByTestId("event-editor-open").click();
  } else {
    await openSeededEventEditor(page, { x: 8, y: 8 });
  }
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
}

/** 레일 그룹 헤더를 눌러 그 그룹만 펼친다. */
async function openRailGroup(page: Page, slug: string): Promise<void> {
  await page.getByTestId(`evt-rail-group-${slug}`).locator(".event-editor-settings-accordion-header").click();
}

test("OR 묶음을 UI 로 만드는 실화면", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await openEditor(page);
  await openRailGroup(page, "when");

  const advanced = page.getByTestId("event-page-advanced-conditions");
  await advanced.locator("summary").first().click();
  await page.getByTestId("event-page-advanced-condition-kind").selectOption("any");
  await page.getByTestId("event-page-advanced-condition-add").click();
  await expect(page.getByTestId("event-page-advanced-condition-row-0")).toBeVisible();

  await page.getByTestId("event-page-advanced-condition-child-add-0").click();
  await page.getByTestId("event-page-advanced-condition-kind-0-1").selectOption("gold");
  await expect(page.getByTestId("event-page-advanced-condition-gold-amount-0-1")).toBeVisible();

  // 하위에 한 겹 더 — 중첩 묶음.
  await page.getByTestId("event-page-advanced-condition-child-kind-0").selectOption("not");
  await page.getByTestId("event-page-advanced-condition-child-add-0").click();
  await expect(page.getByTestId("event-page-advanced-condition-group-kind-0-2")).toBeVisible();

  await page.getByTestId("event-page-advanced-conditions").screenshot({ path: `${DIR}/or-group-editor.png` });
  await page.screenshot({ path: `${DIR}/or-group-editor-full.png` });
});

test("겹침과 통행: 같은 층과 맵 아래", async ({ page }) => {
  await mkdir(DIR, { recursive: true });
  await openEditor(page);
  await openRailGroup(page, "memory");

  // 레일 그룹은 `display: contents` 라 박스가 없다 — 스택 div 를 찍는다.
  const stack = page.getByTestId("event-page-priority-overlap-stack");
  await expect(page.getByTestId("event-page-priority-select")).toBeVisible();
  await expect(page.getByTestId("event-page-overlap-forbidden")).toBeEnabled();
  await stack.screenshot({ path: `${DIR}/passage-same-layer.png` });
  await page.screenshot({ path: `${DIR}/passage-same-layer-full.png` });

  await page.getByTestId("event-page-priority-select").selectOption("below");
  await expect(page.getByTestId("event-page-overlap-forbidden")).toBeDisabled();
  await expect(page.getByTestId("event-page-overlap-priority-hint")).toContainText("통행을 막지 않습니다");
  await expect(page.getByTestId("evt-rail-meta-memory")).toContainText("통행 허용");
  await page.getByTestId("event-page-priority-overlap-stack").screenshot({ path: `${DIR}/passage-below-layer.png` });
  await page.screenshot({ path: `${DIR}/passage-below-layer-full.png` });
});
