// 제공자 레지스트리: 앞의 셋은 Claude · Codex(ChatGPT) · Antigravity(Gemini) 이고, 나머지는 뒤에 덧붙는다.
//
// 2026-11-02 abaa03e78f 로 레지스트리가 2종 → 17종(OMP 가 로그인해 둔 제공자)으로 늘었다. 첫 항목이 권장 제공자이고
// (2026-11-23 오너 결정: Claude — 조수 기본은 Sonnet 5.5 high. 2026-11-19 에는 ChatGPT, 2026-11-16 에는 Claude 였다), 옛 저장값의 기본 제공자는 순서가 아니라 DEFAULT_OH_MY_PI_PROVIDER 다.
// 모든 제공자는 구독 로그인(oauth)이다 — API 키 제공자는 없다.
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
  RECOMMENDED_OH_MY_PI_PROVIDER,
} from "@/ai/ohMyPiProviders";

describe("oh-my-pi provider catalog", () => {
  it("앞의 셋은 고정이고 권장 제공자(Claude)가 맨 앞이다", () => {
    expect(OH_MY_PI_PROVIDERS.map((provider) => provider.id).slice(0, 3)).toEqual([
      "anthropic",
      CODEX_PROVIDER_ID,
      ANTIGRAVITY_PROVIDER_ID,
    ]);
    expect(OH_MY_PI_PROVIDERS.length).toBeGreaterThan(3);
    expect(RECOMMENDED_OH_MY_PI_PROVIDER).toBe("anthropic");
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

  it("모든 제공자가 구독 로그인(oauth)이다 — API 키 제공자는 없다", () => {
    for (const provider of OH_MY_PI_PROVIDERS) {
      expect(provider.authKind, provider.id).toBe("oauth");
      expect(ohMyPiAuthKind(provider.id), provider.id).toBe("oauth");
    }
    expect(ohMyPiProvidersByAuthKind("oauth")).toHaveLength(OH_MY_PI_PROVIDERS.length);
    expect(ohMyPiProvidersByAuthKind("apiKey")).toHaveLength(0);
    expect(ohMyPiProvidersByAuthKind("local")).toHaveLength(0);
    expect(ohMyPiOAuthProviders().map((provider) => provider.id)).toEqual(OH_MY_PI_PROVIDERS.map((provider) => provider.id));
  });

  it("레코드의 라벨·기본 모델이 계약대로다", () => {
    const antigravity = getOhMyPiProvider(ANTIGRAVITY_PROVIDER_ID);
    expect(antigravity?.label).toBe("Google");
    expect(antigravity?.defaultModel).toBe("gemini-4-argon");

    const codex = getOhMyPiProvider(CODEX_PROVIDER_ID);
    expect(codex?.label).toBe("ChatGPT");
    expect(codex?.defaultModel).toBe("gpt-6.2-sol");

    const claude = getOhMyPiProvider("anthropic");
    expect(claude?.label).toBe("Claude");
    expect(claude?.defaultModel).toBe("claude-sonnet-5-5");
  });

  it("옛 저장값을 읽을 때의 제공자는 Antigravity OAuth 다 — 권장 제공자가 Claude 로 바뀌어도 그대로다", () => {
    expect(DEFAULT_OH_MY_PI_PROVIDER).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(getOhMyPiProvider(DEFAULT_OH_MY_PI_PROVIDER)?.authKind).toBe("oauth");
  });

  it("등록된 id 는 그대로 통과하고, 사라진 제공자 id 는 기본 제공자로 되돌린다", () => {
    expect(parseOhMyPiProvider(ANTIGRAVITY_PROVIDER_ID)).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(parseOhMyPiProvider(CODEX_PROVIDER_ID)).toBe(CODEX_PROVIDER_ID);
    // anthropic·github-copilot 은 abaa03e78f 로 등록됐다 — 그대로 통과한다.
    for (const registered of ["anthropic", "github-copilot"]) {
      expect(parseOhMyPiProvider(registered), registered).toBe(registered);
    }
    // 레지스트리에 없는 id 는 저장돼 있어도 기본값으로 스냅한다.
    for (const gone of ["zai", "openai", "ollama", "not-a-provider"]) {
      expect(parseOhMyPiProvider(gone), gone).toBe(DEFAULT_OH_MY_PI_PROVIDER);
    }
    expect(parseOhMyPiProvider(undefined)).toBe(DEFAULT_OH_MY_PI_PROVIDER);
  });

  it("모르는 id 는 기본 제공자의 종류로 떨어진다 (undefined 를 만들지 않는다)", () => {
    expect(ohMyPiAuthKind("no-such-provider")).toBe("oauth");
    expect(ohMyPiAuthKind(undefined)).toBe("oauth");
  });
});
