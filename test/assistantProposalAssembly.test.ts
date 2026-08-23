import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { proposalCompletenessWarningLines, proposalScopeCarryoverWarning } from "@/ai/proposalCompleteness";
import { runTool } from "@/editor/tools";
import type { ToolContext, ToolResult } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { ChatResult } from "@/ai/llmClient";

const CONFIG = {
  baseUrl: "x",
  model: "minimax/minimax-m3",
  liteModel: "minimax/minimax-m3",
  apiKey: "sk",
  maxToolCalls: 12,
  maxTokens: 2048,
};

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

function projectContext(): ToolContext {
  return { project: createBlankProject() };
}

function placeNpc(ctx: ToolContext, id: string, x: number, y: number): void {
  const result = runTool(ctx, "place_npc", {
    mapId: ctx.project.startMapId,
    id,
    x,
    y,
    name: id,
    pages: [{ lines: ["안녕"] }],
  });
  expect(result.ok, result.summary).toBe(true);
}

describe("assistant proposal assembly scope warnings", () => {
  it("adds a diff warning when a previous-turn build spec is used in the next proposal", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const spec = {
      mapId,
      title: "숲 마을",
      assets: [{ id: "길", kind: "road", x: 2, y: 2, w: 10, h: 3 }],
    };
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", spec, "c1"),
      finalMsg("밑그림을 제안합니다."),
      toolCallMsg("paint_tiles", { mapId, mode: "rect", layer: "lower", tile: TILE.PATH, from: { x: 2, y: 2 }, to: { x: 8, y: 2 } }, "c2"),
      finalMsg("길을 정리할 예정입니다."),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });

    await session.sendUserMessage("숲 마을 계획만 잡아줘");
    const result = await session.sendUserMessage("길만 정갈하게 다시 깔아줘");
    const warnings = result.proposedCalls.flatMap((call) => call.result.diff?.warnings ?? []);

    expect(warnings).toContain(proposalScopeCarryoverWarning("숲 마을"));
    expect(proposalCompletenessWarningLines(result.proposedCalls)).toContain(proposalScopeCarryoverWarning("숲 마을"));
  });

  it("does not add a carryover warning when the build spec is created in the same turn", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", { mapId, title: "새 길", assets: [{ id: "길", kind: "road", x: 2, y: 2, w: 8, h: 2 }] }, "c1"),
      toolCallMsg("paint_tiles", { mapId, mode: "rect", layer: "lower", tile: TILE.PATH, from: { x: 2, y: 2 }, to: { x: 7, y: 2 } }, "c2"),
      finalMsg("길을 제안합니다."),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });

    const result = await session.sendUserMessage("길을 새로 깔아줘");
    const warnings = result.proposedCalls.flatMap((call) => call.result.diff?.warnings ?? []);

    expect(warnings.some((warning) => warning.includes("이전 계획"))).toBe(false);
  });

  it("adds the carryover warning only once for multiple spatial calls", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const spec = {
      mapId,
      title: "마을 전체",
      assets: [
        { id: "길", kind: "road", x: 2, y: 2, w: 8, h: 2 },
        { id: "꽃", kind: "prop", x: 2, y: 5, w: 8, h: 2 },
      ],
    };
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", spec, "c1"),
      finalMsg("밑그림을 잡았습니다."),
      toolCallMsg("paint_tiles", { mapId, mode: "rect", layer: "lower", tile: TILE.PATH, from: { x: 2, y: 2 }, to: { x: 7, y: 2 } }, "c2"),
      toolCallMsg("paint_tiles", { mapId, mode: "rect", layer: "upper", tile: TILE.FLOWERS, from: { x: 2, y: 5 }, to: { x: 5, y: 5 } }, "c3"),
      finalMsg("일부를 제안합니다."),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });

    await session.sendUserMessage("마을 전체 계획만 잡아줘");
    const result = await session.sendUserMessage("길만 다시 깔아줘");
    const warnings = result.proposedCalls.flatMap((call) => call.result.diff?.warnings ?? []);

    expect(warnings.filter((warning) => warning.includes("이전 계획"))).toHaveLength(1);
  });
});

