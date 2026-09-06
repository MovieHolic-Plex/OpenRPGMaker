// 타일셋 매핑 호출. **전송은 llmClient.chatCompletion 하나로 모은다.**
//
// 예전에는 이 파일이 직접 fetch 하면서 companion/proxyAuth 분기와 X-Rpgzzu-Provider·Authorization
// 헤더를 손으로 조립했다. 그 중복 때문에 에디터 AI 가 OAuth 전용으로 바뀐 뒤 여기만 갱신되지 않아
// 타일셋 AI 가 무증상으로 죽어 있었다(실측 2026-08-21). 헤더·인증·엔드포인트 판정을 llmClient 에
// 넘기면 그 사고 유형이 구조적으로 막히고, 1회 자동 재시도·타임아웃·전송 건강/모델 강등 보고도 함께 붙는다.
//
// 버린 것: routing.max_input_per_1m (cpenrouter 게이트웨이 전용 비용 상한). 동반 서비스 경로에서는
// 이미 보내지 않고 있었고, 인증이 OAuth 전용이 된 뒤 남은 경로가 없다. 비용은 모델 선택으로 통제한다.
// 지킨 것: max_tokens 고정값(매핑 JSON 은 길지만 공급자 상한이 낮다 — 실측 cpen 8192 통과·32768 은 422), temperature 0.2.
// 모델 티어·토큰 예산·준비 판정은 assistantEndpoint 의 표면 정책이 소유한다 — 이 표면이 자기만의
// 준비 판정을 들고 있는 동안 조수와 기준이 달랐다: 모델을 보지 않아 `model: ""` 로도 요청이 나갔고,
// 프로덕션 reader 는 사라졌지만 마이그레이션이 보존하는 레거시 `oprn:llmApiKey` 하나로 버튼이 열렸다.
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { chatCompletion, loadAiConfig, LlmError } from "@/ai/llmClient";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";

import { buildTilesetMappingRequest, normalizeCpenResponseText, type CpenTilesetRequest } from "@/editor/tilesetAiRequest";
export { normalizeCpenResponseText, type CpenTilesetRequest } from "@/editor/tilesetAiRequest";

export async function requestCpenTilesetMapping(request: CpenTilesetRequest): Promise<string> {
  const config = loadAiConfig();
  if (!isAssistantEndpointReady(config, getAiConnectionStatus(config))) {
    return "AI 연결을 먼저 완료하세요. 편집기 헤더의 AI 설정에서 로그인한 뒤 다시 시도해 주세요.";
  }

  try {
    const result = await chatCompletion(
      resolveSurfaceAiConfig("tileset-analysis", config),
      buildTilesetMappingRequest(request),
    );
    const content = result.message.content;
    const responseText = typeof content === "string"
      ? content
      : (content ?? []).map((part) => (part.type === "text" ? part.text : "")).filter(Boolean).join("\n");
    return responseText ? normalizeCpenResponseText(responseText) : "AI 응답을 읽지 못했습니다.";
  } catch (error) {
    // LlmError.message 는 humanizeLlmStatus 가 만든 문장이다(401/402/429 에 조치 안내가 붙는다).
    // 예전의 `HTTP <status> <body>` 원문 덤프보다 사용자가 할 일을 알 수 있다.
    if (error instanceof LlmError) return `AI 호출 실패: ${error.message}`;
    if (error instanceof Error && error.name === "AbortError") {
      return "AI 응답 시간이 초과되었습니다. 다시 분석해 주세요.";
    }
    if (error instanceof TypeError) {
      return "AI 호출 실패: 네트워크 연결 또는 프록시 설정을 확인해 주세요.";
    }
    throw error;
  }
}

export function hasCpenTilesetApiKey(): boolean {
  const config = loadAiConfig();
  return isAssistantEndpointReady(config, getAiConnectionStatus(config));
}
