/**
 * 몸 사각 / 통행 사각 저작 증거 샷. `_` 접두사는 기본 스위트에서 제외한다.
 *
 * 브라우저 QA(scripts/qa/runtime/golem.scenario.mjs)는 **런타임**이 두 사각을 지키는지 본다.
 * 이 스펙은 그 반대편 — **저작자가 그것을 만들 수 있는지**를 본다. 사용자 요청의 본체가
 * "이건 event editor 까지 같이 손봐야될거같은데" 였으므로 편집 표면에도 눈으로 볼 증거가 필요하다.
 *
 * 실행: DEV_SERVER_PORT=<빈 포트> npx playwright test test/e2e/_body-passage-shots.spec.ts
 *   ⚠ 포트를 안 박으면 `reuseExistingServer` 가 **다른 워크트리의 dev 서버**를 재사용해
 *     남의 브랜치 코드를 검증한다(실측: 필드셋이 아예 없다고 나왔다).
 *
 * `page.evaluate` 안의 `import("/src/...")` 는 브라우저가 해석하는 URL 이라 타입이 없다.
 * author-dew-village-editor-demo.spec.ts 와 같은 기존 관례이고 전체 typecheck 기준선에 포함된다.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { pointAtTile } from "./eventStoryboardPicker";

const DIR = "verify-shots/big-character-editor";
const VIEWPORT = { width: 1600, height: 1000 } as const;
/** 골렘 앵커. 발밑 칸이다 — 3x3 이면 몸은 x8..10 y6..8 을 덮는다. */
const ANCHOR = { x: 9, y: 8 } as const;
/** 앵커가 아닌 칸(머리). 1x1 시절에는 여기를 클릭하면 **새 이벤트가 생겼다.** */
const HEAD = { x: 9, y: 6 } as const;

test.use({ serviceWorkers: "block" });

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

/** 편집창의 「크기와 통행」 그룹을 열고 필드셋 로케이터를 돌려준다. */
async function openFootprintGroup(page: Page) {
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  const header = editor.getByTestId("evt-rail-group-memory");
  if (await header.count()) await header.click();
  const control = editor.getByTestId("event-page-footprint-control");
  await expect(control).toBeVisible();
  return control;
}

async function setNumber(page: Page, testid: string, value: number): Promise<void> {
  const input = page.getByTestId(testid);
  await input.fill(String(value));
  // `change` 로만 커밋한다(입력 중간 상태를 저장하지 않는다). blur 가 그것을 발생시킨다.
  await input.blur();
}

