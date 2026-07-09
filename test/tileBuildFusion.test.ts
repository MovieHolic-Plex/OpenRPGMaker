// 승인+시공 융합 T3 (2026-07-07 타일 시공 흐름 재설계 §2.1.3).
// - v3 프리미티브가 "미승인 어휘"로 실패하면 그 호출이 어휘 제안 카드에 pendingBuild로 첨부된다.
// - 수락 한 번(runPendingBuilds)으로 lowerTiles에 벽이 실제로 칠해진다 — 모델 재호출 없음.
// - 카드 교정으로 그룹 id가 바뀌면 pendingBuild의 어휘 id 인자가 리바인드된다.

import { describe, expect, it } from "vitest";
import { AssistantSession, pendingBuildLabel } from "@/ai/assistantSession";
import {
  collectPendingBuilds,
  proposalAcceptButtonLabel,
  rebindPendingBuildArgs,
  runPendingBuilds,
} from "@/editor/panels/aiChatPanel";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
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

describe("T3 — 미승인 실패가 pendingBuild로 어휘 제안 카드에 첨부된다", () => {
  it("build_wall(미승인 거부) → propose 제안 카드에 pendingBuild {tool,args,label} 첨부", async () => {
    const ctx = contextWithMap();
    const chat = scriptedChat([
      toolCallMsg("build_wall", WALL_ARGS, "c1"), // 미승인 → unapproved-vocabulary 거부
      toolCallMsg("propose_tile_vocabulary", { items: [PROPOSE_ITEM] }, "c2"),
      finalMsg("어휘 승인이 필요합니다."),
    ]);
    const session = new AssistantSession(ctx.project, { config: CONFIG, chat });
    const turn = await session.sendUserMessage("벽 깔아줘");

    expect(turn.stoppedReason).toBe("final");
    const propose = turn.proposedCalls.find((call) => call.name === "propose_tile_vocabulary");
    expect(propose).toBeDefined();
    const pendings = propose!.pendingBuilds ?? [];
    expect(pendings).toHaveLength(1);
    expect(pendings[0].tool).toBe("build_wall");
    expect(pendings[0].vocabIdField).toBe("wallVocabId");
    expect(pendings[0].label).toBe("벽 (3,3) 4×3");
    expect(pendings[0].args).toMatchObject(WALL_ARGS);
    // 카드 수락 UI: 보류 시공이 있으면 버튼 라벨이 "승인하고 시공".
    expect(proposalAcceptButtonLabel(true, 1, 1)).toBe("승인하고 시공");
    expect(proposalAcceptButtonLabel(false, 1, 1)).toBe("수락해서 적용");
    expect(collectPendingBuilds(turn.proposedCalls)).toHaveLength(1);
  });

  it("실측: wood-wall 9slice 기존 그룹 재제안의 부분 tileIds를 무시하고 보류 build_wall이 카드에 묶인다", async () => {
    const ctx = contextWithMap();
    const group = ctx.project.tilesets[DEFAULT_TILESET_ID].tileGroups!.find((entry) => entry.id === WOOD_WALL_GROUP_ID)!;
    const originalTileIds = [...group.tileIds];
    const wallArgs = { mapId: "m1", rect: { x: 4, y: 4, w: 5, h: 4 }, wallVocabId: WOOD_WALL_GROUP_ID };
    const chat = scriptedChat([
      toolCallMsg("build_wall", wallArgs, "c1"),
      toolCallMsg("propose_tile_vocabulary", {
        items: [{
          kind: "group",
          groupId: WOOD_WALL_GROUP_ID,
          tileIds: originalTileIds.slice(0, 5),
          name: "통나무 벽",
          role: "wall",
          patternKind: "nine_slice_expandable",
          layerHome: "lower",
        }],
      }, "c2"),
      finalMsg("어휘 승인이 필요합니다."),
    ]);
    const session = new AssistantSession(ctx.project, { config: CONFIG, chat });
    const turn = await session.sendUserMessage("통나무 벽을 지어줘");

    const propose = turn.proposedCalls.find((call) => call.name === "propose_tile_vocabulary");
    expect(propose).toBeDefined();
    expect(propose!.result.diff?.warnings.some((warning) => warning.includes("기존 그룹 타일 구성을 유지했습니다"))).toBe(true);
    expect((propose!.result.data as { cards: { tileIds: number[] }[] }).cards[0].tileIds).toEqual(originalTileIds);
    const pendings = propose!.pendingBuilds ?? [];
    expect(pendings).toHaveLength(1);
    expect(pendings[0].tool).toBe("build_wall");
    expect(pendings[0].args).toMatchObject(wallArgs);

    const proposed = session.getProposedProject();
    expect(proposed.tilesets[DEFAULT_TILESET_ID].tileGroups!.find((entry) => entry.id === WOOD_WALL_GROUP_ID)!.tileIds).toEqual(originalTileIds);
    const fused = runPendingBuilds(proposed, [{ pending: pendings[0], args: pendings[0].args }]);
    expect(fused.outcomes[0].result.ok, fused.outcomes[0].result.summary).toBe(true);
    const map = fused.project.maps["m1"];
    expect(map.lowerTiles[4 * map.width + 4]).toBe(originalTileIds[0]);
    expect(map.lowerTiles[5 * map.width + 5]).toBe(originalTileIds[4]);
    expect(map.lowerTiles[7 * map.width + 8]).toBe(originalTileIds[8]);
  });

  it("어휘 제안이 없는 턴이면 pendingBuild를 첨부할 카드가 없다(버려짐)", async () => {
    const ctx = contextWithMap();
    const chat = scriptedChat([toolCallMsg("build_wall", WALL_ARGS, "c1"), finalMsg("실패")]);
    const session = new AssistantSession(ctx.project, { config: CONFIG, chat });
    const turn = await session.sendUserMessage("벽");
    expect(collectPendingBuilds(turn.proposedCalls)).toHaveLength(0);
  });
});

