// 워커 이벤트 루프에 한 차례를 준다 — 긴 동기 작업(장소 한 곳 짓기·마감 단계 하나) 사이에 부른다. 순서·결과는 그대로다.
// 왜(2026-11-11 purpose-desert 1~4·r1check-fun): 장소 짓기·출구 마감이 한 번에 31~74초 루프를 막았다. 그동안 실행 스트림의 heartbeat
// (scripts/lib/piAgentStream.ts, 5초)가 못 나가 편집기의 30초 침묵 감시(src/ai/piAgent/client.ts)가 스트림을 끊고 이어 받았다 — 턴 1에 네 번.
// 타이머 한 번(밀린 heartbeat 가 먼저 돈다) + 즉시 큐 한 번(그 줄이 소켓으로 나가고, 들어온 적용·그림 응답이 읽힌다).
export async function yieldToLoop(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await new Promise<void>((resolve) => setImmediate(resolve));
}
