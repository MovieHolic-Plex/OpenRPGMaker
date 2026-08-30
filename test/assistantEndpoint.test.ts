import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  REGION_SURFACE_MAX_TOOL_CALLS,
  TILESET_ANALYSIS_MAX_TOKENS,
  isAssistantEndpointReady,
  resolveSurfaceAiConfig,
  type AiSurface,
} from "@/ai/assistantEndpoint";
import { REGION_TASK_MAX_TOOL_CALLS } from "@/editor/regionTask/runRegionTask";
import type { AiConfig } from "@/ai/llmClient";
import { AI_CONFIG_STORAGE_KEY, loadAiConfig, resetAiTransportHealth } from "@/ai/llmClient";
import {
  getAiConnectionStatus,
  refreshAiConnectionStatus,
  resetAiConnectionStatusCache,
} from "@/editor/panels/aiConnectionStatus";

const ALL_SURFACES: readonly AiSurface[] = [
  "chat",
  "region",
  "cluster",
  "event-command",
  "structure-kit",
  "tileset-analysis",
];

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      clear: () => values.clear(),
    },
  });
  resetAiConnectionStatusCache();
  resetAiTransportHealth();
});

afterEach(() => {
  resetAiConnectionStatusCache();
  resetAiTransportHealth();
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllGlobals();
});

function companionConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    authMode: "chatgpt",
    providerId: "openai-codex",
    baseUrl: "",
    model: "gpt-5.6-sol",
    liteModel: "gpt-5.6-luna",
    apiKey: "",
    maxToolCalls: 60,
    maxTokens: 32768,
    reasoningEffort: "medium",
    ...overrides,
  };
}

describe("resolveSurfaceAiConfig", () => {
  it("keeps the shipped region-task tool-call ceiling at 24", () => {
    expect(REGION_SURFACE_MAX_TOOL_CALLS).toBe(24);
    expect(REGION_TASK_MAX_TOOL_CALLS).toBe(24);
  });

  it("Given any surface When resolving Then the endpoint fields stay identical to the assistant config", () => {
    // 이 스펙이 막는 결함: 표면이 자기 baseUrl/authMode/providerId 를 정하면 '조수 하나로 통일' 이
    // 깨진다. 과거 타일셋 AI 가 직접 baseUrl 을 조립하다 조용히 죽은 경로가 그것이었다.
    const base = companionConfig();

    for (const surface of ALL_SURFACES) {
      const resolved = resolveSurfaceAiConfig(surface, base);
      expect(resolved.authMode, surface).toBe(base.authMode);
      expect(resolved.baseUrl, surface).toBe(base.baseUrl);
      expect(resolved.providerId, surface).toBe(base.providerId);
      expect(resolved.apiKey, surface).toBe(base.apiKey);
    }
  });

  it("Given the chat surface When resolving Then the stored supervisor config passes through untouched", () => {
    const base = companionConfig();

    expect(resolveSurfaceAiConfig("chat", base)).toEqual(base);
  });

  it("Given batch surfaces When resolving Then they run the lite model with reasoning off", () => {
    const base = companionConfig();

    for (const surface of ["region", "cluster", "event-command"] as const) {
      const resolved = resolveSurfaceAiConfig(surface, base);
      expect(resolved.model, surface).toBe("gpt-5.6-luna");
      expect(resolved.reasoningEffort, surface).toBe("off");
    }
  });

  it("Given supervisor surfaces When resolving Then they keep the supervisor model and reasoning effort", () => {
    const base = companionConfig();

    for (const surface of ["chat", "structure-kit", "tileset-analysis"] as const) {
      const resolved = resolveSurfaceAiConfig(surface, base);
      expect(resolved.model, surface).toBe("gpt-5.6-sol");
      expect(resolved.reasoningEffort, surface).toBe("medium");
    }
  });

  it("Given the region surface When the user allows more tool calls Then the surface ceiling wins", () => {
    const resolved = resolveSurfaceAiConfig("region", companionConfig({ maxToolCalls: 200 }));

    expect(resolved.maxToolCalls).toBe(REGION_SURFACE_MAX_TOOL_CALLS);
  });

  it("Given the region surface When the user allows fewer tool calls Then the user value is respected", () => {
    // 상한이지 하한이 아니다 — 사용자가 더 조심스럽게 골랐으면 그 값이 남아야 한다.
    const resolved = resolveSurfaceAiConfig("region", companionConfig({ maxToolCalls: 5 }));

    expect(resolved.maxToolCalls).toBe(5);
  });

  it("Given the tileset surface When the user budget is larger Then the mapping budget is pinned, not raised", () => {
    // 실측 근거: cpen 은 max_tokens 8192 통과, 32768 은 422. 사용자 예산으로 올리면 그 조합이 깨진다.
    const resolved = resolveSurfaceAiConfig("tileset-analysis", companionConfig({ maxTokens: 32768 }));

    expect(resolved.maxTokens).toBe(TILESET_ANALYSIS_MAX_TOKENS);
  });

  it("Given a surface with no policy knobs When resolving Then the base object is returned as-is", () => {
    const base = companionConfig();

    expect(resolveSurfaceAiConfig("chat", base)).toBe(base);
  });
});

