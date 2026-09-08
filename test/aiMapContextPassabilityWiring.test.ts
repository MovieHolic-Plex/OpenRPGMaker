// 통행 그리드가 **항상 최신인 턴 컨텍스트에만** 실리는지의 계약.
//
// 시스템 프롬프트는 세션 baseline으로 재조립될 수 있으므로 그리드를 넣으면 현재 draft와
// 모순된다. 모델이 배치에 쓰는 격자는 매 턴 live draft로 만드는 사용자 블록 하나뿐이어야 한다.
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { AssistantSession } from "@/ai/assistantSession";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import type { AiConfig, ChatRequest, ChatResult } from "@/ai/llmClient";
import { VIEWPORT_PASSABILITY_MARK, VIEWPORT_PASSABILITY_ORIGIN_PREFIX } from "@/ai/mapViewportContext";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { MapViewportSnapshot } from "@/ai/mapViewportContext";
import type { Project } from "@/project/types";

const CONFIG: AiConfig = {
  authMode: "apiKey",
  baseUrl: "x",
  model: "passability-wiring-model",
  liteModel: "passability-wiring-model",
  apiKey: "sk",
  maxToolCalls: 1,
  maxTokens: 10_000,
  agentMode: "chat",
};

function waterProject(): { project: Project; viewport: MapViewportSnapshot } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.lowerTiles[3 * map.width + 3] = TILE.WATER;
  map.upperTiles[3 * map.width + 3] = TILE.EMPTY;
  if (isPassable(project, map, 3, 3)) throw new Error("fixture 실패: (3,3)이 통행 가능하다");
  return {
    project,
    viewport: { mapId: project.startMapId, centerX: 4, centerY: 4, x: 0, y: 0, w: 8, h: 8 },
  };
}

function markAt(block: string, viewport: MapViewportSnapshot, x: number, y: number): string {
  const lines = block.split("\n");
  const head = lines.findIndex((line) => line.startsWith(VIEWPORT_PASSABILITY_ORIGIN_PREFIX));
  if (head < 0) throw new Error("통행 그리드가 없다");
  const row = lines[head + 1 + (y - viewport.y)];
  if (row === undefined) throw new Error(`그리드 행이 없다: y=${y}`);
  return row[x - viewport.x] ?? "";
}

function stubChat(): { chat: (config: AiConfig, req: ChatRequest) => Promise<ChatResult>; requests: ChatRequest[] } {
  const requests: ChatRequest[] = [];
  return {
    requests,
    chat: async (_config, req) => {
      requests.push(req);
      return { message: { role: "assistant", content: "확인했습니다." }, finishReason: "stop" };
    },
  };
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("통행 그리드는 항상 최신 턴 컨텍스트에만 실린다", () => {
  it("buildSystemPrompt 의 뷰포트 머리 블록에는 통행 그리드를 넣지 않는다", () => {
    const { project, viewport } = waterProject();

    const prompt = buildSystemPrompt(project, { viewport, currentMapId: viewport.mapId });

    expect(prompt).not.toContain(VIEWPORT_PASSABILITY_ORIGIN_PREFIX);
    expect(prompt).toContain(`## 현재 맵 요약(${project.maps[viewport.mapId].name}`);
  });

  it("AssistantSession 이 턴마다 붙이는 뷰포트 블록도 그리드를 담는다", async () => {
    const { project, viewport } = waterProject();
    const stub = stubChat();
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: stub.chat,
      contextOptions: {
        getCurrentMapId: () => viewport.mapId,
        getViewport: () => viewport,
      },
    });

    await session.sendUserMessage("여기 NPC 하나 놓아줘");

    const request = stub.requests[0];
    if (!request) throw new Error("LLM 요청이 없다");
    // Grounding and the required-source ledger append user-role envelopes after
    // the actual viewport turn. Assert its unique machine-consumed grid, not message order.
    const viewportTurns = request.messages.filter(message => message.role === "user")
      .map(message => typeof message.content === "string" ? message.content
        : (message.content ?? []).map(part => part.type === "text" ? part.text : "").join("\n"))
      .filter(content => content.includes(VIEWPORT_PASSABILITY_ORIGIN_PREFIX));
    expect(viewportTurns).toHaveLength(1);
    const content = viewportTurns[0]!;
    expect(content).toContain(VIEWPORT_PASSABILITY_ORIGIN_PREFIX);
    expect(markAt(content, viewport, 3, 3)).toBe(VIEWPORT_PASSABILITY_MARK.blocked);
  });
});
