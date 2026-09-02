// 조수 앞문 계약 — 「여관 지어줘」 첫 라운드에 place_concept 스키마가 손에 있고, 호출하면 여관이 선다.
// 핀 없이 자연어 승격(capabilityEscalation)으로만 꺼낸다는 핸드오프 규칙을 잠근다.
import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { createBlankProject } from "@/project/defaults";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "@/project/defaults/scratchInnBundle";

type ToolSchema = { readonly function?: { readonly name?: string } };

describe("조수 앞문 — 여관 지어줘 → place_concept", () => {
  it("첫 실행 라운드 스키마에 place_concept 이 있고, 호출 결과가 감사 로그에 남는다", async () => {
    const exposedPerRound: string[][] = [];
    let called = false;
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: "sk" },
      chat: async (_cfg, req): Promise<ChatResult> => {
        const tools = ((req as { tools?: readonly ToolSchema[] }).tools ?? []).map((tool) => tool.function?.name ?? "");
        if (tools.length === 0) {
          return { message: { role: "assistant", content: JSON.stringify({ action: "direct", reason: "build" }) }, finishReason: "stop", usage: { completion_tokens: 10 } };
        }
        exposedPerRound.push(tools);
        if (!called && tools.includes("place_concept")) {
          called = true;
          return {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{ id: "call_inn", type: "function", function: { name: "place_concept", arguments: JSON.stringify({ query: "여관", mapId: "map_inn_ai", seed: 7 }) } }],
            },
            finishReason: "tool_calls",
            usage: { completion_tokens: 30 },
          };
        }
        return { message: { role: "assistant", content: "여관을 지었습니다." }, finishReason: "stop", usage: { completion_tokens: 10 } };
      },
    });
    await session.sendUserMessage("여관 지어줘", () => {});
    expect(exposedPerRound.length).toBeGreaterThan(0);
    expect(exposedPerRound[0], `첫 라운드 노출: ${exposedPerRound[0]?.join(",")}`).toContain("place_concept");
    expect(called).toBe(true);
    const audit = session.getHarnessSnapshot().audit;
    const toolEntry = audit.find((entry) => entry.kind === "tool" && entry.name === "place_concept");
    expect(toolEntry).toBeDefined();
    expect(toolEntry && toolEntry.kind === "tool" ? toolEntry.ok : false, toolEntry && toolEntry.kind === "tool" ? toolEntry.summary : "").toBe(true);
  });
});

describe("두 턴 사이의 데이터베이스 수정을 조수가 읽는다", () => {
  function chatThatCallsOnce(name: string, args: Record<string, unknown>, calledRef: { value: boolean }) {
    return async (_cfg: unknown, req: unknown): Promise<ChatResult> => {
      const tools = ((req as { tools?: readonly ToolSchema[] }).tools ?? []).map((tool) => tool.function?.name ?? "");
      if (tools.length === 0) {
        return { message: { role: "assistant", content: JSON.stringify({ action: "direct", reason: "build" }) }, finishReason: "stop", usage: { completion_tokens: 10 } };
      }
      if (!calledRef.value && tools.includes(name)) {
        calledRef.value = true;
        return {
          message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name, arguments: JSON.stringify(args) } }] },
          finishReason: "tool_calls",
          usage: { completion_tokens: 30 },
        };
      }
      return { message: { role: "assistant", content: "끝" }, finishReason: "stop", usage: { completion_tokens: 10 } };
    };
  }

  it("제안이 남아 있지 않으면 저장소 프로젝트로 기준을 맞추고, 고친 시설명으로 place_concept 이 성공한다", async () => {
    const called = { value: false };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: "sk" },
      // 예산 기본값에서는 개념 꾸러미 절이 뒤쪽이라 잘릴 수 있다 — 프롬프트 검사에는 넉넉히 준다.
      contextOptions: { budgetChars: 50_000 },
      chat: chatThatCallsOnce("place_concept", { query: "주막", mapId: "map_tavern_ai", seed: 7 }, called),
    });
    // 사용자가 데이터베이스에서 여관 → 주막으로 고쳤다(저장소 프로젝트).
    const edited = createBlankProject();
    const bundle = cloneConceptBundle(SCRATCH_INN_BUNDLE);
    bundle.label = "주막";
    bundle.facilities[0] = { ...bundle.facilities[0]!, label: "주막" };
    edited.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [bundle];

    expect(session.syncBaselineFromStoreIfClean(edited)).toBe(true);
    await session.sendUserMessage("주막을 새 맵으로 지어줘", () => {});
    const tool = session.getHarnessSnapshot().audit.find((entry) => entry.kind === "tool" && entry.name === "place_concept");
    expect(tool && tool.kind === "tool" ? tool.ok : false, tool && tool.kind === "tool" ? tool.summary : "호출 없음").toBe(true);
    const system = session.getHarnessSnapshot().messages.find((message) => message.role === "system");
    expect(String(system?.content ?? "")).toContain("주막");
  });

  it("승인 대기 제안이 있으면 기준을 바꾸지 않는다(쓰기를 잃지 않는다)", async () => {
    const called = { value: false };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), apiKey: "sk" },
      chat: chatThatCallsOnce("place_concept", { query: "여관", mapId: "map_inn_pending", seed: 7 }, called),
    });
    // 비자율 턴: 쓰기는 제안으로 남고 적용되지 않는다.
    const result = await session.sendUserMessage("여관 지어줘", () => {});
    expect(result.proposedCalls.length).toBeGreaterThan(0);
    expect(session.syncBaselineFromStoreIfClean(createBlankProject())).toBe(false);
  });
});
