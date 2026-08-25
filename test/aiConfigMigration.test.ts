// 저장된 설정 마이그레이션 회귀 스펙.
//
// loadAiConfig 는 평문 apiKey·죽은 baseUrl 을 *무시*하지만, **디스크에는 blob 이 덮어써질
// 때까지 남는다.** 인증 패널이 "브라우저에는 두지 않습니다" 라고 약속하는데 그게 미래 키에만
// 적용되면 약속이 아니다 — export·디버그 덤프·raw blob 을 읽는 코드에 그대로 실려 나간다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AI_CONFIG_STORAGE_KEY,
  AI_CONFIG_VERSION,
  loadAiConfig,
  scrubStoredAiCredentials,
} from "@/ai/llmClient";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
});

const LEGACY = {
  authMode: "apiKey",
  apiKey: "sk-legacy-LEAK",
  baseUrl: "/api/cliproxy",
  model: "cpen/gpt-5-6-luna",
  providerId: "zai",
  maxTokens: 4096,
};

describe("scrubStoredAiCredentials", () => {
  it("평문 키와 죽은 게이트웨이 주소를 디스크에서 지운다", () => {
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(LEGACY));

    const result = scrubStoredAiCredentials();

    expect(result).toMatchObject({ scrubbed: true, hadApiKey: true, hadBaseUrl: true });
    const raw = store.get(AI_CONFIG_STORAGE_KEY) ?? "";
    expect(raw).not.toContain("sk-legacy-LEAK");
    expect(raw).not.toContain("/api/cliproxy");
    const blob = JSON.parse(raw);
    expect(blob.apiKey).toBe("");
    expect(blob.baseUrl).toBe("");
    expect(blob.authMode).toBe("chatgpt");
    expect(blob.configVersion).toBe(AI_CONFIG_VERSION);
  });

  it("사용자가 고른 제공자와 나머지 설정은 보존한다", () => {
    // 지우는 것은 비밀과 죽은 주소뿐이다 — 설정을 초기화하는 함수가 아니다.
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(LEGACY));

    scrubStoredAiCredentials();

    const blob = JSON.parse(store.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(blob.providerId).toBe("zai");
    expect(blob.maxTokens).toBe(4096);
  });

  it("두 번 불러도 같다 (멱등)", () => {
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify(LEGACY));

    const first = scrubStoredAiCredentials();
    const after = store.get(AI_CONFIG_STORAGE_KEY);
    const second = scrubStoredAiCredentials();

    expect(first.scrubbed).toBe(true);
    expect(second.scrubbed).toBe(false);
    expect(store.get(AI_CONFIG_STORAGE_KEY)).toBe(after);
  });

  it("저장값이 없으면 아무것도 쓰지 않는다", () => {
    expect(scrubStoredAiCredentials()).toMatchObject({ scrubbed: false });
    expect(store.has(AI_CONFIG_STORAGE_KEY)).toBe(false);
  });

  it("깨진 blob 은 건드리지 않는다", () => {
    store.set(AI_CONFIG_STORAGE_KEY, "{not json");
    expect(scrubStoredAiCredentials()).toMatchObject({ scrubbed: false });
    expect(store.get(AI_CONFIG_STORAGE_KEY)).toBe("{not json");
  });

  it("키가 없던 설정은 hadApiKey=false 로 보고한다 (헛된 토스트 방지)", () => {
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ authMode: "chatgpt", model: "gpt-5.6-sol" }));
    expect(scrubStoredAiCredentials()).toMatchObject({ scrubbed: true, hadApiKey: false, hadBaseUrl: false });
  });
});

describe("loadAiConfig — 제공자 보존", () => {
  it("비-OAuth 제공자를 openai-codex 로 되돌리지 않는다", () => {
    // 연결 방식이 두 종류가 된 뒤로 providerId:"zai" 는 *API 키* 종류로 살아야 한다.
    // 예전 oauthProviderOrDefault 는 이것을 openai-codex 로 강제해 GLM 경로를 잃게 했다.
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "zai", model: "glm-5.3" }));

    const config = loadAiConfig();

    expect(config.providerId).toBe("zai");
    // 전송 축은 여전히 동반 서비스로 고정된다 — 제공자를 보존해도 게이트웨이로 새지 않는다.
    expect(config.authMode).toBe("chatgpt");
    expect(config.baseUrl).toBe("");
    expect(config.apiKey).toBe("");
  });

  it("모르는 제공자는 기본값으로 떨어진다", () => {
    store.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "no-such-provider" }));
    expect(loadAiConfig().providerId).toBe("google-antigravity");
  });
});
