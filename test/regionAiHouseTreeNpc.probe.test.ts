import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import { beginAssistantToolDomainTurn, computeActiveToolDomains } from "@/editor/assistantToolMode";
import { getPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { runRegionTask } from "@/editor/regionTask/runRegionTask";
import { toOpenAiTools } from "@/editor/tools";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject, TILE } from "@/project/defaults";
import { serialize } from "@/project/io";
import type { Project } from "@/project/types";
import { declaredIntent, fixedDeclarer } from "./intentFixture";

const MAP_ID = "map_probe";
const REGION = { x: 2, y: 2, width: 12, height: 10 };
const TOOLS = ["author_house", "place_props", "place_npc"];
const HOUSE = {
  kind: "single", mapId: MAP_ID, kitId: "blue-stone",
  wings: [{ x: 3, y: 3, w: 6, h: 6 }], interior: "exterior-only", door: true, yard: [],
};
const TREE = { mapId: MAP_ID, area: { x: 11, y: 3, w: 1, h: 2 }, material: "침엽수", count: 1, seed: 1 };
const NPC = { mapId: MAP_ID, x: 12, y: 10, name: "테스트주민", pages: [{ lines: ["안녕"] }] };

function makeMapProject(): Project {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: MAP_ID, name: "프로브", width: 20, height: 16 });
  expect(created.ok).toBe(true);
  context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
  context.project.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
  return context.project;
}

function expectTreeAndNpc(project: Project): void {
  const map = project.maps[MAP_ID];
  expect(map.upperTiles[3 * map.width + 11]).toBe(260);
  expect(map.lowerTiles[4 * map.width + 11]).toBe(290);
  const npc = map.events.find((event) => event.x === NPC.x && event.y === NPC.y);
  expect(npc).toBeDefined();
  const graphic = npc?.pages?.[0]?.graphic;
  expect(graphic).toBeDefined();
  expect(graphic).not.toMatchObject({ transparent: true });
  expect(map.lowerTiles.some((tile) => tile !== TILE.GRASS && tile !== 290)).toBe(true);
}

afterEach(() => getPendingRegionApply()?.discard());

describe("region AI house/tree/npc probe", () => {
  it("reports approved vocab + direct tool success for place_props/place_npc/author_house", () => {
    const ctx = { project: makeMapProject() };
    for (const [name, args] of [["author_house", HOUSE], ["place_props", TREE], ["place_npc", NPC]] as const) {
      const result = runTool(ctx, name, args);
      expect(result.ok, result.summary).toBe(true);
    }
    expectTreeAndNpc(ctx.project);
    const intent = declaredIntent({ space: "outdoor", useSelection: true, tools: TOOLS });
    beginAssistantToolDomainTurn(intent);
    const tools = toOpenAiTools(undefined, { domains: computeActiveToolDomains(intent) }).map((tool) => tool.function.name);
    for (const name of TOOLS) expect(tools).toContain(name);
  });

  it("applies a deterministic model tool transcript through the real region session", async () => {
    // Only the external model response is supplied. Intent routing, tool execution,
    // region clipping/review and pending application remain the production path.
    const project = makeMapProject();
    const before = serialize(project);
    const calls = [["author_house", HOUSE], ["place_props", TREE], ["place_npc", NPC]] as const;
    let nextCall = 0;
    const observed: string[] = [];
    const result = await runRegionTask({
      mapId: MAP_ID, region: REGION, instruction: "집과 나무 1개, npc 배치",
      onEvent: (event) => { if (event.type === "tool_call") observed.push(event.name); },
    }, {
      getProject: () => project,
      applyProject: (applied) => { Object.assign(project, applied); },
      createSession: (draft, mapId) => new AssistantSession(draft, {
        config: { authMode: "apiKey", agentMode: "chat", baseUrl: "http://model.invalid", apiKey: "test", model: "transcript", maxToolCalls: 12, maxTokens: 8192 },
        contextOptions: { currentMapId: mapId },
        declareIntent: fixedDeclarer({ mode: "modify", space: "outdoor", useSelection: true, tools: TOOLS }),
        yieldToUi: async () => {},
        chat: async (): Promise<ChatResult> => {
          const call = calls[nextCall++];
          if (!call) return { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
          return { message: { role: "assistant", content: null, tool_calls: [{
            id: `call-${nextCall}`, type: "function", function: { name: call[0], arguments: JSON.stringify(call[1]) },
          }] }, finishReason: "tool_calls" };
        },
      }),
    });
    expect(result.ok, result.error).toBe(true);
    expect(observed).toEqual(TOOLS);
    expect(result.pending).toBeDefined();
    expect(serialize(project)).toBe(before);
    result.pending?.apply();
    expectTreeAndNpc(project);
  });
});
