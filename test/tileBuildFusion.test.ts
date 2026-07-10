// 시공 soft-confirm + 레거시 pendingBuild 융합.
// - 존재하는 미합의 그룹: build_wall soft-allow → 맵에 그려짐 + vocabSoftConfirm + requiresApproval
// - 없는 id: hard fail
// - runPendingBuilds / rebind 는 레거시 카드 교정 경로 유지

import { describe, expect, it } from "vitest";
import { AssistantSession, pendingBuildLabel } from "@/ai/assistantSession";
import {
  collectPendingBuilds,
  collectVocabSoftConfirms,
  proposalAcceptButtonLabel,
  rebindPendingBuildArgs,
  runPendingBuilds,
  markSoftVocabApprovalsOnProject,
} from "@/editor/panels/aiProposalFusion";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { isApprovedGroup, extractVocabSoftConfirm } from "@/project/tileVocabulary";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { VocabularyProposalCard } from "@/editor/tools/v3";

type ChatResult = import("@/ai/llmClient").ChatResult;

const CONFIG = { baseUrl: "x", model: "test-model", apiKey: "sk", maxToolCalls: 12, maxTokens: 8192 };
const NINE_TILES = [301, 302, 303, 331, 332, 333, 361, 362, 363];
const WOOD_WALL_GROUP_ID = `${COMBINED_TOWN_HARNESS_PREFIX}wood-wall-9slice`;

function scriptedChat(steps: readonly ChatResult[]) {
  let index = 0;
  return async (): Promise<ChatResult> => {
    if (index >= steps.length) throw new Error("scripted chat exhausted");
    return steps[index++];
  };
}

function toolCallMsg(name: string, args: unknown, id: string): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalMsg(text: string): ChatResult {
  return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
}

function contextWithMap(): ToolContext {
  const ctx: ToolContext = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "m1", name: "융합 테스트", width: 20, height: 20 });
  expect(created.ok).toBe(true);
  return ctx;
}

const PROPOSE_ITEM = { kind: "group", tileIds: NINE_TILES, name: "융합석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" };
const WALL_ARGS = { mapId: "m1", rect: { x: 3, y: 3, w: 4, h: 3 }, wallVocabId: "융합석벽" };

describe("soft-confirm construction proposals", () => {
  it("existing unapproved wall soft-allows and requires mockup approval", async () => {
    const ctx = contextWithMap();
    // Bundled harness groups are seed-approved via source:"bundled-default" (2026-07-11).
    // This test targets the soft-confirm path itself, so strip that trust from the fixture group.
    const woodWall = ctx.project.tilesets[DEFAULT_TILESET_ID].tileGroups!.find((entry) => entry.id === WOOD_WALL_GROUP_ID)!;
    woodWall.origin = undefined;
    woodWall.source = undefined;
    const wallArgs = { mapId: "m1", rect: { x: 4, y: 4, w: 5, h: 4 }, wallVocabId: WOOD_WALL_GROUP_ID };
    const chat = scriptedChat([
      toolCallMsg("build_wall", wallArgs, "c1"),
      finalMsg("이렇게 벽을 놓았습니다."),
    ]);
    const session = new AssistantSession(ctx.project, { config: CONFIG, chat });
    const turn = await session.sendUserMessage("통나무 벽을 지어줘");

    expect(turn.stoppedReason).toBe("final");
    const wall = turn.proposedCalls.find((call) => call.name === "build_wall");
    expect(wall).toBeDefined();
    expect(wall!.requiresApproval).toBe(true);
    const soft = extractVocabSoftConfirm(wall!.result.data);
    expect(soft?.groupId).toBe(WOOD_WALL_GROUP_ID);
    expect(collectVocabSoftConfirms(turn.proposedCalls)).toHaveLength(1);

    const proposed = session.getProposedProject();
    const map = proposed.maps["m1"];
    const group = proposed.tilesets[DEFAULT_TILESET_ID].tileGroups!.find((entry) => entry.id === WOOD_WALL_GROUP_ID)!;
    expect(map.lowerTiles[4 * map.width + 4]).toBe(group.tileIds[0]);
    expect(isApprovedGroup(proposed.tilesets[DEFAULT_TILESET_ID], WOOD_WALL_GROUP_ID)).toBe(false);

    markSoftVocabApprovalsOnProject(proposed, turn.proposedCalls);
    expect(isApprovedGroup(proposed.tilesets[DEFAULT_TILESET_ID], WOOD_WALL_GROUP_ID)).toBe(true);
  });

  it("missing wall id hard-fails without soft confirm", async () => {
    const ctx = contextWithMap();
    const chat = scriptedChat([
      toolCallMsg("build_wall", WALL_ARGS, "c1"),
      finalMsg("실패"),
    ]);
    const session = new AssistantSession(ctx.project, { config: CONFIG, chat });
    const turn = await session.sendUserMessage("벽");
    expect(turn.proposedCalls.find((call) => call.name === "build_wall")).toBeUndefined();
    expect(collectPendingBuilds(turn.proposedCalls)).toHaveLength(0);
    expect(collectVocabSoftConfirms(turn.proposedCalls)).toHaveLength(0);
  });

  it("accept button label is 이대로 적용", () => {
    expect(proposalAcceptButtonLabel(true, 1, 1)).toBe("이대로 적용");
    expect(proposalAcceptButtonLabel(false, 1, 1)).toBe("이대로 적용");
    expect(proposalAcceptButtonLabel(false, 1, 2)).toBe("선택 1건 적용");
  });
});