describe("assistant proposal assembly move_event squash", () => {
  it("squashes a new NPC followed by repeated move_event calls into one final placement proposal", async () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const chat = scriptedChat([
      toolCallMsg("set_build_spec", { mapId, title: "NPC 배치", assets: [{ id: "안내원", kind: "npc", x: 1, y: 1, w: 12, h: 10 }] }, "c1"),
      toolCallMsg("place_npc", { mapId, id: "ev_guide", x: 2, y: 2, name: "안내원", pages: [{ lines: ["안녕하세요"] }] }, "c2"),
      toolCallMsg("move_event", { mapId, eventId: "ev_guide", x: 4, y: 4 }, "c3"),
      toolCallMsg("move_event", { mapId, eventId: "ev_guide", x: 8, y: 5 }, "c4"),
      finalMsg("안내원을 배치하도록 제안합니다."),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat });
    const toolEvents: string[] = [];

    const result = await session.sendUserMessage("인사하는 NPC 추가해줘", (event) => {
      if (event.type === "tool_call") toolEvents.push(`${event.name}:${event.result.ok}`);
    });
    const event = session.getProposedProject().maps[mapId].events.find((entry) => entry.id === "ev_guide");

    expect(toolEvents.filter((entry) => entry.startsWith("move_event:true"))).toHaveLength(2);
    expect(result.proposedCalls).toHaveLength(1);
    expect(result.proposedCalls[0]).toMatchObject({ name: "place_npc", args: { x: 8, y: 5 } });
    expect(result.proposedCalls[0].summary).toContain("(8, 5)");
    expect(event).toMatchObject({ x: 8, y: 5 });
  });

  it("squashes repeated move_event calls for an existing event to the final move", async () => {
    const ctx = projectContext();
    const mapId = ctx.project.startMapId;
    placeNpc(ctx, "ev_existing", 2, 2);
    const chat = scriptedChat([
      toolCallMsg("move_event", { mapId, eventId: "ev_existing", x: 4, y: 4 }, "c1"),
      toolCallMsg("move_event", { mapId, eventId: "ev_existing", x: 6, y: 7 }, "c2"),
      finalMsg("위치를 옮기도록 제안합니다."),
    ]);
    const session = new AssistantSession(ctx.project, { config: CONFIG, chat });
    const toolEvents: string[] = [];

    const result = await session.sendUserMessage("NPC 위치를 옮겨줘", (event) => {
      if (event.type === "tool_call") toolEvents.push(`${event.name}:${event.result.ok}`);
    });
    const event = session.getProposedProject().maps[mapId].events.find((entry) => entry.id === "ev_existing");

    expect(toolEvents).toEqual(["move_event:true", "move_event:true"]);
    expect(result.proposedCalls).toHaveLength(1);
    expect(result.proposedCalls[0]).toMatchObject({ name: "move_event", args: { x: 6, y: 7 } });
    expect(event).toMatchObject({ x: 6, y: 7 });
  });

  it("does not squash move_event calls for different event targets", async () => {
    const ctx = projectContext();
    const mapId = ctx.project.startMapId;
    placeNpc(ctx, "ev_a", 2, 2);
    placeNpc(ctx, "ev_b", 3, 2);
    const chat = scriptedChat([
      toolCallMsg("move_event", { mapId, eventId: "ev_a", x: 5, y: 4 }, "c1"),
      toolCallMsg("move_event", { mapId, eventId: "ev_b", x: 6, y: 4 }, "c2"),
      finalMsg("두 사람의 위치를 옮기도록 제안합니다."),
    ]);
    const session = new AssistantSession(ctx.project, { config: CONFIG, chat });

    const result = await session.sendUserMessage("두 NPC 위치를 옮겨줘");

    expect(result.proposedCalls.map((call) => `${call.name}:${call.args.eventId}`)).toEqual(["move_event:ev_a", "move_event:ev_b"]);
  });
});


describe("assistant WorkPlan evidence isolation", () => {
  it("clears successful-tool evidence when set_work_plan replaces a same-id item", () => {
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: scriptedChat([]) });
    const probe = session as unknown as {
      applyWorkPlanTool(name: string, args: Record<string, unknown>): ToolResult;
      turnSuccessfulTools: Set<string>;
      successfulToolsWorkItemId: string | null;
    };
    const planArgs = {
      goal: "타일 작업",
      layers: [{ title: "L", items: [{ title: "A", instruction: "paint", successTools: ["paint_tiles"] }] }],
    };

    expect(probe.applyWorkPlanTool("set_work_plan", planArgs).ok).toBe(true);
    probe.turnSuccessfulTools.add("paint_tiles");
    probe.successfulToolsWorkItemId = "L1-1";
    expect(probe.applyWorkPlanTool("set_work_plan", planArgs).ok).toBe(true);

    const completed = probe.applyWorkPlanTool("complete_work_item", { itemId: "L1-1" });
    expect(completed.ok).toBe(false);
    expect(completed.summary).toContain("paint_tiles");
  });
});
