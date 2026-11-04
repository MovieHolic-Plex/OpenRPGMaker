// 모델 카탈로그는 두 제공자(Antigravity·Codex)만 해석한다.
//
// 옛 스펙은 게이트웨이/cpenrouter/qwencloud 그룹(glm-5.2-ultrafast, cpen/…, qwen3.8-max-preview)
// 을 고정했다. 그 모델들에 닿을 제공자가 레지스트리에서 사라졌으므로 그 계약은 보호할 대상이
// 없어졌다 — 대신 "두 제공자의 pi-catalog 목록만 해석된다" 를 고정한다.
import { describe, expect, it } from "vitest";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { OH_MY_PI_PROVIDERS, getOhMyPiProvider } from "@/ai/ohMyPiProviders";

async function loadCatalog() {
  return await import("@/ai/modelCatalog");
}

/** 실측 `bun -e getBundledModels("google-antigravity")` (2026-08-27, 2026-09-10 번들 17.4.0 재확인: 19종, 3.8 없음). */
const ANTIGRAVITY_BUNDLED = [
  "claude-opus-4-5",
  "claude-opus-4-6",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-flash",
  "gemini-3-pro",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.7-flash-tiered",
  "gpt-oss-120b",
  "tab_flash_lite_preview",
  "tab_jump_flash_lite_preview",
];

/** ChatGPT 경로에서 고를 수 있는 모델. 순서 = 화면 순서(최신 우선, 2026-11-04), 첫 항목 = 기본, 끝의 둘은 옛 모델. */
const CODEX_SUPPORTED = [
  "gpt-6.1-sol",
  "gpt-6.1-terra",
  "gpt-6-astra",
  "gpt-6-luna",
  "gpt-6-sol",
  "gpt-5.6-sol",
];

/** 최신 모델(2026-11-04 오너 목록). 제공자 id → 카탈로그·창 표에 반드시 있어야 하는 id. */
const TARGET_MODELS: Readonly<Record<string, readonly string[]>> = {
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
  [CODEX_PROVIDER_ID]: ["gpt-6.1-sol", "gpt-6.1-terra", "gpt-6-astra", "gpt-6-luna"],
  [ANTIGRAVITY_PROVIDER_ID]: ["gemini-4-argon", "gemini-3.8-flash"],
};

