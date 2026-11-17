// 기본 모델 계약 둘.
//   ① 새 설정의 공장 기본 = Claude Opus 5.5 · medium — 계획·실행·시각·작문·시공·감독 모든 슬롯이 한 모델이다(오너 결정 2026-11-16).
//   ② Google 계정(옛 저장값의 기본 제공자)의 기본 모델 = gemini-4-argon — 네 소스가 한 값이다(2026-08-26 강제, 2026-10-14 Argon 이동).
//
// 왜 계약으로 고정하는가: 기본 모델이 여러 곳에서 각자 정해지면(llmClient 의 DEFAULT_MODEL /
// DEFAULT_LITE_MODEL, modelCatalog 의 제공자별 추천 첫 항목, ohMyPiProviders 의 제공자 기본값)
// 한 곳만 바꿨을 때 나머지가 조용히 갈라진다. 실측(2026-08-26): 게이트웨이가 허용하지 않는
// 모델이 기본값으로 남아 400 "Model not allowed" 로 턴이 죽었고, 어디를 고쳐야 하는지
// 소스가 네 군데로 흩어져 있었다. 그래서 네 소스를 한 값으로 묶어 계약으로 잡는다.
//
// 네 소스만으로는 부족했다(실측 2026-09-26): 3.8 이동에서 프리셋 「빠르게」 의 fast 티어와
// modelForRole 의 리터럴 폴백이 3.7 로 남아, 「빠르게」 를 고르면 기본 모델이 조용히
// 내려앉았다. 파생 기본값도 같은 계약에 넣는다.
import { describe, expect, it } from "vitest";
import { DEFAULT_LITE_MODEL, DEFAULT_MODEL, defaultAiConfig } from "@/ai/llmClient";
import type { AiConfig } from "@/ai/llmClient";
import { defaultModelForAuthMode, modelCatalogForAuthMode } from "@/ai/modelCatalog";
import { tierModelFor } from "@/ai/modelPresets";
import { modelForRole } from "@/ai/modelRoles";
import { CLAUDE_DEFAULT_MODEL, DEFAULT_OH_MY_PI_PROVIDER, RECOMMENDED_OH_MY_PI_PROVIDER, getOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { configForUltrabrain } from "@/ai/ultrabrainConfig";
import { resolvePixelModel } from "@/ai/pixelModel";

/** Google 계정(옛 저장값의 기본 제공자)의 기본 모델. */
const FORCED_DEFAULT = "gemini-4-argon";
/** 새 설정의 공장 기본. */
const FACTORY_PROVIDER = "anthropic";
const FACTORY_MODEL = "claude-opus-5-5";

describe("공장 기본 = Claude Opus 5.5 · medium", () => {
  it("권장 제공자와 조수 기본 모델 상수가 Claude · Opus 5.5 다", () => {
    expect(RECOMMENDED_OH_MY_PI_PROVIDER).toBe(FACTORY_PROVIDER);
    expect(CLAUDE_DEFAULT_MODEL).toBe(FACTORY_MODEL);
  });

  it("defaultAiConfig 의 제공자와 두 모델 슬롯이 공장 기본이다", () => {
    const config = defaultAiConfig();

    expect(config.providerId).toBe(FACTORY_PROVIDER);
    expect(config.model).toBe(FACTORY_MODEL);
    expect(config.liteModel).toBe(FACTORY_MODEL);
  });

  it("공장 기본 추론 강도가 medium 이다(오너 결정 2026-11-16: 조수 기본은 Opus 5.5 medium)", () => {
    expect(defaultAiConfig().reasoningEffort).toBe("medium");
  });

  it("새 설정의 모든 역할 슬롯이 Claude 의 Opus 5.5 · medium 이다", () => {
    const roles = defaultAiConfig().roleModels ?? {};
    for (const role of ["deep", "vision", "writer", "build"] as const) {
      expect(roles[role], role).toEqual({ provider: FACTORY_PROVIDER, model: FACTORY_MODEL, thinkingLevel: "medium" });
    }
  });

  it("계획·감독(ultrabrain)도 같은 모델 · medium 이다 — 감독만 high 로 두지 않는다", () => {
    expect(configForUltrabrain(defaultAiConfig())).toMatchObject({ providerId: FACTORY_PROVIDER, model: FACTORY_MODEL, reasoningEffort: "medium" });
  });

  it("도트 저작 칸은 비어 있어 계획 모델(Opus 5.5 medium)을 따른다 — 다른 계정을 요구하지 않는다", () => {
    expect(defaultAiConfig().pixelModel).toBeUndefined();
    expect(resolvePixelModel(defaultAiConfig())).toEqual({ follows: true, model: { provider: FACTORY_PROVIDER, model: FACTORY_MODEL, thinkingLevel: "medium" } });
  });

  it("Claude 계정의 카탈로그 첫 항목·제공자 레코드·두 티어가 모두 공장 기본 모델이다(프리셋이 Haiku 로 내리지 않는다)", () => {
    expect(defaultModelForAuthMode("chatgpt", FACTORY_PROVIDER)).toBe(FACTORY_MODEL);
    expect(getOhMyPiProvider(FACTORY_PROVIDER)?.defaultModel).toBe(FACTORY_MODEL);
    expect(tierModelFor(FACTORY_PROVIDER, "fast")).toBe(FACTORY_MODEL);
    expect(tierModelFor(FACTORY_PROVIDER, "strong")).toBe(FACTORY_MODEL);
  });

  it("모델이 빈 Claude 설정의 modelForRole 폴백도 공장 기본 모델이다", () => {
    expect(modelForRole({ providerId: FACTORY_PROVIDER } as AiConfig, "deep").model).toBe(FACTORY_MODEL);
  });
});

describe("Google 계정의 강제 기본 모델", () => {
  it("감독 모델과 실행(lite) 모델 상수가 모두 강제 기본값이다(옛 저장값의 모델 기본)", () => {
    expect(DEFAULT_MODEL).toBe(FORCED_DEFAULT);
    expect(DEFAULT_LITE_MODEL).toBe(FORCED_DEFAULT);
  });

  it("기본 제공자의 카탈로그 추천 첫 항목이 강제 기본값이다", () => {
    expect(defaultModelForAuthMode("chatgpt", DEFAULT_OH_MY_PI_PROVIDER)).toBe(FORCED_DEFAULT);

    const groups = modelCatalogForAuthMode("chatgpt", DEFAULT_OH_MY_PI_PROVIDER);
    expect(groups[0]?.models[0]).toBe(FORCED_DEFAULT);
  });

  it("기본 제공자 레코드의 defaultModel 도 강제 기본값이다", () => {
    expect(getOhMyPiProvider(DEFAULT_OH_MY_PI_PROVIDER)?.defaultModel).toBe(FORCED_DEFAULT);
  });

  it("강제 기본값은 카탈로그에서 실제로 고를 수 있다(드롭다운 누락 방지)", () => {
    const models = modelCatalogForAuthMode("chatgpt", DEFAULT_OH_MY_PI_PROVIDER).flatMap((g) => g.models);

    expect(models).toContain(FORCED_DEFAULT);
  });

  it("기본 제공자의 fast 티어가 강제 기본값이다(「빠르게」 프리셋이 모델을 내리지 않는다)", () => {
    expect(tierModelFor(DEFAULT_OH_MY_PI_PROVIDER, "fast")).toBe(FORCED_DEFAULT);
  });

  it("역할 모델이 저장돼 있지 않으면 modelForRole 폴백도 강제 기본값이다", () => {
    expect(modelForRole({} as AiConfig, "deep").model).toBe(FORCED_DEFAULT);
  });

});
