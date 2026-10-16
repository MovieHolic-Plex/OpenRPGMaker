import { resolveSurfaceAiConfig } from "./assistantEndpoint";
import type { DotTextChat } from "./dotTextImage";
import { chatCompletion, loadAiConfig } from "./llmClient";

/**
 * 브라우저의 낱장 도트 호출 — 조수와 같은 엔드포인트(llmClient.chatCompletion), 표면 정책만 `pixel-draw`.
 * 저장된 «도트 저작 모델» 이 있으면 그 모델, 없으면(옛 설정) 계획·최종 판단 모델(resolveSurfaceAiConfig 가 정한다).
 */
export function createBrowserDotTextChat(): DotTextChat {
  return async (messages, signal) => {
    const config = resolveSurfaceAiConfig("pixel-draw", loadAiConfig());
    const result = await chatCompletion(config, {
      messages: [...messages],
      response_format: { type: "json_object" },
      temperature: 0.6,
      ...(signal ? { signal } : {}),
    });
    const content = result.message.content;
    const text = typeof content === "string" ? content : (content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("\n");
    return { text, model: config.model, provider: config.providerId ?? "" };
  };
}
