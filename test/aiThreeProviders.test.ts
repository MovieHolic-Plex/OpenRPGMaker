/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCachedAuthStatus } from "@/ai/authStatusCache";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { renderAiThreeProviders } from "@/editor/panels/aiThreeProviders";
import { getStartupAiHealth, resetStartupAiHealthForTests, runStartupAiHealthCheck } from "@/editor/panels/aiStartupHealth";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

describe("AI 3대장 설정(GPT · Claude · Gemini) 및 시작 시 health 점검", () => {
  let restoreDom: () => void;
  let storage: Map<string, string>;

  beforeEach(() => {
    clearCachedAuthStatus();
    resetStartupAiHealthForTests();
    restoreDom = installFakeDom();
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    });
  });

  afterEach(() => {
    resetStartupAiHealthForTests();
    clearCachedAuthStatus();
    restoreDom();
    vi.unstubAllGlobals();
  });

  it("에디터 시작 점검이 ChatGPT(OAuth·사용량)와 Claude(로컬 CLI health)를 함께 확인한다", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
      const url = new URL(input, "http://oprn.invalid");
      calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
      if (url.pathname === "/auth/status" && url.searchParams.get("provider") === "openai-codex") {
        return Response.json({ connected: true, authKind: "oauth", planType: "pro", accountEmail: "dev@example.invalid" });
      }
      if (url.pathname === "/auth/usage" && url.searchParams.get("provider") === "openai-codex") {
        return Response.json({
          provider: "openai-codex",
          readable: true,
          fetchedAt: Date.now(),
          windows: [{ label: "5h", remainingFraction: 0.72 }],
        });
      }
      if (url.pathname === "/v1/local-agents") {
        return Response.json({
          clis: [
            { id: "claude", label: "Claude Code", state: "ready", stateLabel: "연결됨", found: true, billing: "subscription", models: [], defaults: { routine: "claude-sonnet-5-5", deep: "claude-sonnet-5-5" }, install: { command: "", help: "", url: "" }, login: { command: "", help: "" } },
            { id: "codex", label: "Codex (ChatGPT)", state: "ready", stateLabel: "연결됨", found: true, billing: "subscription", models: [], defaults: { routine: "gpt-6.2-sol", deep: "gpt-6.2-sol" }, install: { command: "", help: "", url: "" }, login: { command: "", help: "" } },
            { id: "gemini", label: "Gemini CLI", state: "not-installed", stateLabel: "설치 필요", found: false, billing: "unknown", models: [], defaults: { routine: "", deep: "" }, install: { command: "", help: "", url: "" }, login: { command: "", help: "" } },
          ],
        });
      }
      if (url.pathname === "/v1/local-agents/health") {
        return Response.json({ ok: true, ms: 420, reply: "OK" });
      }
      return Response.json({ connected: false });
    });

    const result = await runStartupAiHealthCheck({ force: true, liveHealth: true });
    expect(result.gpt).toMatchObject({
      state: "ok",
      routeProviderId: "openai-codex",
      via: "oauth",
      verifiedLive: true,
      planType: "pro",
      accountEmail: "dev@example.invalid",
    });
    expect(result.claude).toMatchObject({
      state: "ok",
      routeProviderId: "local-cli:claude",
      via: "local-cli",
      verifiedLive: true,
    });
    expect(result.gemini.state).toBe("needs-login");
    expect(calls.some((entry) => entry.includes("/v1/local-agents/health"))).toBe(true);
    expect(getStartupAiHealth().gpt.verifiedLive).toBe(true);
  });

  it("GPT · Claude · Gemini 3버튼을 보여 주고 클릭으로 선택·전환한다", async () => {
    // 공장 기본은 GPT(openai-codex)이므로, 다른 제공자(Claude)에서 GPT로 전환하는 경로를 본다.
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ authMode: "chatgpt", providerId: "anthropic" }));
    vi.stubGlobal("fetch", async (input: string) => {
      const url = new URL(input, "http://oprn.invalid");
      if (url.pathname === "/auth/status" && url.searchParams.get("provider") === "openai-codex") {
        return Response.json({ connected: true, authKind: "oauth", planType: "plus", accountEmail: "user@example.invalid" });
      }
      if (url.pathname === "/v1/local-agents") return Response.json({ clis: [] });
      return Response.json({ connected: false });
    });

    await runStartupAiHealthCheck({ force: true, liveHealth: false });
    const onSelectOAuthProvider = vi.fn();
    const onStartOAuth = vi.fn();
    const view = renderAiThreeProviders({
      onStartOAuth,
      onDisconnectOAuth: vi.fn(),
      onSelectOAuthProvider,
      onConnectedCompat: vi.fn(),
    });
    const root = view.element as unknown as FakeElement;

    const gptBtn = findByTestId(root, "ai-provider-btn-gpt")!;
    const claudeBtn = findByTestId(root, "ai-provider-btn-claude")!;
    const geminiBtn = findByTestId(root, "ai-provider-btn-gemini")!;
    expect(gptBtn).not.toBeNull();
    expect(claudeBtn).not.toBeNull();
    expect(geminiBtn).not.toBeNull();

    gptBtn.click();
    expect(gptBtn.getAttribute("aria-selected")).toBe("true");
    findByTestId(root, "ai-provider-use-gpt")?.click();
    expect(onSelectOAuthProvider).toHaveBeenCalledWith("openai-codex", "gpt-6.2-sol", "high");

    geminiBtn.click();
    expect(geminiBtn.getAttribute("aria-selected")).toBe("true");
    // Google 계정 직접 OAuth 로그인은 계정 정지 위험으로 비활성화됨 — API 키 또는 공식 agy ACP 로 연결한다.
    expect(findByTestId(root, "ai-provider-login-gemini")).toBeNull();
    expect(findByTestId(root, "ai-provider-apikey-toggle-gemini")).not.toBeNull();
    expect(onStartOAuth).not.toHaveBeenCalled();

    view.dispose();
  });

  it("공식 agy ACP 구독으로 Gemini를 연결하고 다중 구독 자동 전환 막대를 표시한다", async () => {
    vi.stubGlobal("fetch", async (input: string) => {
      const url = new URL(input, "http://oprn.invalid");
      if (url.pathname === "/auth/status" && url.searchParams.get("provider") === "openai-codex") {
        return Response.json({ connected: true, authKind: "oauth", planType: "pro" });
      }
      if (url.pathname === "/v1/local-agents") {
        return Response.json({
          clis: [
            { id: "agy", label: "Antigravity (agy)", state: "ready", stateLabel: "연결됨", found: true, billing: "subscription", authMethod: "Google ACP", models: [], defaults: { routine: "gemini-4-argon", deep: "gemini-4-neon" }, install: { command: "", help: "", url: "" }, login: { command: "agy acp --login", help: "" } },
          ],
        });
      }
      return Response.json({ connected: false });
    });

    const health = await runStartupAiHealthCheck({ force: true, liveHealth: false });
    expect(health.gemini).toMatchObject({
      state: "ok",
      routeProviderId: "local-cli:agy",
      via: "local-cli",
    });

    const view = renderAiThreeProviders({
      onStartOAuth: vi.fn(),
      onDisconnectOAuth: vi.fn(),
      onSelectOAuthProvider: vi.fn(),
      onConnectedCompat: vi.fn(),
    });
    const root = view.element as unknown as FakeElement;
    const multiBar = findByTestId(root, "ai-multi-sub-bar")!;
    expect(multiBar.hidden).toBe(false);
    expect(multiBar.textContent).toContain("연결된 구독 2");
    expect(multiBar.textContent).toContain("GPT");
    expect(multiBar.textContent).toContain("Gemini");

    findByTestId(root, "ai-provider-btn-gemini")?.click();
    findByTestId(root, "ai-provider-use-gemini")?.click();
    expect(findByTestId(root, "ai-multi-sub-auto")).not.toBeNull();

    view.dispose();
  });
});
