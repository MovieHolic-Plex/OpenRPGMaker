// ChatGPT(Codex 로그인) 로 시작하는 설정 고정물 — 2026-11-23 이전의 조수 공장 기본(GPT-6.2 Sol · medium 한 모델)과 같은 꼴이다.
// 공장 기본은 이제 Claude Sonnet 5.5 · high 다(오너 결정 2026-11-23). ChatGPT 길의 동작을 보는 시험은 공장 기본에 기대지 않고
// 이 고정물로 시작해, 공장 기본이 또 바뀌어도 시험이 보려던 것을 계속 본다.
import { defaultAiConfig, type AiConfig } from "@/ai/llmClient";
import type { RoleModel } from "@/ai/modelRoles";

const CHATGPT_PROVIDER = "openai-codex";
const CHATGPT_MODEL = "gpt-6.2-sol";

export function chatgptFixtureConfig(): AiConfig {
  const medium: RoleModel = { provider: CHATGPT_PROVIDER, model: CHATGPT_MODEL, thinkingLevel: "medium" };
  return {
    ...defaultAiConfig(),
    providerId: CHATGPT_PROVIDER,
    model: CHATGPT_MODEL,
    liteModel: CHATGPT_MODEL,
    reasoningEffort: "medium",
    ultrabrainProviderId: CHATGPT_PROVIDER,
    ultrabrainModel: CHATGPT_MODEL,
    ultrabrainReasoningEffort: "medium",
    roleModels: { deep: { ...medium }, vision: { ...medium }, writer: { ...medium }, build: { ...medium } },
  };
}
