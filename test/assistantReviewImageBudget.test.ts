import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { reviewEvidenceImages, type ReviewInput } from "@/ai/independentReview";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { independentReviewPayload, approvedReviewResponse } from "./independentReviewFixture";

afterEach(() => {
  vi.unstubAllGlobals();
});

function toolCall(name: string, args: object, id = name): ChatResult {
  return { message: { role: "assistant", content: null,
    tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls" };
}

const image = (dataUrl: string, label = "render") => ({ label, dataUrl });

describe("reviewEvidenceImages", () => {
  it("ships one copy of a render captured twice", () => {
    const twice = [
      { mapId: "a", images: [image("data:image/png;base64,SAME")] },
      { mapId: "a", images: [image("data:image/png;base64,SAME")] },
    ];
    expect(reviewEvidenceImages(twice, new Set(["a"]))).toHaveLength(1);
  });

  it("keeps distinct renders of the same map", () => {
    const entries = [
      { mapId: "a", images: [image("data:image/png;base64,LEFT")] },
      { mapId: "a", images: [image("data:image/png;base64,RIGHT")] },
    ];
    expect(reviewEvidenceImages(entries, new Set(["a"]))).toHaveLength(2);
  });

  // The narrowing retry drops a map's before/after context; carrying its render anyway
  // costs the whole envelope without giving the reviewer anything to judge it against.
  it("drops renders of maps outside the reviewed set", () => {
    const entries = [
      { mapId: "changed", images: [image("data:image/png;base64,CHANGED")] },
      { mapId: "context", images: [image("data:image/png;base64,CONTEXT")] },
    ];
    const kept = reviewEvidenceImages(entries, new Set(["changed"]));
    expect(kept.map(({ dataUrl }) => dataUrl)).toEqual(["data:image/png;base64,CHANGED"]);
  });
});

describe("independent review image budget", () => {
  it("does not send the same map render twice when it was captured twice", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));

    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const reviewInputs: ReviewInput[] = [];
    let deliveredImages = 0;
    let writerRound = 0;

    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 10 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: null,
        tools: ["set_tileset_properties", "show_map_region"] }),
      // Two captures of one region, rendered identically: the same pixels are the same
      // evidence, and coveredByImages unions regions so the copy proves nothing extra.
      renderImages: async () => [image("data:image/png;base64,AA==", "current map")],
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
          return toolCall("set_tileset_properties", { tilesetId: map.tilesetId, tilesPerRow: 31,
            reason: "inspect atlas layout" }, "columns");
        }
        if (writerRound === 2 || writerRound === 3) {
          return toolCall("show_map_region", { mapId, x: 0, y: 0, w: map.width, h: map.height,
            reason: "prove current tileset render" }, `show-${writerRound}`);
        }
        return { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
      },
    });

    await session.sendUserMessage("Change the used atlas to 31 columns and show the map twice");

    expect(reviewInputs.length).toBeGreaterThan(0);
    // The envelope announces its images by label only; the parts carry the bytes.
    expect((reviewInputs.at(-1) as unknown as { imageEvidence: unknown[] }).imageEvidence).toHaveLength(1);
    expect(deliveredImages).toBe(1);
  });

  // The narrowing retry used to shed only a map's text while carrying every render, so
  // once the images were the dominant cost it could not recover and the draft died
  // unreviewed on "검수 증거가 한 번에 들어가지 않아".
  it("recovers from an oversized envelope by shedding the unchanged map's render", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));

    const project = createBlankProject();
    const targetId = project.startMapId;
    const target = project.maps[targetId];
    const changedId = "map_second";
    project.maps[changedId] = { ...createBlankMap(changedId, target.width, target.height), id: changedId };

    // Measured on this fixture: both maps' before/after text is ~79K tokens, and base64
    // chars count ~1:1, so one render lands at ~159K and two at ~239K against a 200,000
    // -token reviewer whose output reserve leaves ~183K. One fits; two cannot.
    // The writer runs on a 1M model so its own context never compacts away a capture.
    const bytes = (seed: string) => `data:image/png;base64,${seed.repeat(80_000)}`;
    const reviewInputs: ReviewInput[] = [];
    let sentLabels: string[] = [];
    let writerRound = 0;

    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 12,
        providerId: "google-antigravity", model: "gemini-2.5-flash" },
      reviewConfig: { ...defaultAiConfig(), providerId: "google-antigravity", model: "claude-opus-4-5" },
      contextOptions: { currentMapId: targetId },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: targetId,
        tools: ["set_map_properties", "show_map_region"] }),
      renderImages: async (_project, _tool, data) => {
        const mapId = (data as { data?: { mapId?: string }; mapId?: string }).data?.mapId
          ?? (data as { mapId?: string }).mapId ?? "";
        return [image(bytes(mapId === changedId ? "C" : "T"), `render ${mapId}`)];
      },
      chat: async (_config, request) => {
        const review = independentReviewPayload(request);
        if (review) {
          reviewInputs.push(review);
          sentLabels = request.messages
            .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
            .flatMap((part) => (part.type === "text" && part.text.startsWith("render ") ? [part.text] : []));
          const response = approvedReviewResponse(request);
          if (!response) throw new Error("expected approvedReviewResponse");
          return response;
        }
        writerRound += 1;
        if (writerRound === 1) {
          // The acceptance contract has to be filled in the same response as the write,
          // or the turn stops on `repair_acceptance required` before any review runs.
          return { message: { role: "assistant", content: null, tool_calls: [
            { id: "write", type: "function", function: { name: "set_map_properties", arguments: JSON.stringify({
              mapId: changedId, name: "Renamed second" }) } },
            { id: "contract", type: "function", function: { name: "repair_acceptance", arguments: JSON.stringify({
              itemId: "acceptance-contract", criteria: [{ kind: "mapDimensions",
                target: { mapId: changedId }, width: target.width, height: target.height }] }) } },
          ] }, finishReason: "tool_calls" };
        }
        if (writerRound === 2) {
          return toolCall("show_map_region", { mapId: changedId, x: 0, y: 0,
            w: target.width, h: target.height, reason: "changed map render" }, "show-changed");
        }
        if (writerRound === 3) {
          return toolCall("show_map_region", { mapId: targetId, x: 0, y: 0,
            w: target.width, h: target.height, reason: "target map render" }, "show-target");
        }
        return { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
      },
    });

    const result = await session.sendUserMessage("Rename the second map and show both maps");

    // The reviewer was actually reached: the envelope was not refused outright.
    expect(reviewInputs.length).toBeGreaterThan(0);
    expect(result.error ?? "").not.toContain("검수 증거가 한 번에");
    expect(result.stoppedReason, result.error).toBe("final");
    // Required evidence survived; only the unchanged surrounding map's render was shed.
    expect(sentLabels).toEqual([`render ${changedId}`]);
  });
});
