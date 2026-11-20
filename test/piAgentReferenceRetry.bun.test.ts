import { expect, test } from "bun:test";
import { OPENAI_COMPAT_IMAGE_OMITTED_NOTE, registerOpenAiCompatEndpoints } from "../scripts/lib/openAiCompatModel.ts";
import { runPiAgent } from "../scripts/lib/piAgentRuntime.ts";
import { createBlankProject } from "../src/project/defaults/blankProject.ts";

const REFERENCE_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jgT8AAAAASUVORK5CYII=";

function reply(delta: object, finishReason: "stop" | "tool_calls"): Response {
  const chunks = [{ delta: { role: "assistant", ...delta }, finish_reason: null }, { delta: {}, finish_reason: finishReason }];
  const body = chunks.map(choice => `data: ${JSON.stringify({ id: "chatcmpl-fixture", choices: [{ index: 0, ...choice }] })}\n\n`).join("");
  return new Response(`${body}data: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });
}

function toolReply(name: string, args: object): Response {
  return reply({ tool_calls: [{ index: 0, id: `call_${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] }, "tool_calls");
}

for (const smallTask of [false, true]) {
  for (const retryWithoutImage of [false, true]) {
    test(`${smallTask ? "작은 일" : "일반 조수"}: 참고 그림 영수증 (${retryWithoutImage ? "이미지 없는 재시도" : "첫 응답 성공"})`, async () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      const tilesetId = map.tilesetId;
      const categoryId = "fixture-floor";
      const paintIndex = map.width + 1;
      const originalTile = map.lowerTiles[paintIndex];
      expect(originalTile).not.toBe(-1);
      project.tilesets = { [tilesetId]: { ...project.tilesets[tilesetId], referenceSourceTilesetId: undefined, referenceDocuments: [{
        id: categoryId, name: "바닥", description: "바닥 칸을 고르는 자료",
        documents: [{ id: "floor-guide", name: "바닥 안내", markdown: "시험에서는 바닥을 한 칸 비운다." }],
        images: [{ id: "floor-image", name: "바닥 그림", caption: "바닥 예시", dataUrl: REFERENCE_IMAGE }],
      }] } };
      const provider = "openai-compat:reference-retry-fixture";
      const bodies: string[] = [];
      const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
        const body = await request.text();
        bodies.push(body);
        if (bodies.length === 1) return toolReply("read_tileset_reference", { mapId, tilesetId, categoryId });
        if (bodies.length === 2 && retryWithoutImage) return reply({ content: null }, "stop");
        if (bodies.length === (retryWithoutImage ? 3 : 2)) return toolReply("paint_tiles", {
          mapId, referencePurpose: categoryId, layer: "lower", mode: "cells", tile: -1, cells: [{ x: 1, y: 1 }],
        });
        return reply({ content: "끝" }, "stop");
      } });
      registerOpenAiCompatEndpoints({ [provider]: {
        id: provider, name: "Reference retry fixture", baseUrl: `http://127.0.0.1:${server.port}/v1`,
        headers: {}, keyless: true, reasoningMode: "none", allowModels: [], blockModels: [], supportsImages: true,
        maxOutputTokens: 1024, contextWindow: 128_000, firstTokenTimeoutSec: 5,
      } });
      const paintFailures: string[] = [];
      try {
        const done = await runPiAgent({
          provider, model: "fixture-model", task: "참고문서를 읽고 바닥 한 칸을 비워 줘", mapIds: [mapId], project,
          initialToolNames: ["read_tileset_reference", "paint_tiles"],
          ...(smallTask ? { smallTask: { target: { kind: "map", mapId, label: "시험 맵" }, maxToolCalls: 4 } } : {}),
        }, { apiKey: "oprn-no-key", onToolCall: ({ name, result }) => {
          if (name === "paint_tiles" && !result.ok) paintFailures.push(result.summary);
        } });
        expect(bodies[1]).toContain(REFERENCE_IMAGE);
        expect(done.stats.toolCalls).toBe(2);
        if (retryWithoutImage) {
          expect(bodies[2]).toContain(OPENAI_COMPAT_IMAGE_OMITTED_NOTE);
          expect(bodies[2]).not.toContain(REFERENCE_IMAGE);
          const refusal = smallTask ? done.stoppedEarly : paintFailures[0];
          expect(refusal).toContain("타일셋 참고문서 선행 읽기 필요 (1건)");
          expect(refusal).toContain("floor-image");
          expect(done.project.maps[mapId].lowerTiles[paintIndex]).toBe(originalTile);
        } else {
          expect(done.stats.toolErrors).toBe(0);
          expect(done.project.maps[mapId].lowerTiles[paintIndex]).toBe(-1);
        }
      } finally {
        await server.stop(true);
      }
    }, 20_000);
  }
}
