import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("event button uses shared assistant, reviews locally, applies once and undoes", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?blankProject=1");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60000 });
  const target = await page.evaluate(async () => {
    const { createBlankProject } = await import("/src/project/defaults.ts");
    const { store } = await import("/src/project/store.ts");
    const project = createBlankProject();
    const mapId = project.startMapId;
    const target = { mapId, eventId: "shared-assist-event", pageId: "shared-assist-page" };
    const original = [{ kind: "text" as const, body: "기존 인사입니다." }];
    const basePage = { id: target.pageId, name: "인사", conditions: [], graphic: {}, trigger: { kind: "action" as const },
      priority: "same" as const, movement: { type: "fixed" as const, speed: 3, frequency: 3 }, commands: original };
    project.maps[mapId].events.push({ id: target.eventId, name: "안내인", x: 3, y: 3, trigger: { kind: "action" }, commands: original,
      pages: [basePage, { ...structuredClone(basePage), id: "untouched-page", name: "보존할 페이지" }] });
    store.replaceProject(project);
    return target;
  });
  const { mapId } = target;
  const original = [{ kind: "text", body: "기존 인사입니다." }];
  const generated = [{ kind: "text", body: "여행자님, 마을에 오신 것을 환영합니다." }];
  const calls: { tools: string[]; kind: string }[] = [];
  let writerRound = 0;
  let pauseGenerator = false;
  let generatorPaused = false;
  let releaseGenerator: (() => void) | undefined;
  await page.route("**/v1/chat/completions", async route => {
    const request = route.request().postDataJSON();
    const tools = (request.tools ?? []).map((t: { function: { name: string } }) => t.function.name);
    const prompt = JSON.stringify(request.messages);
    let content: string | null = null;
    let tool_calls;
    let kind = "routing";
    if (tools.length) {
      kind = "shared-session";
      expect(tools).toContain("event_command_assist");
      expect(tools).not.toContain("upsert_event");
      if (writerRound < 2) {
        const name = writerRound++ === 0 ? "get_event" : "event_command_assist";
        const args = name === "get_event" ? { mapId, eventId: target.eventId }
          : { ...target, prompt: "현재 인사를 따뜻한 환영 인사로 고쳐 줘" };
        tool_calls = [{ id: `browser-${writerRound}`, type: "function", function: { name, arguments: JSON.stringify({ ...args, reason: "선택한 이벤트 페이지 수정" }) } }];
      } else content = "현재 페이지의 인사말 초안을 만들었습니다. 변경 내용을 확인해 주세요.";
    } else if (prompt.includes("당신은 브라우저 기반 2D RPG 에디터의 이벤트 명령 편집기입니다.")) {
      kind = "event-command-generator";
      expect(prompt).toContain("기존 인사입니다.");
      content = JSON.stringify(generated);
      if (pauseGenerator) {
        generatorPaused = true;
        await new Promise<void>(resolve => { releaseGenerator = resolve; });
      }
    } else content = JSON.stringify({ mode: "modify", space: "none", facility: null, targetMapId: mapId,
      useSelection: false, clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false,
      tools: ["event_command_assist"], summary: "이벤트 페이지 인사 수정", requirements: [] });
    calls.push({ tools, kind });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      choices: [{ message: { role: "assistant", content, ...(tool_calls ? { tool_calls } : {}) }, finish_reason: tool_calls ? "tool_calls" : "stop" }],
    }) });
  });
  await page.evaluate(async target => {
    const { openEventEditorModal } = await import("/src/editor/panels/eventEditor/modal.ts");
    openEventEditorModal(target.mapId, target.eventId);
  }, target);
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  await editor.getByTestId("event-command-quick-ai").click();
  await editor.getByTestId("ai-event-input").fill("현재 인사를 따뜻한 환영 인사로 고쳐 줘");
  const evidence = "output/evidence/event-ai-shared-assistant";
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/01-request.png` });
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.getByTestId("ai-event-staged")).toBeVisible({ timeout: 120_000 });
  await expect(editor.getByTestId("ai-event-staged")).toContainText(generated[0].body);
  const read = () => page.evaluate(async target => {
    const { store } = await import("/src/project/store.ts");
    return store.getCurrent().maps[target.mapId].events.find(e => e.id === target.eventId)!.pages!;
  }, target);
  expect((await read())[0].commands).toEqual(original);
  expect((await read())[1].commands).toEqual(original);
  expect(await page.evaluate(async () => {
    const { getAiAssistantPendingProposal } = await import("/src/editor/aiAssistantBridge.ts");
    return getAiAssistantPendingProposal();
  })).toBeNull();
  await page.screenshot({ path: `${evidence}/02-review.png` });
  await editor.getByTestId("ai-event-apply").click();
  expect((await read())[0].commands).toEqual(generated);
  expect((await read())[1].commands).toEqual(original);
  await page.screenshot({ path: `${evidence}/03-applied.png` });
  await editor.getByTestId("event-command-toolbar-undo").click();
  expect((await read())[0].commands).toEqual(original);
  await page.screenshot({ path: `${evidence}/04-undone.png` });
  expect(calls.some(c => c.kind === "shared-session")).toBe(true);
  expect(calls.filter(c => c.kind === "event-command-generator")).toHaveLength(1);
  // A second request stalls inside the real generator; cancellation must settle without a draft.
  writerRound = 0;
  pauseGenerator = true;
  await editor.getByTestId("event-command-quick-ai").click();
  await editor.getByTestId("ai-event-generate").click();
  await expect.poll(() => generatorPaused, { timeout: 60000 }).toBe(true);
  await editor.getByTestId("ai-event-stop").click();
  releaseGenerator?.();
  await expect(editor.getByTestId("ai-event-generate")).toBeEnabled({ timeout: 15000 });
  await expect(editor.getByTestId("ai-event-apply")).toBeDisabled();
  expect((await read())[0].commands).toEqual(original);
  await page.screenshot({ path: `${evidence}/05-cancelled.png` });
  await writeFile(`${evidence}/receipt.json`, JSON.stringify({ transport: "mocked LLM responses; real bridge/session/tools/editor", calls,
    assertions: ["shared session tool exposure", "generator reuse", "review before mutation", "other page preserved", "no duplicate chat proposal", "apply", "one-step undo", "cancel without mutation"] }, null, 2));
});
