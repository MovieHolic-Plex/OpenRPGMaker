// 모든 모델 슬롯의 기본값을 gemini-3.8-flash 하나로 강제한다 (2026-09-26 이동 — 실행 루프 기본
// 사고 강도가 low 가 되면서 저지연 모델을 기본으로 당겼다. 2026-08-26 강제의 이유는 그대로다).
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
import { DEFAULT_OH_MY_PI_PROVIDER, getOhMyPiProvider } from "@/ai/ohMyPiProviders";

const FORCED_DEFAULT = "gemini-3.8-flash";

describe("강제 기본 모델", () => {
  it("감독 모델과 실행(lite) 모델 상수가 모두 강제 기본값이다", () => {
    expect(DEFAULT_MODEL).toBe(FORCED_DEFAULT);
    expect(DEFAULT_LITE_MODEL).toBe(FORCED_DEFAULT);
  });

  it("defaultAiConfig 의 두 모델 슬롯이 강제 기본값이다", () => {
    const config = defaultAiConfig();

    expect(config.model).toBe(FORCED_DEFAULT);
    expect(config.liteModel).toBe(FORCED_DEFAULT);
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

  it("공장 기본 추론 강도가 high 다(감독 지시 2026-10-05)", () => {
    expect(defaultAiConfig().reasoningEffort).toBe("high");
  });
});
