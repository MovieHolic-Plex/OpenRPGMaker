import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companionPathname,
  isCompanionPath,
  resolveCompanionProvider,
  handleCompanionRequest,
} from "../scripts/lib/ohMyPiHttp.mjs";

describe("oh-my-pi companion HTTP", () => {
  it("쿼리스트링이 있어도 동반 경로로 본다", () => {
    assert.equal(companionPathname("/auth/status?provider=groq"), "/auth/status");
    assert.equal(isCompanionPath("/auth/status?provider=anthropic"), true);
    assert.equal(isCompanionPath("/auth/providers"), true);
    assert.equal(isCompanionPath("/auth/key"), true);
    assert.equal(isCompanionPath("/v1/chat/completions"), true);
    assert.equal(isCompanionPath("/other"), false);
  });

  it("provider 쿼리·헤더·본문이 없으면 openai-codex 로 둔다", () => {
    assert.equal(resolveCompanionProvider({ url: "/auth/status" }), "openai-codex");
    assert.equal(resolveCompanionProvider({ url: "/auth/status?provider=groq" }), "groq");
    assert.equal(
      resolveCompanionProvider({ url: "/v1/chat/completions", headers: { "x-rpgzzu-provider": "anthropic" } }),
      "anthropic",
    );
    assert.equal(
      resolveCompanionProvider({ url: "/v1/chat/completions", body: { provider: "openrouter" } }),
      "openrouter",
    );
  });

  it("상태·로그인·키 저장·완성을 제공자별로 넘긴다", async () => {
    const calls = [];
    const adapters = {
      listProviders: () => [{ id: "groq", label: "Groq", authKind: "apiKey" }],
      status: async (provider) => {
        calls.push(["status", provider]);
        return { connected: provider === "groq", provider };
      },
      login: async (provider, body) => {
        calls.push(["login", provider, body?.apiKey ?? ""]);
        return { verificationUrl: "https://example.test/login", userCode: "" };
      },
      saveKey: async (provider, apiKey) => {
        calls.push(["saveKey", provider, apiKey]);
        return { connected: true, provider };
      },
      refresh: async (provider) => {
        calls.push(["refresh", provider]);
        return { connected: true, provider, refreshed: true };
      },
      complete: async (provider, body) => {
        calls.push(["complete", provider, body.model]);
        return { stream: false, completion: { id: "ok", provider } };
      },
    };

    const status = await handleCompanionRequest(
      { method: "GET", url: "/auth/status?provider=groq" },
      adapters,
    );
    assert.equal(status.status, 200);
    assert.equal(status.body.connected, true);

    const login = await handleCompanionRequest(
      { method: "POST", url: "/auth/login", body: { provider: "anthropic" } },
      adapters,
    );
    assert.equal(login.body.verificationUrl.includes("example.test"), true);

    const key = await handleCompanionRequest(
      { method: "POST", url: "/auth/key", body: { provider: "groq", apiKey: "gsk-x" } },
      adapters,
    );
    assert.equal(key.body.connected, true);

    const refreshed = await handleCompanionRequest(
      { method: "POST", url: "/auth/refresh?provider=anthropic" },
      adapters,
    );
    assert.equal(refreshed.body.refreshed, true);

    const chat = await handleCompanionRequest(
      {
        method: "POST",
        url: "/v1/chat/completions",
        headers: { "x-rpgzzu-provider": "openrouter" },
        body: { model: "openai/gpt-5.5", messages: [] },
      },
      adapters,
    );
    assert.equal(chat.body.provider, "openrouter");
    assert.deepEqual(calls, [
      ["status", "groq"],
      ["login", "anthropic", ""],
      ["saveKey", "groq", "gsk-x"],
      ["refresh", "anthropic"],
      ["complete", "openrouter", "openai/gpt-5.5"],
    ]);
  });

  it("고른 제공자를 기본값(openai-codex)으로 덮어쓰지 않는다", async () => {
    let codex = 0;
    const adapters = {
      status: async (provider) => {
        if (provider === "openai-codex") codex += 1;
        return { connected: true, provider };
      },
    };
    await handleCompanionRequest({ method: "GET", url: "/auth/status?provider=kimi-code" }, adapters);
    assert.equal(codex, 0);
  });
});