describe("runPendingBuilds (legacy fusion path)", () => {
  it("어휘 커밋된 프로젝트에 pendingBuild 실행 → lowerTiles에 9분할 벽", () => {
    const ctx = contextWithMap();
    const proposed = runTool(ctx, "propose_tile_vocabulary", { items: [PROPOSE_ITEM] });
    expect(proposed.ok).toBe(true);
    const groupId = (proposed.data as { cards: { groupId?: string }[] }).cards[0].groupId!;

    const pending = {
      tool: "build_wall",
      args: { ...WALL_ARGS, wallVocabId: groupId },
      label: pendingBuildLabel("build_wall", WALL_ARGS),
      vocabIdField: "wallVocabId",
      vocabId: groupId,
    };
    const { project, outcomes } = runPendingBuilds(ctx.project, [{ pending, args: pending.args }]);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].result.ok, outcomes[0].result.summary).toBe(true);
    const map = project.maps["m1"];
    expect(map.lowerTiles[3 * map.width + 3]).toBe(NINE_TILES[0]);
    expect(map.lowerTiles[4 * map.width + 4]).toBe(NINE_TILES[4]);
    expect(map.lowerTiles[5 * map.width + 6]).toBe(NINE_TILES[8]);
  });

  it("없는 어휘 id 시공은 실패하고 draft 오염 없음", () => {
    const ctx = contextWithMap();
    const before = structuredClone(ctx.project.maps["m1"].lowerTiles);
    const pending = { tool: "build_wall", args: WALL_ARGS, label: "벽", vocabIdField: "wallVocabId", vocabId: "융합석벽" };
    const { project, outcomes } = runPendingBuilds(ctx.project, [{ pending, args: pending.args }]);
    expect(outcomes[0].result.ok).toBe(false);
    expect(project.maps["m1"].lowerTiles).toEqual(before);
  });
});

describe("카드 교정 시 어휘 id 리바인드", () => {
  const card = (groupId: string): VocabularyProposalCard => ({
    kind: "group",
    groupId,
    tileIds: NINE_TILES,
    name: "벽",
    role: "wall",
    layerHome: "lower",
    patternDefined: true,
    facts: [],
    warnings: [],
  });

  it("원 카드 groupId와 일치하면 커밋된 카드의 groupId로 교체된다", () => {
    const pending = {
      tool: "build_wall",
      args: { mapId: "m1", rect: { x: 1, y: 1, w: 2, h: 2 }, wallVocabId: "old-id" },
      label: "벽",
      vocabIdField: "wallVocabId",
      vocabId: "old-id",
    };
    const rebound = rebindPendingBuildArgs(pending, [card("old-id")], [card("new-id")]);
    expect(rebound.wallVocabId).toBe("new-id");
  });
});
