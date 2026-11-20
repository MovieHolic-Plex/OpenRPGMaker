import { expect, test } from "@playwright/test";
import { pointAtTile } from "./eventStoryboardPicker";

test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
  await page.goto("/?blankProject=1", { waitUntil: "commit" });
  const guest = page.getByTestId("login-guest");
  const trigger = page.getByTestId("editor-zoom-controls").getByRole("button", { name: "이걸로 작업" });
  await expect(guest.or(trigger).first()).toBeVisible({ timeout: 120_000 });
  if (await guest.isVisible()) await guest.click();
  await expect(trigger).toBeVisible({ timeout: 60_000 });
});

test("캔버스 선택 → 한 줄 요청 → 적용 요약 → 한 번에 되돌리기", async ({ page }) => {
  let calls = 0;
  let mapId = "";
  await page.route("**/v1/chat/completions", async route => {
    const request = route.request().postDataJSON();
    expect(request.tools.map((tool: { function: { name: string } }) => tool.function.name)).toContain("patch_event_page");
    const name = ["get_event", "patch_event_page", "patch_event_page"][calls++];
    const args = { mapId, eventId: "ev_greeting", ...(name === "patch_event_page" ? { pageId: "page_greeting",
      set: { commands: [{ kind: "text", body: calls === 2 ? "어서 와요." : "어서 오세요!" }] } } : {}) };
    await route.fulfill({ json: { choices: [{ finish_reason: name ? "tool_calls" : "stop",
      message: { role: "assistant", content: name ? null : "마쳤어요.", ...(name ? { tool_calls: [
        { id: `call-${calls}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
      ] } : {}) } }] } });
  });
  const trigger = page.getByTestId("editor-zoom-controls").getByRole("button", { name: "이걸로 작업" });
  const fixture = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const mapId = store.getCurrent().startMapId;
    const map = store.getCurrent().maps[mapId];
    const x = Math.floor(map.width / 2), y = Math.floor(map.height / 2);
    const commands = [{ kind: "text" as const, body: "안녕." }];
    const event = { id: "ev_greeting", name: "안내인", x, y, trigger: { kind: "action" as const }, commands,
      pages: [{ id: "page_greeting", name: "인사", graphic: {}, conditions: [], trigger: { kind: "action" as const },
        priority: "same" as const, movement: { type: "fixed" as const, speed: 3, frequency: 3 }, commands }] };
    store.updateMap(mapId, map => { map.events = [event]; });
    editorState.set({ currentMapId: mapId, layer: "event", tool: "event", selectedEventId: null });
    return { mapId, event, x, y };
  });
  mapId = fixture.mapId;
  await page.getByTestId("edit-canvas").locator("canvas").click({ position: await pointAtTile(page, fixture) });
  const depth = () => page.evaluate(async () => (await import("/src/editor/mapEditHistory.ts")).getMapEditHistoryDepth());
  const beforeDepth = await depth();
  await trigger.click();
  const box = page.getByRole("dialog", { name: "작은 일" });
  await expect(box).toContainText("안내인");
  await expect(box.locator('select, [role="tab"], [role="tablist"], [role="switch"], input[type="checkbox"]')).toHaveCount(0);
  const input = box.getByRole("textbox");
  await input.fill("인사를 어서 오세요로 고쳐 줘");
  await input.press("Enter");
  await expect(box.getByRole("status")).not.toHaveText("작업 중…", { timeout: 90_000 });
  expect(await box.locator("strong").textContent(), `도구 응답 ${calls}회 · ${await box.getByRole("status").textContent()}`)
    .toBe("대사 1줄 수정 · 이벤트 1개");
  await expect(box).toContainText("「안녕.」 → 「어서 오세요!」");
  const readEvent = () => page.evaluate(async id => (await import("/src/project/store.ts")).store.getCurrent().maps[id].events[0], mapId);
  expect((await readEvent()).pages[0].commands[0].body).toBe("어서 오세요!");
  expect(await depth()).toBe(beforeDepth + 1);
  await box.getByRole("button", { name: "되돌리기" }).click();
  expect(await readEvent()).toEqual(fixture.event);
  expect(calls).toBe(4);
  await page.keyboard.press("Escape");
  await page.evaluate(async () => (await import("/src/editor/editorState.ts")).editorState.set({ currentMapId: null, selectedEventId: null }));
  await trigger.click();
  await expect(box).toContainText("무엇을 고칠지 먼저 고르세요");
  await expect(box.getByRole("button", { name: "실행" })).toBeDisabled();
});

test("자료집에서 고른 물건의 가격을 고치고 다른 물건을 쓰려는 호출은 전부 취소한다", async ({ page }) => {
  const id = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    store.update(project => {
      project.database.items[0].name = "포션";
      project.database.items[0].price = 50;
    });
    const id = store.getCurrent().database.items[0].id;
    const { openDatabaseModal } = await import("/src/editor/panels/databaseModal.ts");
    openDatabaseModal("items");
    return id;
  });
  const modal = page.getByTestId("database-modal");
  await modal.getByTestId(`db-record-row-${id}`).click();
  const trigger = modal.getByRole("button", { name: "이걸로 작업" });
  const box = page.getByRole("dialog", { name: "작은 일" });
  let calls = 0;
  let wrongId = false;
  await page.route("**/v1/chat/completions", async route => {
    const writing = calls++ === 0 || wrongId;
    const recordId = wrongId && calls > 1 ? "item_other" : id;
    const message = writing ? { role: "assistant", tool_calls: [{ type: "function", id: `call-${calls}`,
      function: { name: "upsert_item", arguments: JSON.stringify({ item: { id: recordId, price: 80 } }) } }] }
      : { role: "assistant", content: "마쳤어요." };
    await route.fulfill({ json: { choices: [{ finish_reason: writing ? "tool_calls" : "stop", message }] } });
  });
  const readPrice = () => page.evaluate(async id =>
    (await import("/src/project/store.ts")).store.getCurrent().database.items.find(item => item.id === id)?.price, id);
  await trigger.click();
  await box.getByPlaceholder("포션 가격을 80으로").fill("가격을 80으로");
  await box.getByRole("textbox").press("Enter");
  await expect(box.locator("strong")).toHaveText("포션 가격 50 → 80", { timeout: 90_000 });
  expect(await readPrice()).toBe(80);
  await box.getByRole("button", { name: "되돌리기" }).click();
  expect(await readPrice()).toBe(50);
  await box.getByRole("button", { name: "닫기" }).click();

  calls = 0;
  wrongId = true;
  await trigger.click();
  await box.getByRole("textbox").fill("다시 가격을 고쳐 줘");
  await box.getByRole("textbox").press("Enter");
  await expect(box.getByRole("status")).toHaveText("선택한 대상만 고칠 수 있어요.", { timeout: 90_000 });
  expect(calls).toBe(2);
  expect(await readPrice()).toBe(50);
});
