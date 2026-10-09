// test/e2e/region-approval-gate.spec.ts
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __oprnRegionTaskHarness?: {
      currentMapId: () => string;
      runMock: (mapId: string, region: { x: number; y: number; width: number; height: number }, writes: { x: number; y: number; layer: "lower" | "upper"; tile: number }[]) => Promise<{ applied: boolean; ok: boolean }>;
      readCell: (mapId: string, layer: "lower" | "upper", x: number, y: number) => number | null;
      openModal: (mapId: string, region: { x: number; y: number; width: number; height: number }) => void;
    };
    __oprnRegionTaskPending?: { get: () => unknown; apply: () => void; discard: () => void };
  }
}

const REGION = { x: 2, y: 2, width: 4, height: 3 };

test.beforeEach(async ({ page }) => {
  await page.goto("/?freshProject=1");
  await page.waitForFunction(() => Boolean(window.__oprnRegionTaskHarness));
  // Phaser/EditScene 부팅 대기 — 캔버스 인라인 승인 툴바는 EditScene.create()의
  // subscribeInlineProposalActions 배선이 끝나야 렌더된다(하네스는 그보다 먼저 설치됨).
  // edit-canvas/canvas 요소는 Phaser.Game 생성 시점에 이미 DOM에 붙으므로 그것만으로는
  // create() 완료를 보장하지 못한다 — 실제 포인터 이벤트가 처리되는지(cursor-position 갱신)로 확인.
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => page.getByTestId("cursor-position").textContent()).not.toBe("outside");
});

test("runMock은 즉시 적용하지 않고 pending을 만든다 — 적용 시 셀 반영", async ({ page }) => {
  const initial = await page.evaluate(async (region) => {
    const harness = window.__oprnRegionTaskHarness!;
    const mapId = harness.currentMapId();
    const before = harness.readCell(mapId, "lower", 3, 3);
    const result = await harness.runMock(mapId, region, [{ x: 3, y: 3, layer: "lower", tile: 342 }]);
    return {
      mapId,
      before,
      applied: result.applied,
      afterRun: harness.readCell(mapId, "lower", 3, 3),
      pending: Boolean(window.__oprnRegionTaskPending?.get()),
    };
  }, REGION);
  expect(initial.applied).toBe(false);
  expect(initial.afterRun).toBe(initial.before); // 아직 미적용
  expect(initial.pending).toBe(true);

  // 캔버스 인라인 툴바 노출 (고스트 유지)
  await expect(page.getByTestId("ghost-inline-accept")).toBeVisible();
  await expect(page.getByTestId("ghost-inline-hold-origin")).toBeVisible();

  const afterApply = await page.evaluate((mapId) => {
    window.__oprnRegionTaskPending!.apply();
    return window.__oprnRegionTaskHarness!.readCell(mapId, "lower", 3, 3);
  }, initial.mapId);
  expect(afterApply).toBe(342);
  await expect(page.getByTestId("ghost-inline-accept")).toHaveCount(0); // settle 후 툴바 제거
});

test("버리기 시 맵이 변하지 않는다", async ({ page }) => {
  const outcome = await page.evaluate(async (region) => {
    const harness = window.__oprnRegionTaskHarness!;
    const mapId = harness.currentMapId();
    const before = harness.readCell(mapId, "lower", 4, 3);
    await harness.runMock(mapId, region, [{ x: 4, y: 3, layer: "lower", tile: 342 }]);
    window.__oprnRegionTaskPending!.discard();
    return { before, after: harness.readCell(mapId, "lower", 4, 3), pending: window.__oprnRegionTaskPending!.get() };
  }, REGION);
  expect(outcome.after).toBe(outcome.before);
  expect(outcome.pending).toBeNull();
});

test("영역 작업 모달 — 추천 칩이 입력창을 채운다", async ({ page }) => {
  await page.evaluate((region) => {
    const harness = window.__oprnRegionTaskHarness!;
    harness.openModal(harness.currentMapId(), region);
  }, REGION);
  const chips = page.getByTestId("region-task-suggestions");
  await expect(chips).toBeVisible();
  await chips.locator("button").first().click();
  const value = await page.getByTestId("region-task-input").inputValue();
  expect(value.length).toBeGreaterThan(5);
});
