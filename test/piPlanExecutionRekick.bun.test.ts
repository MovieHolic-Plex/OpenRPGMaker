// 2026-10-02 qa:game 복수극 6판 중 2판: 실행 턴이 계획 턴의 「이번 실행은 읽기 전용 단계이므로…」를 지금 턴 얘기로 읽고
// 읽기만 한 뒤 계획을 다시 써서 끝냈다(쓰기 0건). 계획을 받은 실행 턴이 바뀐 것 없이 끝나면 런타임이 한 번만 되민다.
import { test } from "bun:test";
import assert from "node:assert/strict";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { createBlankProject } from "../src/project/defaults";
import { runPiAgent } from "../scripts/lib/piAgentRuntime";
import { withUltrabrainPlan } from "../src/ai/piAgent/plainTurn";
import { PLAN_EXECUTION_PREAMBLE, PLAN_EXECUTION_REKICK } from "../src/ai/piAgent/planExecution";

/** 매 호출의 마지막 사용자 글을 모으고, writeOnFirst 면 첫 호출에서만 제목을 바꾸는 쓰기 도구를 부른다. */
async function run(task: string, writeOnFirst = false): Promise<{ userTexts: string[]; changedKeys: readonly string[] }> {
  const project = createBlankProject();
  const userTexts: string[] = [];
  let call = 0;
  const done = await runPiAgent({ provider: "google-antigravity", task, project, mapIds: [project.startMapId], maxTurns: 8, initialToolNames: ["set_project_settings"] }, {
    streamFn: ((_model: unknown, ctx: { messages: any[] }) => {
      const stream = createAssistantMessageEventStream();
      const last = ctx.messages.at(-1);
      if (last?.role === "user") userTexts.push(last.content.map((part: any) => part.text ?? "").join(""));
      const write = writeOnFirst && call++ === 0;
      queueMicrotask(() => {
        const content = write
          ? [{ type: "toolCall", id: "w", name: "set_project_settings", arguments: { title: "잿빛 왕관의 복수" } }]
          : [{ type: "text", text: "### 실행 계획\n1. 전투 화면을 고른다\n2. 마을을 만든다" }];
        const message: any = {
          role: "assistant", content, api: "gemini", provider: "google-antigravity", model: "scripted",
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
          stopReason: write ? "toolUse" : "stop", timestamp: Date.now(),
        };
        stream.push({ type: "start", partial: message });
        if (write) stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: content[0], partial: message } as any);
        stream.push({ type: "done", reason: message.stopReason, message });
      });
      return stream;
    }) as any,
  });
  return { userTexts, changedKeys: done.changedKeys };
}

const PLAN = "이번 실행은 읽기 전용 단계이므로 프로젝트를 수정하지 않으며, 향후 제작 턴에서 진행할 항목을 정리합니다.\n1. 전투 화면";

test("계획을 받은 실행 턴 앞에 「지금은 실행 턴」을 못 박는다", () => {
  const task = withUltrabrainPlan("게임을 만들어라", PLAN);
  assert.ok(task.indexOf(PLAN_EXECUTION_PREAMBLE) < task.indexOf(PLAN), "preamble must precede the plan");
  assert.match(task, /Ultrabrain 실행 계획/);
});

test("계획을 받은 실행 턴이 쓰기 0건이면 한 번만 되민다", async () => {
  const { userTexts, changedKeys } = await run(withUltrabrainPlan("게임을 만들어라", PLAN));
  assert.equal(changedKeys.length, 0);
  assert.equal(userTexts.filter(text => text.includes(PLAN_EXECUTION_REKICK)).length, 1, JSON.stringify(userTexts));
}, 120_000);

test("계획 없는 턴(질문·짧은 수정)은 되밀지 않는다", async () => {
  const { userTexts } = await run("지금 맵이 몇 개야?");
  assert.equal(userTexts.some(text => text.includes(PLAN_EXECUTION_REKICK)), false);
}, 120_000);

test("실제로 바꾼 실행 턴은 되밀지 않는다", async () => {
  const { userTexts, changedKeys } = await run(withUltrabrainPlan("게임을 만들어라", PLAN), true);
  assert.ok(changedKeys.length > 0, "the scripted write should change the project");
  assert.equal(userTexts.some(text => text.includes(PLAN_EXECUTION_REKICK)), false);
}, 120_000);
