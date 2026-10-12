// 제공자 레지스트리는 ChatGPT·Google·Grok 구독 로그인과 Grok API 키다.
import { describe, expect, it } from "vitest";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { XAI_OAUTH_PROVIDER_ID, XAI_PROVIDER_ID } from "@/ai/xaiProvider";
import {
  DEFAULT_OH_MY_PI_PROVIDER,
  OH_MY_PI_PROVIDERS,
  getOhMyPiProvider,
  ohMyPiAuthKind,
  ohMyPiOAuthProviders,
  ohMyPiProvidersByAuthKind,
  parseOhMyPiProvider,
  RECOMMENDED_OH_MY_PI_PROVIDER,
} from "@/ai/ohMyPiProviders";

describe("oh-my-pi provider catalog", () => {
  it("권장 제공자(ChatGPT)가 맨 앞이고 Grok 구독 다음에 API 키가 있다", () => {
    expect(OH_MY_PI_PROVIDERS.map((provider) => provider.id)).toEqual([
      CODEX_PROVIDER_ID,
      ANTIGRAVITY_PROVIDER_ID,
      XAI_OAUTH_PROVIDER_ID,
      XAI_PROVIDER_ID,
    ]);
    expect(OH_MY_PI_PROVIDERS[0]?.id).toBe(RECOMMENDED_OH_MY_PI_PROVIDER);
  });

  it("id 문자열은 oauth/credentials.ts 의 상수와 같은 출처다", () => {
    // 전송 계층(packRequestApiKey)과 UI 가 같은 상수를 봐야 한 쪽만 개명되는 사고가 없다.
    expect(ANTIGRAVITY_PROVIDER_ID).toBe("google-antigravity");
    expect(CODEX_PROVIDER_ID).toBe("openai-codex");
  });

  it("id 가 겹치지 않는다", () => {
    const ids = OH_MY_PI_PROVIDERS.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("구독 로그인은 ChatGPT·Google·Grok 이고 Grok API 만 키다", () => {
    expect(ohMyPiAuthKind(CODEX_PROVIDER_ID)).toBe("oauth");
    expect(ohMyPiAuthKind(ANTIGRAVITY_PROVIDER_ID)).toBe("oauth");
    expect(ohMyPiAuthKind(XAI_OAUTH_PROVIDER_ID)).toBe("oauth");
    expect(ohMyPiAuthKind(XAI_PROVIDER_ID)).toBe("apiKey");
    expect(ohMyPiProvidersByAuthKind("oauth").map((provider) => provider.id)).toEqual([
      CODEX_PROVIDER_ID,
      ANTIGRAVITY_PROVIDER_ID,
      XAI_OAUTH_PROVIDER_ID,
    ]);
    expect(ohMyPiProvidersByAuthKind("apiKey").map((provider) => provider.id)).toEqual([XAI_PROVIDER_ID]);
    expect(ohMyPiProvidersByAuthKind("local")).toHaveLength(0);
    expect(ohMyPiOAuthProviders().map((provider) => provider.id)).toEqual([
      CODEX_PROVIDER_ID,
      ANTIGRAVITY_PROVIDER_ID,
      XAI_OAUTH_PROVIDER_ID,
    ]);
  });

  it("레코드의 라벨·기본 모델이 계약대로다", () => {
    const antigravity = getOhMyPiProvider(ANTIGRAVITY_PROVIDER_ID);
    expect(antigravity?.label).toBe("Google");
    expect(antigravity?.defaultModel).toBe("gemini-3.8-flash");

    const codex = getOhMyPiProvider(CODEX_PROVIDER_ID);
    expect(codex?.label).toBe("ChatGPT");
    expect(codex?.defaultModel).toBe("gpt-6.1-sol");

    const grok = getOhMyPiProvider(XAI_OAUTH_PROVIDER_ID);
    expect(grok?.label).toBe("Grok");
    expect(grok?.defaultModel).toBe("grok-4.7");
    expect(grok?.envVars).toEqual(["XAI_OAUTH_TOKEN"]);
    expect(grok?.authKind).toBe("oauth");

    const grokKey = getOhMyPiProvider(XAI_PROVIDER_ID);
    expect(grokKey?.label).toBe("Grok API");
    expect(grokKey?.defaultModel).toBe("grok-4.7");
    expect(grokKey?.envVars).toEqual(["XAI_API_KEY"]);
  });

  it("옛 저장값을 읽을 때의 제공자는 Antigravity OAuth 다", () => {
    expect(DEFAULT_OH_MY_PI_PROVIDER).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(getOhMyPiProvider(DEFAULT_OH_MY_PI_PROVIDER)?.authKind).toBe("oauth");
  });

  it("두 id 는 그대로 통과하고, 사라진 제공자 id 는 기본 제공자로 되돌린다", () => {
    expect(parseOhMyPiProvider(ANTIGRAVITY_PROVIDER_ID)).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(parseOhMyPiProvider(CODEX_PROVIDER_ID)).toBe(CODEX_PROVIDER_ID);
    expect(parseOhMyPiProvider(XAI_PROVIDER_ID)).toBe(XAI_PROVIDER_ID);
    expect(parseOhMyPiProvider(XAI_OAUTH_PROVIDER_ID)).toBe(XAI_OAUTH_PROVIDER_ID);
    // 옛 레지스트리에 있던 id 는 이제 존재하지 않는다 — 저장돼 있어도 기본값으로 스냅한다.
    for (const gone of ["anthropic", "zai", "openai", "ollama", "github-copilot", "not-a-provider"]) {
      expect(parseOhMyPiProvider(gone), gone).toBe(DEFAULT_OH_MY_PI_PROVIDER);
    }
    expect(parseOhMyPiProvider(undefined)).toBe(DEFAULT_OH_MY_PI_PROVIDER);
  });

  it("모르는 id 는 기본 제공자의 종류로 떨어진다 (undefined 를 만들지 않는다)", () => {
    expect(ohMyPiAuthKind("no-such-provider")).toBe("oauth");
    expect(ohMyPiAuthKind(undefined)).toBe("oauth");
  });
});
