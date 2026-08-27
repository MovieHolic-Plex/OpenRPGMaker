// 전송 축(동반 서비스 vs 주입 게이트웨이)과 자격 증명 축(oauth/apiKey/local)의 분리를 고정한다.
//
// 배경: `AiConfig.authMode: "chatgpt" | "apiKey"` 하나가 두 축을 겸해서, ① baseUrl 문자열이
// 선언된 인증 모드를 덮어쓸 수 있었고 ② 제공자의 authKind 가 UI 에 전혀 반영되지 않았다.
// 이 파일은 두 축이 각자 하나의 진실 원천을 갖는지, 그리고 **두 제공자가 모두 선택 가능한지** 본다.
import { describe, expect, it } from "vitest";

import {
  aiTransport,
  usesOhMyPiCompanion,
  defaultAiConfig,
  type AiConfig,
} from "@/ai/llmClient";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import {
  OH_MY_PI_AUTH_KIND_LABEL,
  OH_MY_PI_PROVIDERS,
  ohMyPiAuthKind,
  ohMyPiProvidersByAuthKind,
} from "@/ai/ohMyPiProviders";
import {
  configForConnectionKind,
  defaultProviderForKind,
  editorConnectionKind,
  editorHasProviderChoice,
  providersForKind,
} from "@/ai/aiConnectionKind";

const GATEWAY: AiConfig = {
  authMode: "apiKey",
  baseUrl: "https://gateway.invalid/v1",
  model: "some/model",
  apiKey: "sk-injected",
  maxToolCalls: 8,
  maxTokens: 1024,
};

describe("전송 축 — authMode 만이 정한다", () => {
  it("authMode:chatgpt 는 동반 서비스 전송이다", () => {
    expect(aiTransport({ ...GATEWAY, authMode: "chatgpt" })).toBe("companion");
    expect(usesOhMyPiCompanion({ ...GATEWAY, authMode: "chatgpt" })).toBe(true);
  });

  it("authMode:apiKey 는 게이트웨이 전송이다", () => {
    expect(aiTransport(GATEWAY)).toBe("gateway");
    expect(usesOhMyPiCompanion(GATEWAY)).toBe(false);
  });

  it("baseUrl 문자열이 전송 축을 덮어쓰지 못한다", () => {
    // 옛 동작: isCompanionBaseUrl(baseUrl) 이 true 면 authMode:"apiKey" 인데도 동반 서비스로
    // 라우팅했다. 문자열이 선언된 모드를 이기는 구조라, 주입 설정의 의도를 조용히 바꿨다.
    for (const baseUrl of ["/v1", "http://127.0.0.1:17832/v1", "http://localhost:17832/v1"]) {
      expect(aiTransport({ ...GATEWAY, baseUrl })).toBe("gateway");
      expect(usesOhMyPiCompanion({ ...GATEWAY, baseUrl })).toBe(false);
    }
  });
});

describe("자격 증명 축 — providerId 만이 정한다", () => {
  it("두 제공자가 모두 oauth 로 분류된다", () => {
    for (const provider of OH_MY_PI_PROVIDERS) {
      expect(ohMyPiAuthKind(provider.id), provider.id).toBe(provider.authKind);
      expect(provider.authKind, provider.id).toBe("oauth");
    }
    expect(ohMyPiProvidersByAuthKind("oauth")).toHaveLength(OH_MY_PI_PROVIDERS.length);
    // apiKey·local 제공자는 없다 — 그래서 "API 키" 종류에 내놓을 제공자가 없다.
    expect(ohMyPiProvidersByAuthKind("apiKey")).toHaveLength(0);
    expect(ohMyPiProvidersByAuthKind("local")).toHaveLength(0);
  });

  it("모르는 id 는 기본 제공자의 종류로 떨어진다 (undefined 를 만들지 않는다)", () => {
    expect(ohMyPiAuthKind("no-such-provider")).toBe("oauth");
    expect(ohMyPiAuthKind(undefined)).toBe("oauth");
  });

  it("종류 라벨은 원시 enum 값이 아니다 — 영어 enum 을 UI 에 흘리지 않는다", () => {
    // "API 키" 처럼 정착한 외래어는 정상이다. 막으려는 것은 `authKind` 값을 그대로 붙여
    // "OpenAI Codex · oauth" 로 보이던 것 — 라벨이 enum 키와 같아지는 상태다.
    for (const [kind, label] of Object.entries(OH_MY_PI_AUTH_KIND_LABEL)) {
      expect(label).not.toBe(kind);
      expect(label.trim()).not.toHaveLength(0);
      expect(label).toMatch(/[가-힣]/u);
    }
  });
});

