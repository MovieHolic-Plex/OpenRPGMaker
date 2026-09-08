import { afterEach, describe, expect, it, vi } from "vitest";
import { runTool } from "@/editor/tools";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { MAX_IMAGE_DIMENSION, tileDrawSize } from "@/ai/toolImageCanvas";
import type { ReviewInput } from "@/ai/independentReview";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { independentReviewPayload, approvedReviewResponse, imageDeliveryForRequest } from "./independentReviewFixture";

afterEach(() => {
  vi.unstubAllGlobals();
});

const withMap = (id: string, w: number, h: number) => {
  const project = createBlankProject();
  const map = { ...createBlankMap(id, w, h), id };
  project.maps[id] = map;
  return { project, map };
};

describe("tileDrawSize", () => {
  // canvasDataUrl only shrinks the finished canvas, so the pre-downscale allocation is
  // what a whole-map render actually costs: 256x256 tiles at the native 32px draw size
  // is an 8192x8192 canvas (~268MB) before anything is scaled down.
  it("keeps a small region at the native draw size", () => {
    expect(tileDrawSize(24, 24, 16)).toBe(32);
  });

  it("bounds the canvas for a whole large map instead of allocating and shrinking", () => {
    const draw = tileDrawSize(256, 256, 16);
    expect(draw).toBeLessThan(32);
    expect(256 * draw).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
  });

  it("never returns a draw size below one pixel per tile", () => {
    expect(tileDrawSize(4096, 4096, 16)).toBeGreaterThanOrEqual(1);
  });
});

describe("show_map_region whole-map coverage", () => {
  // The review gate requires a rendered (0,0)-to-(w,h) union for a changed map. Tiling
  // that at 24 costs ceil(w/24) * ceil(h/24) images -- 25 for a 100x100 village -- where
  // one downscaled render carries the same coverage.
  it("returns the whole map in one call instead of clamping to 24", () => {
    const { project, map } = withMap("map_big", 60, 60);
    const result = runTool({ project }, "show_map_region", {
      mapId: map.id, x: 0, y: 0, w: map.width, h: map.height,
    });
    expect(result.ok).toBe(true);
    const data = result.data as { w: number; h: number; x: number; y: number };
    expect(data).toMatchObject({ x: 0, y: 0, w: 60, h: 60 });
    expect((result.warnings ?? []).some((w: string) => w.includes("잘랐"))).toBe(false);
  });

  it("treats an over-large request that covers the map as whole-map coverage", () => {
    const { project, map } = withMap("map_big", 60, 60);
    const result = runTool({ project }, "show_map_region", {
      mapId: map.id, x: 0, y: 0, w: 80, h: 80,
    });
    const data = result.data as { w: number; h: number };
    expect(data).toMatchObject({ w: 60, h: 60 });
  });

  // The cap still exists for its original purpose: stop the model roaming a big map in
  // arbitrary oversized slices. Only complete coverage is exempt.
  it("still clamps an oversized partial region", () => {
    const { project, map } = withMap("map_big", 60, 60);
    const result = runTool({ project }, "show_map_region", {
      mapId: map.id, x: 5, y: 5, w: 50, h: 50,
    });
    expect(result.ok).toBe(true);
    const data = result.data as { w: number; h: number };
    expect(data).toMatchObject({ w: 24, h: 24 });
    expect((result.warnings ?? []).some((w: string) => w.includes("잘랐"))).toBe(true);
  });

  it("leaves a small map untouched", () => {
    const { project, map } = withMap("map_small", 20, 15);
    const result = runTool({ project }, "show_map_region", {
      mapId: map.id, x: 0, y: 0, w: map.width, h: map.height,
    });
    const data = result.data as { w: number; h: number; lower: number[][] };
    expect(data).toMatchObject({ w: 20, h: 15 });
    expect(data.lower).toHaveLength(15);
  });
});

describe("review coverage of a map larger than the span cap", () => {
  // A 40x40 map needs ceil(40/24)^2 = 4 clipped renders to satisfy the review gate's
  // (0,0)-to-(w,h) coverage requirement. With complete coverage exempt it takes one.
  it("satisfies the coverage requirement with a single show_map_region call", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));

    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId] = { ...createBlankMap(mapId, 40, 40), id: mapId };
    const map = project.maps[mapId];
    const reviewInputs: ReviewInput[] = [];
    const shownRegions: { w: number; h: number }[] = [];
    let deliveredImages = 0;
    let writerRound = 0;

    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 10 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: null,
        tools: ["set_tileset_properties", "show_map_region"] }),
      renderImages: async () => [{ label: "whole map", dataUrl: "data:image/png;base64,AA==" }],
      chat: async (_config, request) => {
        const review = independentReviewPayload(request);
        if (review) {
          reviewInputs.push(review);
          deliveredImages = request.messages
            .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
            .filter((part) => part.type === "image_url").length;
          const response = approvedReviewResponse(request);
          if (!response) throw new Error("expected approvedReviewResponse");
          return response;
        }
        writerRound += 1;
        if (writerRound === 1) {
          const call: ChatResult = { message: { role: "assistant", content: null, tool_calls: [{ id: "columns",
            type: "function", function: { name: "set_tileset_properties", arguments: JSON.stringify({
              tilesetId: map.tilesetId, tilesPerRow: 31, reason: "inspect atlas layout" }) } }] },
            finishReason: "tool_calls" };
          return call;
        }
        if (writerRound === 2) {
          const call: ChatResult = { message: { role: "assistant", content: null, tool_calls: [{ id: "show",
            type: "function", function: { name: "show_map_region", arguments: JSON.stringify({
              mapId, x: 0, y: 0, w: map.width, h: map.height, reason: "whole-map coverage" }) } }] },
            finishReason: "tool_calls" };
          return call;
        }
        return { imageDelivery: imageDeliveryForRequest(request), message: { role: "assistant", content: "Done" }, finishReason: "stop" };
      },
    });

    const result = await session.sendUserMessage("Change the atlas to 31 columns and show the whole map", (event) => {
      if (event.type === "tool_call" && event.name === "show_map_region") {
        const data = event.result.data as { w: number; h: number };
        shownRegions.push({ w: data.w, h: data.h });
      }
    });

    // One call, uncropped: the gate's required coverage is met without tiling.
    expect(shownRegions).toEqual([{ w: 40, h: 40 }]);
    expect(deliveredImages).toBe(1);
    const requiredProblems = reviewInputs.flatMap((input) => input.requiredProblems ?? []);
    expect(requiredProblems.join("\n")).not.toContain("show_map_region");
    expect(result.review?.status, JSON.stringify(result.review)).toBe("approved");
  });
});
