// 에디터가 고를 수 있는 제공자는 Antigravity 와 Codex 둘이다 — 셋째는 없다.
//
// 이 파일은 원래 "Antigravity 하나로 강제" 를 고정했다. 감독 요구가 바뀌어 Codex 도 1급
// 선택지가 됐으므로 계약을 뒤집되, 그때 잡았던 회귀는 그대로 지킨다:
//  1) 레지스트리에 없는(사라진·오타난) providerId 는 기본 제공자로 스냅한다 — 옛 zai/xiaomi
//     같은 id 가 살아남아 동반 서비스로 실려 나가지 못하게.
//  2) providerId 가 없는 옛 blob 도 기본 제공자(Antigravity)가 된다 — 예전에는 openai-codex 로
//     남아 이미 쓰던 사용자가 새 기본으로 오지 않았다.
//  3) 남의 네임스페이스 모델 ID 는 선택된 제공자의 기본 모델로 교정한다.
// 새로 고정하는 것: **저장된 openai-codex 선택은 load/save 왕복을 살아남는다.**
// authMode 는 이미 "chatgpt" 로 고정돼 있으므로(llmClient.ts) 이 스펙은 제공자·모델 축만 잡는다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AI_CONFIG_STORAGE_KEY,
  defaultAiConfig,
  loadAiConfig,
  saveAiConfig,
} from "@/ai/llmClient";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { DEFAULT_OH_MY_PI_PROVIDER, OH_MY_PI_PROVIDERS } from "@/ai/ohMyPiProviders";

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

function storedProviderId(): string | undefined {
  const blob = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}") as { providerId?: string };
  return blob.providerId;
}

describe("제공자는 Antigravity·Codex 둘뿐이다", () => {
  it("옛 저장값은 Antigravity 로 읽고, 새 설정은 ChatGPT 를 권한다", () => {
    expect(DEFAULT_OH_MY_PI_PROVIDER).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(defaultAiConfig().providerId).toBe(CODEX_PROVIDER_ID);
  });

  it("셋째 제공자는 존재하지 않는다", () => {
    expect(OH_MY_PI_PROVIDERS.map((provider) => provider.id)).toEqual([
      CODEX_PROVIDER_ID,
      ANTIGRAVITY_PROVIDER_ID,
    ]);
  });

  it("Codex 의 옛 공장 기본 gpt-5.6-sol 은 gpt-6.1-sol 로 올리고, 모델 없는 Codex blob 에 Gemini 를 채우지 않는다", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: CODEX_PROVIDER_ID, model: "gpt-5.6-sol" }));
    expect(loadAiConfig().model).toBe("gpt-6.1-sol");
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: CODEX_PROVIDER_ID }));
    expect(loadAiConfig().model).toBe("gpt-6.1-sol");
    expect(loadAiConfig().liteModel).toBe("gpt-6.1-sol");
  });

  it("저장된 openai-codex 는 load/save 왕복을 살아남는다", () => {
    // 이전 구현은 여기서 Antigravity 로 되돌렸다 — 사용자가 고른 Codex 를 조용히 뒤집는 동작이다.
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: CODEX_PROVIDER_ID, model: "gpt-6-sol" }));

    const loaded = loadAiConfig();
    expect(loaded.providerId).toBe(CODEX_PROVIDER_ID);
    expect(loaded.model).toBe("gpt-6-sol");

    saveAiConfig(loaded);
    expect(storedProviderId()).toBe(CODEX_PROVIDER_ID);
    expect(loadAiConfig().providerId).toBe(CODEX_PROVIDER_ID);
  });

  it("Codex 를 골라 저장하면 그대로 적힌다", () => {
    saveAiConfig({ ...defaultAiConfig(), providerId: CODEX_PROVIDER_ID, model: "gpt-6-sol", liteModel: "gpt-6-luna" });

    expect(storedProviderId()).toBe(CODEX_PROVIDER_ID);
    const loaded = loadAiConfig();
    expect(loaded.providerId).toBe(CODEX_PROVIDER_ID);
    expect(loaded.model).toBe("gpt-6-sol");
  });

  it("사라진 제공자 id 는 기본 제공자로 끌어온다", () => {
    for (const stale of ["zai", "xiaomi", "zenmux", "deepseek", "anthropic", "openai"]) {
      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: stale }));

      expect(loadAiConfig().providerId, stale).toBe(ANTIGRAVITY_PROVIDER_ID);
    }
  });

  it("providerId 가 없는 옛 blob 도 Antigravity 다 (예전엔 openai-codex 로 남았다)", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gpt-5.6-sol" }));

    expect(loadAiConfig().providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
  });

  it("알 수 없는 제공자 문자열도 Antigravity 다", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "made-up-provider" }));

    expect(loadAiConfig().providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
  });

  it("사라진 제공자로 저장을 시도해도 디스크에는 두 id 중 하나만 남는다", () => {
    saveAiConfig({ ...defaultAiConfig(), providerId: "zai" });

    expect(storedProviderId()).toBe(ANTIGRAVITY_PROVIDER_ID);
    expect(loadAiConfig().providerId).toBe(ANTIGRAVITY_PROVIDER_ID);
  });
});

