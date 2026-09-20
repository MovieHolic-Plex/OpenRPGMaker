import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import type { PiAgentEvent } from "../src/ai/piAgent/protocol.ts";

// Real registry + Agent loop, scripted model, no provider calls or authored DB content.
test("Pi retries missing village dialogue and cannot report a failed look as completed", async () => {
  const ctx = { project: createEmptyToolProject("completion contract") };
  expect(runTool(ctx, "create_map", { id: "village", name: "Village", width: 50, height: 50 }).ok).toBe(true);
  const events: PiAgentEvent[] = [];
  let calls = 0;
  let castWritten = false;
  let sawRepair = false;
  const streamFn = (_model: unknown, context: {
    tools?: { name: string }[];
    messages: { role: string; content: unknown }[];
  }) => {
    calls++;
    let call: { name: string; arguments: Record<string, unknown> } | undefined;
    if (calls === 1) call = { name: "author_village", arguments: {
      target: { kind: "existing", mapId: "village" }, houseCount: 2, npcCount: 3,
      countPolicy: "exact", seed: 7, interior: false,
    } };
    const latestUser = [...context.messages].reverse().find(message => message.role === "user");
    const content = typeof latestUser?.content === "string" ? latestUser.content
      : Array.isArray(latestUser?.content) ? latestUser.content.map(part => part.text ?? "").join("") : "";
    if (content.startsWith("[마을 완료 검사]")) {
      sawRepair = true;
      expect(context.tools?.some(tool => tool.name === "author_npc_cast")).toBe(true);
      const payload = JSON.parse(content.slice(content.indexOf("\n") + 1));
      if (!castWritten && payload.pendingResidents.length) {
        castWritten = true;
        call = { name: "author_npc_cast", arguments: { mapId: "village", residents: payload.pendingResidents.map((npc: {
          eventId: string; pages: { pageId: string }[];
        }, i: number) => ({ eventId: npc.eventId, name: `주민${i}`, role: "주민", summary: "강가 마을 주민",
          pages: npc.pages.map(page => ({ pageId: page.pageId, lines: ["오늘 강물이 불었어요."] })),
        })) } };
      }
    }
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      const message = {
        role: "assistant", api: "gemini", provider: "google-antigravity", model: "scripted",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, timestamp: Date.now(),
        content: call ? [{ type: "toolCall", id: `c${calls}`, ...call }] : [{ type: "text", text: "보고" }],
        stopReason: call ? "toolUse" : "stop",
      };
      stream.push({ type: "start", partial: message } as never);
      if (call) stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: message.content[0], partial: message } as never);
      stream.push({ type: "done", reason: message.stopReason, message } as never);
    });
    return stream;
  };
  const done = await runPiAgent({ provider: "google-antigravity", task: "마을을 지어라", mapIds: ["village"],
    project: ctx.project, initialToolNames: ["author_village"], maxTurns: 8,
  }, { streamFn: streamFn as never, onEvent: event => events.push(event) });
  expect(events.some(event => event.type === "tool_end" && event.name === "author_village" && event.ok)).toBe(true);
  expect(sawRepair).toBe(true);
  expect(castWritten).toBe(true);
  expect(events.some(event => event.type === "tool_end" && event.name === "author_npc_cast" && event.ok)).toBe(true);
  expect(done.villageCompletion?.mapIds).toEqual(["village"]);
  expect(done.villageCompletion?.issues.join("\n")).not.toContain("대사 없는 페이지");
  expect(calls).toBeLessThanOrEqual(5); // First run + at most two repair rounds.
  // This small village cannot satisfy all look heuristics; dialogue repair alone is not completion.
  expect(done.villageCompletion?.issues.length).toBeGreaterThan(0);
  expect(events.some(event => event.type === "error" && event.message.startsWith("마을 미완료:"))).toBe(true);
}, 30000);
