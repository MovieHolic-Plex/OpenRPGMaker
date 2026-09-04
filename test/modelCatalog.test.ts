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

/** 실측 `bun -e getBundledModels("google-antigravity")` (2026-08-27). */
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
  "gemini-3.8-flash",
  "gpt-oss-120b",
  "tab_flash_lite_preview",
  "tab_jump_flash_lite_preview",
];

/** 실측 `bun -e getBundledModels("openai-codex")` (2026-08-27). */
const CODEX_BUNDLED = [
  "gpt-5.3-codex-spark",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.5",
  "gpt-5.6-luna",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-daybreak-blue-latest",
];

describe("modelCatalog — 두 제공자만 해석한다", () => {
  it("Antigravity 목록은 pi-catalog 와 같고 첫 항목이 gemini-3.7-flash 다", async () => {
    const { defaultModelForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    const models = modelCatalogForAuthMode("chatgpt", ANTIGRAVITY_PROVIDER_ID).flatMap((g) => g.models);

    expect([...models].sort()).toEqual([...ANTIGRAVITY_BUNDLED].sort());
    expect(models[0]).toBe("gemini-3.7-flash");
    expect(defaultModelForAuthMode("chatgpt", ANTIGRAVITY_PROVIDER_ID)).toBe("gemini-3.7-flash");
    // `-high` 는 목록에 없다 — Cloud Code Assist 가 404 로 거부하는 ID 다(실측 2026-08-26).
    expect(models).not.toContain("gemini-3.7-flash-high");
  });

  it("Codex 목록은 pi-catalog 와 같고 첫 항목이 gpt-5.6-sol 다", async () => {
    const { defaultModelForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    const models = modelCatalogForAuthMode("chatgpt", CODEX_PROVIDER_ID).flatMap((g) => g.models);

    expect([...models].sort()).toEqual([...CODEX_BUNDLED].sort());
    expect(models[0]).toBe("gpt-5.6-sol");
    expect(defaultModelForAuthMode("chatgpt", CODEX_PROVIDER_ID)).toBe("gpt-5.6-sol");
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
    expect(modelCatalogForAuthMode("chatgpt", "zai")[0]?.models[0]).toBe("gemini-3.7-flash");
    expect(modelCatalogForAuthMode("chatgpt")[0]?.models[0]).toBe("gemini-3.7-flash");
  });
});

describe("isModelValidForAuthMode — 선택된 제공자 기준", () => {
  it("각 제공자는 자기 카탈로그 모델을 받아들인다", async () => {
    const { isModelValidForAuthMode } = await loadCatalog();
    for (const model of ANTIGRAVITY_BUNDLED) {
      expect(isModelValidForAuthMode("chatgpt", model, ANTIGRAVITY_PROVIDER_ID), model).toBe(true);
    }
    for (const model of CODEX_BUNDLED) {
      expect(isModelValidForAuthMode("chatgpt", model, CODEX_PROVIDER_ID), model).toBe(true);
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

  it("Gemini 3.8 Flash 를 Antigravity 목록에서 고를 수 있다", async () => {
    const { isModelValidForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    const models = modelCatalogForAuthMode("chatgpt", ANTIGRAVITY_PROVIDER_ID).flatMap((g) => g.models);
    expect(models).toContain("gemini-3.8-flash");
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
