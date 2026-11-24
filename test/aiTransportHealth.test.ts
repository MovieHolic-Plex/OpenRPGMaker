import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { fetchCompanion } from "@/ai/companionConnection";
import { getAiTransportHealth, reportTransportHealth, resetAiTransportHealth, type AiConfig, AI_CONFIG_STORAGE_KEY, loadAiConfig } from "@/ai/llmClient";
import { getAiConnectionStatus, refreshAiConnectionStatus, resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { REGION_SURFACE_MAX_TOOL_CALLS, TILESET_ANALYSIS_MAX_TOKENS, isAssistantEndpointReady, resolveSurfaceAiConfig, type AiSurface } from "@/ai/assistantEndpoint";
import { ASSISTANT_CHATGPT_MODEL } from "@/ai/chatgptDefault";
import { isolateTimers } from "./mergedTeardown";

// 상태바 "AI 연결됨" 칩 진실화 — 실제 요청 성패(전송 건강)를 함께 판정하는지.
// 배경(2026-08-19 적대 평가 P0): 설정 모양만 보고 ready 를 내보내, 모든 턴이 404 로
// 죽는 동안에도 "AI 연결됨"이라고 표시했다.
describe("aiTransportHealth", () => {
  isolateTimers();
  const proxyConfig: AiConfig = {
    authMode: "apiKey",
    baseUrl: "/api/cliproxy",
    model: "test-model",
    apiKey: "",
    maxToolCalls: 8,
    maxTokens: 1024,
  };
  describe("AI 연동 칩 × 전송 건강", () => {
    beforeEach(() => {
      resetAiTransportHealth();
    });

    it("프록시 설정이면 기본은 연결됨", () => {
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("ready");
      expect(status.label).toBe("Google 연결됨");
    });

    it("404 실패가 기록되면 '연결됨' 대신 응답 오류를 보고한다", () => {
      reportTransportHealth(false, 404, "요청 실패(404)");
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("offline");
      expect(status.label).toContain("404");
      expect(status.title).toContain("실패");
    });

    it("성공이 기록되면 자동으로 연결됨으로 복구된다", () => {
      reportTransportHealth(false, 404, "요청 실패(404)");
      reportTransportHealth(true, 200);
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("ready");
    });

    it("429 뒤 내 PC 프로그램 감지(/v1/local-agents) 성공은 한도 표시를 지우지 않고, 모델 호출 성공만 지운다", async () => {
      const reply = (status: number, headers: Record<string, string> = {}) => async () => new Response("{}", { status, headers });
      await fetchCompanion("/v1/agent/run", { method: "POST", body: "{}" }, { fetchImpl: reply(429, { "retry-after": "600" }) });
      await vi.waitFor(() => expect(getAiTransportHealth()?.status).toBe(429));
      expect(getAiTransportHealth()?.message).toContain("Retry-After 600");

      await fetchCompanion("/v1/local-agents", undefined, { fetchImpl: reply(200) });
      // fetchCompanion 은 해제를 `import("@/ai/llmClient").then(...)` 으로 미룬다 — 같은 import 를 기다리면 그보다 먼저 걸린 해제가 끝난 뒤다.
      await import("@/ai/llmClient");
      expect(getAiTransportHealth()?.status).toBe(429);

      await fetchCompanion("/v1/agent/run", { method: "POST", body: "{}" }, { fetchImpl: reply(200) });
      await vi.waitFor(() => expect(getAiTransportHealth()?.ok).toBe(true));
    });

    it("429(사용량 제한)는 연결 문제로 취급하지 않는다", () => {
      // llmClient 는 429 를 아예 기록하지 않지만, 방어적으로 기록되더라도 칩은 붉히지 않는다.
      reportTransportHealth(false, 429, "사용량 제한");
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("ready");
    });

    it("네트워크 오류(상태 코드 없음)도 응답 오류로 보고한다", () => {
      reportTransportHealth(false, undefined, "네트워크 오류(/api/x)");
      const status = getAiConnectionStatus(proxyConfig);
      expect(status.kind).toBe("offline");
    });
  });
});

describe("assistantEndpoint", () => {
  isolateTimers();
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
      model: ASSISTANT_CHATGPT_MODEL,
      liteModel: ASSISTANT_CHATGPT_MODEL,
      apiKey: "",
      maxToolCalls: 60,
      maxTokens: 32768,
      reasoningEffort: "medium",
      ...overrides,
    };
  }
  describe("resolveSurfaceAiConfig", () => {
    it("keeps the region surface tool-call ceiling at the generous chat default", () => {
      expect(REGION_SURFACE_MAX_TOOL_CALLS).toBe(2000);
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

    // 7bd18dcc0 (#4775) routes Codex batch work through Deep and sets Sol's minimum effort to medium.
    it.each([
      { setting: "legacy lite model", base: companionConfig({ model: "gpt-6.2-astra", reasoningEffort: "off" }) },
      {
        setting: "explicit execution role",
        base: companionConfig({
          model: "gpt-6.2-astra",
          liteModel: "gpt-6.2-astra",
          reasoningEffort: "high",
          roleModels: { deep: { provider: "openai-codex", model: ASSISTANT_CHATGPT_MODEL, thinkingLevel: "medium" } },
        }),
      },
    ])("Given batch surfaces with $setting When resolving Then they use Sol at medium effort", ({ base }) => {
      for (const surface of ["region", "cluster", "event-command"] as const) {
        const resolved = resolveSurfaceAiConfig(surface, base);
        expect(resolved.model, surface).toBe("gpt-6.2-sol");
        expect(resolved.reasoningEffort, surface).toBe("medium");
      }
    });

    it.each(["medium", "high"] as const)("Given supervisor surfaces at %s effort When resolving Then they keep the supervisor model and effort", (reasoningEffort) => {
      const base = companionConfig({ liteModel: "gpt-6.2-astra", reasoningEffort });

      for (const surface of ["chat", "structure-kit", "tileset-analysis"] as const) {
        const resolved = resolveSurfaceAiConfig(surface, base);
        expect(resolved.model, surface).toBe("gpt-6.2-sol");
        expect(resolved.reasoningEffort, surface).toBe(reasoningEffort);
      }
    });

    it("Given the region surface When the user allows more tool calls Then the surface ceiling wins", () => {
      const resolved = resolveSurfaceAiConfig("region", companionConfig({ maxToolCalls: 5000 }));

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
      // 준비 판정이 표면을 인자로 받지 않는 이유. Codex 실행 역할은 모델이 하나도 없을 때
      // 제공자의 기본 모델을 채우므로, 해석된 설정으로 판정하면 배치 표면은 영원히 '준비됨' 이 된다 —
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
      // Codex 실행 역할은 liteModel 이 비면 감독 model 을 따라간다. 기본값과 다른 모델로 폴백을 검증한다.
      const base = companionConfig({ model: "gpt-6.2-astra", liteModel: "" });

      expect(resolveSurfaceAiConfig("region", base).model).toBe("gpt-6.2-astra");
    });
  });
});
