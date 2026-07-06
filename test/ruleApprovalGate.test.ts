import { describe, expect, it } from "vitest";
import {
  AssistantSession,
  proposalApprovalWarnings,
  proposalNeedsExplicitApproval,
  ruleToolRejectionText,
  type ProposedCall,
} from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { ChatResult } from "@/ai/llmClient";
import type { Project, TileGroupMetadata } from "@/project/types";

const CONFIG = { baseUrl: "x", model: "google/gemini-3.1-flash-lite", apiKey: "sk", maxToolCalls: 4, maxTokens: 1024 };

function scriptedChat(steps: readonly ChatResult[]) {
  let index = 0;
  return async (): Promise<ChatResult> => {
    if (index >= steps.length) throw new Error("scripted chat exhausted");
    return steps[index++];
  };
}

function toolCallMsg(name: string, args: unknown, id = `c_${name}`): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalMsg(text: string): ChatResult {
  return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
}

function projectWithGroup(): Project {
  const project = createBlankProject();
  project.tilesets[DEFAULT_TILESET_ID].tileGroups = [ruleGroup()];
  return project;
}

function ruleGroup(): TileGroupMetadata {
  return {
    defaultLayer: "lower",
    description: "규칙 승인 테스트",
    id: "approval-main",
    name: "승인 규칙",
    placementRules: "규칙 승인 테스트",
    role: "building",
    tileIds: [260, 290],
  };
}

function setClusterRuleArgs(strength: "hard" | "medium" | "soft") {
  return {
    groupId: "approval-main",
    rule: { id: `count-${strength}`, kind: "count", params: { max: 999, perMap: true }, strength },
    tilesetId: DEFAULT_TILESET_ID,
  };
}

async function proposedCall(
  name: string,
  argsForProject: (project: Project) => unknown,
  userMessage: string | ((project: Project) => string) = "규칙을 제안해줘"
): Promise<ProposedCall> {
  const project = projectWithGroup();
  const message = typeof userMessage === "function" ? userMessage(project) : userMessage;
  const session = new AssistantSession(project, {
    chat: scriptedChat([toolCallMsg(name, argsForProject(project)), finalMsg("제안했습니다.")]),
    config: CONFIG,
  });
  const result = await session.sendUserMessage(message);
  expect(result.proposedCalls).toHaveLength(1);
  return result.proposedCalls[0];
}

describe("rule approval gate", () => {
  it("hard set_cluster_rule proposals require approval and show a warning", async () => {
    const call = await proposedCall("set_cluster_rule", () => setClusterRuleArgs("hard"));

    expect(call.requiresApproval).toBe(true);
    expect(call.approvalWarning).toContain("강한 규칙");
  });

  it("rule write tools always require approval without a warning unless the cluster rule is hard", async () => {
    const medium = await proposedCall("set_cluster_rule", () => setClusterRuleArgs("medium"));
    const soft = await proposedCall("set_cluster_rule", () => setClusterRuleArgs("soft"));
    const junction = await proposedCall("set_group_junction", () => ({
      groupId: "approval-main",
      junction: { action: "omit", side: "below", withRole: "wall" },
      tilesetId: DEFAULT_TILESET_ID,
    }));
    const overlay = await proposedCall("set_group_overlay", () => ({
      groupId: "approval-main",
      overlay: { tileIds: [1], when: "eaveEnd" },
      tilesetId: DEFAULT_TILESET_ID,
    }));

    expect([medium, soft, junction, overlay].map((call) => call.requiresApproval)).toEqual([true, true, true, true]);
    expect([medium, soft, junction, overlay].map((call) => call.approvalWarning)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("ordinary write proposals do not require explicit approval", async () => {
    const call = await proposedCall("paint_tiles", (project) => ({
      cells: [{ x: 1, y: 1 }],
      layer: "lower",
      mapId: project.startMapId,
      mode: "cells",
      tile: 1,
    }), (project) => `일반 페인트를 제안해줘\n\n[컨텍스트] 현재 맵: 테스트 (${project.startMapId}) · 사용자 선택 영역: (1,1) 1×1`);

    expect(call.requiresApproval).toBeFalsy();
  });

  it("proposal approval helpers detect required approval and dedupe warnings", () => {
    const warning = "강한 규칙 경고";
    const calls: ProposedCall[] = [
      { args: {}, destructive: false, name: "paint_tiles", result: { ok: true, summary: "" }, summary: "" },
      { approvalWarning: warning, args: {}, destructive: false, name: "set_cluster_rule", requiresApproval: true, result: { ok: true, summary: "" }, summary: "" },
      { approvalWarning: warning, args: {}, destructive: false, name: "set_cluster_rule", requiresApproval: true, result: { ok: true, summary: "" }, summary: "" },
    ];

    expect(proposalNeedsExplicitApproval([])).toBe(false);
    expect(proposalNeedsExplicitApproval([calls[0]])).toBe(false);
    expect(proposalNeedsExplicitApproval(calls)).toBe(true);
    expect(proposalApprovalWarnings([])).toEqual([]);
    expect(proposalApprovalWarnings(calls)).toEqual([warning]);
  });

  it("rule rejection text exposes violation count and sample coordinates", () => {
    const text = ruleToolRejectionText("set_cluster_rule", {
      ok: false,
      summary: "커밋 거부",
      issues: [
        { code: "cluster-rule:count", mapId: "map_ember_village", message: "위반", severity: "error", x: 31, y: 25 },
        { code: "cluster-rule:count", mapId: "map_ember_village", message: "위반", severity: "error", x: 32, y: 25 },
        { code: "cluster-rule:count", mapId: "map_ember_village", message: "위반", severity: "error", x: 33, y: 25 },
      ],
    });

    expect(text).toContain("실패 · set_cluster_rule — 커밋 거부: 위반 3곳");
    expect(text).toContain("map_ember_village 31,25");
    expect(text).toContain("map_ember_village 32,25");
  });
});
