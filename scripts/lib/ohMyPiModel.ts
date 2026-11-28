import { getModel } from "@earendil-works/pi-ai/compat";
import { ASSISTANT_CHATGPT_MODEL } from "../../src/ai/chatgptDefault.ts";
import { isClaudeModelId, isGptModelId } from "../../src/ai/liveModels.ts";
import { getOhMyPiProvider } from "../../src/ai/ohMyPiProviders.ts";
import { isOpenAiCompatProviderId } from "../../src/ai/openAiCompat.ts";
import { resolveOpenAiCompatModel } from "./openAiCompatModel.ts";

const GOOGLE_OAUTH_DISABLED_ERROR =
  "Google 계정 직접 로그인(google-antigravity)은 계정 정지 위험으로 비활성화되어 있습니다. Gemini API 키를 사용해 주세요.";

/** Exact selection only. Missing catalog entries must never change the user's model. */
export function resolveOhMyPiModel(provider: string, requested?: string) {
  // 사용자 지정(OpenAI 호환) 엔드포인트는 번들 카탈로그에 없다 — 호스트가 실어 보낸 정의로 모델을 만든다.
  if (isOpenAiCompatProviderId(provider)) return resolveOpenAiCompatModel(provider, requested) as ReturnType<typeof getModel>;
  if (provider === "google-antigravity") {
    throw Object.assign(new Error(GOOGLE_OAUTH_DISABLED_ERROR), { status: 400 });
  }
  const id = requested?.trim() || getOhMyPiProvider(provider)?.defaultModel || "";
  const exact = getModel(provider as never, id as never);
  if (exact && typeof exact === "object" && "id" in exact) return exact;
  // 레거시/별칭 제공자 ID 매핑(xai-oauth → xai, kimi-code → kimi-coding).
  const aliasProvider = provider === "xai-oauth" ? "xai" : provider === "kimi-code" ? "kimi-coding" : undefined;
  if (aliasProvider) {
    const aliased = getModel(aliasProvider as never, id as never);
    if (aliased && typeof aliased === "object" && "id" in aliased) return aliased;
  }
  // Claude 5.5 Haiku 등 카탈로그 반영 전 모델(Anthropic /v1/models 가 내준 새 claude-* 포함)은 같은 계열 베이스 모델에 ID 만 덮어 쓴다.
  if (provider === "anthropic" && isClaudeModelId(id)) {
    const base = getModel("anthropic", "claude-sonnet-5-5");
    if (base) return { ...base, id, name: id };
  }
  // ChatGPT(Codex) 구독이 서버 목록(GET /backend-api/codex/models, scripts/lib/liveModelList.ts)에서 내준 새 GPT 모델은
  // 번들 카탈로그에 반영되기 전이라도 같은 계열 기준 모델에 ID 만 덮어 쓴다. 다른 모델로 바꿔 부르지 않는다 —
  // 서버가 그 ID 를 거절하면 그 거절이 그대로 사용자에게 간다.
  if (provider === "openai-codex" && isGptModelId(id)) {
    for (const baseId of [ASSISTANT_CHATGPT_MODEL, "gpt-6.2-astra", "gpt-6.1-sol", "gpt-5.6-sol"]) {
      const base = getModel("openai-codex" as never, baseId as never);
      if (base && typeof base === "object" && "id" in base) return { ...base, id, name: id } as typeof base;
    }
  }
  throw Object.assign(new Error(`지원 목록에 없는 모델입니다: ${provider}/${id}. 다른 모델로 대체하지 않았습니다.`), { status: 400 });
}
