import { test } from "bun:test";
import assert from "node:assert/strict";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import { createBlankProject } from "../src/project/defaults";
import { runPiAgent } from "../scripts/lib/piAgentRuntime";
import { requestPiRender, resolvePiRender } from "../scripts/lib/piRenderBroker";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=";

test("map image reaches the next model call in read-only mode", async () => {
  const project = createBlankProject();
  const mapId = Object.keys(project.maps)[0]!;
  let turn = 0, consumed = false;
  const done = await runPiAgent({
    provider: "google-antigravity", task: "Inspect map", project, mapIds: [mapId],
    readOnly: true, maxTurns: 3, initialToolNames: ["show_map_region"],
  }, {
    renderToolImage: async (draft, name, data) => {
      assert.equal(name, "show_map_region");
      assert.equal((data as { mapId: string }).mapId, mapId);
      assert.deepEqual(draft.maps, project.maps);
      return png;
    },
    streamFn: ((_model: unknown, ctx: { messages: any[] }) => {
      const stream = createAssistantMessageEventStream(), first = turn++ === 0;
      if (!first) {
        const result = ctx.messages.findLast(message => message.role === "toolResult");
        assert(result.content.some((part: any) => part.type === "image" && part.data === png));
        consumed = true;
      }
      queueMicrotask(() => {
        const content = first
          ? [{ type: "toolCall", id: "map", name: "show_map_region", arguments: { mapId, x: 0, y: 0, w: 16, h: 13 } }]
          : [{ type: "text", text: "image consumed" }];
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
  assert(consumed);
  assert.equal(done.stats.toolErrors, 0);
});

test("render replies are isolated, single-use and retired on cancellation/timeout", async () => {
  const base = createBlankProject(), draft = structuredClone(base), mapId = Object.keys(draft.maps)[0]!;
  draft.maps[mapId]!.lowerTiles[0] = 123;
  const events: any[] = [], controller = new AbortController();
  const first = requestPiRender(draft, base, "show_map_region", {}, e => events.push(e), controller.signal);
  const second = requestPiRender(base, base, "show_map_region", {}, e => events.push(e), controller.signal);
  assert.notEqual(events[0].renderId, events[1].renderId);
  assert.equal(events[0].project.maps[mapId].lowerTiles[0], 123);
  assert(!resolvePiRender({ renderId: events[0].renderId, png: "bad" }));
  assert(resolvePiRender({ renderId: events[0].renderId, png }));
  assert.equal(await first, png);
  assert(!resolvePiRender({ renderId: events[0].renderId, png }));
  controller.abort();
  await assert.rejects(second);
  assert(!resolvePiRender({ renderId: events[1].renderId, png }));
  let expiredId = "";
  await assert.rejects(requestPiRender(base, base, "show_map_region", {}, e => {
    if (e.type === "render_request") expiredId = e.renderId;
  }, new AbortController().signal, 10));
  assert(!resolvePiRender({ renderId: expiredId, png }));
});
