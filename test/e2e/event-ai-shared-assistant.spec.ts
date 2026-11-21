import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

import { EVENT_DOCK_ID, eventDockProject, openEventDockFixture } from "./eventAiDockFixture";
test("event button uses shared assistant, reviews locally, applies once and undoes", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const target = EVENT_DOCK_ID;
  const { mapId } = target;
  const original = [{ kind: "text", body: "기존 인사입니다." }] as const;
  const project = eventDockProject(original, { name: "안내인", secondPage: true });
  const switchId = project.switches[0].id;
  await openEventDockFixture(page, project);
  const setSwitch = { kind: "setSwitch", switchId, value: true };
  const fork = { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [setSwitch], else: [] };
  const generated = [...original, setSwitch];
  const instruction = "스위치 1번을 켜는 명령 추가";
  const calls: { tools: string[]; kind: string }[] = [];
  let writerRound = 0;
  let toolCallId = 0;
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
      expect(tools).toEqual(["event_command_assist"]);
      expect(request.messages[0].content).toContain(target.pageId);
      if (writerRound++ < 2) {
        const args = { ...target, prompt: writerRound === 1 ? instruction : "분기 명령 추가",
          mode: "append", reason: "선택한 이벤트 페이지 수정" };
        tool_calls = [{ id: `browser-event-assist-${++toolCallId}`, type: "function", function: { name: "event_command_assist", arguments: JSON.stringify(args) } }];
      } else content = "명령 초안을 만들었습니다.";
    } else if (prompt.includes("당신은 브라우저 기반 2D RPG 에디터의 이벤트 명령 편집기입니다.")) {
      kind = "event-command-generator";
      expect(prompt).toContain("뒤에 붙일 커맨드 JSON 배열");
      content = JSON.stringify([writerRound === 1 ? setSwitch : fork]);
      if (pauseGenerator) {
        generatorPaused = true;
        await new Promise<void>(resolve => { releaseGenerator = resolve; });
      }
    } else content = JSON.stringify({ mode: "modify", space: "none", facility: null, targetMapId: mapId,
      useSelection: false, clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false,
      tools: ["event_command_assist"], summary: "이벤트 페이지 스위치 명령 추가", requirements: [] });
    calls.push({ tools, kind });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      choices: [{ message: { role: "assistant", content, ...(tool_calls ? { tool_calls } : {}) }, finish_reason: tool_calls ? "tool_calls" : "stop" }],
    }) });
  });
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  await editor.getByTestId("event-command-quick-ai").click();
  await editor.getByTestId("ai-event-input").fill(instruction);
  const evidence = "output/evidence/event-ai-shared-assistant";
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/01-request.png` });
  await editor.getByTestId("ai-event-generate").click();
  await expect(editor.getByTestId("ai-event-staged")).toBeVisible({ timeout: 120_000 });
  expect(await page.getByTestId("ai-command-row-user").last().evaluate(bubble => bubble.firstChild?.textContent)).toBe(instruction);
  await expect(editor.getByTestId("ai-event-staged")).toContainText("스위치");
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
  expect(calls.filter(c => c.kind === "shared-session")).toHaveLength(1);
  expect(calls.filter(c => c.kind === "event-command-generator")).toHaveLength(1);
  // A second request stalls inside the real generator; cancellation must settle without a draft.
  writerRound = 0;
  pauseGenerator = true;
  await expect(editor.getByTestId("ai-event-input")).toBeVisible();
  await editor.getByTestId("ai-event-generate").click();
  await expect.poll(() => generatorPaused, { timeout: 60000 }).toBe(true);
  await editor.getByTestId("ai-event-stop").click();
  releaseGenerator?.();
  await expect(editor.getByTestId("ai-event-generate")).toBeEnabled({ timeout: 15000 });
  await expect(editor.getByTestId("ai-event-apply")).toBeDisabled();
  expect((await read())[0].commands).toEqual(original);
  await page.screenshot({ path: `${evidence}/05-cancelled.png` });
  await writeFile(`${evidence}/receipt.json`, JSON.stringify({ transport: "mocked LLM responses; real bridge/session/tools/editor", calls,
    assertions: ["shared session tool exposure", "single writer", "review before mutation", "original setSwitch draft without a fork", "other page preserved", "no duplicate chat proposal", "apply", "one-step undo", "cancel without mutation"] }, null, 2));
});
