import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ToolImageRenderer } from "@/ai/assistantSession";
import { requiresVisualReview, type ReviewInput } from "@/ai/independentReview";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { independentReviewPayload } from "./independentReviewFixture";
import { installFakeDom } from "./fakeDom";

afterEach(() => vi.unstubAllGlobals());

function call(name: string, args: object): ChatResult {
  return { message: { role: "assistant", content: null, tool_calls: [{ id: name, type: "function",
    function: { name, arguments: JSON.stringify(args) } }] }, finishReason: "tool_calls" };
}

describe("background review evidence", () => {
  it("reports the real tile-only surface as unavailable instead of fabricating background evidence", async () => {
    const restore = installFakeDom();
    try {
      // This surface uses onerror properties; fakeDom's Image only dispatches listeners.
      vi.stubGlobal("Image", class {
        onerror: (() => void) | null = null;
        set src(_value: string) { this.onerror?.(); }
      });
      const project = createBlankProject(), map = project.maps[project.startMapId];
      map.background = { imageId: "missing-resource", scrollX: 4 };
      await expect(renderToolImages(project, "show_map_region", {
        mapId: map.id, x: 0, y: 0, w: 1, h: 1, lower: [[-1]], upper: [[-1]],
      })).rejects.toThrow("map-background-rendering-unavailable");
    } finally { vi.unstubAllGlobals(); restore(); }
  });

  it.each(["none", "tile-image", "unavailable"])("rejects fake approval with ordinary targetChange acceptance and %s evidence", async mode => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    const project = createBlankProject(), mapId = project.startMapId;
    const reviews: ReviewInput[] = [];
    const renderImages: ToolImageRenderer | undefined = mode === "none" ? undefined
      : mode === "unavailable" ? renderToolImages
      : async () => [{ label: "Tile-only surface", dataUrl: "data:image/png;base64,AA==" }];
    const rounds = [call("set_work_plan", { goal: "Set background", layers: [{ title: "Background", items: [{
      title: "Background", instruction: "Set background" }] }], acceptance: [{ id: "change", title: "Changed target", criteria: [{
      kind: "targetChange", target: { mapId } }] }] }), call("skip_work_item", {}),
    call("set_map_properties", { mapId, background: { imageId: "new-background", scrollX: 4 } }),
    call("show_map_region", { mapId, x: 0, y: 0, w: 20, h: 15 })];
    let writerCalls = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 15 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: mapId, tools: ["set_map_properties"] }),
      renderImages,
      chat: async (_config, request) => {
        const input = independentReviewPayload(request);
        if (input) {
          reviews.push(input);
          return { message: { role: "assistant", content: JSON.stringify({ revision: input.revision,
            verdict: "approved", summary: "Background approved", findings: [] }) }, finishReason: "stop" };
        }
        return rounds[writerCalls++] ?? { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
      },
    });
    const result = await session.sendUserMessage("Set the map background");
    expect(session.getProposedProject().maps[mapId]?.background).toEqual({ imageId: "new-background", scrollX: 4 });
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews[0]?.acceptance).toMatchObject({ items: [{ status: "verified" }] });
    expect(result.review?.status).toBe("changes_requested");
    expect(session.isDraftReviewApproved()).toBe(false);
    expect(reviews[0]?.requiredProblems).toEqual(expect.arrayContaining([expect.stringContaining("map-background-rendering-unavailable")]));
  });

  it.each(["image", "scroll", "remove"])("classifies %s background changes as visual and permanently retires old evidence", mutation => {
    const project = createBlankProject(), map = project.maps[project.startMapId];
    map.background = { imageId: "old-background", scrollX: 0 };
    const before = structuredClone(project), evidence = new AssistantImageEvidence();
    const receipt = evidence.capture(project, { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height });
    if (!receipt) throw new Error("Missing receipt");
    evidence.deliver([receipt]);
    if (mutation === "image") map.background.imageId = "new-background";
    else if (mutation === "scroll") map.background.scrollX = 4;
    else delete map.background;
    expect(requiresVisualReview(before.maps[map.id], map)).toBe(true);
    expect(evidence.current(project)).toEqual([]);
    expect(evidence.current(before)).toEqual([]);
  });

  it("classifies map tile size and legacy event sprites, but exempts dialogue and metadata edits", () => {
    const project = createBlankProject(), before = project.maps[project.startMapId];
    before.events.push({ id: "npc", x: 1, y: 1, trigger: { kind: "action" }, commands: [] });
    const after = structuredClone(before);
    after.name = "Renamed map";
    after.events[0].commands = [{ kind: "text", body: "Changed dialogue" }];
    expect(requiresVisualReview(before, after)).toBe(false);
    after.tileSize += 1;
    expect(requiresVisualReview(before, after)).toBe(true);
    after.tileSize = before.tileSize;
    after.events[0].sprite = { type: "builtin", id: "replacement" };
    expect(requiresVisualReview(before, after)).toBe(true);
  });
});
