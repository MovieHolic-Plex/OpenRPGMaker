import { expect, type Locator, type Page } from "@playwright/test";

/**
 * 스토리보드 우선 이벤트 에디터용 e2e 진입 헬퍼.
 *
 * 북극성: RPG Maker 2003 에디터 창 복제는 폐기됐다. 그래서 여기에는
 * `event-command-empty-line` 더블클릭(구 `@>` 빈 줄) 경로가 없다. 명령 피커는 제품
 * 표면 그대로 스토리보드 CTA(`event-storyboard-add`) 또는 툴바(`event-command-toolbar-add`)
 * 로만 연다. 빠른 도구의 `+ 다음` 은 툴바 버튼을 대신 눌러주는 중복이라 제거됐으므로,
 * 남은 `"quick-next"` 진입점 이름은 툴바 버튼을 가리킨다.
 */
export type PickerEntryPoint = "storyboard-cta" | "quick-next" | "toolbar-add";

/** 맵 중앙에 이벤트를 만들고 이벤트 에디터 모달을 연다. */
export async function openMapEventEditor(page: Page): Promise<Locator> {
  // 레이어 전환은 사이드바가 소유한다 — 상단 「도구」 메뉴의 레이어 항목은 중복이라 제거됐다.
  await page.getByTestId("layer-event").click();
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();
  await dblclickMapCenter(page);

  const editor = page.getByTestId("event-editor-modal");
  const opened = await editor
    .waitFor({ state: "visible", timeout: 1_000 })
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    const openButton = page.getByTestId("event-editor-open");
    const hasOpenButton = await openButton
      .waitFor({ state: "visible", timeout: 1_000 })
      .then(() => true)
      .catch(() => false);
    if (hasOpenButton) await openButton.click();
    else await dblclickMapCenter(page);
  }
  await expect(editor).toBeVisible();
  return editor;
}

/** 제품 CTA 중 하나로 명령 피커를 연다. 열린 피커 로케이터를 돌려준다. */
export async function openCommandPicker(
  page: Page,
  entryPoint: PickerEntryPoint = "storyboard-cta"
): Promise<Locator> {
  const editor = page.getByTestId("event-editor-modal");
  const cta = editor.getByTestId(
    entryPoint === "storyboard-cta" ? "event-storyboard-add" : "event-command-toolbar-add"
  );
  await expect(cta).toBeVisible();
  await cta.click();
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  return picker;
}

/** 피커 탭을 열고 선택 상태를 확인한다. */
export async function openPickerTab(picker: Locator, tab: 1 | 2 | 3 | 4): Promise<void> {
  const button = picker.getByTestId(`event-command-picker-tab-${tab}`);
  await button.click();
  await expect(button).toHaveAttribute("aria-selected", "true");
}

/**
 * 탭(또는 검색 결과) 본 그리드. 즐겨찾기/최근 명령 섹션은 같은 명령을 한 번 더 그리므로,
 * 라벨로 버튼을 집을 때는 항상 이 그리드로 좁힌다.
 */
export function pickerGrid(picker: Locator): Locator {
  return picker.locator(".event-command-picker-page > .event-command-picker-grid, .event-command-picker-search-results > .event-command-picker-grid");
}

/** 피커에서 명령을 고르고, 이어서 열리는 편집 대화상자를 돌려준다. */
export async function pickCommand(page: Page, picker: Locator, label: string): Promise<Locator> {
  await pickerGrid(picker).getByRole("button", { name: label, exact: true }).click();
  const dialog = page.getByTestId("event-command-edit-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** 목록은 보조 뷰다. 인라인 편집/우클릭 메뉴를 보려면 명시적으로 전환한다. */export async function showCommandList(editor: Locator): Promise<void> {
  const toggle = editor.getByTestId("event-view-toggle-list");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(editor.locator(".cmd-list")).toBeVisible();
}

async function dblclickMapCenter(page: Page): Promise<void> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
}

/**
 * 시드된 기존 이벤트의 편집기를 맵에서 직접 연다.
 *
 * 사이드바 이벤트 목록(`event-list-row-*`)은 현재 워크스페이스 프리셋에 등록돼 있지 않아
 * 진입 경로로 쓸 수 없다. 대신 하니스용 커서 진단(`cursor-position`)으로 타일↔화면 좌표를
 * 실측해서 대상 타일을 더블클릭한다 — 매직 픽셀 상수 없이 결정적이다.
 */
export async function openSeededEventEditor(page: Page, tile: { readonly x: number; readonly y: number }): Promise<Locator> {
  await page.getByTestId("layer-event").click();
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();

  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const target = await pointAtTile(page, tile);
  await canvas.dblclick({ position: target });
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  return editor;
}

/**
 * 타일 좌표를 캔버스 안 좌표로 실측 환산한다. 매직 픽셀 상수가 없으므로 줌·카메라
 * 오프셋이 달라도 수렴한다 — 다중 타일 이벤트의 **비앵커 칸**을 겨냥할 때 특히 중요하다
 * (앵커에서 몇 픽셀 어긋나면 옆 칸을 클릭하고도 성공처럼 보인다).
 */
export async function pointAtTile(
  page: Page,
  tile: { readonly x: number; readonly y: number }
): Promise<{ readonly x: number; readonly y: number }> {
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  const center = { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) };
  const probeSpan = 64;

  const centerTile = await tileUnderCanvas(page, canvas, center);
  const spanTile = await tileUnderCanvas(page, canvas, { x: center.x + probeSpan, y: center.y + probeSpan });
  const stepX = spanTile.x - centerTile.x;
  const stepY = spanTile.y - centerTile.y;
  if (stepX <= 0 || stepY <= 0) throw new Error(`could not measure tile size: ${JSON.stringify({ centerTile, spanTile })}`);
  const pixelsPerTile = { x: probeSpan / stepX, y: probeSpan / stepY };

  // 카메라 오프셋은 타일 경계에 맞지 않으니, 직진 후 읽은 타일로 보정한다(항상 수렴).
  let target = {
    x: Math.round(center.x + (tile.x - centerTile.x) * pixelsPerTile.x),
    y: Math.round(center.y + (tile.y - centerTile.y) * pixelsPerTile.y),
  };
  let targetTile = await tileUnderCanvas(page, canvas, target);
  for (let attempt = 0; attempt < 3 && (targetTile.x !== tile.x || targetTile.y !== tile.y); attempt += 1) {
    target = {
      x: Math.round(target.x + (tile.x - targetTile.x) * pixelsPerTile.x),
      y: Math.round(target.y + (tile.y - targetTile.y) * pixelsPerTile.y),
    };
    targetTile = await tileUnderCanvas(page, canvas, target);
  }
  expect(targetTile, `tile ${tile.x},${tile.y} 을 화면에서 가리킬 수 없다`).toEqual({ x: tile.x, y: tile.y });
  return target;
}

/** 하니스용 커서 진단이 보고하는, 지금 포인터 아래의 타일. */
async function tileUnderCanvas(
  page: Page,
  canvas: Locator,
  position: { readonly x: number; readonly y: number }
): Promise<{ readonly x: number; readonly y: number }> {
  await canvas.hover({ position });
  const status = page.getByTestId("cursor-position");
  await expect(status).not.toHaveText("outside");
  const text = (await status.textContent()) ?? "";
  const [x, y] = text.split(",").map((part) => Number(part.trim()));
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`unexpected cursor position: ${text}`);
  return { x, y };
}
