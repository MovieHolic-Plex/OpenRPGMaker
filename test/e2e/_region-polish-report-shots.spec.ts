// test/e2e/_region-polish-report-shots.spec.ts
// 2026-08-31 「영역 다듬기」 보고서용 실측 스크린샷 (진단 스펙, 기본 스위트 제외).
// 실제 LLM 없이 __oprnRegionTaskHarness 목업으로 다듬기 경로를 승인 화면까지 몰아 찍는다.
// 출력: reports/region-polish/shots/*.png (보고서 HTML 이 이 파일들을 싣는다).
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

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
      mode?: "task" | "polish",
    ) => void;
  };
  __oprnEditorTool?: (name: string, args: Record<string, unknown>) => { ok: boolean; summary: string };
};

const OUT = path.resolve("reports/region-polish/shots");
const FACTS = path.resolve("reports/region-polish/facts.json");
const REGION = { x: 6, y: 5, width: 8, height: 6 };
const SAND = 423;
const WALL = 306;

fs.mkdirSync(OUT, { recursive: true });
const facts: Record<string, unknown> = fs.existsSync(FACTS)
  ? JSON.parse(fs.readFileSync(FACTS, "utf8"))
  : {};

function saveFacts(): void {
  fs.writeFileSync(FACTS, `${JSON.stringify(facts, null, 2)}\n`, "utf8");
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
}

async function shotOf(page: Page, testid: string, name: string): Promise<void> {
  await page.getByTestId(testid).screenshot({ path: path.join(OUT, name) });
}

/** 영역 안을 모래로 채우는 목업 초안 — 안쪽만 칠하면 계단식 경계가 남는다(다듬기 대상). */
function sandWrites(): { x: number; y: number; layer: "lower"; tile: number }[] {
  const writes: { x: number; y: number; layer: "lower"; tile: number }[] = [];
  for (let y = REGION.y; y < REGION.y + REGION.height; y += 1) {
    for (let x = REGION.x; x < REGION.x + REGION.width; x += 1) {
      writes.push({ x, y, layer: "lower", tile: SAND });
    }
  }
  return writes;
}

/** 영역 안을 벽으로 막는 초안 — 밖에서 들어오던 길·통행이 끊긴다(경고 칩 대상). */
function wallWrites(): { x: number; y: number; layer: "lower"; tile: number }[] {
  return sandWrites().map((write) => ({ ...write, tile: WALL }));
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
  });
  await page.goto("/?freshProject=1&m1MapEditor=1");
  await page.waitForFunction(() => Boolean((window as unknown as HarnessWindow).__oprnRegionTaskHarness));
  await expect(page.getByTestId("edit-canvas").locator("canvas")).toBeVisible();
});

test("선택 칩 바 — 원탭 「다듬기」 칩", async ({ page }) => {
  test.setTimeout(120_000);

  const selectTool = page.getByTestId("tool-select").or(page.getByTestId("toolbar-select-area"));
  await expect(selectTool.first()).toBeVisible();
  await selectTool.first().click();

  await page.waitForFunction(() => Boolean((window as unknown as HarnessWindow).__oprnRegionTaskHarness?.setSelection));
  await page.evaluate((region) => {
    const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
    harness.setSelection!({ mapId: harness.currentMapId(), ...region });
  }, REGION);

  const chips = page.getByTestId("selection-action-chips");
  await expect(chips).toBeVisible();
  await expect(page.getByTestId("selection-chip-polish")).toBeVisible();
  await shotOf(page, "selection-action-chips", "10-selection-chips.png");
  await shot(page, "11-editor-with-chips.png");

  facts.chipLabels = await chips.innerText();
  facts.polishChipTitle = await page.getByTestId("selection-chip-polish").getAttribute("title");
  saveFacts();
});

