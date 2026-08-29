import { expect, test, type Page } from "@playwright/test";

// 44 개 버튼을 하나씩 누르고 매번 목록·궤적 프리뷰가 다시 그려진다 — 60 초로는 부족하다.
test.setTimeout(150_000);

type ExportedMove = {
  readonly kind: string;
  readonly switchId?: string;
  readonly spriteId?: string;
  readonly resourceId?: string;
  readonly dx?: number;
  readonly dy?: number;
  readonly heightPx?: number;
  readonly durationMs?: number;
};

type ProjectExport = {
  readonly project: {
    readonly startMapId: string;
    readonly maps: Record<string, { readonly events: readonly { readonly pages?: readonly { readonly movement?: { readonly route?: { readonly moves: readonly ExportedMove[] } } }[] }[] }>;
  };
};

async function openEventEditor(page: Page): Promise<void> {
  await page.goto("/?freshProject=1");
  await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("layer-event").click();
  await page.getByTestId("tool-event").click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (box === null) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const editor = page.getByTestId("event-editor-modal");
  if ((await editor.count()) === 0) await page.getByTestId("event-editor-open").click();
  await expect(editor).toBeVisible();
}

/**
 * 이벤트 편집기의 `<select>` 는 `customSelect.ts` 가 스킨을 입히면서 `opacity:0` +
 * `aria-hidden` 으로 숨겨진다. 그래서 `selectOption()` 은 "element is not visible" 로 죽는다.
 * 트리거(`data-custom-select-for=<원래 testid>`)를 눌러 옵션 버튼을 클릭하는 것이 실제 사용자 경로다.
 */
async function chooseCustomSelect(page: Page, testId: string, optionLabel: string): Promise<void> {
  await page.locator(`[data-custom-select-for="${testId}"]`).click();
  await page.locator(".event-custom-select-option", { hasText: optionLabel }).first().click();
}

async function exportedMoves(page: Page): Promise<readonly ExportedMove[]> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (text === null) throw new Error("missing project export");
  const state: ProjectExport = JSON.parse(text);
  const map = state.project.maps[state.project.startMapId];
  const event = map?.events.find((item) => item.pages?.some((pageItem) => pageItem.movement?.route));
  const routePage = event?.pages?.find((pageItem) => pageItem.movement?.route);
  return routePage?.movement?.route?.moves ?? [];
}