describe("명시적 모델 선택은 자동으로 대체하지 않는다", () => {
  it("Antigravity에서도 명시적 모델 ID를 유지하여 전송 시 오류를 드러낸다", () => {
    for (const stale of ["z-ai/glm-5.2-ultrafast", "cpen/gpt-5-6-luna", "gpt-5.6-sol", "claude-opus-4-8", "mimo-v2.5"]) {
      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
        providerId: ANTIGRAVITY_PROVIDER_ID,
        model: stale,
        liteModel: stale,
      }));

      const loaded = loadAiConfig();
      expect(loaded.model, stale).toBe(stale);
      expect(loaded.liteModel, stale).toBe(stale);
    }
  });

  it("Codex에서도 명시적 모델 ID를 유지한다", () => {
    // Preserve both selections; the exact runtime resolver rejects unsupported combinations.
    for (const stale of ["gemini-3.7-flash", "z-ai/glm-5.2-ultrafast", "cpen/gpt-5-6-luna", "gpt-5.1-codex"]) {
      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
        providerId: CODEX_PROVIDER_ID,
        model: stale,
        liteModel: stale,
      }));

      const loaded = loadAiConfig();
      expect(loaded.providerId, stale).toBe(CODEX_PROVIDER_ID);
      expect(loaded.model, stale).toBe(stale);
      expect(loaded.liteModel, stale).toBe(stale);
    }
  });

  // 2026-08-26 실측: 기본값을 한동안 `gemini-3.7-flash-high` 로 강제했는데 Cloud Code Assist 가
  // 그 ID 를 404 `Requested entity was not found` 로 거부한다 — Antigravity 에서 `-high` 는
  // 독립 모델이 아니라 `thinking.effortRouting` 의 대상 이름이다. 그 사이에 에디터를 켠
  // 잘못된 ID는 그대로 드러내고 모델 설정에서 수정하게 한다.
  it("잘못된 사고 강도 변형도 몰래 대체하지 않는다", () => {
    for (const broken of ["gemini-3.7-flash-high", "gemini-3.7-flash-medium", "gemini-3.7-flash-low"]) {
      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: broken, liteModel: broken }));

      const loaded = loadAiConfig();
      expect(loaded.model, broken).toBe(broken);
      expect(loaded.liteModel, broken).toBe(broken);
    }
  });

  it("gemini 변형은 직접 입력한 값을 존중한다(카탈로그를 화이트리스트로 쓰지 않는다)", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gemini-9-experimental" }));

    expect(loadAiConfig().model).toBe("gemini-9-experimental");
  });
});
