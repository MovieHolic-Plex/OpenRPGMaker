import { describe, expect, it, afterEach, vi } from "vitest";
import { fixedDeclarer } from "./intentFixture";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { type ChatRequest, type ChatResult, defaultAiConfig } from "@/ai/llmClient";
import { getTool, runTool } from "@/editor/tools";
import { createBlankProject, createBlankMap } from "@/project/defaults";
import { MAX_IMAGE_DIMENSION, tileDrawSize } from "@/ai/toolImageCanvas";
import { independentReviewPayload, imageDeliveryForRequest } from "./independentReviewFixture";
import { isolateTimers } from "./mergedTeardown";

// 컴포저 모드(지시/질문/계획)의 세션 계약. 모드는 프롬프트 문장이 아니라 하네스가 강제한다:
//   질문(ask)  — 쓰기 툴 스키마를 모델에 노출하지 않고, 불러도 거부한다. 프로젝트 초안은 불변.
//   계획(plan) — 플래너를 항상 돌려 계획만 세우고 그 턴은 실행 없이 끝난다. 「계속」이 실행이다.
//   지시(do)   — 종전 그대로.
// 이전 구현은 [컨텍스트] 꼬리에 "모드: 질문 — …" 한 줄만 실었고 세션은 모드를 몰랐다(2026-09-03 감사).
describe("aiAskPendingPlan", () => {
  isolateTimers();
  const CONFIG = {
    authMode: "apiKey" as const,
    baseUrl: "x",
    model: "stub-model",
    liteModel: "stub-model",
    apiKey: "sk",
    maxToolCalls: 6,
    maxTokens: 512,
    agentMode: "chat" as const,
  };
  function finalResult(text: string): ChatResult {
    return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
  }
  function toolCallResult(name: string, args: unknown, id: string): ChatResult {
    return {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
      },
      finishReason: "tool_calls",
    } as ChatResult;
  }
  const PLAN = {
    goal: "타이틀 2단계 개선",
    layers: [
      {
        title: "타이틀",
        items: [
          { title: "1차 제목", instruction: "set_title_screen {title:'t1'}", successTools: ["set_title_screen"] },
          { title: "2차 제목", instruction: "set_title_screen {title:'t2'}", successTools: ["set_title_screen"] },
        ],
      },
    ],
  };
  const NEW_PLAN_JSON = JSON.stringify({ action: "new_plan", ...PLAN });
  const DIRECT_JSON = JSON.stringify({ action: "direct", reason: "한 턴으로 충분" });
  /** 스크립트를 순서대로 돌려주고, 각 호출의 요청(tools 포함)을 기록하는 chat. */
  function scriptedChat(steps: ChatResult[]) {
    const requests: ChatRequest[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      requests.push(req);
      const next = steps.shift();
      if (!next) {
        throw new (class extends Error {
          readonly status = 401;
          constructor() {
            super("scripted chat exhausted");
            this.name = "LlmError";
          }
        })();
      }
      return next;
    };
    return { chat, requests };
  }
  const toolNames = (req: ChatRequest | undefined): string[] => (req?.tools ?? []).map((tool) => tool.function.name);
  const writeToolNames = (req: ChatRequest | undefined): string[] =>
    toolNames(req).filter((name) => getTool(name)?.mode === "write" || name === "set_build_spec");
  describe("질문 중 미완료 계획 보존", () => {
    it("답변 뒤 계획을 재개하거나 자동 계속하지 않는다", async () => {
      const { chat, requests } = scriptedChat([finalResult(NEW_PLAN_JSON), finalResult("계획에는 두 단계가 있습니다.")]);
      const session = new AssistantSession(createBlankProject(), {
        config: CONFIG, chat, declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
      });
      const planned = await session.sendUserMessage("제목 개선 계획", () => {}, undefined, { composerMode: "plan", autonomous: true });
      const answered = await session.sendUserMessage("계획을 설명해줘", () => {}, undefined, { composerMode: "ask", autonomous: true });
      expect(requests).toHaveLength(2);
      expect(answered.stoppedReason).toBe("final");
      expect(answered.proposedCalls).toEqual([]);
      expect(answered.workPlan).toEqual(planned.workPlan);
      expect(writeToolNames(requests[1])).toEqual([]);
      expect(answered.assistantText).toContain("두 단계");
    });
  });
});

