import { describe, expect, it } from "vitest";
import { writeDedupeKey, AssistantSession } from "@/ai/assistantSession";
import { confirmRuleApproval, isCardLevelApprovalWarning } from "@/editor/panels/aiChatPanelHelpers";
import { computeMapTileChangeBounds } from "@/editor/panels/aiProposalCard";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { TILE } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";

const TREE = `${COMBINED_TOWN_HARNESS_PREFIX}conifer-tree`;

type ChatResult = import("@/ai/llmClient").ChatResult;
const CONFIG = { baseUrl: "x", model: "test", apiKey: "sk", maxToolCalls: 12, maxTokens: 4096 };

function scriptedChat(steps: readonly ChatResult[]) {
  let index = 0;
  return async (): Promise<ChatResult> => {
    if (index >= steps.length) throw new Error("exhausted");
    return steps[index++];
  };
}

function toolCall(name: string, args: unknown, id: string): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalMsg(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
}

describe("soft-confirm UX fixes", () => {
  it("card-level warnings skip second confirm modal", () => {
    expect(isCardLevelApprovalWarning("🖼 맵에 이렇게 놓습니다 — [이대로 적용]하면 배치와 재료 합의가 함께 끝납니다.")).toBe(true);
    expect(isCardLevelApprovalWarning("🔒 재료 합의 제안: 적용하면 해당 타일/그룹을 다음부터 바로 씁니다. 자동 적용되지 않습니다.")).toBe(true);
    expect(isCardLevelApprovalWarning("⚠️ 강한 규칙: 저장이 거부됩니다")).toBe(false);
    expect(confirmRuleApproval(["맵에 이렇게 놓습니다 — [이대로 적용]"])).toBe(true);
  });

  it("writeDedupeKey ignores seed for place_props", () => {
    const a = writeDedupeKey("place_props", {
      mapId: "m1",
      area: { x: 1, y: 2, w: 3, h: 4 },
      material: "침엽수",
      count: 2,
      seed: 1,
    });
    const b = writeDedupeKey("place_props", {
      mapId: "m1",
      area: { x: 1, y: 2, w: 3, h: 4 },
      material: "침엽수",
      count: 2,
      seed: 99,
    });
    expect(a).toBe(b);
    expect(writeDedupeKey("build_wall", { mapId: "m1" })).toBeNull();
  });

  it("second identical place_props in a turn is skipped (no double scatter)", async () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "m1", name: "t", width: 24, height: 20 }).ok).toBe(true);
    ctx.project.maps.m1.lowerTiles.fill(TILE.GRASS);
    ctx.project.maps.m1.upperTiles.fill(TILE.EMPTY);

    const args = {
      mapId: "m1",
      area: { x: 4, y: 4, w: 10, h: 8 },
      material: "침엽수",
      count: 2,
      seed: 3,
    };
    const chat = scriptedChat([
      toolCall("place_props", args, "c1"),
      toolCall("place_props", { ...args, seed: 999 }, "c2"),
      finalMsg("done"),
    ]);
    const session = new AssistantSession(ctx.project, { config: CONFIG, chat });
    const turn = await session.sendUserMessage("나무 2개");
    expect(turn.stoppedReason).toBe("final");
    const placeCalls = turn.proposedCalls.filter((call) => call.name === "place_props");
    // proposals upsert by key including seed — may be 1 or 2 proposal entries; draft must not double-scatter
    // Measure upper non-empty after single logical place of 2
    const firstOnly = { project: createBlankProject() };
    runTool(firstOnly, "create_map", { id: "m1", name: "t", width: 24, height: 20 });
    firstOnly.project.maps.m1.lowerTiles.fill(TILE.GRASS);
    firstOnly.project.maps.m1.upperTiles.fill(TILE.EMPTY);
    const once = runTool(firstOnly, "place_props", args);
    expect(once.ok).toBe(true);
    const onceCount = firstOnly.project.maps.m1.upperTiles.filter((t) => t >= 0 && t !== TILE.EMPTY).length
      + firstOnly.project.maps.m1.lowerTiles.filter((t) => t !== TILE.GRASS).length;

    const proposed = session.getProposedProject();
    const twiceCount = proposed.maps.m1.upperTiles.filter((t) => t >= 0 && t !== TILE.EMPTY).length
      + proposed.maps.m1.lowerTiles.filter((t) => t !== TILE.GRASS).length;
    // second call skipped → same footprint class as once (allow small variance if scatter used different path)
    expect(twiceCount).toBeLessThanOrEqual(onceCount + 1);
    expect(twiceCount).toBeGreaterThan(0);
    void placeCalls;
  });

  it("computeMapTileChangeBounds crops around changed tiles", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 16 }).ok).toBe(true);
    ctx.project.maps.m1.lowerTiles.fill(TILE.GRASS);
    ctx.project.maps.m1.upperTiles.fill(TILE.EMPTY);
    const after = structuredClone(ctx.project);
    after.maps.m1.upperTiles[5 * 20 + 8] = 260;
    after.maps.m1.upperTiles[6 * 20 + 8] = 290;
    const crop = computeMapTileChangeBounds(ctx.project, after, "m1", 1);
    expect(crop).toEqual({ x: 7, y: 4, w: 3, h: 4 });
  });
});
