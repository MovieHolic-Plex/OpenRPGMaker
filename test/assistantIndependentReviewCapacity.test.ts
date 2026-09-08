import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ReviewInput } from "@/ai/independentReview";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { approvedReviewResponse, independentReviewPayload } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";

describe("R5+R6 review capacity through AssistantSession", () => {
  it.each(["rename", "preset"])("delivers scoped complete review evidence for %s with five unchanged preset maps", async mode => {
    const project = createBlankProject();
    const presets = Array.from({ length: 5 }, (_, i) => ({ id: `preset_${i}`, name: `Preset ${i}`,
      startMapId: `map_${i}`, startPos: { x: 1, y: 2 }, gold: 100 + i }));
    project.testPresets = presets;
    for (const preset of presets) project.maps[preset.startMapId] = {
      ...createBlankMap(preset.startMapId, 256, 256), id: preset.startMapId,
    };
    const reviews: ReviewInput[] = [];
    let writerCalls = 0;
    const tool = mode === "rename" ? "set_map_properties" : "upsert_test_preset";
    const args = mode === "rename" ? { mapId: project.startMapId, name: "Renamed target" }
      : { preset: { ...project.testPresets[0], gold: 999 } };
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 6 },
      contextOptions: { currentMapId: project.startMapId },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: mode === "rename" ? project.startMapId : null, tools: [tool] }),
      chat: async (_config, request): Promise<ChatResult> => {
        const review = independentReviewPayload(request);
        const response = approvedReviewResponse(request);
        if (review && response) { reviews.push(review); return response; }
        writerCalls++;
        const toolCalls = [{ id: "write", type: "function" as const, function: { name: tool, arguments: JSON.stringify(args) } }];
        if (mode === "rename") toolCalls.push({ id: "contract", type: "function", function: { name: "repair_acceptance", arguments: JSON.stringify({
            itemId: "acceptance-contract", criteria: [{ kind: "mapDimensions", target: { mapId: project.startMapId }, width: 20, height: 15 }],
        }) } });
        return writerCalls === 1 ? { message: { role: "assistant", content: null, tool_calls: toolCalls }, finishReason: "tool_calls" }
          : { message: { role: "assistant", content: "Finished" }, finishReason: "stop" };
      },
    });
    const result = await session.sendUserMessage(mode === "rename" ? "Rename the current map" : "Set preset_0 gold to 999",
      () => {}, AbortSignal.timeout(60000));
    expect(result.review?.status, JSON.stringify(result.review)).toBe("approved");
    expect(result.stoppedReason, result.error).toBe("final");
    expect(reviews).toHaveLength(1);
    const delivered = reviews[0];
    if (!delivered) throw new Error("Review was not invoked");
    expect(delivered.changes.map(change => change.path)).toEqual(mode === "rename" ? ["/maps/map_blank_start"] : ["/testPresets"]);
    for (const side of ["before", "after"] as const) {
      const entries = delivered[side].flatMap(context => context.entries);
      expect(entries.filter(entry => /^\/maps\/[^/]+$/.test(entry.id)).map(entry => entry.id).sort())
        .toEqual(mode === "rename" ? ["/maps/map_blank_start"] : ["/maps/map_0", "/maps/map_blank_start"]);
      expect(entries).toContainEqual({ id: "/session", value: project.session });
      expect(entries).toContainEqual({ id: "/testPresets", value: side === "after" ? session.getProposedProject().testPresets : project.testPresets });
      if (mode === "preset") expect(entries.find(entry => entry.id === "/maps/map_0/tiles")?.value)
        .toEqual({ width: 256, height: 256, lowerTiles: project.maps.map_0?.lowerTiles, upperTiles: project.maps.map_0?.upperTiles });
    }
    expect(project.testPresets[0]?.gold).toBe(100);
    expect(session.isDraftReviewApproved()).toBe(true);
  });
});
