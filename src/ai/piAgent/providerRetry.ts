// ai/piAgent/providerRetry.ts
// 제공자 스트림이 도중에 끊긴 오류를 알아본다 — Pi 실행 전체를 버리지 않고 이어 가기 위해서다.
//
// 왜 (2026-09-24 꿈 세계 도그푸딩 dream-1): 시공 턴이 맵 5개를 만든 직후 Cloud Code Assist 스트림이
// 「ended without a finish reason」으로 끊겼고, pi-agent-core 는 그 오류를 assistant 메시지로 남긴 채
// 루프를 끝냈다. 제공자 재시도는 스트림이 시작되기 전(엔드포인트 전환)에만 돌므로, 한 번의 끊김이
// 4분 작업을 「빈 껍데기 맵 5개 + 엔딩 없음」으로 끝냈다. 같은 대화 기록 위에서 한 턴 더 요청하면
// 모델은 실행되지 않은 도구 호출을 다시 부른다.
//
// 모르는 오류(인자 검증·권한·할당량 소진 문구 등)는 여기서 true 가 되지 않는다 — 같은 요청을 되풀이해도
// 결과가 같기 때문이다.

export const PI_PROVIDER_STREAM_RETRY_LIMIT = 2;

const TRANSIENT_PATTERNS: readonly RegExp[] = [
  /stream ended without a finish reason/i,
  /connection (?:dropped|reset|closed)/i,
  /response truncated/i,
  /\bECONNRESET\b|\bETIMEDOUT\b|\bEPIPE\b|socket hang up/i,
  /\bfetch failed\b|network error|terminated/i,
  /\b(?:502|503|504)\b|bad gateway|service unavailable|gateway timeout/i,
  /\boverloaded\b|\bUNAVAILABLE\b/i,
  /returned an empty response/i,
  // 2026-09-24 갤러리 호러 r3: 생각만 흘리고 답을 안 준 응답 — 한 번 더 요청하면 대개 풀린다.
  /thought-only response|without final output/i,
];

/** 같은 대화 기록으로 한 번 더 요청하면 나아질 법한 제공자 오류인가. */
export function isTransientProviderStreamError(message: string | undefined): boolean {
  if (!message) return false;
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(message));
}

/** 끊긴 뒤 이어 가기 턴의 사용자 메시지. 실행되지 않은 호출을 다시 부르게 한다. */
export function providerStreamResumePrompt(attempt: number, limit: number): string {
  return `[연결 끊김 ${attempt}/${limit}] 직전 응답이 제공자 쪽에서 끊겼습니다. 「not executed」로 끝난 도구 호출은 실행되지 않았으니 필요하면 다시 부르고, 하던 작업을 처음부터 다시 하지 말고 이어서 진행하세요.`;
}
