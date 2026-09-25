// 2026-09-24 헤드리스 r0735: 20×15 맵에 author_village 가 키울 64×40 마을 밑그림을 내자 Pi set_build_spec 이
// 「맵 크기 밖」으로 통째로 throw 했다. Pi 의 밑그림은 표시용이라 경계·교차 판정은 경고로 돌려주고,
// 형식이 깨진 명세만 거부한다.
import { test } from "bun:test";
import assert from "node:assert/strict";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { createBlankProject } from "../src/project/defaults";
import { runPiAgent } from "../scripts/lib/piAgentRuntime";

async function callBuildSpec(args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const project = createBlankProject();
  const mapId = project.startMapId;
  let turn = 0;
  let seen: { text: string; isError: boolean } | undefined;
  await runPiAgent({ provider: "google-antigravity", task: "sketch", project, mapIds: [mapId], maxTurns: 3, initialToolNames: ["find_tools"] }, {
    streamFn: ((_model: unknown, ctx: { messages: any[] }) => {
      const stream = createAssistantMessageEventStream(), first = turn++ === 0;
      if (!first) {
        const result = ctx.messages.findLast(message => message.role === "toolResult");
        seen = { text: result.content.map((part: any) => part.text ?? "").join(""), isError: result.isError === true };
      }
      queueMicrotask(() => {
        const content = first
          ? [{ type: "toolCall", id: "spec", name: "set_build_spec", arguments: { mapId, ...args } }]
          : [{ type: "text", text: "done" }];
        const message: any = {
          role: "assistant", content, api: "gemini", provider: "google-antigravity", model: "scripted",
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
          stopReason: first ? "toolUse" : "stop", timestamp: Date.now(),
        };
        stream.push({ type: "start", partial: message });
        if (first) stream.push({ type: "toolcall_end", contentIndex: 0, toolCall: content[0], partial: message } as any);
        stream.push({ type: "done", reason: message.stopReason, message });
      });
      return stream;
    }) as any,
  });
  assert(seen, "set_build_spec result not observed");
  return seen;
}

test("out-of-map sketch is shown with a growth hint instead of thrown", async () => {
  const { text, isError } = await callBuildSpec({ assets: [{ id: "ground", kind: "terrain", x: 0, y: 0, w: 64, h: 40 }] });
  assert.equal(isError, false, text);
  assert.match(text, /밖입니다/);
  assert.match(text, /plannedMap/);
});

test("malformed sketch is still rejected and names the problem", async () => {
  const { text, isError } = await callBuildSpec({ assets: [] });
  assert.equal(isError, true);
  assert.match(text, /assets/);
});
