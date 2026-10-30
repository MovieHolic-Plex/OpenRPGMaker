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

// ───── 모델 호출 무응답 감시 (2026-10-29 vm1 argon) ─────
// 사용자 지정 엔드포인트(openai-compat:*)는 엔드포인트 설정 「첫 토큰 대기」(기본 600초)를 첫 응답·토큰 사이 감시로 그대로 썼다 —
// 스트림이 조용해지면 호출 하나가 10분씩 붙잡혔고, 그 오류 문구(「timed out while waiting for the first event」「stalled while
// waiting for the next event」)는 위 TRANSIENT_PATTERNS 에 없어 다시 요청하지도 않았다. 이제 호출 단위로 더 짧게 끊고,
// 같은 대화 기록으로 정해진 횟수만 다시 요청한 뒤 그래도 조용하면 이 차례를 깔끔한 실패로 끝낸다.

/** pi-ai 의 스트림 감시가 끊을 때 남기는 문구(openai-completions·공통 idle iterator). */
const MODEL_STALL_PATTERN = /stream (?:timed out while waiting for the first event|stalled while waiting for the next event)|waiting for the (?:first|next) (?:stream )?event|^Request timed out\.?$/i;

/** 스트림 무응답 감시가 끊은 호출인가 — 무응답 재시도 예산(modelStallLimits().retries)으로 센다. */
export function isModelStallError(message: string | undefined): boolean {
  return !!message && MODEL_STALL_PATTERN.test(message);
}

export interface ModelStallLimits {
  /** 요청 뒤 첫 이벤트까지 기다리는 최대 시간(ms). */
  readonly firstEventMs: number;
  /** 첫 이벤트 뒤 이벤트 사이 최대 침묵(ms). */
  readonly idleMs: number;
  /** 무응답으로 끊긴 호출을 같은 기록으로 다시 요청하는 횟수. 넘으면 차례를 실패로 끝낸다. */
  readonly retries: number;
}

const positiveInt = (raw: string | undefined, fallback: number): number => {
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

/**
 * 호출 단위 무응답 한도. 환경 변수로 조절한다(0 은 «내 상한 없음» — 엔드포인트·제공자 값을 그대로 쓴다):
 *   OPRN_MODEL_FIRST_EVENT_TIMEOUT_MS (기본 180000), OPRN_MODEL_IDLE_TIMEOUT_MS (기본 90000), OPRN_MODEL_STALL_RETRIES (기본 2).
 * 첫 응답 기본이 120초가 아니라 180초인 까닭: vm1 argon(8318) 실측에서 정상 호출도 첫 응답까지 1분 넘게 걸렸다 — 정상 호출을 끊지 않을 여유.
 */
export function modelStallLimits(env: Record<string, string | undefined> = process.env): ModelStallLimits {
  return {
    firstEventMs: positiveInt(env.OPRN_MODEL_FIRST_EVENT_TIMEOUT_MS, 180_000),
    idleMs: positiveInt(env.OPRN_MODEL_IDLE_TIMEOUT_MS, 90_000),
    retries: positiveInt(env.OPRN_MODEL_STALL_RETRIES, 2),
  };
}

/**
 * 한 호출의 스트림 옵션에 무응답 한도를 씌운다 — 이미 정해진 값(엔드포인트 설정·모델 compat)보다 짧을 때만 줄인다.
 * pi-ai 는 호출 옵션(streamFirstEventTimeoutMs·streamIdleTimeoutMs)을 환경 변수·모델 compat 보다 먼저 본다.
 */
export function withModelStallLimits<O extends Record<string, unknown> | undefined>(
  options: O, current: { readonly firstEventMs?: number; readonly idleMs?: number }, limits: ModelStallLimits = modelStallLimits(),
): O & { streamFirstEventTimeoutMs?: number; streamIdleTimeoutMs?: number } {
  const cap = (have: number | undefined, mine: number): number | undefined => {
    if (!mine) return have;
    if (have === undefined || have <= 0) return mine;
    return Math.min(have, mine);
  };
  const first = cap(current.firstEventMs, limits.firstEventMs);
  const idle = cap(current.idleMs, limits.idleMs);
  return { ...(options ?? {}), ...(first !== undefined ? { streamFirstEventTimeoutMs: first } : {}), ...(idle !== undefined ? { streamIdleTimeoutMs: idle } : {}) } as never;
}

/** 무응답 재시도를 다 쓴 뒤 사용자·다음 차례에 남기는 실패 문장. */
export function modelStallFailure(retries: number, limits: ModelStallLimits = modelStallLimits()): string {
  return `AI 모델이 응답하지 않아(첫 응답 ${Math.round(limits.firstEventMs / 1000)}초·토큰 사이 ${Math.round(limits.idleMs / 1000)}초 한도, 같은 요청 ${retries}번 더 보냄) 이 차례를 끝냈습니다. 지금까지 적용한 변경은 남아 있습니다 — 다시 보내면 이어서 합니다.`;
}
