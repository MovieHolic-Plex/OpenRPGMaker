// 통행 그리드가 **출하 경로**에 실제로 실리는지의 계약.
//
// 왜 별 파일인가: `formatViewportContextBlock` 은 project 를 optional 로 받는다. 인자를
// 넘기지 않으면 그리드가 조용히 빠지고, 단위 테스트(aiMapContextPassability)는 인자를 직접
// 넘기므로 그 누락을 못 본다. 실제로 모델이 보는 문자열은 (1) buildSystemPrompt 의 뷰포트
// 머리 블록과 (2) AssistantSession 이 턴마다 붙이는 뷰포트 블록 두 곳이다 — 여기를 고정한다.
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

describe("통행 그리드는 출하되는 컨텍스트에 실린다", () => {
  it("buildSystemPrompt 의 뷰포트 머리 블록이 물 칸을 막힘으로 표시한다", () => {
    const { project, viewport } = waterProject();

    const prompt = buildSystemPrompt(project, { viewport, currentMapId: viewport.mapId });

    expect(prompt).toContain(VIEWPORT_PASSABILITY_ORIGIN_PREFIX);
    expect(markAt(prompt, viewport, 3, 3)).toBe(VIEWPORT_PASSABILITY_MARK.blocked);
    expect(markAt(prompt, viewport, 4, 4)).toBe(VIEWPORT_PASSABILITY_MARK.open);
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
    const userTurn = [...request.messages].reverse().find((message) => message.role === "user");
    const content = typeof userTurn?.content === "string"
      ? userTurn.content
      : (userTurn?.content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("\n");

    expect(content).toContain(VIEWPORT_PASSABILITY_ORIGIN_PREFIX);
    expect(markAt(content, viewport, 3, 3)).toBe(VIEWPORT_PASSABILITY_MARK.blocked);
  });
});
