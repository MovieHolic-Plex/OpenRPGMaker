// 전송 축(동반 서비스 vs 주입 게이트웨이)과 자격 증명 축(oauth/apiKey/local)의 분리를 고정한다.
//
// 배경: `AiConfig.authMode: "chatgpt" | "apiKey"` 하나가 두 축을 겸해서, ① baseUrl 문자열이
// 선언된 인증 모드를 덮어쓸 수 있었고 ② 68종 제공자의 authKind 가 UI 에 전혀 반영되지 않았다.
// 이 파일은 두 축이 각자 하나의 진실 원천을 갖는지 본다.
import { describe, expect, it } from "vitest";

import {
  aiTransport,
  usesOhMyPiCompanion,
  defaultAiConfig,
  type AiConfig,
} from "@/ai/llmClient";
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
  it("68종 모두 정확히 한 종류로 분류된다", () => {
    const counts = { oauth: 0, apiKey: 0, local: 0 };
    for (const provider of OH_MY_PI_PROVIDERS) {
      expect(ohMyPiAuthKind(provider.id)).toBe(provider.authKind);
      counts[provider.authKind] += 1;
    }
    expect(counts.oauth).toBe(14);
    expect(counts.local).toBe(4);
    expect(counts.oauth + counts.apiKey + counts.local).toBe(OH_MY_PI_PROVIDERS.length);
  });

  it("모르는 id 는 기본 제공자의 종류로 떨어진다 (undefined 를 만들지 않는다)", () => {
    expect(ohMyPiAuthKind("no-such-provider")).toBe("oauth"); // 기본값 google-antigravity
    expect(ohMyPiAuthKind(undefined)).toBe("oauth");
  });

  it("종류별 목록은 레지스트리와 합이 같다", () => {
    expect(ohMyPiProvidersByAuthKind("oauth")).toHaveLength(14);
    expect(ohMyPiProvidersByAuthKind("local")).toHaveLength(4);
    const total = (["oauth", "apiKey", "local"] as const)
      .reduce((sum, kind) => sum + ohMyPiProvidersByAuthKind(kind).length, 0);
    expect(total).toBe(OH_MY_PI_PROVIDERS.length);
  });

  it("종류 라벨은 원시 enum 값이 아니다 — 영어 enum 을 UI 에 흘리지 않는다", () => {
    // "API 키" 처럼 정착한 외래어는 정상이다. 막으려는 것은 `authKind` 값을 그대로 붙여
    // "Anthropic · oauth" 로 보이던 것 — 라벨이 enum 키와 같아지는 상태다.
    for (const [kind, label] of Object.entries(OH_MY_PI_AUTH_KIND_LABEL)) {
      expect(label).not.toBe(kind);
      expect(label.trim()).not.toHaveLength(0);
      expect(label).toMatch(/[가-힣]/u);
    }
  });
});

describe("에디터의 2종 선택 — 파생값이고 저장하지 않는다", () => {
  it("oauth 제공자는 구독 로그인, 나머지는 API 키 종류로 접힌다", () => {
    expect(editorConnectionKind({ ...GATEWAY, providerId: "openai-codex" })).toBe("oauth");
    expect(editorConnectionKind({ ...GATEWAY, providerId: "anthropic" })).toBe("oauth");
    expect(editorConnectionKind({ ...GATEWAY, providerId: "zai" })).toBe("apiKey");
    // local 4종은 별도 종류를 만들지 않고 API 키 쪽에 접는다("키 불필요" 안내를 붙인다).
    expect(editorConnectionKind({ ...GATEWAY, providerId: "ollama" })).toBe("apiKey");
  });

  it("종류별 제공자 수는 14 / 54 다", () => {
    expect(providersForKind("oauth")).toHaveLength(14);
    expect(providersForKind("apiKey")).toHaveLength(54);
  });

  it("구독 로그인 목록의 첫 항목은 기본 제공자다", () => {
    expect(providersForKind("oauth")[0]?.id).toBe("google-antigravity");
    expect(defaultProviderForKind("oauth")).toBe("google-antigravity");
    expect(ohMyPiAuthKind(defaultProviderForKind("apiKey"))).toBe("apiKey");
  });

  it("configForConnectionKind 는 브라우저에 비밀을 남기지 않는다", () => {
    for (const kind of ["oauth", "apiKey"] as const) {
      const next = configForConnectionKind(GATEWAY, kind);
      expect(next.authMode).toBe("chatgpt"); // 에디터는 항상 동반 서비스 전송이다
      expect(next.baseUrl).toBe("");
      expect(next.apiKey).toBe("");
      expect(editorConnectionKind(next)).toBe(kind);
    }
  });

  it("종류를 유지한 채 제공자만 바꿀 수 있다", () => {
    const base = defaultAiConfig();
    const zai = configForConnectionKind(base, "apiKey", "zai");
    expect(zai.providerId).toBe("zai");
    expect(editorConnectionKind(zai)).toBe("apiKey");
  });

  it("종류에 맞지 않는 제공자를 주면 그 종류의 기본 제공자로 스냅한다", () => {
    const snapped = configForConnectionKind(defaultAiConfig(), "apiKey", "openai-codex");
    expect(editorConnectionKind(snapped)).toBe("apiKey");
    expect(snapped.providerId).toBe(defaultProviderForKind("apiKey"));
  });

  it("기본 설정은 구독 로그인 종류다", () => {
    expect(editorConnectionKind(defaultAiConfig())).toBe("oauth");
  });
});
