import { gunzipSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import type { PiAgentRequest, PiCheckpointHeavyKey } from "../../src/ai/piAgent/protocol";
import { pointAtTile } from "./eventStoryboardPicker";

type RunBody = PiAgentRequest & { runId: string; heavy?: Partial<Record<PiCheckpointHeavyKey, string>>; heavyBlobs?: Record<string, string> };

async function mockPiRun(page: Page, finish: (request: RunBody) => string | readonly string[]) {
  const blobs = new Map<string, string>();
  await page.route("**/v1/agent/run?**", async route => {
    const request = route.request();
    const buffer = request.postDataBuffer()!;
    const body = JSON.parse((request.headers()["content-encoding"] === "gzip" ? gunzipSync(buffer) : buffer).toString()) as RunBody;
    expect(new URL(request.url()).searchParams.get("provider")).toBe("openai-codex");
    expect(body.model).toBe("gpt-6.2-sol");
    expect(body.smallTask).toBeDefined();
    for (const [key, value] of Object.entries(body.heavyBlobs ?? {})) blobs.set(key, value);
    const missing = Object.values(body.heavy ?? {}).filter(hash => !blobs.has(hash));
    if (missing.length) {
      await route.fulfill({ status: 409, json: { error: "heavy-missing", missing } });
      return;
    }
    const result = finish(body);
    const unchangedKeys = Object.keys(body.heavy ?? {}).filter(key => !Array.isArray(result) || !result.includes(key));
    if (Array.isArray(result) && result.includes("database")) {
      const database = body.heavy?.database ? JSON.parse(blobs.get(body.heavy.database)!) : body.project.database;
      const target = body.smallTask!.target;
      if (target.kind !== "dbEntry") throw new Error("Expected a database target");
      database.items.find((item: { id: string }) => item.id === target.id).price = 80;
      body.project.database = database;
    }
    await route.fulfill({
      headers: { "Content-Type": "application/x-ndjson", "X-Oprn-Run-Id": body.runId },
      body: JSON.stringify({ type: "done", smallTask: true, project: body.project, unchangedKeys,
        changedKeys: typeof result === "string" ? [] : result, ...(typeof result === "string" ? { stoppedEarly: result } : {}),
        stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 } }) + "\n",
    });
  });
}

test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ authMode: "chatgpt", apiKey: "",
      providerId: "openai-codex", model: "gpt-6.2-sol", liteModel: "gpt-6.2-sol" }));
  });
  await page.goto("/?blankProject=1", { waitUntil: "commit" });
  const guest = page.getByTestId("login-guest");
  const trigger = page.getByTestId("editor-zoom-controls").getByRole("button", { name: "이걸로 작업" });
  await expect(guest.or(trigger).first()).toBeVisible({ timeout: 120_000 });
  if (await guest.isVisible()) await guest.click();
  await expect(trigger).toBeVisible({ timeout: 60_000 });
});

