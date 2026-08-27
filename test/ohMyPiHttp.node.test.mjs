import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companionPathname,
  isCompanionPath,
  resolveCompanionProvider,
  handleCompanionRequest,
  companionPublicOrigin,
  publishLoopbackLaunch,
} from "../scripts/lib/ohMyPiHttp.mjs";

describe("oh-my-pi companion HTTP", () => {
  it("쿼리스트링이 있어도 동반 경로로 본다", () => {
    assert.equal(companionPathname("/auth/status?provider=groq"), "/auth/status");
    assert.equal(isCompanionPath("/auth/status?provider=anthropic"), true);
    assert.equal(isCompanionPath("/auth/providers"), true);
    assert.equal(isCompanionPath("/auth/key"), true);
    assert.equal(isCompanionPath("/auth/logout"), true);
    assert.equal(isCompanionPath("/v1/chat/completions"), true);
    assert.equal(isCompanionPath("/oauth/launch"), true);
    assert.equal(isCompanionPath("/auth/oauth-paste"), true);
    assert.equal(isCompanionPath("/other"), false);
  });

  it("공개 origin 은 env 가 최우선이고, 없으면 Origin/Host 를 쓴다", () => {
    assert.equal(
      companionPublicOrigin({ headers: { origin: "http://mdc-server:9888" } }, {}),
      "http://mdc-server:9888",
    );
    assert.equal(
      companionPublicOrigin({ headers: { host: "mdc-server:9888" } }, {}),
      "http://mdc-server:9888",
    );
    assert.equal(
      companionPublicOrigin(
        { headers: { origin: "http://127.0.0.1:9888" } },
        { RPG_ZZU_PUBLIC_ORIGIN: "http://mdc-server:9888" },
      ),
      "http://mdc-server:9888",
    );
    assert.equal(companionPublicOrigin({ headers: { host: "127.0.0.1:9888" } }, {}), "");
  });

  it("루프백 launch URL 을 페이지 origin 의 /oauth/launch 로 바꾼다", () => {
    const next = publishLoopbackLaunch(
      { verificationUrl: "http://127.0.0.1:51121/launch", userCode: "" },
      "http://mdc-server:9888",
    );
    assert.equal(next.verificationUrl, "http://mdc-server:9888/oauth/launch?port=51121");
    assert.equal(next.pasteCallback, true);
  });

  it("provider 쿼리·헤더·본문이 없으면 google-antigravity 로 둔다", () => {
    assert.equal(resolveCompanionProvider({ url: "/auth/status" }), "google-antigravity");
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
      logout: async (provider) => {
        calls.push(["logout", provider]);
        return { connected: false, provider, removed: true };
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

    const loggedOut = await handleCompanionRequest(
      { method: "POST", url: "/auth/logout?provider=groq" },
      adapters,
    );
    assert.equal(loggedOut.status, 200);
    assert.equal(loggedOut.body.connected, false);
    assert.equal(loggedOut.body.removed, true);

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
      ["logout", "groq"],
      ["complete", "openrouter", "openai/gpt-5.5"],
    ]);
  });

  it("원격 Origin 으로 로그인하면 launch URL 을 공개 origin 으로 바꾼다", async () => {
    const login = await handleCompanionRequest(
      {
        method: "POST",
        url: "/auth/login",
        headers: { origin: "http://mdc-server:9888" },
        body: { provider: "google-antigravity" },
      },
      {
        login: async () => ({ verificationUrl: "http://127.0.0.1:34031/launch", userCode: "" }),
      },
    );
    assert.equal(login.status, 200);
    assert.equal(login.body.verificationUrl, "http://mdc-server:9888/oauth/launch?port=34031");
    assert.equal(login.body.pasteCallback, true);
  });

  it("GET /oauth/launch 는 루프백 launch 의 Location 으로 302 한다", async () => {
    publishLoopbackLaunch(
      { verificationUrl: "http://127.0.0.1:51121/launch" },
      "http://mdc-server:9888",
    );
    const original = globalThis.fetch;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), "http://127.0.0.1:51121/launch");
      return new Response(null, {
        status: 302,
        headers: { Location: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
      });
    };
    try {
      const result = await handleCompanionRequest(
        { method: "GET", url: "/oauth/launch?port=51121" },
        {},
      );
      assert.equal(result.status, 302);
      assert.equal(result.headers.Location.includes("accounts.google.com"), true);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("POST /auth/oauth-paste 는 127.0.0.1 oauth-callback 만 서버가 대신 GET 한다", async () => {
    const original = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url) => {
      seen.push(String(url));
      return new Response("ok", { status: 200 });
    };
    try {
      const rejected = await handleCompanionRequest(
        {
          method: "POST",
          url: "/auth/oauth-paste",
          body: { url: "http://mdc-server:9888/oauth-callback?code=abc" },
        },
        {},
      );
      assert.equal(rejected.status, 400);

      const ok = await handleCompanionRequest(
        {
          method: "POST",
          url: "/auth/oauth-paste",
          body: { url: "http://127.0.0.1:51121/oauth-callback?code=abc&state=s" },
        },
        {},
      );
      assert.equal(ok.status, 200);
      assert.equal(ok.body.ok, true);
      assert.equal(seen.length, 1);
      assert.match(seen[0], /127\.0\.0\.1:51121\/oauth-callback/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("고른 제공자를 기본값(google-antigravity)으로 덮어쓰지 않는다", async () => {
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