test("몸 3x3 · 통행 1행을 편집창에서 저작하고 편집 맵에서 확인한다", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(DIR, { recursive: true });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ ...VIEWPORT });
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  // 골렘을 편집기 CRUD 경로로 심는다(직접 store 변조가 아니라 출하 경로다).
  const eventId = await page.evaluate(async (anchor) => {
    const eventActions = await import("/src/editor/eventActions.ts");
    const eventPages = await import("/src/editor/eventPages.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const { store } = await import("/src/project/store.ts");
    const mapId = store.getCurrent().startMapId;
    const id = eventActions.addEvent(mapId, anchor.x, anchor.y);
    const map = store.getCurrent().maps[mapId];
    const event = map?.events.find((candidate: { id: string }) => candidate.id === id);
    const pageId = event?.pages?.[0]?.id;
    if (!pageId) throw new Error("새 이벤트에 페이지가 없다");
    eventActions.updateEvent(mapId, id, { name: "돌골렘" });
    eventPages.updateEventPage(mapId, id, pageId, {
      // AssetRef 는 `{type,id}` 다. `{resourceId}` 로 쓰면 조용히 무시되고 그림 없는
      // 이벤트가 되어, 편집 맵 샷에서 사각만 보이고 골렘이 안 보인다(실측).
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, direction: "down" },
    });
    eventPages.addEventPageCommand(mapId, id, pageId, { kind: "text", body: "…돌이 눈을 떴다." });
    editorState.set({ currentMapId: mapId, selectedEventId: id, selectedEventPageId: pageId });
    return id;
  }, ANCHOR);

  // ── 1. 기본값(1x1). 발자국을 안 만진 페이지가 어떻게 보이는지가 항등의 눈 증거다.
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  await canvas.dblclick({ position: await pointAtTile(page, ANCHOR) });
  let control = await openFootprintGroup(page);
  await expect(page.getByTestId("event-page-footprint-summary")).toContainText("1칸");
  await control.screenshot({ path: `${DIR}/01-fieldset-default-1x1.png` });

  // ── 2. 몸 3x3 · 통행 1행 입력.
  await setNumber(page, "event-page-body-width", 3);
  await setNumber(page, "event-page-body-height", 3);
  await setNumber(page, "event-page-pass-rows", 1);
  const summary = page.getByTestId("event-page-footprint-summary");
  await expect(summary).toContainText("3x3");
  await expect(summary).toContainText("하단 1행");
  await control.screenshot({ path: `${DIR}/02-fieldset-3x3-pass1.png` });
  await shot(page, "03-editor-full");

  // 배율은 파생값이다 — 몸을 키우면 그림도 같이 커진다(수동 지정을 켜지 않았으므로).
  const afterEdit = await page.evaluate(
    async ([id]) => {
      const { store } = await import("/src/project/store.ts");
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      const page0 = map?.events.find((candidate: { id: string }) => candidate.id === id)?.pages?.[0];
      return { footprint: page0?.footprint ?? null, passRows: page0?.passRows ?? null, scale: page0?.graphic.scale ?? null };
    },
    [eventId],
  );
  expect(afterEdit).toEqual({ footprint: { width: 3, height: 3 }, passRows: 1, scale: 3 });

  // ── 3. 닫고 다시 열어 값이 살아 있는지. 편집창이 값을 못 되읽으면 저작이 성립하지 않는다.
  await page.getByTestId("event-editor-modal").getByTestId("event-editor-save").click();
  await expect(page.getByTestId("event-editor-modal")).toBeHidden();
  await canvas.dblclick({ position: await pointAtTile(page, ANCHOR) });
  control = await openFootprintGroup(page);
  await expect(page.getByTestId("event-page-body-width")).toHaveValue("3");
  await expect(page.getByTestId("event-page-body-height")).toHaveValue("3");
  await expect(page.getByTestId("event-page-pass-rows")).toHaveValue("1");
  await control.screenshot({ path: `${DIR}/04-fieldset-reopened.png` });
  await page.getByTestId("event-editor-modal").getByTestId("event-editor-save").click();
  await expect(page.getByTestId("event-editor-modal")).toBeHidden();

  // ── 4. 편집 맵. 3x3 외곽선 + 하단 1행 음영이 캔버스에 그려진다.
  // AI 독은 맵의 왼쪽을 덮고, 호버 툴팁은 골렘 위에 뜬다 — 증거 샷에서 둘 다 치운다.
  // `chat-float-host` 를 같이 치우는 이유: 확대하면 겨냥할 타일이 그 밑으로 들어가고,
  // 그 상자가 포인터를 가로채 `pointAtTile` 의 호버가 영원히 재시도한다(실측 타임아웃).
  await page.addStyleTag({
    content:
      "[data-testid='ai-assistant-panel'], [data-testid='chat-float-host'], .event-hover-card, .map-event-tooltip { display: none !important; }",
  });
  for (let step = 0; step < 2; step += 1) {
    const zoomIn = page.getByTestId("editor-zoom-next");
    if (await zoomIn.count()) await zoomIn.click();
  }
  // 「편집 위치」 배지는 **마지막 클릭 칸**에 남아 골렘을 덮는다. 빈 칸을 한 번 눌러 옮긴다 —
  // 단일 클릭은 pendingEventCoordinate 만 세우고 이벤트를 만들지 않는다(EditScene 의 계약).
  // 클립 상자(x 5..12, y 3..11) 밖으로 보낸다. 화면 밖이면 실측이 실패하므로 폴백을 둔다.
  const badgeAway = await pointAtTile(page, { x: ANCHOR.x + 5, y: ANCHOR.y + 4 }).catch(
    async () => await pointAtTile(page, { x: ANCHOR.x - 4, y: ANCHOR.y + 3 }),
  );
  await canvas.click({ position: badgeAway });
  // 확대 뒤 좌표가 달라졌으므로 다시 실측한다. 클립 상자는 몸 사각을 두 칸씩 둘러싼 범위다.
  const topLeft = await pointAtTile(page, { x: ANCHOR.x - 4, y: ANCHOR.y - 5 });
  const bottomRight = await pointAtTile(page, { x: ANCHOR.x + 3, y: ANCHOR.y + 3 });
  await page.mouse.move(4, 4); // 툴팁을 띄우는 호버를 캔버스 밖으로 뺀다.
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("missing canvas box");
  await page.screenshot({
    path: `${DIR}/05-edit-map-body-rect.png`,
    clip: {
      x: canvasBox.x + topLeft.x,
      y: canvasBox.y + topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    },
  });

  // ── 5. 비앵커 칸(머리) 클릭이 **선택**으로 잡힌다. 전에는 새 이벤트가 생겼다.
  const before = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const project = store.getCurrent();
    return project.maps[project.startMapId]?.events.length ?? 0;
  });
  await page.evaluate(async () => {
    const { editorState } = await import("/src/editor/editorState.ts");
    editorState.set({ selectedEventId: null, selectedEventPageId: null });
  });
  await canvas.click({ position: await pointAtTile(page, HEAD) });
  const after = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const project = store.getCurrent();
    return {
      count: project.maps[project.startMapId]?.events.length ?? 0,
      selected: editorState.get().selectedEventId ?? null,
    };
  });
  expect(after.count, "머리 칸 클릭이 새 이벤트를 만들었다").toBe(before);
  expect(after.selected, "머리 칸 클릭이 골렘을 선택하지 못했다").toBe(eventId);
  await shot(page, "06-nonanchor-click-selects");

  await writeFile(
    `${DIR}/evidence.json`,
    `${JSON.stringify({ anchor: ANCHOR, head: HEAD, eventId, afterEdit, before, after, pageErrors }, null, 2)}\n`,
    "utf8",
  );
  expect(pageErrors).toEqual([]);
});
