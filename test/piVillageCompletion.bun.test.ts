import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import type { PiAgentEvent } from "../src/ai/piAgent/protocol.ts";

// Real registry + Agent loop, scripted model, no provider calls or authored DB content.
test("Pi contract repairs dialogue in one budget without publishing partial construction", async () => {
  const ctx = { project: createEmptyToolProject("completion contract") };
  expect(runTool(ctx, "create_map", { id: "village", name: "Village", width: 50, height: 50 }).ok).toBe(true);
  const events: PiAgentEvent[] = [];
  let checkpoints = 0;
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
    villageContract: { mapId: "village", houseCount: 2, npcCount: 3, args: { target: { kind: "existing", mapId: "village" }, houseCount: 2, npcCount: 3, countPolicy: "exact" } },
    applyMode: "default", project: ctx.project, initialToolNames: ["author_village"], maxTurns: 8,
  }, { onCheckpoint: async () => { checkpoints++; }, streamFn: streamFn as never, onEvent: event => events.push(event) });
  expect(events.some(event => event.type === "tool_end" && event.name === "author_village" && event.ok)).toBe(true);
  expect(sawRepair).toBe(true);
  expect(castWritten).toBe(true);
  expect(events.some(event => event.type === "tool_end" && event.name === "author_npc_cast" && event.ok)).toBe(true);
  expect(done.villageCompletion?.mapIds).toEqual(["village"]);
  expect(done.villageCompletion?.issues.join("\n")).not.toContain("대사 없는 페이지");
  expect(calls).toBeLessThanOrEqual(5); // First run + at most two repair rounds.
  expect(done.villageCompletion?.issues).toEqual([]);
  expect(checkpoints).toBe(0);
}, 30000);

test('missing construction is incomplete and a repair with no progress stops', async () => {
  const project = createEmptyToolProject('no progress');
  let calls = 0;
  const streamFn = () => {
    calls++;
    const stream = createAssistantMessageEventStream();
    queueMicrotask(() => {
      const message = { role: 'assistant', api: 'gemini', provider: 'google-antigravity', model: 'scripted',
        content: [{ type: 'text', text: '완료했다고 주장' }], stopReason: 'stop', timestamp: Date.now(),
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 } };
      stream.push({ type: 'done', reason: 'stop', message } as never);
    }); return stream;
  };
  const done = await runPiAgent({provider:'google-antigravity',task:'마을을 지어라',project,mapIds:[],maxTurns:8,
    villageContract:{mapId:'new',houseCount:2,npcCount:0,args:{target:{kind:'new',mapId:'new',name:'마을'},houseCount:2,npcCount:0,countPolicy:'exact'}}},
    {streamFn:streamFn as never});
  expect(calls).toBe(2);
  expect(done.villageCompletion?.issues).toEqual(['요청한 마을이 시공되지 않았습니다.']);
  expect(done.changedKeys).toEqual([]);
});
