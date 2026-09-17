import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { NON_TILE_SPATIAL_TOOLS, SPATIAL_BUILD_TOOLS, } from "@/ai/buildSpec";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

type ChatResult = import("@/ai/llmClient").ChatResult;

const CONFIG = { authMode: "apiKey" as const, baseUrl: "x", model: "stub-model", apiKey: "sk", maxToolCalls: 12, maxTokens: 8192 };

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

function projectWithMap() {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "create_map", { id: "m1", name: "게이트 테스트", width: 20, height: 20 }).ok).toBe(true);
  return ctx.project;
}

async function toolEvents(session: AssistantSession, message: string) {
  const events: { name: string; ok: boolean; summary: string; messages: string[] }[] = [];
  await session.sendUserMessage(message, (event) => {
    if (event.type === "tool_call") {
      events.push({ name: event.name, ok: event.result.ok, summary: event.result.summary,
        messages: (event.result.issues ?? []).map(issue => issue.message) });
    }
  });
  return events;
}

// F2(`.omo/evidence/ai-assistant-failure-modes.md`): 밑그림 없음 차단이 실사용자 실패의 52%였다.
// 타일을 덮지 않는 점 배치까지 막을 근거가 없었고, 차단문에는 재제출할 초안이 없었다.
describe("스펙 게이트 — 덮어쓰지 않는 배치와 재제출 초안", () => {
  it("점 배치 툴은 밑그림 없음만을 이유로 막지 않는다", async () => {
    for (const name of ["place_npc", "place_battle_blocker"]) {
      expect(SPATIAL_BUILD_TOOLS.has(name)).toBe(true);
      expect(NON_TILE_SPATIAL_TOOLS.has(name)).toBe(true);
    }
    const session = new AssistantSession(projectWithMap(), { config: CONFIG, chat: scriptedChat([
      toolCallMsg("place_npc", { mapId: "m1", x: 6, y: 6, id: "npc_guide", name: "안내원",
        graphic: { transparent: true }, pages: [{ lines: ["어서 오세요"] }] }, "c1"),
      finalMsg("안내원을 세웠습니다."),
    ]) });

    const placed = (await toolEvents(session, "안내원 한 명 세워줘")).find(event => event.name === "place_npc");

    expect(placed?.ok).toBe(true);
    expect(session.getProposedProject().maps.m1!.events.some(event => event.id === "npc_guide")).toBe(true);
  });

  it("타일을 쓰는 툴도 빈 기준선 맵이면 밑그림 없이 실행된다", async () => {
    const session = new AssistantSession(projectWithMap(), { config: CONFIG, chat: scriptedChat([
      toolCallMsg("build_house", { mapId: "m1", x: 2, y: 2, width: 6, height: 7, material: "plaster" }, "c1"),
      finalMsg("지었습니다."),
    ]) });

    const house = (await toolEvents(session, "집 지어줘")).find(event => event.name === "build_house");

    expect(house?.ok).toBe(true);
    expect(house?.summary).not.toContain("스펙 게이트");
  });
});