describe("에디터의 제공자 선택 — 두 구독 로그인", () => {
  it("두 제공자 모두 구독 로그인 종류로 읽힌다", () => {
    expect(editorConnectionKind({ ...GATEWAY, providerId: CODEX_PROVIDER_ID })).toBe("oauth");
    expect(editorConnectionKind({ ...GATEWAY, providerId: ANTIGRAVITY_PROVIDER_ID })).toBe("oauth");
    // 사라진 제공자 id 는 기본 제공자(oauth)로 스냅되므로 여기서도 oauth 다.
    expect(editorConnectionKind({ ...GATEWAY, providerId: "zai" })).toBe("oauth");
  });

  it("종류와 무관하게 두 제공자를 노출하고, 사용자에게 선택권이 있다", () => {
    // 이전 계약은 "Antigravity 하나만" 이었다. 감독 요구가 바뀌어 Codex 도 1급 선택지다.
    for (const kind of ["oauth", "apiKey"] as const) {
      expect(providersForKind(kind).map((provider) => provider.id)).toEqual([
        ANTIGRAVITY_PROVIDER_ID,
        CODEX_PROVIDER_ID,
      ]);
    }
    expect(providersForKind("oauth")).toEqual(providersForKind("apiKey"));
    expect(editorHasProviderChoice()).toBe(true);
  });

  it("목록의 첫 항목은 기본 제공자이고 두 종류의 기본값이 같다", () => {
    expect(providersForKind("oauth")[0]?.id).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(defaultProviderForKind("oauth")).toBe(ANTIGRAVITY_PROVIDER_ID);
    // "API 키" 쪽에 내놓을 제공자가 없으므로 가짜 apiKey 제공자를 만들지 않고 같은 기본값을 쓴다.
    expect(defaultProviderForKind("apiKey")).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(ohMyPiAuthKind(defaultProviderForKind("apiKey"))).toBe("oauth");
  });

  it("configForConnectionKind 는 브라우저에 비밀을 남기지 않는다", () => {
    for (const kind of ["oauth", "apiKey"] as const) {
      const next = configForConnectionKind(GATEWAY, kind);
      expect(next.authMode).toBe("chatgpt"); // 에디터는 항상 동반 서비스 전송이다
      expect(next.baseUrl).toBe("");
      expect(next.apiKey).toBe("");
      // 두 제공자가 모두 oauth 이므로 파생 종류는 항상 oauth 다.
      expect(editorConnectionKind(next)).toBe("oauth");
    }
  });

  it("제공자를 Codex 로 바꿀 수 있고 되돌릴 수도 있다", () => {
    const base = defaultAiConfig();
    const codex = configForConnectionKind(base, "oauth", CODEX_PROVIDER_ID);
    expect(codex.providerId).toBe(CODEX_PROVIDER_ID);

    const back = configForConnectionKind(codex, "oauth", ANTIGRAVITY_PROVIDER_ID);
    expect(back.providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
  });

  it("제공자를 지정하지 않으면 기존 선택을 유지한다", () => {
    const codex = { ...defaultAiConfig(), providerId: CODEX_PROVIDER_ID };
    expect(configForConnectionKind(codex, "oauth").providerId).toBe(CODEX_PROVIDER_ID);
    expect(configForConnectionKind(codex, "apiKey").providerId).toBe(CODEX_PROVIDER_ID);
  });

  it("레지스트리에 없는 제공자를 주면 기본 제공자로 스냅한다", () => {
    const snapped = configForConnectionKind(defaultAiConfig(), "apiKey", "zai");
    expect(snapped.providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
  });

  it("기본 설정은 구독 로그인 종류다", () => {
    expect(editorConnectionKind(defaultAiConfig())).toBe("oauth");
  });
});
