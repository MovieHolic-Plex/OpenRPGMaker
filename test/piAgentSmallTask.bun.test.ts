import { expect, test } from "bun:test";
import { createAssistantMessageEventStream } from "@oh-my-pi/pi-ai";
import type { StreamFn } from "@oh-my-pi/pi-agent-core";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createBlankProject } from "../src/project/defaults/blankProject.ts";

for (const delivery of ["delivered", "omitted", "same-turn"] as const) {
  test(`작은 일의 타일 칠하기는 먼저 전달된 참고문서가 필요하다 (${delivery})`, async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const tilesetId = map.tilesetId;
    const categoryId = "fixture-floor";
    const tileset = project.tilesets[tilesetId];
    project.tilesets = { [tilesetId]: { ...tileset, referenceSourceTilesetId: undefined, referenceDocuments: [{
      id: categoryId, name: "바닥", description: "바닥 칸을 고르는 자료", images: [],
      documents: [{ id: "fixture-guide", name: "바닥 안내", markdown: "시험에서는 바닥을 한 칸 비운다." }],
    }] } };
    const read = { type: "toolCall", id: "read-floor", name: "read_tileset_reference", arguments: { mapId, tilesetId, categoryId } } as const;
    const paint = { type: "toolCall", id: "paint-floor", name: "paint_tiles", arguments: {
      mapId, referencePurpose: categoryId, layer: "lower", mode: "cells", tile: -1, cells: [{ x: 1, y: 1 }],
    } } as const;
    const paintIndex = map.width + 1;
    expect(map.lowerTiles[paintIndex]).not.toBe(-1);
    let turn = 0;
    const streamFn: StreamFn = (model, context, options) => {
      const toolOutput = context.messages.flatMap(message => message.role === "toolResult"
        ? message.content.flatMap(part => part.type === "text" ? [{ type: "function_call_output", output: part.text }] : [])
        : []);
      void options?.onPayload?.({ input: delivery === "omitted" ? [] : toolOutput }, model, options.signal);
      const calls = turn++ === 0 ? (delivery === "same-turn" ? [read, paint] : [read]) : turn === 2 ? [paint] : [];
      const stopReason = calls.length ? "toolUse" : "stop";
      const content = calls.length ? calls : [{ type: "text", text: "끝" }];
      const message = { role: "assistant", content, api: model.api, provider: model.provider, model: model.id,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, stopReason, timestamp: Date.now() } as never;
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        stream.push({ type: "start", partial: message });
        stream.push({ type: "done", reason: stopReason, message });
      });
      return stream;
    };
    const done = await runPiAgent({
      provider: "openai-codex", model: "gpt-6.2-sol", task: "참고문서를 읽고 바닥 한 칸을 비워 줘",
      mapIds: [mapId], project, smallTask: { target: { kind: "map", mapId, label: "시험 맵" }, maxToolCalls: 4 },
    }, { streamFn });
    if (delivery === "delivered") {
      expect(done.stoppedEarly).toBeUndefined();
      expect(done.stats.toolCalls).toBe(2);
      expect(done.project.maps[mapId].lowerTiles[paintIndex]).toBe(-1);
    } else {
      expect(done.stoppedEarly).toContain("타일셋 참고문서 선행 읽기 필요");
      expect(done.project).toBe(project);
    }
  }, 20_000);
}