describe("auditToolCatalogBudget", () => {
  isolateTimers();
  /**
   * 2026-09-10 실측 회귀: `tools:exposed` 가 매 라운드 227개 도구 이름 전체를 감사에 찍었다.
   * clipText 상한(4KB)에 걸린 행이 라운드마다 쌓여 AUDIT_BUDGET_BYTES(384KB)를 상수 문자열로
   * 소진하고, fitWithinBudget 이 가운데를 버려 **대화 기록 472건이 축출**됐다 —
   * planner:replan 원문이 사라져 사후 진단 자체가 불가능해졌다.
   * 카탈로그가 바뀔 때만 전체 목록을 남긴다.
   */
  const CHAT_CONFIG = {
    authMode: "apiKey" as const,
    baseUrl: "x",
    model: "test-model",
    liteModel: "test-model",
    apiKey: "sk",
    maxToolCalls: 4,
    maxTokens: 512,
    agentMode: "chat" as const,
  };
  function final(text: string): ChatResult {
    return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
  }
  function exposures(session: AssistantSession): string[] {
    return session.getAuditEntries().flatMap(entry =>
      entry.kind === "status" && entry.text.startsWith("tools:exposed") ? [entry.text] : []);
  }
  describe("tools:exposed 감사 예산", () => {
    it("같은 카탈로그를 반복해서 전체 목록으로 찍지 않는다", async () => {
      const session = new AssistantSession(createBlankProject(), {
        config: CHAT_CONFIG,
        chat: async () => final("확인했습니다."),
      });

      await session.sendUserMessage("첫 질문", () => {}, undefined, { composerMode: "ask" });
      await session.sendUserMessage("둘째 질문", () => {}, undefined, { composerMode: "ask" });

      const entries = exposures(session);
      expect(entries.length).toBe(2);

      // 첫 노출은 진단을 위해 전체 목록을 남긴다.
      expect(entries[0]).toContain("get_map_region");
      // 이후 동일 카탈로그는 개수만 — 이름 목록을 반복하지 않는다.
      expect(entries[1]).not.toContain("get_map_region");
      expect(entries[1]).toContain("카탈로그 동일");
      expect(entries[1]!.length).toBeLessThan(64);
    });
  });
});

