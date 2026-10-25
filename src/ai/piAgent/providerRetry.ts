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

export const PI_PROVIDER_STREAM_RETRY_LIMIT = 4;

const TRANSIENT_PATTERNS: readonly RegExp[] = [
  /stream ended without a finish reason/i,
  /connection (?:dropped|reset|closed)/i,
  /response truncated/i,
  /\bECONNRESET\b|\bETIMEDOUT\b|\bEPIPE\b|socket hang up/i,
  /\bfetch failed\b|network error|terminated/i,
  /\b(?:502|503|504)\b|bad gateway|service unavailable|gateway timeout/i,
  /\boverloaded\b|\bUNAVAILABLE\b/i,
  // 2026-10-20 로컬 Codex CLI(gpt-6.1-sol): 「Selected model is at capacity. Please try a different model.」 — 같은 명령이 번갈아 성공/실패했다.
  /model is at capacity/i,
  /returned an empty response/i,
  // 2026-10-14 gpt-6-astra 오프닝 시험: OpenAI 쪽 「An error occurred while processing your request … (upstream_server_error)」 로 6·17턴째에 끝났다 — 재요청하면 풀리는 서버 오류.
  // 2026-10-15 Argon 8318 프록시 경로: 계정 승격 순간 「unknown provider for model」, 소켓 끊김, 일회성 400 — 같은 요청을 다시 보내면 풀린다.
  /socket connection was closed unexpectedly|unknown provider for model|400 Request contains an invalid argument/i,
  // 2026-10-15 Argon 오프닝 2라운드: 「500 Internal error encountered」·「antigravity stream ended without a terminal candidate response」 로 8·10턴째에 끝났다.
  /\b500\b[^\n]{0,24}internal error|Internal error encountered|stream ended without a terminal/i,
  /upstream_server_error|An error occurred while processing your request/i,
  // 2026-10-14 Argon 오프닝 px4: 20분 실행 중 「OAuth token expired before request — please retry; AuthStorage will refresh on the next attempt」
  // 로 28턴째에 끝났다. 다음 시도에서 토큰이 갱신된다고 스스로 말하는 오류라 이어 가면 풀린다.
  /OAuth token expired[\s\S]*(?:retry|refresh)/i,
  // 2026-09-24 갤러리 호러 r3: 생각만 흘리고 답을 안 준 응답 — 한 번 더 요청하면 대개 풀린다.
  /thought-only response|without final output/i,
  // 2026-09-28 REFMAP 조수 시험: Cloud Code Assist 가 도구 호출을 만드는 도중(functionCallingConfig VALIDATED)
  // 「400 Request contains an invalid argument」로 끝냈다. 같은 도구·같은 종류의 기록으로 앞선 요청은 모두 통과했고,
  // 모델이 부르려던 도구(paint_pack_layout)의 인자 스키마만 바꿔도 8회 중 5회 → 24회 중 1회로 줄었다 — 요청 본문이 아니라
  // 생성 쪽 실패다. 이어 가기 턴을 한 번 더 주면 다시 뽑는다(원 요청: ~/.omp/logs/http-400-requests/).
  /Cloud Code Assist API error \(400\)[\s\S]*INVALID_ARGUMENT/,
  // 2026-10-25 조수 단독 게임 G12/G14: 제공자 쪽 「첫 응답 대기」 감시가 요청을 끊으면 사유 없는 「Request was aborted」만 남는다
  // (Argon 이 Flash 의 60초 감시를 물려받아, 읽기가 쌓인 8~9번째 턴에서 네 번 연속 끊겼다). 우리 쪽 중단(턴·시간 상한, 사용자 중단)은
  // 사유를 실어 이 검사보다 먼저 걸리므로, 여기까지 온 맨 문구는 제공자 쪽 끊김이다 — 이어 가면 다시 요청한다.
  /^Request was aborted\.?$/,
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