test("모달 지시 단계 — 실행 버튼 하나 + 추천 칩", async ({ page }) => {
  test.setTimeout(120_000);

  await page.evaluate((region) => {
    const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
    harness.openModal(harness.currentMapId(), region as never);
  }, REGION);
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();
  // 별도 「다듬기」 버튼은 없어졌다 — 빈 입력의 실행 버튼이 그 자리다.
  const run = page.getByTestId("region-task-run");
  await expect(run).toBeVisible();
  await expect(run).toContainText("다듬기");
  await shotOf(page, "region-task-modal", "20-modal-compose.png");

  // 카테고리 시트도 사라졌다 — 전체 명령은 `/` 자동완성이 같은 코퍼스로 낸다.
  await expect(page.getByTestId("region-task-browse-all")).toHaveCount(0);
  const input = page.getByTestId("region-task-input");
  await input.click();
  await input.fill("/다듬");
  await expect(page.getByTestId("region-task-autocomplete")).toBeVisible();
  await shotOf(page, "region-task-modal", "21-modal-autocomplete-polish.png");

  facts.runButtonLabel = await run.innerText();
  facts.runButtonTitle = await run.getAttribute("title");
  facts.suggestionRow = await page.getByTestId("region-task-suggestions").innerText().catch(() => "");
  facts.autocompletePolish = await page.getByTestId("region-task-autocomplete").innerText().catch(() => "");
  await input.fill("");
  saveFacts();
});

test("다듬기 승인 화면 — 여백 프레임 + 영역 테두리", async ({ page }) => {
  test.setTimeout(180_000);

  await page.evaluate(
    ([region, writes]) => {
      const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never, [], "polish");
    },
    [REGION, sandWrites()] as const,
  );

  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 60_000 });

  const overlay = page.getByTestId("region-task-change-overlay");
  await expect(overlay).toBeVisible();
  facts.polishOverlayCols = await overlay.getAttribute("data-cols");
  facts.polishOverlayRows = await overlay.getAttribute("data-rows");
  facts.polishRegion = REGION;
  facts.polishFrameCount = await page.getByTestId("region-task-region-frame").count();
  facts.polishSummary = await page.getByTestId("region-task-summary").innerText().catch(() => "");
  saveFacts();

  await shotOf(page, "region-task-modal", "30-polish-review.png");
  await shotOf(page, "region-task-change-overlay", "31-polish-overlay.png");

  const verdict = page.getByTestId("region-task-verdict");
  if (await verdict.count() > 0) {
    await verdict.click();
    await shotOf(page, "region-task-modal", "32-polish-diagnostics.png");
    const metrics = page.getByTestId("region-task-review-metrics");
    if (await metrics.count() > 0) facts.polishMetricsText = await metrics.innerText();
    saveFacts();
  }
});

test("일반 영역 작업 승인 화면 — 영역만 크롭(비교용)", async ({ page }) => {
  test.setTimeout(180_000);

  await page.evaluate(
    ([region, writes]) => {
      const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never);
    },
    [REGION, sandWrites()] as const,
  );

  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 60_000 });

  const overlay = page.getByTestId("region-task-change-overlay");
  await expect(overlay).toBeVisible();
  facts.taskOverlayCols = await overlay.getAttribute("data-cols");
  facts.taskOverlayRows = await overlay.getAttribute("data-rows");
  facts.taskFrameCount = await page.getByTestId("region-task-region-frame").count();
  saveFacts();

  await shotOf(page, "region-task-modal", "40-task-review.png");
  await shotOf(page, "region-task-change-overlay", "41-task-overlay.png");
});

