// 2026-09-17 독립 검수 해체: "현재 맵 이미지가 없으면 타일셋 열 변경을 승인하지 않는다" 테스트는 삭제했다 —
// 이미지 확인 누락은 더 이상 승인 조건이 아니다. 승인은 변경 맵의 lint error 0 으로만 난다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { independentReviewPayload, imageDeliveryForRequest } from "./independentReviewFixture";

afterEach(() => {
  vi.unstubAllGlobals();
});

function toolCall(name: string, args: object, id = name): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  };
}

describe("assistant tileset visual review", () => {
  it("approves the same tileset column change once current map images are delivered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 201 })),
    );

    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const tilesetId = map.tilesetId;
    let reviewRequests = 0;
    let writerRound = 0;

    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({
        mode: "modify",
        targetMapId: null,
        tools: ["set_tileset_properties", "show_map_region"],
      }),
      renderImages: async () => [{ label: "Current map after tileset columns", dataUrl: "data:image/png;base64,AA==" }],
      chat: async (_config, request) => {
        if (independentReviewPayload(request)) {
          reviewRequests += 1;
          throw new Error("검수 모델은 더 이상 호출되지 않아야 한다");
        }
        writerRound += 1;
        if (writerRound === 1) {
          return toolCall("set_tileset_properties", {
            tilesetId,
            tilesPerRow: 31,
            reason: "inspect atlas layout",
          }, "columns");
        }
        if (writerRound === 2) {
          return toolCall("show_map_region", {
            mapId,
            x: 0,
            y: 0,
            w: map.width,
            h: map.height,
            reason: "prove current tileset render",
          }, "show");
        }
        return { imageDelivery: imageDeliveryForRequest(request), message: { role: "assistant", content: "Done" }, finishReason: "stop" };
      },
    });

    const result = await session.sendUserMessage("Change the used atlas to 31 columns and show the map");

    expect(session.getProposedProject().tilesets[tilesetId].tilesPerRow).toBe(31);
    // 결정적 검사만 돈다 — 검수 모델 호출 0, 변경 맵 lint error 0 이면 승인.
    expect(reviewRequests).toBe(0);
    expect(result.review?.status, JSON.stringify(result.review)).toBe("approved");
    expect(result.review?.summary).toContain("lint error 0건");
    expect(session.isDraftReviewApproved()).toBe(true);
    expect(session.getAuditEntries().some(entry => entry.kind === "status" && entry.text.startsWith("deterministic-review "))).toBe(true);
  });
});