describe("wholeMapCoverageRender", () => {
  isolateTimers();
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const withMap = (id: string, w: number, h: number) => {
    const project = createBlankProject();
    const map = { ...createBlankMap(id, w, h), id };
    project.maps[id] = map;
    return { project, map };
  };
  describe("tileDrawSize", () => {
    // canvasDataUrl only shrinks the finished canvas, so the pre-downscale allocation is
    // what a whole-map render actually costs: 256x256 tiles at the native 32px draw size
    // is an 8192x8192 canvas (~268MB) before anything is scaled down.
    it("keeps a small region at the native draw size", () => {
      expect(tileDrawSize(24, 24, 16)).toBe(32);
    });

    it("bounds the canvas for a whole large map instead of allocating and shrinking", () => {
      const draw = tileDrawSize(256, 256, 16);
      expect(draw).toBeLessThan(32);
      expect(256 * draw).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
    });

    it("never returns a draw size below one pixel per tile", () => {
      expect(tileDrawSize(4096, 4096, 16)).toBeGreaterThanOrEqual(1);
    });
  });
  describe("show_map_region whole-map coverage", () => {
    // The review gate requires a rendered (0,0)-to-(w,h) union for a changed map. Tiling
    // that at 24 costs ceil(w/24) * ceil(h/24) images -- 25 for a 100x100 village -- where
    // one downscaled render carries the same coverage.
    it("returns the whole map in one call instead of clamping to 24", () => {
      const { project, map } = withMap("map_big", 60, 60);
      const result = runTool({ project }, "show_map_region", {
        mapId: map.id, x: 0, y: 0, w: map.width, h: map.height,
      });
      expect(result.ok).toBe(true);
      const data = result.data as { w: number; h: number; x: number; y: number };
      expect(data).toMatchObject({ x: 0, y: 0, w: 60, h: 60 });
      expect((result.warnings ?? []).some((w: string) => w.includes("잘랐"))).toBe(false);
    });

    it("treats an over-large request that covers the map as whole-map coverage", () => {
      const { project, map } = withMap("map_big", 60, 60);
      const result = runTool({ project }, "show_map_region", {
        mapId: map.id, x: 0, y: 0, w: 80, h: 80,
      });
      const data = result.data as { w: number; h: number };
      expect(data).toMatchObject({ w: 60, h: 60 });
    });

    // The cap still exists for its original purpose: stop the model roaming a big map in
    // arbitrary oversized slices. Only complete coverage is exempt.
    it("still clamps an oversized partial region", () => {
      const { project, map } = withMap("map_big", 60, 60);
      const result = runTool({ project }, "show_map_region", {
        mapId: map.id, x: 5, y: 5, w: 50, h: 50,
      });
      expect(result.ok).toBe(true);
      const data = result.data as { w: number; h: number };
      expect(data).toMatchObject({ w: 24, h: 24 });
      expect((result.warnings ?? []).some((w: string) => w.includes("잘랐"))).toBe(true);
    });

    it("leaves a small map untouched", () => {
      const { project, map } = withMap("map_small", 20, 15);
      const result = runTool({ project }, "show_map_region", {
        mapId: map.id, x: 0, y: 0, w: map.width, h: map.height,
      });
      const data = result.data as { w: number; h: number; lower: number[][] };
      expect(data).toMatchObject({ w: 20, h: 15 });
      expect(data.lower).toHaveLength(15);
    });
  });
  // Heavy under CI load (15s default is too tight): renders a large map region by region.
  describe("review coverage of a map larger than the span cap", { timeout: 120_000 }, () => {
    // A 40x40 map used to need ceil(40/24)^2 = 4 clipped renders to satisfy the review gate's
    // (0,0)-to-(w,h) coverage requirement. 2026-09-17 독립 검수 해체 이후 이미지 커버리지는 승인 조건이
    // 아니다 — 여기서는 한 번의 whole-map 호출이 세션 경로에서 잘리지 않고, 결정적 검사로 승인되는 것만 고정한다.
    it("satisfies the coverage requirement with a single show_map_region call", async () => {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));

      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId] = { ...createBlankMap(mapId, 40, 40), id: mapId };
      const map = project.maps[mapId];
      const shownRegions: { w: number; h: number }[] = [];
      let reviewRequests = 0;
      let writerRound = 0;

      const session = new AssistantSession(project, {
        config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 10 },
        declareIntent: fixedDeclarer({ mode: "modify", targetMapId: null,
          tools: ["set_tileset_properties", "show_map_region"] }),
        renderImages: async () => [{ label: "whole map", dataUrl: "data:image/png;base64,AA==" }],
        chat: async (_config, request) => {
          if (independentReviewPayload(request)) {
            reviewRequests += 1;
            throw new Error("검수 모델은 더 이상 호출되지 않아야 한다");
          }
          writerRound += 1;
          if (writerRound === 1) {
            const call: ChatResult = { message: { role: "assistant", content: null, tool_calls: [{ id: "columns",
              type: "function", function: { name: "set_tileset_properties", arguments: JSON.stringify({
                tilesetId: map.tilesetId, tilesPerRow: 31, reason: "inspect atlas layout" }) } }] },
              finishReason: "tool_calls" };
            return call;
          }
          if (writerRound === 2) {
            const call: ChatResult = { message: { role: "assistant", content: null, tool_calls: [{ id: "show",
              type: "function", function: { name: "show_map_region", arguments: JSON.stringify({
                mapId, x: 0, y: 0, w: map.width, h: map.height, reason: "whole-map coverage" }) } }] },
              finishReason: "tool_calls" };
            return call;
          }
          return { imageDelivery: imageDeliveryForRequest(request), message: { role: "assistant", content: "Done" }, finishReason: "stop" };
        },
      });

      const result = await session.sendUserMessage("Change the atlas to 31 columns and show the whole map", (event) => {
        if (event.type === "tool_call" && event.name === "show_map_region") {
          const data = event.result.data as { w: number; h: number };
          shownRegions.push({ w: data.w, h: data.h });
        }
      });

      // One call, uncropped.
      expect(shownRegions).toEqual([{ w: 40, h: 40 }]);
      expect(reviewRequests).toBe(0);
      expect(result.review?.status, JSON.stringify(result.review)).toBe("approved");
      expect(result.review?.summary).toContain("lint error 0건");
    });
  });
});