describe("isAssistantEndpointReady", () => {
  it("Given browser-stored config When the auth cache is cold Then the first attempt stays available", () => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "apiKey",
      baseUrl: "https://discarded.invalid/v1",
      apiKey: "discarded-key",
      model: "   ",
    }));

    const config = loadAiConfig();
    const status = getAiConnectionStatus(config);

    // loadAiConfig normalizes this otherwise-invalid blob to OAuth plus a default model. Shape readiness alone
    // is therefore true in every browser; the live status is the part that can later close the gate.
    expect(config.authMode).toBe("chatgpt");
    expect(config.model.trim()).not.toBe("");
    expect(status.kind).toBe("checking");
    expect(isAssistantEndpointReady(config, status)).toBe(true);
  });

  it("Given browser-stored config When refresh reports logged out Then readiness blocks", async () => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      authMode: "chatgpt",
      providerId: "google-antigravity",
      model: "gemini-3.7-flash",
    }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ connected: false }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));

    await refreshAiConnectionStatus();
    const config = loadAiConfig();
    const status = getAiConnectionStatus(config);

    expect(status.kind).toBe("disconnected");
    expect(isAssistantEndpointReady(config, status)).toBe(false);
  });

  it("Given companion transport When no client key is stored Then it is ready", () => {
    // OAuth(동반 서비스)는 자격 증명을 브라우저에 두지 않는 것이 정상 상태다.
    expect(isAssistantEndpointReady(companionConfig())).toBe(true);
  });

  it("Given no configured model When judging readiness Then it is not ready", () => {
    // 이 스펙이 막는 결함: 타일셋 AI 만 모델을 보지 않아 버튼이 열려 있었고 `model: ""` 로 요청이 나갔다.
    // 이 상태는 주입 설정(노드 스크립트·벤치마크·테스트)에서만 온다 — loadAiConfig 는 모델을 백필한다.
    expect(isAssistantEndpointReady(companionConfig({ model: "   ", liteModel: "" }))).toBe(false);
  });

  it("Given a blank config When resolving a batch surface Then the lite default hides the absence", () => {
    // 준비 판정이 표면을 인자로 받지 않는 이유. configForLiteModel 은 모델이 하나도 없을 때
    // DEFAULT_LITE_MODEL 을 채우므로, 해석된 설정으로 판정하면 배치 표면은 영원히 '준비됨' 이 된다 —
    // 설정이 빈 상태에서 조수만 거부하고 영역·클러스터는 기본 모델로 요청을 보내는 갈림이 그것이다.
    const blank = companionConfig({ model: "   ", liteModel: "" });

    expect(resolveSurfaceAiConfig("region", blank).model.trim()).not.toBe("");
    expect(isAssistantEndpointReady(blank)).toBe(false);
  });

  it("Given a relative baseUrl gateway When the client has no key Then proxy auth is exempt", () => {
    const config = companionConfig({ authMode: "apiKey", baseUrl: "/api/ai", apiKey: "" });

    expect(isAssistantEndpointReady(config)).toBe(true);
  });

  it("Given an absolute gateway baseUrl When the client has no key Then it is not ready", () => {
    const config = companionConfig({ authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "" });

    expect(isAssistantEndpointReady(config)).toBe(false);
  });

  it("Given an absolute gateway baseUrl and a key When judging readiness Then it is ready", () => {
    const config = companionConfig({ authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "sk-test" });

    expect(isAssistantEndpointReady(config)).toBe(true);
  });

  it("Given only a supervisor model When resolving a batch surface Then the lite tier follows it", () => {
    // configForLiteModel 은 liteModel 이 비면 감독 model 을 따라간다. 그 폴백이 사라지면
    // 배치 표면이 사용자가 고르지 않은 DEFAULT_LITE_MODEL 로 조용히 갈아탄다.
    expect(resolveSurfaceAiConfig("region", companionConfig({ liteModel: "" })).model).toBe("gpt-5.6-sol");
  });
});
