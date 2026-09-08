import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import type { ReviewInput } from "@/ai/independentReview";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { independentReviewPayload, approvedReviewResponse, imageDeliveryForRequest } from "./independentReviewFixture";

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
  it("does not approve a used tileset column change without current map images", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 201 })),
    );

    const project = createBlankProject();
    const mapId = project.startMapId;
    const tilesetId = project.maps[mapId].tilesetId;
    const reviewInputs: ReviewInput[] = [];
    let writerRound = 0;

    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({
        mode: "modify",
        targetMapId: null,
        tools: ["set_tileset_properties"],
      }),
      chat: async (_config, request) => {
        const review = independentReviewPayload(request);
        if (review) {
          reviewInputs.push(review);
          const response = approvedReviewResponse(request);
          expect(response).not.toBeNull();
          if (!response) {
            throw new Error("expected approvedReviewResponse");
          }
          return response;
        }
        writerRound += 1;
        if (writerRound === 1) {
          return toolCall("set_tileset_properties", {
            tilesetId,
            tilesPerRow: 31,
            reason: "inspect atlas layout",
          }, "columns");
        }
        const done: ChatResult = {
          message: { role: "assistant", content: "Done" },
          finishReason: "stop",
        };
        return done;
      },
    });

    const result = await session.sendUserMessage("Change the used atlas to31columns");

    expect(session.getProposedProject().tilesets[tilesetId].tilesPerRow).toBe(31);
    expect(reviewInputs.length).toBeGreaterThan(0);
    const requiredProblems = reviewInputs.flatMap((input) => input.requiredProblems ?? []);
    expect(requiredProblems.join("\n")).toContain("show_map_region");
    expect(requiredProblems.join("\n")).toContain(mapId);
    expect(result.review?.status).not.toBe("approved");
    expect(session.isDraftReviewApproved()).toBe(false);
  });

  it("approves the same tileset column change once current map images are delivered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 201 })),
    );

    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const tilesetId = map.tilesetId;
    const reviewInputs: ReviewInput[] = [];
    let writerRound = 0;
    let deliveredImages = 0;

    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({
        mode: "modify",
        targetMapId: null,
        tools: ["set_tileset_properties", "show_map_region"],
      }),
      renderImages: async () => [{ label: "Current map after tileset columns", dataUrl: "data:image/png;base64,AA==" }],
      chat: async (_config, request) => {
        const review = independentReviewPayload(request);
        if (review) {
          reviewInputs.push(review);
          deliveredImages = request.messages
            .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
            .filter((part) => part.type === "image_url").length;
          const response = approvedReviewResponse(request);
          expect(response).not.toBeNull();
          if (!response) throw new Error("expected approvedReviewResponse");
          return response;
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
    expect(reviewInputs.length).toBeGreaterThan(0);
    const requiredProblems = reviewInputs.flatMap((input) => input.requiredProblems ?? []);
    expect(requiredProblems.join("\n")).not.toContain("show_map_region");
    expect(deliveredImages).toBeGreaterThan(0);
    expect(result.review?.status).toBe("approved");
    expect(session.isDraftReviewApproved()).toBe(true);
  });
});