test("적용 전/후 — 미리보기 토글과 이음새 실측", async ({ page }) => {
  test.setTimeout(180_000);

  await page.evaluate(
    ([region, writes]) => {
      const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never, [], "polish");
    },
    [REGION, sandWrites()] as const,
  );
  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 60_000 });

  // 같은 프레임을 「이전 | 이후」로 왕복해 찍는다 — 여백이 있으니 두 장이 같은 배경을 공유한다.
  await page.getByTestId("region-task-preview-ab-before").click();
  await page.waitForTimeout(300);
  await shotOf(page, "region-task-preview", "60-preview-before.png");
  await page.getByTestId("region-task-preview-ab-after").click();
  await page.waitForTimeout(300);
  await shotOf(page, "region-task-preview", "62-preview-after.png");

  // 영역 밖 1칸 링의 lower 타일을 적용 전후로 읽어 "이음새 몇 칸이 손질됐나" 를 실측한다.
  const ringBefore = await page.evaluate((region) => {
    const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
    const mapId = harness.currentMapId();
    const cells: { x: number; y: number; tile: number | null }[] = [];
    for (let y = region.y - 1; y <= region.y + region.height; y += 1) {
      for (let x = region.x - 1; x <= region.x + region.width; x += 1) {
        const inside = x >= region.x && x < region.x + region.width
          && y >= region.y && y < region.y + region.height;
        if (inside) continue;
        cells.push({ x, y, tile: (harness as never as { readCell: (m: string, l: string, x: number, y: number) => number | null }).readCell(mapId, "lower", x, y) });
      }
    }
    return cells;
  }, REGION);

  await page.getByTestId("region-task-apply").click();
  await page.waitForTimeout(1500);

  const ringChanged = await page.evaluate(
    ([region, before]) => {
      const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
      const mapId = harness.currentMapId();
      const read = (harness as never as { readCell: (m: string, l: string, x: number, y: number) => number | null }).readCell;
      return (before as { x: number; y: number; tile: number | null }[])
        .filter((cell) => read(mapId, "lower", cell.x, cell.y) !== cell.tile)
        .map((cell) => `${cell.x},${cell.y}`);
    },
    [REGION, ringBefore] as const,
  );
  facts.seamRingChanged = ringChanged;
  saveFacts();

  // 적용 직후의 되돌리기 배너 — 다듬기 한 번이 되돌리기 한 칸으로 남는다는 증거.
  await page.waitForTimeout(800);
  await shot(page, "63-after-apply-undo.png");
});

test("다듬기 경고 칩 — 밖에서 들어오던 길을 막은 초안", async ({ page }) => {
  test.setTimeout(180_000);

  // 영역 왼쪽 밖에서 안으로 흙길을 깐다 — 다듬기가 반드시 이어야 하는 연결 지점이 생긴다.
  const road = await page.evaluate((region) => {
    const w = window as unknown as HarnessWindow;
    const harness = w.__oprnRegionTaskHarness!;
    const mapId = harness.currentMapId();
    return w.__oprnEditorTool!("paint_road", {
      mapId,
      style: "dirt",
      naturalness: 0,
      points: [
        { x: 0, y: region.y + 2 },
        { x: region.x + region.width - 1, y: region.y + 2 },
      ],
    });
  }, REGION);
  facts.roadSeed = road;
  saveFacts();
  await shot(page, "50-scene-with-road.png");

  await page.evaluate(
    ([region, writes]) => {
      const harness = (window as unknown as HarnessWindow).__oprnRegionTaskHarness!;
      harness.openModal(harness.currentMapId(), region as never, writes as never, [], "polish");
    },
    [REGION, wallWrites()] as const,
  );

  const modal = page.getByTestId("region-task-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-stage", "review", { timeout: 60_000 });
  await shotOf(page, "region-task-modal", "51-polish-warning-review.png");

  const verdict = page.getByTestId("region-task-verdict");
  if (await verdict.count() > 0) {
    await verdict.click();
    await shotOf(page, "region-task-modal", "52-polish-warning-diagnostics.png");
  }
  const metrics = page.getByTestId("region-task-review-metrics");
  if (await metrics.count() > 0) {
    facts.warningMetricsText = await metrics.innerText();
    await shotOf(page, "region-task-review-metrics", "53-polish-warning-metrics.png");
  }
  const issues = page.getByTestId("region-task-issues");
  if (await issues.count() > 0) facts.warningIssuesText = await issues.innerText();
  facts.warningModalText = await modal.innerText();
  saveFacts();
});
