// 에이전틱 개선(2026-07-04) 회귀 테스트.
// - 사용자 제한은 출력 토큰 예산 하나(기본 10240) — 예산 소진 시 token-budget으로 정지.
// - SimplePage 별칭(showText/text/messages)이 대사로 컴파일된다(조용한 유실 방지).
// - place_npc는 통행 불가/점유 좌표를 근처 통행 가능 칸으로 자동 조정한다.
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { compileSimplePage } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

function toolCallResult(name: string, completionTokens: number): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id: `call_${Math.trunc(completionTokens)}`, type: "function", function: { name, arguments: "{}" } }],
    },
    finishReason: "tool_calls",
    usage: { completion_tokens: completionTokens },
  };
}

describe("출력 토큰 예산", () => {
  it("누적 출력 토큰이 maxTokens를 넘으면 token-budget으로 멈춘다", async () => {
    let rounds = 0;
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: "sk", maxTokens: 10240 },
      chat: async () => {
        rounds += 1;
        return toolCallResult("get_project_summary", 6000);
      },
    });
    const result = await session.sendUserMessage("계속 조회해", () => {});
    expect(result.stoppedReason).toBe("token-budget");
    expect(rounds).toBe(2); // 6000 + 6000 = 12000 ≥ 10240
  });

  it("예산 안에서 최종 응답하면 final로 끝난다", async () => {
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: "sk" },
      chat: async () => ({
        message: { role: "assistant", content: "완료" },
        finishReason: "stop",
        usage: { completion_tokens: 100 },
      }),
    });
    const result = await session.sendUserMessage("안녕", () => {});
    expect(result.stoppedReason).toBe("final");
  });
});

describe("SimplePage 대사 별칭", () => {
  const graphic = { transparent: true as const };

  it("showText 배열이 text 커맨드로 컴파일된다 (감사 로그 유실 케이스)", () => {
    const page = compileSimplePage("p0", "현자 노인", { showText: ["첫 줄", "둘째 줄"] }, graphic);
    const texts = page.commands.filter((command) => command.kind === "text");
    expect(texts).toHaveLength(2);
  });

  it("text 단일 문자열과 messages 배열도 대사가 된다", () => {
    expect(compileSimplePage("p1", "n", { text: "한 줄" }, graphic).commands.filter((c) => c.kind === "text")).toHaveLength(1);
    expect(compileSimplePage("p2", "n", { messages: ["a", "b", "c"] }, graphic).commands.filter((c) => c.kind === "text")).toHaveLength(3);
  });

  it("lines가 있으면 lines가 우선한다", () => {
    const page = compileSimplePage("p3", "n", { lines: ["본문"], showText: ["무시"] }, graphic);
    const texts = page.commands.filter((command) => command.kind === "text" && "body" in command);
    expect(texts).toHaveLength(1);
  });
});

describe("place_npc 자동 착지", () => {
  it("이미 점유된 좌표에 배치하면 인근 통행 가능 칸으로 조정된다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const first = runTool(context, "place_npc", {
      mapId, x: 2, y: 2, id: "npc_a", name: "갑", pages: [{ lines: ["안녕"] }],
    });
    expect(first.ok, first.summary).toBe(true);

    const second = runTool(context, "place_npc", {
      mapId, x: 2, y: 2, id: "npc_b", name: "을", pages: [{ lines: ["반가워"] }],
    });
    expect(second.ok, second.summary).toBe(true);
    const data = second.data as { x: number; y: number; adjusted: boolean };
    expect(data.adjusted).toBe(true);
    expect(`${data.x},${data.y}`).not.toBe("2,2");
    expect(second.summary).toContain("자동 조정");
  });

  it("반경 3칸 내에 통행 가능 칸이 없으면 여전히 실패한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const map = context.project.maps[mapId];
    const tileset = context.project.tilesets[map.tilesetId];
    // 전 타일을 통행 불가로 만들어 조정 불가 상황을 강제한다.
    for (let index = 0; index < tileset.passability.length; index += 1) {
      tileset.passability[index] = { up: false, down: false, left: false, right: false };
    }
    const result = runTool(context, "place_npc", {
      mapId, x: 5, y: 5, id: "npc_c", name: "병", pages: [{ lines: ["..."] }],
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("통행 가능 칸이 없습니다");
  });
});
