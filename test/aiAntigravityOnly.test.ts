// 에디터의 모든 AI 를 Antigravity 하나로 강제한다 — 잔여 경로를 남기지 않는다 (감독 지시 2026-08-26).
//
// 실측한 잔여(2026-08-26):
//  1) loadAiConfig 가 저장된 providerId 를 **그대로 보존**했다. providerId:"zai" 로 저장된
//     설정은 계속 zai 로 살아 있었고, providerId 가 없는 옛 blob 은 "openai-codex" 로
//     남았다 — 즉 이미 쓰던 사용자는 Antigravity 로 오지 않았다.
//  2) saveAiConfig 가 아무 값이나 그대로 썼다 — UI 를 잠가도 프로그램 경로로 되돌릴 수 있었다.
//  3) 설정 모달에 제공자 select(ai-oh-my-pi-provider)와 ChatGPT 퀵 카드가 있어 손으로
//     다른 제공자를 고를 수 있었다.
// authMode 는 이미 "chatgpt" 로 고정돼 있으므로(llmClient.ts) 이 스펙은 제공자 축만 잡는다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AI_CONFIG_STORAGE_KEY,
  defaultAiConfig,
  loadAiConfig,
  saveAiConfig,
} from "@/ai/llmClient";
import { DEFAULT_OH_MY_PI_PROVIDER } from "@/ai/ohMyPiProviders";

const FORCED_PROVIDER = "google-antigravity";
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

describe("Antigravity 강제 통일", () => {
  it("공장 기본 제공자가 Antigravity 다", () => {
    expect(DEFAULT_OH_MY_PI_PROVIDER).toBe(FORCED_PROVIDER);
    expect(defaultAiConfig().providerId).toBe(FORCED_PROVIDER);
  });

  it("저장된 다른 제공자는 로드 시 Antigravity 로 끌어온다", () => {
    for (const stored of ["zai", "openai-codex", "xiaomi", "zenmux", "deepseek"]) {
      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: stored }));

      expect(loadAiConfig().providerId, stored).toBe(FORCED_PROVIDER);
    }
  });

  it("providerId 가 없는 옛 blob 도 Antigravity 다 (예전엔 openai-codex 로 남았다)", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gpt-5.6-sol" }));

    expect(loadAiConfig().providerId).toBe(FORCED_PROVIDER);
  });

  it("알 수 없는 제공자 문자열도 Antigravity 다", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "made-up-provider" }));

    expect(loadAiConfig().providerId).toBe(FORCED_PROVIDER);
  });

  it("다른 제공자로 저장을 시도해도 Antigravity 로 적혀 되돌릴 구멍이 없다", () => {
    saveAiConfig({ ...defaultAiConfig(), providerId: "zai" });

    const written = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}") as { providerId?: string };
    expect(written.providerId).toBe(FORCED_PROVIDER);
    expect(loadAiConfig().providerId).toBe(FORCED_PROVIDER);
  });

  // 제공자를 하나로 못박으면 모델 검증도 그 하나를 기준으로 서야 한다. 예전 검증은 Codex
  // 경로만 막았으므로, 제공자를 강제한 직후에는 남의 네임스페이스 ID(z-ai/…, cpen/…, gpt-…)가
  // 그대로 통과해 Antigravity 로 실려 400 이 되는 구멍이 생겼다. 그 구멍까지 막는다.
  it("남의 네임스페이스 모델이 저장돼 있으면 강제 기본으로 교정한다", () => {
    for (const stale of ["z-ai/glm-5.2-ultrafast", "cpen/gpt-5-6-luna", "gpt-5.6-sol", "claude-opus-4-8", "mimo-v2.5"]) {
      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: stale, liteModel: stale }));

      const loaded = loadAiConfig();
      expect(loaded.model, stale).toBe("gemini-3.7-flash");
      expect(loaded.liteModel, stale).toBe("gemini-3.7-flash");
    }
  });

  // 2026-08-26 실측: 기본값을 한동안 `gemini-3.7-flash-high` 로 강제했는데 Cloud Code Assist 가
  // 그 ID 를 404 `Requested entity was not found` 로 거부한다 — Antigravity 에서 `-high` 는
   // 독립 모델이 아니라 `thinking.effortRouting` 의 대상 이름이다. 그 사이에 에디터를 켠
  // 사용자의 localStorage 에는 404 나는 ID 가 남아 있으므로, 로드할 때 스스로 낫게 만든다.
  it("사고 강도 변형(-high/-medium/-low)이 저장돼 있으면 기본 모델로 교정한다", () => {
    for (const broken of ["gemini-3.7-flash-high", "gemini-3.7-flash-medium", "gemini-3.7-flash-low"]) {
      storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: broken, liteModel: broken }));

      const loaded = loadAiConfig();
      expect(loaded.model, broken).toBe("gemini-3.7-flash");
      expect(loaded.liteModel, broken).toBe("gemini-3.7-flash");
    }
  });

  it("gemini 변형은 직접 입력한 값을 존중한다(카탈로그를 화이트리스트로 쓰지 않는다)", () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "gemini-9-experimental" }));

    expect(loadAiConfig().model).toBe("gemini-9-experimental");
  });
});