test("custom page movement route dialog adds every Korean command button and persists the route", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1900, height: 1000 });
  await openEventEditor(page);

  // 페이지 설정은 아코디언 레일이라 한 번에 한 그룹만 열린다 — 「움직임과 속도」를 먼저 펼친다.
  await page.getByTestId("evt-rail-group-move").locator(".event-editor-settings-accordion-header").click();
  await chooseCustomSelect(page, "event-page-movement-type", "사용자 지정");
  await page.getByTestId("event-page-custom-route").click();
  const dialog = page.getByTestId("event-page-move-route-dialog");
  await expect(dialog).toBeVisible();
  // 스위치·효과음은 **채우지 않는다**. 이 칸에 없는 id 를 넣으면 「적용」이
  // `reference.resource.missing` 오류로 이벤트 저장을 통째로 거부하고(토스트 "오류 1개") 새
  // 이벤트가 사라진다 — 예전 `sw_route_seen` / `se_route_chime` 이 정확히 그랬다. 편집창 기본값은
  // 프로젝트의 실제 스위치 · SE 카탈로그 첫 항목이라 그대로 두는 것이 실사용 경로다.
  // 차셋 텍스처 키는 EASYRPG_RTP_ASSETS 에 실재하므로 직접 채워 라벨까지 확인한다.
  await page.getByTestId("event-page-move-route-graphic-id").fill("tex_easyrpg_charset_people1");
  // 체공 값도 같은 "이 단계 값" 패널에서 온다 — 점프·낙하 버튼이 이걸 싣는지 실제 브라우저에서 본다.
  await page.getByTestId("event-page-move-route-hop-dx").fill("2");
  await page.getByTestId("event-page-move-route-hop-dy").fill("-1");
  await page.getByTestId("event-page-move-route-hop-height").fill("48");
  await page.getByTestId("event-page-move-route-hop-duration").fill("1200");

  const buttons = dialog.locator(".event-page-move-route-command");
  await expect(buttons).toHaveCount(44);
  const buttonCount = await buttons.count();
  for (let index = 0; index < buttonCount; index += 1) {
    await buttons.nth(index).click();
  }

  const rows = dialog.locator(".event-page-move-route-list-row");
  // 버튼 수 + 「시작」 행.
  await expect(rows).toHaveCount(45);
  await expect(dialog.getByTestId("event-page-move-route-command-list")).toContainText("tex_easyrpg_charset_people1");
  await expect(dialog.getByTestId("event-page-move-route-command-list")).toContainText("점프 (2, -1) 48px 1200ms");
  await expect(dialog.getByTestId("event-page-move-route-command-list")).toContainText("위에서 낙하 48px 1200ms");
  await page.screenshot({ path: testInfo.outputPath("move-route-all-buttons.png"), fullPage: true });

  await dialog.getByTestId("event-page-move-route-ok").click();
  await expect(dialog).toBeHidden();
  await page.getByTestId("event-editor-apply").click();

  const moves = await exportedMoves(page);
  expect(moves).toHaveLength(44);
  expect([...new Set(moves.map((move) => move.kind))]).toEqual(expect.arrayContaining([
    "move",
    "turn",
    "jump",
    "dropIn",
    "land",
    "moveDiagonal",
    "turnRelative",
    "setDirectionFix",
    "setThrough",
    "setAnimation",
    "moveRandom",
    "turnRandom",
    "changeOpacity",
    "moveTowardPlayer",
    "turnTowardPlayer",
    "moveAwayFromPlayer",
    "turnAwayFromPlayer",
    "setSwitch",
    "stepForward",
    "wait",
    "changeSpeed",
    "changeFrequency",
    "changeGraphic",
    "playSe",
  ]));
  expect(moves.some((move) => move.kind === "changeGraphic" && move.spriteId === "tex_easyrpg_charset_people1")).toBe(true);
  // 기본값 id 를 문자열로 박지 않는다 — 카탈로그/프로젝트가 바뀌면 낡는다. 대신 **비어 있지
  // 않은 실재 id** 가 실렸는지만 본다. 저장이 성공했다는 사실 자체가 검증기를 통과했다는 뜻이다.
  expect(moves.some((move) => move.kind === "setSwitch" && (move.switchId ?? "").length > 0)).toBe(true);
  expect(moves.some((move) => move.kind === "playSe" && (move.resourceId ?? "").length > 0)).toBe(true);
  // 보스 강림·건너뛰는 점프의 저작값이 저장 JSON 까지 그대로 내려간다.
  expect(
    moves.some(
      (move) =>
        move.kind === "jump" && move.dx === 2 && move.dy === -1 && move.heightPx === 48 && move.durationMs === 1200
    )
  ).toBe(true);
  expect(moves.some((move) => move.kind === "dropIn" && move.heightPx === 48 && move.durationMs === 1200)).toBe(true);
});

// 체공 저작만 좁게 보는 시험. 위 전체 스윕(44 버튼)은 느리고 프리뷰 재렌더에 민감해서,
// "보스가 위에서 떨어지는" 실제 저작 경로는 여기서 빠르게 잠근다.
test("hop parameters reach the saved route from the page movement dialog", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1900, height: 1000 });
  await openEventEditor(page);

  await page.getByTestId("evt-rail-group-move").locator(".event-editor-settings-accordion-header").click();
  await chooseCustomSelect(page, "event-page-movement-type", "사용자 지정");
  await page.getByTestId("event-page-custom-route").click();
  const dialog = page.getByTestId("event-page-move-route-dialog");
  await expect(dialog).toBeVisible();

  await page.getByTestId("event-page-move-route-hop-dx").fill("2");
  await page.getByTestId("event-page-move-route-hop-dy").fill("-1");
  await page.getByTestId("event-page-move-route-hop-height").fill("96");
  await page.getByTestId("event-page-move-route-hop-duration").fill("1500");
  await dialog.getByTestId("event-page-move-route-add-jump").click();
  await dialog.getByTestId("event-page-move-route-add-drop-in").click();

  const list = dialog.getByTestId("event-page-move-route-command-list");
  await expect(list).toContainText("점프 (2, -1) 96px 1500ms");
  await expect(list).toContainText("위에서 낙하 96px 1500ms");
  await page.screenshot({ path: testInfo.outputPath("move-route-hop-authoring.png"), fullPage: true });

  await dialog.getByTestId("event-page-move-route-ok").click();
  await expect(dialog).toBeHidden();
  await page.getByTestId("event-editor-apply").click();

  const moves = await exportedMoves(page);
  expect(moves).toEqual([
    { kind: "jump", dx: 2, dy: -1, heightPx: 96, durationMs: 1500 },
    { kind: "dropIn", heightPx: 96, durationMs: 1500 },
  ]);
});