describe("T3 — 수락 한 번으로 벽이 실제로 칠해진다 (runPendingBuilds)", () => {
  it("어휘 커밋된 프로젝트에 pendingBuild 실행 → lowerTiles에 9분할 벽", () => {
    const ctx = contextWithMap();
    // 수락 시 커밋되는 상태 재현: propose 실행(승인 마킹 + 파츠 자동 생성).
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
    expect(map.lowerTiles[3 * map.width + 3]).toBe(NINE_TILES[0]); // topLeft
    expect(map.lowerTiles[4 * map.width + 4]).toBe(NINE_TILES[4]); // center
    expect(map.lowerTiles[5 * map.width + 6]).toBe(NINE_TILES[8]); // bottomRight
  });

  it("시공 실패는 draft가 폐기되어 프로젝트가 오염되지 않는다(사유는 outcome에 남는다)", () => {
    const ctx = contextWithMap();
    const before = structuredClone(ctx.project.maps["m1"].lowerTiles);
    const pending = { tool: "build_wall", args: WALL_ARGS, label: "벽", vocabIdField: "wallVocabId", vocabId: "융합석벽" };
    // 어휘 미승인 상태 그대로 실행 → 거부.
    const { project, outcomes } = runPendingBuilds(ctx.project, [{ pending, args: pending.args }]);
    expect(outcomes[0].result.ok).toBe(false);
    expect(project.maps["m1"].lowerTiles).toEqual(before);
  });
});

describe("T3 — 카드 교정 시 어휘 id 리바인드", () => {
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
    const pending = { tool: "build_wall", args: WALL_ARGS, label: "벽", vocabIdField: "wallVocabId", vocabId: "융합석벽" };
    const rebound = rebindPendingBuildArgs(pending, [card("융합석벽")], [card("돌담-벽")]);
    expect(rebound.wallVocabId).toBe("돌담-벽");
  });

  it("모델이 엉뚱한 id를 썼어도 단일 그룹 제안이면 그 그룹으로 리바인드된다", () => {
    const pending = { tool: "build_wall", args: { ...WALL_ARGS, wallVocabId: "흰-벽-2" }, label: "벽", vocabIdField: "wallVocabId", vocabId: "흰-벽-2" };
    const rebound = rebindPendingBuildArgs(pending, [card("석벽")], [card("석벽")]);
    expect(rebound.wallVocabId).toBe("석벽");
  });
});
