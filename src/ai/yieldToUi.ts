// ai/yieldToUi.ts
// 동기 도구 실행 사이에 이벤트 루프를 한 번 양보한다.
//
// AssistantSession 은 tool_started → runTool → tool_call 을 한 동기 무더기로 낸다.
// 그 사이 await 가 없으면 라이브 행·고스트가 한 프레임도 그려지지 않고, 맵 페인트가
// 멈춘다(실측: Chromium 존재 폴링 0/17). 표시 400ms 체류는 전환만 미룰 뿐 실행은
// 그대로 메인 스레드를 잡는다. 여기서 한 프레임을 내준다.
//
// 브라우저: requestAnimationFrame 한 틱. Node/테스트: 즉시 resolve — 세션 계약
// 테스트가 실시간을 기다리지 않게.

export type YieldToUi = () => Promise<void>;

export function defaultYieldToUi(): Promise<void> {
  if (typeof requestAnimationFrame === "function") {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  return Promise.resolve();
}
