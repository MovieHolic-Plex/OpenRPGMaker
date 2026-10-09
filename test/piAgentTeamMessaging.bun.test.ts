import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { PiTeamMessaging, teamCommunicationPrompt } from "../scripts/lib/piTeamMessaging.ts";
import { createBlankProject } from "../src/project/defaults.ts";

test("running Agent receives a teammate notification and reads the actual mailbox on its next turn", async () => {
  const mailbox = new PiTeamMessaging();
  mailbox.register("outside", "외부", "village");
  mailbox.register("inside", "실내", "inn");
  let calls = 0;
  let unsubscribeCount = 0;
  const contexts: string[] = [];
  await runPiAgent({
    provider: "google-antigravity", task: "실내 작업", project: createBlankProject(), mapIds: [],
    systemPrompt: [teamCommunicationPrompt("inside")], maxTurns: 6,
  }, {
    toolNames: [], extraTools: mailbox.tools("inside"),
    subscribeTeamMessages: notify => {
      const off = mailbox.subscribe("inside", notify);
      return () => { unsubscribeCount++; off(); };
    },
    streamFn: ((_model: unknown, context: unknown) => {
      calls++;
      contexts.push(JSON.stringify(context));
      const turn = calls;
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        // Arrives during the first model response, rather than in the original task.
        if (turn === 1) mailbox.send("outside", "inside", "여관 외부 문은 (24,18), 복귀는 (24,19)");
        const content = turn === 2
          ? [{ type: "toolCall", id: "read", name: "read_team_messages", arguments: {} }]
          : [{ type: "text", text: turn === 1 ? "시공 중" : "좌표 확인" }];
        const message = { role: "assistant", content, api: "gemini", provider: "google-antigravity", model: "scripted", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, stopReason: turn === 2 ? "toolUse" : "stop", timestamp: Date.now() };
        stream.push({ type: "start", partial: message } as never);
        if (turn === 2) stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: content[0], partial: message } as never);
        stream.push({ type: "done", reason: message.stopReason, message } as never);
      });
      return stream;
    }) as never,
  });
  expect(calls).toBe(3);
  expect(contexts[1]).toContain("팀 메시지 도착");
  expect(contexts[2]).toContain("복귀는 (24,19)");
  expect(mailbox.unread("inside")).toBe(false);
  expect(mailbox.outstanding()[0]?.acknowledged).toBe(false);
  expect(unsubscribeCount).toBe(1);
});
