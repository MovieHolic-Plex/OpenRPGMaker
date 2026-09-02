// editor/operators/operatorIntentClient.ts
// 의도 파서의 LLM 어댑터. 파서 본체(operatorIntent.ts)는 순수하게 두고, 네트워크는 여기만 안다.
//
// 호출은 **한 번, JSON 하나**다 — 도구 루프도, 스트리밍도, 재시도 사슬도 없다.
// llmClient 의 response_format:"json_object" 경로를 쓴다(타일셋 매핑·성향 증류와 같은 자리).
// 직접 fetch 하지 않는 이유는 그 우회가 OAuth 분기·타임아웃을 각자 재구현하다 조용히 죽은
// 전례가 있기 때문이다(llmClient.ts:287 주석).

import { chatCompletion, configForLiteModel, loadAiConfig } from "@/ai/llmClient";

/**
 * 해석 한 번에 허용하는 벽시계. 넘기면 끊고 키워드 폴백으로 떨어진다.
 * 상한이 없으면 응답 없는 공급자에서 "해석 중…" 상태로 입력창이 잠긴 채 영원히 남는다
 * (실사에서 확인한 실패 모드). 한 문장을 JSON 으로 옮기는 일에 이보다 오래 걸릴 이유는 없다.
 */
export const OPERATOR_INTENT_TIMEOUT_MS = 20_000;

/** 문장 하나를 JSON 문자열로. 실패는 그대로 던진다 — 폴백 판단은 파서가 한다. */
export async function completeOperatorIntent(system: string, user: string): Promise<string> {
  const config = configForLiteModel(loadAiConfig());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPERATOR_INTENT_TIMEOUT_MS);
  let result;
  try {
    result = await chatCompletion(config, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      // 분류·추출 호출이라 표집을 좁힌다. 같은 문장이 매번 다른 파라미터로 읽히면 안 된다.
      temperature: 0.2,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const content = result.message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (part.type === "text" ? part.text : "")).join("");
  }
  return "";
}