function seedGreeting(page: Page) {
  return page.evaluate(async () => {
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
}

async function openGreetingEditor(page: Page, mapId: string, eventId: string) {
  await page.evaluate(async ({ mapId, eventId }) => {
    const { openEventEditorModal } = await import("/src/editor/panels/eventEditor/modal.ts");
    openEventEditorModal(mapId, eventId);
  }, { mapId, eventId });
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor.locator(".event-editor-commands-column")).toBeVisible();
  return editor;
}

test("캔버스 선택 → 한 줄 요청 → 적용 요약 → 한 번에 되돌리기", async ({ page }) => {
  let calls = 0;
  const fixture = await seedGreeting(page);
  const { mapId } = fixture;
  await mockPiRun(page, body => {
    expect(body.smallTask!.target).toMatchObject({ kind: "event", mapId, eventId: "ev_greeting" });
    const event = body.project.maps[mapId].events.find(event => event.id === "ev_greeting")!;
    event.pages![0].commands = [{ kind: "text", body: ++calls === 1 ? "어서 오세요!" : "안녕하세요!" }];
    return [`maps.${mapId}`];
  });
  const trigger = page.getByTestId("editor-zoom-controls").getByRole("button", { name: "이걸로 작업" });
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
  await expect(box.locator("strong")).toHaveText("대사 1줄 수정 · 이벤트 1개", { timeout: 90_000 });
  await expect(box).toContainText("「안녕.」 → 「어서 오세요!」");
  const readEvent = () => page.evaluate(async id => (await import("/src/project/store.ts")).store.getCurrent().maps[id].events[0], mapId);
  expect((await readEvent()).pages[0].commands[0].body).toBe("어서 오세요!");
  expect(await depth()).toBe(beforeDepth + 1);
  await box.getByRole("button", { name: "되돌리기" }).click();
  await expect(box.getByRole("status")).toHaveText("되돌렸어요.");
  expect(await readEvent()).toEqual(fixture.event);
  expect(calls).toBe(1);
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();

  const eventEditor = await openGreetingEditor(page, mapId, fixture.event.id);
  const eventTrigger = eventEditor.getByRole("button", { name: "이걸로 작업" });
  await eventTrigger.click();
  await expect(box).toContainText("이벤트 · 안내인");
  for (const viewport of [{ width: 1440, height: 980 }, { width: 760, height: 720 }]) {
    await page.setViewportSize(viewport);
    const anchor = (await eventTrigger.boundingBox())!;
    const capsule = (await box.boundingBox())!;
    expect(capsule.y).toBeGreaterThanOrEqual(anchor.y + anchor.height);
    expect(capsule.x).toBeGreaterThanOrEqual(0);
    expect(capsule.x + capsule.width).toBeLessThanOrEqual(viewport.width);
    for (const selector of [".event-editor-pagebar", ".event-editor-commands-column", ".event-editor-inspector-column"]) {
      const column = eventEditor.locator(selector);
      if (await column.isVisible()) expect((await column.boundingBox())!.y).toBeGreaterThanOrEqual(capsule.y + capsule.height);
    }
  }
  await page.setViewportSize({ width: 1440, height: 980 });
  await input.fill("인사를 고쳐 줘");
  await input.press("Enter");
  await expect(box).toContainText("「안녕.」 → 「안녕하세요!」", { timeout: 90_000 });
  expect((await readEvent()).pages[0].commands[0].body).toBe("안녕하세요!");
  await box.getByRole("button", { name: "되돌리기" }).click();
  await expect(box.getByRole("status")).toHaveText("되돌렸어요.");
  await expect(eventEditor.locator(".event-editor-commands-column")).toContainText("안녕.");
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();
  await expect(eventEditor).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(eventEditor).toBeHidden();

  await page.evaluate(async () => (await import("/src/editor/editorState.ts")).editorState.set({ currentMapId: null, selectedEventId: null }));
  await trigger.click();
  await expect(box).toContainText("무엇을 고칠지 먼저 고르세요");
  await expect(box.getByRole("button", { name: "실행" })).toBeDisabled();
});

test("작은 일을 되돌릴 때 열린 초안은 손편집 여부를 따르고 취소 확인 한 번으로 닫힌다", async ({ page }) => {
  const { mapId, event, x, y } = await seedGreeting(page);
  await mockPiRun(page, body => {
    const target = body.project.maps[mapId].events.find(entry => entry.id === event.id)!;
    target.pages![0].commands.push({ kind: "text", body: "AI가 추가한 대사." });
    return [`maps.${mapId}`];
  });
  const trigger = page.getByTestId("editor-zoom-controls").getByRole("button", { name: "이걸로 작업" });
  const box = page.getByRole("dialog", { name: "작은 일" });
  const run = async (open: typeof trigger) => {
    await open.click();
    const input = box.getByRole("textbox");
    await input.fill("대사를 한 줄 추가해 줘");
    await input.press("Enter");
    await expect(box).toContainText("대사 추가 「AI가 추가한 대사.」", { timeout: 90_000 });
  };
  await page.getByTestId("edit-canvas").locator("canvas").click({ position: await pointAtTile(page, { x, y }) });
  await run(trigger);
  await box.getByRole("button", { name: "닫기" }).click();
  const editor = await openGreetingEditor(page, mapId, event.id);
  const commands = editor.locator(".event-editor-commands-column");
  const status = editor.getByTestId("event-editor-draft-status");
  await expect(commands).toContainText("AI가 추가한 대사.");
  // The history command also runs when the event window is open.
  await page.evaluate(async () => (await import("/src/editor/mapEditHistory.ts")).undoMapEdit());
  await expect(commands).not.toContainText("AI가 추가한 대사.");
  await expect(status).toHaveAttribute("data-state", "session");
  await editor.getByTestId("event-editor-apply").click();
  const savedCommands = () => page.evaluate(async ({ mapId, eventId }) => {
    const { store } = await import("/src/project/store.ts");
    const { committedEventView } = await import("/src/project/eventDrafts.ts");
    const event = store.getCurrent().maps[mapId].events.find(entry => entry.id === eventId)!;
    return committedEventView(event)?.pages?.[0].commands;
  }, { mapId, eventId: event.id });
  expect(await savedCommands()).toEqual(event.pages[0].commands);

  await editor.getByTestId("event-editor-cancel").click();
  await expect(editor).toBeHidden();
  await page.getByTestId("edit-canvas").locator("canvas").click({ position: await pointAtTile(page, { x, y }) });
  await run(trigger);
  await box.getByRole("button", { name: "닫기" }).click();
  await openGreetingEditor(page, mapId, event.id);

  // Undo with a hand edit in the open draft. The working body stays put.
  const name = editor.getByTestId("event-editor-name");
  await name.fill("직접 고친 이름");
  await name.press("Tab");
  await page.evaluate(async () => (await import("/src/editor/mapEditHistory.ts")).undoMapEdit());
  await expect(status).toHaveAttribute("data-state", "conflict");
  await expect(name).toHaveValue("직접 고친 이름");
  await expect(commands).toContainText("AI가 추가한 대사.");
  expect(await savedCommands()).toEqual(event.pages[0].commands);
  await editor.getByTestId("event-editor-cancel").click();
  await page.getByRole("button", { name: "버리고 닫기", exact: true }).click();
  await expect(editor).toBeHidden();

  const reopened = await openGreetingEditor(page, mapId, event.id);
  await run(reopened.getByRole("button", { name: "이걸로 작업" }));
  // Leave the result card open. The same Cancel click should dismiss it and open the guard.
  await reopened.getByTestId("event-editor-name").fill("두 번째 직접 편집");
  await reopened.getByTestId("event-editor-name").press("Tab");
  await expect(box).toBeVisible();
  await page.evaluate(async () => (await import("/src/i18n/index.ts")).setLocale("en"));
  await reopened.getByTestId("event-editor-cancel").click();
  await expect(page.getByRole("dialog", { name: "Small task" })).toBeHidden();
  await page.getByRole("button", { name: "Discard and close", exact: true }).click();
  await expect(reopened).toBeHidden();
});

test("자료집에서 고른 물건의 가격을 고치고 범위 거절 메시지를 표시한다", async ({ page }) => {
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
  let failure: string | undefined;
  await mockPiRun(page, body => {
    calls++;
    expect(body.smallTask!.target).toMatchObject({ kind: "dbEntry", collection: "items", id });
    return failure ?? ["database"];
  });
  const readPrice = () => page.evaluate(async id =>
    (await import("/src/project/store.ts")).store.getCurrent().database.items.find(item => item.id === id)?.price, id);
  await trigger.click();
  await box.getByPlaceholder("포션 가격을 80으로").fill("가격을 80으로");
  await box.getByRole("textbox").press("Enter");
  await expect(box.locator("strong")).toHaveText("포션 가격 50 → 80", { timeout: 90_000 });
  expect(await readPrice()).toBe(80);
  await box.getByRole("button", { name: "되돌리기" }).click();
  await expect(box.getByRole("status")).toHaveText("되돌렸어요.");
  expect(await readPrice()).toBe(50);
  await box.getByRole("button", { name: "닫기" }).click();

  calls = 0;
  failure = "선택한 대상만 고칠 수 있어요.";
  await trigger.click();
  await box.getByRole("textbox").fill("다시 가격을 고쳐 줘");
  await box.getByRole("textbox").press("Enter");
  await expect(box.getByRole("status")).toHaveText("선택한 대상만 고칠 수 있어요.", { timeout: 90_000 });
  expect(calls).toBe(1);
  expect(await readPrice()).toBe(50);
  await box.getByRole("button", { name: "닫기" }).click();

  await page.evaluate(async () => (await import("/src/i18n/index.ts")).setLocale("en"));
  await modal.getByRole("button", { name: "Edit this with AI" }).click();
  const english = page.getByRole("dialog", { name: "Small task" });
  await expect(english.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(english.getByRole("button", { name: "Run" })).toBeDisabled();
  const englishInput = english.getByPlaceholder("Set the potion price to 80");
  await expect(englishInput).toHaveAccessibleName("One-line request");
  failure = "401 Unauthorized";
  await englishInput.fill("Change the price");
  await englishInput.press("Enter");
  await expect(english.getByRole("status")).toHaveText("Your AI sign-in expired or is disconnected. Sign in again in Settings.", { timeout: 90_000 });
  const logs = await page.evaluate(async () => (await import("/src/util/logger.ts")).getLogEntries({ ns: "small-task", minLevel: "error" }));
  expect(logs[0]).toMatchObject({ ns: "small-task", level: "error", message: "Request failed" });
});
