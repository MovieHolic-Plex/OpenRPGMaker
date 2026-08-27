import { expect, test, type Page } from "@playwright/test";
import { DATABASE_TAB_SPECS, openDatabase, switchDatabaseTab } from "./oprn-database-helpers";

/* 데이터베이스 모달 창은 사이드바 탭을 눌러도 픽셀 하나 움직이지 않아야 한다.
 * oprn-database-tabs-layout.spec.ts 는 `[data-testid="database-modal"]`(=백드롭, 항상 뷰포트 전체)만
 * 재므로 창 자체의 크기 변동을 보지 못한다. 이 스펙은 `.database-modal-window` 를 직접 재고
 * 허용 오차 0px 로 비교한다. */

type ModalWindowBox = {
  readonly height: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
};

type TabMeasurement = {
  readonly box: ModalWindowBox;
  readonly tab: string;
};

const VIEWPORTS = [
  { height: 1200, width: 1920 },
  { height: 800, width: 1280 },
  { height: 768, width: 1024 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`database modal window keeps identical pixel geometry on every sidebar tab at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    // Break named: tab-content-conditional `:has()` rules resize `.database-modal-window`,
    // so clicking a sidebar tab changes the modal's width/height/left/top.
    test.setTimeout(240_000);
    await installExpertEditorState(page);
    await page.setViewportSize({ height: viewport.height, width: viewport.width });
    await page.goto("/?freshProject=1");
    await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
    await openDatabase(page);

    const measurements: TabMeasurement[] = [];
    for (const tab of DATABASE_TAB_SPECS) {
      await switchDatabaseTab(page, tab);
      measurements.push({ box: await readModalWindowBox(page), tab: tab.testId });
    }

    const reference = measurements[0]!;
    console.log(
      `[modal-size ${viewport.width}x${viewport.height}]\n${measurements.map(formatMeasurement).join("\n")}`,
    );

    const drift = measurements
      .filter((entry) => !sameBox(entry.box, reference.box))
      .map((entry) => `${entry.tab}: ${describeBox(entry.box)} != ${describeBox(reference.box)}`);

    expect(drift, `modal window geometry drifted at ${viewport.width}x${viewport.height}`).toEqual([]);
  });
}

async function readModalWindowBox(page: Page): Promise<ModalWindowBox> {
  return page.evaluate(() => {
    const node = document.querySelector(".database-modal-window");
    if (!(node instanceof HTMLElement)) throw new Error("database modal window is missing");
    const rect = node.getBoundingClientRect();
    const round = (value: number): number => Math.round(value * 100) / 100;
    return { height: round(rect.height), left: round(rect.left), top: round(rect.top), width: round(rect.width) };
  });
}

function sameBox(actual: ModalWindowBox, expected: ModalWindowBox): boolean {
  return (
    actual.height === expected.height &&
    actual.left === expected.left &&
    actual.top === expected.top &&
    actual.width === expected.width
  );
}

function describeBox(box: ModalWindowBox): string {
  return `${box.width}x${box.height} @ (${box.left}, ${box.top})`;
}

function formatMeasurement(entry: TabMeasurement): string {
  return `  ${entry.tab.padEnd(26)} ${describeBox(entry.box)}`;
}

async function installExpertEditorState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
    localStorage.setItem("oprn:editor-welcome-dismissed", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:standard-welcome-seen", "1");
  });
}
