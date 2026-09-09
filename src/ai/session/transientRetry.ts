// ai/session/transientRetry.ts
// 일시 오류 재시도 정책. 재시도 횟수·대기·사용자 안내 문구만 담고, 무엇이 재시도할 만한
// 오류인가는 llmClient.isRetryableLlmError 가 판정한다.

export const ASSISTANT_TURN_RETRY_ATTEMPTS = 3;

const TRANSIENT_NETWORK_RETRY_GUIDANCE = "일시적 네트워크 문제로 보이면 재시도를 눌러 주세요.";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function appendTransientRetryGuidance(message: string): string {
  if (message.includes(TRANSIENT_NETWORK_RETRY_GUIDANCE)) return message;
  return `${message}\n${TRANSIENT_NETWORK_RETRY_GUIDANCE}`;
}
