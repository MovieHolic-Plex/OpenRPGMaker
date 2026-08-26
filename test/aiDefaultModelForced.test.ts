// 모든 모델 슬롯의 기본값을 gemini-3.7-flash 하나로 강제한다 (감독 지시 2026-08-26).
//
// 왜 계약으로 고정하는가: 기본 모델이 여러 곳에서 각자 정해지면(llmClient 의 DEFAULT_MODEL /
// DEFAULT_LITE_MODEL, modelCatalog 의 제공자별 추천 첫 항목, ohMyPiProviders 의 제공자 기본값)
// 한 곳만 바꿨을 때 나머지가 조용히 갈라진다. 실측(2026-08-26): 게이트웨이가 허용하지 않는
// 모델이 기본값으로 남아 400 "Model not allowed" 로 턴이 죽었고, 어디를 고쳐야 하는지
// 소스가 네 군데로 흩어져 있었다. 그래서 네 소스를 한 값으로 묶어 계약으로 잡는다.
import { describe, expect, it } from "vitest";
import { DEFAULT_LITE_MODEL, DEFAULT_MODEL, defaultAiConfig } from "@/ai/llmClient";
import { defaultModelForAuthMode, modelCatalogForAuthMode } from "@/ai/modelCatalog";
import { DEFAULT_OH_MY_PI_PROVIDER, getOhMyPiProvider } from "@/ai/ohMyPiProviders";

const FORCED_DEFAULT = "gemini-3.7-flash";

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
});
