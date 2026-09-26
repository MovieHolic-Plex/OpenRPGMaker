// 제공자 레지스트리는 정확히 둘이다 — Antigravity(Gemini) 와 Codex.
//
// 예전 스펙은 oh-my-pi 카탈로그 69종을 그대로 고정했다. 그 목록은 고를 수 없는 선택지였고
// (동반 서비스에 로그인 경로가 붙은 것은 이 둘뿐이다), 남겨 두면 화면에 거짓 표면이 생겼다.
// 이제 이 파일은 "둘뿐이고 둘 다 구독 로그인" 을 고정한다.
import { describe, expect, it } from "vitest";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import {
  DEFAULT_OH_MY_PI_PROVIDER,
  OH_MY_PI_PROVIDERS,
  getOhMyPiProvider,
  ohMyPiAuthKind,
  ohMyPiOAuthProviders,
  ohMyPiProvidersByAuthKind,
  parseOhMyPiProvider,
} from "@/ai/ohMyPiProviders";

describe("oh-my-pi provider catalog", () => {
  it("제공자는 정확히 둘이고 기본 제공자가 맨 앞이다", () => {
    expect(OH_MY_PI_PROVIDERS.map((provider) => provider.id)).toEqual([
      ANTIGRAVITY_PROVIDER_ID,
      CODEX_PROVIDER_ID,
    ]);
    expect(OH_MY_PI_PROVIDERS[0]?.id).toBe(DEFAULT_OH_MY_PI_PROVIDER);
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

  it("두 제공자 모두 구독 로그인(oauth)이다 — API 키 제공자는 없다", () => {
    for (const provider of OH_MY_PI_PROVIDERS) {
      expect(provider.authKind, provider.id).toBe("oauth");
      expect(ohMyPiAuthKind(provider.id), provider.id).toBe("oauth");
    }
    expect(ohMyPiProvidersByAuthKind("oauth")).toHaveLength(2);
    expect(ohMyPiProvidersByAuthKind("apiKey")).toHaveLength(0);
    expect(ohMyPiProvidersByAuthKind("local")).toHaveLength(0);
    expect(ohMyPiOAuthProviders().map((provider) => provider.id)).toEqual([
      ANTIGRAVITY_PROVIDER_ID,
      CODEX_PROVIDER_ID,
    ]);
  });

  it("레코드의 라벨·기본 모델이 계약대로다", () => {
    const antigravity = getOhMyPiProvider(ANTIGRAVITY_PROVIDER_ID);
    expect(antigravity?.label).toBe("Google");
    expect(antigravity?.defaultModel).toBe("gemini-3.8-flash");

    const codex = getOhMyPiProvider(CODEX_PROVIDER_ID);
    expect(codex?.label).toBe("ChatGPT");
    expect(codex?.defaultModel).toBe("gpt-5.6-sol");
  });

  it("기본 제공자는 Antigravity OAuth 다", () => {
    expect(DEFAULT_OH_MY_PI_PROVIDER).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(getOhMyPiProvider(DEFAULT_OH_MY_PI_PROVIDER)?.authKind).toBe("oauth");
  });

  it("두 id 는 그대로 통과하고, 사라진 제공자 id 는 기본 제공자로 되돌린다", () => {
    expect(parseOhMyPiProvider(ANTIGRAVITY_PROVIDER_ID)).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(parseOhMyPiProvider(CODEX_PROVIDER_ID)).toBe(CODEX_PROVIDER_ID);
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
