import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import type { PiAgentRequest, PiCheckpointHeavyKey } from "../../src/ai/piAgent/protocol";
import { pointAtTile } from "./eventStoryboardPicker";

const settingLabel = "AI가 고친 내용을 적용 전에 보기";
const request = "인사를 어서 오세요로 고쳐 줘";
const headline = "대사 1줄 수정 · 이벤트 1개";
type RunBody = PiAgentRequest & { runId: string; heavy?: Partial<Record<PiCheckpointHeavyKey, string>> };

test.beforeEach(async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.addInitScript(() => {
    localStorage.setItem("oprn:standard-welcome-seen", "1");
    localStorage.setItem("oprn:coachmarks-basic-v1", "1");
    localStorage.setItem("oprn:ai-config", JSON.stringify({ authMode: "chatgpt", apiKey: "",
      providerId: "openai-codex", model: "gpt-6.2-sol", liteModel: "gpt-6.2-sol" }));
  });
});

async function screenshot(page: Page, filename: string) {
  if (process.env.SHOTS_OUT) await page.screenshot({ path: join(process.env.SHOTS_OUT, filename), animations: "disabled" });
}

async function enablePreview(page: Page) {
  await page.addInitScript(() => {
    if (location.pathname === "/start-screen.html") {
      Object.defineProperty(window, "oprn", { configurable: true, value: { start: { recentProjects: async () => [] } } });
    }
  });
  await page.goto("/start-screen.html?lang=ko", { waitUntil: "commit" });
  await page.getByTestId("first-run-locale").click({ timeout: 120_000 });
  const settings = page.getByTestId("start-settings");
  await expect(settings).toBeVisible({ timeout: 90_000 });
  const toggle = settings.getByRole("checkbox", { name: settingLabel });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
  return settings;
}

async function openSmallTask(page: Page) {
  await page.goto("/?blankProject=1&lang=ko", { waitUntil: "commit" });
  const guest = page.getByTestId("login-guest");
  const trigger = page.getByTestId("editor-zoom-controls").getByRole("button", { name: "조수에게 맡기기" });
  await expect(guest.or(trigger).first()).toBeVisible({ timeout: 120_000 });
  if (await guest.isVisible()) await guest.click();
  await expect(trigger).toBeVisible({ timeout: 60_000 });

  const fixture = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { editorState } = await import("/src/editor/editorState.ts");
    const mapId = store.getCurrent().startMapId;
    const map = store.getCurrent().maps[mapId];
    const x = Math.floor(map.width / 2), y = Math.floor(map.height / 2);
    const commands = [{ kind: "text" as const, body: "안녕." }];
    store.updateMap(mapId, draft => {
      draft.events = [{
        id: "ev_greeting", name: "안내인", x, y, trigger: { kind: "action" }, commands,
        pages: [{ id: "page_greeting", name: "인사", graphic: {}, conditions: [], trigger: { kind: "action" },
          priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands }],
      }];
    });
    editorState.set({ currentMapId: mapId, layer: "event", tool: "event", selectedEventId: null });
    return { mapId, x, y };
  });
  await page.route("**/v1/agent/run?**", route => {
    const incoming = route.request();
    const buffer = incoming.postDataBuffer()!;
    const body = JSON.parse((incoming.headers()["content-encoding"] === "gzip" ? gunzipSync(buffer) : buffer).toString()) as RunBody;
    expect(body.task).toBe(request);
    expect(body.smallTask?.target).toMatchObject({ kind: "event", mapId: fixture.mapId, eventId: "ev_greeting" });
    const event = body.project.maps[fixture.mapId].events.find(event => event.id === "ev_greeting")!;
    event.pages![0].commands = [{ kind: "text", body: "어서 오세요!" }];
    return route.fulfill({
      headers: { "Content-Type": "application/x-ndjson", "X-Oprn-Run-Id": body.runId },
      body: JSON.stringify({ type: "done", smallTask: true, project: body.project,
        changedKeys: [`maps.${fixture.mapId}`], unchangedKeys: Object.keys(body.heavy ?? {}),
        stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 } }) + "\n",
    });
  });
  await page.getByTestId("edit-canvas").locator("canvas").click({ position: await pointAtTile(page, fixture) });
  await trigger.click();
  const box = page.getByRole("dialog", { name: "작은 일" });
  const input = box.getByRole("textbox", { name: "한 줄 요청" });
  const run = async () => {
    await input.press("Enter");
    await expect(box.locator("strong")).toHaveText(headline, { timeout: 90_000 });
    await expect(box).toContainText("「안녕.」 → 「어서 오세요!」");
  };
  const read = () => page.evaluate(async mapId => {
    const { store } = await import("/src/project/store.ts");
    const { getMapEditHistoryDepth } = await import("/src/editor/mapEditHistory.ts");
    return {
      command: store.getCurrent().maps[mapId].events[0].pages?.[0].commands[0],
      depth: getMapEditHistoryDepth(),
    };
  }, fixture.mapId);
  await input.fill(request);
  return { box, input, run, read };
}

test("미리 보기에서 취소하거나 적용한 뒤 되돌릴 수 있다", async ({ page }) => {
  const settings = await enablePreview(page);
  await screenshot(page, "01-setting.png");
  await settings.getByTestId("start-settings-close").click();

  const { box, input, run, read } = await openSmallTask(page);
  const before = await read();
  const apply = box.getByRole("button", { name: "적용", exact: true });
  const cancel = box.getByRole("button", { name: "취소", exact: true });
  await run();
  await expect(apply).toBeVisible();
  await expect(cancel).toBeFocused();
  expect(await read()).toEqual(before);
  await screenshot(page, "02-preview.png");

  await cancel.click();
  await expect(box.getByRole("status")).toHaveText("취소했어요.");
  await expect(input).toHaveValue(request);
  await expect(input).toBeFocused();
  expect(await read()).toEqual(before);
  await screenshot(page, "05-cancelled.png");

  await run();
  await page.keyboard.press("Escape");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(request);
  expect(await read()).toEqual(before);

  await run();
  await apply.click();
  const undo = box.getByRole("button", { name: "되돌리기" });
  await expect(undo).toBeFocused();
  expect(await read()).toEqual({ command: { kind: "text", body: "어서 오세요!" }, depth: before.depth + 1 });
  await screenshot(page, "03-applied.png");
  await undo.click();
  await expect(box.getByRole("status")).toHaveText("되돌렸어요.");
  expect(await read()).toEqual(before);
  await screenshot(page, "04-undo.png");
});

test("미리 보는 동안 프로젝트가 바뀌면 적용을 거절한다", async ({ page }) => {
  await enablePreview(page);
  const { box, input, run, read } = await openSmallTask(page);
  const before = await read();
  await run();
  await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    store.update(project => { project.meta.title = "다른 편집"; });
  });
  await box.getByRole("button", { name: "적용", exact: true }).click();
  await expect(box.getByRole("status")).toHaveText("작업 중 프로젝트가 바뀌었어요. 다시 요청해 주세요.");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(request);
  expect(await read()).toEqual(before);
});

test("설정이 꺼져 있으면 바로 적용한다", async ({ page }) => {
  const { box, run, read } = await openSmallTask(page);
  const before = await read();
  await run();
  await expect(box.getByRole("button", { name: "되돌리기" })).toBeVisible();
  await expect(box.getByRole("button", { name: "적용", exact: true })).toHaveCount(0);
  expect(await read()).toEqual({ command: { kind: "text", body: "어서 오세요!" }, depth: before.depth + 1 });
});