describe("modelCatalog — 두 제공자만 해석한다", () => {
  it("Antigravity 목록은 pi-catalog + 로컬 확장과 같고 첫 항목이 gemini-4-argon 이다", async () => {
    const { defaultModelForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    const models = modelCatalogForAuthMode("chatgpt", ANTIGRAVITY_PROVIDER_ID).flatMap((g) => g.models);

    expect([...models].sort()).toEqual([...ANTIGRAVITY_BUNDLED, "gemini-4-argon", "gemini-3.8-flash"].sort());
    expect(models[0]).toBe("gemini-4-argon");
    expect(defaultModelForAuthMode("chatgpt", ANTIGRAVITY_PROVIDER_ID)).toBe("gemini-4-argon");
    // `-high` 는 목록에 없다 — Cloud Code Assist 가 404 로 거부하는 ID 다(실측 2026-08-26).
    expect(models).not.toContain("gemini-3.7-flash-high");
  });

  it("Codex 목록은 정확히 여섯 모델(최신 우선)이고 첫 항목이 gpt-6.1-sol 다", async () => {
    const { defaultModelForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    const models = modelCatalogForAuthMode("chatgpt", CODEX_PROVIDER_ID).flatMap((g) => g.models);

    expect(models).toEqual(CODEX_SUPPORTED);
    expect(defaultModelForAuthMode("chatgpt", CODEX_PROVIDER_ID)).toBe("gpt-6.1-sol");
  });

  it("제공자 레코드의 defaultModel 이 카탈로그 첫 항목과 같다 (기본값 출처 하나)", async () => {
    // ohMyPiProviders 는 순환을 피하려 카탈로그를 import 하지 않는다 — 두 소스를 여기서 묶는다.
    const { defaultModelForAuthMode } = await loadCatalog();
    for (const provider of OH_MY_PI_PROVIDERS) {
      expect(defaultModelForAuthMode("chatgpt", provider.id), provider.id).toBe(provider.defaultModel);
      expect(getOhMyPiProvider(provider.id)?.defaultModel, provider.id).toBe(provider.defaultModel);
    }
  });

  it("사라진 게이트웨이 모델은 어느 제공자에서도 나오지 않는다", async () => {
    const { modelCatalogForAuthMode } = await loadCatalog();
    for (const providerId of [ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID]) {
      for (const authMode of ["chatgpt", "apiKey"] as const) {
        const models = modelCatalogForAuthMode(authMode, providerId).flatMap((g) => g.models);
        for (const gone of ["glm-5.2-ultrafast", "cpen/gemini-3-flash", "qwen3.8-max-preview", "grok-4.3"]) {
          expect(models, `${providerId}/${gone}`).not.toContain(gone);
        }
      }
    }
  });

  it("모르는 제공자 id 는 기본 제공자(Antigravity) 카탈로그로 떨어진다", async () => {
    const { modelCatalogForAuthMode } = await loadCatalog();
    expect(modelCatalogForAuthMode("chatgpt", "zai")[0]?.models[0]).toBe("gemini-4-argon");
    expect(modelCatalogForAuthMode("chatgpt")[0]?.models[0]).toBe("gemini-4-argon");
  });

  it("Claude 계정 목록은 5.5 세 모델이고 Opus 가 기본이다", async () => {
    const { defaultModelForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    expect(modelCatalogForAuthMode("chatgpt", "anthropic").flatMap((g) => g.models))
      .toEqual(["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
    expect(defaultModelForAuthMode("chatgpt", "anthropic")).toBe("claude-opus-5-5");
  });
});

describe("latestModelsFor — 첫 실행 목록은 옛 모델을 뺀다", () => {
  it("제공자별 최신 모델만 카탈로그 순서로 돌려주고 첫 항목이 기본 모델이다", async () => {
    const { defaultModelForAuthMode, latestModelsFor } = await loadCatalog();
    expect(latestModelsFor(CODEX_PROVIDER_ID)).toEqual(["gpt-6.1-sol", "gpt-6.1-terra", "gpt-6-astra", "gpt-6-luna"]);
    expect(latestModelsFor(ANTIGRAVITY_PROVIDER_ID)).toEqual(["gemini-4-argon", "gemini-3.8-flash"]);
    expect(latestModelsFor("anthropic")).toEqual(["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
    for (const provider of OH_MY_PI_PROVIDERS) {
      expect(latestModelsFor(provider.id)[0], provider.id).toBe(defaultModelForAuthMode("chatgpt", provider.id));
    }
  });

  it("옛 모델은 첨 실행 목록에서 빠지지만 설정 카탈로그에는 남고 여전히 유효하다", async () => {
    const { LEGACY_MODEL_IDS, isModelValidForAuthMode, latestModelsFor, modelCatalogForAuthMode } = await loadCatalog();
    expect([...LEGACY_MODEL_IDS[CODEX_PROVIDER_ID]!]).toEqual(["gpt-6-sol", "gpt-5.6-sol"]);
    expect([...LEGACY_MODEL_IDS[ANTIGRAVITY_PROVIDER_ID]!].sort()).toEqual([...ANTIGRAVITY_BUNDLED].sort());
    for (const [provider, legacy] of Object.entries(LEGACY_MODEL_IDS)) {
      const settings = modelCatalogForAuthMode("chatgpt", provider).flatMap((g) => g.models);
      for (const model of legacy) {
        expect(latestModelsFor(provider), `${provider}/${model}`).not.toContain(model);
        expect(settings, `${provider}/${model}`).toContain(model);
        expect(isModelValidForAuthMode("chatgpt", model, provider), `${provider}/${model}`).toBe(true);
      }
    }
  });
});

describe("최신 모델은 카탈로그와 창 표에 다 있다", () => {
  it("목표 id 마다 제공자 최신 목록과 ORIGINAL_MODEL_WINDOWS 에 양수 창이 있다", async () => {
    const { latestModelsFor } = await loadCatalog();
    const { ORIGINAL_MODEL_WINDOWS } = await import("@/ai/originalContext");
    for (const [provider, ids] of Object.entries(TARGET_MODELS)) {
      for (const id of ids) {
        expect(latestModelsFor(provider), `${provider}/${id}`).toContain(id);
        expect(ORIGINAL_MODEL_WINDOWS[provider]?.[id], `${provider}/${id}`).toBeGreaterThan(0);
      }
    }
    expect(ORIGINAL_MODEL_WINDOWS[CODEX_PROVIDER_ID]).toMatchObject({
      "gpt-6-astra": 272000, "gpt-6-luna": 272000, "gpt-6.1-sol": 500000, "gpt-6.1-terra": 272000,
    });
    expect(ORIGINAL_MODEL_WINDOWS.anthropic).toEqual({
      "claude-opus-5-5": 1000000, "claude-sonnet-5-5": 1000000, "claude-haiku-5-5": 1000000,
    });
  });
});

describe("isModelValidForAuthMode — 선택된 제공자 기준", () => {
  it("각 제공자는 자기 카탈로그 모델을 받아들인다", async () => {
    const { isModelValidForAuthMode } = await loadCatalog();
    for (const model of ANTIGRAVITY_BUNDLED) {
      expect(isModelValidForAuthMode("chatgpt", model, ANTIGRAVITY_PROVIDER_ID), model).toBe(true);
    }
    for (const model of CODEX_SUPPORTED) {
      expect(isModelValidForAuthMode("chatgpt", model, CODEX_PROVIDER_ID), model).toBe(true);
    }
  });

  it("Codex 는 네 모델 밖의 옛 번들 모델을 거부한다", async () => {
    const { isModelValidForAuthMode } = await loadCatalog();
    for (const retired of ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.3-codex-spark", "gpt-daybreak-blue-latest"]) {
      expect(isModelValidForAuthMode("chatgpt", retired, CODEX_PROVIDER_ID), retired).toBe(false);
    }
  });

  it("남의 제공자 모델과 옛 게이트웨이 ID 는 거부한다", async () => {
    const { isModelValidForAuthMode } = await loadCatalog();
    for (const foreign of ["gpt-5.6-sol", "z-ai/glm-5.2-ultrafast", "cpen/gpt-5-6-luna", "mimo-v2.5"]) {
      expect(isModelValidForAuthMode("chatgpt", foreign, ANTIGRAVITY_PROVIDER_ID), foreign).toBe(false);
    }
    for (const foreign of ["gemini-3.7-flash", "claude-opus-4-8", "gpt-5.1-codex", "cpen/gpt-5-6-luna"]) {
      expect(isModelValidForAuthMode("chatgpt", foreign, CODEX_PROVIDER_ID), foreign).toBe(false);
    }
  });

  it("Antigravity 는 번들링 밖 gemini 변형을 직접 입력할 수 있다(카탈로그는 화이트리스트가 아니다)", async () => {
    const { isModelValidForAuthMode } = await loadCatalog();
    expect(isModelValidForAuthMode("chatgpt", "gemini-9-experimental", ANTIGRAVITY_PROVIDER_ID)).toBe(true);
  });

  it("Gemini 4 Argon and 3.8 Flash are selectable through the verified local catalog extension", async () => {
    const { isModelValidForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    const models = modelCatalogForAuthMode("chatgpt", ANTIGRAVITY_PROVIDER_ID).flatMap((g) => g.models);
    expect(models).toContain("gemini-4-argon");
    expect(models).toContain("gemini-3.8-flash");
    expect(isModelValidForAuthMode("chatgpt", "gemini-4-argon", ANTIGRAVITY_PROVIDER_ID)).toBe(true);
    expect(isModelValidForAuthMode("chatgpt", "gemini-3.8-flash", ANTIGRAVITY_PROVIDER_ID)).toBe(true);
  });

  it("사고 강도 변형(-high/-medium/-low)은 거부한다", async () => {
    const { isModelValidForAuthMode } = await loadCatalog();
    for (const broken of ["gemini-3.7-flash-high", "gemini-3.7-flash-medium", "gemini-3.7-flash-low"]) {
      expect(isModelValidForAuthMode("chatgpt", broken, ANTIGRAVITY_PROVIDER_ID), broken).toBe(false);
    }
  });

  it("주입 게이트웨이(apiKey 전송)는 좁히지 않는다", async () => {
    const { isModelValidForAuthMode } = await loadCatalog();
    expect(isModelValidForAuthMode("apiKey", "gpt-5.1-codex", ANTIGRAVITY_PROVIDER_ID)).toBe(true);
    expect(isModelValidForAuthMode("apiKey", "z-ai/glm-5.2-ultrafast", CODEX_PROVIDER_ID)).toBe(true);
  });
});
